import { assertEquals } from "@std/assert";
import {
  addApproved,
  applyAnimationWindow,
  applyServerWindow,
  computeCollapsedIndices,
  computeJumpAnimationPath,
  computeJumpStepCount,
  forwardDistance,
  getCanonicalCount,
  getCenterKey,
  getCurrentCabin,
  getForwardSlideTargetKey,
  getRenderWindow,
  hasCabins,
  getSlideSlotDistance,
  getSlideTargetKey,
  initTrainView,
  isJumpTargetInCurrentWindow,
  removeSubmissionFromView,
  renderWindowToSteps,
  updateSubmissionInView,
} from "./train_view.ts";
import { LEFT_RENDER } from "./train_view_constants.ts";
import type { TrainStep } from "../interfaces/realtime_service.ts";
import type { Submission } from "../types.ts";

function makeSubmission(id: string, index: number): Submission {
  return {
    id,
    image_url: `/img/${id}.jpg`,
    message: `Message ${index}`,
    submitter_name: `User ${index}`,
    social_handle: `@user${index}`,
    status: "approved",
    source: "test",
    is_flagged: false,
    edit_count: 0,
    created_at: new Date().toISOString(),
  };
}

function makeSubmissions(count: number): Submission[] {
  return Array.from({ length: count }, (_, i) => makeSubmission(`sub-${i + 1}`, i + 1));
}

/** Build a window of post steps for cabins centered so cabin `center` sits at LEFT_RENDER. */
function postWindow(centerCabin: number, length: number, span = 7): TrainStep[] {
  const steps: TrainStep[] = [];
  let seq = 1;
  for (let i = 0; i < span; i++) {
    const off = i - LEFT_RENDER;
    const cabin = ((centerCabin - 1 + off) % length + length) % length + 1;
    steps.push({ seq: seq++, kind: "post", submissionId: `sub-${cabin}` });
  }
  return steps;
}

// --- Pure jump-path math (pinned at k=4 to keep the algorithm goldens) ------

Deno.test("forwardDistance wraps correctly", () => {
  assertEquals(forwardDistance(7, 19, 40), 12);
  assertEquals(forwardDistance(39, 2, 40), 3);
  assertEquals(forwardDistance(5, 5, 40), 0);
});

Deno.test("computeCollapsedIndices keeps K after V and K before T (k=4)", () => {
  const collapsed = computeCollapsedIndices(7, 19, 40, 4);
  assertEquals(collapsed.has(11), false);
  assertEquals(collapsed.has(12), true);
  assertEquals(collapsed.has(14), true);
  assertEquals(collapsed.has(15), false);
});

Deno.test("golden jump 8 to 20 (k=4)", () => {
  assertEquals(
    computeJumpAnimationPath(8, 20, 40, 4),
    [8, 9, 10, 11, 12, 16, 17, 18, 19, 20],
  );
  assertEquals(computeJumpStepCount(8, 20, 40, 4), 9);
});

Deno.test("golden jump 40 to 3 — no collapse", () => {
  assertEquals(computeJumpAnimationPath(40, 3, 40, 4), [40, 1, 2, 3]);
});

Deno.test("jump path collapses at runtime k=2 for far targets", () => {
  // Default k = VIEWPORT_K = 2: keep 2 after start + 2 before target.
  assertEquals(computeJumpAnimationPath(1, 20, 40), [1, 2, 3, 18, 19, 20]);
});

// --- Tape model ------------------------------------------------------------

Deno.test("applyServerWindow resolves posts and centers at LEFT_RENDER", () => {
  let state = initTrainView(makeSubmissions(10));
  state = applyServerWindow(state, postWindow(3, 10), 3);

  const win = getRenderWindow(state);
  assertEquals(win.length, 7);
  assertEquals(win[LEFT_RENDER].submission?.id, "sub-3");
  assertEquals(getCenterKey(state), win[LEFT_RENDER].key);
  assertEquals(getCurrentCabin(state), 3);
});

