import { useEffect, useState } from "preact/hooks";
import type { AuthUser } from "../lib/services/auth_service.ts";

export default function AuthStatus() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/masuk/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  async function handleLogout() {
    await fetch("/api/masuk/logout", { method: "POST" });
    setUser(null);
    globalThis.location.href = "/masuk";
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
      {canDisplay && <a href="/concourse" class="auth-nav__link">Display</a>}
      {canModerate && <a href="/semak" class="auth-nav__link">Moderate</a>}
      {canModerate && <a href="/semak/pamer" class="auth-nav__link">Gallery</a>}
      {isAdmin && <a href="/towkay" class="auth-nav__link">Admin</a>}
      <a href="/tukar" class="auth-nav__link">Change password</a>
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
