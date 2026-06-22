import { CENTER_SLOT, LEFT_RENDER, RIGHT_RENDER, VIEWPORT_K } from "./train_view_constants.ts";
import type { Submission } from "../types.ts";
import type { TrainStep } from "../interfaces/realtime_service.ts";

// ---------------------------------------------------------------------------
// Pure jump-path math (canonical cabin numbers; representation-independent).
// ---------------------------------------------------------------------------

export function forwardDistance(fromIdx: number, toIdx: number, length: number): number {
  if (length === 0) return 0;
  return (toIdx - fromIdx + length) % length;
}

export function forwardPathIndices(fromIdx: number, toIdx: number, length: number): number[] {
  if (length === 0) return [];
  const d = forwardDistance(fromIdx, toIdx, length);
  const path: number[] = [];
  for (let i = 0; i <= d; i++) {
    path.push((fromIdx + i) % length);
  }
  return path;
}

/** True when V+K / T-K buffers overlap or touch — no collapse (d <= 2K). */
export function shouldCollapseJump(
  fromIdx: number,
  toIdx: number,
  length: number,
  k = VIEWPORT_K,
): boolean {
  if (length === 0) return false;
  if (forwardDistance(fromIdx, toIdx, length) <= 2 * k) return false;
  return computeCollapsedIndices(fromIdx, toIdx, length, k).size > 0;
}

/** Indices to collapse on forward path V->T, strictly between V+K and T-K. */
export function computeCollapsedIndices(
  fromIdx: number,
  toIdx: number,
  length: number,
  k = VIEWPORT_K,
): Set<number> {
  const path = forwardPathIndices(fromIdx, toIdx, length);
  if (path.length <= 1) return new Set();
  if (path.length - 1 <= 2 * k) return new Set();

  const keep = new Set<number>();
  keep.add(path[0]!);
  for (let i = 1; i <= k && i < path.length; i++) {
    keep.add(path[i]!);
  }
  for (let i = Math.max(1, path.length - k - 1); i < path.length; i++) {
    keep.add(path[i]!);
  }

  const collapsed = new Set<number>();
  for (const idx of path) {
    if (!keep.has(idx)) collapsed.add(idx);
  }
  return collapsed;
}

/** Canonical 1-based cabin animation path for jump V->T. */
export function computeJumpAnimationPath(
  fromCabin: number,
  toCabin: number,
  length: number,
  k = VIEWPORT_K,
): number[] {
  if (length === 0) return [];
  const fromIdx = fromCabin - 1;
  const toIdx = toCabin - 1;
  const d = forwardDistance(fromIdx, toIdx, length);
  if (d === 0) return [fromCabin];

  const fullPath = forwardPathIndices(fromIdx, toIdx, length).map((idx) => idx + 1);
  if (d <= 2 * k) return fullPath;

  const collapsed = computeCollapsedIndices(fromIdx, toIdx, length, k);
  if (collapsed.size === 0) return fullPath;

  const head: number[] = [];
  for (let i = 0; i <= k; i++) {
    head.push(((fromIdx + i) % length) + 1);
  }

  const tMinusK = (toIdx - k + length) % length;
  const tailDist = forwardDistance(tMinusK, toIdx, length);
  const tail: number[] = [];
  for (let i = 0; i <= tailDist; i++) {
    tail.push(((tMinusK + i) % length) + 1);
  }

  if (head[head.length - 1] === tail[0]) {
    return [...head, ...tail.slice(1)];
  }
  return [...head, ...tail];
}

export function computeJumpStepCount(
  fromCabin: number,
  toCabin: number,
  length: number,
  k = VIEWPORT_K,
): number {
  const path = computeJumpAnimationPath(fromCabin, toCabin, length, k);
  return Math.max(0, path.length - 1);
}

// ---------------------------------------------------------------------------
// Display tape model (server-authoritative generator window, FR-20a).
// ---------------------------------------------------------------------------

export interface RenderCabin {
  /** Unique key (generator seq) used as the DOM key. */
  key: string;
  kind: "post" | "qr";
  /** Destination-board label (MRT/LRT station or QR copy). */
  destination?: string;
  /** Preview/QR instances that are not part of the canonical sequence. */
  ephemeral?: boolean;
  /** Resolved snapshot for post cabins (kept even if later deleted, until off-screen). */
  submission?: Submission;
}

export interface TrainViewState {
  canonical: Submission[];
  /** Resolved display tape (server window), left -> right. Center at LEFT_RENDER. */
  window: RenderCabin[];
  currentCabin: number;
}

