/** Saying an idea, being asked for what is unclear, seeing what Noor understood, and checking a foundation. */
import { conditionsFor } from '../../../brain/world';
import { eventsOf, lastEvent } from '../../../brain/records';
import {
  SKIP_AFTER_UNCLEAR, TEACHER_LEVEL, currentDiagnosis, observations, openHelp, unclearInARow,
} from '../../../flow/derive';
import { gapTask } from '../../../flow/gaps';
import { useI18n } from '../../../i18n';
import { ReasonChain } from '../../../ui/Evidence';
import { ExperimentStage } from '../../../ui/ExperimentStage';
import { Icon } from '../../../ui/icons';
import type { LessonProps } from '../context';
import { PhenomenonPreview } from '../../../ui/PhenomenonPreview';
import { IceRemedy } from '../IceRemedy';
import { WaterRemedy } from '../WaterRemedy';
import { HelpBar, HintCard } from '../HelpBar';
import { GapCard, NoorSays, SourceNote, SpeakBox, Split, Title } from '../parts';

const thinking = { ar: 'نور عم تفكّر بكلامك…', en: 'Noor is thinking about your words…' };

/** judge mode offers the pack's sample sentences */
const samplesFor = ({ pack, judge }: LessonProps, lang: 'ar' | 'en') => (judge ? pack.samples.map((s) => s[lang]) : []);

/** The stage with the learner's own latest observation, or the untouched setup. */
function CurrentStage({ pack, journey }: LessonProps) {
  const { t } = useI18n();
  const seen = observations(journey.record).at(-1);
  const model = currentDiagnosis(journey.record)?.model ?? null;
  if (!seen) return <PhenomenonPreview pack={pack} />;
  return (
    <>
      {seen && <p className="help">{t({ ar: 'آخر تجربة عملتها:', en: 'Your last experiment:' })}</p>}
      <ExperimentStage pack={pack} cond={seen?.cond ?? conditionsFor(pack)} model={seen ? model : null} revealed={!!seen}
        ideaLabel={t({ ar: 'عالم فكرتك', en: 'Your idea’s world' })} />
    </>
  );
}

export function Explain(props: LessonProps) {
  const { pack, busy, explain } = props;
  const { t, lang } = useI18n();
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'فكرتك', en: 'Your idea' })}>{t(pack.question)}</Title>
        <NoorSays mood={busy ? 'thinking' : 'listening'}
          text={busy ? t(thinking) : t({ ar: 'احكيلي بكلامك: ليش برأيك؟ ما في جواب غلط هلأ، بدي أفهم كيف بتفكّر.', en: 'Tell me in your own words: why do you think so? There is no wrong answer now, I want to understand how you think.' })} />
        <SpeakBox label={t({ ar: 'فكرتي', en: 'My idea' })} placeholder={t({ ar: 'أنا بفكّر إنه…', en: 'I think that…' })}
          busy={busy} onSubmit={explain} samples={samplesFor(props, lang)} />
        <HelpBar {...props} />
      </>}
      show={<CurrentStage {...props} />}
    />
  );
}

export function Clarify(props: LessonProps) {
  const { journey, busy, explain, dispatch } = props;
  const { t, lang } = useI18n();
  const last = lastEvent(journey.record, 'explain')!;
  const d = last.diagnosis;
  const partial = d.status === 'partial';
  const tested = observations(journey.record).length > 0;
  const manyTries = unclearInARow(journey.record) >= SKIP_AFTER_UNCLEAR;
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'سؤال من نور', en: 'A question from Noor' })}>
          {partial ? t({ ar: 'ضايلة حلقة', en: 'One link is missing' }) : t({ ar: 'ساعدني أفهم أكتر', en: 'Help me understand more' })}
        </Title>
        <p className="sl-quote">«{last.text}»</p>
        {partial && d.caption && <div className="sl-idea-card"><span className="help">{t({ ar: 'هيك فهمت لهلأ', en: 'What I understand so far' })}</span><p>{d.caption}</p></div>}
        <NoorSays mood={busy ? 'thinking' : 'curious'} text={busy ? t(thinking) : d.noor} />
        <SourceNote source={d.source} reason={d.fallbackReason} />
        <SpeakBox key={eventsOf(journey.record, 'explain').length} label={t({ ar: 'جوابي', en: 'My answer' })} busy={busy} onSubmit={explain} samples={samplesFor(props, lang)} />
        <div className="sl-actions">
          {partial && (
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dispatch({ type: 'continue', at: Date.now() })}>
              {t({ ar: 'هاي فكرتي، كمّل', en: 'That is my idea, carry on' })}<Icon name="next" />
            </button>
          )}
          {!partial && (
            <button type="button" className={`btn ${manyTries ? 'btn-warm' : 'btn-ghost'}`} disabled={busy} onClick={() => dispatch({ type: 'toTest' })}>
              <Icon name="flask" />{tested ? t({ ar: 'ارجع للتجارب', en: 'Back to experiments' }) : t({ ar: 'خلّينا نجرّب تجربة أول', en: 'Let us try an experiment first' })}
            </button>
          )}
          {tested && (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => dispatch({ type: 'toTeach' })}>
              <Icon name="cap" />{t({ ar: 'علّم نور', en: 'Teach Noor' })}
            </button>
          )}
        </div>
        <HelpBar {...props} />
      </>}
      show={<CurrentStage {...props} />}
    />
  );
}

