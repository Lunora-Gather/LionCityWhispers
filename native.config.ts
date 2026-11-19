import { defineConfig } from "@playwright/test";

const port = Number(process.env.LCW_SAFARI_PORT || 4321);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid LCW_SAFARI_PORT");
const upstream = `http://127.0.0.1:${port}`;
process.env.LCW_SAFARI_UPSTREAM = upstream;
export default defineConfig({
  testDir: "./native-tests",
  timeout: 150_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  use: {viewport: {width: 1280, height: 800}},
  webServer: {
    command: `next start -H 127.0.0.1 -p ${port}`,
    url: upstream,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [{name: "native-safari"}]
});
