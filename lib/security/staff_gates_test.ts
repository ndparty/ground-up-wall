import { assertEquals } from "@std/assert";
import {
  isStaffRequest,
  isStaffUser,
  maxSseConnectionsForUser,
} from "./staff_gates.ts";
import type { AuthUser } from "../services/auth_service.ts";

function user(role: AuthUser["role"]): AuthUser {
  return {
    id: "u1",
    username: "test",
    role,
  };
}

Deno.test("isStaffUser returns true for admin and moderator", () => {
  assertEquals(isStaffUser(user("admin")), true);
  assertEquals(isStaffUser(user("moderator")), true);
});

Deno.test("isStaffUser returns false for other roles and null", () => {
  assertEquals(isStaffUser(user("display_wall")), false);
  assertEquals(isStaffUser(null), false);
  assertEquals(isStaffUser(undefined), false);
});

Deno.test("maxSseConnectionsForUser gives staff a higher ceiling", () => {
  assertEquals(maxSseConnectionsForUser(user("admin")), 100);
  assertEquals(maxSseConnectionsForUser(user("moderator")), 100);
  assertEquals(maxSseConnectionsForUser(user("display_wall")), 50);
  assertEquals(maxSseConnectionsForUser(null), 50);
});

Deno.test("isStaffRequest reads ctx.state.user", () => {
  const ctx = { state: { user: user("moderator") } };
  assertEquals(isStaffRequest(ctx as never), true);
  const anon = { state: { user: null } };
  assertEquals(isStaffRequest(anon as never), false);
});
