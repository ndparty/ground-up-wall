import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
import { AuditServiceImpl } from "./audit_service_impl.ts";
import { AuthService } from "./auth_service.ts";
import { FileSessionStore, PostgresSessionStore } from "./session_store.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

Deno.test({
  name: "testFileSessionStorePersistsAcrossInstances",
  async fn() {
    const dir = await Deno.makeTempDir();
    const path = `${dir}/sessions.json`;
    try {
      const store1 = new FileSessionStore(path);
      store1.set("token-1", {
        user: { id: "u1", username: "admin", role: "admin" },
        expires: new Date(Date.now() + 60_000),
      });

      const store2 = new FileSessionStore(path);
      store2.load();
      assertEquals(store2.get("token-1")?.user.username, "admin");
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testFileSessionStorePrunesExpiredOnLoad",
  async fn() {
    const dir = await Deno.makeTempDir();
    const path = `${dir}/sessions.json`;
    try {
      const store1 = new FileSessionStore(path);
      store1.set("expired", {
        user: { id: "u1", username: "admin", role: "admin" },
        expires: new Date(Date.now() - 60_000),
      });

      const store2 = new FileSessionStore(path);
      store2.load();
      assertEquals(store2.get("expired"), undefined);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testFileSessionStoreSurvivesAuthServiceRestart",
  async fn() {
    await cleanupTestData();
    const dir = await Deno.makeTempDir();
    const path = `${dir}/sessions.json`;
    try {
      const repo = await createTestRepository();
      const audit = new AuditServiceImpl(repo);
      const hash = await bcrypt.hash("secret123");
      await repo.createUser({
        username: "persist_user",
        password_hash: hash,
        role: "admin",
      });

      const auth1 = new AuthService(repo, audit, new FileSessionStore(path));
      const login = await auth1.login("persist_user", "secret123");
      assertEquals(login.success, true);

      const auth2 = new AuthService(repo, audit, new FileSessionStore(path));
      assertEquals(
        (await auth2.resolveCurrentUser(login.token)).user?.username,
        "persist_user",
      );
      await repo.close();
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "testPostgresSessionStorePersistsAcrossInstances",
  async fn() {
    await cleanupTestData();
    const repo = await createTestRepository();
    try {
      const hash = await bcrypt.hash("secret123");
      const user = await repo.createUser({
        username: "pg_session_user",
        password_hash: hash,
        role: "admin",
      });

      const store1 = new PostgresSessionStore(repo);
      await store1.ready();
      store1.set("pg-token-1", {
        user: { id: user.id, username: user.username, role: user.role },
        expires: new Date(Date.now() + 60_000),
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const store2 = new PostgresSessionStore(repo);
      await store2.ready();
      assertEquals(store2.get("pg-token-1")?.user.username, "pg_session_user");
    } finally {
      await repo.close();
    }
  },
});
