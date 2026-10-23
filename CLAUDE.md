# midgarcorp.cc

Astro static site (blog, app landing pages, /apps, /linux, /opensource, /blackwall) on Cloudflare Pages. A Go CLI (`ct`) runs pre-build and post-build tasks. It deploys on every push to its mirror and daily.

## Layout
- `src/content/blog/` MDX posts; schemas in `src/content/config.ts` (required `title`, `description`, `pubDate`; optional `updatedDate`, `image`, `tags`, `draft`, `series`).
- `src/pages/` (`[app].astro` landing pages, `linux.astro`, standalone `<slug>.astro` product pages), `src/components/` (+ `landing/`), `src/lib/`, `src/utils/`, `src/data/`.
- `scripts/` generators, `internal/` Go code for `ct` (`internal/github/fetch.go`, `internal/appstore/fetch.go`), `cmd/`, `tests/unit/` (aliases `@utils`, `@components`), `public/`, `.github/workflows/`.

## Commands
- `make build` builds `ct` (required for the build); `./ct help`.
- `npm run dev` (http://localhost:4321, no Pagefind index), `npm run build` (includes Pagefind), `npm run preview`.
- `npm test`, `npm run test:run` (CI mode), `npm run test:ui`.
- `npx prettier --check "src/**/*.{js,ts,astro,css}"`; fix with `--write`.
- Before any push that deploys, run prettier check, `npm test`, `npm run build`. CI enforces all three and fails the deploy otherwise.

## Deploy and data freshness
- `.github/workflows/test.yml` deploys to Cloudflare Pages on push to master AND on a daily cron (plus `workflow_dispatch`), so new repos and apps appear without a commit. The same workflow runs `ct audit-store` daily.
- `src/data/opensource.json`: `ct fetch-github` (needs `GITHUB_TOKEN`, else the file is kept). Refresh locally with `GITHUB_TOKEN=$(gh auth token) ./ct fetch-github`; the committed copy goes stale.
- `src/data/apps.json`: `ct fetch-appstore` every build. Taglines, colors and features come from `appEnhancements` in `internal/appstore/fetch.go`, keyed by track ID; add an entry when shipping a new app. `Platforms` override is used for `solar-beam`.
- `src/data/landing-live.json`: `ct fetch-appstore` too, from the per-app iTunes lookup; `src/data/landing.ts` overlays it onto `landing-facts.json`.
- `ct audit-store` fails on structural drift (platform class, category, price) between `landing-facts.json` and the live App Store.
- `src/data/github-activity.json`: `scripts/fetch-github-activity.mjs` (in `ct prebuild`); live route `src/pages/api/activity.json.ts` uses the Pages `GITHUB_TOKEN` secret. No commit messages, branches or diff sizes on the board. Heatmap classes `.act-c0` to `.act-c4` stay outside `@layer` in `global.css`.
- Other prebuild-generated data: `app-work.json` (`scripts/fetch-app-work.mjs`, add a new app's repo to `APP_REPOS`), `webb-live.json`, `blackwall.json`, `screenshot-variants.json`, `duo-combos.json` (generated manifest). Fetchers fail soft and keep the committed file.
- `linux-apps.json`: `node scripts/fetch-linux-releases.mjs` (uses `gh`); `.github/workflows/refresh-linux-apps.yml` runs weekly and opens a reviewable PR. `.github/workflows/refresh-store-assets.yml` (weekly, dormant until repo secrets `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` are set) opens a PR with the screenshot diff. Both need the repo setting Allow GitHub Actions to create and approve pull requests.
- Pages compute featured selections from data. Never hardcode project lists.

## Rules that break things
- `scripts/fetch-store-assets.py` needs `source ~/.config/midgar/credentials.env` when run locally.
- `public/_redirects`: the `/cli-tools` rule stays above the `/* /index.html 200` catch-all, and the file ends in a newline.
- Canonical URLs use a trailing slash; internal links must match or every click 308s.
- Free apps with IAP must set `pricing` in their landing copy JSON (the store price chip only knows the download price).
- Never label Solar Beam's `webb-live` sunshield temperatures as live (frozen commissioning readings).
- `DuoCombo` copy says only what the picture shows (both displays), never "optimised for iPhone Duo". After regenerating combos with `compose_combo.py`, bump `DUO_REV` in `duo.ts`.
- `generate-linux-og.js` and `generate-page-og.js` repeat `workScore` without the recency term; keep them in step with `src/lib/work.ts`.
- Safari color-scheme triad stays in sync: `html`/`html.dark` background in `global.css`, `theme-color` metas in `BaseHead.astro`, the inline pre-paint theme script.
- `<body>` carries no background (MatrixRain canvas colour lives on `html`).
- Cloudflare adapter refuses `node:fs` in bundled code, so components read manifests, not the filesystem. `tests/unit/screenshot-variants.test.ts`, `duo-combos.test.ts` and `linux-data.test.ts` guard those manifests and files.
- `/cli-tools` is retired. Standalone product pages stay out of the nav; set the repo's GitHub homepage to the page.

## Legal pages and deploys
- Each app's policy is `src/content/legal/<slug>/privacy.html` (and `terms.html`), served at `midgarcorp.cc/legal/<slug>/privacy/`. The page must say what the shipped app does: a promise that only a future release keeps (a deletion that release adds) waits on a branch until that release ships, as `wt/helia-policy` and `wt/payday-policy` do.
- `tests/unit/legal-pages.test.ts` reads the built `dist/`: run `npx astro build` before `npx vitest run`.
- The site deploys from its mirror on every push and daily. Inside the monorepo the nightly job publishes the mirror at 04:30, so a change goes live that night; `midgar sync midgarcorp --push` publishes it now.

## Conventions
- Rank everything with `workScore` in `src/lib/work.ts`; commits and releases decide the order, stars barely count.
- New app landing page: add to `APPS` in `scripts/fetch-store-assets.py` and run it; author `src/data/landing/<slug>.json` (schema in `src/data/landing.ts`, or `scripts/content-workflow.js`); run `node scripts/generate-app-og.js <slug>`. The route appears once facts and copy exist.
- New Linux tool: no page edit; use `FORCE_INCLUDE`, `EXCLUDE`, `OVERRIDES`, `SCOPES`, `THEMES` in `scripts/fetch-linux-releases.mjs` only for exceptions; add a `LINUX_SHOWCASE` screenshot to upgrade its tier.
- Layout: use `.shell`, `.flow`, `CardGrid.astro` with container queries, never viewport breakpoints inside cards.
- Design: token classes (`term.*`, `paper.*`) only, never raw `blue-*` or `gray-*`.
- Search: `BaseLayout` `searchable={false}` keeps a page out of Pagefind.
- Progressive enhancement: features work without JavaScript.
- Tests cover pure functions in `tests/unit/`.

## More in docs/agent-notes.md
Common Commands; Content Management; Core Features (search, bionic reading); Build Process; Data Freshness (GitHub activity board detail, curation rules); App Landing Pages (facts and copy split, icon unmasking, responsive variants, iPhone Duo picture, Solar Beam panel); Ranking by Work (/opensource, /apps, homepage tiers); Linux Apps Page (auto-discovery, install channels, ranking tiers, ship log, screenshots); Standalone Product Pages (/blackwall data-driven page); Layout System; Design System (PHOSPHOR tokens); Testing Strategy; Key Patterns; Pre-deployment Checklist.
