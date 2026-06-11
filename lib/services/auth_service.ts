import * as bcrypt from "bcrypt";
import type { AuditService } from "../interfaces/audit_service.ts";
import type { Repository } from "../interfaces/repository.ts";
import type { User } from "../types.ts";

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

interface SessionEntry {
  user: AuthUser;
  expires: Date;
}

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export class AuthService {
  private readonly sessions = new Map<string, SessionEntry>();

  constructor(
    private readonly repository: Repository,
    private readonly audit: AuditService,
  ) {}

  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.repository.authenticateUser(username);
    if (!user) {
      await this.logLoginFailure(username, "invalid_credentials");
      return { success: false, error: "Invalid credentials" };
    }
    if (user.disabled) {
      await this.logLoginFailure(username, "account_disabled");
      return { success: false, error: "Account disabled" };
    }
    const valid = await bcrypt.verify(password, user.password_hash);
    if (!valid) {
      await this.logLoginFailure(username, "invalid_credentials");
      return { success: false, error: "Invalid credentials" };
    }
    const token = crypto.randomUUID();
    const authUser = toAuthUser(user);
    this.sessions.set(token, {
      user: authUser,
      expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
    });
    return { success: true, user: authUser, token };
  }

  logout(token: string): void {
    this.sessions.delete(token);
  }

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
  ): Promise<void> {
    const user = await this.findUserById(userId);
    if (!user) throw new Error("User not found");
    const valid = await bcrypt.verify(currentPassword, user.password_hash);
    if (!valid) throw new Error("Current password is incorrect");
    const hash = await bcrypt.hash(newPassword);
    await this.repository.updateUserPassword(userId, hash);
    await this.audit.logAction({
      moderator_id: userId,
      action_type: "change_password",
      target_type: "user",
      target_id: userId,
    });
  }

  private async findUserById(userId: string): Promise<User | null> {
    const moderators = await this.repository.listModerators();
    for (const mod of moderators) {
      if (mod.id === userId) {
        return await this.repository.authenticateUser(mod.username);
      }
    }
    const displayUsers = await this.repository.listDisplayWallUsers();
    for (const dw of displayUsers) {
      if (dw.id === userId) {
        return await this.repository.authenticateUser(dw.username);
      }
    }
    return null;
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
