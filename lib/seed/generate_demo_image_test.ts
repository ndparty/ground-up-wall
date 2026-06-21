import { assertEquals } from "@std/assert";
import { DEMO_SUBMISSION_TEMPLATES, getDemoSubmissionContent } from "./demo_submission_content.ts";
import {
  DEMO_IMAGE_HEIGHT,
  DEMO_IMAGE_WIDTH,
  digitBandWidth,
  encodePng,
  generateDemoImage,
  hasDigitInk,
  renderDemoImageRgba,
} from "./generate_demo_image.ts";

Deno.test("getDemoSubmissionContent cycles templates", () => {
  const first = getDemoSubmissionContent(0);
  const wrapped = getDemoSubmissionContent(DEMO_SUBMISSION_TEMPLATES.length);
  assertEquals(wrapped.message, first.message);
  assertEquals(wrapped.submitterName, first.submitterName);
});

Deno.test("generateDemoImage produces PNG magic bytes", async () => {
  const blob = await generateDemoImage(1);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assertEquals(bytes[0], 0x89);
  assertEquals(String.fromCharCode(bytes[1], bytes[2], bytes[3]), "PNG");
});

Deno.test("sequence numbers 7 and 8 differ in digit region", () => {
  const seven = renderDemoImageRgba(7);
  const eight = renderDemoImageRgba(8);
  let diff = 0;
  for (let i = 0; i < seven.length; i += 4) {
    if (seven[i] !== eight[i] || seven[i + 1] !== eight[i + 1] || seven[i + 2] !== eight[i + 2]) {
      diff++;
    }
  }
  assertEquals(diff > 0, true);
});

Deno.test("sequence 40 renders two digits with visible ink", () => {
  const rgba = renderDemoImageRgba(40);
  assertEquals(hasDigitInk(rgba, DEMO_IMAGE_WIDTH, DEMO_IMAGE_HEIGHT), true);
  assertEquals(digitBandWidth(rgba, DEMO_IMAGE_WIDTH, DEMO_IMAGE_HEIGHT) > 80, true);
});

Deno.test("encodePng round-trip size is reasonable", async () => {
  const rgba = renderDemoImageRgba(5);
  const png = await encodePng(rgba, DEMO_IMAGE_WIDTH, DEMO_IMAGE_HEIGHT);
  assertEquals(png.length > 500, true);
});

Deno.test("demo image is square without a dark footer bar", () => {
  const rgba = renderDemoImageRgba(12);
  assertEquals(DEMO_IMAGE_WIDTH, DEMO_IMAGE_HEIGHT);
  const bottomIdx = (DEMO_IMAGE_HEIGHT - 2) * DEMO_IMAGE_WIDTH * 4;
  const topIdx = 2 * DEMO_IMAGE_WIDTH * 4;
  const bottomR = rgba[bottomIdx]!;
  const bottomG = rgba[bottomIdx + 1]!;
  const bottomB = rgba[bottomIdx + 2]!;
  const topR = rgba[topIdx]!;
  const topG = rgba[topIdx + 1]!;
  const topB = rgba[topIdx + 2]!;
  // Footer was rgb(20,24,32); square image bottom should match background hue, not flat dark bar.
  assertEquals(bottomR === 20 && bottomG === 24 && bottomB === 32, false);
  assertEquals(
    Math.abs(bottomR - topR) < 80 && Math.abs(bottomG - topG) < 80 && Math.abs(bottomB - topB) < 80,
    true,
  );
});
