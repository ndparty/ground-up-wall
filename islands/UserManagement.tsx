import { useEffect, useState } from "preact/hooks";

interface ManagedUser {
  id: string;
  username: string;
  role: "moderator" | "display_wall";
  disabled: boolean;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"moderator" | "display_wall">("moderator");
  const [message, setMessage] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (!res.ok) {
      setMessage("Failed to load users");
      return;
    }
    setUsers(await res.json());
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createAccount(e: Event) {
    e.preventDefault();
    setMessage("");
    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Create failed");
      return;
    }
    setUsername("");
    setPassword("");
    setMessage("Account created");
    await loadUsers();
  }

  async function toggleStatus(user: ManagedUser) {
    if (user.disabled && !globalThis.confirm(`Enable ${user.username}?`)) return;
    if (!user.disabled && !globalThis.confirm(`Disable ${user.username}?`)) return;
    const action = user.disabled ? "enable" : "disable";
    const res = await fetch("/api/admin/users/toggle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, action }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Update failed");
      return;
    }
    setMessage(action === "disable" ? `Disabled ${user.username}` : `Enabled ${user.username}`);
    await loadUsers();
  }

  async function deleteUser(user: ManagedUser) {
    if (!globalThis.confirm(`Delete ${user.username}? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, confirmed: true }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Delete failed");
      return;
    }
    setMessage(`Deleted ${user.username}`);
    await loadUsers();
  }

  async function submitResetPassword(user: ManagedUser) {
    const res = await fetch("/api/admin/users/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        newPassword: resetPassword,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error ?? "Password reset failed");
      return;
    }
    setResetUserId(null);
    setResetPassword("");
    setMessage(`Password reset for ${user.username}`);
  }

  return (
    <div>
      <form
        onSubmit={createAccount}
        style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #ddd; border-radius: 8px;"
      >
        <h3>Create account</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: end;">
          <input
            placeholder="Username"
            value={username}
            onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            required
          />
          <select
            value={role}
            onChange={(e) => setRole((e.target as HTMLSelectElement).value as typeof role)}
          >
            <option value="moderator">Photo Moderator</option>
            <option value="display_wall">Display Wall User</option>
          </select>
          <button type="submit" style="background: #ef3340; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px;">
            Create
          </button>
        </div>
      </form>

      {message && <p style="color: #333;">{message}</p>}

      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="background: #f5f5f5; text-align: left;">
            <th style="padding: 0.5rem;">Username</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style="border-bottom: 1px solid #eee;">
              <td style="padding: 0.5rem;">{user.username}</td>
              <td>{user.role === "moderator" ? "Photo Moderator" : "Display Wall"}</td>
              <td style={{ color: user.disabled ? "#c62828" : "#2e7d32" }}>
                {user.disabled ? "Disabled" : "Active"}
              </td>
              <td>{new Date(user.created_at).toLocaleString()}</td>
              <td style="padding: 0.5rem;">
                <button type="button" onClick={() => toggleStatus(user)}>Toggle</button>{" "}
                <button type="button" onClick={() => setResetUserId(user.id)}>Reset pwd</button>{" "}
                <button type="button" onClick={() => deleteUser(user)}>Delete</button>
                {resetUserId === user.id && (
                  <div style="margin-top: 0.5rem;">
                    <input
                      type="password"
                      placeholder="New password"
                      value={resetPassword}
                      onInput={(e) => setResetPassword((e.target as HTMLInputElement).value)}
                    />
                    <button type="button" onClick={() => submitResetPassword(user)}>Save</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
