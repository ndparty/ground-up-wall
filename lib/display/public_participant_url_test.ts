import { assertEquals } from "@std/assert";
import { resolvePublicParticipantUrl } from "./public_participant_url.ts";

Deno.test("resolvePublicParticipantUrl returns null when empty", () => {
  assertEquals(resolvePublicParticipantUrl(""), null);
  assertEquals(resolvePublicParticipantUrl("   "), null);
  assertEquals(resolvePublicParticipantUrl(null), null);
});

Deno.test("resolvePublicParticipantUrl parses http base URL with port", () => {
  assertEquals(
    resolvePublicParticipantUrl("http://192.168.1.5:8080"),
    { bannerHost: "192.168.1.5:8080", qrOrigin: "http://192.168.1.5:8080" },
  );
});

Deno.test("resolvePublicParticipantUrl accepts trailing slash only", () => {
  assertEquals(
    resolvePublicParticipantUrl("https://example.com/"),
    { bannerHost: "example.com", qrOrigin: "https://example.com" },
  );
});

Deno.test("resolvePublicParticipantUrl rejects deep links and bad schemes", () => {
  assertEquals(resolvePublicParticipantUrl("javascript:alert(1)"), null);
  assertEquals(resolvePublicParticipantUrl("http://192.168.1.5:8080/muatnaik"), null);
  assertEquals(resolvePublicParticipantUrl("not-a-url"), null);
});
