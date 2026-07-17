import type { Page } from "playwright";
import { Frame, GIF, Image } from "imagescript";
import { artifactsRoot, safeName } from "./artifacts.ts";
import { comparePng, visualComparisonsEnabled } from "./visual.ts";

export type TransformSample = {
  timeMs: number;
  x: number;
};

export type SeekedTransformAnimation = {
  durationMs: number;
  easing: string;
  startX: number;
  endX: number;
  slotPitchPx: number;
  endCenterOffset: number;
  samples: TransformSample[];
  keyframePngs: Uint8Array[];
  boundaryFrames: AnimationBoundaryFrame[];
};

export type AnimationBoundaryFrame = {
  timeMs: number;
  png: Uint8Array;
};

export type CapturedAnimationSequence = {
  durationMs: number;
  easing: string;
  frames: AnimationBoundaryFrame[];
};

export type AnimationSequenceManifest = {
  name: string;
  selector: string;
  samplingVersion: 1;
  policy: { boundaryMs: number; fps: number };
  durationMs: number;
  easing: string;
  width: number;
  height: number;
  frameCount: number;
  frames: Array<{ index: number; timeMs: number; delayMs: number; baseline: string }>;
  previews: string[];
};

export function nominalFrameTimes(durationMs: number, fps = 60): number[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`Animation duration must be positive, got ${durationMs}`);
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`Animation FPS must be positive, got ${fps}`);
  }
  const frameMs = 1_000 / fps;
  const frameCount = Math.ceil(durationMs / frameMs);
  const times = Array.from({ length: frameCount }, (_, frame) => frame * frameMs);
  times.push(durationMs);
  return times;
}

export function boundaryFrameTimes(
  durationMs: number,
  boundaryMs = 500,
  fps = 60,
): number[] {
  if (!Number.isFinite(boundaryMs) || boundaryMs <= 0) {
    throw new Error(`Animation boundary must be positive, got ${boundaryMs}`);
  }
  const allTimes = nominalFrameTimes(durationMs, fps);
  if (durationMs <= boundaryMs * 2) return allTimes;
  const frameMs = 1_000 / fps;
  const segment = (start: number, end: number) => {
    const count = Math.ceil((end - start) / frameMs);
    const times = Array.from({ length: count }, (_, frame) => start + frame * frameMs);
    times.push(end);
    return times;
  };
  return [...segment(0, boundaryMs), ...segment(durationMs - boundaryMs, durationMs)]
    .filter((time, index, times) =>
      index === 0 || Math.abs(time - times[index - 1]) > Number.EPSILON
    );
}

export function frameDelays(times: number[], durationMs: number): number[] {
  if (times.length === 0) throw new Error("Animation sequence needs at least one frame");
  return times.map((time, index) => {
    const next = times[index + 1];
    return next === undefined ? Math.max(0, durationMs - time) : Math.max(0, next - time);
  });
}

function boundarySegments(
  frames: AnimationBoundaryFrame[],
  durationMs: number,
  boundaryMs = 500,
): Array<{ label: "start" | "end" | "full"; frames: AnimationBoundaryFrame[] }> {
  if (durationMs <= boundaryMs * 2) return [{ label: "full", frames }];
  return [
    { label: "start", frames: frames.filter((frame) => frame.timeMs <= boundaryMs + 0.001) },
    {
      label: "end",
      frames: frames.filter((frame) => frame.timeMs >= durationMs - boundaryMs - 0.001),
    },
  ];
}

export async function encodeGifPreview(
  frames: AnimationBoundaryFrame[],
  fps = 60,
): Promise<Uint8Array> {
  const frameDuration = Math.max(10, Math.round(1_000 / fps));
  const gifFrames = await Promise.all(frames.map(async ({ png }) => {
    const decoded = await Image.decode(png);
    const preview = decoded.width > 960 ? decoded.resize(960, Image.RESIZE_AUTO) : decoded;
    return Frame.from(preview, frameDuration);
  }));
  return await new GIF(gifFrames, -1).encode(90);
}

async function writeArtifact(path: string, bytes: Uint8Array | string): Promise<void> {
  const separator = path.lastIndexOf("/");
  if (separator > 0) await Deno.mkdir(path.slice(0, separator), { recursive: true });
  if (typeof bytes === "string") await Deno.writeTextFile(path, bytes);
  else await Deno.writeFile(path, bytes);
}

