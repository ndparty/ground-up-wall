import { Builder } from "$fresh/dev";
import * as bcrypt from "bcrypt";
import { app } from "../../main.ts";
import { cleanupTestData, createTestRepository } from "../test_helpers.ts";

export const serveInfo: Deno.ServeHandlerInfo = {
  remoteAddr: { hostname: "127.0.0.1", port: 8000, transport: "tcp" },
  completed: Promise.resolve(),
};

type TestHandler = (
  req: Request,
  info?: Deno.ServeHandlerInfo,
) => Response | Promise<Response>;

export async function createTestHandler(): Promise<TestHandler> {
  const builder = new Builder({ ignore: [/.*_test\.ts$/] });
  const applySnapshot = await builder.build({ snapshot: "memory" });
  applySnapshot(app);
  return app.handler() as TestHandler;
}

export async function loginAsModerator(
  handler: TestHandler,
): Promise<{ token: string; userId: string }> {
  await cleanupTestData();
  const repo = await createTestRepository();
  const hash = await bcrypt.hash("modpass");
  const mod = await repo.createModerator({
    username: `mod_${crypto.randomUUID().slice(0, 8)}`,
    password_hash: hash,
    role: "moderator",
  });
  await repo.close();

  const loginRes = await handler(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: mod.username, password: "modpass" }),
    }),
    serveInfo,
  );
  const cookie = loginRes.headers.get("set-cookie");
  if (!cookie) throw new Error("Login did not return session cookie");
  const tokenMatch = cookie.match(/session=([^;]+)/);
  if (!tokenMatch) throw new Error("Session token missing from cookie");
  const token = decodeURIComponent(tokenMatch[1]);
  return { token, userId: mod.id };
}

export function authedRequest(
  url: string,
  token: string,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set("Cookie", `session=${encodeURIComponent(token)}`);
  return new Request(url, { ...init, headers });
}
