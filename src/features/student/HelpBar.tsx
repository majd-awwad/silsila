/** The scaffolding ladder: reflection → attention → clue → guided instruction → ask the teacher. */
import { useContext, useState } from 'react';
import type { L } from '../../contracts';
import { TEACHER_LEVEL, nextHelp, offerHelp, openHelp } from '../../flow/derive';
import { useI18n } from '../../i18n';
import { Icon } from '../../ui/icons';
import { VoiceContext } from './parts';
import type { LessonProps } from './context';

const RUNG: L[] = [
  { ar: 'سؤال للتفكير', en: 'Something to think about' },
  { ar: 'انتبه لهاد', en: 'Look at this' },
  { ar: 'تلميح', en: 'A clue' },
  { ar: 'خلّينا نشرحها سوا', en: 'Let us work it out together' },
  { ar: 'اسأل المعلّم', en: 'Ask your teacher' },
];
const TEACHER: L = {
  ar: 'عادي تحتاج مساعدة. ارفع إيدك واسأل معلّمك أو معلّمتك، أو حدا كبير معك. وبتقدر تكمّل وقت ما بدك.',
  en: 'It is fine to need help. Raise your hand and ask your teacher, or a grown-up with you. You can carry on whenever you like.',
};

export function HintCard({ pack, level }: { pack: LessonProps['pack']; level: number }) {
  const { t } = useI18n();
  const voice = useContext(VoiceContext);
  const text = level >= TEACHER_LEVEL ? t(TEACHER) : t(pack.hints[level - 1]);
  return (
    <div className="sl-hint rise">
      <div className="row !justify-between">
        <strong>{t(RUNG[level - 1])}</strong>
        {voice?.available && (
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => voice.sayNow(text)} aria-label={t({ ar: 'اسمع التلميح', en: 'Hear the hint' })}>
            <Icon name="sound" size={18} />
          </button>
        )}
      </div>
      <p aria-live="polite">{text}</p>
    </div>
  );
}

export function HelpBar({ pack, journey, dispatch, busy }: LessonProps) {
  const { t } = useI18n();
  const [asked, setAsked] = useState(false);
  const { record, step } = journey;
  const open = openHelp(record);
  const next = nextHelp(record);
  const offer = offerHelp(pack, record, step);
  const ask = () => {
    // guided instruction waits until the learner has seen something for themselves
    if (next.locked) setAsked(true);
    else dispatch({ type: 'help', at: Date.now() });
  };
  return (
    <div className="sl-help">
      {open !== null && <HintCard pack={pack} level={open} />}
      {offer && <p className="help" role="status">{t({ ar: 'بدك تلميح صغير؟', en: 'Would a small hint help?' })}</p>}
      {asked && next.locked && (
        <div className="sl-hint" role="status">
          <p>{t({ ar: 'جرّب تجربة أول، وبعدها بقدر أساعدك أكتر.', en: 'Try an experiment first, then I can help you more.' })}</p>
          <div className="sl-actions">
            <button type="button" className="btn btn-warm" disabled={busy} onClick={() => dispatch({ type: 'toTest' })}><Icon name="flask" />{t({ ar: 'يلا نجرّب', en: 'Let us test' })}</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setAsked(false); dispatch({ type: 'askTeacher', at: Date.now() }); }}>{t({ ar: 'بدي أسأل المعلّم', en: 'Ask the teacher' })}</button>
          </div>
        </div>
      )}
      {open !== TEACHER_LEVEL && (
        <button type="button" className={`btn self-start sl-touch ${offer ? 'btn-warm' : 'btn-ghost'}`} disabled={busy} onClick={ask}>
          <Icon name="question" />{open === null ? t({ ar: 'ساعدني', en: 'Help me' }) : t({ ar: 'ساعدني أكتر', en: 'More help' })}
        </button>
      )}
    </div>
  );
}
