/**
 * The class report and intervention plan, built once as plain data and used for the printable page, the JSON
 * download and the CSV download. It names learners by classroom alias only: no ids, no keys, no real names.
 */
import type { Lang, LearnerRecord, TeacherRoomView } from '../../../contracts';
import { interventionGroups, summarise } from '../../../brain/classInsights';
import { groupsOf, transitionsOf } from '../../../brain/room';
import { eventsOf } from '../../../brain/records';
import type { ConceptPack } from '../../../packs/types';
import { boardFrom, unassigned } from './groups';
import type { GroupBoard } from './groups';
import { CHANGE_LABEL, changeTotals, classifyChange, predictionTally } from './insight';
import { GAP_LABEL, GROUP_KIND_LABEL, LIMITATIONS, PHASE_NAME, groupTitle, orderKeys, tr } from './labels';
import { gapRows, learnerRow, nextStep } from './learner';

export interface ReportLearner {
  alias: string;
  firstStatus: string;
  firstIdea: string;
  firstWords: string;
  prediction: string;
  revisedStatus: string;
  revisedIdea: string;
  revisedWords: string;
  transfer: string;
  help: number;
  gaps: string;
  group: string;
  nextStep: string;
}

export interface ClassReport {
  generatedAt: string;
  sample: boolean;
  lang: Lang;
  room: { code: string; pack: string; title: string; grade: number; minutes: number; phase: string; closed: boolean; createdAt: string };
  counts: { participants: number; explained: number; predicted: number; revised: number; transferTried: number; transferShown: number; movedToComplete: number };
  initialGroups: { title: string; count: number }[];
  revisedGroups: { title: string; count: number }[];
  experiments: { name: string; observed: string; predictions: { outcome: string; count: number }[] }[];
  changes: { from: string; to: string; change: string; count: number }[];
  gaps: { prerequisite: string; status: string; count: number }[];
  groups: { title: string; kind: string; move: string; experiment: string; members: string[] }[];
  unassigned: string[];
  teacherEdited: boolean;
  learners: ReportLearner[];
  limitations: string[];
}

const STATUS_WORD: Record<string, { ar: string; en: string }> = {
  correct: { ar: 'شرح كامل', en: 'complete' },
  partial: { ar: 'جزئي', en: 'partial' },
  misconception: { ar: 'فكرة بدها اختبار', en: 'idea to investigate' },
  multiple: { ar: 'أكتر من فكرة', en: 'several ideas' },
  insufficient: { ar: 'أدلّة غير كافية', en: 'insufficient evidence' },
  contradictory: { ar: 'تناقض', en: 'contradictory' },
  offtopic: { ar: 'خارج الموضوع', en: 'off topic' },
  unsupported: { ar: 'خارج المحاكاة', en: 'cannot be simulated' },
};

