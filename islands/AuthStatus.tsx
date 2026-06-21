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
    return (
      <a href="/login" style="color: white; margin-left: auto; text-decoration: none;">
        Login
      </a>
    );
  }

  const isAdmin = user.role === "admin";
  const canModerate = user.role === "moderator" || isAdmin;
  const canDisplay = user.role === "display_wall" || canModerate;

  return (
    <div style="margin-left: auto; display: flex; align-items: center; gap: 1rem; color: white;">
      <span>Hi, {user.username}</span>
      {canDisplay && <a href="/display" style="color: white;">Display</a>}
      {canModerate && <a href="/moderate" style="color: white;">Moderate</a>}
      {isAdmin && <a href="/admin" style="color: white;">Admin</a>}
      <a href="/change-password" style="color: white;">Change password</a>
      <button
        type="button"
        onClick={handleLogout}
        style="background: rgba(255,255,255,0.2); border: 1px solid white; color: white; padding: 0.25rem 0.75rem; border-radius: 4px; cursor: pointer;"
      >
        Logout
      </button>
    </div>
  );
}
