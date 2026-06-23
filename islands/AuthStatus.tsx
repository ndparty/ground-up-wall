import { useEffect, useState } from "preact/hooks";
import type { AuthUser } from "../lib/services/auth_service.ts";

export default function AuthStatus() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    globalThis.location.href = "/login";
  }

  if (!loaded) return null;

  if (!user) {
    return null;
  }

  const isAdmin = user.role === "admin";
  const canModerate = user.role === "moderator" || isAdmin;
  const canDisplay = user.role === "display_wall" || canModerate;

  return (
    <div class="auth-nav">
      <span>Hi, {user.username}</span>
      {canDisplay && <a href="/display" class="auth-nav__link">Display</a>}
      {canModerate && <a href="/moderate" class="auth-nav__link">Moderate</a>}
      {canModerate && <a href="/moderate/approved" class="auth-nav__link">Gallery</a>}
      {isAdmin && <a href="/admin" class="auth-nav__link">Admin</a>}
      <a href="/change-password" class="auth-nav__link">Change password</a>
      <button
        type="button"
        onClick={handleLogout}
        class="auth-nav__logout"
      >
        Logout
      </button>
    </div>
  );
}
