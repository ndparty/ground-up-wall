import { assertEquals, assertRejects } from "@std/assert";
import { BodyTooLargeError, readBodyWithLimit } from "./body_limit.ts";

Deno.test("readBodyWithLimit accepts body within limit", async () => {
  const body = new TextEncoder().encode("hello");
  const req = new Request("http://localhost/", { method: "POST", body });
  const bytes = await readBodyWithLimit(req, 100);
  assertEquals(new TextDecoder().decode(bytes), "hello");
});

Deno.test("readBodyWithLimit rejects oversized body", async () => {
  const body = new TextEncoder().encode("x".repeat(200));
  const req = new Request("http://localhost/", { method: "POST", body });
  await assertRejects(
    () => readBodyWithLimit(req, 100),
    BodyTooLargeError,
  );
});
