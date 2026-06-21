/**
 * Fetch operational MRT + LRT station names from Wikipedia and write
 * lib/copy/mrt_stations.generated.ts
 *
 * Sources:
 * - https://en.wikipedia.org/wiki/List_of_Singapore_MRT_stations
 * - https://en.wikipedia.org/wiki/List_of_Singapore_LRT_stations
 */

const MRT_URL = "https://en.wikipedia.org/wiki/List_of_Singapore_MRT_stations";
const LRT_URL = "https://en.wikipedia.org/wiki/List_of_Singapore_LRT_stations";
const OUT_PATH = new URL("../lib/copy/mrt_stations.generated.ts", import.meta.url);

function normalizeName(raw: string): string | null {
  let name = raw.replace(/[*^‡†]/g, "").trim();
  // Title-case one-north style names from Wikipedia.
  if (name.toLowerCase() === "one-north") name = "one-north";
  if (!name || name === "English" || name === "Station name") return null;
  if (/^\d/.test(name)) return null;
  if (/^(North|East|Circle|Downtown|Thomson|North East|Branch Line)/i.test(name)) return null;
  return name;
}

/** Extract English station names from Wikipedia "In operation" wikitext tables. */
export function parseOperationalStations(wikitext: string): string[] {
  const names: string[] = [];
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

  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    // MRT tables: one cell per line, English name on scope=row header cell.
    if (trimmed.includes('scope="row"')) {
      const rowLink = trimmed.match(/\[\[[^\]|]+\|([^\]|*]+)\]\]/);
      if (rowLink) {
        const name = normalizeName(rowLink[1]!);
        if (name) names.push(name);
      }
      continue;
    }
    // LRT tables: classic | [[Name LRT station|Name]] | ... rows.
    if (trimmed.startsWith("|") && !trimmed.startsWith("|-") && !trimmed.startsWith("|}")) {
      const rowLink = trimmed.match(/^\|\s*\[\[[^\]|]+\|([^\]|*]+)\]\]/);
      if (rowLink) {
        const name = normalizeName(rowLink[1]!);
        if (name) names.push(name);
      }
    }
  }
  return names;
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

function dedupeSorted(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names.sort((a, b) => a.localeCompare(b))) {
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function renderTs(stations: string[], date: string): string {
  const lines = stations.map((s) => `  "${s.replace(/"/g, '\\"')}",`).join("\n");
  return `/**
 * Singapore MRT + LRT station names (operational only).
 * Sources:
 * - ${MRT_URL}
 * - ${LRT_URL}
 * Generated: ${date} — run \`deno task generate:mrt-stations\` to refresh.
 * DO NOT EDIT — changes will be overwritten.
 */
export const MRT_LRT_STATIONS = [
${lines}
] as const;

export const MRT_LRT_STATION_COUNT = MRT_LRT_STATIONS.length;
`;
}

export async function generateMrtStations(): Promise<{ count: number; path: string }> {
  const [mrtWiki, lrtWiki] = await Promise.all([
    fetchWikitext("List_of_Singapore_MRT_stations"),
    fetchWikitext("List_of_Singapore_LRT_stations"),
  ]);
  const merged = dedupeSorted([
    ...parseOperationalStations(mrtWiki),
    ...parseOperationalStations(lrtWiki),
  ]);
  if (merged.length < 170) {
    throw new Error(`Expected ~185 stations, got ${merged.length} — parser may need adjustment`);
  }
  const date = new Date().toISOString().slice(0, 10);
  const content = renderTs(merged, date);
  await Deno.writeTextFile(OUT_PATH, content);
  return { count: merged.length, path: OUT_PATH.pathname };
}

if (import.meta.main) {
  const { count, path } = await generateMrtStations();
  console.log(`✓ Wrote ${count} stations to ${path}`);
}
