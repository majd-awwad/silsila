/**
 * Learning DNA and Thinking Replay, both derived only from what the learner actually did.
 * A concept is never marked as understood because one final answer was correct: «demonstrated» needs two
 * independent kinds of supporting evidence, help received is recorded as «assisted», and longer-term
 * retention is never claimed because it is not measured.
 * This models reasoning the learner expressed; it cannot observe private thought.
 */
import type { ChainId, Lang, LearnerRecord } from '../contracts';
import { CHAIN_IDS } from '../contracts';
import type { ConceptPack } from '../packs/types';
import { correctIdeaId } from './normalise';
import { eventsOf } from './records';
import { outcomeMatches } from './world';
import { experimentById } from './world';

export type NodeStatus = 'not_assessed' | 'insufficient' | 'partial' | 'misconception' | 'demonstrated' | 'assisted' | 'transfer';
export type EvidenceKind = 'explanation' | 'teach' | 'transfer' | 'prediction' | 'quiz' | 'prerequisite';

export interface Evidence {
  at: number;
  node: ChainId;
  kind: EvidenceKind;
  supports: boolean;
  /** received a focused clue or guided instruction before this */
  assisted: boolean;
  quote?: string;
}

const STRONG: EvidenceKind[] = ['explanation', 'teach', 'transfer'];
/** help from this scaffolding level on counts as assistance (1–2 are neutral reflection and attention) */
export const ASSIST_LEVEL = 3;

