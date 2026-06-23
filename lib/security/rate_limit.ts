/**
 * In-memory fixed-window rate limiter (NFR-23).
 * Single-instance only (Phase 1): counters live in process memory and reset on restart.
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    if (bucket.count >= this.limit) {
      return { allowed: false, retryAfterMs: bucket.resetAt - now };
    }
    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }
}

/**
 * Best-effort client identity for rate limiting: Cloudflare client IP when proxied,
 * else first X-Forwarded-For hop, else socket remote address.
 */
export function clientKey(req: Request, info?: { remoteAddr?: Deno.Addr }): string {
  const cfConnecting = req.headers.get("cf-connecting-ip")?.trim();
  if (cfConnecting) return cfConnecting;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const addr = info?.remoteAddr;
  if (addr && "hostname" in addr) return addr.hostname;
  return "unknown";
}

/** 429 JSON response with a Retry-After header (seconds, rounded up). */
export function tooManyRequests(retryAfterMs: number): Response {
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down and try again." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(seconds),
      },
    },
  );
}

/** Reject requests whose declared Content-Length exceeds the limit (before reading the body). */
export function exceedsBodyLimit(req: Request, maxBytes: number): boolean {
  const header = req.headers.get("content-length");
  if (!header) return false;
  const length = Number.parseInt(header, 10);
  return Number.isFinite(length) && length > maxBytes;
}
