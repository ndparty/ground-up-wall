import { assertEquals } from "@std/assert";
import { lineClassForCode, stationLineBadges } from "./station_lines.ts";

Deno.test("stationLineBadges maps real interchange stations to ordered coloured codes", () => {
  assertEquals(stationLineBadges("Dhoby Ghaut"), [
    { code: "CC1", line: "cc" },
    { code: "NE6", line: "ne" },
    { code: "NS24", line: "ns" },
  ]);
  assertEquals(stationLineBadges("Outram Park"), [
    { code: "EW16", line: "ew" },
    { code: "NE3", line: "ne" },
    { code: "TE17", line: "te" },
  ]);
  assertEquals(stationLineBadges("Woodlands"), [
    { code: "NS9", line: "ns" },
    { code: "TE2", line: "te" },
  ]);
});

Deno.test("stationLineBadges handles LRT, hub, and branch codes", () => {
  assertEquals(stationLineBadges("Sumang"), [{ code: "PW6", line: "lrt" }]);
  assertEquals(stationLineBadges("Sengkang"), [
    { code: "NE16", line: "ne" },
    { code: "STC", line: "lrt" },
  ]);
  assertEquals(stationLineBadges("Tanah Merah"), [
    { code: "CG", line: "ew" },
    { code: "EW4", line: "ew" },
  ]);
});

Deno.test("stationLineBadges is case-insensitive and empty for unknown names", () => {
  assertEquals(stationLineBadges("woodlands").length, 2);
  assertEquals(stationLineBadges("Join the wall"), []);
  assertEquals(stationLineBadges("—"), []);
  assertEquals(stationLineBadges(""), []);
  assertEquals(stationLineBadges(null), []);
});

Deno.test("lineClassForCode falls back to unknown for unmapped prefixes", () => {
  assertEquals(lineClassForCode("NS24"), "ns");
  assertEquals(lineClassForCode("CG"), "ew");
  assertEquals(lineClassForCode("PTC"), "lrt");
  assertEquals(lineClassForCode("XX9"), "unknown");
});
