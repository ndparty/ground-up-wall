import { assertEquals } from "@std/assert";
import {
  advanceOneStep,
  applyEphemeralInsert,
  applyServerAdvance,
  beginJump,
  computeCollapsedIndices,
  computeJumpAnimationPath,
  computeJumpStepCount,
  forwardDistance,
  getCurrentCabin,
  getRenderWindow,
  initTrainView,
  reduceTrainViewEvent,
  shouldCollapseJump,
  snapToCabin,
} from "./train_view.ts";
import { LEFT_RENDER, RIGHT_RENDER, VIEWPORT_K } from "./train_view_constants.ts";
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

function collapsedCabins(fromCabin: number, toCabin: number, n = 40): number[] {
  const set = computeCollapsedIndices(fromCabin - 1, toCabin - 1, n, VIEWPORT_K);
  return [...set].map((i) => i + 1).sort((a, b) => a - b);
}

function runJumpToTarget(from: number, to: number, n = 40): {
  steps: number;
  path: number[];
} {
  let state = initTrainView(makeSubmissions(n));
  state = snapToCabin(state, from);
  state = beginJump(state, to);
  const steps = state.jump!.stepsRemaining;
  const path = [getCurrentCabin(state)];
  let guard = 50;
  while (state.jump && guard-- > 0) {
    state = advanceOneStep(state);
    path.push(getCurrentCabin(state));
  }
  assertEquals(getCurrentCabin(state), to);
  assertEquals(state.jump, null);
  return { steps, path };
}

Deno.test("forwardDistance wraps correctly", () => {
  assertEquals(forwardDistance(7, 19, 40), 12);
  assertEquals(forwardDistance(39, 2, 40), 3);
  assertEquals(forwardDistance(5, 5, 40), 0);
});

Deno.test("computeCollapsedIndices keeps K after V and K before T", () => {
  const collapsed = computeCollapsedIndices(7, 19, 40, VIEWPORT_K);
  assertEquals(collapsed.has(7), false);
  assertEquals(collapsed.has(8), false);
  assertEquals(collapsed.has(11), false);
  assertEquals(collapsed.has(12), true);
  assertEquals(collapsed.has(13), true);
  assertEquals(collapsed.has(14), true);
  assertEquals(collapsed.has(15), false);
  assertEquals(collapsed.has(19), false);
});

Deno.test("computeCollapsedIndices empty when distance <= 2K", () => {
  assertEquals(collapsedCabins(40, 3), []);
  assertEquals(collapsedCabins(39, 4), []);
  assertEquals(collapsedCabins(1, 9), []);
});

Deno.test("golden jump 8 to 20", () => {
  assertEquals(
    computeJumpAnimationPath(8, 20, 40),
    [8, 9, 10, 11, 12, 16, 17, 18, 19, 20],
  );
  assertEquals(collapsedCabins(8, 20), [13, 14, 15]);
  assertEquals(computeJumpStepCount(8, 20, 40), 9);
  const { steps, path } = runJumpToTarget(8, 20);
  assertEquals(steps, 9);
  assertEquals(path, [8, 9, 10, 11, 12, 16, 17, 18, 19, 20]);
});

Deno.test("golden jump 20 to 8", () => {
  assertEquals(
    computeJumpAnimationPath(20, 8, 40),
    [20, 21, 22, 23, 24, 4, 5, 6, 7, 8],
  );
  assertEquals(collapsedCabins(20, 8).length, 19);
  assertEquals(computeJumpStepCount(20, 8, 40), 9);
  const { steps, path } = runJumpToTarget(20, 8);
  assertEquals(steps, 9);
  assertEquals(path, [20, 21, 22, 23, 24, 4, 5, 6, 7, 8]);
});

Deno.test("golden jump 10 to 9", () => {
  assertEquals(
    computeJumpAnimationPath(10, 9, 40),
    [10, 11, 12, 13, 14, 5, 6, 7, 8, 9],
  );
  assertEquals(computeJumpStepCount(10, 9, 40), 9);
  const { steps, path } = runJumpToTarget(10, 9);
  assertEquals(steps, 9);
  assertEquals(path, [10, 11, 12, 13, 14, 5, 6, 7, 8, 9]);
});

Deno.test("golden jump 40 to 3 — no collapse", () => {
  assertEquals(computeJumpAnimationPath(40, 3, 40), [40, 1, 2, 3]);
  assertEquals(shouldCollapseJump(39, 2, 40), false);
  const { steps, path } = runJumpToTarget(40, 3);
  assertEquals(steps, 3);
  assertEquals(path, [40, 1, 2, 3]);
});

