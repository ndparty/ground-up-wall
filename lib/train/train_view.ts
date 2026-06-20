import { LEFT_RENDER, RIGHT_RENDER, VIEWPORT_K } from "./train_view_constants.ts";
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
  /** Unique key (generator seq, or jump-synthetic) used as the DOM key. */
  key: string;
  kind: "post" | "qr";
  /** Resolved snapshot for post cabins (kept even if later deleted, until off-screen). */
  submission?: Submission;
}

export interface JumpAnimation {
  targetCabin: number;
  stepsRemaining: number;
  /** Cabins to slide through during the jump (left context + collapse path + right). */
  renderWindow: RenderCabin[];
  /** Index of the centered cabin within `renderWindow` (advances each step). */
  centerIndex: number;
  /** Window to settle on once the jump completes (server-authoritative). */
  pendingWindow: RenderCabin[];
  pendingCurrentCabin: number;
}

export interface TrainViewState {
  canonical: Submission[];
  /** Resolved display tape (server window), left -> right. Center at LEFT_RENDER. */
  window: RenderCabin[];
  currentCabin: number;
  jump: JumpAnimation | null;
}

export function initTrainView(submissions: Submission[]): TrainViewState {
  return {
    canonical: [...submissions],
    window: [],
    currentCabin: submissions.length > 0 ? 1 : 0,
    jump: null,
  };
}

function byId(canonical: Submission[]): Map<string, Submission> {
  return new Map(canonical.map((s) => [s.id, s]));
}

function resolveStep(
  step: TrainStep,
  lookup: Map<string, Submission>,
  priorByKey: Map<string, RenderCabin>,
): RenderCabin {
  const key = `s${step.seq}`;
  if (step.kind === "qr") return { key, kind: "qr" };
  const submission = (step.submissionId ? lookup.get(step.submissionId) : undefined) ??
    priorByKey.get(key)?.submission;
  return { key, kind: "post", submission };
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
    jump: null,
  };
}

function activeWindow(state: TrainViewState): RenderCabin[] {
  return state.jump ? state.jump.renderWindow : state.window;
}

function centerSlot(state: TrainViewState): number {
  return state.jump ? state.jump.centerIndex : LEFT_RENDER;
}

export function getRenderWindow(state: TrainViewState): RenderCabin[] {
  return activeWindow(state);
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
  return activeWindow(state)[centerSlot(state)]?.key ?? null;
}

/** The cabin that will become center after one forward step (slide target). */
export function getForwardSlideTargetKey(state: TrainViewState): string | null {
  return activeWindow(state)[centerSlot(state) + 1]?.key ?? null;
}

// --- Canonical list maintenance (content resolution + jump numbering) ------

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
  // Keep window snapshots so an on-screen cabin finishes scrolling off (id-based, no snap).
  return {
    ...state,
    canonical,
    currentCabin: Math.min(state.currentCabin, canonical.length || 1),
  };
}

// --- Jump animation (client-visual collapse over canonical numbers) --------

/** Render window for a jump: K left context + collapse path + K right context. */
function buildJumpRenderWindow(state: TrainViewState, path: number[]): RenderCabin[] {
  const length = state.canonical.length;
  const out: RenderCabin[] = [];
  let synthetic = 0;
  const push = (cabin: number) => {
    out.push({ key: `j${synthetic++}`, kind: "post", submission: state.canonical[cabin - 1] });
  };

  const first = path[0]!;
  for (let i = LEFT_RENDER; i >= 1; i--) push(((first - 1 - i + length) % length) + 1);
  for (const cabin of path) push(cabin);
  const last = path[path.length - 1]!;
  for (let i = 1; i <= RIGHT_RENDER; i++) push(((last - 1 + i) % length) + 1);
  return out;
}

export function beginJump(
  state: TrainViewState,
  targetCabin: number,
  pendingWindow: TrainStep[],
  pendingCurrentCabin: number,
): TrainViewState {
  const length = state.canonical.length;
  const resolvedPending = resolveWindow(pendingWindow, byId(state.canonical), state.window);
  const settle = (): TrainViewState => ({
    ...state,
    window: resolvedPending,
    currentCabin: pendingCurrentCabin || state.currentCabin,
    jump: null,
  });

  if (length === 0) return settle();

  const fromCabin = state.currentCabin || 1;
  const path = computeJumpAnimationPath(fromCabin, targetCabin, length);
  const steps = Math.max(0, path.length - 1);
  if (steps === 0) return settle();

  return {
    ...state,
    jump: {
      targetCabin,
      stepsRemaining: steps,
      renderWindow: buildJumpRenderWindow(state, path),
      centerIndex: LEFT_RENDER,
      pendingWindow: resolvedPending,
      pendingCurrentCabin,
    },
  };
}

export function advanceJumpStep(state: TrainViewState): TrainViewState {
  if (!state.jump) return state;
  const remaining = state.jump.stepsRemaining - 1;
  if (remaining <= 0) {
    return {
      ...state,
      window: state.jump.pendingWindow,
      currentCabin: state.jump.pendingCurrentCabin || state.currentCabin,
      jump: null,
    };
  }
  return {
    ...state,
    jump: {
      ...state.jump,
      stepsRemaining: remaining,
      centerIndex: state.jump.centerIndex + 1,
    },
  };
}

export function needsAnimationStep(state: TrainViewState): boolean {
  return state.jump !== null && state.jump.stepsRemaining > 0;
}
