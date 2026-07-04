/**
 * Fetch operational MRT + LRT station names AND their line codes from
 * Wikipedia and write lib/copy/mrt_stations.generated.ts
 *
 * Sources:
 * - https://en.wikipedia.org/wiki/List_of_Singapore_MRT_stations
 * - https://en.wikipedia.org/wiki/List_of_Singapore_LRT_stations
 *
 * Line codes come from the `{{SMRT code|NS|24|NE|6|CC|1}}` / `{{SLRT code|SE|3}}`
 * templates in the "In operation" tables. Known shapes handled:
 * - multiple templates in one cell joined by a dash (Bukit Panjang: BP6–DT1)
 * - numberless branch codes (Tanah Merah: EW4 + CG)
 * - hub codes (Sengkang: NE16 + STC; Punggol: NE17 + PTC)
 * - rows without any codes are dropped with a warning (e.g. Tagore, listed
 *   as in operation with N/A cells)
 */

const MRT_URL = "https://en.wikipedia.org/wiki/List_of_Singapore_MRT_stations";
const LRT_URL = "https://en.wikipedia.org/wiki/List_of_Singapore_LRT_stations";
const OUT_PATH = new URL("../lib/copy/mrt_stations.generated.ts", import.meta.url);

export interface StationEntry {
  name: string;
  codes: string[];
}

function normalizeName(raw: string): string | null {
  let name = raw.replace(/[*^‡†]/g, "").trim();
  // Title-case one-north style names from Wikipedia.
  if (name.toLowerCase() === "one-north") name = "one-north";
  if (!name || name === "English" || name === "Station name") return null;
  if (/^\d/.test(name)) return null;
  if (/^(North|East|Circle|Downtown|Thomson|North East|Branch Line)/i.test(name)) return null;
  return name;
}

const CODE_TEMPLATE_RE = /\{\{[A-Z]*\s*code\s*\|([^}]*)\}\}/gi;

/** Parse every station-code template in a table cell line (may contain several). */
export function parseCodesFromLine(line: string): string[] {
  const codes: string[] = [];
  for (const match of line.matchAll(CODE_TEMPLATE_RE)) {
    const parts = match[1]!.split("|").map((s) => s.trim()).filter((s) => s.length > 0);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (!/^[A-Z]{2,4}$/.test(part)) continue;
      const next = parts[i + 1];
      if (next !== undefined && /^\d+$/.test(next)) {
        codes.push(part + next);
        i++;
      } else {
        // Numberless codes are real signage (CG branch, STC/PTC hubs).
        codes.push(part);
      }
    }
  }
  return codes;
}

/** Extract stations with line codes from Wikipedia "In operation" wikitext tables. */
export function parseOperationalStations(wikitext: string): StationEntry[] {
  const entries: StationEntry[] = [];
  const inOpMatch = wikitext.match(/={2,3}\s*In operation\s*={2,3}/i);
  const inOp = inOpMatch?.index ?? -1;
  let section = inOp >= 0 ? wikitext.slice(inOp) : wikitext;
  if (inOp >= 0) {
    const after = section.slice(1);
    const endMatch = after.match(/\n={2,3}\s*(?:Under construction|Closed stations?|Planned)/i);
    if (endMatch?.index !== undefined) {
      section = section.slice(0, endMatch.index + 1);
    }
  }

  const lines = section.split("\n");
  let current: StationEntry | null = null;

  const flush = () => {
    if (current) entries.push(current);
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // MRT tables: one cell per line, English name on scope=row header cell.
    if (trimmed.includes('scope="row"')) {
      flush();
      const rowLink = trimmed.match(/\[\[[^\]|]+\|([^\]|*]+)\]\]/);
      const name = rowLink ? normalizeName(rowLink[1]!) : null;
      current = name ? { name, codes: [] } : null;
      continue;
    }

    // LRT tables historically used classic | [[Name LRT station|Name]] | ... rows.
    if (
      trimmed.startsWith("|") && !trimmed.startsWith("|-") && !trimmed.startsWith("|}") &&
      /^\|\s*\[\[[^\]|]+ (?:LRT|MRT)[^\]|]*\|/.test(trimmed)
    ) {
      const rowLink = trimmed.match(/^\|\s*\[\[[^\]|]+\|([^\]|*]+)\]\]/);
      const name = rowLink ? normalizeName(rowLink[1]!) : null;
      if (name) {
        flush();
        current = { name, codes: [] };
        continue;
      }
    }

    if (trimmed === "|-" || trimmed.startsWith("|}")) {
      flush();
      continue;
    }

    if (current) {
      current.codes.push(...parseCodesFromLine(trimmed));
    }
  }
  flush();
  return entries;
}