export function Understood({ pack, journey, dispatch }: LessonProps) {
  const { t } = useI18n();
  const last = lastEvent(journey.record, 'explain')!;
  const d = last.diagnosis;
  const revised = last.phase === 'revise';
  const testBeforeIntervention = !journey.quick && !!pack.preTest.length && !journey.record.events.some((e) => e.type === 'quiz' && e.kind === 'pre');
  const toTeach = !testBeforeIntervention && (d.status === 'correct' || (observations(journey.record).length > 0 && d.status === 'partial'));
  // a partial explanation was already asked for its missing link: now invite the test
  const line = d.status === 'partial' ? t(pack.noor.invite) : d.noor;
  return (
    <Split
      task={<>
        <Title eyebrow={revised ? t({ ar: 'فكرتك الجديدة', en: 'Your new idea' }) : t({ ar: 'فكرتك', en: 'Your idea' })}>
          {t({ ar: 'هيك فهمت عليك', en: 'This is what I understood' })}
        </Title>
        <NoorSays mood="discovering" text={toTeach ? d.noor : line} />
        <section className="card stack rise">
          {d.caption && <div className="sl-idea-card">{d.caption}</div>}
          {d.chain.length > 0 && (
            <>
              <h2 className="label">{t({ ar: 'سلسلة تفكيرك', en: 'Your chain of thinking' })}</h2>
              {/* no link is marked here: only an experiment can show which one to look at */}
              <ReasonChain steps={d.chain} />
            </>
          )}
          <p className="sl-quote">«{last.text}»</p>
          <SourceNote source={d.source} reason={d.fallbackReason} />
        </section>
        <div className="sl-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'continue', at: Date.now() })}>
            {toTeach ? t({ ar: 'يلا أعلّمك', en: 'Let me teach you' }) : t({ ar: 'آه، هيك قصدي', en: 'Yes, that is what I meant' })}<Icon name="next" />
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'reword' })}><Icon name="edit" />{t({ ar: 'مش هيك قصدي', en: 'That is not what I meant' })}</button>
        </div>
      </>}
      show={<ExperimentStage pack={pack} cond={conditionsFor(pack)} model={d.model} revealed={false} ideaLabel={t({ ar: 'عالم فكرتك', en: 'Your idea’s world' })} />}
    />
  );
}

export function Prereq({ pack, journey, dispatch }: LessonProps) {
  const { t } = useI18n();
  const task = gapTask(pack, journey.record);
  if (!task) {
    return (
      <div className="sl-center stack">
        <Title>{t({ ar: 'نرجع للتجربة', en: 'Back to the experiment' })}</Title>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'toTest' })}>{t({ ar: 'كمّل', en: 'Carry on' })}<Icon name="next" /></button>
      </div>
    );
  }
  const line = task.kind === 'verify'
    ? { ar: 'قبل ما نجرّب، بدي أتأكّد من إشي صغير بنحتاجه.', en: 'Before we test, I want to check one small thing we will need.' }
    : task.kind === 'remedy'
      ? { ar: 'خلّينا نقوّي أساس صغير سوا، خطوة خطوة.', en: 'Let us strengthen a small foundation together, one step at a time.' }
      : { ar: 'هلأ جرّب هالسؤال.', en: 'Now try this question.' };
  return (
    <div className="sl-center stack">
      <Title eyebrow={t({ ar: 'أساس صغير', en: 'A small foundation' })}>{t({ ar: 'وقفة قصيرة', en: 'A short stop' })}</Title>
      <NoorSays mood={task.kind === 'remedy' ? 'encouraging' : 'curious'} text={t(line)} />
      <GapCard task={task} packId={pack.id}
        remedyContent={task.kind === 'remedy' && task.prereq.id === 'water_vapour'
          ? <WaterRemedy busy={false} onDone={(reflection) => dispatch({ type: 'remedyDone', at: Date.now(), reflection })} />
          : task.kind === 'remedy' && task.prereq.id === 'water_states'
            ? <IceRemedy busy={false} onDone={(reflection) => dispatch({ type: 'remedyDone', at: Date.now(), reflection })} /> : undefined}
        onAnswer={(choice) => dispatch({ type: 'prereqAnswer', choice, at: Date.now() })} onRemedyDone={() => dispatch({ type: 'remedyDone', at: Date.now() })} />
    </div>
  );
}

