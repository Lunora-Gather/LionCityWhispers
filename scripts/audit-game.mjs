import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const requiredAssets = [
  "public/assets/images/lion-city-ink-bg.webp",
  "public/assets/images/world-cinematic.webp",
  "public/assets/images/museum-gallery.webp",
  "public/assets/images/artifact-sheet.webp",
  "public/assets/images/curator-lin.webp",
  "public/assets/audio/ui-click.wav",
  "public/assets/audio/snap.wav",
  "public/assets/audio/success.wav",
  "public/assets/audio/miss.wav",
  "public/assets/audio/ritual-perfect.wav",
  "public/assets/audio/ritual-good.wav",
  "public/icon-192.png",
  "public/icon-512.png"
];

const sourceRoots = ["src", "tests", "scripts"];
const blockedPatterns = [
  "TO" + "DO",
  "FIX" + "ME",
  "@ts-" + "ignore",
  "eslint-" + "disable",
  "console\\." + "error"
].map((pattern) => new RegExp(pattern));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") {
        continue;
      }
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

function fail(message) {
  throw new Error(message);
}

let imageBytes = 0;
let audioBytes = 0;
for (const asset of requiredAssets) {
  const info = await stat(join(root, asset)).catch(() => null);
  if (!info) {
    fail(`Missing required asset: ${asset}`);
  }
  if (asset.endsWith(".webp")) {
    imageBytes += info.size;
  }
  if (asset.endsWith(".png")) {
    imageBytes += info.size;
  }
  if (asset.endsWith(".wav")) {
    audioBytes += info.size;
  }
}
if (imageBytes > 1_600_000) {
  fail(`Image budget exceeded: ${imageBytes} bytes`);
}
if (audioBytes > 120_000) {
  fail(`Audio budget exceeded: ${audioBytes} bytes`);
}

const manifest = JSON.parse(await readFile(join(root, "public/manifest.webmanifest"), "utf8"));
if (manifest.display !== "standalone" || !["/", "./"].includes(manifest.scope)) {
  fail("Manifest is missing standalone display or a valid scope.");
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
for (const group of ["dependencies", "devDependencies"]) {
  for (const [name, version] of Object.entries(packageJson[group] ?? {})) {
    if (version === "latest" || version.startsWith("^") || version.startsWith("~")) {
      fail(`Direct dependency ${name} is not pinned: ${version}`);
    }
  }
}
if (packageJson.overrides?.postcss !== "8.5.10") {
  fail("postcss override must stay pinned to 8.5.10.");
}

const swText = await readFile(join(root, "public/sw.js"), "utf8");
if (!/lion-city-whispers-v\d+/.test(swText)) {
  fail("Service worker cache name must include a numeric version.");
}
for (const asset of requiredAssets) {
  const publicPath = `/${asset.replace(/^public\//, "").replaceAll("\\", "/")}`;
  if (!swText.includes(publicPath)) {
    fail(`Service worker cache list is missing ${publicPath}`);
  }
}

for (const sourceRoot of sourceRoots) {
  for (const file of await walk(join(root, sourceRoot))) {
    if (file.endsWith("audit-game.mjs")) {
      continue;
    }
    if (!/\.(tsx?|mjs|json|css)$/.test(file)) {
      continue;
    }
    const content = await readFile(file, "utf8");
    for (const pattern of blockedPatterns) {
      if (pattern.test(content)) {
        fail(`Blocked pattern ${pattern} found in ${file}`);
      }
    }
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      imageBytes,
      audioBytes,
      checkedAssets: requiredAssets.length
    },
    null,
    2
  )
);
