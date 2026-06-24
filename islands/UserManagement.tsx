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
    const res = await fetch("/api/towkay/users");
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
    const res = await fetch("/api/towkay/users/create", {
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
    const res = await fetch("/api/towkay/users/toggle-status", {
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
    const res = await fetch("/api/towkay/users/delete", {
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
    const res = await fetch("/api/towkay/users/reset-password", {
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
        method="post"
        onSubmit={createAccount}
        class="panel--form"
      >
        <h3>Create account</h3>
        <div class="form-row">
          <input
            placeholder="Username"
            aria-label="New account username"
            value={username}
            onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            aria-label="New account password"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            required
          />
          <select
            aria-label="New account role"
            value={role}
            onChange={(e) => setRole((e.target as HTMLSelectElement).value as typeof role)}
          >
            <option value="moderator">Photo Moderator</option>
            <option value="display_wall">Display Wall User</option>
          </select>
          <button
            type="submit"
            class="btn btn--primary"
          >
            Create
          </button>
        </div>
      </form>

      {message && <p class="panel__message">{message}</p>}

      <div class="data-table-scroll">
        <table class="data-table">
          <thead>
            <tr class="data-table__head">
              <th class="data-table__cell">Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} class="data-table__row">
                <td class="data-table__cell">{user.username}</td>
                <td>{user.role === "moderator" ? "Photo Moderator" : "Display Wall"}</td>
                <td class={user.disabled ? "text-status-disabled" : "text-status-active"}>
                  {user.disabled ? "Disabled" : "Active"}
                </td>
                <td>{new Date(user.created_at).toLocaleString()}</td>
                <td class="data-table__cell data-table__actions">
                  <button
                    type="button"
                    class="btn btn--ghost btn--table-action"
                    onClick={() => toggleStatus(user)}
                  >
                    Toggle
                  </button>
                  <button
                    type="button"
                    class="btn btn--ghost btn--table-action"
                    onClick={() => setResetUserId(user.id)}
                  >
                    Reset pwd
                  </button>
                  <button
                    type="button"
                    class="btn btn--ghost btn--table-action"
                    onClick={() => deleteUser(user)}
                  >
                    Delete
                  </button>
                  {resetUserId === user.id && (
                    <div class="reset-panel">
                      <input
                        type="password"
                        placeholder="New password"
                        aria-label={`New password for ${user.username}`}
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
    </div>
  );
}
