import AuthStatus from "../islands/AuthStatus.tsx";
import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ground Up Wall — National Day</title>
        <link rel="icon" href="/sg-flag.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <style>{`
          :root {
            --brand-red: #a72517;
            --sg-red: #ef3340;
            --sg-white: #ffffff;
            --sg-dark: #1a1a2e;
          }
          body {
            margin: 0;
            font-family: system-ui, -apple-system, sans-serif;
            background: var(--sg-white);
            color: var(--sg-dark);
          }
          .brand-header {
            background: #000000;
            color: var(--sg-white);
            padding: 0.75rem 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          .brand-header img { height: 40px; width: auto; }
          .brand-header h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
          main { min-height: calc(100vh - 60px); }
          a:focus-visible,
          button:focus-visible,
          input:focus-visible,
          select:focus-visible,
          textarea:focus-visible {
            outline: 3px solid var(--sg-red);
            outline-offset: 2px;
          }
        `}</style>
      </head>
      <body>
        <header class="brand-header">
          <img src="/logo-dark.png" alt="National Day" />
          <h1>Ground Up Wall</h1>
          <AuthStatus />
        </header>
        <main>
          <Component />
        </main>
      </body>
    </html>
  );
});
