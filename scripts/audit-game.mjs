import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const updateSwLock = process.argv.includes("--update-sw-lock");
const requiredAssets = [
  "public/manifest.webmanifest",
  "public/robots.txt",
  "public/sitemap.xml",
  "public/assets/images/lion-city-ink-bg.webp",
  "public/assets/images/world-cinematic-v3.webp",
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
if (imageBytes > 2_200_000) {
  fail(`Image budget exceeded: ${imageBytes} bytes`);
}
if (audioBytes > 120_000) {
  fail(`Audio budget exceeded: ${audioBytes} bytes`);
}

const manifest = JSON.parse(await readFile(join(root, "public/manifest.webmanifest"), "utf8"));
if (manifest.display !== "standalone" || !["/", "./"].includes(manifest.scope)) {
  fail("Manifest is missing standalone display or a valid scope.");
}

const robotsText = await readFile(join(root, "public/robots.txt"), "utf8");
if (!robotsText.includes("Allow: /LionCityWhispers/")) {
  fail("robots.txt must allow the GitHub Pages base path.");
}
if (!robotsText.includes("Sitemap: https://lunora-gather.github.io/LionCityWhispers/sitemap.xml")) {
  fail("robots.txt must point to the public sitemap URL.");
}

const sitemapText = await readFile(join(root, "public/sitemap.xml"), "utf8");
if (!sitemapText.includes("https://lunora-gather.github.io/LionCityWhispers/")) {
  fail("sitemap.xml must include the public game URL.");
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
for (const group of ["dependencies", "devDependencies"]) {
  for (const [name, version] of Object.entries(packageJson[group] ?? {})) {
    if (version === "latest" || version.startsWith("^") || version.startsWith("~")) {
      fail(`Direct dependency ${name} is not pinned: ${version}`);
    }
  }
}
if (packageJson.overrides?.postcss !== "8.5.23") {
  fail("postcss override must stay pinned to 8.5.23.");
}
if (packageJson.overrides?.sharp !== "0.35.3") {
  fail("sharp override must stay pinned to 0.35.3 (libvips CVE fixes).");
}

const swText = await readFile(join(root, "public/sw.js"), "utf8");
const swVersionMatch = swText.match(/lion-city-whispers-v(\d+)/);
if (!swVersionMatch) {
  fail("Service worker cache name must include a numeric version.");
}
for (const asset of requiredAssets) {
  const publicPath = `/${asset.replace(/^public\//, "")}`;
  if (!swText.includes(publicPath)) {
    fail(`Service worker cache list is missing ${publicPath}`);
  }
}

// Precached assets are served from CacheStorage until the version literal in
// sw.js changes, so shipping new asset bytes under an old version silently
// serves stale files to returning visitors. The lock file records which asset
// hash each version was published with; changing assets without bumping the
// version fails the audit.
const swVersion = `v${swVersionMatch[1]}`;
const precacheHash = createHash("sha256");
for (const asset of [...requiredAssets, "public/icon.svg"].sort()) {
  precacheHash.update(asset);
  if (/\.(webmanifest|txt|xml|svg)$/.test(asset)) {
    // Git converts text-file line endings per platform; normalize so the
    // hash matches between Windows checkouts and Linux CI.
    precacheHash.update((await readFile(join(root, asset), "utf8")).replaceAll("\r\n", "\n"));
  } else {
    precacheHash.update(await readFile(join(root, asset)));
  }
}
const assetsHash = precacheHash.digest("hex");
const swLockPath = join(root, "scripts/sw-cache.lock.json");
const swLock = JSON.parse(await readFile(swLockPath, "utf8").catch(() => "null"));
if (swLock && assetsHash !== swLock.assetsHash && swVersion === swLock.cacheVersion) {
  fail(
    `Precached assets changed but the service worker cache version is still ${swVersion}. ` +
      "Bump CACHE_NAME/RUNTIME_CACHE in public/sw.js, then run: node scripts/audit-game.mjs --update-sw-lock"
  );
}
if (updateSwLock) {
  await writeFile(swLockPath, `${JSON.stringify({ cacheVersion: swVersion, assetsHash }, null, 2)}\n`);
} else if (!swLock) {
  fail("Missing scripts/sw-cache.lock.json. Run: node scripts/audit-game.mjs --update-sw-lock");
} else if (assetsHash !== swLock.assetsHash || swVersion !== swLock.cacheVersion) {
  fail(
    "scripts/sw-cache.lock.json is stale. After bumping the service worker version, run: " +
      "node scripts/audit-game.mjs --update-sw-lock"
  );
}

const readmeText = await readFile(join(root, "README.md"), "utf8");
if (
  !readmeText.includes("立即进入网页版游戏") ||
  !readmeText.includes("https://lunora-gather.github.io/LionCityWhispers/")
) {
  fail("README must keep a direct GitHub Pages play link near the top.");
}
if (readmeText.includes("file" + "://")) {
  fail("README must not contain local file protocol links.");
}
if (!readmeText.includes("Node.js 24") || !readmeText.includes("项目结构")) {
  fail("README must document the runtime and project structure.");
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
