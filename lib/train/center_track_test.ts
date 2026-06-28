import { assertEquals } from "@std/assert";
import { centerSlotDelta, computeAbsoluteTrackTranslate } from "./center_track.ts";
import type { RenderCabin } from "./train_view.ts";
import { LEFT_RENDER } from "./train_view_constants.ts";

Deno.test("computeAbsoluteTrackTranslate centers cabin in stage", () => {
  const tx = computeAbsoluteTrackTranslate(500, 100, 800, 480);
  assertEquals(tx, 500 - (100 + 800 + 240));
  assertEquals(tx, -640);
});

Deno.test("computeAbsoluteTrackTranslate zero when already centered", () => {
  const _cabinCenter = 300;
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

Deno.test("centerSlotDelta is -1 for one-slot forward advance", () => {
  const oldWindow: RenderCabin[] = [
    { key: "s1", kind: "post" },
    { key: "s2", kind: "post" },
    { key: "s3", kind: "post" },
    { key: "s4", kind: "post" },
    { key: "s5", kind: "post" },
  ];
  const newWindow: RenderCabin[] = [
    { key: "s2", kind: "post" },
    { key: "s3", kind: "post" },
    { key: "s4", kind: "post" },
    { key: "s5", kind: "post" },
    { key: "s6", kind: "post" },
  ];
  assertEquals(centerSlotDelta(oldWindow, newWindow, "s4"), -1);
  assertEquals(oldWindow[LEFT_RENDER + 1]?.key, "s4");
  assertEquals(newWindow[LEFT_RENDER]?.key, "s4");
});

Deno.test("centerSlotDelta uses extended overlay window for out-of-chain jump", () => {
  const overlayWindow: RenderCabin[] = [
    { key: "s1", kind: "post" },
    { key: "s2", kind: "post" },
    { key: "s3", kind: "post" },
    { key: "s4", kind: "post" },
    { key: "s5", kind: "post" },
    { key: "s6", kind: "post" },
    { key: "s9", kind: "post" },
    { key: "s10", kind: "post" },
    { key: "s11", kind: "post" },
  ];
  const committedWindow: RenderCabin[] = [
    { key: "s7", kind: "post" },
    { key: "s8", kind: "post" },
    { key: "s9", kind: "post" },
    { key: "s10", kind: "post" },
    { key: "s11", kind: "post" },
    { key: "s12", kind: "post" },
    { key: "s13", kind: "post" },
  ];
  const preJumpWindow: RenderCabin[] = [
    { key: "s1", kind: "post" },
    { key: "s2", kind: "post" },
    { key: "s3", kind: "post" },
    { key: "s4", kind: "post" },
    { key: "s5", kind: "post" },
    { key: "s6", kind: "post" },
    { key: "s7", kind: "post" },
  ];
  assertEquals(centerSlotDelta(overlayWindow, committedWindow, "s9"), -4);
  assertEquals(overlayWindow[6]?.key, "s9");
  assertEquals(committedWindow[LEFT_RENDER]?.key, "s9");
  assertEquals(centerSlotDelta(preJumpWindow, committedWindow, "s9"), 0);
});
