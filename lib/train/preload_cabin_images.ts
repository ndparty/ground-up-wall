import type { TrainCabinNode } from "./chain.ts";
import { VIEWPORT_K } from "./train_view_constants.ts";

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
