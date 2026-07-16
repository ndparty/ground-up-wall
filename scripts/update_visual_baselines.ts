const command = new Deno.Command(Deno.execPath(), {
  args: ["task", "test:e2e:browser"],
  env: {
    ...Deno.env.toObject(),
    E2E_STATION_SEED: "42",
    E2E_TRAIN_DWELL_SECONDS: "60",
    E2E_VISUAL: "1",
    E2E_UPDATE_BASELINES: "1",
  },
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const result = await command.spawn().status;
if (!result.success) Deno.exit(result.code);
