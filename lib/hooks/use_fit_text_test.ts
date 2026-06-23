import { assertEquals } from "@std/assert";
import {
  computeEffectiveMaxRem,
  findMaxFittingRem,
  fitTextClass,
  fitTextDataRem,
  lineHeightPx,
  MAX_REM,
  MIN_REM,
  quantizeRemCenti,
  REM_STEP_CENTI,
} from "./use_fit_text.ts";

Deno.test("fit-text.css defines compound selectors with !important", async () => {
  const css = await Deno.readTextFile("static/fit-text.css");
  assertEquals(
    css.includes(".train-cabin__body .train-cabin__message.fit-text-250"),
    true,
  );
  assertEquals(css.includes("!important"), true);
  assertEquals(
    css.includes('.train-cabin__body .train-cabin__message[data-fit-rem="250"]'),
    true,
  );
});

Deno.test("fit-text.css defines overlay probe with zero layout footprint", async () => {
  const css = await Deno.readTextFile("static/fit-text.css");
  assertEquals(css.includes(".train-cabin__message-wrap .message-fit-probe"), true);
  assertEquals(css.includes("position: absolute"), true);
  assertEquals(css.includes("inset: 0"), true);
  assertEquals(css.includes("visibility: hidden"), true);
  const app = await Deno.readTextFile("routes/_app.tsx");
  assertEquals(app.includes(".train-cabin__message-wrap .message-fit-probe"), true);
  assertEquals(app.includes("inset: 0"), true);
});

Deno.test("fitTextClass quantizes to CSS rem steps", () => {
  assertEquals(REM_STEP_CENTI, 5);
  assertEquals(quantizeRemCenti(284), 285);
  assertEquals(fitTextClass(2.84), "fit-text-285");
  assertEquals(fitTextDataRem(2.84), "285");
});

Deno.test("fitTextClass maps rem to CSP-safe class name", () => {
  assertEquals(fitTextClass(2.5), "fit-text-250");
  assertEquals(fitTextClass(1.2), "fit-text-120");
});

Deno.test("fitTextDataRem maps rem to data-fit-rem value", () => {
  assertEquals(fitTextDataRem(2.5), "250");
  assertEquals(fitTextDataRem(3), "300");
});

Deno.test("lineHeightPx treats unitless ratio as font multiplier", () => {
  assertEquals(lineHeightPx(16, "1.3"), 20.8);
  assertEquals(lineHeightPx(16, "24px"), 24);
});

Deno.test("findMaxFittingRem returns largest size that fits", () => {
  const threshold = 0.85;
  const fits = (sizeRem: number) => sizeRem <= threshold;
  assertEquals(findMaxFittingRem(fits, MIN_REM, MAX_REM), threshold);
});

Deno.test("findMaxFittingRem returns min when nothing fits", () => {
  const fits = (_sizeRem: number) => false;
  assertEquals(findMaxFittingRem(fits, MIN_REM, MAX_REM), MIN_REM);
});

Deno.test("findMaxFittingRem returns max when everything fits", () => {
  const fits = (_sizeRem: number) => true;
  assertEquals(findMaxFittingRem(fits, MIN_REM, MAX_REM), MAX_REM);
});

Deno.test("findMaxFittingRem can pick above 1.2rem when allowed", () => {
  const fits = (sizeRem: number) => sizeRem <= 2.5;
  assertEquals(findMaxFittingRem(fits, MIN_REM, MAX_REM), 2.5);
});

Deno.test("computeEffectiveMaxRem caps by MAX_REM", () => {
  assertEquals(computeEffectiveMaxRem(200, 20, 16, 16), MAX_REM);
});

Deno.test("computeEffectiveMaxRem returns min when wrap has no height", () => {
  assertEquals(computeEffectiveMaxRem(0, 20, 16, 16), MIN_REM);
});

Deno.test("computeEffectiveMaxRem scales with wrap height", () => {
  const short = computeEffectiveMaxRem(40, 20, 16, 16);
  const tall = computeEffectiveMaxRem(80, 20, 16, 16);
  assertEquals(tall > short, true);
  assertEquals(tall <= MAX_REM, true);
});
