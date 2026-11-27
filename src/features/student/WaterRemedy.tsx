import { useI18n } from '../../i18n';
import { LockChoice } from './parts';
import { useLessonDraft, textDraft } from './draft';

export function WaterRemedy({ onDone, busy }: { onDone: (reflection: string) => void; busy: boolean }) {
  const { t, n } = useI18n();
  const [prediction, setPrediction] = useLessonDraft('vapour-prediction', '', textDraft);
  const [time, setTime] = useLessonDraft('vapour-time', 0, (v): v is number => Number.isInteger(v) && Number(v) >= 0 && Number(v) <= 3);
  const [explanation, setExplanation] = useLessonDraft('vapour-explanation', '', textDraft);
  const level = 6 - time * 2;
  const question = t({ ar: 'لو تركنا صحن مي مفتوح، شو بتتوقّع؟', en: 'What do you expect if we leave a shallow dish of water uncovered?' });
  return <div className="stack">
    <h3 className="subtitle">{t({ ar: 'وين راحت مي الصحن؟', en: 'Where did the water go?' })}</h3>
    <div className="stage p-4 stack">
      <svg viewBox="0 0 280 108" role="img" aria-label={t({ ar: 'صحن مفتوح. مستوى المي بالمحاكاة: ' + n(level), en: 'Open dish. Simulated water level: ' + n(level) })}>
        <path d="M40 53h200l-20 37H60Z" fill="none" stroke="var(--stage-ink)" strokeWidth="3" />
        {level > 0 && <path d={'M' + (60 - level * 2) + ' ' + (88 - level * 5) + 'H' + (220 + level * 2) + 'L220 88H60Z'} fill="#69cde8" />}
        {time > 0 && <path d="M112 48v-20m-5 5 5-5 5 5m28 14V18m-5 5 5-5 5 5m28 24V28m-5 5 5-5 5 5" fill="none" stroke="var(--real)" strokeWidth="2" strokeDasharray="4 3" />}
      </svg>
      <p>{t({ ar: 'محاكاة · اليوم ' + n(time), en: 'Simulation · Day ' + n(time) })}</p>
      {time > 0 && <p>{t({ ar: 'الأسهم بتُمثّل انتقال المي للهوا كغاز ما بنشوفه.', en: 'The arrows represent water moving to the air as an invisible gas.' })}</p>}
    </div>
    {!prediction ? <LockChoice draftField="vapour" label={question} options={[
      { id: 'less', label: t({ ar: 'المي بتنقص', en: 'The water level drops' }) },
      { id: 'same', label: t({ ar: 'المي بتضل قدّها', en: 'The water level stays the same' }) },
      { id: 'unsure', label: t({ ar: 'لسا مش متأكّد', en: 'I’m not sure yet' }) },
    ]} submit={t({ ar: 'ثبّت توقّعك', en: 'Lock your prediction' })} onSubmit={setPrediction} busy={busy} />
      : time < 3 ? <button className="btn btn-primary self-start" type="button" onClick={() => setTime(time + 1)}>
        {t({ ar: 'قدّم يوم بالمحاكاة', en: 'Advance one day in the simulation' })}
      </button> : <>
        <label className="field"><span>{t({ ar: 'احكي بكلامك وين راحت المي.', en: 'Explain in your own words where the water went.' })}</span>
          <textarea className="textarea" rows={2} value={explanation} maxLength={300} onChange={(e) => setExplanation(e.target.value)} /></label>
        <button className="btn btn-primary self-start" type="button" disabled={busy || !explanation.trim()} onClick={() => onDone(explanation)}>{t({ ar: 'خلّصت، اسألني', en: 'Done, ask me' })}</button>
      </>}
  </div>;
}
