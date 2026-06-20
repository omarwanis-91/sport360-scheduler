const { cp, mkdir, rm } = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

async function build() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(root, "index.html"), path.join(output, "index.html"));
  await cp(path.join(root, "src"), path.join(output, "src"), { recursive: true });
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
