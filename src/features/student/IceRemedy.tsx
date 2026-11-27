import { useI18n } from '../../i18n';
import { LockChoice } from './parts';
import { useLessonDraft, textDraft } from './draft';

/** «Water changes form»: a small simulation of an ice cube warming, so the remedy never depends on real ice in the room. */
export function IceRemedy({ onDone, busy }: { onDone: (reflection: string) => void; busy: boolean }) {
  const { t, n } = useI18n();
  const [prediction, setPrediction] = useLessonDraft('ice-prediction', '', textDraft);
  const [time, setTime] = useLessonDraft('ice-time', 0, (v): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 3);
  const [explanation, setExplanation] = useLessonDraft('ice-explanation', '', textDraft);
  const cube = 44 - time * 14;
  const puddle = time * 34;
  const stateName = time === 0 ? t({ ar: 'صلب', en: 'solid' }) : time < 3 ? t({ ar: 'عم يذوب', en: 'melting' }) : t({ ar: 'صار سايل', en: 'liquid now' });
  const question = t({ ar: 'مكعّب تلج على صحن بمكان دافي. شو بتتوقّع؟', en: 'An ice cube sits on a plate in a warm place. What do you expect?' });
  return <div className="stack">
    <h3 className="subtitle">{t({ ar: 'شو بيصير للتلج؟', en: 'What happens to the ice?' })}</h3>
    <div className="stage p-4 stack">
      <svg viewBox="0 0 280 120" role="img" aria-label={t({ ar: 'مكعّب تلج على صحن. الحالة: ', en: 'An ice cube on a plate. State: ' }) + stateName}>
        <path d="M30 96h220" stroke="var(--stage-ink)" strokeWidth="3" strokeLinecap="round" />
        {puddle > 0 && <ellipse cx="140" cy="94" rx={20 + puddle} ry={4 + time * 2} fill="#69cde8" opacity=".85" />}
        {cube > 4 && <rect x={140 - cube / 2} y={92 - cube} width={cube} height={cube} rx="6" fill="#d9f2fb" stroke="#9fdcf1" strokeWidth="3" />}
      </svg>
      <p>{t({ ar: 'محاكاة · دقيقة ', en: 'Simulation · minute ' })}{n(time * 10)} · {stateName}</p>
    </div>
    {!prediction ? <LockChoice draftField="ice" label={question} options={[
      { id: 'stays', label: t({ ar: 'بيضل تلج', en: 'It stays ice' }) },
      { id: 'melts', label: t({ ar: 'بيذوب وبيصير مي سايلة', en: 'It melts into liquid water' }) },
      { id: 'unsure', label: t({ ar: 'لسا مش متأكّد', en: 'I’m not sure yet' }) },
    ]} submit={t({ ar: 'ثبّت توقّعك', en: 'Lock your prediction' })} onSubmit={setPrediction} busy={busy} />
      : time < 3 ? <button className="btn btn-primary self-start" type="button" onClick={() => setTime(time + 1)}>
        {t({ ar: 'مرّر الوقت بالمحاكاة', en: 'Move time forward in the simulation' })}
      </button> : <>
        <label className="field"><span>{t({ ar: 'احكي بكلامك: التلج والمي اللي طلعت منه، هنّي نفس الإشي؟ ليش؟', en: 'Say in your own words: are the ice and the water that came from it the same thing? Why?' })}</span>
          <textarea className="textarea" rows={2} value={explanation} maxLength={300} onChange={(e) => setExplanation(e.target.value)} /></label>
        <button className="btn btn-primary self-start" type="button" disabled={busy || !explanation.trim()} onClick={() => onDone(explanation)}>{t({ ar: 'خلّصت، اسألني', en: 'Done, ask me' })}</button>
      </>}
  </div>;
}
