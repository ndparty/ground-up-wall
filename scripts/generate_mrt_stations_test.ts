import { assertEquals, assertGreaterOrEqual } from "@std/assert";
import {
  mergeStationEntries,
  parseCodesFromLine,
  parseOperationalStations,
} from "./generate_mrt_stations.ts";
import {
  MRT_LRT_STATION_COUNT,
  MRT_LRT_STATION_ENTRIES,
  MRT_LRT_STATIONS,
} from "../lib/copy/mrt_stations.generated.ts";

const SAMPLE_MRT_WIKITEXT = `
== In operation ==
{| class="wikitable"
|-
! scope="row" | [[Jurong East MRT station|Jurong East]]
| {{lang|zh|裕廊东}}
| {{SMRT code|NS|1|EW|24}}
|-
! scope="row" | [[Dhoby Ghaut MRT station|Dhoby Ghaut]] ^
| {{SMRT code|NS|24|NE|6|CC|1}}
|-
! scope="row" | [[Bukit Panjang MRT/LRT station|Bukit Panjang]] ‡
| {{SMRT code|BP|6}}–{{SMRT code|DT|1}} [[File:ISO 7010 W003.svg|20px|alt=shelter]]
|-
! scope="row" | [[Tanah Merah MRT station|Tanah Merah]] ^
| {{SMRT code|EW|4|CG|}}
|-
! scope="row" | [[Tagore MRT station|Tagore]]
| {{Abbr|N/A|Not available}}
|}

== Under construction ==
|-
! scope="row" | [[Future Station MRT station|Future Station]]
| {{SMRT code|CR|5}}
`;

const SAMPLE_LRT_WIKITEXT = `
== In operation ==
{|
|-
| [[Bakau LRT station|Bakau]]
|码高||பக்காவ்
|{{SLRT code|SE|3}}
|-
| [[Sengkang MRT/LRT station|Sengkang]]
|{{SLRT code|STC}} {{SMRT code|NE|16}}
|}

== Closed stations ==
`;

Deno.test("parseOperationalStations extracts names with codes and stops before Under construction", () => {
  const entries = parseOperationalStations(SAMPLE_MRT_WIKITEXT);
  assertEquals(entries, [
    { name: "Jurong East", codes: ["NS1", "EW24"] },
    { name: "Dhoby Ghaut", codes: ["NS24", "NE6", "CC1"] },
    { name: "Bukit Panjang", codes: ["BP6", "DT1"] },
    { name: "Tanah Merah", codes: ["EW4", "CG"] },
    { name: "Tagore", codes: [] },
  ]);
});

Deno.test("parseOperationalStations extracts LRT pipe rows with hub codes", () => {
  const entries = parseOperationalStations(SAMPLE_LRT_WIKITEXT);
  assertEquals(entries, [
    { name: "Bakau", codes: ["SE3"] },
    { name: "Sengkang", codes: ["STC", "NE16"] },
  ]);
});

Deno.test("parseCodesFromLine handles dash-joined templates and numberless codes", () => {
  assertEquals(
    parseCodesFromLine("| {{SMRT code|BP|6}}–{{SMRT code|DT|1}}"),
    ["BP6", "DT1"],
  );
  assertEquals(parseCodesFromLine("| {{SMRT code|EW|4|CG|}}"), ["EW4", "CG"]);
  assertEquals(parseCodesFromLine("| {{rbox|Circle Line|x|#{{rcr|SMRT|CC}}|Black}}"), []);
});

Deno.test("mergeStationEntries unions codes across pages and sorts", () => {
  const merged = mergeStationEntries([
    { name: "Sengkang", codes: ["NE16"] },
    { name: "Sengkang", codes: ["STC", "NE16"] },
    { name: "Bakau", codes: ["SE3"] },
  ]);
  assertEquals(merged, [
    { name: "Bakau", codes: ["SE3"] },
    { name: "Sengkang", codes: ["NE16", "STC"] },
  ]);
});

Deno.test("committed station list has expected size, known names, and codes", () => {
  assertGreaterOrEqual(MRT_LRT_STATION_COUNT, 170);
  assertEquals(MRT_LRT_STATIONS.includes("Jurong East"), true);
  assertEquals(MRT_LRT_STATIONS.includes("HarbourFront"), true);
  assertEquals(MRT_LRT_STATIONS.includes("Bakau"), true);

  const byName = new Map(MRT_LRT_STATION_ENTRIES.map((s) => [s.name, s.codes]));
  assertEquals(byName.get("Dhoby Ghaut"), ["CC1", "NE6", "NS24"]);
  assertEquals(byName.get("Outram Park"), ["EW16", "NE3", "TE17"]);
  assertEquals(byName.get("Woodlands"), ["NS9", "TE2"]);

  for (const entry of MRT_LRT_STATION_ENTRIES) {
    assertGreaterOrEqual(entry.codes.length, 1);
  }
});
