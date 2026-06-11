import { assertEquals } from "@std/assert";
import { mapCommandToOverrideState, resolveOverrideView } from "./display_override.ts";

Deno.test("testBlankScreenHidesTrain", () => {
  assertEquals(resolveOverrideView({ type: "blank" }), "blank");
});

Deno.test("testPlaceholderShowsImage", () => {
  assertEquals(
    resolveOverrideView({ type: "placeholder", imageUrl: "/placeholder.jpg" }),
    "placeholder",
  );
});

Deno.test("testResumeRestoresTrain", () => {
  assertEquals(resolveOverrideView(mapCommandToOverrideState("resume")), "train");
  assertEquals(resolveOverrideView({ type: "normal" }), "train");
});
