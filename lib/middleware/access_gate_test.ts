import { assertEquals } from "@std/assert";
import { accessDecision, OFFLINE_HTML, UPLOADS_CLOSED_HTML } from "./access_gate.ts";

const ON = { killswitch: true, uploadsEnabled: true };
const UPLOADS_OFF = { killswitch: false, uploadsEnabled: false };
const ALL_OK = { killswitch: false, uploadsEnabled: true };

Deno.test("login and admin stay available under killswitch", () => {
  for (
    const path of [
      "/masuk",
      "/towkay",
      "/towkay/users",
      "/api/masuk/session",
      "/api/towkay/parameters",
      "/api/masuk/challenge",
    ]
  ) {
    assertEquals(accessDecision(path, ON), "allow");
  }
});

Deno.test("killswitch blocks display, upload, and moderation", () => {
  assertEquals(accessDecision("/concourse", ON), "offline");
  assertEquals(accessDecision("/muatnaik", ON), "offline");
  assertEquals(accessDecision("/semak", ON), "offline");
  assertEquals(accessDecision("/api/concourse/submissions", ON), "offline");
  assertEquals(accessDecision("/api/semak/pending", ON), "offline");
});

Deno.test("uploads-disabled blocks only upload paths", () => {
  assertEquals(accessDecision("/muatnaik", UPLOADS_OFF), "uploads-closed");
  assertEquals(accessDecision("/api/muatnaik/submit", UPLOADS_OFF), "uploads-closed");
  assertEquals(accessDecision("/concourse", UPLOADS_OFF), "allow");
  assertEquals(accessDecision("/semak", UPLOADS_OFF), "allow");
});

Deno.test("everything allowed when both toggles are healthy", () => {
  for (
    const path of ["/concourse", "/muatnaik", "/semak", "/api/muatnaik/submit", "/api/concourse/events"]
  ) {
    assertEquals(accessDecision(path, ALL_OK), "allow");
  }
});

Deno.test("blocked gate pages link gate.css without inline style", () => {
  for (const html of [OFFLINE_HTML, UPLOADS_CLOSED_HTML]) {
    assertEquals(html.includes('/gate.css"'), true);
    assertEquals(html.includes("<style>"), false);
  }
});
