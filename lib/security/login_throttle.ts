/**
 * In-memory login lockout (NFR-23). Tracks consecutive failed attempts per key
 * (username + client IP) and temporarily locks after too many within a window.
 * Single-instance only (Phase 1): state lives in process memory.
 */
export interface LoginThrottleConfig {
  maxFailures: number;
  windowMs: number;
  lockoutMs: number;
}

interface ThrottleEntry {
  failures: number;
  firstAt: number;
  lockedUntil: number;
}

const DEFAULT_CONFIG: LoginThrottleConfig = {
  maxFailures: 5,
  windowMs: 15 * 60_000,
  lockoutMs: 5 * 60_000,
};

export class LoginThrottle {
  private readonly entries = new Map<string, ThrottleEntry>();

  constructor(private readonly config: LoginThrottleConfig = DEFAULT_CONFIG) {}

  isLocked(key: string, now: number = Date.now()): boolean {
    const entry = this.entries.get(key);
    return entry !== undefined && entry.lockedUntil > now;
  }

  retryAfterMs(key: string, now: number = Date.now()): number {
    const entry = this.entries.get(key);
    return entry && entry.lockedUntil > now ? entry.lockedUntil - now : 0;
  }

  recordFailure(key: string, now: number = Date.now()): void {
    const entry = this.entries.get(key);
    if (!entry || now - entry.firstAt > this.config.windowMs) {
      const fresh: ThrottleEntry = { failures: 1, firstAt: now, lockedUntil: 0 };
      if (fresh.failures >= this.config.maxFailures) {
        fresh.lockedUntil = now + this.config.lockoutMs;
      }
      this.entries.set(key, fresh);
      return;
    }
    entry.failures += 1;
    if (entry.failures >= this.config.maxFailures) {
      entry.lockedUntil = now + this.config.lockoutMs;
    }
  }

  recordSuccess(key: string): void {
    this.entries.delete(key);
  }

  reset(): void {
    this.entries.clear();
  }
}
