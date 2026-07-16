const artifactsRoot = Deno.env.get("E2E_ARTIFACTS_DIR") ?? "test-results/e2e-browser";

try {
  await Deno.remove(artifactsRoot, { recursive: true });
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}
await Deno.mkdir(artifactsRoot, { recursive: true });

const command = new Deno.Command(Deno.execPath(), {
  args: ["test", "--allow-all", "tests/e2e-browser/"],
  env: Deno.env.toObject(),
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});
const status = await command.spawn().status;
if (!status.success) Deno.exit(status.code);
