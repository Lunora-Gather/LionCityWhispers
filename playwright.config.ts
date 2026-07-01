import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const isCi = Boolean(process.env.CI);
const hasBuild = existsSync(join(process.cwd(), ".next"));

export default defineConfig({
  testDir: "./tests",
  timeout: 150000,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: 1,
  reporter: isCi ? "line" : "list",
  expect: {
    timeout: 15000
  },
  use: {
    baseURL: "http://127.0.0.1:3019",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: (isCi || hasBuild) ? "npm run start" : "npm run dev",
    url: "http://127.0.0.1:3019",
    reuseExistingServer: false,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
