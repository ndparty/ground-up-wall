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

Deno.test("testSeparatorEvasion", () => {
  const result = service.checkMessage("what the f*ck", SEEDED_DEFAULT_WORD_LIST);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words.includes("fck"), true);
});

Deno.test("testSpacedEvasion", () => {
  const result = service.checkMessage("s h i t happens", ["shit"]);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words, ["shit"]);
});

Deno.test("testDottedEvasion", () => {
  const result = service.checkMessage("f.u.c.k this", ["fuck"]);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words, ["fuck"]);
});

Deno.test("testRepeatedLetterEvasion", () => {
  const result = service.checkMessage("shiiit happens", ["shit"]);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words, ["shit"]);
});

Deno.test("testExtendedLeetspeak", () => {
  const result = service.checkMessage("shi7 happens", ["shit"]);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words, ["shit"]);
});

Deno.test("testAbbrevMatch", () => {
  const result = service.checkMessage("seriously wtf", ["wtf"]);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words, ["wtf"]);
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

Deno.test("testNoFalsePositiveInnocentWords", () => {
  const result = service.checkMessage(
    "class passion Singapore alliance still",
    SEEDED_DEFAULT_WORD_LIST,
  );
  assertEquals(result.is_flagged, false);
});

Deno.test("testSeededDefaultWordList", () => {
  const result = service.checkMessage("That is complete crap", SEEDED_DEFAULT_WORD_LIST);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words.includes("crap"), true);
});

Deno.test("testSeededCompoundProfanity", () => {
  const result = service.checkMessage("that's bullshit", SEEDED_DEFAULT_WORD_LIST);
  assertEquals(result.is_flagged, true);
  assertEquals(result.flagged_words.includes("bullshit"), true);
});
