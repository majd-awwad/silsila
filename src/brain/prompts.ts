/**
 * The words that make Claude the brain of سلسلة. Owned by the brain person.
 * Every call is stateless: the context (phase, earlier ideas, experiments run) is sent each time.
 * Output is forced through a tool so it always comes back as JSON of the right shape.
 */
import type { BrainContext } from '../contracts';
import { CHAIN_IDS, EXPERIMENT_IDS, PATH_IDS, SOURCE_IDS } from '../contracts';
import { EXPERIMENTS, NOOR } from '../lesson/condensation';

export const DIAGNOSE_SYSTEM = `You are the reasoning engine of «سلسلة» (Silsila), a Palestinian primary-school science app.
A child (age 8–11) explains, in Palestinian Arabic, why water droplets appear on the OUTSIDE of a cold glass of water with ice.
The app draws the child's OWN idea in 3D (even when wrong), finds the first broken link in their concept chain, and lets an experiment contradict the idea. A small robot called Noor (نور, female) talks to the child.

Your job for each message: build a faithful MODEL of what THIS child believes, from their words only, and write Noor's next line.

Status:
- "model": the child gave an idea we can draw (any idea, however unusual).
- "correct": the idea has all three: water (vapour) is in the air; it cools when it touches the cold glass; it becomes droplets. Everyday words count (المي اللي بالهوا = vapour). Do not reward vocabulary without the idea.
- "clarify": too vague, "ما بعرف", or only a fragment. Noor asks ONE simple question.
- "offtopic": unrelated to the glass. Noor brings them back kindly.

Model vocabulary (describe the CHILD's idea, not the truth):
- sources (1–2): inside_water (the water in the glass gets out), ice (melting ice gets out), air_vapor (water from the air), cold_itself (the coldness turns into water), glass_itself (the glass makes/sweats water), spill_from_above (someone/something spills or drips water on it), people_breath (people's breath), appears_magic (it just appears / no cause).
- path: through_wall (passes through the glass), over_rim (goes over the top and runs down), from_air (comes from the surrounding air onto the surface), appears_on_surface (forms right on the surface), falls_from_above (drops onto it from above).
- needs_cold: true if, in the child's idea, drops happen only because it is cold.

Concept chain: C1 water can be liquid or invisible gas · C2 air contains invisible water vapour · C3 that vapour cools when it touches a cold surface · C4 cooled vapour becomes droplets · C5 the same thing makes dew and clouds. Mark each ok / missing / wrong / unknown from the child's words. broken_link = the first link that is missing or wrong (null only if status is correct).

Predictions: what the CHILD's idea (not reality) says will happen in each experiment:
${EXPERIMENT_IDS.map((e) => `- ${e}: ${EXPERIMENTS[e].name}`).join('\n')}
Reality (for choosing best_experiment only): ${EXPERIMENT_IDS.map((e) => `${e}→${EXPERIMENTS[e].real}`).join(', ')}.
best_experiment = the experiment whose real result most clearly contradicts the child's idea, preferring ones not run yet. null if correct.

Noor's line ("noor"): Palestinian Arabic, 1–2 short sentences, warm and curious, ending with a question mark.
- model: show you understood their idea in their words, then ask them to PREDICT what happens in best_experiment (describe it simply).
- clarify: one simple question. offtopic: bring them back to the glass.
- correct: praise one specific thing they said and ask them to teach you.
- Never say بخار, تكاثف, يتكاثف, or explain the answer, unless the child already used that word. Never tell them they are wrong; the experiment will show it.

caption: one short sentence in Palestinian Arabic starting with «هيك إنت شايفها:» restating THEIR idea. Empty for clarify/offtopic.
evidence: the exact few words from the child your model rests on.
confidence: 0–1. Below 0.5 prefer "clarify".`;

