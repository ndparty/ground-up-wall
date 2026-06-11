import { assertEquals } from "@std/assert";
import {
  AutoModeratorServiceImpl,
  SEEDED_DEFAULT_WORD_LIST,
} from "./auto_moderator_service_impl.ts";

const service = new AutoModeratorServiceImpl();

Deno.test("testCaseInsensitiveMatch", () => {
  const result = service.checkMessage("What the HELL is this", ["hell"]);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words, ["hell"]);
});

Deno.test("testUnicodeMatch", () => {
  const result = service.checkMessage("naïve party vibes", ["naïve"]);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words, ["naïve"]);
});

Deno.test("testCharacterSubstitution", () => {
  const result = service.checkMessage("$hit and @ss", ["shit", "ass"]);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words.includes("shit"), true);
  assertEquals(result.flagged_words.includes("ass"), true);
});

Deno.test("testEmptyWordList", () => {
  const result = service.checkMessage("anything goes", []);
  assertEquals(result.is_flagged, false);
  assertEquals(result.flagged_words, []);
});

Deno.test("testNoFalsePositive", () => {
  const result = service.checkMessage("Happy National Day!", ["shit", "fuck"]);
  assertEquals(result.is_flagged, false);
});

Deno.test("testSeededDefaultWordList", () => {
  const result = service.checkMessage("That is complete crap", SEEDED_DEFAULT_WORD_LIST);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words.includes("crap"), true);
});
