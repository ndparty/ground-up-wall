import { assertEquals } from "@std/assert";
import { pickDecorativeLineBadge } from "./station_sign.ts";

Deno.test("pickDecorativeLineBadge is stable for a station name", () => {
  const a = pickDecorativeLineBadge("Woodlands");
  const b = pickDecorativeLineBadge("Woodlands");
  assertEquals(a, b);
  assertEquals(a.primary.length > 0, true);
});

Deno.test("pickDecorativeLineBadge differs across station names", () => {
  const a = pickDecorativeLineBadge("Woodlands");
  const b = pickDecorativeLineBadge("Farrer Park");
  assertEquals(a.primary === b.primary && a.exit === b.exit, false);
});
