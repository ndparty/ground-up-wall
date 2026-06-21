import { MRT_LRT_STATIONS, MRT_LRT_STATION_COUNT } from "./mrt_stations.generated.ts";

export { MRT_LRT_STATIONS, MRT_LRT_STATION_COUNT } from "./mrt_stations.generated.ts";

/** Pick a random operational MRT/LRT station name (injectable RNG for tests). */
export function pickRandomStation(rng: () => number = Math.random): string {
  const idx = Math.floor(rng() * MRT_LRT_STATION_COUNT);
  return MRT_LRT_STATIONS[idx] ?? MRT_LRT_STATIONS[0];
}
