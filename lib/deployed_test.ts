import { assertEquals } from "@std/assert";
import { isDeployedEnvironment } from "./deployed.ts";

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void,
): void {
  const prior = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    prior.set(key, Deno.env.get(key));
    if (value === undefined) Deno.env.delete(key);
    else Deno.env.set(key, value);
  }
  try {
    fn();
  } finally {
    for (const [key, value] of prior) {
      if (value === undefined) Deno.env.delete(key);
      else Deno.env.set(key, value);
    }
  }
}

Deno.test("isDeployedEnvironment is false by default in tests", () => {
  withEnv({
    DENO_DEPLOYMENT_ID: undefined,
    DEPLOYED: undefined,
    NODE_ENV: undefined,
  }, () => {
    assertEquals(isDeployedEnvironment(), false);
  });
});

Deno.test("isDeployedEnvironment respects DEPLOYED=1", () => {
  withEnv({ DEPLOYED: "1", DENO_DEPLOYMENT_ID: undefined, NODE_ENV: undefined }, () => {
    assertEquals(isDeployedEnvironment(), true);
  });
});

Deno.test("isDeployedEnvironment respects DENO_DEPLOYMENT_ID", () => {
  withEnv({ DEPLOYED: undefined, DENO_DEPLOYMENT_ID: "abc", NODE_ENV: undefined }, () => {
    assertEquals(isDeployedEnvironment(), true);
  });
});
