import { page } from "fresh";
import { define } from "../utils.ts";

export const handlers = define.handlers({
  GET() {
    return page({}, { status: 404 });
  },
});

export default define.page<typeof handlers>(function NotFound() {
  return (
    <div class="page page--center">
      <img
        src="/logo-light.png"
        alt="National Day"
        class="error-img"
      />
      <h1 class="error-hero">404</h1>
      <p class="error-lead">
        Oops! This page wandered off the parade route.
      </p>
      <p class="text-muted">
        The page you're looking for doesn't exist. Head back to celebrate National Day with us!
      </p>
      <a
        href="/"
        class="btn btn--cta mt-lg"
      >
        Back to Home
      </a>
    </div>
  );
});
