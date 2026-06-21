export const DEMO_IMAGE_WIDTH = 400;
export const DEMO_IMAGE_HEIGHT = 400;

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;

/** 5×7 bitmap digits 0–9 (# = ink). */
const DIGIT_GLYPHS: string[][] = [
  ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  ["01110", "10001", "00001", "00110", "00001", "10001", "01110"],
  ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  ["01110", "10000", "11110", "10001", "10001", "10001", "01110"],
  ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  ["01110", "10001", "10001", "01111", "00001", "10001", "01110"],
];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
): void {
  if (x < 0 || y < 0 || x >= width) return;
  const idx = (y * width + x) * 4;
  data[idx] = r;
  data[idx + 1] = g;
  data[idx + 2] = b;
  data[idx + 3] = 255;
}

function fillBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sequenceNumber: number,
): void {
  const hue = (sequenceNumber * 47) % 360;
  const [br, bg, bb] = hslToRgb(hue, 0.55, 0.45);
  const pattern = sequenceNumber % 3;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = br;
      let g = bg;
      let b = bb;

      if (pattern === 1) {
        const stripe = Math.floor(y / 24) % 2;
        if (stripe === 0) {
          r = Math.min(255, r + 25);
          g = Math.min(255, g + 25);
          b = Math.min(255, b + 25);
        }
      } else if (pattern === 2) {
        const t = y / height;
        r = Math.round(r * (1 - t) + br * t * 0.6);
        g = Math.round(g * (1 - t) + bg * t * 0.6);
        b = Math.round(b * (1 - t) + bb * t * 0.6);
      }

      setPixel(data, width, x, y, r, g, b);
    }
  }
}

function drawScaledGlyph(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  glyph: string[],
  originX: number,
  originY: number,
  scale: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let row = 0; row < GLYPH_HEIGHT; row++) {
    for (let col = 0; col < GLYPH_WIDTH; col++) {
      if (glyph[row][col] !== "1") continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          setPixel(
            data,
            width,
            originX + col * scale + sx,
            originY + row * scale + sy,
            r,
            g,
            b,
          );
        }
      }
    }
  }
}

function drawSequenceNumber(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sequenceNumber: number,
): void {
  const text = String(sequenceNumber);
  const scale = sequenceNumber >= 10 ? 10 : 12;
  const digitGap = scale;
  const textWidth = text.length * (GLYPH_WIDTH * scale) + (text.length - 1) * digitGap;
  const textHeight = GLYPH_HEIGHT * scale;
  let cursorX = Math.floor((width - textWidth) / 2);
  const originY = Math.floor((height - textHeight) / 2);

  for (const char of text) {
    const digit = Number(char);
    const glyph = DIGIT_GLYPHS[digit];
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      drawScaledGlyph(data, width, height, glyph, cursorX + ox, originY + oy, scale, 20, 20, 30);
    }
    drawScaledGlyph(data, width, height, glyph, cursorX, originY, scale, 255, 255, 255);
    cursorX += GLYPH_WIDTH * scale + digitGap;
  }
}

export function renderDemoImageRgba(
  sequenceNumber: number,
  width = DEMO_IMAGE_WIDTH,
  height = DEMO_IMAGE_HEIGHT,
  _submitterName?: string,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  fillBackground(data, width, height, sequenceNumber);
  drawSequenceNumber(data, width, height, sequenceNumber);
  return data;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU32BE(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, false);
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  writeU32BE(view, 0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  writeU32BE(view, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

async function zlibCompress(data: Uint8Array): Promise<Uint8Array> {
  if (data.length === 0) return new Uint8Array(0);
  const copy = new Uint8Array(data);
  const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function buildFilteredScanlines(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const rowSize = 1 + width * 4;
  const raw = new Uint8Array(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = rowStart + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  return raw;
}

export async function encodePng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  writeU32BE(ihdrView, 0, width);
  writeU32BE(ihdrView, 4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const filtered = buildFilteredScanlines(rgba, width, height);
  const compressed = await zlibCompress(filtered);

  const parts = [
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

export async function generateDemoImage(
  sequenceNumber: number,
  submitterName?: string,
): Promise<Blob> {
  const rgba = renderDemoImageRgba(
    sequenceNumber,
    DEMO_IMAGE_WIDTH,
    DEMO_IMAGE_HEIGHT,
    submitterName,
  );
  const png = await encodePng(rgba, DEMO_IMAGE_WIDTH, DEMO_IMAGE_HEIGHT);
  return new Blob([png.slice()], { type: "image/png" });
}

/** Sample center column pixel for tests comparing digit rendering. */
export function sampleCenterPixel(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] {
  const x = Math.floor(width / 2);
  const y = Math.floor(height / 2);
  const idx = (y * width + x) * 4;
  return [rgba[idx], rgba[idx + 1], rgba[idx + 2]];
}

/** True if any pixel in the digit band differs from solid background corners. */
export function hasDigitInk(rgba: Uint8ClampedArray, width: number, height: number): boolean {
  const corner = [rgba[0], rgba[1], rgba[2]];
  const yStart = Math.floor(height * 0.25);
  const yEnd = Math.floor(height * 0.75);
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = rgba[idx];
      const g = rgba[idx + 1];
      const b = rgba[idx + 2];
      if (r !== corner[0] || g !== corner[1] || b !== corner[2]) {
        if (r > 200 && g > 200 && b > 200) return true;
        if (r < 80 && g < 80 && b < 80) return true;
      }
    }
  }
  return false;
}

export function digitBandWidth(rgba: Uint8ClampedArray, width: number, height: number): number {
  let minX = width;
  let maxX = 0;
  const yStart = Math.floor(height * 0.25);
  const yEnd = Math.floor(height * 0.75);
  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (rgba[idx] > 200 && rgba[idx + 1] > 200 && rgba[idx + 2] > 200) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
  }
  return maxX >= minX ? maxX - minX + 1 : 0;
}
