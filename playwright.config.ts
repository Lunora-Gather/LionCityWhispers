import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const testPort = Number(process.env.PLAYWRIGHT_PORT || 4319);
const baseURL = `http://127.0.0.1:${testPort}`;
const isCi = Boolean(process.env.CI);
// `.next` also exists after `next dev`; only BUILD_ID proves a production build.
const hasBuild = existsSync(join(process.cwd(), ".next", "BUILD_ID"));

const useSafari = process.platform === "darwin" && !process.env.CI;

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
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: `next ${isCi || hasBuild ? "start" : "dev"} -H 127.0.0.1 -p ${testPort}`,
    url: baseURL,
    reuseExistingServer: !isCi,
    timeout: 120000
  },
  projects: [
    {
      name: useSafari ? "webkit" : "chromium",
      use: { ...devices[useSafari ? "Desktop Safari" : "Desktop Chrome"] }
    }
  ]
});
