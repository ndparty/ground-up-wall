import { assertEquals } from "@std/assert";
import { clientKey, exceedsBodyLimit, RateLimiter } from "./rate_limit.ts";

Deno.test("RateLimiter allows up to limit then blocks within window", () => {
  const limiter = new RateLimiter(3, 1000);
  assertEquals(limiter.check("a", 0).allowed, true);
  assertEquals(limiter.check("a", 100).allowed, true);
  assertEquals(limiter.check("a", 200).allowed, true);
  const blocked = limiter.check("a", 300);
  assertEquals(blocked.allowed, false);
  assertEquals(blocked.retryAfterMs, 700);
});

Deno.test("RateLimiter resets after the window elapses", () => {
  const limiter = new RateLimiter(1, 1000);
  assertEquals(limiter.check("a", 0).allowed, true);
  assertEquals(limiter.check("a", 500).allowed, false);
  assertEquals(limiter.check("a", 1000).allowed, true);
});

Deno.test("RateLimiter isolates keys", () => {
  const limiter = new RateLimiter(1, 1000);
  assertEquals(limiter.check("a", 0).allowed, true);
  assertEquals(limiter.check("b", 0).allowed, true);
  assertEquals(limiter.check("a", 0).allowed, false);
});

Deno.test("clientKey prefers CF-Connecting-IP when proxied via Cloudflare", () => {
  const req = new Request("http://localhost/", {
    headers: {
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "198.51.100.1",
    },
  });
  assertEquals(clientKey(req), "203.0.113.9");
});

Deno.test("clientKey prefers X-Forwarded-For first hop", () => {
  const req = new Request("http://localhost/", {
    headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
  });
  assertEquals(clientKey(req), "203.0.113.7");
});

Deno.test("clientKey falls back to remote address", () => {
  const req = new Request("http://localhost/");
  assertEquals(
    clientKey(req, { remoteAddr: { transport: "tcp", hostname: "192.0.2.9", port: 1 } }),
    "192.0.2.9",
  );
});

Deno.test("exceedsBodyLimit checks Content-Length", () => {
  const big = new Request("http://localhost/", {
    method: "POST",
    headers: { "content-length": String(20 * 1024 * 1024) },
  });
  const small = new Request("http://localhost/", {
    method: "POST",
    headers: { "content-length": "1024" },
  });
  assertEquals(exceedsBodyLimit(big, 12 * 1024 * 1024), true);
  assertEquals(exceedsBodyLimit(small, 12 * 1024 * 1024), false);
});
