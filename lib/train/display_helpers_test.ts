import { assertEquals } from "@std/assert";
import { advanceChain, clampDwellSeconds, parseDwellTime } from "./display_helpers.ts";
import { initTrain } from "./chain.ts";
import type { Submission } from "../types.ts";

function makeSubmission(id: string): Submission {
  return {
    id,
    image_url: "/x.jpg",
    message: "hi",
    submitter_name: "U",
    status: "approved",
    source: "upload",
    is_flagged: false,
    edit_count: 0,
    created_at: new Date().toISOString(),
  };
}

Deno.test("testTransitionToNextCabin", () => {
  const chain = initTrain([makeSubmission("a"), makeSubmission("b")]);
  assertEquals(advanceChain(chain), 1);
  assertEquals(advanceChain(chain), 0);
});

Deno.test("testClampDwellSeconds", () => {
  assertEquals(clampDwellSeconds(2), 3);
  assertEquals(clampDwellSeconds(100), 60);
  assertEquals(parseDwellTime("20"), 20);
});
