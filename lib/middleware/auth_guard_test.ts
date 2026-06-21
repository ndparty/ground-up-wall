import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
import { AuditServiceImpl } from "../services/audit_service_impl.ts";
import { AuthService } from "../services/auth_service.ts";
import { getSessionToken } from "../cookies.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

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
