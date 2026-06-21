import { assertEquals, assertRejects } from "@std/assert";
import * as bcrypt from "bcrypt";
import { AuditServiceImpl } from "./audit_service_impl.ts";
import { AuthService } from "./auth_service.ts";
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
    assertEquals((await auth.resolveCurrentUser(login.token))?.username, "disable_me");
    await repo.disableModerator(user.id);
    assertEquals(await auth.resolveCurrentUser(login.token), null);
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
