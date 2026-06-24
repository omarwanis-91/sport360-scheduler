import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./smoke",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "node scripts/smokeServer.js",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000
  }
});
