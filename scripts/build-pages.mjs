// Cross-platform wrapper so `npm run build:pages` always exercises the
// GitHub Pages static-export config (output: "export" + basePath), no matter
// which shell or CI environment invokes it.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const nextBin = join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

const result = spawnSync(nextBin, ["build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, GITHUB_PAGES: "1" }
});

if (result.error) {
  process.stderr.write(`${result.error}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
