import { assertEquals } from "@std/assert";
import {
  computeCornerQrSize,
  CORNER_QR_CLEARANCE_PX,
  CORNER_QR_MAX_PX,
  CORNER_QR_MIN_PX,
} from "./corner_qr_size.ts";

Deno.test("computeCornerQrSize hides the code when free space is too small", () => {
  assertEquals(computeCornerQrSize(0), 0);
  assertEquals(computeCornerQrSize(CORNER_QR_CLEARANCE_PX + CORNER_QR_MIN_PX - 1), 0);
  assertEquals(computeCornerQrSize(-50), 0);
  assertEquals(computeCornerQrSize(Number.NaN), 0);
});

Deno.test("computeCornerQrSize keeps the clearance margin from the cabins", () => {
  const free = CORNER_QR_CLEARANCE_PX + CORNER_QR_MIN_PX;
  assertEquals(computeCornerQrSize(free), CORNER_QR_MIN_PX);
  assertEquals(computeCornerQrSize(free + 30), CORNER_QR_MIN_PX + 30);
});

Deno.test("computeCornerQrSize caps at the maximum", () => {
  assertEquals(computeCornerQrSize(10_000), CORNER_QR_MAX_PX);
});
