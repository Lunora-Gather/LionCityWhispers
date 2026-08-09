import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const isCi = Boolean(process.env.CI);
// `.next` also exists after `next dev`; only BUILD_ID proves a production build.
const hasBuild = existsSync(join(process.cwd(), ".next", "BUILD_ID"));

export default defineConfig({
  testDir: "./tests",
  timeout: 150000,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  fullyParallel: true,
  // Each test boots a WebGL Phaser instance; more concurrent browsers than
  // this starve the GPU/audio device and produce timeout flakes. CI runners
  // have only 2 cores, so cap lower there.
  workers: isCi ? 2 : 4,
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
    reuseExistingServer: !isCi,
    timeout: 120000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
