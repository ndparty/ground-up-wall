import { assertEquals } from "@std/assert";
import type { Context } from "fresh";
import type { AuthState } from "./auth_guard.ts";
import { csrfOriginMiddleware, expectedRequestOrigin } from "./csrf_origin.ts";

function withDeployedEnv(value: string | undefined, fn: () => void | Promise<void>) {
  const prev = Deno.env.get("DEPLOYED");
  try {
    if (value === undefined) Deno.env.delete("DEPLOYED");
    else Deno.env.set("DEPLOYED", value);
    return fn();
  } finally {
    if (prev === undefined) Deno.env.delete("DEPLOYED");
    else Deno.env.set("DEPLOYED", prev);
  }
}

async function runMiddleware(req: Request): Promise<{ status: number; nextCalled: boolean }> {
  let nextCalled = false;
  const ctx = {
    req,
    state: { services: {} },
    next: async () => {
      nextCalled = true;
      return new Response("ok");
    },
  } as unknown as Context<AuthState>;

  const res = await csrfOriginMiddleware(ctx);
  return { status: res?.status ?? 200, nextCalled };
}

Deno.test("expectedRequestOrigin uses url.origin when not deployed", () => {
  withDeployedEnv(undefined, () => {
    const req = new Request("http://localhost/api/semak/approve/1", {
      headers: { Host: "example.com", "X-Forwarded-Proto": "https" },
    });
    const url = new URL(req.url);
    assertEquals(expectedRequestOrigin(req, url), "http://localhost");
  });
});

Deno.test("expectedRequestOrigin uses forwarded headers when deployed", () => {
  withDeployedEnv("1", () => {
    const req = new Request("http://127.0.0.1:8080/api/concourse/train-command", {
      headers: {
        Host: "wall.example.com",
        "X-Forwarded-Proto": "https",
      },
    });
    const url = new URL(req.url);
    assertEquals(expectedRequestOrigin(req, url), "https://wall.example.com");
  });
});

Deno.test("expectedRequestOrigin prefers x-forwarded-host when deployed", () => {
  withDeployedEnv("1", () => {
    const req = new Request("http://127.0.0.1:8080/api/test", {
      headers: {
        Host: "internal.local",
        "X-Forwarded-Host": "wall.example.com",
        "X-Forwarded-Proto": "https",
      },
    });
    const url = new URL(req.url);
    assertEquals(expectedRequestOrigin(req, url), "https://wall.example.com");
  });
});

Deno.test("csrfOriginMiddleware passes GET without origin check", async () => {
  const { status, nextCalled } = await runMiddleware(
    new Request("http://localhost/api/semak/pending", {
      headers: { Cookie: "session=abc" },
    }),
  );
  assertEquals(status, 200);
  assertEquals(nextCalled, true);
});

Deno.test("csrfOriginMiddleware passes POST without session cookie", async () => {
  const { status, nextCalled } = await runMiddleware(
    new Request("http://localhost/api/masuk/session", {
      method: "POST",
      headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    }),
  );
  assertEquals(status, 200);
  assertEquals(nextCalled, true);
});

Deno.test("csrfOriginMiddleware passes POST when origin matches url.origin in dev", async () => {
  await withDeployedEnv(undefined, async () => {
    const { status, nextCalled } = await runMiddleware(
      new Request("http://localhost/api/semak/approve/1", {
        method: "POST",
        headers: {
          Cookie: "session=abc",
          Origin: "http://localhost",
        },
      }),
    );
    assertEquals(status, 200);
    assertEquals(nextCalled, true);
  });
});

Deno.test("csrfOriginMiddleware rejects POST with mismatched origin in dev", async () => {
  await withDeployedEnv(undefined, async () => {
    const { status, nextCalled } = await runMiddleware(
      new Request("http://localhost/api/semak/approve/1", {
        method: "POST",
        headers: {
          Cookie: "session=abc",
          Origin: "https://evil.example",
        },
      }),
    );
    assertEquals(status, 403);
    assertEquals(nextCalled, false);
  });
});

Deno.test("csrfOriginMiddleware passes POST behind proxy when deployed", async () => {
  await withDeployedEnv("1", async () => {
    const { status, nextCalled } = await runMiddleware(
      new Request("http://127.0.0.1:8080/api/concourse/train-command", {
        method: "POST",
        headers: {
          Cookie: "session=abc",
          Origin: "https://wall.example.com",
          Host: "wall.example.com",
          "X-Forwarded-Proto": "https",
          "Content-Type": "application/json",
        },
      }),
    );
    assertEquals(status, 200);
    assertEquals(nextCalled, true);
  });
});

Deno.test("csrfOriginMiddleware rejects foreign origin behind proxy when deployed", async () => {
  await withDeployedEnv("1", async () => {
    const { status, nextCalled } = await runMiddleware(
      new Request("http://127.0.0.1:8080/api/concourse/train-command", {
        method: "POST",
        headers: {
          Cookie: "session=abc",
          Origin: "https://evil.example",
          Host: "wall.example.com",
          "X-Forwarded-Proto": "https",
        },
      }),
    );
    assertEquals(status, 403);
    assertEquals(nextCalled, false);
  });
});
