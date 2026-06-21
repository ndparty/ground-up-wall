import type { TrainStep } from "../interfaces/realtime_service.ts";
import type { Submission } from "../types.ts";
import type { TrainCabinNode } from "./chain.ts";
import { forwardPathIndices } from "./train_view.ts";
import { PRELOAD_AHEAD, VIEWPORT_K } from "./train_view_constants.ts";

/** Resolve image URLs for canonical cabin numbers on the ring (deduped, path order). */
export function imageUrlsForCanonicalPath(path: number[], canonical: Submission[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const cabin of path) {
    const url = canonical[cabin - 1]?.image_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/** Resolve post image URLs from generator steps (includes ephemeral previews). */
export function imageUrlsFromWindow(steps: TrainStep[], canonical: Submission[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    if (step.kind !== "post" || !step.submissionId) continue;
    const url = canonical.find((s) => s.id === step.submissionId)?.image_url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/** Canonical ring slots for a rebuilt window centered on target: T−K .. T+K+PRELOAD_AHEAD. */
export function cabinsAroundTargetWithBuffer(
  targetCabin: number,
  length: number,
  k = VIEWPORT_K,
  preloadAhead = PRELOAD_AHEAD,
): number[] {
  if (length === 0) return [];
  const targetIdx = targetCabin - 1;
  const ordered: number[] = [];
  const seen = new Set<number>();
  for (let off = -k; off <= k + preloadAhead; off++) {
    const cabin = ((targetIdx + off + length) % length) + 1;
    if (seen.has(cabin)) continue;
    seen.add(cabin);
    ordered.push(cabin);
  }
  return ordered;
}

/** Path cabins plus K ring slots after the jump target (jump render window tail). */
export function cabinsForJumpPreload(
  path: number[],
  targetCabin: number,
  length: number,
  k = VIEWPORT_K,
): number[] {
  if (length === 0) return [...path];
  const ordered: number[] = [];
  const seen = new Set<number>();
  const add = (cabin: number) => {
    if (cabin < 1 || cabin > length || seen.has(cabin)) return;
    seen.add(cabin);
    ordered.push(cabin);
  };
  for (const cabin of path) add(cabin);
  const targetIdx = targetCabin - 1;
  for (let i = 1; i <= k; i++) {
    add(((targetIdx + i) % length) + 1);
  }
  return ordered;
}

/** Short out-of-chain jump: sequential center→target plus K ring slots after target. */
export function cabinsForShortJumpPreload(
  fromCabin: number,
  toCabin: number,
  length: number,
  k = VIEWPORT_K,
): number[] {
  if (length === 0) return [];
  const path = forwardPathIndices(fromCabin - 1, toCabin - 1, length).map((idx) => idx + 1);
  return cabinsForJumpPreload(path, toCabin, length, k);
}

/** Canonical path plus overlay step URLs (deduped; covers ephemerals in the preload chain). */
export function imageUrlsForJumpPreload(
  cabinPath: number[],
  overlaySteps: TrainStep[],
  canonical: Submission[],
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (
    const url of [
      ...imageUrlsForCanonicalPath(cabinPath, canonical),
      ...imageUrlsFromWindow(overlaySteps, canonical),
    ]
  ) {
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

/** Resolve image URLs for cabin numbers on the ring (deduped, path order). */
export function imageUrlsForJumpPath(path: number[], nodes: TrainCabinNode[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const cabin of path) {
    const node = nodes[cabin - 1];
    if (!node) continue;
    const url = node.submission.image_url;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function preloadOne(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const finish = () => resolve();
    img.onload = () => {
      if (typeof img.decode === "function") {
        void img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = finish;
    img.src = url;
  });
}

/** Browser preload via Image + optional decode(); resolves even on per-URL error. */
export function preloadCabinImages(urls: string[]): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  return Promise.all(urls.map(preloadOne)).then(() => undefined);
}
