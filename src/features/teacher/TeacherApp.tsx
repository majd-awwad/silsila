import { useEffect, useRef, useState } from 'react';
import { roomApi, teacherRooms } from '../../brain/client';
import { aggregates } from '../../brain/room';
import { SAMPLE_CODE } from '../../brain/sample';
import type { L, RoomError, TeacherOp, TeacherRoomView } from '../../contracts';
import { useI18n } from '../../i18n';
import { PACKS } from '../../packs';
import { href } from '../../router';
import { Icon } from '../../ui/icons';
import { EmptyState, Loading, Notice, SampleBanner, downloadFile } from '../../ui/kit';
import { ConfirmModal, PageHead, RoomProblem, TeacherShell } from './components/ui';
import { useRoomPoll } from './hooks/useRoomPoll';
import { boardKey, loadBoard } from './logic/groups';
import { tabForPhase } from './logic/insight';
import type { RoomTab } from './logic/insight';
import { buildReport, reportCSV, reportFileName, reportJSON } from './logic/report';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { NewSession } from './pages/NewSession';
import { Learners, LessonStudio, ActivityTab } from './pages/Tools';
import { ChangeTab } from './room/ChangeTab';
import { GapsTab } from './room/GapsTab';
import { GroupsTab } from './room/GroupsTab';
import { Counters, JoinPanel } from './room/JoinPanel';
import { LearnersTab } from './room/LearnersTab';
import { MapTab } from './room/MapTab';
import { PlanTab } from './room/PlanTab';
import { NextAction, Stepper } from './room/Stepper';
import { TestTab } from './room/TestTab';

const labels: Record<RoomTab, L> = {
  map: { ar: 'خريطة الأفكار', en: 'Idea map' }, plan: { ar: 'اختيار التجربة', en: 'Experiment plan' },
  test: { ar: 'التوقّعات والنتيجة', en: 'Predictions and result' }, change: { ar: 'شو تغيّر؟', en: 'What changed?' },
  learners: { ar: 'المتعلّمين', en: 'Learners' }, gaps: { ar: 'الأساسات', en: 'Foundations' },
  groups: { ar: 'المجموعات', en: 'Groups' }, activity: { ar: 'نشاط للصف', en: 'Class activity' },
};
const panels = { map: MapTab, plan: PlanTab, test: TestTab, change: ChangeTab, learners: LearnersTab, gaps: GapsTab, groups: GroupsTab, activity: ActivityTab };