Deno.test("golden jump 39 to 4 — buffer overlap, no collapse", () => {
  assertEquals(computeJumpAnimationPath(39, 4, 40), [39, 40, 1, 2, 3, 4]);
  assertEquals(collapsedCabins(39, 4), []);
  assertEquals(shouldCollapseJump(38, 3, 40), false);
  const { steps, path } = runJumpToTarget(39, 4);
  assertEquals(steps, 5);
  assertEquals(path, [39, 40, 1, 2, 3, 4]);
});

Deno.test("jump 1 to 10 — d > 2K but adjacent buffers, full path", () => {
  assertEquals(
    computeJumpAnimationPath(1, 10, 40),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assertEquals(collapsedCabins(1, 10), []);
  assertEquals(computeJumpStepCount(1, 10, 40), 9);
});

Deno.test("beginJump sets steps and reaches target after animation steps", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 8);
  state = beginJump(state, 20);
  assertEquals(state.jump?.targetCabin, 20);
  assertEquals(state.jump!.stepsRemaining, 9);

  const steps = state.jump!.stepsRemaining;
  for (let i = 0; i < steps; i++) {
    state = advanceOneStep(state);
  }
  assertEquals(getCurrentCabin(state), 20);
  assertEquals(state.jump, null);
});

Deno.test("adjacent jump uses one step", () => {
  let state = initTrainView(makeSubmissions(10));
  state = snapToCabin(state, 3);
  state = beginJump(state, 4);
  assertEquals(state.jump?.stepsRemaining, 1);
  state = advanceOneStep(state);
  assertEquals(getCurrentCabin(state), 4);
});

Deno.test("wrap jump 40 to 3 uses forward path only", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 40);
  state = beginJump(state, 3);
  assertEquals(state.jump!.stepsRemaining, 3);
  let guard = 50;
  while (state.jump && guard-- > 0) {
    state = advanceOneStep(state);
  }
  assertEquals(getCurrentCabin(state), 3);
});

Deno.test("FR-20a: ephemeral insert lands just outside visible band and leaves it unchanged", () => {
  let state = initTrainView(makeSubmissions(20));
  state = snapToCabin(state, 8);
  const centerId = state.base.current!.submission.id;
  const before = getRenderWindow(state);
  const beforeCenter = before.findIndex((n) => n.submission.id === centerId);

  state = applyEphemeralInsert(state, makeSubmission("new-1", 99));
  assertEquals(state.ephemeralInserts.length, 1);

  const after = getRenderWindow(state);
  const afterCenter = after.findIndex((n) => n.submission.id === centerId);
  const newPos = after.findIndex((n) => n.submission.id === "new-1");

  // New cabin renders at +K+1 — one slot beyond the right edge of the visible band.
  assertEquals(newPos, afterCenter + VIEWPORT_K + 1);

  // Every cabin within the visible band (+-K) is identical before and after the insert.
  for (let off = -VIEWPORT_K; off <= VIEWPORT_K; off++) {
    assertEquals(
      after[afterCenter + off]?.submission.id,
      before[beforeCenter + off]?.submission.id,
    );
  }
});

Deno.test("FR-20a: ephemeral insert is shown then evicted only after leaving the left edge", () => {
  let state = initTrainView(makeSubmissions(20));
  state = snapToCabin(state, 8);
  state = applyEphemeralInsert(state, makeSubmission("new-1", 99));

  // Not centered yet — it sits off-screen to the right at insert time.
  assertEquals(state.base.current?.submission.id === "new-1", false);

  let became = false;
  for (let i = 0; i < VIEWPORT_K + 2; i++) {
    state = applyServerAdvance(state);
    if (state.base.current?.submission.id === "new-1") {
      became = true;
      break;
    }
  }
  assertEquals(became, true);
  assertEquals(state.ephemeralInserts.length, 1);

  // Advance past it; eviction happens only once it is beyond the left edge.
  for (let i = 0; i < VIEWPORT_K + 2; i++) {
    state = applyServerAdvance(state);
  }
  assertEquals(state.ephemeralInserts.length, 0);
});

Deno.test("FR-20a: small ring (n <= 2K+1) appends without ephemeral surgery", () => {
  let state = initTrainView(makeSubmissions(VIEWPORT_K * 2 + 1));
  state = snapToCabin(state, 1);
  state = applyEphemeralInsert(state, makeSubmission("new-small", 99));

  assertEquals(state.ephemeralInserts.length, 0);
  assertEquals(state.base.nodes.some((n) => n.submission.id === "new-small"), true);
});

