import { assertEquals, assertRejects } from "@std/assert";
import { fetchWithRetry } from "./fetch_with_retry.ts";

Deno.test("fetchWithRetry returns successful response", async () => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    calls++;
    return Promise.resolve(new Response("ok", { status: 200 }));
  };
  try {
    const res = await fetchWithRetry("/test");
    assertEquals(res.ok, true);
    assertEquals(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("fetchWithRetry retries on 500 then succeeds", async () => {
  let calls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    calls++;
    if (calls === 1) return Promise.resolve(new Response("fail", { status: 500 }));
    return Promise.resolve(new Response("ok", { status: 200 }));
  };
  try {
    const res = await fetchWithRetry("/test", undefined, { baseDelayMs: 1 });
    assertEquals(res.ok, true);
    assertEquals(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("fetchWithRetry throws after exhausting retries", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("network down"));
  try {
    await assertRejects(
      () => fetchWithRetry("/test", undefined, { retries: 1, baseDelayMs: 1 }),
      Error,
      "network down",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
