export function getSessionToken(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(token: string): string {
  return `session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`;
}

export function clearSessionCookieHeader(): string {
  return "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax";
}
