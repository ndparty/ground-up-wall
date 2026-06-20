import { dirname } from "@std/path/dirname";
import type { AuthUser } from "./auth_service.ts";

export interface SessionEntry {
  user: AuthUser;
  expires: Date;
}

export interface SessionStore {
  get(token: string): SessionEntry | undefined;
  set(token: string, entry: SessionEntry): void;
  delete(token: string): void;
  deleteByUserId(userId: string, exceptToken?: string): void;
  load(): void;
}

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionEntry>();

  load(): void {
    // no-op
  }

  get(token: string): SessionEntry | undefined {
    return this.sessions.get(token);
  }

  set(token: string, entry: SessionEntry): void {
    this.sessions.set(token, entry);
  }

  delete(token: string): void {
    this.sessions.delete(token);
  }

  deleteByUserId(userId: string, exceptToken?: string): void {
    for (const [token, session] of this.sessions) {
      if (session.user.id === userId && token !== exceptToken) {
        this.sessions.delete(token);
      }
    }
  }
}

interface PersistedSessionEntry {
  user: AuthUser;
  expires: string;
}

interface PersistedSessionsFile {
  tokens: Record<string, PersistedSessionEntry>;
}

export class FileSessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionEntry>();

  constructor(private readonly path: string) {}

  load(): void {
    this.sessions.clear();
    try {
      const text = Deno.readTextFileSync(this.path);
      const data = JSON.parse(text) as PersistedSessionsFile;
      const now = new Date();
      for (const [token, entry] of Object.entries(data.tokens ?? {})) {
        const expires = new Date(entry.expires);
        if (expires >= now) {
          this.sessions.set(token, { user: entry.user, expires });
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  get(token: string): SessionEntry | undefined {
    return this.sessions.get(token);
  }

  set(token: string, entry: SessionEntry): void {
    this.sessions.set(token, entry);
    this.persist();
  }

  delete(token: string): void {
    if (!this.sessions.has(token)) return;
    this.sessions.delete(token);
    this.persist();
  }

  deleteByUserId(userId: string, exceptToken?: string): void {
    let changed = false;
    for (const [token, session] of this.sessions) {
      if (session.user.id === userId && token !== exceptToken) {
        this.sessions.delete(token);
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  private persist(): void {
    const dir = dirname(this.path);
    Deno.mkdirSync(dir, { recursive: true });
    const tokens: Record<string, PersistedSessionEntry> = {};
    for (const [token, entry] of this.sessions) {
      tokens[token] = {
        user: entry.user,
        expires: entry.expires.toISOString(),
      };
    }
    const data: PersistedSessionsFile = { tokens };
    Deno.writeTextFileSync(this.path, JSON.stringify(data, null, 2));
  }
}

export function createSessionStore(): SessionStore {
  if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
    return new MemorySessionStore();
  }
  return new FileSessionStore(".dev/sessions.json");
}
