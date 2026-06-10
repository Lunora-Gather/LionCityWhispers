# 狮城秘语 / Lion City Whispers

**1.0.0 release** · A playable browser game about restoring Lion City legends through puzzles, rhythm, and museum curation.

[立即进入网页版游戏](https://wangjiehu.github.io/LionCityWhispers/) · [Play on GitHub Pages](https://wangjiehu.github.io/LionCityWhispers/) · [Repository](https://github.com/wangjiehu/LionCityWhispers)

![Lion City Whispers world scene](public/assets/images/world-cinematic-v3.webp)

## What You Play

《狮城秘语》是一款可直接在浏览器中游玩的叙事解谜游戏。玩家在河岸、灵界入口和博物馆展厅之间修复文物线索，完成仪式，再把传说整理成一条可被游客读懂的展线。

The 1.0.0 build is designed as a complete public web release: no install is required, the game runs from GitHub Pages, and the repository keeps only source, assets, tests, and deployment configuration.

## Release Highlights

- Exploration scene with curator dialogue and persistent current-objective guidance.
- Three artifact puzzles: stone shard restoration, rune ordering, and harbor seal unlocking.
- Four-lane rhythm ritual with relaxed and standard tempo modes.
- Museum curation finale with artifact placement, visitor score, and completion state.
- Chinese and English UI, codex entries, objectives, scene names, and puzzle copy.
- Keyboard, mouse, and touch support, including remappable movement and rhythm keys.
- Saved progress, settings persistence, reset flow, PWA metadata, and offline cache fallback.
- Automated regression coverage for full flow, mobile layout, PWA cache, persistence, i18n, visual health, and input locking.

## Play

Open the public page:

```text
https://wangjiehu.github.io/LionCityWhispers/
```

The game starts at the riverbank. Follow the highlighted route and the in-world target marker to restore artifacts and open the final museum exhibition.

## Local Development

```powershell
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:3000
```

Development mode does not register the Service Worker by default, which avoids stale Next.js chunks during iteration. To test the local PWA path, open:

```text
http://127.0.0.1:3000/?pwa=1
```

## Quality Gate

Run the full local gate before changing a release:

```powershell
npm run check
```

This runs:

- `next build`
- Playwright regression tests
- local game asset and release-surface audit
- `npm audit --audit-level=moderate`

For the GitHub Pages export path:

```powershell
$env:GITHUB_PAGES="1"
$env:GITHUB_PAGES_REPO="LionCityWhispers"
npm run build:pages
```

## Deployment

GitHub Pages is deployed by `.github/workflows/pages.yml` on every push to `main`.

The workflow installs dependencies with `npm ci`, builds the static site with the repository subpath, preserves `_next` assets with `.nojekyll`, and uploads the `out` directory to Pages.

## Release And Rollback

The stable public release is tagged as `v1.0.0`.

If a future deployment breaks the public page, roll back by restoring the last known stable commit or by moving `main` back to the `v1.0.0` tag and re-running the Pages workflow.

## Assets And Rights

Game code, artwork, generated audio, and release configuration are kept in this repository for this project release. No third-party analytics, accounts, payment flow, or private user-data collection is required to play the public web build.

Unless a separate license is added later, reuse of the game assets or source outside this project should be treated as not granted by default.

## Project Structure

```text
src/                  React shell, Phaser scenes, state, i18n, and game logic
public/assets/        WebP artwork and generated WAV sound effects
public/sw.js          Offline cache and update support
tests/                Playwright regression and visual health coverage
scripts/              Asset and release-surface audit scripts
.github/workflows/    GitHub Pages deployment
```
