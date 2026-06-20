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