export function buildReport(pack: ConceptPack, view: TeacherRoomView, board: GroupBoard | null, lang: Lang, now = Date.now()): ClassReport {
  const { meta, participants } = view;
  const records: LearnerRecord[] = participants.map((p) => p.record);
  const aliasOf = new Map(participants.map((p) => [p.id, p.alias]));
  const s = summarise(pack, records);
  const status = (v: string | undefined) => (v ? STATUS_WORD[v]?.[lang] ?? v : '');
  const outcome = (id: string) => pack.outcomes[id]?.[lang] ?? id;

  const suggested = interventionGroups(pack, records);
  const plan = board ?? boardFrom(suggested);
  const groupName = (g: { title: { ar: string; en: string } }) => g.title[lang];
  const gaps = gapRows(pack, records, lang);

  const groupsList = (which: 'initial' | 'revised') =>
    [...groupsOf(pack, records, which, false)].sort(orderKeys).map((g) => ({ title: groupTitle(pack, g.key)[lang], count: g.count }));

  const ran = [...new Set([...meta.done, ...(meta.experimentId && predictionTally(pack, records, meta.experimentId).some((t) => t.count) ? [meta.experimentId] : [])])];

  const gapCounts = new Map<string, { prerequisite: string; status: string; count: number }>();
  for (const g of gaps) {
    const key = `${g.prerequisiteId}:${g.status}`;
    const row = gapCounts.get(key) ?? { prerequisite: g.prerequisite, status: GAP_LABEL[g.status][lang], count: 0 };
    row.count++;
    gapCounts.set(key, row);
  }

  const transitions = transitionsOf(pack, records);
  const totals = changeTotals(transitions);

  const learners: ReportLearner[] = records.map((r) => {
    const row = learnerRow(pack, r, meta.experimentId, lang);
    const explains = eventsOf(r, 'explain');
    const first = explains.filter((e) => e.phase !== 'revise').at(-1);
    const later = explains.filter((e) => e.phase === 'revise').at(-1);
    const step = nextStep(pack, r, lang);
    return {
      alias: r.alias,
      firstStatus: status(row.first?.status),
      firstIdea: row.firstIdea,
      firstWords: first?.text ?? '',
      prediction: row.prediction ?? '',
      revisedStatus: status(row.revised?.status),
      revisedIdea: row.revisedIdea,
      revisedWords: later?.text ?? '',
      transfer: row.transfer === 'shown' ? tr(lang, 'ظهر', 'shown') : row.transfer === 'tried' ? tr(lang, 'حاول', 'attempted') : '',
      help: row.help,
      gaps: gaps.filter((g) => g.learnerId === r.id).map((g) => `${g.prerequisite} (${GAP_LABEL[g.status][lang]})`).join(tr(lang, '، ', '; ')),
      group: plan.groups.filter((g) => g.members.includes(r.id)).map(groupName).join(''),
      nextStep: `${step.title}: ${step.detail}`,
    };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    sample: meta.sample,
    lang,
    room: {
      code: meta.code, pack: pack.id, title: pack.title[lang], grade: meta.settings.grade, minutes: meta.settings.minutes,
      phase: PHASE_NAME[meta.phase][lang], closed: meta.closed, createdAt: new Date(meta.createdAt).toISOString(),
    },
    counts: {
      participants: records.length,
      explained: s.explained,
      predicted: meta.experimentId ? predictionTally(pack, records, meta.experimentId).reduce((a, t) => a + t.count, 0) : 0,
      revised: s.revised,
      transferTried: s.transferTried,
      transferShown: s.transferShown,
      movedToComplete: totals.reached,
    },
    initialGroups: records.length ? groupsList('initial') : [],
    revisedGroups: s.revised ? groupsList('revised') : [],
    experiments: ran.map((id) => ({
      name: pack.experiments.find((x) => x.id === id)?.name[lang] ?? id,
      observed: meta.done.includes(id)
        ? outcome(records.flatMap((r) => eventsOf(r, 'observe').filter((e) => e.experimentId === id)).at(-1)?.real ?? '')
        : '',
      predictions: predictionTally(pack, records, id).map((t) => ({ outcome: outcome(t.outcome), count: t.count })),
    })),
    changes: s.revised ? transitions.map((t) => ({
      from: groupTitle(pack, t.from)[lang], to: groupTitle(pack, t.to)[lang], change: CHANGE_LABEL[classifyChange(t.from, t.to)][lang], count: t.count,
    })) : [],
    gaps: [...gapCounts.values()],
    groups: plan.groups.map((g) => ({
      title: groupName(g),
      kind: GROUP_KIND_LABEL[g.kind]?.[lang] ?? g.kind,
      move: g.move[lang],
      experiment: g.experimentId ? pack.experiments.find((x) => x.id === g.experimentId)?.name[lang] ?? '' : '',
      members: g.members.flatMap((id) => aliasOf.get(id) ?? []),
    })),
    unassigned: unassigned(plan, participants.map((p) => p.id)).flatMap((id) => aliasOf.get(id) ?? []),
    teacherEdited: plan.edited,
    learners,
    limitations: [
      ...(meta.sample ? [tr(lang, 'بيانات تجريبية: متعلّمين وهميين، مش مشاركين حقيقيين.', 'Sample data: example learners, not real participants.')] : []),
      ...LIMITATIONS.map((l) => l[lang]),
    ],
  };
}

/* ───────────────────────── exports ───────────────────────── */

export type Cell = string | number | boolean | null | undefined;

/**
 * One CSV cell. Text that a spreadsheet could read as a formula (it starts with = + - @, a tab or a carriage
 * return, also after spaces) is prefixed with an apostrophe so it stays text.
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const risky = /^[\s ‎‏‪-‮⁦-⁩﻿]*[=+\-@＝＋－＠]/.test(value) || /^[\t\r]/.test(value);
  const safe = risky ? `'${value}` : value;
  return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** With a byte-order mark, so spreadsheet programs open the Arabic text correctly. */
export const toCSV = (rows: Cell[][]): string => `﻿${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;

const HEADERS: Record<keyof ReportLearner, { ar: string; en: string }> = {
  alias: { ar: 'الاسم المستعار', en: 'Alias' },
  firstStatus: { ar: 'حالة الشرح الأول', en: 'First status' },
  firstIdea: { ar: 'الفكرة الأولى', en: 'First idea' },
  firstWords: { ar: 'الشرح الأول بكلامه', en: 'First explanation' },
  prediction: { ar: 'التوقّع', en: 'Prediction' },
  revisedStatus: { ar: 'حالة الشرح الجديد', en: 'Revised status' },
  revisedIdea: { ar: 'الفكرة بعد', en: 'Revised idea' },
  revisedWords: { ar: 'الشرح الجديد بكلامه', en: 'Revised explanation' },
  transfer: { ar: 'الموقف الجديد', en: 'Transfer' },
  help: { ar: 'مستوى المساعدة', en: 'Help level' },
  gaps: { ar: 'أساسيات', en: 'Foundations' },
  group: { ar: 'المجموعة', en: 'Group' },
  nextStep: { ar: 'الخطوة الجاية', en: 'Next step' },
};

export const CSV_COLUMNS = Object.keys(HEADERS) as (keyof ReportLearner)[];

export function reportCSV(report: ClassReport): string {
  const header: Cell[] = [...CSV_COLUMNS.map((k) => HEADERS[k][report.lang]), tr(report.lang, 'بيانات تجريبية', 'Sample data')];
  const rows: Cell[][] = report.learners.map((l) => [...CSV_COLUMNS.map((k) => l[k]), report.sample ? tr(report.lang, 'نعم', 'yes') : tr(report.lang, 'لا', 'no')]);
  return toCSV([header, ...rows]);
}

export const reportJSON = (report: ClassReport): string => JSON.stringify(report, null, 2);

export const reportFileName = (report: ClassReport, ext: 'json' | 'csv'): string =>
  `silsila-${report.sample ? 'sample-' : ''}${report.room.code}-${report.room.pack}-${report.generatedAt.slice(0, 10)}.${ext}`;