export async function compareAnimationBoundarySequence(
  name: string,
  selector: string,
  sequence: CapturedAnimationSequence,
  boundaryMs = 500,
  fps = 60,
): Promise<AnimationSequenceManifest | null> {
  if (!visualComparisonsEnabled()) return null;
  if (sequence.frames.length === 0) throw new Error(`${name} captured no boundary frames`);

  const safeSequence = safeName(name);
  const group = `animation-boundaries-${safeSequence}`;
  const first = await Image.decode(sequence.frames[0].png);
  const times = sequence.frames.map((frame) => frame.timeMs);
  const delays = frameDelays(times, sequence.durationMs);
  const previews: string[] = [];
  for (const segment of boundarySegments(sequence.frames, sequence.durationMs, boundaryMs)) {
    const previewName = `${safeSequence}-${segment.label}.gif`;
    await writeArtifact(
      `${artifactsRoot()}/animation/${previewName}`,
      await encodeGifPreview(segment.frames, fps),
    );
    previews.push(previewName);
  }

  const manifest: AnimationSequenceManifest = {
    name,
    selector,
    samplingVersion: 1,
    policy: { boundaryMs, fps },
    durationMs: sequence.durationMs,
    easing: sequence.easing,
    width: first.width,
    height: first.height,
    frameCount: sequence.frames.length,
    frames: sequence.frames.map((frame, index) => ({
      index,
      timeMs: frame.timeMs,
      delayMs: delays[index],
      baseline: `${group}/frame-${String(index).padStart(3, "0")}-${
        String(Math.round(frame.timeMs * 1_000)).padStart(7, "0")
      }us.png`,
    })),
    previews,
  };
  await writeArtifact(
    `${artifactsRoot()}/animation/${safeSequence}.manifest.json`,
    JSON.stringify(manifest, null, 2) + "\n",
  );

  const errors: unknown[] = [];
  for (const [index, frame] of sequence.frames.entries()) {
    const frameName = `frame-${String(index).padStart(3, "0")}-${
      String(Math.round(frame.timeMs * 1_000)).padStart(7, "0")
    }us`;
    try {
      await comparePng(frameName, frame.png, { group });
    } catch (error) {
      errors.push(
        new Error(`${name} frame ${index} at ${frame.timeMs.toFixed(3)}ms failed`, {
          cause: error,
        }),
      );
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, `${name} has ${errors.length} boundary-frame regressions`);
  }
  return manifest;
}

export type CaptureAnimationOptions = {
  animationSelector: string;
  captureSelector: string;
  transitionProperty?: string;
  animationName?: string;
  boundaryMs?: number;
  fps?: number;
};

