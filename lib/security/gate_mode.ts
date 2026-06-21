/**
 * Whether request-level security gates (rate limiting, login lockout, proof-of-work)
 * are disabled. Set `SECURITY_GATES_DISABLED=1` in the automated test environment so the
 * shared in-memory limiter/throttle/nonce singletons do not accumulate across the
 * single-process test run. The underlying logic is covered by dedicated unit tests
 * (rate_limit_test, login_throttle_test, pow_test). Production never sets this.
 */
export function securityGatesDisabled(): boolean {
  return Deno.env.get("SECURITY_GATES_DISABLED") === "1";
}
