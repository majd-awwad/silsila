# Architecture

One idea holds the system together: **the language model only reads language; deterministic code does everything else.**

```
learner words ──► /api/diagnose ──► model extracts evidence ─┐
                      │  (any failure)                       ├─► normalise.ts ─► Diagnosis
                      └──► heuristic.ts (offline rules) ─────┘      quotes verified, status derived,
                                                                    authored Noor line
Diagnosis ──► LearnerRecord (event log) ──► evidence.ts ──► Learning DNA · Thinking Replay · gaps
          └─► records.hypothesesOf ──► planner.ts ──► ranked experiments
experiment + hypothesis ──► pack.kidOutcome / pack.realOutcome ──► the two worlds
many records ──► room.ts (phases, gating) ──► classInsights.ts ──► groups · activity · report
```

## Layers

| Layer | Files | Responsibility |
|---|---|---|
| Contracts | `src/contracts.ts` | zod schemas and types for every boundary |
| Concept packs | `src/packs/*` | vocabulary of ideas, deterministic outcome functions, authored bilingual text, assessment, activities |
| Scenes | `src/scenes/*`, `src/scene/*` | 2D SVG drawing per pack; optional 3D for condensation and evaporation |
| Engine | `src/brain/*` | text and negation, normalisation, offline rules, planner, evidence, classroom rules, insights, lesson drafts |
| AI | `src/brain/server.ts`, `prompts.ts` | provider calls (server only) |
| API | `api/*` | validation, auth, rate limits, storage, fallbacks |
| UI | `src/features/*`, `src/ui/*` | landing, learner, join, teacher, projector, judge |
| Storage | `src/store/records.ts`, `api/_store.ts` | device IndexedDB; memory or Upstash Redis for live rooms |

## Key decisions

| Decision | Why |
|---|---|
| A learner's journey is one **event log** (`LearnerRecord`) | DNA, replay, class insights and reports derive from the same evidence, for solo lessons and live rooms |
| Status is **derived by code** from quoted evidence | a model cannot declare a learner "correct"; unquoted claims are dropped |
| Noor's lines are **authored pack text**; her challenge is composed from the steps the child expressed | structural knowledge boundary instead of keyword leak filters |
| No numeric confidence | uncalibrated numbers would read as probabilities; we report evidence `none / weak / clear` |
| Planner is an **explicit weighted score** with entropy and coverage | explainable, testable, and honest about being a heuristic |
| Classroom rules are **pure functions** (`room.ts`) | the server, the labelled sample room and the tests run identical logic |
| Polling with a version string | works on a laptop and on serverless, survives reconnects, no extra infrastructure |
| 2D scenes first, 3D optional | accuracy, accessibility, low-end devices; mathematics is not forced into 3D |

## Experiment planner

For each feasible experiment (after removing excluded, too long, missing materials, unsupervised-unsafe and under-grade ones):

- predictions: `kidOutcome(hypothesis)` for every hypothesis, and `realOutcome` for the reference model;
- `reach`: share of testable learners whose idea predicts something else than the reference;
- `disagreement`: `H(Y) = −Σ p log₂ p` over predicted outcomes, divided by `log₂(#choices)`;
- `coverage`: share of present ideas the experiment can contradict;
- `objective`: relevance to the chosen objective (or to the concepts the present ideas get wrong);
- `time`: shorter is slightly better.

`score = 0.40·reach + 0.25·coverage + 0.20·disagreement + 0.10·objective + 0.05·time`

If no single experiment reaches every idea, a greedy sequence (at most three, within the time) adds complementary ones. All-correct classes get enrichment; unclear classes get a diagnostic question; nothing feasible is reported as such. The weights are design choices, **not** validated measures of learning.

## Learning evidence rules

`not_assessed → insufficient → partial → demonstrated → transfer`, with `misconception` and `assisted` as separate states.
`demonstrated` needs two independent kinds of unassisted support; help from level 3 (focused clue) marks later evidence as assisted; a later statement against a concept overrides earlier support. Retention is never claimed.

## Adding a concept pack

1. Create `src/packs/<id>.ts` following `src/packs/types.ts` and register it in `src/packs/index.ts`.
2. Add `src/scenes/<id>.tsx` and register it in `src/scenes/index.ts`.
3. Add the topic pattern in `src/brain/lesson.ts`.
4. Run `npx vitest run tests/packs.test.ts` (invariants: reference model never broken, every other idea breakable, no answer leakage, complete bilingual text).
5. Write `evals/<id>.json` (dev + holdout, by someone who has not seen the rules) and run `npm run eval`.
