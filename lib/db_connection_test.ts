import { assertEquals } from "@std/assert";
import { ConnectionError } from "@db/postgres";
import { isTransientDbError } from "./db_connection.ts";

Deno.test("isTransientDbError detects ConnectionError", () => {
  assertEquals(isTransientDbError(new ConnectionError("failed")), true);
});

Deno.test("isTransientDbError detects message fragments", () => {
  assertEquals(
    isTransientDbError(new Error("The session was terminated unexpectedly")),
    true,
  );
  assertEquals(isTransientDbError(new Error("Connection refused")), true);
});

Deno.test("isTransientDbError ignores unrelated errors", () => {
  assertEquals(isTransientDbError(new Error("syntax error at line 1")), false);
  assertEquals(isTransientDbError("not an error"), false);
});
