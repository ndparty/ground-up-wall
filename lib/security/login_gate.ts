import { RateLimiter } from "./rate_limit.ts";

/**
 * Shared per-IP login rate limiter (NFR-23). Both the JSON login API
 * (`/api/masuk/session`) and the no-JS page fallback (`POST /masuk`) must use
 * this single bucket so an attacker cannot double their allowance by
 * alternating endpoints.
 */
export const loginRateLimiter = new RateLimiter(10, 60_000);
