import { VIEWPORT_K } from "./train_view_constants.ts";

export const BASE_SLIDE_MS = 800;
export const SLIDE_MAX_FACTOR = 3;
export const S_MAX = VIEWPORT_K * 2 + 1;

/** Sub-linear duration: 1 step = base, S_MAX steps = SLIDE_MAX_FACTOR * base. */
export function slideDurationMs(steps: number): number {
  const s = Math.max(1, Math.min(steps, S_MAX));
  const factor = 1 + (s - 1) * (SLIDE_MAX_FACTOR - 1) / (S_MAX - 1);
  return Math.round(BASE_SLIDE_MS * factor);
}

export const JUMP_BASE_MS = 800;
export const JUMP_MAX_MS = 3000;
export const JUMP_MAX_STEPS = 9;

/** Linear: 800ms at 1 step, 3000ms at 9 steps; extrapolates beyond 9. */
export function jumpSlideDurationMs(steps: number): number {
  const s = Math.max(1, steps);
  const slope = (JUMP_MAX_MS - JUMP_BASE_MS) / (JUMP_MAX_STEPS - 1);
  return Math.round(JUMP_BASE_MS + (s - 1) * slope);
}
