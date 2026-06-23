import AuditLogView from "../../islands/AuditLogView.tsx";
import { define } from "../../utils.ts";

export default define.page(function AdminAuditLogPage() {
  return (
    <div class="page page--audit">
      <h2 class="heading-brand">Audit Log</h2>
      <p>
        <a href="/admin">← Back to admin</a>
      </p>
      <AuditLogView />
    </div>
  );
});
