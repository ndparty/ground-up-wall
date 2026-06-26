import UserManagement from "../../islands/UserManagement.tsx";
import { define } from "../../utils.ts";

export default define.page(function AdminUsersPage() {
  return (
    <div class="page page--admin">
      <h2 class="heading-brand">User Management</h2>
      <p>
        <a href="/towkay">← Back to admin</a>
      </p>
      <UserManagement />
    </div>
  );
});
