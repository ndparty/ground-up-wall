import { assertEquals, assertGreaterOrEqual, assertLessOrEqual } from "@std/assert";
import { h } from "preact";
import { render } from "preact-render-to-string";
import { StationSign } from "../../islands/TrainCabin.tsx";
import { captureVisualBaseline, runBrowserTest } from "./helpers.ts";

type StationCase = {
  id: string;
  name: string;
  logos: Array<"mrt" | "lrt">;
  badges: string[];
};

const STATION_CASES: StationCase[] = [
  { id: "mrt-short", name: "Yishun", logos: ["mrt"], badges: ["NS13"] },
  { id: "lrt-only", name: "Teck Whye", logos: ["lrt"], badges: ["BP4"] },
  {
    id: "dual-system",
    name: "Choa Chu Kang",
    logos: ["mrt", "lrt"],
    badges: ["BP1", "NS4"],
  },
  {
    id: "three-line",
    name: "Dhoby Ghaut",
    logos: ["mrt"],
    badges: ["CC1", "NE6", "NS24"],
  },
  {
    id: "long-name",
    name: "Gardens by the Bay",
    logos: ["mrt"],
    badges: ["TE22"],
  },
  {
    id: "dual-system-hub",
    name: "Sengkang",
    logos: ["mrt", "lrt"],
    badges: ["NE16", "STC"],
  },
  {
    id: "legacy-fallback",
    name: "Legacy Destination With A Very Long Name",
    logos: ["mrt"],
    badges: [],
  },
];

const WIDTHS = [
  { id: "normal", width: 460 },
  { id: "narrow", width: 280 },
] as const;

function fixtureMarkup(): string {
  const fixture = h(
    "main",
    { class: "station-sign-fixture" },
    h("h1", null, "Station sign visual matrix"),
    ...STATION_CASES.flatMap((station) =>
      WIDTHS.map(({ id, width }) =>
        h(
          "article",
          {
            class: "station-sign-case",
            "data-case": station.id,
            "data-width": id,
            style: `width:${width}px`,
          },
          h("p", { class: "station-sign-case__label" }, `${station.id} · ${id} · ${width}px`),
          h(StationSign, { name: station.name, variant: "station" }),
        )
      )
    ),
  );
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${
    render(fixture)
  }</body></html>`;
}

Deno.test({
  name: "Station signs: MRT, LRT, interchange, name length, and fallback matrix",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await runBrowserTest(
      "Station signs: MRT, LRT, interchange, name length, and fallback matrix",
      async ({ page }) => {
        await page.setContent(fixtureMarkup());
        await page.addStyleTag({ path: "static/train.css" });
        await page.addStyleTag({
          content: `
            :root { color-scheme: dark; font-family: Arial, sans-serif; }
            * { box-sizing: border-box; }
            body { margin: 0; background: #080910; color: #fff; }
            .station-sign-fixture {
              display: grid;
              grid-template-columns: repeat(2, max-content);
              align-items: start;
              gap: 18px 24px;
              width: max-content;
              padding: 24px;
              background: #080910;
            }
            .station-sign-fixture > h1 {
              grid-column: 1 / -1;
              margin: 0 0 6px;
              font-size: 22px;
            }
            .station-sign-case {
              margin: 0;
              padding: 12px 0 16px;
              overflow: hidden;
              border: 1px solid #30343d;
              background: #11131a;
            }
            .station-sign-case__label {
              margin: 0 16px 10px;
              color: #aab0bd;
              font: 12px/1.2 monospace;
            }
          `,
        });

        for (const station of STATION_CASES) {
          for (const width of WIDTHS) {
            const card = page.locator(
              `.station-sign-case[data-case="${station.id}"][data-width="${width.id}"]`,
            );
            const sign = card.locator(".train-cabin__sign");
            await sign.waitFor({ state: "visible" });
            assertEquals(
              await sign.locator(".train-cabin__sign-name").textContent(),
              station.name,
              `${station.id}/${width.id}: station name`,
            );

            const logos = await sign.locator(".train-cabin__sign-system-logo").evaluateAll(
              (elements) =>
                elements.map((element) =>
                  element.classList.contains("train-cabin__sign-system-logo--lrt") ? "lrt" : "mrt"
                ),
            );
            assertEquals(logos, station.logos, `${station.id}/${width.id}: system logos`);
            assertEquals(
              await sign.locator(".train-cabin__sign-line-seg").allTextContents(),
              station.badges,
              `${station.id}/${width.id}: line badges`,
            );

            const bounds = await card.evaluate((element) => {
              const cardRect = element.getBoundingClientRect();
              const signRect = element.querySelector(".train-cabin__sign")!.getBoundingClientRect();
              return {
                cardLeft: cardRect.left,
                cardRight: cardRect.right,
                signLeft: signRect.left,
                signRight: signRect.right,
              };
            });
            assertGreaterOrEqual(
              bounds.signLeft,
              bounds.cardLeft - 1,
              `${station.id}/${width.id}: sign stays inside left edge`,
            );
            assertLessOrEqual(
              bounds.signRight,
              bounds.cardRight + 1,
              `${station.id}/${width.id}: sign stays inside right edge`,
            );
          }
        }

        const longNarrowName = page.locator(
          '.station-sign-case[data-case="long-name"][data-width="narrow"] .train-cabin__sign-name',
        );
        assertEquals(
          await longNarrowName.evaluate((element) => element.scrollWidth > element.clientWidth),
          true,
          "long station names truncate rather than displacing logos or badges",
        );

        await captureVisualBaseline(page, "station-sign-matrix", {
          selector: ".station-sign-fixture",
        });
      },
      { viewport: { width: 1000, height: 1200 } },
    );
  },
});
