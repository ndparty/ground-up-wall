import type { Page } from "playwright";
import pixelmatch from "pixelmatch";
import { Image } from "imagescript";
import { artifactsRoot, safeName } from "./artifacts.ts";

const BASELINES_DIR = "tests/e2e-browser/baselines";

export type PngCompareOptions = {
  maxDiffRatio?: number;
  threshold?: number;
  /** Stable subdirectory for grouped frame baselines and successful evidence. */
  group?: string;
};

export type VisualCompareOptions = PngCompareOptions & {
  /** Keep paused/seeked animations at their current time instead of fast-forwarding them. */
  animations?: "disabled" | "allow";
  /** CSS selector for an element capture; defaults to the full page. */
  selector?: string;
  /** CSS selectors whose volatile content is painted a deterministic gray. */
  mask?: string[];
  /** Capture-only CSS used to stabilize layout without changing production styles. */
  style?: string;
};

export function visualComparisonsEnabled(): boolean {
  return Deno.env.get("E2E_VISUAL") === "1" ||
    Deno.env.get("E2E_UPDATE_BASELINES") === "1";
}

async function captureStablePng(
  page: Page,
  options: VisualCompareOptions,
): Promise<Uint8Array> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.race([
      Promise.all(
        Array.from(document.images, (image) => image.decode().catch(() => undefined)),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ]);
  });
  const screenshotOptions = {
    animations: options.animations ?? "disabled",
    caret: "hide",
    mask: options.mask?.map((selector) => page.locator(selector)),
    maskColor: "#808080",
    style: options.style,
  } as const;
  if (options.selector) {
    const target = page.locator(options.selector);
    await target.waitFor({ state: "visible" });
    return await target.screenshot(screenshotOptions);
  }
  return await page.screenshot({ ...screenshotOptions, fullPage: true });
}

async function writePng(path: string, bytes: Uint8Array): Promise<void> {
  const separator = path.lastIndexOf("/");
  if (separator > 0) {
    await Deno.mkdir(path.slice(0, separator), { recursive: true });
  }
  await Deno.writeFile(path, bytes);
}

/**
 * Compare a stable page screenshot with its committed baseline.
 *
 * E2E_UPDATE_BASELINES=1 rewrites the baseline instead of comparing.
 * E2E_VISUAL=1 enables comparison; otherwise this is a no-op.
 */
export async function compareScreenshot(
  page: Page,
  name: string,
  options: VisualCompareOptions = {},
): Promise<void> {
  if (!visualComparisonsEnabled()) return;

  const actualBytes = await captureStablePng(page, options);
  await comparePng(name, actualBytes, options);
}

/** Compare already-rendered PNG bytes through the same baseline and diff pipeline. */
export async function comparePng(
  name: string,
  actualBytes: Uint8Array,
  options: PngCompareOptions = {},
): Promise<void> {
  if (!visualComparisonsEnabled()) return;

  const fileName = `${safeName(name)}.png`;
  const group = options.group ? safeName(options.group) : "";
  const relativePath = group ? `${group}/${fileName}` : fileName;
  const baselinePath = `${BASELINES_DIR}/${relativePath}`;
  const successEvidencePath = `${artifactsRoot()}/visual-success/${relativePath}`;

  if (Deno.env.get("E2E_UPDATE_BASELINES") === "1") {
    await writePng(baselinePath, actualBytes);
    await writePng(
      `${artifactsRoot()}/generated-baselines/${relativePath}`,
      actualBytes,
    );
    await writePng(successEvidencePath, actualBytes);
    return;
  }

  let expectedBytes: Uint8Array;
  try {
    expectedBytes = await Deno.readFile(baselinePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(
        `Missing visual baseline ${baselinePath}. Run with E2E_UPDATE_BASELINES=1.`,
      );
    }
    throw error;
  }

  const actual = await Image.decode(actualBytes);
  const expected = await Image.decode(expectedBytes);
  const diffDir = `${artifactsRoot()}/visual-diff`;
  const stem = `${diffDir}/${safeName(group ? `${group}-${name}` : name)}`;

  if (actual.width !== expected.width || actual.height !== expected.height) {
    await writePng(`${stem}.actual.png`, actualBytes);
    await writePng(`${stem}.expected.png`, expectedBytes);
    const diff = new Image(
      Math.max(actual.width, expected.width),
      Math.max(actual.height, expected.height),
    );
    for (let index = 0; index < diff.bitmap.length; index += 4) {
      diff.bitmap[index] = 255;
      diff.bitmap[index + 3] = 255;
    }
    await writePng(`${stem}.diff.png`, await diff.encode());
    throw new Error(
      `Visual baseline dimensions differ for ${name}: ` +
        `expected ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`,
    );
  }

  const diff = new Image(actual.width, actual.height);
  const diffPixels = pixelmatch(
    expected.bitmap,
    actual.bitmap,
    diff.bitmap,
    actual.width,
    actual.height,
    { threshold: options.threshold ?? 0.2 },
  );
  const diffRatio = diffPixels / (actual.width * actual.height);
  const maxDiffRatio = options.maxDiffRatio ?? 0.001;

  if (diffRatio > maxDiffRatio) {
    await Deno.mkdir(diffDir, { recursive: true });
    await writePng(`${stem}.actual.png`, actualBytes);
    await writePng(`${stem}.expected.png`, expectedBytes);
    await writePng(`${stem}.diff.png`, await diff.encode());
    throw new Error(
      `Visual regression in ${name}: ${(diffRatio * 100).toFixed(3)}% pixels differ ` +
        `(allowed ${(maxDiffRatio * 100).toFixed(3)}%)`,
    );
  }
  await writePng(successEvidencePath, actualBytes);
}
