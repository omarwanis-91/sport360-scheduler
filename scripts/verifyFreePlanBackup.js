const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const backupRoot = process.env.SPORT360_BACKUP_DIR
  ? path.resolve(process.env.SPORT360_BACKUP_DIR)
  : path.resolve(rootDir, "..", "sport360-backups");

const requiredFiles = [
  "roles.sql",
  "schema.sql",
  "data.sql",
  "migration_history_schema.sql",
  "migration_history_data.sql",
  "manifest.json"
];

function resolveBackupDir() {
  const explicit = process.argv[2] && !process.argv[2].startsWith("-");
  if (explicit) {
    return path.resolve(process.argv[2]);
  }

  if (!fs.existsSync(backupRoot)) {
    throw new Error(`Backup root does not exist: ${backupRoot}`);
  }

  const candidates = fs.readdirSync(backupRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(backupRoot, entry.name);
      return { fullPath, mtime: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (!candidates.length) {
    throw new Error(`No backup folders found under: ${backupRoot}`);
  }

  return candidates[0].fullPath;
}

function assertFileExistsAndHasContent(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`Expected a file but found something else: ${filePath}`);
  }

  if (stat.size <= 0) {
    throw new Error(`Required file is empty: ${filePath}`);
  }

  return stat.size;
}

function readManifest(backupDir) {
  const manifestPath = path.join(backupDir, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  if (manifest.backupType !== "supabase-free-plan-manual-export") {
    throw new Error("Manifest backupType does not match the Sport360 manual export helper.");
  }

  if (!manifest.createdAt || Number.isNaN(Date.parse(manifest.createdAt))) {
    throw new Error("Manifest is missing a valid createdAt timestamp.");
  }

  if (!Array.isArray(manifest.files)) {
    throw new Error("Manifest is missing the files list.");
  }

  const missingFromManifest = requiredFiles.filter((file) => !manifest.files.includes(file));
  if (missingFromManifest.length) {
    throw new Error(`Manifest does not list: ${missingFromManifest.join(", ")}`);
  }

  return manifest;
}

function main() {
  const backupDir = resolveBackupDir();
  const sizes = new Map();

  for (const file of requiredFiles) {
    sizes.set(file, assertFileExistsAndHasContent(path.join(backupDir, file)));
  }

  const manifest = readManifest(backupDir);

  console.log(`Backup folder verified: ${backupDir}`);
  console.log(`Created at: ${manifest.createdAt}`);
  console.log(`Git commit: ${manifest.gitCommit || "unknown"}`);
  for (const file of requiredFiles) {
    console.log(`- ${file}: ${sizes.get(file)} bytes`);
  }
  console.log("This confirms export completeness only. Restore rehearsal still must run in a non-production Supabase project.");
}

try {
  main();
} catch (error) {
  console.error(`Backup verification failed: ${error.message}`);
  if (error.message.includes("Backup root does not exist") || error.message.includes("No backup folders")) {
    console.error("Run `npm.cmd run backup:manual` first, then rerun `npm.cmd run backup:verify`.");
  }
  process.exit(1);
}
