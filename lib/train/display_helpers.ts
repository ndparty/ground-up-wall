import { type TrainChain, transitionToNext } from "./chain.ts";

export function clampDwellSeconds(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(3, Math.min(60, Math.round(value)));
}

export function parseDwellTime(configValue: string | undefined | null): number {
  if (!configValue) return 10;
  const parsed = Number.parseInt(configValue, 10);
  return clampDwellSeconds(parsed);
}

/** Recurring QR cabin interval in cabin advances; 0 (or invalid) disables it. */
export function parseQrInterval(configValue: string | undefined | null): number {
  if (!configValue) return 0;
  const parsed = Number.parseInt(configValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 999);
}

export function advanceChain(chain: TrainChain): number {
  transitionToNext(chain);
  return chain.current?.index ?? 0;
}
