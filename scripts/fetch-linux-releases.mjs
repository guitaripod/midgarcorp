#!/usr/bin/env node

/**
 * Regenerate src/data/linux-apps.json — the self-contained data file for the
 * /linux page. It AUTO-DISCOVERS which apps belong on the page so new tools
 * appear without hand-editing a list.
 *
 * Discovery: start from the already-curated src/data/opensource.json (which
 * applies the site's release/stars/commits threshold, excludeRepos, and category
 * overrides) and keep the Rust/Go/C++ projects that ship releases and aren't SDKs
 * or web apps. Everything else — form-factor, install channel, latest version,
 * dates, binary links — is derived or pulled live from GitHub / crates.io / AUR.
 *
 * Maintenance is now exception-only:
 *   FORCE_INCLUDE — repos the rule can't see (e.g. flaccy is an iOS-primary repo
 *                   that also ships a Linux desktop app; a brand-new repo not yet
 *                   in opensource.json).
 *   EXCLUDE       — a false positive the rule let through (backend/library/etc).
 *   OVERRIDES     — correct a wrong auto-derived field for one repo.
 *   SCOPES        — for a repo that also ships iOS/macOS/browser code, the paths and
 *                   release tags that belong to the Linux build, so its commit and
 *                   release counts measure the Linux work and not the whole repo.
 *   THEMES        — move an app to another page group than the one derived.
 * The weekly refresh workflow regenerates opensource.json first, so newly-shipped
 * Rust/Go/C++ tools are discovered automatically and land in a reviewable PR.
 *
 * Run:  node scripts/fetch-linux-releases.mjs   (uses your `gh` auth, no secrets)
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OWNER = 'guitaripod';
const CRATES_UA = 'midgarcorp-linux-page (guitaripod@gmail.com)';

// ---------------------------------------------------------------------------
// Curation config — the ONLY things that ever need a human. Everything else is
// discovered from opensource.json and derived below.
// ---------------------------------------------------------------------------

/** Repos to force onto the page that the auto-rule can't discover on its own. */
const FORCE_INCLUDE = [
  'tailscode',
  'flaccy',
  'unrager',
  'claude-bridge',
  'omp-bridge',
  'mbench',
  'delegate',
  'tokenmaxxing',
  'recview',
  'emojipick',
  'remoteplay-display',
  'imago',
  'tonight',
];

/** False positives to drop (a backend/library the rule let through). */
const EXCLUDE = new Set([]);

