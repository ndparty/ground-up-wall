import type { TrainStep } from "../interfaces/realtime_service.ts";
import { computeJumpAnimationPath, computeJumpStepCount, forwardDistance } from "./train_view.ts";
import {
  CENTER_SLOT,
  LEFT_RENDER,
  RIGHT_RENDER,
} from "./train_view_constants.ts";

export interface AppendOnlyJumpResult {
  animationWindow: TrainStep[];
  committedTape: TrainStep[];
  stepsToTarget: number;
}

export interface AppendOnlyJumpDeps {
  emitNextStep: () => TrainStep;
  createCanonicalPost: (cabin: number) => TrainStep;
}

/** Canonical cabin numbers (c1..cN) on tape left→right; ephemerals ignored. */
export function canonicalCabinNumbersOnTape(
  tape: TrainStep[],
  cabinIds: string[],
): number[] {
  const nums: number[] = [];
  for (const step of tape) {
    if (step.kind === "post" && !step.ephemeral && step.submissionId) {
      const pos = cabinIds.indexOf(step.submissionId);
      if (pos >= 0) nums.push(pos + 1);
    }
  }
  return nums;
}

/** End-state neighborhood around target: target−K .. target+K+preload (7 cabins). */
export function cabinsAroundTargetWithBuffer(targetCabin: number, len: number): number[] {
  const result: number[] = [];
  const centerIdx = targetCabin - 1;
  for (let off = -LEFT_RENDER; off <= RIGHT_RENDER; off++) {
    result.push(((centerIdx + off + len) % len) + 1);
  }
  return result;
}

/** Longest suffix of canonical ids on tape matching prefix of end-state list. */
export function canonicalSuffixPrefixOverlap(
  tape: TrainStep[],
  endStateCabins: number[],
  cabinIds: string[],
): number {
  const onTape = canonicalCabinNumbersOnTape(tape, cabinIds);
  let maxOverlap = 0;
  for (let n = 1; n <= Math.min(onTape.length, endStateCabins.length); n++) {
    const suffix = onTape.slice(-n);
    const prefix = endStateCabins.slice(0, n);
    if (suffix.every((c, i) => c === prefix[i])) maxOverlap = n;
  }
  return maxOverlap;
}

/** True when a non-ephemeral post for the submission already exists in linear tape. */
export function hasCanonicalPostInLinear(
  linear: TrainStep[],
  submissionId: string,
): boolean {
  return linear.some(
    (s) => s.kind === "post" && s.submissionId === submissionId && !s.ephemeral,
  );
}

/** Assemble the 7-slot committed window centered on canonical target. */
export function buildCommittedWindow(
  linear: TrainStep[],
  targetCabin: number,
  cabinIds: string[],
  createCanonicalPost: (cabin: number) => TrainStep,
): TrainStep[] {
  const len = cabinIds.length;
  const targetId = cabinIds[targetCabin - 1]!;
  const targetIdx = findRightmostCanonicalTargetIdx(linear, targetId);

  if (
    targetIdx !== null &&
    targetIdx >= LEFT_RENDER &&
    hasJumpBufferAtTarget(linear, targetIdx)
  ) {
    return linear.slice(targetIdx - LEFT_RENDER, targetIdx + RIGHT_RENDER + 1);
  }

  const neighborhood = cabinsAroundTargetWithBuffer(targetCabin, len);
  return neighborhood.map((cabin) => {
    const id = cabinIds[cabin - 1]!;
    const existing = linear.findLast(
      (s) => s.kind === "post" && s.submissionId === id && !s.ephemeral,
    );
    return existing ?? createCanonicalPost(cabin);
  });
}

/** Short jump: fill preload slots right of target only. */
export function appendRightBufferOnly(
  linear: TrainStep[],
  targetIdx: number,
  emitNextStep: () => TrainStep,
): TrainStep[] {
  const out = [...linear];
  while (!hasJumpBufferAtTarget(out, targetIdx)) {
    out.push(emitNextStep());
  }
  return out;
}

/** Long jump: add collapsed-path canonical visits not already on tape. */
export function appendMissingPathVisits(
  linear: TrainStep[],
  pathCabins: number[],
  cabinIds: string[],
  createCanonicalPost: (cabin: number) => TrainStep,
): TrainStep[] {
  const out = [...linear];
  for (const cabin of pathCabins) {
    const id = cabinIds[cabin - 1]!;
    if (!hasCanonicalPostInLinear(out, id)) {
      out.push(createCanonicalPost(cabin));
    }
  }
  return out;
}

