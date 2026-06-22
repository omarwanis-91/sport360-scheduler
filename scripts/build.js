const { cp, mkdir, rm, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { assertDeployConfig, loadRuntimeConfig, runtimeConfigSource } = require("./runtimeConfig");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

async function build() {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(root, "index.html"), path.join(output, "index.html"));
  await cp(path.join(root, "src"), path.join(output, "src"), { recursive: true });
  const runtimeConfig = loadRuntimeConfig(root);
  assertDeployConfig(runtimeConfig);
  await writeFile(path.join(output, "runtime-config.js"), runtimeConfigSource(runtimeConfig));
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