/** Per-repo corrections when an auto-derived field is wrong. */
const OVERRIDES = {
  flaccy: {
    lang: 'rust',
    form: 'gui',
    crate: 'flaccy',
    note: 'GTK4 / libadwaita',
    // GitHub homepage points at the iOS App Store landing page; on the Linux
    // card, link to the repo (the Linux app) instead.
    homepageUrl: null,
    description:
      'A lossless music player with gapless playback and Last.fm scrobbling — a native GTK4/libadwaita desktop app.',
  },
  tailscode: {
    lang: 'swift',
    form: 'gui',
    note: 'GTK 4.12+ / libadwaita 1.4+',
    description:
      'Your AI agents, anywhere: a native GTK4 client for Claude Code, Oh My Pi and opencode running on your own machines, over your own tailnet.',
    linuxAssetMatchesTag: true,
    versionFromAsset: true,
    source: {
      label: 'from source',
      command:
        'git clone https://github.com/guitaripod/Tailscode && cd Tailscode && TAILSCODE_KIT_REMOTE=1 scripts/package-linux.sh build',
    },
  },
  tokenmaxxing: {
    lang: 'rust',
    form: 'gui',
    note: 'KDE Plasma 6 / GTK4',
    description:
      'Usage dashboards for your LLM subscriptions: live quota, local history and a value-for-money readout, as a KDE tray app.',
    source: {
      label: 'from source',
      command:
        'git clone https://github.com/guitaripod/tokenmaxxing && cd tokenmaxxing/tokenmaxxing-kde && bash resources/install.sh',
    },
  },
  'claude-bridge': {
    lang: 'swift',
    form: 'daemon',
    description:
      'Runs Claude Code headlessly and serves it as structured HTTP sessions with streaming, subagents, spend and git, as a systemd user service.',
    install: [
      {
        channel: 'script',
        label: 'install script',
        command:
          'curl -fsSL https://raw.githubusercontent.com/guitaripod/claude-bridge/master/install.sh | bash',
      },
    ],
  },
  'omp-bridge': {
    lang: 'swift',
    form: 'daemon',
    description:
      'Puts an Oh My Pi coding agent on your tailnet: the claude-bridge wire protocol over HTTP and SSE, as a systemd user service.',
    install: [
      {
        channel: 'script',
        label: 'install script',
        command:
          'curl -fsSL https://raw.githubusercontent.com/guitaripod/omp-bridge/master/install.sh | bash',
      },
    ],
  },
  mbench: {
    lang: 'python',
    form: 'cli',
    description:
      'Ranks the models your own GPU runs: speed and answer quality for everything llama-swap serves, built into one leaderboard page.',
    install: [
      {
        channel: 'uv',
        label: 'uv',
        command: 'uv tool install git+https://github.com/guitaripod/mbench',
      },
    ],
  },
  'remoteplay-display': {
    lang: 'python',
    form: 'daemon',
    note: 'KDE Plasma 6 / Wayland',
    install: [
      {
        channel: 'script',
        label: 'install script',
        command:
          'git clone https://github.com/guitaripod/remoteplay-display && cd remoteplay-display && ./install.sh',
      },
    ],
  },
  tonight: {
    form: 'daemon',
    description:
      'A decision engine for your Steam library: three questions, three cards, one game. Single binary, no account.',
    install: [
      {
        channel: 'script',
        label: 'install script',
        command:
          'curl -fsSL https://github.com/guitaripod/tonight/releases/latest/download/install.sh | sh',
      },
    ],
  },
  // Tagged `tui` on GitHub but runs as a one-shot CLI (`image-collage a.png …`).
  'image-collage': { form: 'cli' },
  // GitHub's blurb dropped "terminal client" and the form heuristic then reads it as a plain CLI;
  // `unrager` with no arguments opens the TUI, the subcommands are the CLI.
  unrager: {
    form: 'tui',
    description:
      'Takes the rage out of your x.com timeline with a model on your own computer: a terminal client, a CLI and a browser extension.',
  },
  // The wayland/kde topics belong to the rec capture script; the review window
  // itself is a plain GTK4 app that runs on any desktop.
  recview: { note: 'GTK4 / libadwaita' },
};

/**
 * Repos that also ship Apple or browser code: only the Linux paths' commits and the
 * Linux releases' tags count, so the totals describe the Linux work.
 */
const SCOPES = {
  tailscode: { paths: ['TailscodeLinux', 'packaging'] },
  flaccy: { paths: ['linux'], tag: /^linux-v/ },
  unrager: { paths: ['src', 'crates'] },
  tokenmaxxing: { paths: ['tokenmaxxing-kde'] },
};

/** Page group for an app whose derived group is wrong. */
const THEMES = {
  delegate: 'agents',
  mbench: 'agents',
  'omp-bridge': 'agents',
  tonight: 'tools',
};

// ---------------------------------------------------------------------------
// Discovery rule
// ---------------------------------------------------------------------------

const LANG_OF = { Rust: 'rust', Go: 'go', 'C++': 'cpp' };
const LANG_LABELS = { rust: 'Rust', go: 'Go', cpp: 'C++', swift: 'Swift', python: 'Python' };
/** opensource.json categories that are libraries, not runnable apps. */
const SDK_CATEGORIES = new Set(['SDKs & Libraries', 'Swift Packages']);
/** Deployed-web-app homepages (a Worker/Pages/Vercel/Netlify app isn't a Linux app). */
const WEB_HOST_RE = /(\.workers\.dev|\.pages\.dev|\.vercel\.app|\.netlify\.app)(\/|$)/i;

const isWebApp = (url) => !!url && WEB_HOST_RE.test(url);
const groupFor = (form) => (form === 'gui' || form === 'daemon' ? 'desktop' : 'bin');

/** Auto-classify a repo's form-factor from its description and topics. */
function deriveForm(description, topics) {
  const t = new Set((topics ?? []).map((x) => x.toLowerCase()));
  const d = (description ?? '').toLowerCase();
  if (/\b(daemon|systemd)\b/.test(d) || t.has('daemon')) return 'daemon';
  const guiTopic = [
    'gtk',
    'gtk3',
    'gtk4',
    'kde',
    'plasma',
    'qt',
    'libadwaita',
    'egui',
    'iced',
    'tauri',
    'slint',
    'gnome',
  ].some((x) => t.has(x));
  if (guiTopic || /\bgtk[34]?\b|\bgui\b|desktop app|libadwaita|system tray|\btray\b/.test(d))
    return 'gui';
  if (/\btui\b|terminal ui|ratatui/.test(d) || t.has('tui')) return 'tui';
  return 'cli';
}

