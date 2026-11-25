/** Mental Model Engine, made visible: the child's own causal chain next to the scientific one. */
import type { Diagnosis } from '../contracts';
import type { ConceptPack } from '../packs/types';

export function ChainView({ pack, diag }: { pack: ConceptPack; diag: Diagnosis }) {
  if (!diag.child_chain.length) return null;
  return (
    <div className="chainview">
      <div className="kid">
        <h4>سلسلة تفكير الطفل</h4>
        <ol>
          {diag.child_chain.map((step, i) => (
            <li key={i} className={i === diag.wrong_step ? 'wrong' : ''}>{step}{i === diag.wrong_step ? ' ✕' : ''}</li>
          ))}
        </ol>
      </div>
      <div className="sci">
        <h4>سلسلة الفهم العلمية</h4>
        <ol>{pack.scienceChain.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </div>
    </div>
  );
}
