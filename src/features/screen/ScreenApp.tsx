import type { ScreenRoomView } from '../../contracts';
import { experimentById, experimentConditions } from '../../brain/world';
import { ROOM_MESSAGES, validCode } from '../../flow/classroom';
import { useI18n } from '../../i18n';
import { PACKS } from '../../packs';
import { absoluteLink, href } from '../../router';
import { ExperimentStage } from '../../ui/ExperimentStage';
import { Bar, EmptyState, Loading, Notice, QR, SampleBanner, Shell } from '../../ui/kit';
import { useRoomPoll } from '../teacher/hooks/useRoomPoll';
import { discussionPrompts, modelForGroup } from '../teacher/logic/insight';
import { groupTitle, PHASE_NAME } from '../teacher/logic/labels';

export function ScreenApp({ code }: { code: string | null }) {
  const { t } = useI18n();
  return <Shell>
    {code && validCode(code) ? <Projector key={code} code={code} /> : <EmptyState action={<a className="btn btn-secondary" href={href('/teacher')}>{t({ ar: 'لوحة المعلّم', en: 'Teacher dashboard' })}</a>}>
      {t({ ar: 'افتح رابط شاشة العرض من غرفة التحكّم.', en: 'Open the projector link from the control room.' })}
    </EmptyState>}
  </Shell>;
}

function Projector({ code }: { code: string }) {
  const { t, n, lang } = useI18n();
  const { view, error } = useRoomPoll<ScreenRoomView>(code, 'screen');
  if (!view) return error ? <Notice tone="warn">{t(ROOM_MESSAGES[error])}</Notice> : <Loading />;
  const { meta, agg } = view;
  const pack = PACKS[meta.settings.pack];
  if (!pack) return <Notice tone="error">{t(ROOM_MESSAGES.bad_request)}</Notice>;
  const test = experimentById(pack, meta.experimentId);
  const predictionPhase = ['predict', 'reveal', 'experiment', 'observe', 'discuss'].includes(meta.phase);
  const ranked = agg.result?.byGroup.slice().sort((a, b) => b.count - a.count) ?? [];
  const first = ranked.find((group) => group.contradicted) ?? ranked[0];
  const prompts = meta.phase === 'discuss' ? discussionPrompts(pack, agg.groups, agg.result, lang) : [];
  return <div className="stack">
    {meta.sample && <SampleBanner />}
    {error && <Notice tone="warn">{t(ROOM_MESSAGES[error])}</Notice>}
    <header className="card stack">
      <div className="row"><span className="chip chip-brand">{t(PHASE_NAME[meta.phase])}</span><bdi className="chip">{code}</bdi></div>
      <h1 className="title">{t(pack.question)}</h1><p>{n(agg.participants)} {t({ ar: 'مشاركين', en: 'participants' })}</p>
    </header>
    {meta.closed ? <Notice>{t(ROOM_MESSAGES.room_closed)}</Notice> : <>
      {meta.phase === 'lobby' && !meta.sample && <section className="card row"><QR value={absoluteLink('/join/' + code)} label={t({ ar: 'رابط الانضمام للصف', en: 'Class join link' })} /><div className="stack">
        <h2 className="subtitle">{t({ ar: 'امسح الرمز أو ادخل بالرمز', en: 'Scan or join with the class code' })}</h2><strong className="title" dir="ltr">{code}</strong>
      </div></section>}
      {!!agg.groups?.length && !test && <section className="card stack">
        <h2 className="subtitle">{t({ ar: 'أفكار الصف', en: 'Class ideas' })}</h2>
        {agg.groups.map((group) => <Bar key={group.key} label={t(groupTitle(pack, group.key))} value={group.count} max={Math.max(1, agg.participants)} />)}
      </section>}
      {test && predictionPhase && <div className="stack">
        <h2 className="subtitle">{t(test.name)}</h2>
        <ExperimentStage pack={pack} cond={experimentConditions(pack, test.id)} model={first ? modelForGroup(pack, first.key, first.ideas) : null} revealed={!!agg.result} allow3d={false} />
        {agg.predictions && <section className="card stack">
          <h3 className="subtitle">{t({ ar: 'توقّعات الصف', en: 'Class predictions' })}</h3>
          {agg.predictions.map((row) => <Bar key={row.outcome} label={t(pack.outcomes[row.outcome])} value={row.count} max={Math.max(1, agg.participants)} />)}
        </section>}
      </div>}
      {prompts.length > 0 && <section className="card stack"><h2 className="subtitle">{t({ ar: 'أسئلة للنقاش', en: 'Discussion questions' })}</h2>
        {prompts.map((prompt) => <div key={prompt.key}><strong>{prompt.title}</strong><p>{prompt.question}</p></div>)}
      </section>}
      {meta.phase === 'transfer' && <div className="card"><h2 className="subtitle">{t(pack.transfer.prompt)}</h2></div>}
      {agg.transitions && <section className="card stack">
        <h2 className="subtitle">{t({ ar: 'كيف تغيّرت الأفكار؟', en: 'How did ideas change?' })}</h2>
        {agg.transitions.map((row) => <p key={row.from + row.to}>{t(groupTitle(pack, row.from))} → {t(groupTitle(pack, row.to))} · {n(row.count)}</p>)}
      </section>}
    </>}
  </div>;
}
