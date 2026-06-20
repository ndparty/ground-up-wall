import {
  initTrain,
  type TrainCabinNode,
  type TrainChain,
} from "./chain.ts";
import { LEFT_RENDER, RIGHT_RENDER, VIEWPORT_K } from "./train_view_constants.ts";
import type { Submission } from "../types.ts";

export interface EphemeralInsert {
  submissionId: string;
  seenInViewport: boolean;
  /** Base-ring node id this insert follows in the effective ring. */
  afterId: string;
  /** Node id to continue to after this ephemeral cabin. */
  resumeId: string;
}

export interface JumpAnimation {
  targetCabin: number;
  collapsedIds: Set<string>;
  stepsRemaining: number;
}

export interface TrainViewState {
  base: TrainChain;
  ephemeralInserts: EphemeralInsert[];
  jump: JumpAnimation | null;
}

export function initTrainView(submissions: Submission[]): TrainViewState {
  return {
    base: initTrain(submissions),
    ephemeralInserts: [],
    jump: null,
  };
}

export function cabinNumberForNode(node: TrainCabinNode): number {
  return node.index + 1;
}

export function getNodeById(chain: TrainChain, id: string): TrainCabinNode | null {
  return chain.nodes.find((n) => n.submission.id === id) ?? null;
}

export function getCurrentCabin(state: TrainViewState): number {
  if (!state.base.current || state.base.nodes.length === 0) return 0;
  return cabinNumberForNode(state.base.current);
}

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

/** True when V+K / T−K buffers overlap or touch — no collapse (d <= 2K). */
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

/** Indices to collapse on forward path V→T, strictly between V+K and T−K. */
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

/** Canonical 1-based cabin animation path for jump V→T. */
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

function walkBaseNextSkippingCollapsed(
  state: TrainViewState,
  from: TrainCabinNode,
): string | null {
  const chain = state.base;
  let node: TrainCabinNode | null = from;
  for (let guard = 0; guard < chain.nodes.length + 1; guard++) {
    node = node!.next;
    if (!node) return null;
    if (state.jump?.collapsedIds.has(node.submission.id)) continue;
    return node.submission.id;
  }
  return null;
}

export function effectiveNextId(state: TrainViewState, fromId: string): string | null {
  const from = getNodeById(state.base, fromId);
  if (!from) return null;

  const queued = state.ephemeralInserts.filter((e) => getNodeById(state.base, e.submissionId));
  const afterCurrent = queued.filter((e) => e.afterId === fromId);
  if (afterCurrent.length > 0) {
    return afterCurrent[0]!.submissionId;
  }

  const asEphemeral = queued.find((e) => e.submissionId === fromId);
  if (asEphemeral) {
    const sameAnchor = queued.filter((e) => e.afterId === asEphemeral.afterId);
    const idx = sameAnchor.findIndex((e) => e.submissionId === fromId);
    if (idx >= 0 && idx < sameAnchor.length - 1) {
      return sameAnchor[idx + 1]!.submissionId;
    }
    return asEphemeral.resumeId;
  }

  return walkBaseNextSkippingCollapsed(state, from);
}

function stepEffectiveNext(state: TrainViewState): TrainViewState {
  const current = state.base.current;
  if (!current) return state;

  const nextId = effectiveNextId(state, current.submission.id);
  if (!nextId) return state;

  const nextNode = getNodeById(state.base, nextId);
  if (!nextNode) return state;

  const next: TrainViewState = {
    ...state,
    base: { ...state.base, current: nextNode },
    ephemeralInserts: [...state.ephemeralInserts],
    jump: state.jump ? { ...state.jump, collapsedIds: new Set(state.jump.collapsedIds) } : null,
  };

  return updateEphemeralVisibility(next);
}

export function slotDistanceFromCenter(
  state: TrainViewState,
  submissionId: string,
): number | null {
  const centerId = state.base.current?.submission.id;
  if (!centerId) return null;
  if (submissionId === centerId) return 0;

  const chain = state.base;
  const n = chain.nodes.length;
  const centerIdx = state.base.current!.index;
  const target = getNodeById(chain, submissionId);
  if (!target) return null;

  return forwardDistance(centerIdx, target.index, n);
}