/** Auto-derive the runtime caveat note from description and topics. */
function deriveNote(description, topics) {
  const t = new Set((topics ?? []).map((x) => x.toLowerCase()));
  const d = (description ?? '').toLowerCase();
  if (['kde', 'plasma', 'wayland'].some((x) => t.has(x)) || /\bkde\b|plasma|wayland/.test(d))
    return 'KDE Plasma / Wayland';
  if (t.has('gtk4') || t.has('gtk') || /\bgtk[34]?\b|libadwaita/.test(d)) return 'Requires GTK4';
  return null;
}

const AI_RE = /\b(llms?|claude|gpt|opencode|oh my pi|local model|model on your)\b/i;
const SYSTEM_RE = /\b(kde|kwin|plasma|wayland|steam|emulat\w*|dummy|systemd)\b/i;

/// Page group: desktop apps, local-AI and agent tooling, system utilities, or plain command-line tools.
function deriveTheme(form, description) {
  if (form === 'gui') return 'desktop';
  if (AI_RE.test(description ?? '')) return 'agents';
  if (form === 'daemon' || SYSTEM_RE.test(description ?? '')) return 'system';
  return 'tools';
}

// ---------------------------------------------------------------------------
// Version + homepage helpers
// ---------------------------------------------------------------------------

const registryHosts = ['crates.io', 'www.npmjs.com', 'pypi.org', 'pkg.go.dev'];
const LINUX_ASSET = /(linux|\.appimage$|\.deb$|\.rpm$|\.flatpak$)/i;
const X64_ASSET = /(x86_64|amd64)/i;
// Checksums/signatures sit next to the binaries and match LINUX_ASSET on name alone.
const CHECKSUM_ASSET = /\.(sha\d*|md5|asc|sig|minisig|pem|txt)$/i;

function cleanHomepage(url) {
  if (!url) return null;
  try {
    return registryHosts.includes(new URL(url).hostname) ? null : url;
  } catch {
    return null;
  }
}

function semver(tag) {
  const match = String(tag ?? '').match(/\d+\.\d+\.\d+(?:[-.][\w.]+)?/);
  return match ? match[0] : (tag ?? '').replace(/^v/, '') || null;
}

/// First dotted number in a tag or file name, so a two-part release like `v1.77` still compares.
function looseVersion(text) {
  return String(text ?? '').match(/\d+(?:\.\d+)+/)?.[0] ?? null;
}

function versionKey(v) {
  const m = String(v ?? '').match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3]) : null;
}

/** Newest version string among the channels, compared numerically. */
function maxVersion(...versions) {
  let best = null;
  let bestKey = -1;
  for (const v of versions) {
    if (!v) continue;
    const key = versionKey(v);
    if (key === null) continue;
    if (key > bestKey) {
      bestKey = key;
      best = v;
    }
  }
  return best ?? versions.find(Boolean) ?? null;
}

// ---------------------------------------------------------------------------
// Live data sources (GitHub via gh CLI, crates.io, AUR)
// ---------------------------------------------------------------------------

async function gh(args) {
  const { stdout } = await execFileAsync('gh', args, { maxBuffer: 1024 * 1024 * 16 });
  return stdout;
}

async function repoMeta(repo) {
  const out = await gh([
    'api',
    `repos/${OWNER}/${repo}`,
    '--jq',
    '{name, description, language, stars: .stargazers_count, url: .html_url, homepage: .homepage, topics: .topics}',
  ]);
  const d = JSON.parse(out);
  return {
    name: d.name,
    description: d.description ?? '',
    language: d.language ?? 'Unknown',
    stars: d.stars ?? 0,
    githubUrl: d.url,
    homepageUrl: cleanHomepage(d.homepage),
    topics: d.topics ?? [],
  };
}

