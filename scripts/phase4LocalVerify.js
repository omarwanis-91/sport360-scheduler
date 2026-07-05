const { spawnSync } = require("node:child_process");

const isWindows = process.platform === "win32";
const npmCommandName = isWindows ? "npm.cmd" : "npm";

const steps = [
  { name: "Static syntax check", args: ["run", "check"] },
  { name: "Unit tests", args: ["test"] },
  { name: "Production build", args: ["run", "build"], env: { SPORT360_DEMO_MODE: "true" } },
  { name: "Demo browser smoke tests", args: ["run", "test:smoke"], env: { SPORT360_DEMO_MODE: "true" } }
];

function findCommand(command) {
  if (isWindows) {
    const result = spawnSync("where.exe", [command], { shell: false, stdio: "pipe" });
    if (result.status === 0) {
      return result.stdout.toString().split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    }
    return null;
  }

  const result = spawnSync("command", ["-v", command], { shell: true, stdio: "pipe" });
  if (result.status === 0) {
    return result.stdout.toString().split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  }
  return null;
}

function runStep(step) {
  console.log(`\n== ${step.name} ==`);
  const npmCommand = findCommand(npmCommandName);
  if (!npmCommand) {
    throw new Error(`${npmCommandName} was not found on PATH.`);
  }

  const command = isWindows ? npmCommandName : npmCommand;
  const result = spawnSync(command, step.args, {
    env: { ...process.env, ...(step.env || {}) },
    shell: isWindows,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${step.name} failed with exit code ${result.status}`);
  }
}

function main() {
  const startedAt = Date.now();

  for (const step of steps) {
    runStep(step);
  }

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\nPhase 4 local verification passed in ${seconds}s.`);
  console.log("This does not replace the live Supabase export/restore rehearsal or production role checks.");
}

try {
  main();
} catch (error) {
  console.error(`\nPhase 4 local verification failed: ${error.message}`);
  process.exit(1);
}
