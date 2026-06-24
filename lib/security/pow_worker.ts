/** Run PoW solve in a Web Worker so the main thread stays responsive. */
export function solvePowInWorker(
  nonce: string,
  difficulty: number,
  maxIterations = 5_000_000,
  timeoutMs = 120_000,
): Promise<string | null> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(value);
    };
    const worker = new Worker("/pow-worker.js");
    const timer = setTimeout(() => finish(null), timeoutMs);
    worker.onmessage = (event: MessageEvent<{ solution?: string | null }>) => {
      finish(event.data?.solution ?? null);
    };
    worker.onerror = () => finish(null);
    worker.postMessage({ nonce, difficulty, maxIterations });
  });
}
