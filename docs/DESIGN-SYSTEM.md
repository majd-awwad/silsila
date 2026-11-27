# SILSILA design system: "observatory notebook"

Source of truth for tokens and component classes: [`src/styles.css`](../src/styles.css).
Shared components: [`src/ui/`](../src/ui).

## How it was chosen

Generated with the UI/UX Pro Max skill (`search.py`, run on 27 Nov 2026) and then judged against the brief.

| Query | What the tool suggested | What we took |
|---|---|---|
| `children science discovery education platform arabic --design-system` | Claymorphism, learning blue + yellow + pink, Baloo 2 / Comic Neue | Checklist only (contrast 4.5:1, focus states, reduced motion, SVG icons). Rejected the fonts (no Arabic) and the pastel toy style. |
| `education science teal --domain color` | LMS palette: teal + amber + grade green | Adopted as the base, deepened for projector contrast. |
| `arabic readable education --domain typography` | Noto Naskh / Noto Sans Arabic | Kept the project's Readex Pro + IBM Plex Sans Arabic: both cover Arabic and Latin with one voice. |
| `--domain ux` (touch, motion, focus) | 44 px targets, 8 px gaps, visible focus, reduced motion | Adopted. |

Three directions were compared:

| Direction | Learning use | Arabic readability | Projector | Distinctiveness | Verdict |
|---|---|---|---|---|---|
| Night lab (previous M1: navy glass, neon cyan) | Good for 3D | Thin text on blur | Washes out | Generic "AI dark" | Rejected as page style |
| Pastel clay (tool default) | Playful | Rounded Latin display fonts | Low contrast | Common in kids' apps | Rejected |
| **Observatory notebook**: ivory pages + deep-teal experiment stage | Reading on paper, focus on the stage | High | High | Chain motif + two worlds | **Chosen** |

## Meaning of colour

| Token | Hex | Meaning |
|---|---|---|
| `--brand` | `#0D5C63` | product and actions |
| `--idea` / `--idea-ink` | `#F0A93B` / `#855100` | the learner's idea |
| `--real` / `--real-ink` | `#43C59E` / `#0E6B4F` | reference model, discovery |
| `--probe` / `--probe-ink` | `#E2755A` / `#9C3A22` | a link to investigate (never a verdict on a child) |
| `--ivory` / `--paper` | `#FBF7EE` / `#FFFFFF` | reading surfaces |
| `--stage` | `#0B2A31` | experiments |

Colour never carries meaning alone: every state also has a word, shape or icon (for example `.chain > li.is-probe` is dashed and shows «?»; Learning DNA cells show a shape and a label).

## Type, space, shape

- Display: Readex Pro. Body: IBM Plex Sans Arabic. Body 16 px, line height 1.65.
- Numbers are localised (`useI18n().n`): Arabic-Indic digits in Arabic.
- Radius 10 / 16 / 24. Spacing in 4 px steps. Content width 1240 px.
- Logical CSS only (`inset-inline-start`, `padding-inline`), so RTL and LTR need no duplicates.

## The chain

The name is the interaction metaphor: reasoning is drawn as linked steps (`.chain`), journey progress as links (`.links`), and the brand mark is two rings, one idea (amber) and one discovery (mint).

## Noor

One SVG character, seven moods (`curious, listening, thinking, surprised, encouraging, discovering, celebrating`) in [`src/ui/Noor.tsx`](../src/ui/Noor.tsx). Motion is subtle and stops under `prefers-reduced-motion`. No external or licensed assets.

## Components

`.btn` (primary, warm, secondary, ghost, danger; lg, sm, icon) · `.card` / `.card-flat` / `.card-tint` · `.stage` · `.chip` · `.notice` · `.choice` · `.field` / `.input` · `.seg` · `.bar-row` · `.table` · `.dna` · `.worlds` / `.world` · `.empty` · `.sample-banner` (sample data is always striped and labelled).

## Motion

150–600 ms, ease-out, only to show change (a result appearing, groups moving, replay steps). Nothing loops except Noor's blink and loading indicators.

## Accessibility notes

Skip link, visible focus (3 px), 44 px primary targets, labelled controls, `aria-live` for Noor and results, 2D scenes as the alternative to 3D, high-contrast tokens under `html[data-contrast="high"]`, print styles for reports. This has not been audited or certified against WCAG.
