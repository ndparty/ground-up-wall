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
  getCenterKeyFromSteps,
  getCurrentCabin,
  getRenderWindow,
  hasCabins,
  initTrainView,
  overlayDomKeys,
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

Deno.test("overlayDomKeys maps every overlay step to s-seq keys", () => {
  const overlay: TrainStep[] = [
    { seq: 3, kind: "post", submissionId: "sub-1" },
    { seq: 7, kind: "post", submissionId: "sub-2" },
  ];
  assertEquals(overlayDomKeys(overlay), ["s3", "s7"]);
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

Deno.test("applyAnimationWindow keeps prior destination when overlay changes label", () => {
  let state = initTrainView(makeSubmissions(10));
  const window: TrainStep[] = [
    { seq: 1, kind: "post", submissionId: "sub-1", destination: "Bishan" },
    { seq: 2, kind: "post", submissionId: "sub-2", destination: "Ang Mo Kio" },
    { seq: 3, kind: "post", submissionId: "sub-3", destination: "Yio Chu Kang" },
    { seq: 4, kind: "post", submissionId: "sub-4", destination: "Khatib" },
    { seq: 5, kind: "post", submissionId: "sub-5", destination: "Yishun" },
    { seq: 6, kind: "post", submissionId: "sub-6", destination: "Sembawang" },
    { seq: 7, kind: "post", submissionId: "sub-7", destination: "Woodlands" },
  ];
  state = applyServerWindow(state, window, 3);
  const overlay: TrainStep[] = window.map((step) => ({
    ...step,
    destination: step.seq === 3 ? "Changed" : step.destination,
  }));
  state = applyAnimationWindow(state, overlay);
  assertEquals(getRenderWindow(state)[LEFT_RENDER]?.destination, "Yio Chu Kang");
});

Deno.test("applyServerWindow preserves destination when commit uses new seq keys", () => {
  let state = initTrainView(makeSubmissions(10));
  const initial: TrainStep[] = [
    { seq: 1, kind: "post", submissionId: "sub-1", destination: "Bishan" },
    { seq: 2, kind: "post", submissionId: "sub-2", destination: "Ang Mo Kio" },
    { seq: 3, kind: "post", submissionId: "sub-3", destination: "Yio Chu Kang" },
    { seq: 4, kind: "post", submissionId: "sub-4", destination: "Khatib" },
    { seq: 5, kind: "post", submissionId: "sub-5", destination: "Yishun" },
    { seq: 6, kind: "post", submissionId: "sub-6", destination: "Sembawang" },
    { seq: 7, kind: "post", submissionId: "sub-7", destination: "Woodlands" },
  ];
  state = applyServerWindow(state, initial, 3);

  const commit: TrainStep[] = [
    { seq: 20, kind: "post", submissionId: "sub-3", destination: "Regenerated" },
    { seq: 21, kind: "post", submissionId: "sub-4", destination: "Regenerated" },
    { seq: 22, kind: "post", submissionId: "sub-5", destination: "Regenerated" },
    { seq: 23, kind: "post", submissionId: "sub-6", destination: "Regenerated" },
    { seq: 24, kind: "post", submissionId: "sub-7", destination: "Regenerated" },
    { seq: 25, kind: "post", submissionId: "sub-8", destination: "Regenerated" },
    { seq: 26, kind: "post", submissionId: "sub-9", destination: "Regenerated" },
  ];
  state = applyServerWindow(state, commit, 5);

  assertEquals(getRenderWindow(state)[LEFT_RENDER]?.destination, "Yishun");
  assertEquals(getRenderWindow(state)[LEFT_RENDER + 1]?.destination, "Sembawang");
  assertEquals(getRenderWindow(state)[LEFT_RENDER]?.key, "s22");
});

Deno.test("applyServerWindow preserves ephemeral destination when seq keys change", () => {
  let state = initTrainView(makeSubmissions(10));
  const initial: TrainStep[] = [
    { seq: 1, kind: "post", submissionId: "sub-1", destination: "Bishan" },
    { seq: 2, kind: "post", submissionId: "sub-2", destination: "Ang Mo Kio" },
    { seq: 3, kind: "post", submissionId: "sub-10", ephemeral: true, destination: "Preview Stop" },
    { seq: 4, kind: "post", submissionId: "sub-3", destination: "Yio Chu Kang" },
    { seq: 5, kind: "post", submissionId: "sub-4", destination: "Khatib" },
    { seq: 6, kind: "post", submissionId: "sub-5", destination: "Yishun" },
    { seq: 7, kind: "post", submissionId: "sub-6", destination: "Sembawang" },
  ];
  state = applyServerWindow(state, initial, 2);

  const commit: TrainStep[] = [
    { seq: 40, kind: "post", submissionId: "sub-1", destination: "New" },
    { seq: 41, kind: "post", submissionId: "sub-2", destination: "New" },
    { seq: 42, kind: "post", submissionId: "sub-10", ephemeral: true, destination: "New Preview" },
    { seq: 43, kind: "post", submissionId: "sub-3", destination: "New" },
    { seq: 44, kind: "post", submissionId: "sub-4", destination: "New" },
    { seq: 45, kind: "post", submissionId: "sub-5", destination: "New" },
    { seq: 46, kind: "post", submissionId: "sub-6", destination: "New" },
  ];
  state = applyServerWindow(state, commit, 3);

  const ephemeral = getRenderWindow(state).find((c) => c.ephemeral);
  assertEquals(ephemeral?.destination, "Preview Stop");
  assertEquals(ephemeral?.key, "s42");
});