export function Revise(props: LessonProps) {
  const { pack, journey, busy, explain, dispatch } = props;
  const { t, lang } = useI18n();
  const seen = observations(journey.record).at(-1);
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'من جديد', en: 'Once more' })}>{t({ ar: 'اشرح بعد اللي شفته', en: 'Explain after what you saw' })}</Title>
        <NoorSays mood={busy ? 'thinking' : 'listening'}
          text={busy ? t(thinking) : t({ ar: 'طيب، شو بتفكّر هلأ؟ اشرحلي من الأول بكلامك: ليش بيصير هيك؟', en: 'So what do you think now? Explain from the start, in your own words: why does this happen?' })} />
        {seen && <p className="row"><span className="chip chip-real">{t({ ar: 'اللي صار بالتجربة', en: 'What happened' })}: {t(pack.outcomes[seen.real])}</span></p>}
        <SpeakBox label={t({ ar: 'شرحي الجديد', en: 'My new explanation' })} busy={busy} onSubmit={explain} samples={samplesFor(props, lang)} />
        <div className="sl-actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => dispatch({ type: 'toTest' })}><Icon name="flask" />{t({ ar: 'بدي أجرّب كمان', en: 'Test again first' })}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => dispatch({ type: 'toTeach' })}><Icon name="cap" />{t({ ar: 'علّم نور', en: 'Teach Noor' })}</button>
        </div>
        <HelpBar {...props} />
      </>}
      show={<CurrentStage {...props} />}
    />
  );
}

/** Guided help after several tries: given once, then the learner puts it in their own words. */
export function Guided(props: LessonProps) {
  const { pack, journey, busy, explain, dispatch } = props;
  const { t, lang } = useI18n();
  const askedTeacher = openHelp(journey.record) === TEACHER_LEVEL;
  return (
    <Split
      task={<>
        <Title eyebrow={t({ ar: 'مساعدة', en: 'Help' })}>{t({ ar: 'خلّينا نحلّها سوا', en: 'Let us solve it together' })}</Title>
        <NoorSays mood={busy ? 'thinking' : 'encouraging'}
          text={busy ? t(thinking) : t({ ar: 'جرّبت كتير، وهيك بيشتغلوا العلماء! خلّيني أساعدك شوي، وبعدين احكيها إنت بكلامك.', en: 'You tested a lot, and that is how scientists work! Let me help a little, then say it in your own words.' })} />
        <HintCard pack={pack} level={4} />
        {askedTeacher && <HintCard pack={pack} level={TEACHER_LEVEL} />}
        <SpeakBox label={t({ ar: 'بكلامي أنا', en: 'In my own words' })} busy={busy} onSubmit={explain} samples={samplesFor(props, lang)} />
        <div className="sl-actions">
          {!askedTeacher && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dispatch({ type: 'askTeacher', at: Date.now() })}><Icon name="people" />{t({ ar: 'اسأل المعلّم', en: 'Ask the teacher' })}</button>}
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => dispatch({ type: 'toTest' })}><Icon name="flask" />{t({ ar: 'تجربة كمان', en: 'Another test' })}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => dispatch({ type: 'toTeach' })}><Icon name="next" />{t({ ar: 'كمّل لتعليم نور', en: 'Carry on to teaching Noor' })}</button>
        </div>
      </>}
      show={<CurrentStage {...props} />}
    />
  );
}
