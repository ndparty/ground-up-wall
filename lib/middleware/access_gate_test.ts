import { assertEquals } from "@std/assert";
import { accessDecision } from "./access_gate.ts";

const ON = { killswitch: true, uploadsEnabled: true };
const UPLOADS_OFF = { killswitch: false, uploadsEnabled: false };
const ALL_OK = { killswitch: false, uploadsEnabled: true };

Deno.test("login and admin stay available under killswitch", () => {
  for (
    const path of [
      "/login",
      "/admin",
      "/admin/users",
      "/api/auth/login",
      "/api/admin/parameters",
      "/api/pow/challenge",
    ]
  ) {
    assertEquals(accessDecision(path, ON), "allow");
  }
});

Deno.test("killswitch blocks display, upload, and moderation", () => {
  assertEquals(accessDecision("/display", ON), "offline");
  assertEquals(accessDecision("/upload", ON), "offline");
  assertEquals(accessDecision("/moderate", ON), "offline");
  assertEquals(accessDecision("/api/display/submissions", ON), "offline");
  assertEquals(accessDecision("/api/moderate/pending", ON), "offline");
});

Deno.test("uploads-disabled blocks only upload paths", () => {
  assertEquals(accessDecision("/upload", UPLOADS_OFF), "uploads-closed");
  assertEquals(accessDecision("/api/submissions", UPLOADS_OFF), "uploads-closed");
  assertEquals(accessDecision("/display", UPLOADS_OFF), "allow");
  assertEquals(accessDecision("/moderate", UPLOADS_OFF), "allow");
});

Deno.test("everything allowed when both toggles are healthy", () => {
  for (
    const path of ["/display", "/upload", "/moderate", "/api/submissions", "/api/display/events"]
  ) {
    assertEquals(accessDecision(path, ALL_OK), "allow");
  }
});
