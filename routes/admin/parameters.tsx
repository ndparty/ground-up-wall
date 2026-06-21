import SystemParameters from "../../islands/SystemParameters.tsx";
import { define } from "../../utils.ts";

export default define.page(function AdminParametersPage() {
  return (
    <div class="page page--moderate">
      <h2 class="heading-brand">System Parameters</h2>
      <p>
        <a href="/admin">← Back to admin</a>
      </p>
      <SystemParameters />
    </div>
  );
});
