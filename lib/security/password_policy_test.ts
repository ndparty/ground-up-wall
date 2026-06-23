import { assertEquals } from "@std/assert";
import { MIN_PASSWORD_LENGTH, validatePassword } from "./password_policy.ts";

Deno.test("validatePassword accepts long enough passwords", () => {
  assertEquals(validatePassword("a".repeat(MIN_PASSWORD_LENGTH)), null);
});

Deno.test("validatePassword rejects short passwords", () => {
  assertEquals(
    validatePassword("short"),
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  );
});
