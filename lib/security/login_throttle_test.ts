import { assertEquals } from "@std/assert";
import { LoginThrottle } from "./login_throttle.ts";

Deno.test("LoginThrottle locks after max failures within window", () => {
  const throttle = new LoginThrottle({ maxFailures: 3, windowMs: 10_000, lockoutMs: 5_000 });
  throttle.recordFailure("u", 0);
  throttle.recordFailure("u", 100);
  assertEquals(throttle.isLocked("u", 200), false);
  throttle.recordFailure("u", 200);
  assertEquals(throttle.isLocked("u", 300), true);
  assertEquals(throttle.retryAfterMs("u", 300), 4900);
});

Deno.test("LoginThrottle lock expires after lockout window", () => {
  const throttle = new LoginThrottle({ maxFailures: 1, windowMs: 10_000, lockoutMs: 5_000 });
  throttle.recordFailure("u", 0);
  assertEquals(throttle.isLocked("u", 100), true);
  assertEquals(throttle.isLocked("u", 5_001), false);
});

Deno.test("LoginThrottle success clears failures", () => {
  const throttle = new LoginThrottle({ maxFailures: 2, windowMs: 10_000, lockoutMs: 5_000 });
  throttle.recordFailure("u", 0);
  throttle.recordSuccess("u");
  throttle.recordFailure("u", 100);
  assertEquals(throttle.isLocked("u", 200), false);
});

Deno.test("LoginThrottle failures outside window do not accumulate", () => {
  const throttle = new LoginThrottle({ maxFailures: 2, windowMs: 1_000, lockoutMs: 5_000 });
  throttle.recordFailure("u", 0);
  throttle.recordFailure("u", 2_000); // window elapsed -> resets to 1
  assertEquals(throttle.isLocked("u", 2_100), false);
});
