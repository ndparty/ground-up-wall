import SystemParameters from "../../islands/SystemParameters.tsx";
import { define } from "../../utils.ts";

export default define.page(function AdminParametersPage() {
  return (
    <div style="padding: 2rem 1.5rem; max-width: 900px; margin: 0 auto;">
      <h2 style="color: #ef3340;">System Parameters</h2>
      <p>
        <a href="/admin">← Back to admin</a>
      </p>
      <SystemParameters />
    </div>
  );
});
