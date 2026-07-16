import {
  MRT_LRT_STATION_COUNT,
  MRT_LRT_STATION_ENTRIES,
  MRT_LRT_STATIONS,
} from "./mrt_stations.generated.ts";

export { MRT_LRT_STATION_COUNT, MRT_LRT_STATIONS } from "./mrt_stations.generated.ts";

/** Small deterministic PRNG for reproducible server-generated display content. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

/** Pick a random operational MRT/LRT station name (injectable RNG for tests). */
export function pickRandomStation(rng: () => number = Math.random): string {
  const idx = Math.floor(rng() * MRT_LRT_STATION_COUNT);
  return MRT_LRT_STATIONS[idx] ?? MRT_LRT_STATIONS[0];
}

const byName = new Map(MRT_LRT_STATION_ENTRIES.map((s) => [s.name.toLowerCase(), s]));

/** System logos for cabin signs: MRT first when both; default MRT for unknown names. */
export function stationSystemLogos(name: string): ("lrt" | "mrt")[] {
  const entry = byName.get(name.toLowerCase());
  if (!entry) return ["mrt"];
  if (entry.onLrtList && entry.onMrtList) return ["mrt", "lrt"];
  if (entry.onLrtList) return ["lrt"];
  return ["mrt"];
}
