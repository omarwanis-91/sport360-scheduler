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
  const shell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: process.env,
    shell,
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

function findCommand(command) {
  if (process.platform === "win32") {
    const result = spawnSync("where.exe", [command], {
      cwd: rootDir,
      shell: false,
      stdio: "pipe"
    });
    if (result.status === 0) {
      return result.stdout.toString().split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    }
    return null;
  }

  const result = spawnSync("command", ["-v", command], {
    cwd: rootDir,
    shell: true,
    stdio: "pipe"
  });
  if (result.status === 0) {
    return result.stdout.toString().split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  }
  return null;
}

function resolveSupabaseCommand() {
  if (process.platform !== "win32") {
    const localSupabase = path.join(rootDir, "node_modules", ".bin", "supabase");

    if (fs.existsSync(localSupabase)) {
      return { command: localSupabase, prefixArgs: [], source: "local dev dependency" };
    }
  }

  const globalSupabase = process.platform === "win32" ? "supabase.cmd" : "supabase";
  const globalSupabasePath = findCommand(globalSupabase);
  if (globalSupabasePath) {
    return { command: globalSupabase, prefixArgs: [], source: "global CLI" };
  }

  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
  const npxPath = findCommand(npxCommand);
  if (npxPath) {
    return { command: npxCommand, prefixArgs: ["-y", "supabase"], source: "npx fallback" };
  }

  return null;
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

function dump(supabaseCli, dbUrl, outputDir, file, extraArgs) {
  const target = path.join(outputDir, file);
  run(supabaseCli.command, [
    ...supabaseCli.prefixArgs,
    "db",
    "dump",
    "--db-url",
    dbUrl,
    "-f",
    target,
    ...extraArgs
  ]);
  return target;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const supabaseCli = resolveSupabaseCommand();

  if (!supabaseCli) {
    throw new Error(
      "Supabase CLI was not found and npx is unavailable. Install the Supabase CLI or Node/npm first."
    );
  }

  console.log(`Supabase CLI available through ${supabaseCli.source}.`);
  console.log(`Backup output root: ${backupRoot}`);

  if (checkOnly) {
    console.log("Manual backup prerequisites look ready. No database connection was requested.");
    return;
  }

  const dbUrl = await getDbUrl();
  if (!dbUrl) {
    throw new Error("A Supabase database connection string is required.");
  }

  const outputDir = path.join(backupRoot, stamp());
  fs.mkdirSync(outputDir, { recursive: true });

  let files;
  try {
    files = [
      dump(supabaseCli, dbUrl, outputDir, "roles.sql", ["--role-only"]),
      dump(supabaseCli, dbUrl, outputDir, "schema.sql", []),
      dump(supabaseCli, dbUrl, outputDir, "data.sql", [
        "--use-copy",
        "--data-only",
        "-x",
        "storage.buckets_vectors",
        "-x",
        "storage.vector_indexes"
      ]),
      dump(supabaseCli, dbUrl, outputDir, "migration_history_schema.sql", [
        "--schema",
        "supabase_migrations"
      ]),
      dump(supabaseCli, dbUrl, outputDir, "migration_history_data.sql", [
        "--use-copy",
        "--data-only",
        "--schema",
        "supabase_migrations"
      ])
    ];
  } catch (error) {
    fs.rmSync(outputDir, { force: true, recursive: true });
    throw error;
  }

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
