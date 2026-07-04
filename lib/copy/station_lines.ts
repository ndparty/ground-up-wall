import { MRT_LRT_STATION_ENTRIES } from "./mrt_stations.generated.ts";

/**
 * Official line colours per code prefix, as published on Wikipedia
 * (Module:Adjacent_stations/SMRT and /Singapore_LRT):
 * NS d42e12, EW/CG 009645, NE 9900aa, CC/CE fa9e0d, DT 005ec4, TE 9D5B25,
 * all LRT lines and hub codes (BP/SE/SW/PE/PW/STC/PTC) 748477.
 *
 * The CSS class per prefix lives in static/train.css
 * (`.train-cabin__sign-line-seg--*`).
 */
const LINE_PREFIX_CLASSES: Record<string, string> = {
  NS: "ns",
  EW: "ew",
  CG: "ew",
  NE: "ne",
  CC: "cc",
  CE: "cc",
  DT: "dt",
  TE: "te",
  BP: "lrt",
  SE: "lrt",
  SW: "lrt",
  PE: "lrt",
  PW: "lrt",
  STC: "lrt",
  PTC: "lrt",
};

export interface StationLineBadge {
  /** Full designator shown in the pill segment (e.g. "NS24", "CG"). */
  code: string;
  /** CSS modifier suffix selecting the line colour (e.g. "ns", "lrt", "unknown"). */
  line: string;
}

export function lineClassForCode(code: string): string {
  const prefix = code.replace(/\d+$/, "");
  return LINE_PREFIX_CLASSES[prefix] ?? "unknown";
}

const CODES_BY_NAME = new Map<string, readonly string[]>(
  MRT_LRT_STATION_ENTRIES.map((s) => [s.name.toLowerCase(), s.codes]),
);

/**
 * Line badges for a station name, alphabetical, any count (currently max 3;
 * rendering must support more). Empty for unknown names — QR copy, upload
 * preview placeholders, or legacy destinations persisted before a list
 * refresh — in which case the sign renders without a pill.
 */
export function stationLineBadges(name: string | undefined | null): StationLineBadge[] {
  if (!name) return [];
  const codes = CODES_BY_NAME.get(name.trim().toLowerCase()) ?? [];
  return codes.map((code) => ({ code, line: lineClassForCode(code) }));
}
