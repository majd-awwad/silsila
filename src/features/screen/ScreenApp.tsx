import { useState } from 'react';
import type { ScreenRoomView } from '../../contracts';
import { experimentById, experimentConditions } from '../../brain/world';
import { ROOM_MESSAGES, validCode } from '../../flow/classroom';
import { joinUrl } from '../../flow/joinUrl';
import { useI18n } from '../../i18n';
import { PACKS } from '../../packs';
import { ExperimentStage } from '../../ui/ExperimentStage';
import { PhenomenonPreview } from '../../ui/PhenomenonPreview';
import { Bar, EmptyState, Loading, Notice, QR, SampleBanner } from '../../ui/kit';
import { Icon } from '../../ui/icons';
import { useRoomPoll } from '../teacher/hooks/useRoomPoll';
import { discussionPrompts } from '../teacher/logic/insight';
import { groupTitle, PHASE_NAME } from '../teacher/logic/labels';
import { MindMap } from '../teacher/viz/MindMap';
import { TransformFlow } from '../teacher/viz/TransformFlow';
import '../classroom.css';

export function ScreenApp({ code }: { code: string | null }) {
  const { t } = useI18n();
  return <main className="projector">
    {code && validCode(code) ? <Projector key={code} code={code} /> : <EmptyState>{t({ ar: 'افتح رابط شاشة العرض من غرفة التحكّم.', en: 'Open the presentation screen from the control room.' })}</EmptyState>}
  </main>;
}

