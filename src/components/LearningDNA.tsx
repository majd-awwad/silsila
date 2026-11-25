/**
 * Learning DNA: the five links of understanding at the child's first explanation and at their last,
 * plus how they explained a new phenomenon on their own. Shows change, not just a score.
 */
import type { ChainId, LinkState, Session } from '../contracts';
import { CHAIN_IDS } from '../contracts';
import type { ConceptPack } from '../packs/types';

type Cell = 'ok' | 'bad' | 'unknown';
const cell = (v: LinkState | undefined): Cell => (v === 'ok' ? 'ok' : v === 'wrong' || v === 'missing' ? 'bad' : 'unknown');

export function dnaOf(s: Session): { first: Record<ChainId, Cell>; last: Record<ChainId, Cell> } | null {
  const ex = s.explanations.filter((e) => e.diagnosis.model);
  if (!ex.length) return null;
  const a = ex[0].diagnosis, b = ex[ex.length - 1].diagnosis;
  const first = {} as Record<ChainId, Cell>, last = {} as Record<ChainId, Cell>;
  for (const c of CHAIN_IDS) {
    first[c] = cell(a.chain[c]);
    // a correct final explanation fills C1–C4; C5 (transfer) comes from the transfer task
    last[c] = b.status === 'correct' && c !== 'C5' ? 'ok' : cell(b.chain[c]);
  }
  if (s.transfer) last.C5 = s.transfer.score >= 2 ? 'ok' : 'bad';
  return { first, last };
}

export function LearningDNA({ pack, session }: { pack: ConceptPack; session: Session }) {
  const d = dnaOf(session);
  if (!d) return null;
  const word = { ok: 'فاهم', bad: 'ناقص', unknown: 'مش واضح' };
  return (
    <div className="dna" role="table" aria-label="خريطة الفهم قبل وبعد">
      <span />
      <span className="h">أول شرح</span>
      <span className="h">آخر الدرس</span>
      {CHAIN_IDS.map((c) => (
        <div key={c} role="row" style={{ display: 'contents' }}>
          <span role="rowheader">{pack.chain[c].label}</span>
          <span role="cell" className={`cell ${d.first[c]}`} title={word[d.first[c]]} aria-label={word[d.first[c]]} />
          <span role="cell" className={`cell ${d.last[c]}`} title={word[d.last[c]]} aria-label={word[d.last[c]]} />
        </div>
      ))}
      <div className="col-span-3 flex gap-3 mt-1 text-[11px] text-ink-2" aria-hidden="true">
        <span className="flex items-center gap-1"><i className="cell ok inline-block w-3 h-3" />{word.ok}</span>
        <span className="flex items-center gap-1"><i className="cell bad inline-block w-3 h-3" />{word.bad}</span>
        <span className="flex items-center gap-1"><i className="cell inline-block w-3 h-3" />{word.unknown}</span>
      </div>
    </div>
  );
}