export function initTrainView(submissions: Submission[]): TrainViewState {
  return {
    canonical: [...submissions],
    window: [],
    currentCabin: submissions.length > 0 ? 1 : 0,
  };
}

function byId(canonical: Submission[]): Map<string, Submission> {
  return new Map(canonical.map((s) => [s.id, s]));
}

function postDestinationKey(submissionId: string, ephemeral?: boolean): string {
  return `${submissionId}:${ephemeral ? "e" : "c"}`;
}

function findPriorDestination(
  priorByKey: Map<string, RenderCabin>,
  step: TrainStep,
): string | undefined {
  const byKey = priorByKey.get(`s${step.seq}`)?.destination;
  if (byKey) return byKey;
  if (step.kind === "qr") {
    for (const cabin of priorByKey.values()) {
      if (cabin.kind === "qr" && cabin.destination) return cabin.destination;
    }
    return undefined;
  }
  if (step.kind === "post" && step.submissionId) {
    const identity = postDestinationKey(step.submissionId, step.ephemeral);
    for (const cabin of priorByKey.values()) {
      if (cabin.kind !== "post" || !cabin.submission?.id) continue;
      if (postDestinationKey(cabin.submission.id, cabin.ephemeral) !== identity) continue;
      if (cabin.destination) return cabin.destination;
    }
  }
  return undefined;
}

function resolveStep(
  step: TrainStep,
  lookup: Map<string, Submission>,
  priorByKey: Map<string, RenderCabin>,
): RenderCabin {
  const key = `s${step.seq}`;
  const priorDestination = findPriorDestination(priorByKey, step);
  if (step.kind === "qr") {
    return {
      key,
      kind: "qr",
      destination: priorDestination ?? step.destination,
      ephemeral: true,
    };
  }
  const submission = (step.submissionId ? lookup.get(step.submissionId) : undefined) ??
    priorByKey.get(key)?.submission;
  return {
    key,
    kind: "post",
    submission,
    ephemeral: step.ephemeral,
    destination: priorDestination ?? step.destination,
  };
}

function resolveWindow(
  window: TrainStep[],
  lookup: Map<string, Submission>,
  prior: RenderCabin[],
): RenderCabin[] {
  const priorByKey = new Map(prior.map((c) => [c.key, c]));
  return window.map((step) => resolveStep(step, lookup, priorByKey));
}

/** Apply a server-authoritative window (bootstrap / advance commit / playback sync). */
export function applyServerWindow(
  state: TrainViewState,
  window: TrainStep[],
  currentCabin: number,
): TrainViewState {
  return {
    ...state,
    window: resolveWindow(window, byId(state.canonical), state.window),
    currentCabin: currentCabin || state.currentCabin,
  };
}

/** Reconstruct server steps from a resolved render window (for jump overlay merge). */
export function renderWindowToSteps(window: RenderCabin[]): TrainStep[] {
  return window.map((c) => ({
    seq: Number.parseInt(c.key.slice(1), 10),
    kind: c.kind,
    submissionId: c.submission?.id,
    destination: c.destination,
  }));
}

/** Apply extended animation tape for jump rendering (preserves prior cabin snapshots). */
export function applyAnimationWindow(
  state: TrainViewState,
  animationWindow: TrainStep[],
): TrainViewState {
  return {
    ...state,
    window: resolveWindow(animationWindow, byId(state.canonical), state.window),
  };
}

export function getRenderWindow(state: TrainViewState): RenderCabin[] {
  return state.window;
}

export function getCurrentCabin(state: TrainViewState): number {
  return state.currentCabin;
}

export function getCanonicalCount(state: TrainViewState): number {
  return state.canonical.length;
}

export function hasCabins(state: TrainViewState): boolean {
  return state.window.length > 0 || state.canonical.length > 0;
}

export function getCenterKey(state: TrainViewState): string | null {
  return state.window[LEFT_RENDER]?.key ?? null;
}

/** Center cabin key from a server window snapshot. */
export function getCenterKeyFromSteps(window: TrainStep[]): string | null {
  const center = window[CENTER_SLOT];
  return center ? `s${center.seq}` : null;
}

/** DOM key in overlay to slide toward for a jump (seq may differ from committed window). */
export function getJumpSlideTargetKey(
  overlay: TrainStep[],
  committedWindow: TrainStep[],
): string | null {
  const centerStep = committedWindow[CENTER_SLOT];
  if (!centerStep) return getCenterKeyFromSteps(committedWindow);

  if (centerStep.kind === "post" && centerStep.submissionId) {
    for (let i = overlay.length - 1; i >= 0; i--) {
      const step = overlay[i];
      if (
        step?.kind === "post" &&
        step.submissionId === centerStep.submissionId &&
        !step.ephemeral
      ) {
        return `s${step.seq}`;
      }
    }
  }

  return getCenterKeyFromSteps(committedWindow);
}

