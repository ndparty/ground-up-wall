import { assertEquals, assertThrows } from "@std/assert";
import { Image } from "imagescript";
import { assertMonotonicTransform, composeFilmstrip, nominalFrameTimes } from "./animation.ts";

Deno.test("nominalFrameTimes includes exact start and end at 60Hz", () => {
  const frames = nominalFrameTimes(800);
  assertEquals(frames[0], 0);
  assertEquals(frames.at(-1), 800);
  assertEquals(frames.length, 49);
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
