import { assertEquals } from "@std/assert";
import * as bcrypt from "bcrypt";
import {
  authedRequest,
  createTestHandler,
  createTestRepository,
  loginAsAdmin,
  loginAsModerator,
  serveInfo,
  teardownTestDb,
} from "../helpers.ts";

Deno.test({
  name: "smoke: US-09 create moderator account",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const username = `mod_${crypto.randomUUID().slice(0, 8)}`;
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "secret123456", role: "moderator" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 201);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-09 duplicate username error",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const username = `dup_${crypto.randomUUID().slice(0, 8)}`;
    const body = JSON.stringify({ username, password: "secret123456", role: "moderator" });
    await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
      serveInfo,
    );
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
      serveInfo,
    );
    assertEquals(res.status, 409);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-09 empty username validation",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "", password: "secret123456", role: "moderator" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-10 view moderator list",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(Array.isArray(body), true);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-10 reset moderator password",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    const hash = await bcrypt.hash("oldpass");
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "moderator",
    });
    await repo.close();

    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/reset-password", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mod.id, role: "moderator", newPassword: "newpass123456" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-14 change dwell time",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/api/towkay/parameters/update", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "train_dwell_time", value: "20" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-14 invalid dwell time validation",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/api/towkay/parameters/update", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "train_dwell_time", value: "99" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-14 change message prompt text",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/api/towkay/parameters/update", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "message_prompt_text", value: "Share your joy!" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-14 update auto-moderator word list",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/api/towkay/parameters/update", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "auto_moderator_word_list", value: "bad, word" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-14 reset parameter to default",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    await handler(
      authedRequest("http://localhost/api/towkay/parameters/update", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "train_dwell_time", value: "25" }),
      }),
      serveInfo,
    );
    const res = await handler(
      authedRequest("http://localhost/api/towkay/parameters/reset", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "train_dwell_time" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-16 create display wall account",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const username = `dw_${crypto.randomUUID().slice(0, 8)}`;
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/create", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "secret123456", role: "display_wall" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 201);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-16 disable display wall account",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    const hash = await bcrypt.hash("pass");
    const user = await repo.createDisplayWallUser({
      username: `dw_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "display_wall",
    });
    await repo.close();
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/toggle-status", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: "display_wall", action: "disable" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-17 view audit log",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/api/towkay/audit-log", token),
      serveInfo,
    );
    assertEquals(res.status, 200);
    const body = await res.json() as { entries: unknown[]; total: number };
    assertEquals(Array.isArray(body.entries), true);
    assertEquals(typeof body.total, "number");
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-17 non-admin cannot access audit log",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(
      authedRequest("http://localhost/api/towkay/audit-log", token),
      serveInfo,
    );
    assertEquals(res.status, 403);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-18 disable moderator account",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    const hash = await bcrypt.hash("pass");
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "moderator",
    });
    await repo.close();
    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/toggle-status", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mod.id, role: "moderator", action: "disable" }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-18 delete moderator preserves audit references",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const repo = await createTestRepository();
    const hash = await bcrypt.hash("pass");
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: hash,
      role: "moderator",
    });
    await repo.createAuditEntry({
      moderator_id: mod.id,
      action_type: "approve",
      target_type: "submission",
      target_id: "sub-1",
    });
    await repo.close();

    const res = await handler(
      authedRequest("http://localhost/api/towkay/users/delete", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mod.id, role: "moderator", confirmed: true }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);

    const auditRepo = await createTestRepository();
    const audit = await auditRepo.getAuditLog({ action_type: "approve" });
    assertEquals(audit.length, 1);
    await auditRepo.close();
    await teardownTestDb();
  },
});
