# midgarcorp.cc

The website of Midgar Oy: a page for every app, the Linux and open source catalogs, privacy policies and terms, the blog, and [/open](https://midgarcorp.cc/open), the public usage numbers. Astro, static, on Cloudflare Pages.

Most of it is generated from data rather than written by hand. App pages combine `src/data/landing/<slug>.json` (copy) with facts from the App Store, `/linux` and `/opensource` are built from GitHub releases and repos, and `/open` reads `https://api.midgarcorp.cc/v1/ops/public/stats` at build time. Every fetch fails soft and keeps the committed file.

## Run it

Node 20 and Go (for `ct`, the build helper):

```
make build && npm ci
npm run dev        # http://localhost:4321
npm run build      # ct prebuild, astro build, ct postbuild (Pagefind)
npx vitest run
npx prettier --check "src/**/*.{js,ts,astro,css}"
```

`./ct help` lists the helper's commands: `fetch-appstore`, `fetch-github`, `audit-store` (fails when the landing facts drift from the live App Store), `prebuild` and `postbuild`.

## Layout

```
src/pages/          routes: [app].astro landing pages, apps, linux, opensource, open, legal, blog
src/content/        blog posts (MDX) and each app's legal/<slug>/privacy.html and terms.html
src/data/           landing copy, generated JSON the pages read
src/components/     Astro components; landing/ and open/ for those pages
scripts/            data fetchers and OG image generators
cmd/ internal/      ct, in Go
tests/unit/         Vitest
```

## Deploy

`.github/workflows/test.yml` checks, builds and deploys to Cloudflare Pages on every push to master and once a day, so new releases and stats appear without a commit. The site is developed in Midgar's monorepo, and every night the monorepo's changes are published to this repository.