export async function captureAnimationBoundaries(
  page: Page,
  options: CaptureAnimationOptions,
): Promise<CapturedAnimationSequence> {
  const boundaryMs = options.boundaryMs ?? 500;
  const fps = options.fps ?? 60;
  const timeline = await page.evaluate(
    ({ animationSelector, captureSelector, transitionProperty, animationName }) => {
      const animatedRoot = document.querySelector<HTMLElement>(animationSelector);
      const captureRoot = document.querySelector<HTMLElement>(captureSelector);
      if (!animatedRoot) throw new Error(`Missing animated element: ${animationSelector}`);
      if (!captureRoot) throw new Error(`Missing capture element: ${captureSelector}`);
      const sourceAnimations = animatedRoot.getAnimations({ subtree: true });
      const primary = sourceAnimations.find((candidate) => {
        const transition = candidate as CSSTransition;
        const cssAnimation = candidate as CSSAnimation;
        return transitionProperty
          ? transition.transitionProperty === transitionProperty
          : animationName
          ? cssAnimation.animationName === animationName
          : true;
      });
      if (!primary?.effect) {
        throw new Error(`No matching animation found under ${animationSelector}`);
      }
      const computed = primary.effect.getComputedTiming();
      const configured = primary.effect.getTiming();
      const durationMs = Number(computed.duration);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new Error(`Invalid animation duration: ${computed.duration}`);
      }

      document.getElementById("e2e-boundary-capture")?.remove();
      const captureRect = captureRoot.getBoundingClientRect();
      const captureStyle = getComputedStyle(captureRoot);
      const fixture = document.createElement("div");
      fixture.id = "e2e-boundary-capture";
      fixture.style.cssText =
        `position:relative;width:${captureRect.width}px;height:${captureRect.height}px;` +
        `overflow:hidden;background:${captureStyle.backgroundColor};color:${captureStyle.color};` +
        `font-family:${captureStyle.fontFamily}`;

      const capturedAnimations = sourceAnimations.filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element && captureRoot.contains(target);
      });
      const capturedTargets: HTMLElement[] = [];
      capturedAnimations.forEach((animation) => {
        const target = (animation.effect as KeyframeEffect).target as HTMLElement;
        let targetIndex = capturedTargets.indexOf(target);
        if (targetIndex < 0) {
          targetIndex = capturedTargets.push(target) - 1;
          target.dataset.e2eAnimationNode = String(targetIndex);
        }
      });
      const clone = captureRoot.cloneNode(true) as HTMLElement;
      clone.style.position = "absolute";
      clone.style.inset = "0";
      clone.style.margin = "0";
      fixture.append(clone);
      document.body.append(fixture);

      const clonedAnimations = capturedAnimations.map((animation) => {
        const sourceTarget = (animation.effect as KeyframeEffect).target as HTMLElement;
        const targetIndex = sourceTarget.dataset.e2eAnimationNode;
        const nodeSelector = `[data-e2e-animation-node="${targetIndex}"]`;
        const target = clone.matches(nodeSelector)
          ? clone
          : clone.querySelector<HTMLElement>(nodeSelector);
        const effect = animation.effect as KeyframeEffect;
        if (!target) throw new Error(`Could not map cloned animation target ${targetIndex}`);
        const cloned = target.animate(effect.getKeyframes(), effect.getTiming());
        cloned.pause();
        return cloned;
      });
      capturedAnimations.forEach((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (target instanceof HTMLElement) delete target.dataset.e2eAnimationNode;
        animation.play();
      });
      delete clone.dataset.e2eAnimationNode;
      clone.querySelectorAll<HTMLElement>("[data-e2e-animation-node]").forEach((target) =>
        delete target.dataset.e2eAnimationNode
      );
      return {
        durationMs,
        easing: configured.easing ?? "",
        clonedAnimationCount: clonedAnimations.length,
      };
    },
    {
      animationSelector: options.animationSelector,
      captureSelector: options.captureSelector,
      transitionProperty: options.transitionProperty,
      animationName: options.animationName,
    },
  );

  const times = boundaryFrameTimes(timeline.durationMs, boundaryMs, fps);
  const frames: AnimationBoundaryFrame[] = [];
  for (const timeMs of times) {
    await page.evaluate((timeMs) => {
      const fixture = document.getElementById("e2e-boundary-capture");
      if (!fixture) throw new Error("Animation boundary fixture disappeared");
      const animations = fixture.getAnimations({ subtree: true });
      if (animations.length === 0) throw new Error("Cloned boundary animations are unavailable");
      animations.forEach((animation) => {
        animation.pause();
        animation.currentTime = timeMs;
      });
    }, timeMs);
    frames.push({
      timeMs,
      png: await page.locator("#e2e-boundary-capture").screenshot({
        animations: "allow",
        caret: "hide",
      }),
    });
  }
  await page.evaluate(() => document.getElementById("e2e-boundary-capture")?.remove());
  return { durationMs: timeline.durationMs, easing: timeline.easing, frames };
}

export function assertMonotonicTransform(samples: TransformSample[], tolerance = 0.25): void {
  if (samples.length < 3) throw new Error("Animation needs at least three transform samples");
  const start = samples[0].x;
  const end = samples.at(-1)!.x;
  const direction = Math.sign(end - start);
  if (direction === 0) throw new Error("Animation transform did not move");

  let distinct = 1;
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const current = samples[index];
    const delta = current.x - previous.x;
    if (Math.abs(delta) > tolerance) distinct++;
    if (direction < 0 && delta > tolerance) {
      throw new Error(
        `Animation moved backwards at ${
          current.timeMs.toFixed(2)
        }ms: ${previous.x} -> ${current.x}`,
      );
    }
    if (direction > 0 && delta < -tolerance) {
      throw new Error(
        `Animation moved backwards at ${
          current.timeMs.toFixed(2)
        }ms: ${previous.x} -> ${current.x}`,
      );
    }
    const lower = Math.min(start, end) - tolerance;
    const upper = Math.max(start, end) + tolerance;
    if (current.x < lower || current.x > upper) {
      throw new Error(
        `Animation escaped its endpoints at ${current.timeMs.toFixed(2)}ms: ${current.x}`,
      );
    }
  }
  if (distinct < 5) {
    throw new Error(`Animation exposed only ${distinct} distinct transform positions`);
  }
}

