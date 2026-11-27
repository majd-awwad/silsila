/**
 * The small prerequisite map between lessons. It says which earlier lesson (or in-lesson activity) a foundation comes
 * from, so a foundation card can say «a short part of the evaporation lesson» and bring the learner back to the same
 * stage of the lesson they came from. It adds no lesson: when no pack exists for the earlier concept, the lesson's own
 * strengthening activity is used.
 */
import type { L } from '../contracts';

export interface FoundationLink {
  /** the lesson that needs the foundation, and the foundation's id in that lesson */
  pack: string;
  prereqId: string;
  /** the lesson the strengthening part comes from; null when it is the lesson's own activity */
  source: string | null;
  /** what the short part shows */
  part: L;
}

export const FOUNDATION_LINKS: FoundationLink[] = [
  {
    pack: 'condensation', prereqId: 'water_vapour', source: 'evaporation',
    part: { ar: 'صحن مي بينشف: وين راحت المي؟ وتمثيل للبخار اللي ما بنشوفه', en: 'A dish of water drying: where did the water go? And a picture of the vapour we cannot see' },
  },
  {
    pack: 'condensation', prereqId: 'water_states', source: null,
    part: { ar: 'محاكاة مكعّب تلج بيذوب: المي بتغيّر شكلها وبتضل مي', en: 'A melting ice cube: water changes form and stays water' },
  },
  {
    pack: 'evaporation', prereqId: 'water_states', source: null,
    part: { ar: 'محاكاة مكعّب تلج بيذوب: المي بتغيّر شكلها وبتضل مي', en: 'A melting ice cube: water changes form and stays water' },
  },
  {
    pack: 'fractions', prereqId: 'equal_sharing', source: null,
    part: { ar: 'القسمة العادلة: الأجزاء لازم تكون قد بعض', en: 'Fair sharing: the parts must be equal' },
  },
  {
    pack: 'fractions', prereqId: 'fraction_meaning', source: null,
    part: { ar: 'معنى البسط والمقام مع بعض', en: 'What the numerator and denominator mean together' },
  },
];

/** The order of ideas a learner may need, by subject (shown on the learning passport). */
export const PREREQUISITE_CHAINS: { subject: 'science' | 'math'; steps: { pack: string | null; label: L }[] }[] = [
  {
    subject: 'science',
    steps: [
      { pack: null, label: { ar: 'حالات المادة', en: 'States of matter' } },
      { pack: 'evaporation', label: { ar: 'التبخّر', en: 'Evaporation' } },
      { pack: 'condensation', label: { ar: 'التكاثف', en: 'Condensation' } },
    ],
  },
  {
    subject: 'math',
    steps: [
      { pack: null, label: { ar: 'القسمة العادلة ومعنى المقام', en: 'Fair sharing and the denominator' } },
      { pack: 'fractions', label: { ar: 'مقارنة الكسور', en: 'Comparing fractions' } },
    ],
  },
];

export const foundationLink = (pack: string, prereqId: string): FoundationLink | null =>
  FOUNDATION_LINKS.find((l) => l.pack === pack && l.prereqId === prereqId) ?? null;
