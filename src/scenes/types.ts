/**
 * 2D scenes: one per concept pack. Pure drawings of a setup and, once revealed, its outcome.
 * They are the SILSILA Lite view and the accessible alternative to 3D, and they run on the projector.
 *
 * Rules:
 *  - `outcome === null` means "not revealed yet": draw ONLY the setup from `cond`, no hint of any result.
 *  - draw the result from `outcome` (never recompute it), so the idea world and the real world use one drawing;
 *  - use an <svg> with a viewBox that scales to its container, on the dark stage:
 *    var(--stage-ink) lines/labels, var(--water), var(--idea) (amber) and var(--real) (mint) accents;
 *  - `role="img"` with an `aria-label` describing the setup and, if revealed, the outcome in `lang`;
 *  - never rely on colour alone; respect reduced motion (CSS animation only, class names are fine).
 */
import type { ReactElement } from 'react';
import type { Conditions, Lang } from '../contracts';

export interface SceneProps {
  cond: Conditions;
  outcome: string | null;
  tone: 'idea' | 'real';
  lang: Lang;
}

export type Scene = (props: SceneProps) => ReactElement;
