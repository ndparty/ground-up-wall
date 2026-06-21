import AdminDisplayOverride from "../../islands/AdminDisplayOverride.tsx";
import { define } from "../../utils.ts";

export default define.page(function AdminDisplayOverridePage() {
  return (
    <div style="padding: 2rem 1.5rem; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #ef3340;">Display Override</h2>
      <p>
        <a href="/admin">← Back to admin</a>
      </p>
      <AdminDisplayOverride />
    </div>
  );
});
