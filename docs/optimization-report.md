# Optimization Report

This pass focuses on changes that improve production resilience without changing the core game flow.

## Scope

- Added a dedicated CI workflow for pull requests and main-branch validation.
- Strengthened the GitHub Pages deployment workflow with type checking and asset auditing before export.
- Made Playwright defaults safer for CI by blocking `.only`, enabling retries, and retaining failure artifacts.
- Added explicit `typecheck` and CI test scripts to make local and GitHub Actions quality gates consistent.
- Hardened Next.js production configuration by disabling the powered-by header, keeping compression enabled, and avoiding production browser source maps.
- Improved Service Worker cache handling so installs tolerate individual asset failures, old game caches are pruned safely, and runtime assets refresh in the background.
- Hardened saved-game and settings sanitation so malformed localStorage data or custom events cannot poison runtime settings.
- Normalized the public asset base path to avoid accidental double slashes when a base path is supplied.

## Validation Path

Run the full local gate before merging:

```bash
npm run check
```

For CI parity:

```bash
npm run typecheck
npm run build
npm run test:ci
npm run audit:game
npm run audit:security
```

## Notes

No gameplay route, puzzle rule, artifact copy, or visual asset was intentionally changed in this pass. The changes are aimed at stability, deployment confidence, cache freshness, and safer persistence.
