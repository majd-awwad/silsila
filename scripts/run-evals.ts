/**
 * npm run eval        → the offline rules on every evals/<pack>.json (no key needed, no .env file read)
 * npm run eval:ai     → the configured model (OPENROUTER_API_KEY in the environment or .env.local)
 * npm run eval:models -- --models=google/gemini-3.8-flash,openai/gpt-5.4-mini
 *                     → the same evaluation per model plus a comparison table
 * Options: --model=slug · --pack=fractions,shadows · --split=dev|holdout · --concurrency=4 · --show-holdout
 *
 * Honesty rules built in: in AI mode a failed call is a failed case (the offline rules never stand in), every
 * rate keeps its denominator, and holdout sentences are not printed or saved (so nobody tunes on them) unless
 * --show-holdout is given. Reports go to evals/reports/v2-*.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { BrainContext, Diagnosis } from '../src/contracts';
import { heuristicDiagnose } from '../src/brain/heuristic';
import { diagnoseSystem } from '../src/brain/prompts';
import { aiConfigured, diagnoseWithLLM, getUsage, llmModel, resetUsage, TIMEOUTS } from '../src/brain/server';
import { normaliseText } from '../src/brain/text';
import { PACK_LIST } from '../src/packs';
import type { ConceptPack } from '../src/packs/types';
import { breakdown, CaseSchema, DEFINITIONS, scoreCase } from './eval-metrics';
import type { Case, Metrics, Rate, Scored } from './eval-metrics';

const NOTES = [
  'Labels are single-annotator and have not had independent human review: treat every score as provisional.',
  'This measures agreement between the diagnosis and those labels. It does not measure learning.',
  'Generated sentences and their labels were written by an AI assistant; team sentences were written by the team. Compare the two breakdowns.',
  'Offline-rule scores on the dev split are optimistic: the rules may have been written while looking at it. Quote holdout.',
];

const args = process.argv.slice(2);
const option = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const list = (v: string | undefined) => v?.split(',').map((x) => x.trim()).filter(Boolean) ?? [];

const models = list(option('models'));
const oneModel = option('model');
const useAI = args.includes('--ai') || args.includes('--bakeoff') || models.length > 0 || !!oneModel;
const onlyPacks = list(option('pack'));
const onlySplit = option('split');
const concurrency = Math.min(16, Math.max(1, Number(option('concurrency') ?? 4) || 4));
const showHoldout = args.includes('--show-holdout');

function loadEnv() {
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}

interface Dataset { pack: ConceptPack; file: string; cases: { c: Case; index: number }[]; problems: string[] }

function load(pack: ConceptPack): Dataset | null {
  const file = `evals/${pack.id}.json`;
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown[];
  const problems: string[] = [];
  const cases: Dataset['cases'] = [];
  raw.forEach((x, index) => {
    const parsed = CaseSchema.safeParse(x);
    if (!parsed.success) { problems.push(`case ${index}: invalid (${parsed.error.issues.map((i) => i.path.join('.')).join(', ')})`); return; }
    const unknown = parsed.data.ideas_any.filter((id) => !Object.hasOwn(pack.ideas, id));
    if (unknown.length) problems.push(`case ${index}: unknown idea ids ${unknown.join(', ')}`);
    cases.push({ c: parsed.data, index });
  });
  return { pack, file, cases: onlySplit ? cases.filter((x) => x.c.split === onlySplit) : cases, problems };
}

/** Does an evaluation sentence appear where it could have been learned from? Counts only. */
function contamination(d: Dataset) {
  const prompt = normaliseText(diagnoseSystem(d.pack));
  const samples = new Set(d.pack.samples.flatMap((s) => [normaliseText(s.ar), normaliseText(s.en)]));
  const dev = new Set(d.cases.filter((x) => x.c.split === 'dev').map((x) => normaliseText(x.c.text)));
  const hits = (test: (t: string) => boolean) => d.cases.filter((x) => test(normaliseText(x.c.text))).map((x) => ({ index: x.index, split: x.c.split }));
  return {
    pack: d.pack.id,
    in_prompt: hits((t) => t.length >= 8 && prompt.includes(t)),
    in_pack_samples: hits((t) => samples.has(t)),
    holdout_also_in_dev: d.cases.filter((x) => x.c.split === 'holdout' && dev.has(normaliseText(x.c.text))).map((x) => x.index),
  };
}