export function isWithinKSlots(state: TrainViewState, submissionId: string): boolean {
  const dist = slotDistanceFromCenter(state, submissionId);
  return dist !== null && dist <= VIEWPORT_K;
}

export function updateEphemeralVisibility(state: TrainViewState): TrainViewState {
  const toRemove = new Set<string>();
  const inserts = state.ephemeralInserts.map((ins) => {
    const visible = isWithinKSlots(state, ins.submissionId);
    if (visible) return { ...ins, seenInViewport: true };
    if (ins.seenInViewport && !visible) {
      toRemove.add(ins.submissionId);
      return null;
    }
    return ins;
  }).filter((x): x is EphemeralInsert => x !== null);

  return { ...state, ephemeralInserts: inserts.filter((e) => !toRemove.has(e.submissionId)) };
}

function appendToBaseRing(chain: TrainChain, submission: Submission): TrainCabinNode {
  const node: TrainCabinNode = {
    submission,
    index: chain.nodes.length,
    next: null,
    prev: null,
  };

  if (chain.nodes.length === 0) {
    chain.nodes.push(node);
    node.next = node;
    node.prev = node;
    chain.head = node;
    chain.current = node;
    return node;
  }

  const tail = chain.head!.prev!;
  node.prev = tail;
  node.next = chain.head;
  tail.next = node;
  chain.head!.prev = node;
  chain.nodes.push(node);
  node.index = chain.nodes.length - 1;
  return node;
}

export function applyEphemeralInsert(
  state: TrainViewState,
  submission: Submission,
): TrainViewState {
  if (state.base.nodes.some((n) => n.submission.id === submission.id)) {
    return state;
  }
  if (state.ephemeralInserts.some((e) => e.submissionId === submission.id)) {
    return state;
  }

  const base = { ...state.base, nodes: [...state.base.nodes] };
  appendToBaseRing(base, submission);

  const current = base.current;
  if (!current) {
    return { ...state, base, ephemeralInserts: state.ephemeralInserts };
  }

  const resumeId = current.next!.submission.id;
  const insert: EphemeralInsert = {
    submissionId: submission.id,
    seenInViewport: false,
    afterId: current.submission.id,
    resumeId,
  };

  return {
    ...state,
    base,
    ephemeralInserts: [...state.ephemeralInserts, insert],
  };
}

export function beginJump(state: TrainViewState, targetCabin: number): TrainViewState {
  const n = state.base.nodes.length;
  if (n === 0) return state;

  const targetIdx = Math.max(0, Math.min(n - 1, targetCabin - 1));
  const currentIdx = state.base.current?.index ?? 0;
  if (targetIdx === currentIdx) return { ...state, jump: null };

  const fromCabin = currentIdx + 1;
  const collapsedIds = new Set<string>();
  if (shouldCollapseJump(currentIdx, targetIdx, n)) {
    for (const idx of computeCollapsedIndices(currentIdx, targetIdx, n)) {
      const node = state.base.nodes[idx];
      if (node) collapsedIds.add(node.submission.id);
    }
  }

  const steps = computeJumpStepCount(fromCabin, targetCabin, n);
  return beginJumpWithSteps(state, targetCabin, collapsedIds, steps);
}

function beginJumpWithSteps(
  state: TrainViewState,
  targetCabin: number,
  collapsedIds: Set<string>,
  knownSteps: number | null,
): TrainViewState {
  const targetIdx = targetCabin - 1;
  const targetId = state.base.nodes[targetIdx]?.submission.id;
  if (!targetId) return snapToCabin(state, targetCabin);

  let sim: TrainViewState = {
    ...state,
    jump: { targetCabin, collapsedIds, stepsRemaining: 0 },
    ephemeralInserts: [...state.ephemeralInserts],
  };

  let steps = knownSteps ?? 0;
  if (knownSteps === null) {
    const guard = state.base.nodes.length + state.ephemeralInserts.length + 5;
    while (sim.base.current?.submission.id !== targetId && steps < guard) {
      sim = stepEffectiveNext(sim);
      steps++;
    }
    if (sim.base.current?.submission.id !== targetId) {
      return snapToCabin(state, targetCabin);
    }
  }

  return {
    ...state,
    jump: { targetCabin, collapsedIds, stepsRemaining: steps },
  };
}

