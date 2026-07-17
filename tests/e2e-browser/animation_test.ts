import { assertAlmostEquals, assertEquals, assertGreater, assertThrows } from "@std/assert";
import { GIF, Image } from "imagescript";
import {
  assertMonotonicTransform,
  boundaryFrameTimes,
  composeFilmstrip,
  encodeGifPreview,
  frameDelays,
  nominalFrameTimes,
} from "./animation.ts";

Deno.test("nominalFrameTimes includes exact start and end at 60Hz", () => {
  const frames = nominalFrameTimes(800);
  assertEquals(frames[0], 0);
  assertEquals(frames.at(-1), 800);
  assertEquals(frames.length, 49);
});

Deno.test("boundaryFrameTimes samples exact 500ms start and end windows at 60Hz", () => {
  const times = boundaryFrameTimes(3_000);
  assertEquals(times.length, 62);
  assertEquals(times[0], 0);
  assertEquals(times[30], 500);
  assertEquals(times[31], 2_500);
  assertEquals(times.at(-1), 3_000);
  assertAlmostEquals(times[1] - times[0], 1_000 / 60);
  assertAlmostEquals(times[32] - times[31], 1_000 / 60);
  assertEquals(new Set(times).size, times.length);
});

Deno.test("boundaryFrameTimes deduplicates overlapping windows for short animations", () => {
  assertEquals(boundaryFrameTimes(400), nominalFrameTimes(400));
  assertEquals(boundaryFrameTimes(800), nominalFrameTimes(800));
  assertThrows(() => boundaryFrameTimes(800, 0), Error, "boundary must be positive");
});

Deno.test("frameDelays account for the complete animation timeline", () => {
  const times = boundaryFrameTimes(3_000);
  const delays = frameDelays(times, 3_000);
  assertAlmostEquals(delays.reduce((sum, delay) => sum + delay, 0), 3_000);
  assertEquals(delays.at(-1), 0);
  assertThrows(() => frameDelays([], 800), Error, "at least one frame");
});

Deno.test("assertMonotonicTransform accepts eased forward motion", () => {
  assertMonotonicTransform([
    { timeMs: 0, x: 100 },
    { timeMs: 16.67, x: 98 },
    { timeMs: 33.33, x: 88 },
    { timeMs: 50, x: 65 },
    { timeMs: 66.67, x: 30 },
    { timeMs: 83.33, x: 0 },
  ]);
});

Deno.test("assertMonotonicTransform rejects a backwards frame", () => {
  assertThrows(
    () =>
      assertMonotonicTransform([
        { timeMs: 0, x: 100 },
        { timeMs: 16.67, x: 90 },
        { timeMs: 33.33, x: 70 },
        { timeMs: 50, x: 75 },
        { timeMs: 66.67, x: 30 },
        { timeMs: 83.33, x: 0 },
      ]),
    Error,
    "moved backwards",
  );
});

Deno.test("composeFilmstrip preserves frame order and gap dimensions", async () => {
  const red = new Image(2, 2);
  red.fill(0xff0000ff);
  const green = new Image(2, 2);
  green.fill(0x00ff00ff);

  const strip = await Image.decode(
    await composeFilmstrip([await red.encode(), await green.encode()], 1),
  );
  assertEquals({ width: strip.width, height: strip.height }, { width: 5, height: 2 });
  assertEquals([...strip.bitmap.subarray(0, 4)], [255, 0, 0, 255]);
  const greenStart = 3 * 4;
  assertEquals([...strip.bitmap.subarray(greenStart, greenStart + 4)], [0, 255, 0, 255]);
});

Deno.test("encodeGifPreview preserves frame order, dimensions, and positive duration", async () => {
  const red = new Image(2, 2);
  red.fill(0xff0000ff);
  const green = new Image(2, 2);
  green.fill(0x00ff00ff);
  const gif = await GIF.decode(
    await encodeGifPreview([
      { timeMs: 0, png: await red.encode() },
      { timeMs: 16.67, png: await green.encode() },
    ]),
  );
  assertEquals({ width: gif.width, height: gif.height, frames: gif.length }, {
    width: 2,
    height: 2,
    frames: 2,
  });
  assertGreater(gif.duration, 0);
  assertEquals([...gif[0].bitmap.subarray(0, 4)], [255, 0, 0, 255]);
  assertEquals([...gif[1].bitmap.subarray(0, 4)], [0, 255, 0, 255]);

  const transparent = new Image(2, 2);
  transparent.fill(0xff000080);
  const flattened = await GIF.decode(
    await encodeGifPreview([{ timeMs: 0, png: await transparent.encode() }]),
  );
  assertEquals(flattened[0].bitmap[3], 255, "GIF previews flatten alpha onto an opaque stage");
});