async function diagnose(pack: ConceptPack, c: Case): Promise<Diagnosis> {
  const ctx: BrainContext = { pack: pack.id, lang: c.lang, previous: [] };
  // AI mode calls the model directly: a failure throws and is recorded, never replaced
  return useAI ? diagnoseWithLLM(pack, c.text, ctx) : heuristicDiagnose(pack, c.text, ctx);
}

async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await work(items[i]); }
  }));
  return out;
}

async function runDataset(d: Dataset): Promise<Scored[]> {
  const rows = await pool(d.cases, useAI ? concurrency : 1, async ({ c, index }) => {
    const started = performance.now();
    try {
      const result = await diagnose(d.pack, c);
      return scoreCase(d.pack, c, index, result, null, performance.now() - started);
    } catch (e) {
      const code = e instanceof Error && /^[a-z]+(_[a-z]+)*(_\d{3})?$/.test(e.message) ? e.message : 'error';
      return scoreCase(d.pack, c, index, null, code, performance.now() - started);
    }
  });
  const refused = rows.filter((r) => /_(401|402|403)$/.test(r.error ?? ''));
  if (rows.length && refused.length === rows.length) throw new Error(`every call was refused (${refused[0].error}): check the key and the credit`);
  return rows;
}

function miss(r: Scored) {
  return {
    pack: r.pack, index: r.index, split: r.c.split, origin: r.c.origin, tags: r.c.tags,
    expected: { status_any: r.c.status_any, ideas_any: r.c.ideas_any },
    got: r.d ? { status: r.d.status, ideas: r.identified } : null,
    error: r.error,
    flags: [r.leak ? 'answer_leak' : '', r.falseMisconception ? 'false_misconception' : '', r.d?.status === 'correct' && !r.c.status_any.includes('correct') ? 'false_correct' : '',
      r.experiment?.recommended && r.experiment.evaluable && !r.experiment.fits ? `experiment_does_not_fit:${r.experiment.recommended}` : ''].filter(Boolean),
    ...(r.c.split === 'dev' || showHoldout ? { text: r.c.text } : {}),
  };
}

async function runAll(label: string, datasets: Dataset[]) {
  resetUsage();
  const rows: Scored[] = [];
  for (const d of datasets) {
    rows.push(...(await runDataset(d)));
    if (useAI) console.log(`  ${label} · ${d.pack.id}: ${d.cases.length} cases done`);
  }
  const usage = useAI ? getUsage() : null;
  const costed = usage?.costedCalls ?? 0;
  return {
    schema: 'silsila-eval-v2',
    mode: useAI ? ('llm' as const) : ('offline-fallback' as const),
    model: label,
    at: new Date().toISOString(),
    filters: { packs: onlyPacks.length ? onlyPacks : 'all', split: onlySplit ?? 'all' },
    settings: useAI ? { concurrency, timeout_ms: TIMEOUTS.diagnose, retries: 'none (request-setting variants only)' } : {},
    notes: NOTES,
    definitions: DEFINITIONS,
    datasets: datasets.map((d) => ({ pack: d.pack.id, file: d.file, cases: d.cases.length, problems: d.problems })),
    contamination: datasets.map(contamination),
    overall: breakdown(rows),
    packs: Object.fromEntries(datasets.map((d) => [d.pack.id, breakdown(rows.filter((r) => r.pack === d.pack.id))])),
    usage: usage ? {
      ...usage,
      total_cost_usd: costed ? Math.round(usage.costUsd * 1e6) / 1e6 : null,
      cost_per_1000_diagnoses_usd: costed ? Math.round((usage.costUsd / costed) * 1000 * 100) / 100 : null,
    } : null,
    errors: rows.reduce<Record<string, number>>((m, r) => { if (r.error) m[r.error] = (m[r.error] ?? 0) + 1; return m; }, {}),
    misses: rows.filter((r) => !r.endToEnd || r.leak).map(miss),
  };
}
type Report = Awaited<ReturnType<typeof runAll>>;