export function advanceOneStep(state: TrainViewState): TrainViewState {
  if (state.jump && state.jump.stepsRemaining > 0) {
    let next = stepEffectiveNext(state);
    const remaining = state.jump.stepsRemaining - 1;
    const targetIdx = state.jump.targetCabin - 1;
    const atTarget = next.base.current?.index === targetIdx;

    if (remaining <= 0 || atTarget) {
      next = { ...next, jump: null };
      return updateEphemeralVisibility(next);
    }

    return {
      ...next,
      jump: { ...state.jump, stepsRemaining: remaining },
    };
  }

  const next = stepEffectiveNext({ ...state, jump: null });
  return updateEphemeralVisibility(next);
}

export function snapToCabin(state: TrainViewState, cabinNumber: number): TrainViewState {
  const n = state.base.nodes.length;
  if (n === 0) return { ...state, jump: null };

  const idx = Math.max(0, Math.min(n - 1, cabinNumber - 1));
  const node = state.base.nodes[idx] ?? null;
  return updateEphemeralVisibility({
    ...state,
    base: { ...state.base, current: node },
    jump: null,
  });
}

export function applyServerAdvance(state: TrainViewState): TrainViewState {
  if (state.jump) return state;
  return advanceOneStep({ ...state, jump: null });
}

/** Next cabin id on the effective forward ring (slide animation target). */
export function getForwardSlideTargetId(state: TrainViewState): string | null {
  const current = state.base.current;
  if (!current) return null;
  return effectiveNextId(state, current.submission.id);
}

function appendEphemeralInserts(
  state: TrainViewState,
  chain: TrainChain,
  ordered: TrainCabinNode[],
  seen: Set<number>,
): TrainCabinNode[] {
  const result = [...ordered];
  for (const ins of state.ephemeralInserts) {
    const node = getNodeById(chain, ins.submissionId);
    if (!node || seen.has(node.index)) continue;
    const anchor = getNodeById(chain, ins.afterId);
    if (!anchor) {
      result.push(node);
      seen.add(node.index);
      continue;
    }
    const anchorPos = result.findIndex((x) => x.index === anchor.index);
    if (anchorPos >= 0) {
      result.splice(anchorPos + 1, 0, node);
    } else {
      result.push(node);
    }
    seen.add(node.index);
  }
  return result;
}

/** Jump-mode window: K left of start + effective path to target + K right of target. */
function getJumpRenderWindow(state: TrainViewState): TrainCabinNode[] {
  const chain = state.base;
  const n = chain.nodes.length;
  const center = chain.current!;
  const jump = state.jump!;
  const collapsed = jump.collapsedIds;
  const targetIdx = jump.targetCabin - 1;
  const targetId = chain.nodes[targetIdx]?.submission.id;

  const ordered: TrainCabinNode[] = [];
  const seen = new Set<number>();

  const addNode = (node: TrainCabinNode | null | undefined) => {
    if (!node || collapsed.has(node.submission.id) || seen.has(node.index)) return;
    seen.add(node.index);
    ordered.push(node);
  };

  for (let i = LEFT_RENDER; i >= 1; i--) {
    const idx = (center.index - i + n) % n;
    addNode(chain.nodes[idx]);
  }
  addNode(center);

  if (targetId) {
    let walkId = center.submission.id;
    const guard = n + state.ephemeralInserts.length + 2;
    for (let g = 0; g < guard; g++) {
      if (walkId === targetId) break;
      const nextId = effectiveNextId(state, walkId);
      if (!nextId || nextId === walkId) break;
      addNode(getNodeById(chain, nextId));
      walkId = nextId;
    }
  }

  for (let i = 1; i <= VIEWPORT_K; i++) {
    const idx = (targetIdx + i) % n;
    addNode(chain.nodes[idx]);
  }

  return appendEphemeralInserts(state, chain, ordered, seen);
}

