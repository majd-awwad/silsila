# سلسلة (Silsila) — rules for Claude Code and Codex

A child (grade 3–5) explains in Palestinian Arabic why drops appear on a cold glass. The AI builds a model of the
child's OWN idea, the 3D mirror draws it, an experiment shown in two worlds (the child's idea vs reality)
breaks it, the child re-explains, then teaches Noor (a robot) who makes a planted mistake.
Pre/post tests measure learning; a teacher screen summarises the class.

Hackathon: AI Educathon 2026, An-Najah, Saturday 28/11/2026. Plan: «سلسلة — خطة التنفيذ» doc.

## Commands
- `npm run dev` — the whole app on http://localhost:5173, including `/api/*` (vite.config.ts serves them).
- `npm run check` — types + tests + build. Must pass before anything merges to `main`.
- `npm run eval` — scores the offline fallback on `evals/utterances.json`.
- `npm run eval:ai` — scores Claude (needs `ANTHROPIC_API_KEY` in `.env.local`).
- Teacher screen: `/#/teacher`. Low-GPU mode: `/?q=low`.

## Map (one owner per area — touch another area only through its contract)
| Area | Owner | Files |
|---|---|---|
| Brain | person 1 | `api/`, `src/brain/`, `evals/`, `scripts/` |
| Scene | person 2 | `src/scene/` (MirrorEngine knows nothing about React) |
| Experience | person 3 | `src/flow/`, `src/screens/`, `src/voice/`, `src/styles.css` |
| Teacher & field | person 4 | `src/store/`, `src/screens/Teacher.tsx`, pilot data |
| Shared | everyone, by agreement | `src/contracts.ts`, `src/lesson/condensation.ts` |

## Hard rules
1. `src/contracts.ts` is the source of truth. Change it only after telling the team; update every user in the same PR.
2. Nothing from the model reaches the screen without `normaliseDiagnosis` / `normaliseTeach` (`src/brain/normalise.ts`).
3. Noor never gives the answer before the child does. `guardNoor` enforces it; `npm run eval` must show 0 leaks.
4. The API key lives only in Vercel env / `.env.local`. Never in the repo, never in browser code.
   `src/brain/server.ts` is imported only by `api/` and `scripts/`.
5. Every AI path has the offline fallback (`src/brain/heuristic.ts`) with the same contract. The demo must never stop.
6. All child-facing text is Palestinian Arabic and lives in `src/lesson/condensation.ts`, not in components.
7. Children's privacy: pseudonyms only, no audio stored, data stays on the device (IndexedDB).
8. RTL everywhere (`dir="rtl"`); use logical CSS (`inset-inline-start`, `ms-`, `me-`), never left/right for layout.
9. Arabic-Indic digits in UI: `n.toLocaleString('ar-EG')`.
10. Keep `prefers-reduced-motion` working.

## Adding a misconception
1. If it needs a new visual, add a `Source` or `Path` id in `contracts.ts`, a label in `condensation.ts`,
   an emitter in `MirrorEngine.kidBehaviours/stepKid`, and its line in `DIAGNOSE_SYSTEM`.
2. Add real child sentences for it to `evals/utterances.json`. Run `npm run eval` and `npm run eval:ai`.

## Status (22/11)
M0 done: full journey works end to end in fallback mode; 11 tests pass; fallback scores 95% status /
94% source / 97% broken link on 40 sentences written by us (NOT real children yet: collect real ones in M5).
Not yet verified: real Claude responses (no key in the build environment), real-GPU look of the glass, speech on tablets.
