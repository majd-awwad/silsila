/** The session as a chain of phases, with one primary action that says what it will do. */
import { useEffect, useRef } from 'react';
import { PHASES } from '../../../contracts';
import type { Phase, RoomMeta, TeacherOp } from '../../../contracts';
import { phaseIndex } from '../../../brain/room';
import { useI18n } from '../../../i18n';
import { href } from '../../../router';
import { Icon } from '../../../ui/icons';
import { advanceFrom, needsExperiment, prevPhase } from '../logic/insight';
import type { Counts, RoomTab } from '../logic/insight';
import { PHASE_DOES, PHASE_NAME } from '../logic/labels';

export function Stepper({ phase }: { phase: Phase }) {
  const { t, n } = useI18n();
  const list = useRef<HTMLOListElement>(null);
  const at = phaseIndex(phase);
  // keep the current step in view on narrow screens, without moving the page
  useEffect(() => {
    const box = list.current;
    const now = box?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!box || !now) return;
    const a = box.getBoundingClientRect();
    const b = now.getBoundingClientRect();
    box.scrollBy({ left: b.left + b.width / 2 - (a.left + a.width / 2) });
  }, [phase]);
  return (
    <ol className="tc-steps" ref={list} tabIndex={0} aria-label={t({ ar: 'مراحل الحصة', en: 'Session phases' })}>
      {PHASES.map((p, i) => (
        <li key={p} className={`tc-step ${i < at ? 'is-done' : i === at ? 'is-now' : ''}`} aria-current={i === at ? 'step' : undefined}>
          <i aria-hidden="true">{i < at ? <Icon name="check" size={16} /> : n(i + 1)}</i>
          <span>{t(PHASE_NAME[p])}{i < at && <span className="sr-only"> ({t({ ar: 'تمّت', en: 'done' })})</span>}</span>
        </li>
      ))}
    </ol>
  );
}

export function NextAction({ meta, counts, busy, act, goTab }: {
  meta: RoomMeta; counts: Counts; busy: boolean; act: (op: TeacherOp) => Promise<boolean>; goTab: (tab: RoomTab) => void;
}) {
  const { t, n } = useI18n();
  const { target, blocked, waiting } = advanceFrom(meta.phase, !!meta.experimentId, counts);
  const previous = prevPhase(meta.phase);
  // after skipping the shared experiment, «back» returns to the approval step
  const back = previous && needsExperiment(previous) && !meta.experimentId ? 'approve' : previous;
  const go = (phase: Phase) => void act({ type: 'phase', phase });
  return (
    <div className="tc-next">
      <div className="tc-next-text" aria-live="polite">
        {target ? (
          <>
            <strong className="block">{t({ ar: 'الخطوة الجاية', en: 'Next' })}: {t(PHASE_NAME[target])}</strong>
            <p className="text-[14.5px]">{t(PHASE_DOES[target])}</p>
            {blocked && (
              <p className="text-[14.5px] font-bold text-probe-ink flex gap-2 items-center">
                <Icon name="lock" size={16} />{t({ ar: 'وافقوا على تجربة أول، وبعدها بيفتح التوقّع.', en: 'Approve an experiment first; predictions open after that.' })}
              </p>
            )}
            {waiting > 0 && !blocked && (
              <p className="text-[14px] font-bold text-idea-ink flex gap-2 items-center">
                <Icon name="clock" size={16} />{t({ ar: `${n(waiting)} لسا ما خلّصوا مهمّة هالمرحلة.`, en: `${waiting} have not finished this phase’s task.` })}
              </p>
            )}
          </>
        ) : (
          <>
            <strong className="block">{t({ ar: 'وصلتوا آخر مرحلة', en: 'This is the last phase' })}</strong>
            <p className="text-[14.5px]">{t({ ar: 'راجعوا التغيّر، اطبعوا التقرير، وبعدها سكّروا الصف.', en: 'Review what changed, print the report, then close the room.' })}</p>
          </>
        )}
      </div>
      <div className="row">
        <button type="button" className="btn btn-secondary" disabled={busy || !back} onClick={() => back && go(back)}>
          <Icon name="back" size={17} />{back ? t({ ar: `رجوع: ${t(PHASE_NAME[back])}`, en: `Back: ${t(PHASE_NAME[back])}` }) : t({ ar: 'رجوع', en: 'Back' })}
        </button>
        {blocked ? (
          <>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => go('revise')}>
              {t({ ar: 'تخطّوا التجربة للشرح الجديد', en: 'Skip the experiment to revising' })}
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => goTab('plan')}>
              <Icon name="flask" />{t({ ar: 'اختاروا التجربة', en: 'Choose the experiment' })}
            </button>
          </>
        ) : target ? (
          <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => go(target)}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="next" />}
            {t(PHASE_NAME[target])}
          </button>
        ) : (
          <a className="btn btn-primary btn-lg" href={href(`/teacher/room/${meta.code}/report`)}><Icon name="print" />{t({ ar: 'التقرير', en: 'Report' })}</a>
        )}
      </div>
    </div>
  );
}