/// Every non-draft release of a repo, oldest first, with the assets the page links to.
async function releaseList(repo) {
  try {
    const out = await gh([
      'api',
      `repos/${OWNER}/${repo}/releases?per_page=100`,
      '--jq',
      '[.[] | select(.draft | not) | {tag: .tag_name, date: .published_at, url: .html_url, prerelease, assets: [.assets[] | {name, url: .browser_download_url}]}] | sort_by(.date)',
    ]);
    return JSON.parse(out);
  } catch {
    return [];
  }
}

/// The release the card advertises: the newest stable one, or with `matchTag` the newest whose
/// Linux tarball carries the release's own version, since a release can be an iOS or Mac build
/// that merely inherits the previous Linux tarball.
function pickLatestRelease(releases, matchTag) {
  const stable = releases.filter((r) => !r.prerelease);
  const pool = stable.length > 0 ? stable : releases;
  const candidates = matchTag
    ? pool.filter((r) =>
        r.assets.some(
          (a) =>
            LINUX_ASSET.test(a.name) &&
            !CHECKSUM_ASSET.test(a.name) &&
            looseVersion(a.name) === looseVersion(r.tag)
        )
      )
    : pool;
  return candidates.at(-1) ?? null;
}

/// Commits on the default branch: the last page number of a one-commit-per-page listing.
async function totalCommits(repo) {
  try {
    const out = await gh(['api', '-i', `repos/${OWNER}/${repo}/commits?per_page=1`]);
    const last = out.match(/[?&]page=(\d+)>; rel="last"/);
    return last ? Number(last[1]) : 1;
  } catch {
    return 0;
  }
}

/// Distinct commits touching any of `paths`, so a monorepo's Linux client is not credited
/// with the iOS app's history.
async function pathCommits(repo, paths) {
  const shas = new Set();
  for (const p of paths) {
    try {
      const out = await gh([
        'api',
        '--paginate',
        `repos/${OWNER}/${repo}/commits?path=${encodeURIComponent(p)}&per_page=100`,
        '--jq',
        '.[].sha',
      ]);
      out
        .split('\n')
        .filter(Boolean)
        .forEach((sha) => shas.add(sha));
    } catch {
      continue;
    }
  }
  return shas.size;
}

/**
 * Discover every `guitaripod/homebrew-*` tap and the formulas it ships, returning
 * a map of formula name -> full `brew install <tap>/<formula>` command. Homebrew
 * formulas track the real release version, unlike the (post-rename, often stale)
 * Go module paths, so they are the preferred channel for the Go tools.
 */
async function discoverBrewFormulas(ids) {
  const byFormula = new Map();
  let taps = [];
  try {
    const out = await gh([
      'repo',
      'list',
      OWNER,
      '--limit',
      '200',
      '--json',
      'name',
      '--jq',
      '.[].name',
    ]);
    taps = out.split('\n').filter((n) => n.startsWith('homebrew-'));
  } catch {
    /* fall back to id-derived tap names below */
  }
  // `gh repo list` omits archived taps (e.g. homebrew-apod-cli), so also probe
  // the conventional per-app tap name directly.
  taps = [...new Set([...taps, ...ids.map((id) => `homebrew-${id}`)])];

  for (const repo of taps) {
    const tapName = repo.replace(/^homebrew-/, '');
    for (const dir of ['Formula', '']) {
      try {
        const apiPath = dir
          ? `repos/${OWNER}/${repo}/contents/${dir}`
          : `repos/${OWNER}/${repo}/contents`;
        const out = await gh(['api', apiPath, '--jq', '.[].name']);
        const formulas = out.split('\n').filter((n) => n.endsWith('.rb'));
        if (formulas.length === 0) continue;
        for (const f of formulas) {
          const formula = f.replace(/\.rb$/, '');
          if (!byFormula.has(formula)) {
            byFormula.set(formula, `brew install ${OWNER}/${tapName}/${formula}`);
          }
        }
        break;
      } catch {
        /* try next dir */
      }
    }
  }
  return byFormula;
}

/** crates.io logins that count as "ours" (current + pre-rename handle). */
const OWNER_LOGINS = new Set(['guitaripod', 'marcusziade']);

/**
 * Resolve a crate to { version, owned }. `owned` is true only when the crate is
 * actually published by us — crate names are a global namespace, so e.g.
 * `circadia` is taken by an unrelated third party and must NOT be advertised as
 * an install path for our daemon of the same name.
 */
