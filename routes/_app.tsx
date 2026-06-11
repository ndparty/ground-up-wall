import AuthStatus from "../islands/AuthStatus.tsx";
import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ground Up Wall — SG National Day</title>
        <link rel="icon" href="/favicon.ico" />
        <style>{`
          :root {
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
            background: linear-gradient(135deg, var(--sg-red) 0%, #c41e3a 100%);
            color: var(--sg-white);
            padding: 0.75rem 1.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }
          .brand-header img { height: 36px; }
          .brand-header h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
          main { min-height: calc(100vh - 60px); }
        `}</style>
      </head>
      <body>
        <header class="brand-header">
          <img src="/logo.svg" alt="SG National Day" />
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
