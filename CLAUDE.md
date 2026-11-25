# سلسلة (Silsila) — rules for Claude Code and Codex

**Make Thinking Visible.** A child (grade 3–5) explains a science phenomenon in Palestinian Arabic. The AI turns
their words into a model of THEIR idea and their causal chain; a deterministic engine computes what that idea
predicts in any experiment; the child sets the variables and tests their idea in two worlds (their idea vs reality);
then teaches Noor (a robot) who makes a planted mistake, watches Noor explain a new phenomenon using only what
they taught her, and explains another new phenomenon on their own (transfer). The teacher sees a live class map
and gets a 15-minute activity built from the class's actual wrong ideas.

Hackathon: AI Educathon 2026, An-Najah, Saturday 28/11/2026. Plan + review: «سلسلة — خطة التنفيذ» doc.

## Commands
- `npm run dev` — whole app on http://localhost:5173 including `/api/*`. Add `-- --host` so phones on the same
  Wi-Fi can join the live class.
- `npm run check` — types + tests + build. Must pass before anything merges to `main`.
- `npm run eval` / `npm run eval:ai` — diagnosis metrics per pack (fallback / Claude). Writes `evals/reports/*.json`.
- Teacher: `/#/teacher`. Judge quick mode: `/?quick=1&pack=condensation`. Lite 2D scene: `/?q=low` or the button.

## Architecture (the one idea to keep)
The LLM only **interprets language** (child's words → ChildModel + causal chain + Noor's line).
Everything about the world is **deterministic code**: `src/brain/world.ts` + each pack's `kidOutcome/realOutcome`.
The best experiment is chosen in code. So: no hallucinated physics, everything testable, and the app runs without AI.

## Map (one owner per area — touch another area only through its contract)
| Area | Owner | Files |
|---|---|---|
| Brain | person 1 | `api/`, `src/brain/`, `evals/`, `scripts/` |
| Scene | person 2 | `src/scene/` (MirrorEngine knows nothing about React; LiteScene = 2D) |
| Experience | person 3 | `src/flow/`, `src/screens/` (child), `src/components/`, `src/voice/`, `src/styles.css` |
| Teacher & field | person 4 | `src/store/`, `src/screens/Teacher.tsx`, `src/brain/classInsights.ts`, pilot data |
| Research & pitch | person 5 | `src/packs/*` content review, eval labels, pitch |
| Shared | everyone, by agreement | `src/contracts.ts`, `src/packs/types.ts` |

## Hard rules
1. `src/contracts.ts` and `src/packs/types.ts` are the source of truth. Change them only after telling the team.
2. Nothing from the model reaches the screen without `src/brain/normalise.ts`.
3. Noor never gives the answer before the child does (`guardNoor`, `pack.answerWords`); evals must show 0 leaks.
4. The API key lives only in Vercel env / `.env.local`. `src/brain/server.ts` is imported only by `api/` and `scripts/`.
5. Every AI path has an offline fallback with the same contract (`src/brain/heuristic.ts`, pack activities).
6. All child-facing text is Palestinian Arabic and lives in the pack, not in components.
7. Children's privacy: pseudonyms only, no audio stored, sessions on the device; the live class gets only a
   one-line idea summary.
8. RTL everywhere; logical CSS (`inset-inline-start`, `ms-`, `me-`). Arabic-Indic digits: `toLocaleString('ar-EG')`.
9. Keep `prefers-reduced-motion` working.
10. Evals: never tune the fallback on `holdout` sentences. If you use one, move it to `dev`.

## Adding a concept pack
1. Copy `src/packs/evaporation.ts`, fill every field (ideas with `story` + `wrongStep`, variables, presets,
   `kidOutcome`, `realOutcome`, quizzes, challenge, transfer, activities). Register it in `src/packs/index.ts`.
2. The tests in `tests/brain.test.ts` check the invariants automatically: the scientific model survives every
   preset, and every wrong idea has at least one experiment that breaks it.
3. If it needs new visuals, add a behaviour to `MirrorEngine` (see `stepEvapKid`) and a case in `LiteScene`.
4. Write `evals/<pack>.json` (dev + holdout) and run `npm run eval` and `npm run eval:ai`.

## Status (25/11)
M1 done: two packs (condensation, evaporation), counterfactual lab, causal chains, clarify ladder, Noor's
challenge, transfer, Learning DNA, live class with QR, AI activity plans, Lite 2D scene, 104 eval sentences.
Not yet verified: real Claude responses (no key in the build environment), real-GPU look, speech on tablets,
live class on Vercel (needs Upstash; works on one laptop without it).