async function fetchWikitext(page: string): Promise<string> {
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "parse");
  api.searchParams.set("page", page);
  api.searchParams.set("prop", "wikitext");
  api.searchParams.set("format", "json");
  api.searchParams.set("origin", "*");

  const res = await fetch(api);
  if (!res.ok) throw new Error(`Wikipedia API failed for ${page}: ${res.status}`);
  const data = await res.json() as { parse?: { wikitext?: { "*": string } } };
  const text = data.parse?.wikitext?.["*"];
  if (!text) throw new Error(`No wikitext for ${page}`);
  return text;
}

/** Merge duplicate stations across pages (union of codes), sort by name, sort codes. */
export function mergeStationEntries(entries: StationEntry[]): StationEntry[] {
  const byKey = new Map<string, StationEntry>();
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.codes = [...new Set([...existing.codes, ...entry.codes])];
    } else {
      byKey.set(key, { name: entry.name, codes: [...new Set(entry.codes)] });
    }
  }
  const merged = [...byKey.values()];
  for (const entry of merged) entry.codes.sort((a, b) => a.localeCompare(b));
  merged.sort((a, b) => a.name.localeCompare(b.name));
  return merged;
}

function renderTs(stations: StationEntry[], date: string): string {
  // JSON.stringify fully escapes quotes, backslashes, newlines, and line/paragraph
  // separators so poisoned/MITM'd Wikipedia content cannot inject TypeScript here.
  const lines = stations
    .map((s) =>
      `  { name: ${JSON.stringify(s.name)}, codes: [${
        s.codes.map((c) => JSON.stringify(c)).join(", ")
      }] },`
    )
    .join("\n");
  return `/**
 * Singapore MRT + LRT stations (operational only) with their line codes.
 * Sources:
 * - ${MRT_URL}
 * - ${LRT_URL}
 * Generated: ${date} — run \`deno task generate:mrt-stations\` to refresh.
 * DO NOT EDIT — changes will be overwritten.
 */
export interface GeneratedStationEntry {
  name: string;
  /** Line codes in alphabetical order (e.g. Dhoby Ghaut: CC1, NE6, NS24). */
  codes: readonly string[];
}

export const MRT_LRT_STATION_ENTRIES: readonly GeneratedStationEntry[] = [
${lines}
];

export const MRT_LRT_STATIONS: readonly string[] = MRT_LRT_STATION_ENTRIES.map((s) => s.name);

export const MRT_LRT_STATION_COUNT = MRT_LRT_STATIONS.length;
`;
}

export async function generateMrtStations(): Promise<{ count: number; path: string }> {
  const [mrtWiki, lrtWiki] = await Promise.all([
    fetchWikitext("List_of_Singapore_MRT_stations"),
    fetchWikitext("List_of_Singapore_LRT_stations"),
  ]);
  const merged = mergeStationEntries([
    ...parseOperationalStations(mrtWiki),
    ...parseOperationalStations(lrtWiki),
  ]);

  const withCodes = merged.filter((s) => s.codes.length > 0);
  for (const dropped of merged.filter((s) => s.codes.length === 0)) {
    console.warn(`⚠ Dropping station without line codes: ${dropped.name}`);
  }

  if (withCodes.length < 170) {
    throw new Error(
      `Expected ~185 stations, got ${withCodes.length} — parser may need adjustment`,
    );
  }
  const date = new Date().toISOString().slice(0, 10);
  const content = renderTs(withCodes, date);
  await Deno.writeTextFile(OUT_PATH, content);
  return { count: withCodes.length, path: OUT_PATH.pathname };
}

if (import.meta.main) {
  const { count, path } = await generateMrtStations();
  console.log(`✓ Wrote ${count} stations to ${path}`);
}