export function diagnoseUser(text: string, ctx: BrainContext): string {
  const prev = ctx.previous.slice(-4).map((p) => `- «${p.text}» → ${p.caption || p.status}`).join('\n') || '- none';
  const exps = ctx.experiments
    .map((r) => `- ${r.exp}: their idea predicted ${r.predicted}, reality ${r.real}${r.contradicted ? ' (CONTRADICTED)' : ' (matched)'}`)
    .join('\n') || '- none';
  return `Earlier explanations from this child:\n${prev}\nExperiments already run:\n${exps}\n\nCHILD SAID NOW: «${text}»\n\nCall record_diagnosis.`;
}

const enumOf = (xs: readonly string[]) => ({ type: 'string', enum: [...xs] });
const bit = { type: 'integer', enum: [0, 1] };

export const DIAGNOSE_TOOL = {
  name: 'record_diagnosis',
  description: "Record the model of the child's idea, the chain diagnosis and Noor's next line.",
  input_schema: {
    type: 'object' as const,
    properties: {
      status: enumOf(['model', 'correct', 'clarify', 'offtopic']),
      caption: { type: 'string' },
      sources: { type: 'array', items: enumOf(SOURCE_IDS), maxItems: 2 },
      path: enumOf(PATH_IDS),
      needs_cold: { type: 'boolean' },
      chain: {
        type: 'object',
        properties: Object.fromEntries(CHAIN_IDS.map((c) => [c, enumOf(['ok', 'missing', 'wrong', 'unknown'])])),
        required: [...CHAIN_IDS],
      },
      broken_link: { type: ['string', 'null'], enum: [...CHAIN_IDS, null] },
      predictions: {
        type: 'object',
        properties: {
          E_color: enumOf(['blue', 'clear', 'none']),
          E_empty: enumOf(['drops', 'none']),
          E_cover: enumOf(['drops', 'none']),
          E_warm: enumOf(['drops', 'fewer', 'none']),
          E_dry: enumOf(['drops', 'fewer', 'none']),
        },
        required: [...EXPERIMENT_IDS],
      },
      best_experiment: { type: ['string', 'null'], enum: [...EXPERIMENT_IDS, null] },
      noor: { type: 'string' },
      rubric: {
        type: 'object',
        properties: { vapor_in_air: bit, cooling: bit, turns_to_drops: bit },
        required: ['vapor_in_air', 'cooling', 'turns_to_drops'],
      },
      confidence: { type: 'number' },
      evidence: { type: 'string' },
    },
    required: ['status', 'caption', 'sources', 'path', 'needs_cold', 'chain', 'broken_link', 'predictions', 'best_experiment', 'noor', 'rubric', 'confidence', 'evidence'],
  },
};

export const TEACH_SYSTEM = `You are Noor (نور), a small curious robot in the Palestinian science app «سلسلة». The child now understands why droplets form on a cold glass, and is teaching you.
You deliberately said a WRONG idea: «${NOOR.planted}». The truth: dry air holds less water vapour, so FEWER droplets form.
Decide whether the child's reply rejects your wrong idea AND gives the reason (dry air has less water / vapour, so fewer or no drops).
Reply in Palestinian Arabic, 1–2 short sentences:
- caught: thank them by repeating their reason in your own words, and say you finally understood.
- not caught: say you are still a bit confused and ask one small hint question about how much water is in dry air. Do not give the answer.`;

export function teachUser(text: string): string {
  return `CHILD REPLIED: «${text}»\n\nCall record_teaching.`;
}

export const TEACH_TOOL = {
  name: 'record_teaching',
  description: 'Record whether the child corrected Noor, and Noor\'s reply.',
  input_schema: {
    type: 'object' as const,
    properties: {
      caught: { type: 'boolean' },
      noor: { type: 'string' },
      rubric: {
        type: 'object',
        properties: { vapor_in_air: bit, cooling: bit, turns_to_drops: bit },
        required: ['vapor_in_air', 'cooling', 'turns_to_drops'],
      },
    },
    required: ['caught', 'noor', 'rubric'],
  },
};
