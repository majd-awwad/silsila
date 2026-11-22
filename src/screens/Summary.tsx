import type { Session } from '../contracts';
import { NoorAvatar } from '../components/NoorAvatar';
import { EXPERIMENTS } from '../lesson/condensation';

const fmt = (n: number) => n.toLocaleString('ar-EG');

/** The child's own journey, in their words: first idea → experiments → final idea → teaching Noor. */
export function Summary({ session, onRestart }: { session: Session; onRestart: () => void }) {
  const ideas = session.explanations.filter((e) => e.diagnosis.caption);
  const first = ideas[0]?.diagnosis.caption.replace('هيك إنت شايفها: ', '');
  const last = ideas[ideas.length - 1]?.diagnosis.caption.replace('هيك إنت شايفها: ', '');
  const broke = session.experiments.filter((e) => e.contradicted);
  return (
    <main className="stage-bg min-h-full grid place-items-center p-6">
      <div className="glass w-full max-w-[680px] p-8 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <NoorAvatar size={64} />
          <div>
            <h1 className="font-display text-2xl font-semibold m-0">شكراً يا أستاذ {session.pseudonym}!</h1>
            <p className="text-ink-2 m-0">هاي سلسلتك اليوم.</p>
          </div>
        </div>
        <ol className="m-0 ps-5 flex flex-col gap-4 leading-7">
          {first && <li><b>فكرتك الأولى:</b> {first}</li>}
          {broke.length > 0 && (
            <li><b>التجارب اللي كسرتها:</b> {broke.map((b) => EXPERIMENTS[b.exp].name).join('، ')}</li>
          )}
          {last && last !== first && <li><b>فكرتك هلأ:</b> {last}</li>}
          {session.teach?.caught && <li><b>علّمت نور:</b> «{session.teach.quote}»</li>}
        </ol>
        {session.pre && session.post && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--line)] p-4 text-center">
              <div className="text-ink-2 text-sm">قبل الدرس</div>
              <div className="font-display text-3xl font-bold">{fmt(session.pre.score)} / {fmt(session.pre.total)}</div>
            </div>
            <div className="rounded-2xl border border-good/50 bg-good/10 p-4 text-center">
              <div className="text-ink-2 text-sm">بعد الدرس</div>
              <div className="font-display text-3xl font-bold text-good">{fmt(session.post.score)} / {fmt(session.post.total)}</div>
            </div>
          </div>
        )}
        <p className="text-ink-2 m-0 text-sm">جرّب بالبيت مع حدا كبير: {EXPERIMENTS[broke[0]?.exp ?? 'E_color'].home}</p>
        <button type="button" className="btn-primary" onClick={onRestart}>طفل جديد</button>
      </div>
    </main>
  );
}
