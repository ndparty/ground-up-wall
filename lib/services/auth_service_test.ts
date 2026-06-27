import { assertEquals, assertRejects } from "@std/assert";
import * as bcrypt from "bcrypt";
import { AuditServiceImpl } from "./audit_service_impl.ts";
import {
  AuthService,
  SESSION_MAX_AGE_MS,
  SESSION_REFRESH_THRESHOLD_MS,
} from "./auth_service.ts";
import { MemorySessionStore } from "./session_store.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

async function createAuthService(): Promise<{
  auth: AuthService;
  repo: Awaited<ReturnType<typeof createTestRepository>>;
}> {
  const repo = await createTestRepository();
  const audit = new AuditServiceImpl(repo);
  return { auth: new AuthService(repo, audit), repo };
}

Deno.test({
  name: "testSuccessfulLogin",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("secret123");
    await repo.createUser({
      username: "admin1",
      password_hash: hash,
      role: "admin",
    });
    const result = await auth.login("admin1", "secret123");
    assertEquals(result.success, true);
    assertEquals(result.user?.username, "admin1");
    assertEquals(typeof result.token, "string");
    await repo.close();
  },
});

Deno.test({
  name: "testFailedLoginWrongPassword",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("secret123");
    await repo.createUser({
      username: "mod1",
      password_hash: hash,
      role: "moderator",
    });
    const result = await auth.login("mod1", "wrong");
    assertEquals(result.success, false);
    assertEquals(result.error, "Invalid credentials");
    await repo.close();
  },
});

Deno.test({
  name: "testFailedLoginNonexistentUser",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const result = await auth.login("nobody", "pass");
    assertEquals(result.success, false);
    assertEquals(result.error, "Invalid credentials");
    await repo.close();
  },
});

Deno.test({
  name: "testLoginDisabledAccount",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("secret123");
    const user = await repo.createModerator({
      username: "disabled_mod",
      password_hash: hash,
      role: "moderator",
    });
    await repo.disableModerator(user.id);
    const result = await auth.login("disabled_mod", "secret123");
    assertEquals(result.success, false);
    assertEquals(result.error, "Account disabled");
    await repo.close();
  },
});

Deno.test({
  name: "testLogoutInvalidatesToken",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("secret123");
    await repo.createUser({
      username: "user1",
      password_hash: hash,
      role: "display_wall",
    });
    const result = await auth.login("user1", "secret123");
    const token = result.token!;
    assertEquals(auth.isAuthenticated(token), true);
    auth.logout(token);
    assertEquals(auth.isAuthenticated(token), false);
    await repo.close();
  },
});

Deno.test({
  name: "testHasRole",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("secret123");
    await repo.createUser({
      username: "admin2",
      password_hash: hash,
      role: "admin",
    });
    const result = await auth.login("admin2", "secret123");
    assertEquals(auth.hasRole(result.token, "admin"), true);
    assertEquals(auth.hasRole(result.token, "moderator"), false);
    await repo.close();
  },
});

Deno.test({
  name: "testChangePasswordSuccess",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("oldpass");
    const user = await repo.createModerator({
      username: "pwuser",
      password_hash: hash,
      role: "moderator",
    });
    await auth.changePassword(user.id, "oldpass", "newpass");
    const login = await auth.login("pwuser", "newpass");
    assertEquals(login.success, true);
    await repo.close();
  },
});

Deno.test({
  name: "testChangePasswordWrongCurrent",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("oldpass");
    const user = await repo.createModerator({
      username: "pwuser2",
      password_hash: hash,
      role: "moderator",
    });
    await assertRejects(
      () => auth.changePassword(user.id, "wrong", "newpass"),
      Error,
      "Current password is incorrect",
    );
    await repo.close();
  },
});

Deno.test({
  name: "testChangePasswordAdminUser",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("oldpass");
    const user = await repo.createUser({
      username: "admin_pw",
      password_hash: hash,
      role: "admin",
    });
    const login = await auth.login("admin_pw", "oldpass");
    await auth.changePassword(user.id, "oldpass", "newpass", login.token);
    const relogin = await auth.login("admin_pw", "newpass");
    assertEquals(relogin.success, true);
    await repo.close();
  },
});

