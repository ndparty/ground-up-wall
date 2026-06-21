import { assertEquals } from "@std/assert";
import { highlightFlaggedWords } from "./highlight_flagged_words.ts";

Deno.test("testFlaggedWordHighlighting", () => {
  const segments = highlightFlaggedWords("this is crap content", ["crap"]);
  assertEquals(segments.length, 3);
  assertEquals(segments[0], { text: "this is ", highlighted: false });
  assertEquals(segments[1], { text: "crap", highlighted: true });
  assertEquals(segments[2], { text: " content", highlighted: false });
});

Deno.test("testNoFlaggedWords", () => {
  const segments = highlightFlaggedWords("clean message", []);
  assertEquals(segments, [{ text: "clean message", highlighted: false }]);
});

Deno.test("testSubstitutionVariantHighlighted", () => {
  // word list has "crap"; message uses leetspeak "cr@p" — original span highlighted.
  const segments = highlightFlaggedWords("no cr@p here", ["crap"]);
  assertEquals(segments[0], { text: "no ", highlighted: false });
  assertEquals(segments[1], { text: "cr@p", highlighted: true });
  assertEquals(segments[2], { text: " here", highlighted: false });
});

Deno.test("testCaseInsensitiveHighlight", () => {
  const segments = highlightFlaggedWords("HELL yeah", ["hell"]);
  assertEquals(segments[0], { text: "HELL", highlighted: true });
  assertEquals(segments[1], { text: " yeah", highlighted: false });
});
