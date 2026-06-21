import AdminDisplayOverride from "../../islands/AdminDisplayOverride.tsx";
import { define } from "../../utils.ts";

export default define.page(function AdminDisplayOverridePage() {
  return (
    <div class="page page--override">
      <h2 class="heading-brand">Display Override</h2>
      <p>
        <a href="/admin">← Back to admin</a>
      </p>
      <AdminDisplayOverride />
    </div>
  );
});
