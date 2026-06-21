import AuthStatus from "../islands/AuthStatus.tsx";
import { define } from "../utils.ts";

export default define.page(function App({ Component, state }) {
  const nonce = state.cspNonce ?? "";
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ground-Up Photowall — National Day Ground-Up Party</title>
        <link rel="icon" href="/sg-flag.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        {nonce && <meta property="csp-nonce" content={nonce} />}
        <link rel="stylesheet" href="/app.css" nonce={nonce || undefined} />
      </head>
      <body>
        <header class="brand-header">
          <img src="/logo-dark.png" alt="National Day" />
          <h1>Ground-Up Photowall</h1>
          <AuthStatus />
        </header>
        <main>
          <Component />
        </main>
      </body>
    </html>
  );
});