Deno.test("reduceTrainViewEvent determinism — same events same state", () => {
  const events = [
    { type: "snap" as const, cabinNumber: 5 },
    { type: "jump" as const, cabinNumber: 12 },
    { type: "animation_step" as const },
    { type: "animation_step" as const },
    { type: "animation_step" as const },
    { type: "animation_step" as const },
    { type: "animation_step" as const },
    { type: "animation_step" as const },
    { type: "animation_step" as const },
    { type: "animation_step" as const },
  ];

  function run(): number {
    let state = initTrainView(makeSubmissions(20));
    for (const ev of events) {
      state = reduceTrainViewEvent(state, ev);
      while (state.jump && state.jump.stepsRemaining > 0) {
        state = reduceTrainViewEvent(state, { type: "animation_step" });
      }
    }
    return getCurrentCabin(state);
  }

  assertEquals(run(), run());
});

Deno.test("snapToCabin instant bootstrap", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 25);
  assertEquals(getCurrentCabin(state), 25);
  assertEquals(state.jump, null);
});

Deno.test("getRenderWindow uses ring order at wrap boundary", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 40);
  const window = getRenderWindow(state);
  const indices = window.map((n) => n.index);
  assertEquals(indices[0], 35);
  assertEquals(indices[indices.length - 1], 9);
  const idx39 = indices.indexOf(39);
  const idx0 = indices.indexOf(0);
  assertEquals(idx0, idx39 + 1);
});

Deno.test("getRenderWindow is forward-biased with K left and larger right buffer", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 20);
  const window = getRenderWindow(state);
  const centerIdx = 19;
  const centerPos = window.findIndex((n) => n.index === centerIdx);
  assertEquals(centerPos, LEFT_RENDER);
  assertEquals(window.length, LEFT_RENDER + 1 + RIGHT_RENDER);
  assertEquals(window.slice(0, centerPos).length, LEFT_RENDER);
  assertEquals(window.slice(centerPos + 1).length, RIGHT_RENDER);
});

Deno.test("getRenderWindow jump 8 to 20 covers path and context", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 8);
  state = beginJump(state, 20);
  const window = getRenderWindow(state);
  const cabins = new Set(window.map((n) => n.index + 1));

  for (let c = 4; c <= 7; c++) assertEquals(cabins.has(c), true);
  for (let c = 8; c <= 12; c++) assertEquals(cabins.has(c), true);
  for (let c = 13; c <= 15; c++) assertEquals(cabins.has(c), false);
  for (let c = 16; c <= 20; c++) assertEquals(cabins.has(c), true);
  for (let c = 21; c <= 24; c++) assertEquals(cabins.has(c), true);

  const centerPos = window.findIndex((n) => n.index === 7);
  assertEquals(centerPos, LEFT_RENDER);
});

Deno.test("getRenderWindow excludes collapsed cabins during jump", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 8);
  state = beginJump(state, 20);
  const collapsedIds = state.jump!.collapsedIds;
  const window = getRenderWindow(state);
  for (const node of window) {
    assertEquals(collapsedIds.has(node.submission.id), false);
  }
});

Deno.test("long forward jump 10 to 9 animates", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 10);
  state = beginJump(state, 9);
  assertEquals(state.jump?.targetCabin, 9);
  assertEquals(state.jump!.stepsRemaining, 9);

  const steps = state.jump!.stepsRemaining;
  for (let i = 0; i < steps; i++) {
    state = advanceOneStep(state);
  }
  assertEquals(state.jump, null);
  assertEquals(getCurrentCabin(state), 9);
});

Deno.test("moderate forward jump 20 to 8 animates", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 20);
  state = beginJump(state, 8);
  assertEquals(state.jump?.targetCabin, 8);
  assertEquals(state.jump!.stepsRemaining, 9);

  const steps = state.jump!.stepsRemaining;
  for (let i = 0; i < steps; i++) {
    state = advanceOneStep(state);
  }
  assertEquals(state.jump, null);
  assertEquals(getCurrentCabin(state), 8);
});

Deno.test("short forward jump 8 to 20 animates", () => {
  let state = initTrainView(makeSubmissions(40));
  state = snapToCabin(state, 8);
  state = beginJump(state, 20);
  assertEquals(state.jump?.targetCabin, 20);
  assertEquals(state.jump!.stepsRemaining, 9);
});