export async function composeFilmstrip(
  framePngs: Uint8Array[],
  gap = 8,
  columns = framePngs.length,
): Promise<Uint8Array> {
  if (framePngs.length === 0) throw new Error("Cannot compose an empty animation filmstrip");
  if (!Number.isInteger(columns) || columns <= 0) {
    throw new Error(`Filmstrip columns must be a positive integer, got ${columns}`);
  }
  const frames = await Promise.all(framePngs.map((bytes) => Image.decode(bytes)));
  const frameWidth = frames[0].width;
  const frameHeight = frames[0].height;
  for (const frame of frames) {
    if (frame.width !== frameWidth || frame.height !== frameHeight) {
      throw new Error(
        `Filmstrip frames must match: expected ${frameWidth}x${frameHeight}, ` +
          `got ${frame.width}x${frame.height}`,
      );
    }
  }

  const usedColumns = Math.min(columns, frames.length);
  const rows = Math.ceil(frames.length / usedColumns);
  const output = new Image(
    frameWidth * usedColumns + gap * (usedColumns - 1),
    frameHeight * rows + gap * (rows - 1),
  );
  output.fill(0x080910ff);
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex];
    const offsetX = frameIndex % usedColumns * (frameWidth + gap);
    const offsetY = Math.floor(frameIndex / usedColumns) * (frameHeight + gap);
    for (let y = 0; y < frameHeight; y++) {
      const sourceStart = y * frameWidth * 4;
      const sourceEnd = sourceStart + frameWidth * 4;
      const targetStart = ((offsetY + y) * output.width + offsetX) * 4;
      output.bitmap.set(frame.bitmap.subarray(sourceStart, sourceEnd), targetStart);
    }
  }
  return await output.encode();
}

