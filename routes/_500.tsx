import { define } from "../utils.ts";

export default define.page(function ServerError() {
  return (
    <div style="padding: 3rem 1.5rem; text-align: center;">
      <img
        src="/logo-light.png"
        alt="National Day"
        style="width: min(360px, 80vw); height: auto; margin-bottom: 1.5rem;"
      />
      <h1 style="font-size: 3rem; margin: 0; color: #a72517;">Something went wrong</h1>
      <p style="font-size: 1.25rem; margin-top: 1rem;">
        We hit a snag on the parade route. Please try again.
      </p>
      <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem; flex-wrap: wrap;">
        <button
          type="button"
          onClick={() => globalThis.location.reload()}
          style="padding: 0.75rem 1.5rem; background: #ef3340; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem;"
        >
          Retry
        </button>
        <a
          href="/"
          style="display: inline-block; padding: 0.75rem 1.5rem; background: transparent; color: #ef3340; text-decoration: none; border: 2px solid #ef3340; border-radius: 4px;"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
});
