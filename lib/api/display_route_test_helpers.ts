import * as bcrypt from "bcrypt";
import {
  authedRequest,
  createTestHandler,
  serveInfo,
  type TestHandler,
} from "./moderate_route_test_helpers.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

export { authedRequest, createTestHandler, serveInfo };
export type { TestHandler };

async function loginAsRole(
  handler: TestHandler,
  role: "display_wall" | "moderator" | "admin",
  password = "pass123",
): Promise<{ token: string; userId: string }> {
  await cleanupTestData();
  const repo = await createTestRepository();
  const hash = await bcrypt.hash(password);
  const username = `${role}_${crypto.randomUUID().slice(0, 8)}`;

  if (role === "display_wall") {
    const user = await repo.createDisplayWallUser({
      username,
      password_hash: hash,
      role: "display_wall",
    });
    await repo.close();
    const token = await login(handler, username, password);
    return { token, userId: user.id };
  }

  if (role === "moderator") {
    const user = await repo.createModerator({
      username,
      password_hash: hash,
      role: "moderator",
    });
    await repo.close();
    const token = await login(handler, username, password);
    return { token, userId: user.id };
  }

  const user = await repo.createUser({
    username,
    password_hash: hash,
    role: "admin",
  });
  await repo.close();
  const token = await login(handler, username, password);
  return { token, userId: user.id };
}

async function login(handler: TestHandler, username: string, password: string): Promise<string> {
  const loginRes = await handler(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
    serveInfo,
  );
  const cookie = loginRes.headers.get("set-cookie");
  if (!cookie) throw new Error("Login did not return session cookie");
  const tokenMatch = cookie.match(/session=([^;]+)/);
  if (!tokenMatch) throw new Error("Session token missing from cookie");
  return decodeURIComponent(tokenMatch[1]);
}

export function loginAsDisplayWall(handler: TestHandler) {
  return loginAsRole(handler, "display_wall");
}

export function loginAsModerator(handler: TestHandler) {
  return loginAsRole(handler, "moderator");
}

export function loginAsAdmin(handler: TestHandler) {
  return loginAsRole(handler, "admin");
}
