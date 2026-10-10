import { defineConfig } from "@playwright/test";

const baseURL = process.env.SPORT360_LIVE_URL || "https://sport360-scheduler.vercel.app";

export default defineConfig({
  testDir: "./live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 45_000,
  expect: {
    timeout: 12_000
  },
  outputDir: "test-results/live-roles",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chrome",
      use: { browserName: "chromium", channel: "chrome" }
    },
    {
      name: "edge",
      use: { browserName: "chromium", channel: "msedge" }
    },
    {
      name: "firefox",
      use: { browserName: "firefox" }
    }
  ]
});
