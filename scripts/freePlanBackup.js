const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const rootDir = path.resolve(__dirname, "..");
const backupRoot = process.env.SPORT360_BACKUP_DIR
  ? path.resolve(process.env.SPORT360_BACKUP_DIR)
  : path.resolve(rootDir, "..", "sport360-backups");

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: process.env,
    shell: false,
    stdio: options.stdio || "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }

  return result.stdout ? result.stdout.toString().trim() : "";
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: rootDir,
    shell: false,
    stdio: "ignore"
  });
  return result.status === 0;
}

function readHiddenLine(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("SUPABASE_DB_URL is required when running non-interactively."));
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const stdin = process.stdin;
    let value = "";

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdin.setRawMode(false);
      stdin.removeListener("data", onData);
      rl.close();
      process.stdout.write("\n");
    }

    function onData(char) {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Backup cancelled."));
        return;
      }

      if (char === "\r" || char === "\n") {
        cleanup();
        resolve(value.trim());
        return;
      }

      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        return;
      }

      value += char;
    }

    stdin.on("data", onData);
  });
}

async function getDbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL.trim();
  if (process.env.SPORT360_SUPABASE_DB_URL) return process.env.SPORT360_SUPABASE_DB_URL.trim();
  return readHiddenLine("Paste Supabase database connection string (input hidden): ");
}

function getGitCommit() {
  try {
    return run("git", ["rev-parse", "--short", "HEAD"], { stdio: "pipe" });
  } catch {
    return "unknown";
  }
}

function dump(supabaseCommand, dbUrl, outputDir, file, extraArgs) {
  const target = path.join(outputDir, file);
  run(supabaseCommand, ["db", "dump", "--db-url", dbUrl, "-f", target, ...extraArgs]);
  return target;
}

async function main() {
  const supabaseCommand = process.platform === "win32" ? "supabase.cmd" : "supabase";

  if (!commandExists(supabaseCommand)) {
    throw new Error(
      "Supabase CLI was not found. Install it first, then rerun `npm.cmd run backup:manual`."
    );
  }

  const dbUrl = await getDbUrl();
  if (!dbUrl) {
    throw new Error("A Supabase database connection string is required.");
  }

  const outputDir = path.join(backupRoot, stamp());
  fs.mkdirSync(outputDir, { recursive: true });

  const files = [
    dump(supabaseCommand, dbUrl, outputDir, "roles.sql", ["--role-only"]),
    dump(supabaseCommand, dbUrl, outputDir, "schema.sql", []),
    dump(supabaseCommand, dbUrl, outputDir, "data.sql", [
      "--use-copy",
      "--data-only",
      "-x",
      "storage.buckets_vectors",
      "-x",
      "storage.vector_indexes"
    ]),
    dump(supabaseCommand, dbUrl, outputDir, "migration_history_schema.sql", [
      "--schema",
      "supabase_migrations"
    ]),
    dump(supabaseCommand, dbUrl, outputDir, "migration_history_data.sql", [
      "--use-copy",
      "--data-only",
      "--schema",
      "supabase_migrations"
    ])
  ];

  const manifest = {
    createdAt: new Date().toISOString(),
    gitCommit: getGitCommit(),
    backupType: "supabase-free-plan-manual-export",
    files: files.map((file) => path.basename(file)),
    notes: [
      "Database connection string is intentionally not stored.",
      "Keep this folder outside the repository and in an approved private off-site location.",
      "Restore must be rehearsed in a non-production Supabase project before production release."
    ]
  };

  fs.writeFileSync(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nManual Supabase export complete: ${outputDir}`);
  console.log("Store this folder off-site and record it in docs/PRODUCTION_RUNBOOK.md.");
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exit(1);
});