/** Rightmost canonical target slot index in overlay, or null. */
export function findCanonicalTargetSlotInOverlay(
  overlay: TrainStep[],
  submissionId: string,
): number | null {
  let found: number | null = null;
  for (let i = 0; i < overlay.length; i++) {
    const step = overlay[i];
    if (
      step?.kind === "post" &&
      step.submissionId === submissionId &&
      !step.ephemeral
    ) {
      found = i;
    }
  }
  return found;
}

/** True when slideToKey toward getJumpSlideTargetKey would move backward (target at or left of center). */
export function isBackwardSlideTarget(
  overlay: TrainStep[],
  committedWindow: TrainStep[],
): boolean {
  const centerStep = committedWindow[CENTER_SLOT];
  if (
    !centerStep ||
    centerStep.kind !== "post" ||
    !centerStep.submissionId ||
    centerStep.ephemeral
  ) {
    return false;
  }
  const slot = findCanonicalTargetSlotInOverlay(overlay, centerStep.submissionId);
  if (slot === null) return false;
  return slot <= CENTER_SLOT;
}

/** Forward DOM anchor for long / backward-target jumps — never a left-of-center canonical. */
export function getForwardJumpSlideAnchorKey(
  overlay: TrainStep[],
  slideSteps: number,
): string | null {
  if (overlay.length === 0) return null;
  const offset = Math.min(Math.max(slideSteps, 1), RIGHT_RENDER);
  let idx = Math.min(CENTER_SLOT + offset, overlay.length - 1);
  if (idx <= CENTER_SLOT && overlay.length > CENTER_SLOT + 1) {
    idx = overlay.length - 1;
  }
  const step = overlay[idx];
  return step ? `s${step.seq}` : null;
}

/** DOM keys for every step in an animation overlay. */
export function overlayDomKeys(overlay: TrainStep[]): string[] {
  return overlay.map((step) => `s${step.seq}`);
}

/** True when the jump target center cabin is already rendered in the current window. */
export function isJumpTargetInCurrentWindow(
  current: TrainViewState,
  nextWindow: TrainStep[],
): boolean {
  const centerStep = nextWindow[CENTER_SLOT];
  if (
    !centerStep ||
    centerStep.kind !== "post" ||
    !centerStep.submissionId ||
    centerStep.ephemeral
  ) {
    return false;
  }
  return current.window.some((c) => c.submission?.id === centerStep.submissionId);
}

/** The cabin that will become center after one forward step (slide target). */
export function getForwardSlideTargetKey(state: TrainViewState): string | null {
  return state.window[LEFT_RENDER + 1]?.key ?? null;
}

/** Key of the cabin to center for the upcoming commit (from next server window). */
export function getSlideTargetKey(
  current: TrainViewState,
  nextWindow: TrainStep[],
): string | null {
  const centerStep = nextWindow[CENTER_SLOT];
  if (!centerStep) return getForwardSlideTargetKey(current);
  const targetKey = `s${centerStep.seq}`;
  if (current.window.some((c) => c.key === targetKey)) return targetKey;
  return getForwardSlideTargetKey(current);
}

/** Slot steps between current center and slide target (min 1). */
export function getSlideSlotDistance(current: TrainViewState, targetKey: string): number {
  const centerIdx = LEFT_RENDER;
  const targetIdx = current.window.findIndex((c) => c.key === targetKey);
  if (targetIdx < 0) return 1;
  return Math.max(Math.abs(targetIdx - centerIdx), 1);
}

export function addApproved(state: TrainViewState, submission: Submission): TrainViewState {
  if (state.canonical.some((s) => s.id === submission.id)) return state;
  return { ...state, canonical: [...state.canonical, submission] };
}

export function updateSubmissionInView(
  state: TrainViewState,
  submission: Submission,
): TrainViewState {
  const canonical = state.canonical.map((s) => (s.id === submission.id ? submission : s));
  const window = state.window.map((c) =>
    c.submission?.id === submission.id ? { ...c, submission } : c
  );
  return { ...state, canonical, window };
}

export function removeSubmissionFromView(
  state: TrainViewState,
  submissionId: string,
): TrainViewState {
  const canonical = state.canonical.filter((s) => s.id !== submissionId);
  if (canonical.length === 0) {
    return { ...state, canonical, window: [], currentCabin: 0 };
  }
  return {
    ...state,
    canonical,
    currentCabin: Math.min(state.currentCabin, canonical.length || 1),
  };
}
