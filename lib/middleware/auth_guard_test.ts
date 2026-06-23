import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
import { loginPageRedirect, roleHomeRedirect } from "../auth/login_redirect.ts";
import { AuditServiceImpl } from "../services/audit_service_impl.ts";
import { AuthService } from "../services/auth_service.ts";
import { getSessionToken } from "../cookies.ts";
import { requireRolePage } from "./auth_guard.ts";
import type { AuthState } from "./auth_guard.ts";
import type { Context } from "fresh";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

Deno.test("loginPageRedirect sends user to login", () => {
  const res = loginPageRedirect(new Request("http://localhost/display"));
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "http://localhost/login");
});

Deno.test("roleHomeRedirect sends moderator to moderate", () => {
  const res = roleHomeRedirect(new Request("http://localhost/admin"), "moderator");
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "http://localhost/moderate");
});

Deno.test("roleHomeRedirect sends display wall user to display", () => {
  const res = roleHomeRedirect(new Request("http://localhost/moderate"), "display_wall");
  assertEquals(res.status, 302);
  assertEquals(res.headers.get("location"), "http://localhost/display");
});

Deno.test("requireRolePage redirects unauthenticated users to login", async () => {
  let nextCalled = false;
  const ctx = {
    req: new Request("http://localhost/admin"),
    state: { user: null, services: {} },
    next: async () => {
      nextCalled = true;
      return new Response("ok");
    },
  } as unknown as Context<AuthState>;

  const res = await requireRolePage("admin")(ctx);
  assertEquals(nextCalled, false);
  assertEquals(res?.status, 302);
  assertEquals(res?.headers.get("location"), "http://localhost/login");
});

Deno.test("requireRolePage redirects wrong role to role home", async () => {
  let nextCalled = false;
  const ctx = {
    req: new Request("http://localhost/admin"),
    state: {
      user: { id: "1", username: "mod", role: "moderator" as const, disabled: false },
      services: {},
    },
    next: async () => {
      nextCalled = true;
      return new Response("ok");
    },
  } as unknown as Context<AuthState>;

  const res = await requireRolePage("admin")(ctx);
  assertEquals(nextCalled, false);
  assertEquals(res?.status, 302);
  assertEquals(res?.headers.get("location"), "http://localhost/moderate");
});

Deno.test("requireRolePage allows matching role through", async () => {
  let nextCalled = false;
  const ctx = {
    req: new Request("http://localhost/admin"),
    state: {
      user: { id: "1", username: "adm", role: "admin" as const, disabled: false },
      services: {},
    },
    next: async () => {
      nextCalled = true;
      return new Response("ok");
    },
  } as unknown as Context<AuthState>;

  const res = await requireRolePage("admin")(ctx);
  assertEquals(nextCalled, true);
  assertEquals(await res?.text(), "ok");
});

Deno.test({
  name: "testRequireAdminAllowsAdmin",
  async fn() {
    await cleanupTestData();
    const repo = await createTestRepository();
    const auth = new AuthService(repo, new AuditServiceImpl(repo));
    const hash = await bcrypt.hash("pass");
    await repo.createUser({ username: "adm", password_hash: hash, role: "admin" });
    const login = await auth.login("adm", "pass");
    assertEquals(auth.hasRole(login.token, "admin"), true);
    await repo.close();
  },
});

Deno.test({
  name: "testRequireAdminBlocksModerator",
  async fn() {
    await cleanupTestData();
    const repo = await createTestRepository();
    const auth = new AuthService(repo, new AuditServiceImpl(repo));
    const hash = await bcrypt.hash("pass");
    await repo.createModerator({
      username: "mod",
      password_hash: hash,
      role: "moderator",
    });
    const login = await auth.login("mod", "pass");
    assertEquals(auth.hasRole(login.token, "admin"), false);
    assertEquals(auth.hasRole(login.token, "moderator"), true);
    await repo.close();
  },
});

Deno.test({
  name: "testRequireAnyAuthAllowsDisplayWall",
  async fn() {
    await cleanupTestData();
    const repo = await createTestRepository();
    const auth = new AuthService(repo, new AuditServiceImpl(repo));
    const hash = await bcrypt.hash("pass");
    await repo.createDisplayWallUser({
      username: "display1",
      password_hash: hash,
      role: "display_wall",
    });
    const login = await auth.login("display1", "pass");
    assertEquals(
      auth.hasRole(login.token, "moderator", "admin", "display_wall"),
      true,
    );
    await repo.close();
  },
});

Deno.test({
  name: "testNoSessionReturnsUnauthorized",
  fn() {
    assertEquals(getSessionToken(new Request("http://localhost/")), null);
  },
});
