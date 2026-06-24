export interface PublicParticipantUrl {
  bannerHost: string;
  qrOrigin: string;
}

/**
 * Parse admin-configured public base URL for display banner + QR cabin.
 * Returns null when unset (client falls back to location.host / location.origin).
 */
export function resolvePublicParticipantUrl(
  configured: string | null | undefined,
): PublicParticipantUrl | null {
  const raw = configured?.trim() ?? "";
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  if (raw.length > 200) return null;

  const path = url.pathname.replace(/\/$/, "") || "";
  if (path !== "") return null;

  return {
    bannerHost: url.host,
    qrOrigin: url.origin,
  };
}