function Projector({ code }: { code: string }) {
  const { t, n, lang } = useI18n();
  const { view, error, refresh } = useRoomPoll<ScreenRoomView>(code, 'screen');
  const [fullscreenError, setFullscreenError] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  if (error === 'room_closed' || error === 'no_room') return <Notice>{t(ROOM_MESSAGES[error])}</Notice>;
  if (!view) return error ? <Notice tone="warn">{t(ROOM_MESSAGES[error])}<button className="btn btn-secondary" onClick={refresh}>{t({ ar: 'أعد الاتصال', en: 'Reconnect' })}</button></Notice> : <Loading />;
  const { meta, agg } = view;
  if (meta.closed || Date.now() > meta.expiresAt) return <Notice>{t(ROOM_MESSAGES[meta.closed ? 'room_closed' : 'expired'])}</Notice>;
  const pack = PACKS[meta.settings.pack];
  if (!pack) return <Notice tone="error">{t(ROOM_MESSAGES.bad_request)}</Notice>;
  const test = experimentById(pack, meta.experimentId);
  const link = joinUrl(code, meta.sample);
  const predictionPhase = ['predict', 'reveal', 'experiment', 'observe', 'discuss'].includes(meta.phase);
  const groups = agg.groups?.filter((group) => group.key !== 'waiting') ?? [];
  const ranked = agg.result?.byGroup ?? [];
  const first = ranked.find((group) => group.key === focus) ?? ranked.find((group) => group.contradicted) ?? ranked[0];
  const prompts = meta.phase === 'discuss' ? discussionPrompts(pack, agg.groups, agg.result, lang) : [];
  const fullscreen = () => {
    setFullscreenError(false);
    const operation = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    if (operation) void operation.catch(() => setFullscreenError(true));
    else setFullscreenError(true);
  };
  const progress = { explain: agg.explained, predict: agg.predicted, revise: agg.revised, transfer: agg.transferred };
  const submitted = progress[meta.phase as keyof typeof progress];
  return <>
    <header className="projector-top">
      <strong>{t({ ar: 'سِلسِلة · شاشة الصف', en: 'SILSILA · Classroom screen' })}</strong>
      <div className="row"><bdi className="chip">{code}</bdi><button className="btn btn-secondary" onClick={fullscreen}><Icon name="screen" />{t({ ar: 'ملء الشاشة', en: 'Full screen' })}</button></div>
    </header>
    {meta.sample && <SampleBanner />}
    {error && <Notice tone="warn">{t({ ar: 'جارٍ إعادة الاتصال. هذه آخر مرحلة مستلمة.', en: 'Reconnecting. This is the last received stage.' })}</Notice>}
    {fullscreenError && <Notice>{t({ ar: 'يمكن استخدام أمر ملء الشاشة في المتصفح.', en: 'Use the browser’s full-screen command.' })}</Notice>}
    <div className="projector-title">
      <span className="eyebrow">{t(PHASE_NAME[meta.phase])}</span>
      <h1>{t(pack.title)}</h1>
      <p role="status">{submitted !== undefined
        ? t({ ar: `أرسل ${n(submitted)} من ${n(agg.participants)} إجابتهم`, en: `${n(submitted)} of ${n(agg.participants)} submitted` })
        : t({ ar: `${n(agg.participants)} منضمّون`, en: `${n(agg.participants)} joined` })}</p>
    </div>
    {meta.phase === 'lobby' && <section className="projector-board projector-lobby">
      <div><h2>{t({ ar: 'انضموا إلى الحصة', en: 'Join the lesson' })}</h2><strong className="projector-code" dir="ltr">{code}</strong>
        {link ? <p className="projector-link" dir="ltr">{link}</p> : <p>{t({ ar: 'اطلبوا عنوان التطبيق على الشبكة من المعلّم.', en: 'Ask your teacher for the app’s network address.' })}</p>}</div>
      {link && <QR value={link} size={240} label={t({ ar: 'امسح رمز الانضمام', en: 'Scan the class join code' })} />}
    </section>}
    {meta.phase === 'explain' && <section className="projector-board stack"><h2>{t(pack.question)}</h2>
      <PhenomenonPreview pack={pack} />
      <p>{t({ ar: 'لاحظوا الظاهرة وأرسلوا تفسيركم على أجهزتكم.', en: 'Observe the phenomenon and send your own explanation on your device.' })}</p>
    </section>}
    {['map', 'recommend', 'approve'].includes(meta.phase) && <section className="projector-board stack">
      <h2>{t({ ar: 'أفكار الصف', en: 'Class ideas' })}</h2>
      {groups.length ? <MindMap pack={pack} groups={groups} variant="screen" /> : <p>{t({ ar: 'بانتظار أول تفسير.', en: 'Waiting for the first explanation.' })}</p>}
      {agg.participants > agg.explained && <p>{n(agg.participants - agg.explained)} {t({ ar: 'ما زالوا يفكّرون', en: 'still thinking' })}</p>}
    </section>}
    {test && predictionPhase && <section className="projector-board stack">
      <h2>{t(test.name)}</h2>
      {meta.phase === 'predict' && <p>{t(test.question)}</p>}
      <ExperimentStage pack={pack} cond={experimentConditions(pack, test.id)} key={test.id} model={first?.model ?? null} ideaLabel={first ? t(groupTitle(pack, first.key)) : undefined} revealed={!!agg.result} allow3d={false} />
      {agg.result && <>
        <p className="projector-result">{t({ ar: 'نتيجة المحاكاة العلمية', en: 'Reference simulation result' })} · {t(pack.outcomes[agg.result.outcome])}</p>
        {meta.settings.mode !== 'digital' && <p>{t({ ar: 'قارنوا هذه المحاكاة بما لاحظتم في التجربة المادية، إذا نفّذتموها.', en: 'Compare the simulation with what your class actually observed if you ran a physical test.' })}</p>}
        <div className="projector-hypotheses">
          {ranked.map((group) => <button type="button" className="btn btn-secondary" key={group.key} aria-pressed={group.key === first?.key} onClick={() => setFocus(group.key)}>
            {t(groupTitle(pack, group.key))} · {t(pack.outcomes[group.outcome])}
          </button>)}
        </div>
      </>}
      {agg.predictions && <div className="stack">
        <h3>{t({ ar: 'توقّعات الصف', en: 'Class predictions' })}</h3>
        {agg.predictions.length ? agg.predictions.map((row) => <Bar key={row.outcome} label={t(pack.outcomes[row.outcome])} value={row.count} max={Math.max(1, agg.predicted)} />)
          : <p>{t({ ar: 'لم تُرسل توقّعات في هذه الحصة.', en: 'No predictions were submitted.' })}</p>}
      </div>}
    </section>}
    {prompts.length > 0 && <section className="projector-board stack"><h2>{t({ ar: 'لنتناقش', en: 'Discuss together' })}</h2>
      {prompts.map((prompt) => <p key={prompt.key}>{prompt.question}</p>)}
    </section>}
    {meta.phase === 'revise' && <section className="projector-board"><h2>{t({ ar: 'كيف تفسّر الظاهرة الآن؟', en: 'How do you explain it now?' })}</h2></section>}
    {meta.phase === 'transfer' && <section className="projector-board"><h2>{t(pack.transfer.prompt)}</h2></section>}
    {agg.transitions && <section className="projector-board stack">
      <h2>{t({ ar: 'كيف تغيّرت الأفكار؟', en: 'How did ideas change?' })}</h2>
      {agg.transitions.length ? <TransformFlow pack={pack} moves={agg.transitions} /> : <p>{t({ ar: 'لا توجد شروحات أولية للمقارنة.', en: 'There are no initial explanations to compare.' })}</p>}
    </section>}
  </>;
}
