import { assertEquals, assertStringIncludes } from "@std/assert";
import { qrCodeSvg } from "./qr_code.ts";

Deno.test("qrCodeSvg returns a self-contained themed SVG", () => {
  const svg = qrCodeSvg("https://example.com", { dark: "#111111", light: "#ffffff" });
  assertStringIncludes(svg, "<svg");
  assertStringIncludes(svg, "viewBox=");
  assertStringIncludes(svg, "<rect");
  assertStringIncludes(svg, "#111111");
  assertStringIncludes(svg, "#ffffff");
});

Deno.test("qrCodeSvg encodes different urls differently", () => {
  const a = qrCodeSvg("https://a.example");
  const b = qrCodeSvg("https://b.example/longer/path");
  assertEquals(a === b, false);
});