Deno.test("getForwardSlideTargetKey is the cabin right of center", () => {
  let state = initTrainView(makeSubmissions(10));
  state = applyServerWindow(state, postWindow(3, 10), 3);
  const win = getRenderWindow(state);
  assertEquals(getForwardSlideTargetKey(state), win[LEFT_RENDER + 1].key);
});

Deno.test("getSlideTargetKey slides to in-window cabin for multi-slot jump", () => {
  let state = initTrainView(makeSubmissions(10));
  const currentWindow: TrainStep[] = [
    { seq: 1, kind: "post", submissionId: "sub-1" },
    { seq: 2, kind: "post", submissionId: "sub-2" },
    { seq: 3, kind: "post", submissionId: "sub-3" },
    { seq: 4, kind: "post", submissionId: "sub-4" },
    { seq: 5, kind: "post", submissionId: "sub-5" },
    { seq: 6, kind: "post", submissionId: "sub-6" },
    { seq: 7, kind: "post", submissionId: "sub-7" },
  ];
  state = applyServerWindow(state, currentWindow, 3);

  const nextWindow: TrainStep[] = [
    { seq: 3, kind: "post", submissionId: "sub-3" },
    { seq: 4, kind: "post", submissionId: "sub-4" },
    { seq: 5, kind: "post", submissionId: "sub-5" },
    { seq: 6, kind: "post", submissionId: "sub-6" },
    { seq: 7, kind: "post", submissionId: "sub-7" },
    { seq: 8, kind: "post", submissionId: "sub-8" },
    { seq: 9, kind: "post", submissionId: "sub-9" },
  ];

  assertEquals(getSlideTargetKey(state, nextWindow), "s5");
  assertEquals(getSlideSlotDistance(state, "s5"), 2);
});

Deno.test("getSlideTargetKey falls back when next center is not yet in window", () => {
  let state = initTrainView(makeSubmissions(10));
  state = applyServerWindow(state, postWindow(3, 10), 3);
  const nextWindow = postWindow(3, 10);
  nextWindow[LEFT_RENDER] = { seq: 999, kind: "post", submissionId: "sub-8" };
  assertEquals(getSlideTargetKey(state, nextWindow), getForwardSlideTargetKey(state));
});

Deno.test("isJumpTargetInCurrentWindow when target center is already rendered", () => {
  let state = initTrainView(makeSubmissions(10));
  const currentWindow: TrainStep[] = [
    { seq: 10, kind: "post", submissionId: "sub-1" },
    { seq: 11, kind: "post", submissionId: "sub-2" },
    { seq: 12, kind: "post", submissionId: "sub-3" },
    { seq: 13, kind: "post", submissionId: "sub-4" },
    { seq: 14, kind: "post", submissionId: "sub-5" },
    { seq: 15, kind: "post", submissionId: "sub-6" },
    { seq: 16, kind: "post", submissionId: "sub-7" },
  ];
  state = applyServerWindow(state, currentWindow, 3);

  const nextWindow: TrainStep[] = [
    { seq: 12, kind: "post", submissionId: "sub-3" },
    { seq: 13, kind: "post", submissionId: "sub-4" },
    { seq: 14, kind: "post", submissionId: "sub-5" },
    { seq: 15, kind: "post", submissionId: "sub-6" },
    { seq: 16, kind: "post", submissionId: "sub-7" },
    { seq: 17, kind: "post", submissionId: "sub-8" },
    { seq: 18, kind: "post", submissionId: "sub-9" },
  ];
  assertEquals(isJumpTargetInCurrentWindow(state, nextWindow), true);
});

Deno.test("isJumpTargetInCurrentWindow false when target center is not in window", () => {
  let state = initTrainView(makeSubmissions(10));
  const currentWindow: TrainStep[] = [
    { seq: 10, kind: "post", submissionId: "sub-1" },
    { seq: 11, kind: "post", submissionId: "sub-2" },
    { seq: 12, kind: "post", submissionId: "sub-3" },
    { seq: 13, kind: "post", submissionId: "sub-4" },
    { seq: 14, kind: "post", submissionId: "sub-5" },
    { seq: 15, kind: "post", submissionId: "sub-6" },
    { seq: 16, kind: "post", submissionId: "sub-7" },
  ];
  state = applyServerWindow(state, currentWindow, 3);

  const rebuiltWindow: TrainStep[] = [
    { seq: 200, kind: "post", submissionId: "sub-7" },
    { seq: 201, kind: "post", submissionId: "sub-8" },
    { seq: 202, kind: "post", submissionId: "sub-9" },
    { seq: 203, kind: "post", submissionId: "sub-10" },
    { seq: 204, kind: "post", submissionId: "sub-1" },
    { seq: 205, kind: "post", submissionId: "sub-2" },
    { seq: 206, kind: "post", submissionId: "sub-3" },
  ];
  assertEquals(isJumpTargetInCurrentWindow(state, rebuiltWindow), false);
});

