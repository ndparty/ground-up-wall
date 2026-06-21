import { dirname } from "@std/path/dirname";
import type { Repository } from "../interfaces/repository.ts";
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
  ready?(): Promise<void>;
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

export class PostgresSessionStore implements SessionStore {
  private readonly cache = new Map<string, SessionEntry>();
  private readonly readyPromise: Promise<void>;
  private writeChain = Promise.resolve();

  constructor(private readonly repository: Repository) {
    this.readyPromise = this.preloadFromDb();
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  load(): void {
    // Lazy read from DB — preload runs via ready()
  }

  get(token: string): SessionEntry | undefined {
    const entry = this.cache.get(token);
    if (!entry) return undefined;
    if (entry.expires < new Date()) {
      this.delete(token);
      return undefined;
    }
    return entry;
  }

  set(token: string, entry: SessionEntry): void {
    this.cache.set(token, entry);
    this.queueWrite(async () => {
      await this.repository.upsertSession(
        token,
        entry.user.id,
        entry.user,
        entry.expires,
      );
    });
  }

  delete(token: string): void {
    if (!this.cache.has(token)) return;
    this.cache.delete(token);
    this.queueWrite(async () => {
      await this.repository.deleteSession(token);
    });
  }

  deleteByUserId(userId: string, exceptToken?: string): void {
    let changed = false;
    for (const [token, session] of this.cache) {
      if (session.user.id === userId && token !== exceptToken) {
        this.cache.delete(token);
        changed = true;
      }
    }
    if (!changed) return;
    this.queueWrite(async () => {
      await this.repository.deleteSessionsByUserId(userId, exceptToken);
    });
  }

  private queueWrite(fn: () => Promise<void>): void {
    this.writeChain = this.writeChain.then(fn).catch((error) => {
      console.error("Session persistence error:", error);
    });
  }

  private async preloadFromDb(): Promise<void> {
    await this.repository.purgeExpiredSessions();
    const rows = await this.repository.loadActiveSessions();
    this.cache.clear();
    for (const row of rows) {
      this.cache.set(row.token, {
        user: row.user,
        expires: row.expiresAt,
      });
    }
  }
}

export function createSessionStore(repository?: Repository): SessionStore {
  if (Deno.env.get("DATABASE_URL") && repository) {
    return new PostgresSessionStore(repository);
  }
  return new FileSessionStore(".dev/sessions.json");
}

export function isPostgresSessionStore(store: SessionStore): store is PostgresSessionStore {
  return store instanceof PostgresSessionStore;
}
