import * as bcrypt from "bcrypt";
import type { AuditService } from "../interfaces/audit_service.ts";
import type { Repository } from "../interfaces/repository.ts";
import type { User } from "../types.ts";
import type { SessionEntry, SessionStore } from "./session_store.ts";
import { MemorySessionStore } from "./session_store.ts";
import { LoginThrottle } from "../security/login_throttle.ts";
import { securityGatesDisabled } from "../security/gate_mode.ts";

export interface AuthUser {
  id: string;
  username: string;
  role: User["role"];
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Extend session when less than this remains (debounce DB writes / Set-Cookie churn). */
export const SESSION_REFRESH_THRESHOLD_MS = 12 * 60 * 60 * 1000;

export interface ResolveUserResult {
  user: AuthUser | null;
  sessionRefreshed: boolean;
}

export class AuthService {
  constructor(
    private readonly repository: Repository,
    private readonly audit: AuditService,
    private readonly sessions: SessionStore = new MemorySessionStore(),
    private readonly throttle: LoginThrottle = new LoginThrottle(),
  ) {
    this.sessions.load();
  }

  async login(
    username: string,
    password: string,
    clientKey = "global",
  ): Promise<AuthResult> {
    const throttleKey = `${username}::${clientKey}`;
    const throttleOn = !securityGatesDisabled();

    // Temporary lockout after repeated failures (NFR-23) — checked before bcrypt.
    if (throttleOn && this.throttle.isLocked(throttleKey)) {
      await this.logLoginFailure(username, "locked");
      return {
        success: false,
        error: "Too many failed attempts. Please try again in a few minutes.",
      };
    }

    const user = await this.repository.authenticateUser(username);
    if (!user) {
      if (throttleOn) this.throttle.recordFailure(throttleKey);
      await this.logLoginFailure(username, "invalid_credentials");
      return { success: false, error: "Invalid credentials" };
    }
    if (user.disabled) {
      if (throttleOn) this.throttle.recordFailure(throttleKey);
      await this.logLoginFailure(username, "account_disabled");
      return { success: false, error: "Account disabled" };
    }
    const valid = await bcrypt.verify(password, user.password_hash);
    if (!valid) {
      if (throttleOn) this.throttle.recordFailure(throttleKey);
      await this.logLoginFailure(username, "invalid_credentials");
      return { success: false, error: "Invalid credentials" };
    }
    this.throttle.recordSuccess(throttleKey);
    const token = crypto.randomUUID();
    const authUser = toAuthUser(user);
    this.invalidateSessionsForUser(user.id, token);
    this.sessions.set(token, {
      user: authUser,
      expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
    });
    return { success: true, user: authUser, token };
  }

  logout(token: string): void {
    this.sessions.delete(token);
  }

  /** Fast lookup without DB — prefer resolveCurrentUser for request handling. */
  getCurrentUser(token: string | null | undefined): AuthUser | null {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expires < new Date()) {
      this.sessions.delete(token);
      return null;
    }
    return session.user;
  }

  /** Validates session against DB (disabled/deleted users are rejected). */
  async resolveCurrentUser(
    token: string | null | undefined,
  ): Promise<ResolveUserResult> {
    if (!token) return { user: null, sessionRefreshed: false };
    const session = this.sessions.get(token);
    if (!session) return { user: null, sessionRefreshed: false };
    if (session.expires < new Date()) {
      this.sessions.delete(token);
      return { user: null, sessionRefreshed: false };
    }
    const dbUser = await this.repository.getUserById(session.user.id);
    if (!dbUser || dbUser.disabled) {
      this.sessions.delete(token);
      return { user: null, sessionRefreshed: false };
    }
    if (session.user.role !== dbUser.role) {
      this.sessions.delete(token);
      return { user: null, sessionRefreshed: false };
    }
    const authUser = toAuthUser(dbUser);
    session.user = authUser;
    const sessionRefreshed = this.touchSessionIfNeeded(token, session);
    if (!sessionRefreshed) {
      this.sessions.set(token, session);
    }
    return { user: authUser, sessionRefreshed };
  }

  /** Sliding idle timeout: extend to SESSION_MAX_AGE_MS when near expiry. */
  private touchSessionIfNeeded(token: string, session: SessionEntry): boolean {
    const remainingMs = session.expires.getTime() - Date.now();
    if (remainingMs >= SESSION_REFRESH_THRESHOLD_MS) return false;
    session.expires = new Date(Date.now() + SESSION_MAX_AGE_MS);
    this.sessions.set(token, session);
    return true;
  }

  invalidateSessionsForUser(userId: string, exceptToken?: string): void {
    this.sessions.deleteByUserId(userId, exceptToken);
  }

  clearSessionCache(): void {
    this.sessions.clearCache?.();
  }

  isAuthenticated(token: string | null | undefined): boolean {
    return this.getCurrentUser(token) !== null;
  }

  hasRole(token: string | null | undefined, ...roles: User["role"][]): boolean {
    const user = this.getCurrentUser(token);
    return user !== null && roles.includes(user.role);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepToken?: string,
  ): Promise<void> {
    const user = await this.repository.getUserById(userId);
    if (!user) throw new Error("User not found");
    const valid = await bcrypt.verify(currentPassword, user.password_hash);
    if (!valid) throw new Error("Current password is incorrect");
    const hash = await bcrypt.hash(newPassword);
    const updated = await this.repository.updateUserPassword(userId, hash);
    if (!updated) throw new Error("User not found");
    await this.audit.logAction({
      moderator_id: userId,
      action_type: "change_password",
      target_type: "user",
      target_id: userId,
    });
    this.invalidateSessionsForUser(userId, keepToken);
  }

  private async logLoginFailure(username: string, reason: string): Promise<void> {
    await this.audit.logAction({
      moderator_id: "system",
      action_type: "login_failed",
      target_type: "user",
      target_id: username,
      new_value: reason,
    });
  }
}

function toAuthUser(user: User): AuthUser {
  return { id: user.id, username: user.username, role: user.role };
}
