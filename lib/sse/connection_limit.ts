/** Per-key active SSE connection counter (single-instance). */
const active = new Map<string, number>();

export function acquireConnection(key: string, max: number): boolean {
  const count = active.get(key) ?? 0;
  if (count >= max) return false;
  active.set(key, count + 1);
  return true;
}

export function releaseConnection(key: string): void {
  const count = active.get(key);
  if (count === undefined) return;
  if (count <= 1) {
    active.delete(key);
  } else {
    active.set(key, count - 1);
  }
}

export function _resetConnections(): void {
  active.clear();
}
