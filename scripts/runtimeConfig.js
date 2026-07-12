const fs = require("node:fs");
const path = require("node:path");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).reduce((values, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return values;
    const separator = trimmed.indexOf("=");
    if (separator < 1) return values;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[key] = value;
    return values;
  }, {});
}

function asBoolean(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function loadRuntimeConfig(root, environment = process.env) {
  const values = { ...parseEnvFile(path.join(root, ".env.local")), ...environment };
  return {
    supabaseUrl: values.SPORT360_SUPABASE_URL || "",
    supabaseAnonKey: values.SPORT360_SUPABASE_ANON_KEY || "",
    allowSignup: asBoolean(values.SPORT360_ALLOW_SIGNUP),
    release: values.SPORT360_RELEASE || values.COMMIT_REF || "local",
    demoMode: asBoolean(values.SPORT360_DEMO_MODE)
  };
}

function runtimeConfigSource(config) {
  return `window.__SPORT360_CONFIG__ = ${JSON.stringify(config).replace(/</g, "\\u003c")};\n`;
}

function assertDeployConfig(config, environment = process.env) {
  if (environment.NETLIFY === "true" && (!config.supabaseUrl || !config.supabaseAnonKey)) {
    throw new Error("Netlify requires SPORT360_SUPABASE_URL and SPORT360_SUPABASE_ANON_KEY.");
  }
}

module.exports = { assertDeployConfig, loadRuntimeConfig, runtimeConfigSource };

