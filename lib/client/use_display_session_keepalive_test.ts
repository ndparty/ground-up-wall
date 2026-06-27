import { assertEquals } from "@std/assert";
import { DISPLAY_SESSION_KEEPALIVE_MS } from "./use_display_session_keepalive.ts";

Deno.test("display session keepalive interval is 45 minutes", () => {
  assertEquals(DISPLAY_SESSION_KEEPALIVE_MS, 45 * 60 * 1000);
});
