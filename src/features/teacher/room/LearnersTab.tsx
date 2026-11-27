/** Every learner in the room at a glance, and one learner's full report. */
import { useState } from 'react';
import { useI18n } from '../../../i18n';
import { EmptyState, StatusChip } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { Boundary, ConfirmModal, SectionTitle, usePrintSheet } from '../components/ui';
import { LearnerReport } from '../components/LearnerReport';
import { ReviewPanel } from './ReviewPanel';
import { learnerRow } from '../logic/learner';
import type { RoomTabProps } from './types';

export function LearnersTab({ pack, view, records, act, busy, readOnly }: RoomTabProps) {
  const { t, n, lang } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; alias: string } | null>(null);
  const { print, sheet } = usePrintSheet();
  const rows = records.map((r) => learnerRow(pack, r, view.meta.experimentId, lang));
  const record = records.find((r) => r.id === open) ?? null;
  const broken = <p className="muted">{t({ ar: 'ما قدرنا نعرض هالسجلّ.', en: 'This record could not be shown.' })}</p>;

  const remove = (
    <ConfirmModal
      open={!!removing}
      busy={busy}
      title={t({ ar: `نشيل «${removing?.alias ?? ''}» من الصف؟`, en: `Remove “${removing?.alias ?? ''}” from the room?` })}
      confirmLabel={t({ ar: 'شيلوه', en: 'Remove' })}
      onClose={() => setRemoving(null)}
      onConfirm={() => {
        if (!removing) return;
        const id = removing.id;
        void act({ type: 'remove', participantId: id }).then((ok) => {
          setRemoving(null);
          if (ok && open === id) setOpen(null);
        });
      }}
    >
      <p>{t({ ar: 'بيتمسح سجلّه من هالصف وما بيرجع، وبيطلع من كل الإحصائيات.', en: 'Their record is deleted from this room for good and leaves every count.' })}</p>
    </ConfirmModal>
  );

  if (record) {
    return (
      <div className="stack">
        <div className="row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(null)}><Icon name="back" size={16} />{t({ ar: 'كل المتعلّمين', en: 'All learners' })}</button>
          <h2 className="subtitle flex-1">{record.alias}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => print(
            <div className="tc-sheet tc-report">
              <h1>{record.alias}</h1>
              <LearnerReport pack={pack} record={record} />
            </div>,
          )}><Icon name="print" size={16} />{t({ ar: 'اطبعوا', en: 'Print' })}</button>
          {!readOnly && <button type="button" className="btn btn-danger btn-sm" onClick={() => setRemoving({ id: record.id, alias: record.alias })}><Icon name="trash" size={16} />{t({ ar: 'شيلوه من الصف', en: 'Remove' })}</button>}
        </div>
        <ReviewPanel pack={pack} record={record} act={act} busy={busy} readOnly={readOnly} />
        <div className="card"><Boundary key={record.id} fallback={broken}><LearnerReport pack={pack} record={record} /></Boundary></div>
        {sheet}
        {remove}
      </div>
    );
  }

  if (!rows.length) return <EmptyState>{t({ ar: 'ما انضم حدا لسا.', en: 'Nobody has joined yet.' })}</EmptyState>;

  const head = {
    alias: t({ ar: 'الاسم المستعار', en: 'Alias' }),
    first: t({ ar: 'الفكرة الأولى', en: 'First idea' }),
    status: t({ ar: 'الحالة', en: 'Status' }),
    prediction: t({ ar: 'التوقّع', en: 'Prediction' }),
    revised: t({ ar: 'بعد', en: 'Revised' }),
    transfer: t({ ar: 'موقف جديد', en: 'Transfer' }),
    help: t({ ar: 'مساعدة', en: 'Help' }),
  };
  return (
    <div className="stack">
      <SectionTitle hint={t({ ar: 'أسماء مستعارة. الحالة وصف للشرح، مش تصنيف للمتعلّم.', en: 'Aliases only. A status describes an explanation, not a learner.' })}>
        {t({ ar: `المتعلّمين (${n(rows.length)})`, en: `Learners (${rows.length})` })}
      </SectionTitle>
      <div className="scroll-x">
        <table className="table tc-table is-stack">
          <thead>
            <tr>
              {Object.values(head).map((h) => <th scope="col" key={h}>{h}</th>)}
              <th scope="col"><span className="sr-only">{t({ ar: 'إجراءات', en: 'Actions' })}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label={head.alias}><strong>{r.alias}</strong></td>
                <td data-label={head.first}><span>{r.firstIdea || <span className="muted">—</span>}</span></td>
                <td data-label={head.status}><span><StatusChip status={r.first?.status ?? 'waiting'} /></span></td>
                <td data-label={head.prediction}><span>{r.prediction ?? <span className="muted">—</span>}</span></td>
                <td data-label={head.revised}><span>{r.revised ? <StatusChip status={r.revised.status} /> : <span className="muted">—</span>}</span></td>
                <td data-label={head.transfer}>
                  <span>{r.transfer === 'shown' ? <span className="chip chip-real"><Icon name="check" size={13} />{t({ ar: 'ظهر', en: 'Shown' })}</span>
                    : r.transfer === 'tried' ? <span className="chip">{t({ ar: 'حاول', en: 'Attempted' })}</span> : <span className="muted">—</span>}</span>
                </td>
                <td data-label={head.help}><span>{r.help ? <span className="chip chip-idea">{t({ ar: `مستوى ${n(r.help)}`, en: `Level ${r.help}` })}</span> : <span className="muted">{t({ ar: 'بدون', en: 'None' })}</span>}</span></td>
                <td data-label={t({ ar: 'إجراءات', en: 'Actions' })}>
                  <span className="row !gap-1.5">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(r.id)} aria-label={t({ ar: `تقرير ${r.alias}`, en: `Report for ${r.alias}` })}>{t({ ar: 'التقرير', en: 'Report' })}</button>
                    {!readOnly && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRemoving({ id: r.id, alias: r.alias })} aria-label={t({ ar: `شيلوا ${r.alias}`, en: `Remove ${r.alias}` })}>
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {remove}
    </div>
  );
}