async function crateInfo(name) {
  try {
    const res = await fetch(`https://crates.io/api/v1/crates/${name}`, {
      headers: { 'User-Agent': CRATES_UA },
    });
    if (!res.ok) return null;
    const version = (await res.json())?.crate?.newest_version ?? null;
    if (!version) return null;

    const ownersRes = await fetch(`https://crates.io/api/v1/crates/${name}/owners`, {
      headers: { 'User-Agent': CRATES_UA },
    });
    const owners = ownersRes.ok ? ((await ownersRes.json())?.users ?? []) : [];
    const owned = owners.some((o) => OWNER_LOGINS.has(o.login));
    return { version, owned };
  } catch {
    return null;
  }
}

/** Find the crate we publish for a repo, trying the id and common suffixes. */
async function resolveCrate(id, override) {
  const candidates = override ? [override] : [id, `${id}-cli`, `${id}-rs`];
  for (const candidate of candidates) {
    const info = await crateInfo(candidate);
    if (info?.owned) return { crate: candidate, version: info.version };
  }
  return null;
}

/** Map of AUR package name -> version for every package the owner maintains. */
async function aurPackages() {
  try {
    const res = await fetch(`https://aur.archlinux.org/rpc/v5/search/${OWNER}?by=maintainer`);
    if (!res.ok) return new Map();
    const data = await res.json();
    // AUR versions are `pkgver-pkgrel`; drop the trailing pkgrel (pkgver has no `-`).
    return new Map(
      (data.results ?? []).map((r) => [r.Name, semver(String(r.Version).replace(/-\d+$/, ''))])
    );
  } catch {
    return new Map();
  }
}

/**
 * Build the ordered install channels for an app, cleanest-and-correct first.
 * Priority: crates.io -> Homebrew -> AUR -> from source. Prebuilt binaries live
 * as a separate "download" link to the releases page (the user picks their arch),
 * not as a copy-paste command. `go install` is intentionally omitted: after the
 * guitaripod rename several modules 404 or serve a stale major, so brew/AUR/
 * source are the honest paths.
 */
