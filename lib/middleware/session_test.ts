import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
import type { Context } from "fresh";
import { sessionCookieHeader } from "../cookies.ts";
import { AuditServiceImpl } from "../services/audit_service_impl.ts";
import { AuthService, SESSION_REFRESH_THRESHOLD_MS } from "../services/auth_service.ts";
import { MemorySessionStore } from "../services/session_store.ts";
import type { AuthState } from "./auth_guard.ts";
import { sessionMiddleware } from "./session.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

class MutableMemorySessionStore extends MemorySessionStore {
  setExpiry(token: string, expires: Date): void {
    const entry = this.get(token);
    if (!entry) throw new Error("session not found");
    this.set(token, { ...entry, expires });
  }
}

Deno.test({
  name: "testSessionMiddlewareSetsCookieWhenSessionRefreshed",
  async fn() {
    await cleanupTestData();
    const store = new MutableMemorySessionStore();
    const repo = await createTestRepository();
    const audit = new AuditServiceImpl(repo);
    const auth = new AuthService(repo, audit, store);
    const hash = await bcrypt.hash("pass");
    await repo.createUser({
      username: "cookie_user",
      password_hash: hash,
      role: "display_wall",
    });
    const login = await auth.login("cookie_user", "pass");
    store.setExpiry(
      login.token!,
      new Date(Date.now() + SESSION_REFRESH_THRESHOLD_MS - 60_000),
    );

    const ctx = {
      req: new Request("http://localhost/api/masuk/me", {
        headers: { cookie: `session=${encodeURIComponent(login.token!)}` },
      }),
      state: { user: null, services: { auth } },
      next: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    } as unknown as Context<AuthState>;

    const res = await sessionMiddleware(ctx);
    assertEquals(res.status, 200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    assertEquals(setCookie.includes("session="), true);
    assertEquals(setCookie.includes("Max-Age=86400"), true);
    assertEquals(setCookie, sessionCookieHeader(login.token!));

    await repo.close();
  },
});

Deno.test({
  name: "testSessionMiddlewareOmitsCookieWhenSessionStillFresh",
  async fn() {
    await cleanupTestData();
    const repo = await createTestRepository();
    const auth = new AuthService(repo, new AuditServiceImpl(repo));
    const hash = await bcrypt.hash("pass");
    await repo.createUser({
      username: "fresh_cookie_user",
      password_hash: hash,
      role: "admin",
    });
    const login = await auth.login("fresh_cookie_user", "pass");

    const ctx = {
      req: new Request("http://localhost/api/masuk/me", {
        headers: { cookie: `session=${encodeURIComponent(login.token!)}` },
      }),
      state: { user: null, services: { auth } },
      next: async () => new Response("ok"),
    } as unknown as Context<AuthState>;

    const res = await sessionMiddleware(ctx);
    assertEquals(res.headers.get("set-cookie"), null);

    await repo.close();
  },
});
