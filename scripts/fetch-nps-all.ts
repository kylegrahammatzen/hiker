function getArgValue(flag: string): string | null {
  const prefix = `--${flag}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function collectArgs(flags: string[]): string[] {
  const args: string[] = [];

  for (const flag of flags) {
    const value = getArgValue(flag);
    if (!value) continue;
    args.push(`--${flag}=${value}`);
  }

  return args;
}

async function runStep(label: string, args: string[]) {
  console.log(`\n=== ${label} ===`);

  const proc = Bun.spawn({
    cmd: ["bun", "run", ...args],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}`);
  }
}

async function main() {
  const trailsArgs = collectArgs(["states", "park-limit", "max-trails-per-park"]);
  const boundariesArgs = collectArgs(["batch-size", "tolerance"]);
  const cleaningArgs = collectArgs(["max-distance", "merge-distance"]);

  await runStep("Fetch trails", ["scripts/fetch-nps-trails.ts", ...trailsArgs]);
  await runStep("Fetch boundaries", ["scripts/fetch-nps-boundaries.ts", ...boundariesArgs]);
  await runStep("Clean trails and boundaries", ["scripts/clean-trails-boundaries.ts", ...cleaningArgs]);

  console.log("\nDone. trails.json and boundaries.json are refreshed and cleaned.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
