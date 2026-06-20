import { assertEquals } from "@std/assert";
import { computeAbsoluteTrackTranslate } from "./center_track.ts";

Deno.test("computeAbsoluteTrackTranslate centers cabin in stage", () => {
  const tx = computeAbsoluteTrackTranslate(500, 100, 800, 480);
  assertEquals(tx, 500 - (100 + 800 + 240));
  assertEquals(tx, -640);
});

Deno.test("computeAbsoluteTrackTranslate zero when already centered", () => {
  const cabinCenter = 300;
  const stageCenter = 300;
  const trackOrigin = 0;
  const offsetLeft = 200;
  const width = 200;
  assertEquals(
    computeAbsoluteTrackTranslate(stageCenter, trackOrigin, offsetLeft, width),
    0,
  );
});

Deno.test("computeAbsoluteTrackTranslate moves track right for earlier cabin", () => {
  const tx1 = computeAbsoluteTrackTranslate(500, 50, 400, 480);
  const tx2 = computeAbsoluteTrackTranslate(500, 50, 912, 480);
  assertEquals(tx1 > tx2, true);
});
