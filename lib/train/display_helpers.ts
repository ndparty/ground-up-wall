import { transitionToNext, type TrainChain } from "./chain.ts";

export function clampDwellSeconds(value: number): number {
  if (!Number.isFinite(value)) return 15;
  return Math.max(3, Math.min(60, Math.round(value)));
}

export function parseDwellTime(configValue: string | undefined | null): number {
  if (!configValue) return 15;
  const parsed = Number.parseInt(configValue, 10);
  return clampDwellSeconds(parsed);
}

export function advanceChain(chain: TrainChain): number {
  transitionToNext(chain);
  return chain.current?.index ?? 0;
}
