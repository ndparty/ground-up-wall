import { assertEquals } from "@std/assert";
import {
  authedRequest,
  cleanupTestData,
  createTestHandler,
  loginAsModerator,
  serveInfo,
  teardownTestDb,
} from "../helpers.ts";

Deno.test({
  name: "smoke: US-11 successful password change",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(
      authedRequest("http://localhost/api/masuk/tukar", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "modpass",
          newPassword: "newmodpass12",
          confirmPassword: "newmodpass12",
        }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 200);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: US-11 incorrect current password",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(
      authedRequest("http://localhost/api/masuk/tukar", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "wrong",
          newPassword: "newmodpass12",
          confirmPassword: "newmodpass12",
        }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});

Deno.test({
  name: "US-11 password confirmation mismatch",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const res = await handler(
      authedRequest("http://localhost/api/masuk/tukar", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "modpass",
          newPassword: "newmodpass12",
          confirmPassword: "different",
        }),
      }),
      serveInfo,
    );
    assertEquals(res.status, 400);
    await teardownTestDb();
  },
});