/** Long jump: append end-state cabins from overlap cut point. */
export function appendEndStateTail(
  linear: TrainStep[],
  targetCabin: number,
  cabinIds: string[],
  createCanonicalPost: (cabin: number) => TrainStep,
): TrainStep[] {
  const len = cabinIds.length;
  const endState = cabinsAroundTargetWithBuffer(targetCabin, len);
  const overlap = canonicalSuffixPrefixOverlap(linear, endState, cabinIds);
  const out = [...linear];
  for (let i = overlap; i < endState.length; i++) {
    const cabin = endState[i]!;
    const id = cabinIds[cabin - 1]!;
    if (!hasCanonicalPostInLinear(out, id)) {
      out.push(createCanonicalPost(cabin));
    }
  }
  return out;
}

/** On-tape-left long jump: append full end-state block as new posts at tail. */
export function appendFullEndStateBlock(
  linear: TrainStep[],
  targetCabin: number,
  len: number,
  createCanonicalPost: (cabin: number) => TrainStep,
): TrainStep[] {
  const endState = cabinsAroundTargetWithBuffer(targetCabin, len);
  const out = [...linear];
  for (const cabin of endState) {
    out.push(createCanonicalPost(cabin));
  }
  return out;
}

/** Rightmost canonical (non-ephemeral) instance of the target submission in a linear tape. */
export function findRightmostCanonicalTargetIdx(
  linear: TrainStep[],
  targetId: string,
): number | null {
  let found: number | null = null;
  for (let i = 0; i < linear.length; i++) {
    const step = linear[i];
    if (
      step?.kind === "post" &&
      step.submissionId === targetId &&
      !step.ephemeral
    ) {
      found = i;
    }
  }
  return found;
}

/** True when targetIdx has K slots left, K visible right, and PRELOAD_AHEAD buffer right. */
export function hasJumpBufferAtTarget(linear: TrainStep[], targetIdx: number): boolean {
  return targetIdx >= LEFT_RENDER && (linear.length - 1 - targetIdx) >= RIGHT_RENDER;
}

/** True when animationWindow begins with the same seq prefix as the live window. */
export function animationWindowPreservesLivePrefix(
  liveTape: TrainStep[],
  animationWindow: TrainStep[],
): boolean {
  if (animationWindow.length < liveTape.length) return false;
  for (let i = 0; i < liveTape.length; i++) {
    if (animationWindow[i]?.seq !== liveTape[i]?.seq) return false;
  }
  return true;
}

/**
 * Build jump overlay by appending generated steps to the live tape — never removing
 * on-chain cabins. Committed window is a slice of the same object references.
 */
export function buildAppendOnlyJump(
  startTape: TrainStep[],
  fromCabin: number,
  targetCabin: number,
  cabinIds: string[],
  deps: AppendOnlyJumpDeps,
): AppendOnlyJumpResult {
  const len = cabinIds.length;
  if (len === 0 || startTape.length === 0) {
    return {
      animationWindow: [...startTape],
      committedTape: [...startTape],
      stepsToTarget: 0,
    };
  }

  const targetId = cabinIds[targetCabin - 1]!;
  const { emitNextStep, createCanonicalPost } = deps;
  const forwardSlot = findForwardCanonicalPostInTape(startTape, targetId);
  const atCenter = isCanonicalAtCenter(startTape, targetId);
  const isShortJump = forwardSlot !== null || atCenter;

  if (isShortJump) {
    let linear = [...startTape];
    const targetIdx = forwardSlot ?? CENTER_SLOT;

    let stepsToTarget: number;
    if (atCenter && forwardSlot === null) {
      stepsToTarget = 0;
    } else if (hasEphemeralOnPathToSlot(startTape, targetIdx)) {
      stepsToTarget = computeJumpStepCount(fromCabin, targetCabin, len);
    } else {
      stepsToTarget = targetIdx - CENTER_SLOT;
    }

    linear = appendRightBufferOnly(linear, targetIdx, emitNextStep);

    return {
      animationWindow: linear,
      committedTape: buildCommittedWindow(linear, targetCabin, cabinIds, createCanonicalPost),
      stepsToTarget,
    };
  }

  // Long jump: collapsed path visits + end-state tail (overlap-aware).
  const pathCabins = computeJumpAnimationPath(fromCabin, targetCabin, len).slice(1);
  const stepsToTarget = computeJumpStepCount(fromCabin, targetCabin, len);

  let linear = [...startTape];
  const onTapeLeftIdx = findRightmostCanonicalTargetIdx(startTape, targetId);
  const isOnTapeLeft = onTapeLeftIdx !== null && onTapeLeftIdx < CENTER_SLOT;

  if (isOnTapeLeft) {
    linear = appendFullEndStateBlock(linear, targetCabin, len, createCanonicalPost);
  } else {
    linear = appendMissingPathVisits(linear, pathCabins, cabinIds, createCanonicalPost);
    linear = appendEndStateTail(linear, targetCabin, cabinIds, createCanonicalPost);
  }

  return {
    animationWindow: linear,
    committedTape: buildCommittedWindow(linear, targetCabin, cabinIds, createCanonicalPost),
    stepsToTarget,
  };
}

