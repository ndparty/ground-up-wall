import { assertEquals } from "@std/assert";
import { initTrain } from "./chain.ts";
import {
  applyApprovedWhilePaused,
  resumeFromPause,
  shouldScheduleTransition,
  shouldShowTrainControls,
} from "./playback.ts";
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

Deno.test("testShowsControlsForModerator", () => {
  assertEquals(shouldShowTrainControls("moderator"), true);
  assertEquals(shouldShowTrainControls("admin"), true);
});

Deno.test("testHidesControlsForDisplayWallUser", () => {
  assertEquals(shouldShowTrainControls("display_wall"), false);
});

Deno.test("testPauseStopsTimer", () => {
  assertEquals(shouldScheduleTransition(false, true), false);
});

Deno.test("testResumeRestartsTimer", () => {
  assertEquals(shouldScheduleTransition(true, true), true);
});

Deno.test("testAddSubmissionDuringPause", () => {
  const chain = initTrain([makeSubmission("a")]);
  const currentId = chain.current?.submission.id;
  applyApprovedWhilePaused(chain, makeSubmission("b"), false);
  assertEquals(chain.nodes.length, 2);
  assertEquals(chain.current?.submission.id, currentId);
  resumeFromPause(chain);
  assertEquals(chain.current?.submission.id, "a");
});
