# سلسلة (Silsila) — rules for Claude Code and Codex

**Make Thinking Visible.** A child (grade 3–5) explains a science phenomenon in Palestinian Arabic. The AI turns
their words into a model of THEIR idea and their causal chain; a deterministic engine computes what that idea
predicts in any experiment; the child sets the variables and tests their idea in two worlds (their idea vs reality);
then teaches Noor (a robot) who makes a planted mistake, watches Noor explain a new phenomenon using only what
they taught her, and explains another new phenomenon on their own (transfer). The teacher sees a live class map
and gets a 15-minute activity built from the class's actual wrong ideas.

Hackathon: AI Educathon 2026, An-Najah + AUF, Saturday 28/11/2026. Read `docs/COMPETITION.md` first: official
agenda, the scoring rubric (what the judges weigh), the team, and every decision taken so far.
Plan + review: «سلسلة — خطة التنفيذ» doc.

## Commands
- `npm run dev` — whole app on http://localhost:5173 including `/api/*`. Add `-- --host` so phones on the same
  Wi-Fi can join the live class.
- `npm run check` — types + tests + build. Must pass before anything merges to `main`.
- `npm run eval` — diagnosis metrics per pack with the offline fallback (no key). `npm run eval:ai` — same with the
  configured model. `npm run eval:models -- --models=a,b,c` — bake-off between OpenRouter models (accuracy, leaks,
  latency, cost per 1000 diagnoses); this table is our answer to "justify the API". Reports go to `evals/reports/`.
- Child view (default) vs judge view: `/?judge=1` (remembered on the device; `?judge=0` turns it off).
  Judge quick mode: `/?judge=1&quick=1&pack=condensation`. Teacher: `/#/teacher`. Lite 2D scene: `/?q=low`.

## Architecture (the one idea to keep)
The LLM only **interprets language** (child's words → ChildModel + causal chain + Noor's line).
Everything about the world is **deterministic code**: `src/brain/world.ts` + each pack's `kidOutcome/realOutcome`.
The best experiment is chosen in code. So: no hallucinated physics, everything testable, and the app runs without AI.
The model is a config value (`LLM_MODEL`, OpenRouter by default, `src/brain/server.ts`); voice (`STT_MODEL`, `TTS_MODEL`)
is optional cloud via `/api/stt` and `/api/tts`, with the browser's own voice as the default.

## Team (4 students, An-Najah computer engineering; hackathon teams are 2–4)
Majd, Israa, Yaman, Ru'a. Areas below are roles, not names; assign them on 26/11. Research + pitch is shared by all four.

## Map (one owner per area — touch another area only through its contract)
| Area | Files |
|---|---|
| Brain (AI, evals, model choice) | `api/`, `src/brain/`, `evals/`, `scripts/` |
| Scene (3D + Lite 2D) | `src/scene/` (MirrorEngine knows nothing about React) |
| Experience (child UX, voice) | `src/flow/`, `src/screens/` (child), `src/components/`, `src/voice/`, `src/styles.css`, `src/mode.ts` |
| Teacher + content + pitch | `src/store/`, `src/screens/Teacher.tsx`, `src/brain/classInsights.ts`, `src/packs/*` review, `docs/` |
| Shared, by agreement | `src/contracts.ts`, `src/packs/types.ts` |

## Hard rules
1. `src/contracts.ts` and `src/packs/types.ts` are the source of truth. Change them only after telling the team.
2. Nothing from the model reaches the screen without `src/brain/normalise.ts`.
3. Noor never gives the answer before the child does (`guardNoor`, `pack.answerWords`); evals must show 0 leaks.
   **One deliberate exception (decision of 25/11):** after `STUCK_AFTER` (3) tries that change nothing, Noor explains it
   gently (`pack.noor.reveal`, fixed pack text, never model-written), the child retells it in their own words, and the
   session is flagged `scaffolded` so the teacher sees "needs follow-up". A child must never give up on the lesson.
4. The API key lives only in Vercel env / `.env.local`. `src/brain/server.ts` is imported only by `api/` and `scripts/`.
5. Every AI path has an offline fallback with the same contract (`src/brain/heuristic.ts`, pack activities).
6. All child-facing text is Palestinian Arabic and lives in the pack, not in components.
7. Children's privacy: pseudonyms only, no audio stored, sessions on the device; the live class gets only a
   one-line idea summary. Cloud voice sends the child's audio for transcription only when `STT_MODEL` is set; say so.
8. RTL everywhere; logical CSS (`inset-inline-start`, `ms-`, `me-`). Arabic-Indic digits: `toLocaleString('ar-EG')`.
9. Keep `prefers-reduced-motion` working.
10. Evals: never tune the fallback on `holdout` sentences. If you use one, move it to `dev`.
11. Child view never shows the scientific chain, the engine table or the best-experiment hint while the child is still
    explaining (`src/mode.ts`, tested in `tests/stuck.test.ts`). Judge view shows everything.
12. Never claim what we did not measure: diagnosis accuracy is measured; learning gains with children are not.

## Adding a concept pack
1. Copy `src/packs/evaporation.ts`, fill every field (ideas with `story` + `wrongStep`, variables, presets,
   `kidOutcome`, `realOutcome`, quizzes, challenge, transfer, activities, `noor.reveal`). Register it in `src/packs/index.ts`.
2. The tests in `tests/brain.test.ts` check the invariants automatically: the scientific model survives every
   preset, and every wrong idea has at least one experiment that breaks it.
3. If it needs new visuals, add a behaviour to `MirrorEngine` (see `stepEvapKid`) and a case in `LiteScene`.
4. Write `evals/<pack>.json` (dev + holdout) and run `npm run eval` and `npm run eval:ai`.
5. Lessons must come from the Palestinian science curriculum (grades 3–5); fill `pack.curriculum` (book, unit, lesson, pages) from the printed book, never from memory. Both packs are checked (grade 3 part 1, pp. 74–76).

## Status (25/11, evening)
M1.2 (26/11): curriculum anchors verified against the printed book; teacher intervention groups (`interventionGroups`); Thinking Replay (`src/brain/replay.ts`). 47 tests.
M1 done: two packs (condensation, evaporation), counterfactual lab, causal chains, clarify ladder, Noor's
challenge, transfer, Learning DNA, live class with QR, AI activity plans, Lite 2D scene, 104 eval sentences.
M1.1 (this session): child/judge views, Noor explains after 3 stuck tries (+ teacher flag), OpenRouter provider with
`eval:models` bake-off, optional cloud STT/TTS endpoints, voice on by default for children, 35 tests.
Verified 26/11 with a real key: diagnosis (gemini-3.8-flash, bake-off in `docs/MODEL-CHOICE.md`), cloud TTS (ElevenLabs
jessica) and STT through the app. Not yet verified: a human voice through the mic, real-GPU look, Arabic speech on the demo laptop, live class on Vercel (needs Upstash; works on one laptop without it).
