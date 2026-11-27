/**
 * Intervention groups the teacher can reshape: move learners, rename, add or remove groups. Kept on this device
 * for this room only; temporary by design.
 */
import { useState } from 'react';
import { interventionGroups } from '../../../brain/classInsights';
import { useI18n } from '../../../i18n';
import { href } from '../../../router';
import { EmptyState, Notice } from '../../../ui/kit';
import { Icon } from '../../../ui/icons';
import { ConfirmModal, SectionTitle } from '../components/ui';
import {
  addGroup, boardKey, clearBoard, currentBoard, isOutdated, loadBoard, moveLearner, removeGroup, renameGroup, saveBoard, setMove, unassigned,
} from '../logic/groups';
import type { GroupBoard, TeamGroup } from '../logic/groups';
import { GROUP_KIND_LABEL } from '../logic/labels';
import type { RoomTabProps } from './types';

export function GroupsTab({ pack, view, records }: RoomTabProps) {
  const { t, n, lang } = useI18n();
  const key = boardKey(view.meta.code, view.meta.createdAt);
  const [saved, setSaved] = useState<GroupBoard | null>(() => loadBoard(key));
  const [stored, setStored] = useState(true);
  const [resetting, setResetting] = useState(false);
  const suggested = interventionGroups(pack, records);
  const ids = view.participants.map((p) => p.id);
  const alias = new Map(view.participants.map((p) => [p.id, p.alias]));
  const board = currentBoard(saved, suggested, ids);
  const free = unassigned(board, ids);
  const suggestionFor = (id: string) => suggested.find((g) => g.members.includes(id));

  const change = (next: GroupBoard) => {
    setSaved(next);
    setStored(saveBoard(key, next));
  };

  const member = (id: string, current: TeamGroup | null) => (
    <li key={id} className="tc-member">
      <span>{alias.get(id) ?? '—'}</span>
      <select className="select" value={current?.id ?? ''} aria-label={t({ ar: `انقلوا ${alias.get(id) ?? ''} لمجموعة`, en: `Move ${alias.get(id) ?? ''} to a group` })}
        onChange={(e) => change(moveLearner(board, id, e.target.value || null))}>
        <option value="">{t({ ar: 'بدون مجموعة', en: 'No group' })}</option>
        {board.groups.map((g, i) => <option key={g.id} value={g.id}>{g.title[lang] || `${t({ ar: 'مجموعة', en: 'Group' })} ${n(i + 1)}`}</option>)}
      </select>
    </li>
  );

  if (!records.length) return <EmptyState>{t({ ar: 'المجموعات بتتكوّن بعد ما المتعلّمين يشرحوا.', en: 'Groups form after learners explain.' })}</EmptyState>;

  return (
    <div className="stack">
      <SectionTitle
        hint={t({ ar: 'مقترحة من أدلّة هالحصة. بتقدروا تنقلوا، تسمّوا، تضيفوا أو تشيلوا.', en: 'Suggested from this lesson’s evidence. Move, rename, add or remove as you see fit.' })}
        actions={(
          <>
            <button type="button" className="btn btn-secondary btn-sm"
              onClick={() => change(addGroup(board, { ar: `مجموعة ${(board.groups.length + 1).toLocaleString('ar-EG')}`, en: `Group ${board.groups.length + 1}` }))}>
              <Icon name="plus" size={16} />{t({ ar: 'مجموعة جديدة', en: 'New group' })}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!board.edited} onClick={() => setResetting(true)}>
              <Icon name="replay" size={16} />{t({ ar: 'ارجعوا للاقتراح', en: 'Reset to suggestion' })}
            </button>
            <a className="btn btn-secondary btn-sm" href={href(`/teacher/room/${view.meta.code}/report`)}><Icon name="print" size={16} />{t({ ar: 'خطة التدخّل', en: 'Intervention plan' })}</a>
          </>
        )}
      >
        {t({ ar: 'مجموعات التدخّل', en: 'Intervention groups' })}
      </SectionTitle>
      <Notice tone="warn">{t({ ar: 'مجموعات مؤقتة لهالحصة، محفوظة على هالجهاز بس. مش تصنيف لقدرات حدا، وبتتغيّر مع الأدلّة.', en: 'Temporary groups for this lesson, kept on this device only. They are not ability labels and change with the evidence.' })}</Notice>
      {!stored && <Notice tone="error">{t({ ar: 'المتصفّح ما سمح بالحفظ: التعديلات بتضيع إذا سكّرتوا الصفحة.', en: 'The browser refused to save: edits are lost if you leave this page.' })}</Notice>}
      {isOutdated(board, suggested) && <Notice>{t({ ar: 'وصلت أدلّة جديدة من وقت ما عدّلتوا. تعديلاتكم باقية؛ «ارجعوا للاقتراح» بيعيد التوزيع.', en: 'New evidence arrived since your edits. Your edits are kept; “Reset to suggestion” redistributes.' })}</Notice>}

      {free.length > 0 && (
        <section className="tc-edit-block">
          <h3 className="tc-h3">{t({ ar: `بدون مجموعة (${n(free.length)})`, en: `Not in a group (${free.length})` })}</h3>
          <ul className="tc-plain tc-grid !gap-1">
            {free.map((id) => member(id, null))}
          </ul>
          {free.some((id) => suggestionFor(id)) && (
            <ul className="tc-plain help">
              {free.flatMap((id) => {
                const s = suggestionFor(id);
                return s ? [<li key={id}>{alias.get(id)}: {t({ ar: 'الاقتراح', en: 'suggested' })} «{t(s.title)}»</li>] : [];
              })}
            </ul>
          )}
        </section>
      )}

      {!board.groups.length && <EmptyState>{t({ ar: 'ما في مجموعات. أضيفوا وحدة أو ارجعوا للاقتراح.', en: 'No groups. Add one or reset to the suggestion.' })}</EmptyState>}
      <div className="tc-board">
        {board.groups.map((g, i) => {
          const experiment = pack.experiments.find((x) => x.id === g.experimentId);
          return (
            <article key={g.id} className="tc-group" data-kind={g.kind}>
              <div className="row">
                <span className="chip">{t(GROUP_KIND_LABEL[g.kind] ?? GROUP_KIND_LABEL.custom)}</span>
                <span className="chip chip-brand ms-auto">{n(g.members.length)}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => change(removeGroup(board, g.id))}
                  aria-label={t({ ar: `شيلوا المجموعة ${g.title[lang]}`, en: `Remove group ${g.title[lang]}` })}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="field">
                <label className="sr-only" htmlFor={`g-name-${i}`}>{t({ ar: 'اسم المجموعة', en: 'Group name' })}</label>
                <input id={`g-name-${i}`} className="input !font-bold" maxLength={80} value={g.title[lang]} onChange={(e) => change(renameGroup(board, g.id, e.target.value))} />
              </div>
              <div className="field">
                <label className="help" htmlFor={`g-move-${i}`}>{t({ ar: 'شو بتعملوا مع هالمجموعة', en: 'What you will do with this group' })}</label>
                <textarea id={`g-move-${i}`} className="textarea !min-h-[72px] !text-[14.5px]" maxLength={400} value={g.move[lang]} onChange={(e) => change(setMove(board, g.id, e.target.value))} />
              </div>
              {experiment && <p className="help"><Icon name="flask" size={14} className="inline me-1" />{t(experiment.name)}</p>}
              {g.members.length ? <ul className="tc-plain">{g.members.map((id) => member(id, g))}</ul> : <p className="muted text-[14px]">{t({ ar: 'فاضية. انقلوا متعلّمين إلها.', en: 'Empty. Move learners here.' })}</p>}
            </article>
          );
        })}
      </div>

      <ConfirmModal open={resetting} title={t({ ar: 'نرجع للتوزيع المقترح؟', en: 'Return to the suggested groups?' })} confirmLabel={t({ ar: 'ارجعوا', en: 'Reset' })}
        onClose={() => setResetting(false)} onConfirm={() => { clearBoard(key); setSaved(null); setStored(true); setResetting(false); }}>
        <p>{t({ ar: 'تعديلاتكم على المجموعات بتنمسح.', en: 'Your changes to the groups are discarded.' })}</p>
      </ConfirmModal>
    </div>
  );
}