Deno.test("qr step resolves to a qr render cabin", () => {
  let state = initTrainView(makeSubmissions(10));
  const window: TrainStep[] = postWindow(3, 10);
  window[LEFT_RENDER + 1] = { seq: 999, kind: "qr" };
  state = applyServerWindow(state, window, 3);
  const cabin = getRenderWindow(state)[LEFT_RENDER + 1];
  assertEquals(cabin.kind, "qr");
  assertEquals(cabin.submission, undefined);
});

Deno.test("addApproved grows canonical without touching the window", () => {
  let state = initTrainView(makeSubmissions(10));
  state = applyServerWindow(state, postWindow(3, 10), 3);
  const before = getRenderWindow(state).map((c) => c.key);
  state = addApproved(state, makeSubmission("sub-11", 11));
  assertEquals(getCanonicalCount(state), 11);
  assertEquals(getRenderWindow(state).map((c) => c.key), before);
});

Deno.test("edited submission updates the on-screen snapshot", () => {
  let state = initTrainView(makeSubmissions(10));
  state = applyServerWindow(state, postWindow(3, 10), 3);
  const edited = { ...makeSubmission("sub-3", 3), message: "Edited!" };
  state = updateSubmissionInView(state, edited);
  assertEquals(getRenderWindow(state)[LEFT_RENDER].submission?.message, "Edited!");
});

Deno.test("deleted submission keeps its on-screen snapshot (no snap)", () => {
  let state = initTrainView(makeSubmissions(10));
  state = applyServerWindow(state, postWindow(3, 10), 3);
  state = removeSubmissionFromView(state, "sub-3");
  // Removed from canonical, but the window cabin retains its snapshot to scroll off.
  assertEquals(getCanonicalCount(state), 9);
  assertEquals(getRenderWindow(state)[LEFT_RENDER].submission?.id, "sub-3");
});

Deno.test("deleting last approved submission clears window for waiting screen", () => {
  let state = initTrainView(makeSubmissions(1));
  state = applyServerWindow(state, postWindow(1, 1), 1);
  state = removeSubmissionFromView(state, "sub-1");
  assertEquals(getCanonicalCount(state), 0);
  assertEquals(getRenderWindow(state).length, 0);
  assertEquals(hasCabins(state), false);
  assertEquals(state.currentCabin, 0);
});

Deno.test("renderWindowToSteps reconstructs server steps from render cabins", () => {
  let state = initTrainView(makeSubmissions(10));
  state = applyServerWindow(state, postWindow(3, 10), 3);
  const steps = renderWindowToSteps(getRenderWindow(state));
  assertEquals(steps.length, 7);
  assertEquals(steps[LEFT_RENDER]?.submissionId, "sub-3");
  assertEquals(steps[LEFT_RENDER]?.seq, Number(getRenderWindow(state)[LEFT_RENDER]?.key.slice(1)));
});

Deno.test("applyAnimationWindow extends render tape for jump animation", () => {
  let state = initTrainView(makeSubmissions(10));
  state = applyServerWindow(state, postWindow(1, 10), 1);
  const extended: TrainStep[] = [
    ...postWindow(1, 10),
    { seq: 99, kind: "post", submissionId: "sub-8" },
    { seq: 100, kind: "post", submissionId: "sub-9" },
  ];
  state = applyAnimationWindow(state, extended);
  assertEquals(getRenderWindow(state).length, 9);
  assertEquals(getRenderWindow(state)[8]?.key, "s100");
});