function ControlRoom({ code, report }: { code: string; report: boolean }) {
  const { t, n, lang } = useI18n();
  const auth = teacherRooms.get(code)?.teacherKey ?? (code === SAMPLE_CODE ? 'sample' : undefined);
  const poll = useRoomPoll<TeacherRoomView>(code, 'teacher', auth, !!auth);
  const [tab, setTab] = useState<RoomTab | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<RoomError | null>(null);
  const [closing, setClosing] = useState(false);
  const inFlight = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => { if (tab) panelRef.current?.focus(); }, [tab]);
  const { view, error } = poll;
  const pack = view && PACKS[view.meta.settings.pack];
  const goBack = <a className="btn btn-secondary" href={href('/teacher')}>{t({ ar: 'لوحة المعلّم', en: 'Teacher dashboard' })}</a>;
  if (!auth || !view || !pack) return <TeacherShell active="room">
    {!auth ? <EmptyState action={goBack}>{t({ ar: 'افتح غرفة التحكّم من الجهاز اللي فتح الحصة.', en: 'Open the control room on the device that created the class.' })}</EmptyState>
      : error ? <RoomProblem error={error}>{goBack}</RoomProblem> : <Loading />}
  </TeacherShell>;

  const counts = aggregates(pack, view);
  const records = view.participants.map((p) => p.record);
  const selected = tab ?? tabForPhase(view.meta.phase);
  const Panel = panels[selected];
  const showPanel = tab !== null || !['lobby', 'explain'].includes(view.meta.phase);
  const readOnly = view.meta.closed || Date.now() > view.meta.expiresAt;
  const act = async (op: TeacherOp) => {
    if (inFlight.current || readOnly) return false;
    inFlight.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const result = await roomApi.teacher(code, auth, op);
      if (!result.ok) {
        setActionError(result.error);
        poll.refresh();
        return false;
      }
      poll.apply(result.data);
      if (op.type === 'phase') setTab(null);
      return true;
    } catch {
      setActionError('store_failed');
      return false;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };
  if (report) {
    const data = buildReport(pack, view, loadBoard(boardKey(code, view.meta.createdAt)), lang);
    return <TeacherShell active="room">
      <div className="stack">
        {view.meta.sample && <SampleBanner />}
        <PageHead title={t({ ar: 'تقرير الصف', en: 'Class report' })} lead={data.room.title} actions={<>
          <a className="btn btn-secondary" href={href('/teacher/room/' + code)}>{t({ ar: 'غرفة التحكّم', en: 'Control room' })}</a>
          <button className="btn btn-secondary" onClick={() => window.print()}>{t({ ar: 'اطبع', en: 'Print' })}</button>
          <button className="btn btn-secondary" onClick={() => downloadFile(reportFileName(data, 'csv'), reportCSV(data), 'text/csv;charset=utf-8')}>CSV</button>
          <button className="btn btn-secondary" onClick={() => downloadFile(reportFileName(data, 'json'), reportJSON(data))}>JSON</button>
        </>} />
        <Counters counts={counts} />
        <section className="card stack"><h2 className="subtitle">{t({ ar: 'قبل وبعد', en: 'Before and after' })}</h2>
          {data.changes.map((row) => <p key={row.from + row.to}>{row.from} → {row.to} · {n(row.count)} · {row.change}</p>)}
          {data.experiments.map((row) => <p key={row.name}>{row.name} · {row.observed}</p>)}
          {data.gaps.map((row) => <p key={row.prerequisite + row.status}>{row.prerequisite} · {row.status} · {n(row.count)}</p>)}
        </section>
        <section className="card stack"><h2 className="subtitle">{t({ ar: 'خطة التدخّل', en: 'Intervention plan' })}</h2>
          {data.groups.map((group, i) => <div key={i}><h3 className="font-bold">{group.title}</h3><p>{group.members.join(' · ')}</p><p>{group.move}</p><p>{group.experiment}</p></div>)}
        </section>
        <section className="card stack"><h2 className="subtitle">{t({ ar: 'حدود الأدلة', en: 'Limits of the evidence' })}</h2>
          <ul>{data.limitations.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>
      </div>
    </TeacherShell>;
  }

  return <TeacherShell active="room">
    <div className="stack">
      {view.meta.sample && <SampleBanner />}
      <PageHead eyebrow={<>{t({ ar: 'غرفة التحكّم الخاصة', en: 'Private control room' })} · <bdi>{code}</bdi></>} title={t(pack.title)} lead={t(pack.question)} actions={!readOnly &&
        <a className="btn btn-secondary" href={href(`/screen/${code}`)} target="_blank" rel="noreferrer"><Icon name="screen" />{t({ ar: 'افتح شاشة العرض', en: 'Open presentation screen' })}</a>} />
      {(actionError ?? error) && <RoomProblem error={(actionError ?? error)!} />}
      {readOnly && <Notice>{t({ ar: 'انتهت الحصة. التقارير لسه متاحة.', en: 'Class has ended. Reports are still available.' })}</Notice>}
      <Stepper phase={view.meta.phase} />
      {!readOnly && <NextAction key={view.meta.phase} meta={view.meta} counts={counts} busy={busy || !!error} act={act} />}
      {!readOnly && view.meta.phase === 'lobby' && <JoinPanel code={code} roster={view.participants} />}
      {tab && <button className="btn btn-secondary self-start" onClick={() => setTab(null)}>{t({ ar: 'العودة إلى نشاط المرحلة', en: 'Back to the stage activity' })}</button>}
      {showPanel && <section className="live-panel" tabIndex={-1} ref={panelRef} aria-label={t(labels[selected])}>
        <Panel key={selected} pack={pack} view={view} records={records} act={act} busy={busy || !!error} readOnly={readOnly} goTab={setTab} />
      </section>}
      <details className="live-tools">
        <summary>{t({ ar: 'أدوات الصف والتقارير', en: 'Classroom tools and reports' })}</summary>
        <div className="row">
          {(Object.keys(labels) as RoomTab[]).filter((id) => id !== 'plan' || !['lobby', 'explain'].includes(view.meta.phase)).map((id) =>
            <button type="button" key={id} aria-pressed={showPanel && selected === id} className="btn btn-secondary" onClick={() => setTab(id)}>{t(labels[id])}</button>)}
          <a className="btn btn-secondary" href={href('/teacher/room/' + code + '/report')}>{t({ ar: 'التقرير', en: 'Report' })}</a>
          {!readOnly && <button className="btn btn-ghost" disabled={busy || !!error} onClick={() => setClosing(true)}>{t({ ar: 'إنهاء الحصة', en: 'Close class' })}</button>}
        </div>
        {!readOnly && view.meta.phase !== 'lobby' && <JoinPanel code={code} />}
      </details>
      <ConfirmModal open={closing} onClose={() => setClosing(false)} busy={busy} onConfirm={() => void act({ type: 'close' }).then((ok) => { if (ok) setClosing(false); })}
        title={t({ ar: 'نسكّر الحصة؟', en: 'Close this class?' })} confirmLabel={t({ ar: 'سكّر الحصة', en: 'Close class' })}>
        {t({ ar: 'الطلاب ما بقدروا يبعتوا أجوبة بعدها.', en: 'Learners will stop being able to submit responses.' })}
      </ConfirmModal>
    </div>
  </TeacherShell>;
}

export function TeacherApp({ path = [] }: { path?: string[] }) {
  const [page, code, subPage] = path;
  switch (page) {
    case 'new': return <NewSession />;
    case 'library': return <Library packId={code} />;
    case 'learners': return <Learners />;
    case 'studio': return <LessonStudio />;
    case 'room': if (code) return <ControlRoom key={code} code={code.toUpperCase()} report={subPage === 'report'} />;
  }
  return <Dashboard />;
}
