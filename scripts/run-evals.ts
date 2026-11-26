/**
 * npm run eval      → scores the offline fallback on evals/<pack>.json (no key needed)
 * npm run eval:ai   → scores the configured language model (needs OPENROUTER_API_KEY in the environment or .env.local)
 * npm run eval:models -- --models=google/gemini-2.5-flash,openai/gpt-5-mini
 *                     → same eval for each model + a comparison table (accuracy, leaks, latency, cost per 1000 diagnoses)
 *                       This table is our "why this API" justification for the judges.
 *
 * Splits: "dev" sentences were used while writing the fallback's keyword rules; "holdout" sentences were
 * written afterwards and never used to tune anything. Report holdout numbers to the judges.
 * Writes a JSON report to evals/reports/ for the pitch.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { BrainContext, Diagnosis, DiagnosisStatus } from '../src/contracts';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { diagnoseSystem } from '../src/brain/prompts';
import { compare, conditionsFor } from '../src/brain/world';
import { PACK_LIST } from '../src/packs';
import type { ConceptPack } from '../src/packs/types';

interface Case { text: string; status_any: DiagnosisStatus[]; sources_any: string[]; broken_link: string | null; split: 'dev' | 'holdout' }

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const modelsArg = process.argv.find((a) => a.startsWith('--models='))?.slice(9).split(',').map((m) => m.trim()).filter(Boolean) ?? [];
const oneModel = process.argv.find((a) => a.startsWith('--model='))?.slice(8);
const useAI = process.argv.includes('--ai') || modelsArg.length > 0 || !!oneModel;
const pct = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 : null);

async function run(pack: ConceptPack, text: string): Promise<{ d: Diagnosis; ms: number }> {
  const ctx: BrainContext = { pack: pack.id, phase: 'explain', previous: [], experiments: [] };
  const t0 = performance.now();
  if (!useAI) return { d: heuristicDiagnose(pack, text, ctx), ms: performance.now() - t0 };
  const { diagnoseWithLLM } = await import('../src/brain/server');
  const d = await diagnoseWithLLM(pack, text, ctx);
  return { d, ms: performance.now() - t0 };
}

function macroF1(pairs: [string, string][]): number | null {
  const labels = [...new Set(pairs.map(([e]) => e))];
  if (!labels.length) return null;
  const f1s = labels.map((l) => {
    const tp = pairs.filter(([e, p]) => e === l && p === l).length;
    const fp = pairs.filter(([e, p]) => e !== l && p === l).length;
    const fn = pairs.filter(([e, p]) => e === l && p !== l).length;
    const prec = tp + fp ? tp / (tp + fp) : 0, rec = tp + fn ? tp / (tp + fn) : 0;
    return prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  });
  return Math.round((1000 * f1s.reduce((a, b) => a + b, 0)) / labels.length) / 10;
}

async function evalPack(pack: ConceptPack) {
  const file = `evals/${pack.id}.json`;
  if (!existsSync(file)) return null;
  const cases: Case[] = JSON.parse(readFileSync(file, 'utf8'));
  // contamination check: no eval sentence may appear inside the prompt
  const prompt = diagnoseSystem(pack);
  const contaminated = cases.filter((c) => prompt.includes(c.text)).map((c) => c.text);

  const bySplit: Record<string, Record<string, number | null>> = {};
  const misses: string[] = [];
  const latencies: number[] = [];
  for (const split of ['dev', 'holdout'] as const) {
    const cs = cases.filter((c) => c.split === split);
    if (!cs.length) continue;
    let status = 0, src = 0, srcN = 0, link = 0, linkN = 0, leaks = 0, fdr = 0, fdrN = 0, fcr = 0, fcrN = 0, amb = 0, ambN = 0, expOk = 0, expN = 0;
    const pairs: [string, string][] = [];
    for (const c of cs) {
      let d: Diagnosis;
      try { const r = await run(pack, c.text); d = r.d; latencies.push(r.ms); } catch (e) { misses.push(`[${split}] ERROR «${c.text}»: ${(e as Error).message}`); continue; }
      if (c.status_any.includes(d.status)) status++; else misses.push(`[${split}] status  «${c.text}» expected ${c.status_any.join('|')}, got ${d.status}`);
      if (c.status_any.includes('correct')) { fdrN++; if (d.status !== 'correct') fdr++; } else { fcrN++; if (d.status === 'correct') { fcr++; misses.push(`[${split}] FALSE-CORRECT «${c.text}»`); } }
      if (c.status_any.every((s) => s === 'clarify' || s === 'offtopic')) { ambN++; if (d.status === 'clarify' || d.status === 'offtopic') amb++; }
      if (c.sources_any.length && (d.status === 'model' || d.status === 'correct') && c.status_any.some((s) => s === 'model' || s === 'correct')) {
        srcN++;
        const hit = !!d.model && d.model.sources.some((s) => c.sources_any.includes(s));
        if (hit) src++; else misses.push(`[${split}] source  «${c.text}» expected ${c.sources_any.join('|')}, got ${d.model?.sources.join('+') ?? 'none'}`);
        pairs.push([c.sources_any[0], hit ? c.sources_any[0] : d.model?.sources[0] ?? 'none']);
      }
      if (c.broken_link && d.status === 'model') { linkN++; if (d.broken_link === c.broken_link) link++; else misses.push(`[${split}] link    «${c.text}» expected ${c.broken_link}, got ${d.broken_link}`); }
      // does the chosen experiment break the idea the child ACTUALLY has (per the label)?
      if (d.status === 'model' && d.best_experiment && c.sources_any.length && !c.status_any.includes('correct')) {
        expN++;
        const truth = { sources: [c.sources_any[0]], path: d.model!.path, requires: d.model!.requires };
        const p = pack.presets.find((x) => x.id === d.best_experiment)!;
        if (compare(pack, truth, conditionsFor(pack, p.change)).contradicted) expOk++;
        else misses.push(`[${split}] experiment «${c.text}» ${p.id} does not break ${c.sources_any[0]}`);
      }
      if (d.status !== 'correct' && !pack.answerWords.test(c.text) && pack.answerWords.test(d.noor)) { leaks++; misses.push(`[${split}] LEAK «${c.text}» → ${d.noor}`); }
    }
    bySplit[split] = {
      cases: cs.length,
      status_accuracy: pct(status, cs.length),
      source_accuracy: pct(src, srcN),
      source_macro_f1: macroF1(pairs),
      broken_link_accuracy: pct(link, linkN),
      experiment_fits_misconception: pct(expOk, expN),
      false_diagnosis_rate: pct(fdr, fdrN),
      false_correct_rate: pct(fcr, fcrN),
      ambiguous_handled: pct(amb, ambN),
      answer_leaks: leaks,
    };
  }
  latencies.sort((a, b) => a - b);
  const q = (p: number) => (latencies.length ? Math.round(latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))]) : null);
  return { pack: pack.id, bySplit, latency_ms: { p50: q(0.5), p95: q(0.95) }, contaminated, misses };
}

async function runAll(label: string) {
  const report = { mode: useAI ? 'llm' : 'offline-fallback', model: label, at: new Date().toISOString(), packs: [] as unknown[], usage: null as unknown };
  const server = useAI ? await import('../src/brain/server') : null;
  server?.resetUsage();
  for (const pack of PACK_LIST) {
    const r = await evalPack(pack);
    if (!r) continue;
    report.packs.push(r);
    console.log(`\nسلسلة evals · ${pack.id} · ${report.mode} · ${label}`);
    console.table(r.bySplit);
    console.log(`latency p50 ${r.latency_ms.p50} ms · p95 ${r.latency_ms.p95} ms · prompt contamination: ${r.contaminated.length ? r.contaminated.join(' | ') : 'none'}`);
    if (r.misses.length) console.log('Misses:\n' + r.misses.join('\n'));
  }
  report.usage = server?.getUsage() ?? null;
  return report;
}

/** One comparison row per model, over every case of every pack. */
function summarise(report: Awaited<ReturnType<typeof runAll>>) {
  let n = 0, ok = 0, leaks = 0, falseCorrect = 0, p50 = 0, p95 = 0;
  for (const p of report.packs as { bySplit: Record<string, Record<string, number | null>>; latency_ms: { p50: number | null; p95: number | null } }[]) {
    for (const s of Object.values(p.bySplit)) {
      const cases = s.cases ?? 0;
      n += cases; ok += Math.round(((s.status_accuracy ?? 0) * cases) / 100); leaks += s.answer_leaks ?? 0;
      falseCorrect = Math.max(falseCorrect, s.false_correct_rate ?? 0);
    }
    p50 = Math.max(p50, p.latency_ms.p50 ?? 0); p95 = Math.max(p95, p.latency_ms.p95 ?? 0);
  }
  const u = report.usage as { calls: number; promptTokens: number; completionTokens: number; costUsd: number } | null;
  return {
    model: report.model, cases: n, status_accuracy_pct: pct(ok, n), worst_false_correct_pct: falseCorrect, answer_leaks: leaks,
    p50_ms: p50, p95_ms: p95,
    avg_tokens_in: u && u.calls ? Math.round(u.promptTokens / u.calls) : null,
    avg_tokens_out: u && u.calls ? Math.round(u.completionTokens / u.calls) : null,
    cost_per_1000_diagnoses_usd: u && u.calls ? Math.round((u.costUsd / u.calls) * 1000 * 100) / 100 : null,
  };
}

async function main() {
  mkdirSync('evals/reports', { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  if (modelsArg.length) {
    const rows: unknown[] = [];
    for (const m of modelsArg) {
      process.env.LLM_MODEL = m;
      try { rows.push(summarise(await runAll(m))); } catch (e) { rows.push({ model: m, error: (e as Error).message }); }
    }
    console.log('\nمقارنة الموديلات / model bake-off');
    console.table(rows);
    const out = `evals/reports/bakeoff-${day}.json`;
    writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), rows }, null, 2));
    console.log(`\nreport → ${out}`);
    return;
  }
  if (oneModel) process.env.LLM_MODEL = oneModel;
  const label = useAI ? (await import('../src/brain/server')).llmModel() : 'offline-fallback';
  const report = await runAll(label);
  const out = `evals/reports/${useAI ? 'llm-' + label.replace(/[^\w.-]+/g, '_') : 'offline-fallback'}-${day}.json`;
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`\nreport → ${out}`);
}
main();