export function evidenceOf(pack: ConceptPack, record: LearnerRecord, until = Infinity): Evidence[] {
  const out: Evidence[] = [];
  const correct = correctIdeaId(pack);
  const helpAt = eventsOf(record, 'assist').find((e) => e.level >= ASSIST_LEVEL)?.at ?? Infinity;
  const add = (at: number, node: ChainId, kind: EvidenceKind, supports: boolean, quote?: string) =>
    out.push({ at, node, kind, supports, assisted: at >= helpAt, quote });

  for (const e of record.events) {
    if (e.at > until) continue;
    if (e.type === 'explain') {
      e.diagnosis.steps.forEach((s, i) => { if (s.met) add(e.at, pack.steps[i].node, 'explanation', true, s.evidence); });
      for (const idea of e.diagnosis.ideas) {
        const node = idea.id !== correct ? pack.ideas[idea.id]?.breaks : null;
        if (node) add(e.at, node, 'explanation', false, idea.evidence);
      }
    } else if (e.type === 'teach') {
      e.steps.forEach((s, i) => { if (s.met) add(e.at, pack.steps[i].node, 'teach', true, s.evidence); });
    } else if (e.type === 'transfer') {
      e.steps.forEach((s, i) => { if (s.met) add(e.at, pack.steps[i].node, 'transfer', true, s.evidence); });
      if (e.choiceCorrect !== null) add(e.at, pack.transfer.check.node ?? 'C5', 'transfer', e.choiceCorrect, e.text || undefined);
      if (e.steps.every((s) => s.met) && pack.transfer.check.node !== 'C5') add(e.at, 'C5', 'transfer', true, e.text);
    } else if (e.type === 'observe' && e.predicted && e.experimentId) {
      const x = experimentById(pack, e.experimentId);
      for (const node of x?.targets ?? []) add(e.at, node, 'prediction', outcomeMatches(pack, e.predicted, e.real));
    } else if (e.type === 'quiz' && e.kind === 'post') {
      pack.postTest.forEach((q, i) => { if (q.node && e.answers[i] !== undefined) add(e.at, q.node, 'quiz', e.answers[i] === q.correct); });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function nodeStatus(items: Evidence[]): NodeStatus {
  if (!items.length) return 'not_assessed';
  const strong = items.filter((e) => STRONG.includes(e.kind));
  if (!strong.length) return 'insufficient';
  const lastStrong = strong.at(-1)!;
  if (!lastStrong.supports) return 'misconception';
  // only support gathered after the last thing the learner said against this concept counts
  const lastAgainst = [...strong].reverse().find((e) => !e.supports);
  const support = items.filter((e) => e.supports && (!lastAgainst || e.at > lastAgainst.at));
  const alone = support.filter((e) => !e.assisted);
  if (alone.some((e) => e.kind === 'transfer')) return 'transfer';
  if (!alone.length) return 'assisted';
  const contradictedSince = items.some((e) => !e.supports && e.at > lastStrong.at);
  if (new Set(alone.map((e) => e.kind)).size >= 2 && !contradictedSince) return 'demonstrated';
  return support.some((e) => e.assisted) ? 'assisted' : 'partial';
}

export function learningDNA(pack: ConceptPack, record: LearnerRecord, until = Infinity): Record<ChainId, { status: NodeStatus; evidence: Evidence[] }> {
  const all = evidenceOf(pack, record, until);
  return Object.fromEntries(CHAIN_IDS.map((id) => {
    const evidence = all.filter((e) => e.node === id);
    return [id, { status: nodeStatus(evidence), evidence }];
  })) as Record<ChainId, { status: NodeStatus; evidence: Evidence[] }>;
}

export type GapStatus = 'not_suspected' | 'suspected' | 'confirmed' | 'rejected' | 'recovered' | 'persisting';
export interface Gap {
  id: string;
  status: GapStatus;
  /** learner words that raised the suspicion */
  because: string[];
  answers: { questionId: string; correct: boolean; phase: 'verify' | 'recheck' }[];
}

/**
 * Learning Gap Recovery: a wrong answer only raises a suspicion. A gap is confirmed only when a targeted
 * verification question fails, and counts as recovered only when the recheck succeeds.
 */
export function gapsOf(pack: ConceptPack, record: LearnerRecord): Gap[] {
  const explained = eventsOf(record, 'explain').filter((e) => e.phase !== 'revise');
  const first = explained.at(-1)?.diagnosis;
  return pack.prerequisites.map((p) => {
    const because: string[] = [];
    if (first) {
      for (const i of first.ideas) if (p.suspect.ideas.includes(i.id)) because.push(i.evidence);
      if (p.suspect.missingSteps.length && first.status === 'partial' && p.suspect.missingSteps.every((s) => !first.steps[s]?.met)) because.push(first.steps.find((s) => s.met)?.evidence ?? '');
    }
    const answers = eventsOf(record, 'prereq').filter((e) => e.prereqId === p.id).map((e) => ({ questionId: e.questionId, correct: e.correct, phase: e.phase }));
    const verify = answers.filter((a) => a.phase === 'verify');
    const recheck = answers.filter((a) => a.phase === 'recheck').at(-1);
    let status: GapStatus = because.length ? 'suspected' : 'not_suspected';
    if (verify.length) status = verify.some((a) => !a.correct) ? 'confirmed' : verify.length >= p.verify.length ? 'rejected' : 'suspected';
    if (recheck && verify.some((a) => !a.correct)) status = recheck.correct ? 'recovered' : 'persisting';
    return { id: p.id, status, because: because.filter(Boolean), answers };
  });
}

/* ───────────────────────── Thinking Replay ───────────────────────── */

export type ReplayKind = 'explain' | 'revise' | 'clarify' | 'predict' | 'test' | 'help' | 'gap' | 'teach' | 'challenge' | 'transfer' | 'physical' | 'quiz';
export interface ReplayStep {
  kind: ReplayKind;
  at: number;
  title: string;
  body: string;
  /** the learner's own words */
  quote?: string;
  predicted?: string;
  hypothesis?: string;
  real?: string;
  /** the result differed from what their idea predicts */
  broke?: boolean;
  assisted?: boolean;
}

const t = (lang: Lang, ar: string, en: string) => (lang === 'ar' ? ar : en);

export function replaySteps(pack: ConceptPack, record: LearnerRecord, lang: Lang = record.lang): ReplayStep[] {
  const out: ReplayStep[] = [];
  const outcome = (id: string | null) => (id ? pack.outcomes[id]?.[lang] ?? id : '');
  for (const e of record.events) {
    switch (e.type) {
      case 'explain': {
        const kind: ReplayKind = e.phase === 'initial' ? 'explain' : e.phase;
        const title = e.phase === 'initial' ? t(lang, 'الشرح الأول', 'First explanation')
          : e.phase === 'revise' ? t(lang, 'الشرح بعد التجربة', 'Revised explanation') : t(lang, 'توضيح', 'Clarification');
        out.push({ kind, at: e.at, title, body: e.diagnosis.caption || t(lang, 'لسا مش واضحة الفكرة', 'The idea is not clear yet'), quote: e.text });
        break;
      }
      case 'observe': {
        const x = experimentById(pack, e.experimentId);
        const broke = !!e.hypothesis && !outcomeMatches(pack, e.hypothesis, e.real);
        out.push({
          kind: 'test', at: e.at, title: x?.name[lang] ?? t(lang, 'تجربة من تصميم المتعلّم', "The learner's own experiment"),
          body: broke ? t(lang, 'النتيجة غير اللي بتتوقّعه الفكرة.', 'The result differs from what the idea predicts.') : t(lang, 'الفكرة صمدت بهالتجربة.', 'The idea held in this test.'),
          predicted: outcome(e.predicted), hypothesis: outcome(e.hypothesis), real: outcome(e.real), broke, quote: e.note || undefined,
        });
        break;
      }
      case 'assist':
        out.push({
          kind: 'help', at: e.at, assisted: e.level >= ASSIST_LEVEL,
          title: t(lang, 'مساعدة', 'Help received'),
          body: [t(lang, 'سؤال تأمّل', 'A reflection question'), t(lang, 'سؤال يوجّه الانتباه', 'An attention-directing question'), t(lang, 'تلميح مركّز', 'A focused clue'), t(lang, 'شرح موجّه', 'Guided instruction'), t(lang, 'اقتراح طلب المعلّم', 'Suggested asking the teacher')][e.level - 1],
        });
        break;
      case 'remedy': {
        const p = pack.prerequisites.find((x) => x.id === e.prereqId);
        out.push({ kind: 'gap', at: e.at, title: t(lang, 'مراجعة أساس', 'Foundation recovery'), body: p?.remedy.title[lang] ?? e.prereqId });
        break;
      }
      case 'teach':
        out.push({ kind: 'teach', at: e.at, title: t(lang, 'تعليم نور', 'Teaching Noor'), body: e.caught ? t(lang, 'صُحِّحت غلطة نور مع السبب.', "Noor's mistake was corrected with a reason.") : t(lang, 'محاولة تصحيح لنور.', 'An attempt to correct Noor.'), quote: e.text });
        break;
      case 'challenge':
        out.push({ kind: 'challenge', at: e.at, title: t(lang, 'تحدّي نور', "Noor's challenge"), body: e.solved ? t(lang, 'نور فسّرت ظاهرة جديدة من اللي تعلّمته بس.', 'Noor explained a new case using only what she was taught.') : t(lang, 'نور وقفت عند خطوة ما انشرحتلها.', 'Noor stopped at a step she was not taught.') });
        break;
      case 'transfer':
        out.push({ kind: 'transfer', at: e.at, title: t(lang, 'موقف جديد', 'A new situation'), body: e.choiceCorrect === null ? '' : e.choiceCorrect ? t(lang, 'سؤال التحقّق: صح.', 'Check question: correct.') : t(lang, 'سؤال التحقّق: لسا.', 'Check question: not yet.'), quote: e.text || undefined });
        break;
      case 'physical':
        out.push({ kind: 'physical', at: e.at, title: t(lang, 'تجربة حقيقية', 'Real-world test'), body: experimentById(pack, e.experimentId)?.name[lang] ?? '', quote: e.observation });
        break;
      case 'quiz':
        out.push({ kind: 'quiz', at: e.at, title: e.kind === 'pre' ? t(lang, 'أسئلة قبل الدرس', 'Questions before') : t(lang, 'أسئلة بعد الدرس', 'Questions after'), body: `${e.score}/${e.total}` });
        break;
      case 'prereq':
        out.push({ kind: 'gap', at: e.at, title: e.phase === 'verify' ? t(lang, 'سؤال تحقّق من الأساس', 'Foundation check') : t(lang, 'إعادة تحقّق', 'Recheck'), body: e.correct ? t(lang, 'إجابة صحيحة', 'Correct') : t(lang, 'إجابة غير صحيحة', 'Not correct') });
        break;
      case 'predict':
        break; // shown together with its observed result
    }
  }
  return out;
}

export interface Transformation {
  before: string[];
  after: string[];
  /** ideas present at first and gone at the end */
  dropped: string[];
  kept: string[];
  added: string[];
  /** per scientific step: expressed before / at the end */
  steps: { before: boolean; after: boolean }[];
}

/** Which reasoning relationships changed between the first and the latest explanation. */
export function transformation(record: LearnerRecord): Transformation | null {
  const ex = eventsOf(record, 'explain');
  const first = ex.filter((e) => e.phase !== 'revise').at(-1);
  const later = ex.at(-1);
  if (!first || !later || first === later) return null;
  const a = first.diagnosis, b = later.diagnosis;
  const ai = a.ideas.map((i) => i.id), bi = b.ideas.map((i) => i.id);
  return {
    before: a.chain, after: b.chain,
    dropped: ai.filter((i) => !bi.includes(i)), kept: ai.filter((i) => bi.includes(i)), added: bi.filter((i) => !ai.includes(i)),
    steps: [0, 1, 2].map((i) => ({ before: !!a.steps[i]?.met, after: !!b.steps[i]?.met })),
  };
}