/** True when canonical target is already at the center slot (non-ephemeral). */
export function isCanonicalAtCenter(
  tape: TrainStep[],
  submissionId: string,
): boolean {
  const center = tape[CENTER_SLOT];
  return center?.kind === "post" &&
    center.submissionId === submissionId &&
    !center.ephemeral;
}

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

/** Build a linear left-to-right tape from an initial window plus center steps after each shift. */
export function linearizeCenterShiftSequence(
  startTape: TrainStep[],
  shiftSnapshots: TrainStep[][],
): TrainStep[] {
  const seen = new Set(startTape.map((step) => step.seq));
  const linear = [...startTape];
  for (const snapshot of shiftSnapshots) {
    const center = snapshot[CENTER_SLOT];
    if (center && !seen.has(center.seq)) {
      seen.add(center.seq);
      linear.push(center);
    }
  }
  return linear;
}

/** First snapshot whose center post matches the target submission id. */
export function findSnapshotIndexAtCenter(
  snapshots: TrainStep[][],
  submissionId: string,
): number {
  return snapshots.findIndex((s) => {
    const center = s[CENTER_SLOT];
    return center?.kind === "post" && center.submissionId === submissionId;
  });
}

/** Append forward-buffer steps from a target-centered snapshot (slots after center). */
export function appendRightBufferFromSnapshot(
  linear: TrainStep[],
  snapshot: TrainStep[],
): TrainStep[] {
  const seen = new Set(linear.map((step) => step.seq));
  const out = [...linear];
  for (let i = CENTER_SLOT + 1; i < snapshot.length; i++) {
    const step = snapshot[i];
    if (step && !seen.has(step.seq)) {
      seen.add(step.seq);
      out.push(step);
    }
  }
  return out;
}

/** Map of generator seq to roof destination label. */
export function collectDestinationsBySeq(steps: TrainStep[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const step of steps) {
    if (step.destination) map.set(step.seq, step.destination);
  }
  return map;
}

/** Copy preserved destinations onto steps that share a pre-jump seq (mutates in place). */
export function applyPreservedDestinationsBySeq(
  tape: TrainStep[],
  destinations: Map<number, string>,
): void {
  for (const step of tape) {
    const destination = destinations.get(step.seq);
    if (destination) step.destination = destination;
  }
}

function postDestinationKey(step: TrainStep): string | null {
  if (step.kind !== "post" || !step.submissionId) return null;
  return `${step.submissionId}:${step.ephemeral ? "e" : "c"}`;
}

/**
 * Restore roof labels for on-chain cabins after jump simulation.
 * Matches by seq first, then by submission id + ephemeral flag for rebuilt steps.
 */
export function preserveDestinationsFromPreJumpTape(
  steps: TrainStep[],
  preJumpTape: TrainStep[],
): void {
  const bySeq = collectDestinationsBySeq(preJumpTape);
  applyPreservedDestinationsBySeq(steps, bySeq);

  const byPostKey = new Map<string, string>();
  for (const step of preJumpTape) {
    const key = postDestinationKey(step);
    if (key && step.destination) byPostKey.set(key, step.destination);
  }

  const preQrDestination = preJumpTape.find((s) => s.kind === "qr")?.destination;

  for (const step of steps) {
    if (bySeq.has(step.seq)) continue;
    if (step.kind === "qr" && preQrDestination) {
      step.destination = preQrDestination;
      continue;
    }
    const key = postDestinationKey(step);
    if (key) {
      const destination = byPostKey.get(key);
      if (destination) step.destination = destination;
    }
  }
}

/** Last-wins map of submission id to destination label from generator steps. */
export function collectDestinationsBySubmission(steps: TrainStep[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const step of steps) {
    if (step.kind === "post" && step.submissionId && step.destination) {
      map.set(step.submissionId, step.destination);
    }
  }
  return map;
}

