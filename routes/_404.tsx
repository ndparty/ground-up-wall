import { define } from "../utils.ts";

export default define.page(function NotFound() {
  return (
    <div style="padding: 3rem 1.5rem; text-align: center;">
      <h1 style="font-size: 4rem; margin: 0; color: #ef3340;">404</h1>
      <p style="font-size: 1.25rem; margin-top: 1rem;">
        Oops! This page wandered off the parade route.
      </p>
      <p style="color: #666;">
        The page you're looking for doesn't exist. Head back to celebrate National Day with us!
      </p>
      <a
        href="/"
        style="display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem; background: #ef3340; color: white; text-decoration: none; border-radius: 4px;"
      >
        Back to Home
      </a>
    </div>
  );
});