const show = (r: Rate) => (r.of ? `${r.pct}% (${r.n}/${r.of})` : 'n/a (0)');

function line(m: Metrics) {
  return {
    cases: m.total, answered: m.answered, failed: m.failed,
    'end-to-end': show(m.end_to_end), status: show(m.status_accuracy), 'macro-F1': m.macro_f1.pct === null ? 'n/a' : `${m.macro_f1.pct}%`,
    'false-correct': show(m.false_correct), 'false-misconception': show(m.false_misconception), leaks: show(m.answer_leakage),
  };
}

function print(report: Report) {
  console.log(`\nSILSILA evaluation · mode: ${report.mode} · ${report.model}`);
  const table: Record<string, ReturnType<typeof line>> = {};
  for (const [id, b] of Object.entries(report.packs)) for (const split of ['dev', 'holdout'] as const) if (b[split].total) table[`${id} · ${split}`] = line(b[split]);
  const o = report.overall;
  for (const split of ['dev', 'holdout', 'all'] as const) if (o[split].total) table[`OVERALL · ${split}`] = line(o[split]);
  for (const origin of ['team', 'generated'] as const) for (const split of ['dev', 'holdout'] as const) {
    const m = o.by_origin[origin][split];
    if (m.total) table[`${origin}-written · ${split}`] = line(m);
  }
  console.table(table);

  const detail: Record<string, Record<string, string>> = {};
  for (const split of ['dev', 'holdout', 'all'] as const) {
    const m = o[split];
    if (!m.total) continue;
    detail[split] = {
      'ideas partial': show(m.ideas_partial), 'ideas exact': show(m.ideas_exact), 'none expected → none': show(m.ideas_none_when_none_expected),
      'clarify recall': show(m.clarification.recall), 'clarify precision': show(m.clarification.precision),
      'steps exact': show(m.steps_exact),
      'experiment coverage': show(m.experiment_fit.coverage), 'experiment fits': show(m.experiment_fit.fits),
      'negation e2e': m.tags.negation ? show(m.tags.negation.end_to_end) : 'n/a',
      'injection e2e': m.tags.injection ? show(m.tags.injection.end_to_end) : 'n/a',
      'injection false-correct': m.tags.injection ? show(m.tags.injection.false_correct) : 'n/a',
    };
  }
  console.table(detail);
  console.log(`latency p50 ${o.all.latency_ms.p50} ms · p95 ${o.all.latency_ms.p95} ms (${o.all.latency_ms.n} attempts) · failures ${show(o.all.ai_failure)}`);
  if (report.usage) console.log(`cost: ${report.usage.total_cost_usd ?? 'not reported'} USD total · ${report.usage.cost_per_1000_diagnoses_usd ?? 'n/a'} USD per 1000 diagnoses`);
  if (Object.keys(report.errors).length) console.log('errors:', JSON.stringify(report.errors));
  for (const d of report.datasets) if (d.problems.length) console.log(`dataset ${d.pack}: ${d.problems.length} problems, first: ${d.problems[0]}`);
  for (const c of report.contamination) {
    const n = c.in_prompt.length + c.in_pack_samples.length + c.holdout_also_in_dev.length;
    if (n) console.log(`contamination ${c.pack}: ${c.in_prompt.length} in the prompt, ${c.in_pack_samples.length} equal to pack samples (${c.in_pack_samples.filter((x) => x.split === 'holdout').length} holdout), ${c.holdout_also_in_dev.length} holdout also in dev`);
  }
  for (const note of report.notes) console.log(`note: ${note}`);
}

