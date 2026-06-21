import type { TrainStep } from "../interfaces/realtime_service.ts";
import { CENTER_SLOT } from "./train_view_constants.ts";

/** Index of the first post step for a submission in the tape. */
export function findPostInTape(tape: TrainStep[], submissionId: string): number | null {
  for (let i = 0; i < tape.length; i++) {
    const step = tape[i];
    if (step?.kind === "post" && step.submissionId === submissionId) return i;
  }
  return null;
}

/** Rightmost post step forward of center (skips preview at/before center when sequential exists). */
export function findForwardPostInTape(tape: TrainStep[], submissionId: string): number | null {
  let found: number | null = null;
  for (let i = 0; i < tape.length; i++) {
    const step = tape[i];
    if (step?.kind === "post" && step.submissionId === submissionId && i > CENTER_SLOT) {
      found = i;
    }
  }
  return found;
}

/** Rightmost non-ephemeral post forward of center (canonical sequential instance). */
export function findForwardCanonicalPostInTape(
  tape: TrainStep[],
  submissionId: string,
): number | null {
  let found: number | null = null;
  for (let i = 0; i < tape.length; i++) {
    const step = tape[i];
    if (
      step?.kind === "post" &&
      step.submissionId === submissionId &&
      i > CENTER_SLOT &&
      !step.ephemeral
    ) {
      found = i;
    }
  }
  return found;
}

/** True when an ephemeral preview of the submission is forward of center. */
export function hasForwardEphemeralPostInTape(
  tape: TrainStep[],
  submissionId: string,
): boolean {
  for (let i = 0; i < tape.length; i++) {
    const step = tape[i];
    if (
      i > CENTER_SLOT &&
      step?.kind === "post" &&
      step.submissionId === submissionId &&
      step.ephemeral
    ) {
      return true;
    }
  }
  return false;
}

/** Any ephemeral step on the path from center to targetSlot (exclusive center, inclusive target). */
export function hasEphemeralOnPathToSlot(tape: TrainStep[], targetSlot: number): boolean {
  for (let i = CENTER_SLOT + 1; i <= targetSlot; i++) {
    if (tape[i]?.ephemeral) return true;
  }
  return false;
}

/** Forward slot distance from center to target (in-tape jump). */
export function forwardSlotSteps(tape: TrainStep[], targetSlot: number): number {
  return Math.max(0, targetSlot - CENTER_SLOT);
}

/** Build a linear left-to-right tape from an initial window plus post-shift snapshots. */
export function linearizeShiftSequence(
  startTape: TrainStep[],
  shiftSnapshots: TrainStep[][],
): TrainStep[] {
  const seen = new Set(startTape.map((step) => step.seq));
  const linear = [...startTape];
  for (const snapshot of shiftSnapshots) {
    const right = snapshot[snapshot.length - 1];
    if (right && !seen.has(right.seq)) {
      seen.add(right.seq);
      linear.push(right);
    }
  }
  return linear;
}

/** Append animationWindow steps not already in current tape (right-buffer extension). */
export function mergeRightBufferSteps(
  current: TrainStep[],
  animation: TrainStep[],
): TrainStep[] {
  const seen = new Set(current.map((step) => step.seq));
  const merged = [...current];
  for (const step of animation) {
    if (seen.has(step.seq)) continue;
    seen.add(step.seq);
    merged.push(step);
  }
  return merged;
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
