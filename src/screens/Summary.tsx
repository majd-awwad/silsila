import type { Session } from '../contracts';
import { LearningDNA } from '../components/LearningDNA';
import { NoorAvatar } from '../components/NoorAvatar';
import { ThinkingReplay } from '../components/ThinkingReplay';
import { getPack } from '../packs';

const fmt = (n: number) => n.toLocaleString('ar-EG');

/** The child's own journey, in their words, plus their Learning DNA (before → after). */
export function Summary({ session, onRestart }: { session: Session; onRestart: () => void }) {
  const pack = getPack(session.pack);
  const ideas = session.explanations.filter((e) => e.diagnosis.caption);
  const first = ideas[0]?.diagnosis.caption.replace('هيك إنت شايفها: ', '');
  const last = ideas[ideas.length - 1]?.diagnosis.caption.replace('هيك إنت شايفها: ', '');
  const broke = session.experiments.filter((e) => e.contradicted);
  const brokePreset = pack.presets.find((p) => p.id === broke[0]?.preset) ?? pack.presets[0];
  return (
    <main className="stage-bg min-h-full grid place-items-center p-6">
      <div className="glass w-full max-w-[720px] p-8 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <NoorAvatar size={64} />
          <div>
            <h1 className="font-display text-2xl font-semibold m-0">شكراً يا أستاذ {session.pseudonym}!</h1>
            <p className="text-ink-2 m-0">هاي سلسلتك اليوم: {pack.question}</p>
          </div>
        </div>
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-6">
          <ol className="m-0 ps-5 flex flex-col gap-3 leading-7">
            {first && <li><b>فكرتك الأولى:</b> {first}</li>}
            {broke.length > 0 && <li><b>تجارب كسرت فكرتك:</b> {fmt(broke.length)}</li>}
            {last && last !== first && <li><b>فكرتك هلأ:</b> {last}</li>}
            {session.teach?.caught && <li><b>علّمت نور:</b> «{session.teach.quote}»</li>}
            {session.challenge && <li><b>نور فسّرت ظاهرة جديدة من شرحك:</b> {session.challenge.resolved ? 'وشرحك كان كامل' : 'وكمّلتلها الناقص'}</li>}
            {session.transfer && <li><b>فسّرت لحالك ظاهرة جديدة:</b> {fmt(session.transfer.score)} من {fmt(3)} خطوات</li>}
          </ol>
          <section aria-label="خريطة فهمك">
            <h2 className="font-display text-base m-0 mb-2">خريطة فهمك (Learning DNA)</h2>
            <LearningDNA pack={pack} session={session} />
          </section>
        </div>
        <ThinkingReplay pack={pack} session={session} />
        {session.pre && session.post && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--line)] p-4 text-center">
              <div className="text-ink-2 text-sm">قبل الدرس</div>
              <div className="font-display text-3xl font-bold">{fmt(session.pre.score)} / {fmt(session.pre.total)}</div>
            </div>
            <div className="rounded-2xl border border-good/50 bg-good/10 p-4 text-center">
              <div className="text-ink-2 text-sm">بعد الدرس (مواقف جديدة)</div>
              <div className="font-display text-3xl font-bold text-good">{fmt(session.post.score)} / {fmt(session.post.total)}</div>
            </div>
          </div>
        )}
        <p className="text-ink-2 m-0 text-sm">جرّب بالبيت مع حدا كبير: {brokePreset.home}</p>
        <button type="button" className="btn-primary" onClick={onRestart}>طفل جديد</button>
      </div>
    </main>
  );
}