/** Collect destinations for jump rebuild: seed pre-jump canonical, merge simulation canonical. */
export function collectDestinationsForJump(
  preJumpTape: TrainStep[],
  simulationSteps: TrainStep[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const step of preJumpTape) {
    if (
      step.kind === "post" &&
      step.submissionId &&
      step.destination &&
      !step.ephemeral
    ) {
      map.set(step.submissionId, step.destination);
    }
  }
  for (const step of simulationSteps) {
    if (step.kind !== "post" || !step.submissionId || !step.destination) continue;
    if (step.ephemeral) {
      if (!map.has(step.submissionId)) map.set(step.submissionId, step.destination);
    } else {
      map.set(step.submissionId, step.destination);
    }
  }
  return map;
}

/** Merge on-chain ephemeral steps from pre-jump tape into jump animation overlay. */
export function mergePreJumpEphemerals(
  preJumpTape: TrainStep[],
  animationWindow: TrainStep[],
): TrainStep[] {
  const seen = new Set(animationWindow.map((step) => step.seq));
  const result = [...animationWindow];

  for (let tapeIdx = 0; tapeIdx < preJumpTape.length; tapeIdx++) {
    const step = preJumpTape[tapeIdx];
    if (!step?.ephemeral || seen.has(step.seq)) continue;

    let anchorId: string | null = null;
    for (let i = tapeIdx - 1; i >= 0; i--) {
      const prev = preJumpTape[i];
      if (prev?.kind === "post" && prev.submissionId) {
        anchorId = prev.submissionId;
        break;
      }
    }

    const insertAfter = anchorId
      ? result.findLastIndex((s) => s.submissionId === anchorId)
      : -1;
    if (insertAfter >= 0) {
      result.splice(insertAfter + 1, 0, step);
    } else {
      result.push(step);
    }
    seen.add(step.seq);
  }

  return result;
}

/** Copy preserved destinations onto rebuilt tape steps (mutates in place). */
export function applyPreservedDestinations(
  tape: TrainStep[],
  destinations: Map<string, string>,
): void {
  for (const step of tape) {
    if (step.kind !== "post" || !step.submissionId) continue;
    const destination = destinations.get(step.submissionId);
    if (destination) step.destination = destination;
  }
}

/** Pick shift snapshots whose center cabin follows the collapsed jump animation path. */
export function pickShiftSnapshotsForJumpPath(
  snapshots: TrainStep[][],
  fromCabin: number,
  toCabin: number,
  length: number,
  cabinIds: string[],
): TrainStep[][] {
  const path = computeJumpAnimationPath(fromCabin, toCabin, length);
  if (path.length <= 1) return [];

  const picked: TrainStep[][] = [];
  for (const cabin of path.slice(1)) {
    const targetId = cabinIds[cabin - 1]!;
    const snap = snapshots.find((s) => {
      const center = s[CENTER_SLOT];
      return center?.kind === "post" && center.submissionId === targetId;
    });
    if (snap) picked.push(snap);
  }

  const expected = path.length - 1;
  if (picked.length === expected) return picked;

  return subsampleStepWindows(snapshots, expected);
}

/** Linear jump overlay: subsample shift snapshots to collapsed path length, then extend start tape. */
export function buildJumpAnimationWindow(
  startTape: TrainStep[],
  fromCabin: number,
  toCabin: number,
  length: number,
  shiftSnapshots: TrainStep[][],
  cabinIds: string[],
): TrainStep[] {
  const ringSteps = forwardDistance(fromCabin - 1, toCabin - 1, length);
  const stepsToTarget = computeJumpStepCount(fromCabin, toCabin, length);
  const collapsed = stepsToTarget > 0 && stepsToTarget < ringSteps;
  const sampled = collapsed
    ? pickShiftSnapshotsForJumpPath(
      shiftSnapshots,
      fromCabin,
      toCabin,
      length,
      cabinIds,
    )
    : shiftSnapshots;
  if (!collapsed) {
    return linearizeShiftSequence(startTape, sampled);
  }

  let result = linearizeCenterShiftSequence(startTape, sampled);
  const targetId = cabinIds[toCabin - 1]!;
  const atTarget = findSnapshotIndexAtCenter(shiftSnapshots, targetId);
  if (atTarget >= 0) {
    result = appendRightBufferFromSnapshot(result, shiftSnapshots[atTarget]!);
    result = linearizeShiftSequence(result, shiftSnapshots.slice(atTarget + 1));
  }
  return result;
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
