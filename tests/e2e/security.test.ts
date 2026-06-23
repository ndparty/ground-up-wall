import { assertEquals, assertStringIncludes } from "@std/assert";
import * as bcrypt from "bcrypt";
import {
  authedRequest,
  cleanupTestData,
  createTestHandler,
  createTestSubmission,
  loginAs,
  loginAsAdmin,
  loginAsModerator,
  makePhotoForm,
  serveInfo,
  submitViaApi,
  teardownTestDb,
  testPhoto,
} from "../helpers.ts";
import { createTestRepository } from "../../lib/test_helpers.ts";

Deno.test({
  name: "smoke: US-02a upload rejected without acknowledgment",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const form = makePhotoForm({
      photo: testPhoto(),
      message: "No ack",
      submitter_name: "Alex",
    });
    form.delete("acknowledged");
    const res = await submitViaApi(handler, form);
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error.includes("acknowledgment"), true);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: disabled moderator session revoked",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const repo = await createTestRepository();
    const modPassword = "modpass";
    const adminPassword = "adminpass";
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: await bcrypt.hash(modPassword),
      role: "moderator",
    });
    const admin = await repo.createUser({
      username: `admin_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: await bcrypt.hash(adminPassword),
      role: "admin",
    });
    await repo.close();

    const modToken = await loginAs(handler, mod.username, modPassword);
    const adminToken = await loginAs(handler, admin.username, adminPassword);

    const disableRes = await handler(
      authedRequest("http://localhost/api/admin/users/toggle-status", adminToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mod.id, action: "disable" }),
      }),
      serveInfo,
    );
    assertEquals(disableRes.status, 200);

    const meRes = await handler(
      authedRequest("http://localhost/api/auth/me", modToken),
      serveInfo,
    );
    assertEquals(meRes.status, 401);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: admin change password succeeds",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsAdmin(handler);
    const res = await handler(
      authedRequest("http://localhost/api/auth/change-password", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "pass123",
          newPassword: "newpass456789",
          confirmPassword: "newpass456789",
        }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: approve rejects non-pending submission",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const submission = await createTestSubmission();
    await handler(
      authedRequest(`http://localhost/api/moderate/approve/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    const res = await handler(
      authedRequest(`http://localhost/api/moderate/approve/${submission.id}`, token, {
        method: "POST",
      }),
      serveInfo,
    );
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: login strips credentials from query string",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(
      new Request("http://localhost/login?username=demo&password=demo123"),
      serveInfo,
    );
    assertEquals(res.status, 302);
    const location = res.headers.get("location") ?? "";
    assertEquals(location.includes("username="), false);
    assertEquals(location.includes("password="), false);
    assertStringIncludes(location, "/login");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: login form uses POST method",
  async fn() {
    const handler = await createTestHandler();
    const res = await handler(new Request("http://localhost/login"), serveInfo);
    assertEquals(res.status, 200);
    const html = await res.text();
    assertStringIncludes(html, 'method="post"');
    assertStringIncludes(html, 'action="/login"');
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: POST /login form authenticates and redirects",
  async fn() {
    const handler = await createTestHandler();
    await cleanupTestData();
    const password = "pass123";
    const repo = await createTestRepository();
    const mod = await repo.createModerator({
      username: `mod_${crypto.randomUUID().slice(0, 8)}`,
      password_hash: await bcrypt.hash(password),
      role: "moderator",
    });
    await repo.close();

    const form = new FormData();
    form.append("username", mod.username);
    form.append("password", password);
    const res = await handler(
      new Request("http://localhost/login", { method: "POST", body: form }),
      serveInfo,
    );
    assertEquals(res.status, 302);
    assertStringIncludes(res.headers.get("location") ?? "", "/moderate");
    assertStringIncludes(res.headers.get("set-cookie") ?? "", "session=");
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: POST /api/auth/login JSON unchanged",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const meRes = await handler(
      authedRequest("http://localhost/api/auth/me", token),
      serveInfo,
    );
    assertEquals(meRes.status, 200);
    await teardownTestDb();
  },
});