function buildInstall(lang, githubUrl, name, resolvedCrate, brewCmd, aurPkg, ov) {
  const all = [...(ov.install ?? [])];

  if (lang === 'rust' && resolvedCrate) {
    all.push({
      channel: 'crates.io',
      label: 'crates.io',
      command: `cargo install ${resolvedCrate}`,
    });
  }
  if (brewCmd) all.push({ channel: 'homebrew', label: 'Homebrew', command: brewCmd });
  if (aurPkg) all.push({ channel: 'aur', label: 'AUR', command: `yay -S ${aurPkg}` });

  if (ov.source) {
    all.push({ channel: 'source', ...ov.source });
  } else if (lang === 'rust') {
    all.push({
      channel: 'source',
      label: 'from source',
      command: `cargo install --git ${githubUrl}`,
    });
  } else if (lang === 'go') {
    all.push({
      channel: 'source',
      label: 'from source',
      command: `git clone ${githubUrl} && cd ${name} && go build`,
    });
  } else if (lang === 'cpp') {
    all.push({
      channel: 'source',
      label: 'build',
      command: `git clone ${githubUrl} && cd ${name} && cmake -B build && cmake --build build`,
    });
  }

  const seen = new Set();
  const deduped = all.filter((c) => !seen.has(c.command) && seen.add(c.command));
  return { primary: deduped[0], all: deduped };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** The curated portfolio list, filtered to shippable Linux apps. */
async function discoverCandidateIds() {
  let discovered = [];
  try {
    const osData = JSON.parse(
      await fs.readFile(path.join(ROOT, 'src/data/opensource.json'), 'utf-8')
    );
    discovered = osData.projects
      .filter(
        (p) =>
          LANG_OF[p.language] &&
          (p.releaseCount ?? 0) > 0 &&
          !SDK_CATEGORIES.has(p.category) &&
          !isWebApp(p.homepageUrl) &&
          !EXCLUDE.has(p.id)
      )
      .map((p) => p.id);
  } catch {
    console.warn('::warning:: opensource.json unreadable — discovery limited to FORCE_INCLUDE.');
  }
  return [...new Set([...discovered, ...FORCE_INCLUDE])].filter((id) => !EXCLUDE.has(id));
}

async function buildRecord(id, brewByFormula, aur) {
  let repo;
  try {
    repo = await repoMeta(id);
  } catch {
    console.warn(`::warning:: repo "${id}" not found on GitHub — skipping.`);
    return null;
  }

  const ov = OVERRIDES[id] ?? {};
  const scope = SCOPES[id] ?? {};
  const lang = ov.lang ?? LANG_OF[repo.language];
  if (!lang) {
    console.warn(
      `::warning:: "${id}" is ${repo.language} (no install recipe) — add an OVERRIDES.lang. Skipping.`
    );
    return null;
  }

  const allReleases = await releaseList(repo.name);
  const releases = scope.tag ? allReleases.filter((r) => scope.tag.test(r.tag)) : allReleases;
  const dates = releases.map((r) => r.date);
  const relCount = dates.length;
  if (relCount === 0) return null;
  const release = pickLatestRelease(releases, ov.linuxAssetMatchesTag);

  const commitCount = scope.paths
    ? await pathCommits(repo.name, scope.paths)
    : await totalCommits(repo.name);

  const form = ov.form ?? deriveForm(repo.description, repo.topics);
  const note = 'note' in ov ? ov.note : deriveNote(repo.description, repo.topics);
  const description = ov.description ?? repo.description;
  const theme = THEMES[id] ?? deriveTheme(form, description);

  let resolvedCrate = null;
  let crateVer = null;
  if (lang === 'rust') {
    const crate = await resolveCrate(id, ov.crate);
    if (crate) {
      resolvedCrate = crate.crate;
      crateVer = crate.version;
    }
  }

  const brewCmd = brewByFormula.get(id) ?? null;
  const aurPkg =
    [...aur.keys()].find(
      (p) => p.toLowerCase() === id.toLowerCase() || p.toLowerCase() === `${id.toLowerCase()}-bin`
    ) ?? null;
  const aurVer = aurPkg ? aur.get(aurPkg) : null;

  const linuxAssets = (release?.assets ?? []).filter(
    (a) => LINUX_ASSET.test(a.name) && !CHECKSUM_ASSET.test(a.name)
  );
  const x64Asset = linuxAssets.find((a) => X64_ASSET.test(a.name)) ?? null;

  const install = buildInstall(lang, repo.githubUrl, repo.name, resolvedCrate, brewCmd, aurPkg, ov);
  if (!install.primary) {
    console.warn(`::warning:: "${id}" has no install channel — add OVERRIDES.install. Skipping.`);
    return null;
  }
  const latestVersion = ov.versionFromAsset
    ? looseVersion(x64Asset?.name ?? release?.tag)
    : maxVersion(semver(release?.tag), crateVer, aurVer);

  console.log(
    `✓ ${id.padEnd(20)} ${form.padEnd(7)} ${theme.padEnd(8)} v${latestVersion ?? '?'}  (${relCount} rel, ${commitCount} commits)  ${install.primary.command}`
  );

  return {
    id,
    name: repo.name,
    form,
    theme,
    group: groupFor(form),
    lang,
    language: LANG_LABELS[lang] ?? repo.language,
    description,
    stars: repo.stars,
    commitCount,
    releaseCount: relCount,
    releaseDates: dates,
    githubUrl: repo.githubUrl,
    homepageUrl: 'homepageUrl' in ov ? ov.homepageUrl : repo.homepageUrl,
    topics: repo.topics,
    latestVersion,
    latestReleaseDate: release?.date ?? null,
    latestReleaseUrl: release?.url ?? repo.githubUrl,
    hasLinuxBinary: linuxAssets.length > 0,
    linuxBinaryUrl: x64Asset?.url ?? null,
    note,
    install,
  };
}

async function main() {
  const ids = await discoverCandidateIds();
  console.log(`Discovered ${ids.length} candidate Linux apps.\n`);

  const [aur, brewByFormula] = await Promise.all([aurPackages(), discoverBrewFormulas(ids)]);

  const records = [];
  for (const id of ids) {
    const record = await buildRecord(id, brewByFormula, aur);
    if (record) records.push(record);
  }

  records.sort((a, b) => a.id.localeCompare(b.id));

  const out = {
    generated:
      'scripts/fetch-linux-releases.mjs — auto-discovered, live from GitHub / crates.io / AUR',
    count: records.length,
    apps: records,
  };
  const outPath = path.join(ROOT, 'src/data/linux-apps.json');
  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`\n✓ Wrote ${records.length} Linux apps to ${path.relative(ROOT, outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
