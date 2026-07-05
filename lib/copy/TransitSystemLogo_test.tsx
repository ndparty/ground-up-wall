import { assertEquals, assertStringIncludes } from "@std/assert";

import { render } from "preact-render-to-string";

import {
  LRT_VIEWBOX,
  MRT_LOGO_FILL,
  MRT_VIEWBOX,
  TransitSystemLogo,
} from "./TransitSystemLogo.tsx";

Deno.test("TransitSystemLogo renders non-empty SVG paths for both kinds", () => {
  for (const kind of ["mrt", "lrt"] as const) {
    const html = render(<TransitSystemLogo kind={kind} />);

    assertStringIncludes(html, "<svg");

    assertStringIncludes(html, "<path");

    assertStringIncludes(html, "train-cabin__sign-system-logo");
  }
});

Deno.test("TransitSystemLogo MRT uses yellow island symbol with padded viewBox", () => {
  const html = render(<TransitSystemLogo kind="mrt" />);

  assertStringIncludes(html, `viewBox="${MRT_VIEWBOX}"`);

  assertStringIncludes(html, `fill="${MRT_LOGO_FILL}"`);

  assertStringIncludes(html, 'fill-rule="evenodd"');

  assertEquals(html.includes("transform="), false);

  assertEquals(html.includes("-33.829193,213.38155"), false);

  assertEquals(html.includes('viewBox="12 0 17 13"'), false);
});

Deno.test("TransitSystemLogo LRT uses train + text paths with full logo viewBox", () => {
  const html = render(<TransitSystemLogo kind="lrt" />);

  assertStringIncludes(html, `viewBox="${LRT_VIEWBOX}"`);

  assertStringIncludes(html, "M290.6,456.2");

  assertEquals(html.includes("0 0 437.1 500"), false);

  assertEquals((html.match(/<(path|polyline)\b/g) ?? []).length, 3);
});
