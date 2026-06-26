import { assertEquals } from "@std/assert";
import {
  authedRequest,
  createTestHandler,
  loginAsModerator,
  serveInfo,
  teardownTestDb,
} from "../helpers.ts";

function challengeRequest(ip: string, cookie?: string): Request {
  const headers = new Headers({ "X-Forwarded-For": ip });
  if (cookie) headers.set("Cookie", `session=${encodeURIComponent(cookie)}`);
  return new Request("http://localhost/api/masuk/challenge", { headers });
}

Deno.test({
  name: "smoke: anonymous PoW challenge rate-limited after 60 requests per IP",
  async fn() {
    const handler = await createTestHandler();
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    let lastStatus = 200;
    for (let i = 0; i < 61; i++) {
      const res = await handler(challengeRequest(ip), serveInfo);
      lastStatus = res.status;
    }
    assertEquals(lastStatus, 429);
    await teardownTestDb();
  },
});

Deno.test({
  name: "smoke: staff moderator exempt from PoW challenge rate limit",
  async fn() {
    const handler = await createTestHandler();
    const { token } = await loginAsModerator(handler);
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    for (let i = 0; i < 65; i++) {
      const res = await handler(
        authedRequest("http://localhost/api/masuk/challenge", token, {
          headers: { "X-Forwarded-For": ip },
        }),
        serveInfo,
      );
      assertEquals(res.status, 200, `request ${i + 1} should not be rate limited`);
    }
    await teardownTestDb();
  },
});
