import type { TrainStep } from "../interfaces/realtime_service.ts";
import { CENTER_SLOT } from "./train_view_constants.ts";

/** Index of a post step in the tape, or null if absent / not forward of center. */
export function findPostInTape(tape: TrainStep[], submissionId: string): number | null {
  for (let i = 0; i < tape.length; i++) {
    const step = tape[i];
    if (step?.kind === "post" && step.submissionId === submissionId) return i;
  }
  return null;
}

/** Forward slot distance from center to target (in-tape jump). */
export function forwardSlotSteps(tape: TrainStep[], targetSlot: number): number {
  return Math.max(0, targetSlot - CENTER_SLOT);
}

/** Pick `count` evenly spaced windows from a longer force-generate sequence. */
export function subsampleStepWindows(windows: TrainStep[][], count: number): TrainStep[][] {
  if (count <= 0) return [];
  if (windows.length <= count) return windows;
  const out: TrainStep[][] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.min(
      windows.length - 1,
      Math.floor(((i + 1) * windows.length) / count) - 1,
    );
    out.push(windows[Math.max(0, idx)]!);
  }
  return out;
}
