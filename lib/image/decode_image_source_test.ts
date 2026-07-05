import { assertEquals, assertInstanceOf, assertRejects } from "@std/assert";
import {
  type DecodedImageSource,
  type DecodeImageDeps,
  decodeImageSource,
} from "./decode_image_source.ts";
import { DECODE_IMAGE_FAILED_MESSAGE, UploadImageError } from "./decode_upload_image.ts";

function fakeSource(label: string): DecodedImageSource {
  return {
    source: { label } as unknown as CanvasImageSource,
    width: 100,
    height: 50,
    close: () => {},
  };
}

function makeDeps(
  overrides: Partial<DecodeImageDeps> & {
    bitmapResults?: Array<"ok" | "fail">;
  },
): { deps: DecodeImageDeps; calls: { bitmap: number; element: number; waits: number } } {
  const calls = { bitmap: 0, element: 0, waits: 0 };
  const bitmapResults = overrides.bitmapResults ?? [];
  const deps: DecodeImageDeps = {
    createBitmap: overrides.createBitmap ?? ((_file) => {
      const result = bitmapResults[calls.bitmap] ?? "fail";
      calls.bitmap += 1;
      return result === "ok"
        ? Promise.resolve(fakeSource("bitmap"))
        : Promise.reject(new Error("bitmap failed"));
    }),
    decodeViaElement: overrides.decodeViaElement ?? ((_file) => {
      calls.element += 1;
      return Promise.resolve(fakeSource("element"));
    }),
    wait: overrides.wait ?? ((_ms) => {
      calls.waits += 1;
      return Promise.resolve();
    }),
  };
  return { deps, calls };
}

const blob = new Blob(["x"], { type: "image/jpeg" });

Deno.test("decodeImageSource returns first successful createImageBitmap without retrying", async () => {
  const { deps, calls } = makeDeps({ bitmapResults: ["ok"] });
  const result = await decodeImageSource(blob, deps);
  assertEquals((result.source as { label?: string }).label, "bitmap");
  assertEquals(calls.bitmap, 1);
  assertEquals(calls.waits, 0);
  assertEquals(calls.element, 0);
});

Deno.test("decodeImageSource retries createImageBitmap once after a delay", async () => {
  const { deps, calls } = makeDeps({ bitmapResults: ["fail", "ok"] });
  const result = await decodeImageSource(blob, deps);
  assertEquals((result.source as { label?: string }).label, "bitmap");
  assertEquals(calls.bitmap, 2);
  assertEquals(calls.waits, 1);
  assertEquals(calls.element, 0);
});

Deno.test("decodeImageSource falls back to element decode when bitmap decoding keeps failing", async () => {
  const { deps, calls } = makeDeps({ bitmapResults: ["fail", "fail"] });
  const result = await decodeImageSource(blob, deps);
  assertEquals((result.source as { label?: string }).label, "element");
  assertEquals(calls.bitmap, 2);
  assertEquals(calls.element, 1);
});

Deno.test("decodeImageSource throws stage-tagged UploadImageError when every strategy fails", async () => {
  const { deps } = makeDeps({
    bitmapResults: ["fail", "fail"],
    decodeViaElement: () => Promise.reject(new Error("element failed")),
  });
  const err = await assertRejects(() => decodeImageSource(blob, deps));
  assertInstanceOf(err, UploadImageError);
  assertEquals(err.message, DECODE_IMAGE_FAILED_MESSAGE);
  assertEquals(err.stage, "decode");
});
