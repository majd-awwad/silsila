/**
 * npm run eval      → scores the offline fallback on evals/utterances.json (no key needed)
 * npm run eval:ai   → scores Claude (needs ANTHROPIC_API_KEY in the environment or .env.local)
 * Prints: status accuracy, source accuracy, broken-link accuracy, and answer leaks. Lists every miss.
 */
import { readFileSync, existsSync } from 'node:fs';
import type { BrainContext, Diagnosis } from '../src/contracts';
import { heuristicDiagnose } from '../src/brain/heuristic';

interface Case { text: string; status: Diagnosis['status']; sources_any: string[]; broken_link: string | null }

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const useAI = process.argv.includes('--ai');
const cases: Case[] = JSON.parse(readFileSync('evals/utterances.json', 'utf8'));
const ctx: BrainContext = { phase: 'explain', previous: [], experiments: [] };
const LEAK = /بخار|تكاثف|يتكاثف|بتتكاثف/;

async function run(c: Case): Promise<Diagnosis> {
  if (!useAI) return heuristicDiagnose(c.text, ctx);
  const { diagnoseWithClaude } = await import('../src/brain/server');
  return diagnoseWithClaude(c.text, ctx);
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');

async function main() {
  let statusOk = 0, srcOk = 0, srcN = 0, linkOk = 0, linkN = 0, leaks = 0;
  const misses: string[] = [];
  for (const c of cases) {
    let d: Diagnosis;
    try { d = await run(c); } catch (e) { misses.push(`ERROR «${c.text}»: ${(e as Error).message}`); continue; }
    const sOk = d.status === c.status || (c.status === 'offtopic' && d.status === 'clarify');
    if (sOk) statusOk++; else misses.push(`status  «${c.text}» expected ${c.status}, got ${d.status}`);
    if (c.sources_any.length) {
      srcN++;
      const hit = !!d.model && d.model.sources.some((s) => c.sources_any.includes(s));
      if (hit) srcOk++; else misses.push(`source  «${c.text}» expected ${c.sources_any.join('|')}, got ${d.model?.sources.join('+') ?? 'none'}`);
    }
    if (c.broken_link && c.status === 'model') {
      linkN++;
      if (d.broken_link === c.broken_link) linkOk++; else misses.push(`link    «${c.text}» expected ${c.broken_link}, got ${d.broken_link}`);
    }
    if (d.status !== 'correct' && !LEAK.test(c.text) && LEAK.test(d.noor)) { leaks++; misses.push(`LEAK    «${c.text}» → ${d.noor}`); }
  }
  console.log(`\nسلسلة evals · ${useAI ? 'Claude' : 'offline fallback'} · ${cases.length} cases`);
  console.table({
    status: { correct: statusOk, of: cases.length, rate: pct(statusOk, cases.length) },
    source: { correct: srcOk, of: srcN, rate: pct(srcOk, srcN) },
    broken_link: { correct: linkOk, of: linkN, rate: pct(linkOk, linkN) },
    answer_leaks: { correct: leaks, of: cases.length, rate: leaks ? 'FAIL' : 'none' },
  });
  if (misses.length) console.log('\nMisses:\n' + misses.join('\n'));
}
main();