export async function seekTransformAnimation(
  page: Page,
  trackSelector: string,
  captureSelector: string,
  keyframeFractions = [0, 0.25, 0.5, 0.75, 1],
): Promise<SeekedTransformAnimation> {
  const captureVisuals = visualComparisonsEnabled();
  const timeline = await page.evaluate(
    ({ selector, captureSelector, captureVisuals }) => {
      const track = document.querySelector<HTMLElement>(selector);
      if (!track) throw new Error(`Missing animation track: ${selector}`);
      const animation = track.getAnimations().find((candidate) => {
        const transition = candidate as CSSTransition;
        return transition.transitionProperty === "transform";
      });
      if (!animation?.effect) throw new Error("No active transform transition found");
      animation.pause();
      const timing = animation.effect.getComputedTiming();
      const configured = animation.effect.getTiming();
      const durationMs = Number(timing.duration);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new Error(`Invalid transform transition duration: ${timing.duration}`);
      }

      const readX = (timeMs: number) => {
        animation.currentTime = timeMs;
        return new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
      };
      const frameMs = 1_000 / 60;
      const frameCount = Math.ceil(durationMs / frameMs);
      const sampleTimes = Array.from({ length: frameCount }, (_, frame) => frame * frameMs);
      sampleTimes.push(durationMs);
      const cabins = Array.from(track.querySelectorAll<HTMLElement>(".train-cabin-wrap"));
      if (cabins.length < 2) throw new Error("Animation track needs at least two cabins");
      const slotPitchPx = Math.abs(cabins[1].offsetLeft - cabins[0].offsetLeft);
      if (slotPitchPx <= 0) throw new Error("Animation track has an invalid cabin slot pitch");
      const samples = sampleTimes.map((timeMs) => ({ timeMs, x: readX(timeMs) }));
      const stage = track.closest<HTMLElement>(".display-wall__stage");
      if (!stage) throw new Error("Animation track is not inside the display stage");
      const stageCenter = stage.getBoundingClientRect().left +
        stage.getBoundingClientRect().width / 2;
      const endCenterOffset = Math.min(
        ...Array.from(track.querySelectorAll<HTMLElement>(".train-cabin-wrap"), (cabin) => {
          const rect = cabin.getBoundingClientRect();
          return Math.abs(rect.left + rect.width / 2 - stageCenter);
        }),
      );

      if (captureVisuals) {
        const captureRoot = document.querySelector<HTMLElement>(captureSelector);
        if (!captureRoot) throw new Error(`Missing animation capture root: ${captureSelector}`);
        document.getElementById("e2e-animation-capture")?.remove();
        const captureRect = captureRoot.getBoundingClientRect();
        const captureStyle = getComputedStyle(captureRoot);
        const fixture = document.createElement("div");
        fixture.id = "e2e-animation-capture";
        fixture.style.cssText =
          `position:relative;width:${captureRect.width}px;height:${captureRect.height}px;` +
          `overflow:hidden;background:#080910;color:${captureStyle.color};` +
          `font-family:${captureStyle.fontFamily}`;
        const clone = captureRoot.cloneNode(true) as HTMLElement;
        clone.style.width = `${captureRect.width}px`;
        clone.style.height = `${captureRect.height}px`;
        const cloneTrack = clone.querySelector<HTMLElement>(".display-wall__track");
        if (!cloneTrack) throw new Error("Cloned animation fixture has no track");
        cloneTrack.style.transition = "none";
        cloneTrack.style.transform = `translateX(${samples[0].x}px)`;
        const cloneAnimation = cloneTrack.animate(
          [
            { transform: `translateX(${samples[0].x}px)` },
            { transform: `translateX(${samples.at(-1)!.x}px)` },
          ],
          { duration: durationMs, easing: configured.easing, fill: "both" },
        );
        cloneAnimation.pause();
        cloneAnimation.currentTime = 0;
        fixture.append(clone);
        const label = document.createElement("div");
        label.className = "e2e-animation-frame-label";
        label.style.cssText =
          "position:absolute;left:16px;top:16px;z-index:9999;padding:8px 12px;" +
          "border:1px solid #fff;background:#080910;color:#fff;font:700 18px/1.2 monospace";
        fixture.append(label);
        document.body.append(fixture);
        for (const textSelector of [".train-cabin__message", ".train-cabin__name"]) {
          const sourceText = captureRoot.querySelector<HTMLElement>(textSelector);
          const clonedText = clone.querySelector<HTMLElement>(textSelector);
          if (!sourceText || !clonedText) continue;
          const sourceTextStyle = getComputedStyle(sourceText);
          const clonedTextStyle = getComputedStyle(clonedText);
          if (
            clonedTextStyle.color !== sourceTextStyle.color ||
            clonedTextStyle.fontFamily !== sourceTextStyle.fontFamily
          ) {
            throw new Error(
              `Cloned animation text style differs for ${textSelector}: ` +
                `${clonedTextStyle.color}/${clonedTextStyle.fontFamily} !== ` +
                `${sourceTextStyle.color}/${sourceTextStyle.fontFamily}`,
            );
          }
        }
      }

      animation.currentTime = Math.max(0, durationMs - 1);
      animation.play();
      return {
        durationMs,
        easing: configured.easing ?? "",
        startX: samples[0].x,
        endX: samples.at(-1)!.x,
        slotPitchPx,
        endCenterOffset,
        samples,
      };
    },
    { selector: trackSelector, captureSelector, captureVisuals },
  );

  const keyframePngs: Uint8Array[] = [];
  const boundaryFrames: AnimationBoundaryFrame[] = [];
  if (captureVisuals) {
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.race([
        Promise.all(
          Array.from(document.images, (image) => image.decode().catch(() => undefined)),
        ),
        new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
      ]);
    });
    for (const fraction of keyframeFractions) {
      await page.evaluate(
        ({ currentTime, label }) => {
          const track = document.querySelector<HTMLElement>(
            "#e2e-animation-capture .display-wall__track",
          );
          const animation = track?.getAnimations()[0];
          if (!animation) throw new Error("Cloned transform animation is unavailable");
          animation.pause();
          animation.currentTime = currentTime;
          const frameLabel = document.querySelector<HTMLElement>(".e2e-animation-frame-label");
          if (frameLabel) frameLabel.textContent = label;
        },
        {
          currentTime: timeline.durationMs * fraction,
          label: `${Math.round(fraction * 100)}% · ${Math.round(timeline.durationMs * fraction)}ms`,
        },
      );
      keyframePngs.push(
        await page.locator("#e2e-animation-capture").screenshot({
          animations: "allow",
          caret: "hide",
        }),
      );
    }
    await page.evaluate(() => {
      const label = document.querySelector<HTMLElement>(".e2e-animation-frame-label");
      if (label) label.style.display = "none";
    });
    for (const timeMs of boundaryFrameTimes(timeline.durationMs)) {
      await page.evaluate((timeMs) => {
        const track = document.querySelector<HTMLElement>(
          "#e2e-animation-capture .display-wall__track",
        );
        const animation = track?.getAnimations()[0];
        if (!animation) throw new Error("Cloned transform animation is unavailable");
        animation.pause();
        animation.currentTime = timeMs;
      }, timeMs);
      boundaryFrames.push({
        timeMs,
        png: await page.locator("#e2e-animation-capture").screenshot({
          animations: "allow",
          caret: "hide",
        }),
      });
    }
    await page.evaluate(() => document.getElementById("e2e-animation-capture")?.remove());
  }

  return { ...timeline, keyframePngs, boundaryFrames };
}
