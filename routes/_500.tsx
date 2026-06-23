import { define } from "../utils.ts";

export default define.page(function ServerError() {
  return (
    <div class="page page--center">
      <img
        src="/logo-light.png"
        alt="National Day"
        class="error-img"
      />
      <h1 class="error-hero--500">Something went wrong</h1>
      <p class="error-lead">
        We hit a snag on the parade route. Please try again.
      </p>
      <div class="error-actions">
        <button
          type="button"
          onClick={() => globalThis.location.reload()}
          class="btn btn--cta"
        >
          Retry
        </button>
        <a
          href="/"
          class="btn btn--outline"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
});