Deno.test({
  name: "testResolveCurrentUserRejectsDisabledAccount",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("pass");
    const user = await repo.createModerator({
      username: "disable_me",
      password_hash: hash,
      role: "moderator",
    });
    const login = await auth.login("disable_me", "pass");
    assertEquals((await auth.resolveCurrentUser(login.token)).user?.username, "disable_me");
    await repo.disableModerator(user.id);
    assertEquals((await auth.resolveCurrentUser(login.token)).user, null);
    await repo.close();
  },
});

Deno.test({
  name: "testInvalidateSessionsForUser",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("pass");
    await repo.createModerator({
      username: "session_user",
      password_hash: hash,
      role: "moderator",
    });
    const login = await auth.login("session_user", "pass");
    assertEquals(auth.getCurrentUser(login.token)?.username, "session_user");
    auth.invalidateSessionsForUser((await repo.listModerators())[0].id);
    assertEquals(auth.getCurrentUser(login.token), null);
    await repo.close();
  },
});

/** Test helper: mutate expiry on an in-memory session row. */
class MutableMemorySessionStore extends MemorySessionStore {
  setExpiry(token: string, expires: Date): void {
    const entry = this.get(token);
    if (!entry) throw new Error("session not found");
    this.set(token, { ...entry, expires });
  }

  getExpiry(token: string): Date | undefined {
    return this.get(token)?.expires;
  }
}

Deno.test({
  name: "testResolveCurrentUserExtendsSessionWhenNearExpiry",
  async fn() {
    await cleanupTestData();
    const store = new MutableMemorySessionStore();
    const repo = await createTestRepository();
    const auth = new AuthService(repo, new AuditServiceImpl(repo), store);
    const hash = await bcrypt.hash("pass");
    await repo.createUser({
      username: "rolling_user",
      password_hash: hash,
      role: "moderator",
    });
    const login = await auth.login("rolling_user", "pass");
    const token = login.token!;
    store.setExpiry(
      token,
      new Date(Date.now() + SESSION_REFRESH_THRESHOLD_MS - 60_000),
    );

    const first = await auth.resolveCurrentUser(token);
    assertEquals(first.user?.username, "rolling_user");
    assertEquals(first.sessionRefreshed, true);
    const extended = store.getExpiry(token)!.getTime();
    assertEquals(extended > Date.now() + SESSION_MAX_AGE_MS - 5000, true);

    const second = await auth.resolveCurrentUser(token);
    assertEquals(second.sessionRefreshed, false);

    await repo.close();
  },
});

Deno.test({
  name: "testResolveCurrentUserDoesNotExtendFreshSession",
  async fn() {
    await cleanupTestData();
    const store = new MutableMemorySessionStore();
    const repo = await createTestRepository();
    const auth = new AuthService(repo, new AuditServiceImpl(repo), store);
    const hash = await bcrypt.hash("pass");
    await repo.createUser({
      username: "fresh_user",
      password_hash: hash,
      role: "display_wall",
    });
    const login = await auth.login("fresh_user", "pass");
    const token = login.token!;
    const before = store.getExpiry(token)!.getTime();

    const result = await auth.resolveCurrentUser(token);
    assertEquals(result.user?.role, "display_wall");
    assertEquals(result.sessionRefreshed, false);
    assertEquals(store.getExpiry(token)!.getTime(), before);

    await repo.close();
  },
});

Deno.test({
  name: "testResolveCurrentUserRejectsExpiredSession",
  async fn() {
    await cleanupTestData();
    const store = new MutableMemorySessionStore();
    const repo = await createTestRepository();
    const auth = new AuthService(repo, new AuditServiceImpl(repo), store);
    const hash = await bcrypt.hash("pass");
    await repo.createUser({
      username: "expired_user",
      password_hash: hash,
      role: "admin",
    });
    const login = await auth.login("expired_user", "pass");
    store.setExpiry(login.token!, new Date(Date.now() - 1000));

    const result = await auth.resolveCurrentUser(login.token);
    assertEquals(result.user, null);
    assertEquals(result.sessionRefreshed, false);

    await repo.close();
  },
});

Deno.test({
  name: "testChangePasswordAuditLogged",
  async fn() {
    await cleanupTestData();
    const { auth, repo } = await createAuthService();
    const hash = await bcrypt.hash("oldpass");
    const user = await repo.createModerator({
      username: "pwuser3",
      password_hash: hash,
      role: "moderator",
    });
    await auth.changePassword(user.id, "oldpass", "newpass");
    const entries = await repo.getAuditLog({ action_type: "change_password" });
    assertEquals(entries.length, 1);
    assertEquals(entries[0].target_id, user.id);
    await repo.close();
  },
});
