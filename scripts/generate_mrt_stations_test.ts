import { assertEquals, assertGreaterOrEqual } from "@std/assert";
import { parseOperationalStations } from "./generate_mrt_stations.ts";
import { MRT_LRT_STATION_COUNT, MRT_LRT_STATIONS } from "../lib/copy/mrt_stations.generated.ts";

const SAMPLE_MRT_WIKITEXT = `
== In operation ==
{| class="wikitable"
|-
! scope="row" | [[Jurong East MRT station|Jurong East]]
|-
! scope="row" | [[HarbourFront MRT station|HarbourFront]]
|}

== Under construction ==
|-
! scope="row" | [[Future Station MRT station|Future Station]]
`;

const SAMPLE_LRT_WIKITEXT = `
== In operation ==
{|
|-
| [[Bakau LRT station|Bakau]]
|-
| [[Ten Mile Junction LRT station|Ten Mile Junction]]
|}

== Closed stations ==
`;

Deno.test("parseOperationalStations extracts MRT row headers and stops before Under construction", () => {
  const names = parseOperationalStations(SAMPLE_MRT_WIKITEXT);
  assertEquals(names, ["Jurong East", "HarbourFront"]);
});

Deno.test("parseOperationalStations extracts LRT pipe rows", () => {
  const names = parseOperationalStations(SAMPLE_LRT_WIKITEXT);
  assertEquals(names, ["Bakau", "Ten Mile Junction"]);
});

Deno.test("committed station list has expected size and known names", () => {
  assertGreaterOrEqual(MRT_LRT_STATION_COUNT, 170);
  assertEquals(MRT_LRT_STATIONS.includes("Jurong East"), true);
  assertEquals(MRT_LRT_STATIONS.includes("HarbourFront"), true);
  assertEquals(MRT_LRT_STATIONS.includes("Bakau"), true);
});
