import { assertEquals } from "@std/assert";
import { mergeMissingDefaultWords } from "./parameter_validation.ts";

Deno.test("mergeMissingDefaultWords preserves custom words and appends missing defaults", () => {
  const merged = mergeMissingDefaultWords(["damn", "customword"]);
  assertEquals(merged[0], "damn");
  assertEquals(merged[1], "customword");
  assertEquals(merged.includes("hell"), true);
  assertEquals(merged.includes("crap"), true);
  assertEquals(merged.filter((w) => w === "damn").length, 1);
});