const day = new Date().toISOString().slice(0, 10);
const slug = (s: string) => s.replace(/[^\w.-]+/g, '_');
const suffix = `${onlyPacks.length ? `-${slug(onlyPacks.join('+'))}` : ''}${onlySplit ? `-${onlySplit}` : ''}`;

function save(name: string, data: unknown) {
  const out = `evals/reports/v2-${name}${suffix}-${day}.json`;
  writeFileSync(out, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`\nreport → ${out}`);
}

async function main() {
  if (onlySplit && onlySplit !== 'dev' && onlySplit !== 'holdout') throw new Error('--split must be dev or holdout');
  if (args.includes('--bakeoff') && !models.length) throw new Error('name the models: npm run eval:models -- --models=a,b,c');
  if (useAI) {
    loadEnv();
    if (!aiConfigured()) throw new Error('no API key (OPENROUTER_API_KEY or LLM_API_KEY). Nothing was run; see docs/API-SETUP.md');
  }
  const unknown = onlyPacks.filter((id) => !PACK_LIST.some((p) => p.id === id));
  if (unknown.length) throw new Error(`unknown pack: ${unknown.join(', ')}`);
  const datasets = PACK_LIST.filter((p) => !onlyPacks.length || onlyPacks.includes(p.id)).map(load).filter((d): d is Dataset => !!d);
  const missing = PACK_LIST.filter((p) => !existsSync(`evals/${p.id}.json`)).map((p) => p.id);
  if (missing.length) console.log(`no dataset yet for: ${missing.join(', ')}`);
  if (!datasets.length) throw new Error('no datasets found in evals/');
  mkdirSync('evals/reports', { recursive: true });

  if (models.length) {
    const rows: Record<string, unknown>[] = [];
    for (const model of models) {
      process.env.LLM_MODEL = model;
      try {
        const report = await runAll(model, datasets);
        print(report);
        save(`llm-${slug(model)}`, report);
        const { all, holdout } = report.overall;
        rows.push({
          model, cases: all.total, failures: show(all.ai_failure), 'end-to-end (all)': show(all.end_to_end), 'end-to-end (holdout)': show(holdout.end_to_end),
          'status (holdout)': show(holdout.status_accuracy), 'macro-F1 (holdout)': holdout.macro_f1.pct, 'false-correct (all)': show(all.false_correct),
          'false-misconception (all)': show(all.false_misconception), leaks: show(all.answer_leakage), p50_ms: all.latency_ms.p50, p95_ms: all.latency_ms.p95,
          usd_per_1000: report.usage?.cost_per_1000_diagnoses_usd ?? null,
        });
      } catch (e) {
        rows.push({ model, error: (e as Error).message });
      }
    }
    console.log('\nmodel comparison');
    console.table(rows);
    save('bakeoff', { schema: 'silsila-eval-v2', mode: 'llm', at: new Date().toISOString(), notes: NOTES, definitions: DEFINITIONS, rows });
    return;
  }
  if (oneModel) process.env.LLM_MODEL = oneModel;
  const label = useAI ? llmModel() : 'offline-fallback';
  const report = await runAll(label, datasets);
  print(report);
  save(useAI ? `llm-${slug(label)}` : 'offline-fallback', report);
  if (!useAI && !onlyPacks.length && !onlySplit) {
    const summary = (m: Report['overall']['holdout']) => ({ endToEnd: m.end_to_end, answerLeakage: m.answer_leakage });
    writeFileSync('evals/reports/latest-offline-summary.json', JSON.stringify({
      holdout: summary(report.overall.holdout),
      packs: Object.fromEntries(Object.entries(report.packs).map(([id, pack]) => [id, summary(pack.holdout)])),
    }, null, 2) + '\n');
  }
}

main().catch((e) => {
  console.error(`eval failed: ${(e as Error).message}`);
  process.exitCode = 1;
});