export function getRenderWindow(state: TrainViewState): TrainCabinNode[] {
  const chain = state.base;
  const n = chain.nodes.length;
  if (n === 0 || !chain.current) return [];

  if (state.jump && state.jump.stepsRemaining > 0) {
    return getJumpRenderWindow(state);
  }

  const centerIdx = chain.current.index;
  const slotCount = LEFT_RENDER + 1 + RIGHT_RENDER;
  const startIdx = (centerIdx - LEFT_RENDER + n) % n;

  const ordered: TrainCabinNode[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < slotCount; i++) {
    const idx = (startIdx + i) % n;
    if (seen.has(idx)) continue;
    seen.add(idx);
    ordered.push(chain.nodes[idx]!);
  }

  return appendEphemeralInserts(state, chain, ordered, seen);
}

export function rebuildBase(state: TrainViewState, submissions: Submission[]): TrainViewState {
  const currentId = state.base.current?.submission.id;
  const fresh = initTrain(submissions);
  if (currentId && fresh.nodes.length > 0) {
    fresh.current = fresh.nodes.find((n) => n.submission.id === currentId) ?? fresh.head;
  }
  return {
    base: fresh,
    ephemeralInserts: state.ephemeralInserts.filter((e) =>
      fresh.nodes.some((n) => n.submission.id === e.submissionId)
    ),
    jump: null,
  };
}

export function removeSubmissionFromView(state: TrainViewState, submissionId: string): TrainViewState {
  const chain = { ...state.base, nodes: [...state.base.nodes] };
  const idx = chain.nodes.findIndex((n) => n.submission.id === submissionId);
  if (idx === -1) return state;

  const node = chain.nodes[idx]!;
  const wasCurrent = chain.current === node;
  const nextNode = node.next;

  if (chain.nodes.length === 1) {
    return initTrainView([]);
  }

  node.prev!.next = node.next;
  node.next!.prev = node.prev;
  chain.nodes.splice(idx, 1);
  chain.nodes.forEach((n, i) => {
    n.index = i;
  });
  chain.head = chain.nodes[0] ?? null;

  if (wasCurrent) {
    chain.current = nextNode === node
      ? chain.head
      : (chain.nodes.includes(nextNode!) ? nextNode : chain.head);
  }

  return updateEphemeralVisibility({
    ...state,
    base: chain,
    ephemeralInserts: state.ephemeralInserts.filter((e) => e.submissionId !== submissionId),
    jump: null,
  });
}

export function updateSubmissionInView(
  state: TrainViewState,
  submission: Submission,
): TrainViewState {
  const node = state.base.nodes.find((n) => n.submission.id === submission.id);
  if (!node) return state;
  node.submission = submission;
  return { ...state, base: { ...state.base, nodes: [...state.base.nodes] } };
}

export function needsAnimationStep(state: TrainViewState): boolean {
  return state.jump !== null && state.jump.stepsRemaining > 0;
}

export function reduceTrainViewEvent(
  state: TrainViewState,
  event:
    | { type: "advance" }
    | { type: "jump"; cabinNumber: number; instant?: boolean }
    | { type: "snap"; cabinNumber: number }
    | { type: "approved"; submission: Submission }
    | { type: "edited"; submission: Submission }
    | { type: "deleted"; id: string }
    | { type: "animation_step" },
): TrainViewState {
  switch (event.type) {
    case "advance":
      return applyServerAdvance(state);
    case "jump":
      if (event.instant) return snapToCabin(state, event.cabinNumber);
      return beginJump(state, event.cabinNumber);
    case "snap":
      return snapToCabin(state, event.cabinNumber);
    case "approved":
      return applyEphemeralInsert(state, event.submission);
    case "edited":
      return updateSubmissionInView(state, event.submission);
    case "deleted":
      return removeSubmissionFromView(state, event.id);
    case "animation_step":
      return advanceOneStep(state);
  }
}
