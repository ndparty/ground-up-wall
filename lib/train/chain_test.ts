import { assertEquals, assertExists } from "@std/assert";
import type { Submission } from "../types.ts";
import {
  addSubmission,
  getNodeByCabinNumber,
  initTrain,
  isChainCircular,
  jumpToCabin,
  rebuildChain,
  removeSubmission,
  transitionToNext,
  updateSubmission,
} from "./chain.ts";

function makeSubmission(id: string, message = "msg"): Submission {
  return {
    id,
    image_url: `/img/${id}.jpg`,
    message,
    submitter_name: "User",
    status: "approved",
    source: "upload",
    is_flagged: false,
    edit_count: 0,
    created_at: new Date().toISOString(),
  };
}

Deno.test("testInitCreatesCircularChain", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b"), makeSubmission("c")]);
  assertExists(chain.head);
  assertEquals(chain.head!.submission.id, "a");
  assertEquals(chain.head!.prev!.submission.id, "c");
  assertEquals(chain.head!.prev!.next, chain.head);
});

Deno.test("testGetNodeByCabinNumber", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b")]);
  assertEquals(getNodeByCabinNumber(chain, 1)?.submission.id, "a");
  assertEquals(getNodeByCabinNumber(chain, 2)?.submission.id, "b");
});

Deno.test("testGetNodeClampsOutOfRange", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b")]);
  assertEquals(getNodeByCabinNumber(chain, 0)?.submission.id, "a");
  assertEquals(getNodeByCabinNumber(chain, 99)?.submission.id, "b");
});

Deno.test("testRebuildPreservesOrder", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b")]);
  chain.current = chain.nodes[1];
  rebuildChain(chain, [makeSubmission("a"), makeSubmission("b"), makeSubmission("c")]);
  assertEquals(chain.nodes.map((n) => n.submission.id), ["a", "b", "c"]);
  assertEquals(chain.current?.submission.id, "b");
});

Deno.test("testEmptyChain", () => {
  const chain = initTrain([]);
  assertEquals(chain.nodes.length, 0);
  assertEquals(chain.head, null);
  assertEquals(chain.current, null);
});

Deno.test("testSingleCabinChain", () => {
  const chain = initTrain([makeSubmission("solo")]);
  assertEquals(chain.head!.next, chain.head);
  assertEquals(chain.head!.prev, chain.head);
});

Deno.test("testAddSubmission", () => {
  const chain = initTrain([makeSubmission("a")]);
  addSubmission(chain, makeSubmission("b"));
  assertEquals(chain.nodes.length, 2);
  assertEquals(chain.nodes[1].submission.id, "b");
  assertEquals(chain.head!.prev!.submission.id, "b");
});

Deno.test("testUpdateSubmission", () => {
  const chain = initTrain([makeSubmission("a", "old")]);
  updateSubmission(chain, makeSubmission("a", "new"));
  assertEquals(chain.nodes[0].submission.message, "new");
});

Deno.test("testRemoveSubmission", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b"), makeSubmission("c")]);
  chain.current = chain.nodes[1];
  removeSubmission(chain, "b");
  assertEquals(chain.nodes.map((n) => n.submission.id), ["a", "c"]);
  assertEquals(chain.current?.submission.id, "c");
});

Deno.test("testTransitionToNext", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b")]);
  assertEquals(chain.current?.submission.id, "a");
  transitionToNext(chain);
  assertEquals(chain.current?.submission.id, "b");
  transitionToNext(chain);
  assertEquals(chain.current?.submission.id, "a");
});

Deno.test("testJumpToCabinForward", () => {
  const chain = initTrain([
    makeSubmission("a"),
    makeSubmission("b"),
    makeSubmission("c"),
    makeSubmission("d"),
  ]);
  jumpToCabin(chain, 4);
  assertEquals(chain.current?.submission.id, "d");
  assertEquals(isChainCircular(chain), true);
});

Deno.test("testJumpToCabinBackward", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b"), makeSubmission("c")]);
  chain.current = chain.nodes[2];
  jumpToCabin(chain, 1);
  assertEquals(chain.current?.submission.id, "a");
  assertEquals(isChainCircular(chain), true);
});

Deno.test("testJumpToCurrentCabin", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b")]);
  jumpToCabin(chain, 1);
  assertEquals(chain.current?.submission.id, "a");
});

Deno.test("testJumpToNextCabin", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b"), makeSubmission("c")]);
  jumpToCabin(chain, 2);
  assertEquals(chain.current?.submission.id, "b");
});

Deno.test("testJumpOutOfRangeClamps", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b")]);
  jumpToCabin(chain, 99);
  assertEquals(chain.current?.submission.id, "b");
  jumpToCabin(chain, 0);
  assertEquals(chain.current?.submission.id, "a");
});

Deno.test("testJumpEmptyTrain", () => {
  const chain = initTrain([]);
  jumpToCabin(chain, 1);
  assertEquals(chain.current, null);
});

Deno.test("testJumpChainIntegrity", () => {
  const chain = initTrain([
    makeSubmission("a"),
    makeSubmission("b"),
    makeSubmission("c"),
    makeSubmission("d"),
  ]);
  jumpToCabin(chain, 3);
  assertEquals(isChainCircular(chain), true);
  assertEquals(chain.nodes.map((n) => n.submission.id), ["a", "b", "c", "d"]);
});

Deno.test("testMultipleJumpsChainIntegrity", () => {
  const subs = ["a", "b", "c", "d", "e", "f"].map((id) => makeSubmission(id));
  const chain = initTrain(subs);
  const jumps = [4, 1, 6, 2, 5, 3];
  for (const cabin of jumps) {
    jumpToCabin(chain, cabin);
    assertEquals(isChainCircular(chain), true);
    assertEquals(chain.nodes.map((n) => n.submission.id), subs.map((s) => s.id));
  }
});
