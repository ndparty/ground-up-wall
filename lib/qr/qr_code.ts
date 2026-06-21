import qrcode from "qrcode-generator";

export interface QrSvgOptions {
  /** Module (foreground) colour. Defaults to the National Day dark navy. */
  dark?: string;
  /** Background colour. Defaults to white for maximum scan contrast. */
  light?: string;
  /** Quiet-zone margin in modules (QR spec recommends >= 4). */
  quietZone?: number;
}

/**
 * Render a scannable QR code for `text` as a self-contained SVG string, themed to
 * the display's system colours. Pure/isomorphic so it works in the island on the
 * client (from `location.origin`) without any network round-trip.
 */
export function qrCodeSvg(text: string, options: QrSvgOptions = {}): string {
  const dark = options.dark ?? "#1a1a2e";
  const light = options.light ?? "#ffffff";
  const margin = options.quietZone ?? 4;

  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const size = count + margin * 2;

  const rects: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        rects.push(`<rect x="${col + margin}" y="${row + margin}" width="1" height="1"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet" role="img" ` +
    `aria-label="Upload QR code"><rect width="${size}" height="${size}" rx="2" fill="${light}"/>` +
    `<g fill="${dark}">${rects.join("")}</g></svg>`;
}
