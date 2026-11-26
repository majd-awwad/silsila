/** Mental Model Engine, made visible: the child's own causal chain next to the scientific one. */
import type { Diagnosis } from '../contracts';
import type { ConceptPack } from '../packs/types';

export function ChainView({ pack, diag, showScience = true, markWrong = true }: {
  pack: ConceptPack; diag: Diagnosis; showScience?: boolean; markWrong?: boolean;
}) {
  if (!diag.child_chain.length) return null;
  return (
    <div className="chainview">
      <div className="kid">
        <h4>{showScience ? 'سلسلة تفكير الطفل' : 'سلسلة فكرتك'}</h4>
        <ol>
          {diag.child_chain.map((step, i) => {
            const wrong = markWrong && i === diag.wrong_step;
            return <li key={i} className={wrong ? 'wrong' : ''}>{step}{wrong ? ' ✕' : ''}</li>;
          })}
        </ol>
      </div>
      {showScience && (
        <div className="sci">
          <h4>سلسلة الفهم العلمية</h4>
          <ol>{pack.scienceChain.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}
    </div>
  );
}
