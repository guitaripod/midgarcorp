import linuxData from './linux-apps.json';

export interface LinuxInstallChannel {
  channel: string;
  label: string;
  command: string;
}

export interface LinuxInstall {
  primary: LinuxInstallChannel;
  all: LinuxInstallChannel[];
}

export type LinuxForm = 'cli' | 'tui' | 'gui' | 'daemon';
export type LinuxGroup = 'bin' | 'desktop';
export type LinuxTheme = 'desktop' | 'agents' | 'system' | 'tools';
export type LinuxLang = 'rust' | 'go' | 'cpp' | 'swift' | 'python';

/// A row of linux-apps.json — generated live by scripts/fetch-linux-releases.mjs.
export interface LinuxApp {
  id: string;
  name: string;
  form: LinuxForm;
  group: LinuxGroup;
  theme: LinuxTheme;
  lang: LinuxLang;
  language: string;
  description: string;
  stars: number;
  commitCount: number;
  releaseCount: number;
  releaseDates: string[];
  githubUrl: string;
  homepageUrl: string | null;
  topics: string[];
  latestVersion: string | null;
  latestReleaseDate: string | null;
  latestReleaseUrl: string;
  hasLinuxBinary: boolean;
  linuxBinaryUrl: string | null;
  note: string | null;
  install: LinuxInstall;
  formLabel: string;
}

const FORM_LABELS: Record<LinuxForm, string> = {
  cli: 'CLI',
  tui: 'TUI',
  gui: 'Desktop app',
  daemon: 'Daemon',
};

const DAY_MS = 86_400_000;

/// Builds the ranking from how much work an app represents: commits and releases carry the
/// weight, stars barely count, and a release in the last year earns a small recency bonus.
const SCORE_WEIGHTS = { commits: 2, releases: 2.5, stars: 0.4 };
const RECENCY_BONUS: { withinDays: number; bonus: number }[] = [
  { withinDays: 90, bonus: 1.5 },
  { withinDays: 365, bonus: 0.75 },
];

export const LINUX_NOW = new Date();

export function linuxScore(app: LinuxApp, now: Date = LINUX_NOW): number {
  const base =
    SCORE_WEIGHTS.commits * Math.log(1 + app.commitCount) +
    SCORE_WEIGHTS.releases * Math.log(1 + app.releaseCount) +
    SCORE_WEIGHTS.stars * Math.log(1 + app.stars);
  if (!app.latestReleaseDate) return base;
  const age = (now.getTime() - new Date(app.latestReleaseDate).getTime()) / DAY_MS;
  const recent = RECENCY_BONUS.find((tier) => age <= tier.withinDays);
  return base + (recent?.bonus ?? 0);
}

type RawLinuxApp = Omit<LinuxApp, 'formLabel'>;

export const linuxApps: LinuxApp[] = (linuxData.apps as RawLinuxApp[])
  .map((app) => ({ ...app, formLabel: FORM_LABELS[app.form] }))
  .sort((a, b) => linuxScore(b) - linuxScore(a) || a.id.localeCompare(b.id));

export interface LinuxShot {
  src: string;
  w: number;
  h: number;
  alt: string;
  widths: number[];
}

export interface LinuxShowcase {
  blurb: string;
  accent: string;
  shot: LinuxShot;
  more: LinuxShot[];
}

/// Apps with a real screenshot get a showcase; every other app is a plain card, so a newly
/// discovered tool needs no entry here. `widths` lists the `@<width>.webp` variants that
/// exist next to each file.
export const LINUX_SHOWCASE: Record<string, LinuxShowcase> = {
  tailscode: {
    blurb:
      'A native remote for Claude Code, Oh My Pi and opencode on your own machines, over your own tailnet with no relay and no account. The Linux client is a GTK4 / libadwaita app written in Swift: live transcript, file tree, quota gauges, tiled splits, and terminal, video and browser panes.',
    accent: '#546BFF',
    shot: {
      src: '/screenshots/tailscode/desk-dark-chat.webp',
      w: 1920,
      h: 1080,
      alt: 'Tailscode on Linux: a live agent transcript with the file tree and quota gauges',
      widths: [480, 960],
    },
    more: [
      {
        src: '/screenshots/tailscode/desk-dark-split.webp',
        w: 1920,
        h: 1080,
        alt: 'Tailscode on Linux: two sessions in tiled splits',
        widths: [480, 960],
      },
      {
        src: '/screenshots/tailscode/desk-dark-studio.webp',
        w: 1920,
        h: 1080,
        alt: 'Tailscode on Linux: the Studio with a finished render',
        widths: [480, 960],
      },
    ],
  },
  flaccy: {
    blurb:
      'A lossless music player with gapless playback, a real equalizer and Last.fm scrobbling, as a native GTK4 / libadwaita app: library, synced lyrics, queue, playlists and listening stats.',
    accent: '#a78bfa',
    shot: {
      src: '/screenshots/flaccy/linux-1.webp',
      w: 1920,
      h: 1080,
      alt: 'flaccy on Linux: the album library in a dark libadwaita window',
      widths: [480, 960],
    },
    more: [
      {
        src: '/screenshots/flaccy/linux-2.webp',
        w: 1920,
        h: 1080,
        alt: 'flaccy on Linux: Now Playing with synced lyrics and the queue',
        widths: [480, 960],
      },
      {
        src: '/screenshots/flaccy/linux-12.webp',
        w: 1920,
        h: 1080,
        alt: 'flaccy on Linux: the equalizer',
        widths: [480, 960],
      },
    ],
  },
  unrager: {
    blurb:
      'Takes the rage out of your x.com timeline with a model that runs on your own computer. The terminal client filters the Following and For You timelines and shows what it hid and why; there is a browser extension and an iPhone app too.',
    accent: '#1D9BF0',
    shot: {
      src: '/screenshots/linux/unrager.webp',
      w: 1232,
      h: 1138,
      alt: "unrager's terminal client showing the Following timeline with twelve posts filtered out",
      widths: [480, 960],
    },
    more: [],
  },
  mbench: {
    blurb:
      'Ranks the models your own GPU runs. One command per model loads it through llama-swap, measures speed and answer quality the same way each time, and rebuilds a leaderboard page: quality against speed, 95% intervals, scores per task.',
    accent: '#7c9cff',
    shot: {
      src: '/screenshots/linux/mbench.webp',
      w: 2000,
      h: 1333,
      alt: 'The mbench leaderboard page: a table of models with quality, decode speed and per-task scores',
      widths: [480, 960, 1440],
    },
    more: [],
  },
  tokenmaxxing: {
    blurb:
      'Usage dashboards for your LLM subscriptions: live quota for Claude, Grok and opencode, local history and a value-for-money readout. The KDE build lives in the system tray.',
    accent: '#d97757',
    shot: {
      src: '/screenshots/linux/tokenmaxxing.webp',
      w: 1120,
      h: 1108,
      alt: 'tokenmaxxing on KDE: quota rings for Claude, Grok and opencode',
      widths: [480, 960],
    },
    more: [],
  },
  emojipick: {
    blurb:
      'A fast emoji picker for KDE Plasma Wayland: search by name or :shortcode:, category tabs, recents ranked by use, skin tones and auto-paste into the window you came from.',
    accent: '#f5b82e',
    shot: {
      src: '/screenshots/linux/emojipick.webp',
      w: 1216,
      h: 912,
      alt: 'emojipick on KDE Plasma: the search box, category tabs and a grid of emoji',
      widths: [480, 960],
    },
    more: [],
  },
  recview: {
    blurb:
      'A GPU-accelerated review window for screen recordings: scrub a filmstrip timeline, trim, crop, export or discard. GTK4, libmpv and NVENC.',
    accent: '#3584e4',
    shot: {
      src: '/screenshots/linux/recview.webp',
      w: 1080,
      h: 800,
      alt: 'recview reviewing a clip: filmstrip timeline with a waveform, trim handles and export controls',
      widths: [480, 960],
    },
    more: [],
  },
};

/// `srcset` for a shot: its `@<width>.webp` variants plus the original.
export function shotSrcset(shot: LinuxShot): string {
  const variants = shot.widths.map(
    (width) => `${shot.src.replace(/\.webp$/, `@${width}.webp`)} ${width}w`
  );
  return [...variants, `${shot.src} ${shot.w}w`].join(', ');
}

export const HERO_SCORE = 17;
export const FEATURED_SCORE = 9;

export interface LinuxSection {
  theme: LinuxTheme;
  title: string;
  command: string;
  blurb: string;
  heroes: LinuxApp[];
  showcase: LinuxApp[];
  featured: LinuxApp[];
  compact: LinuxApp[];
  totals: { apps: number; commits: number; releases: number };
}

const SECTION_COPY: Record<LinuxTheme, Pick<LinuxSection, 'title' | 'command' | 'blurb'>> = {
  desktop: {
    title: 'Desktop apps',
    command: 'ls ~/linux/desktop',
    blurb: 'Native GTK4 and KDE Plasma apps, shown running.',
  },
  agents: {
    title: 'Agents & local AI',
    command: 'ls ~/linux/agents',
    blurb:
      'The tooling around coding agents and local models: servers that put Claude Code and Oh My Pi on a tailnet, a task dispatcher, a benchmark harness, a timeline filter and a research agent.',
  },
  system: {
    title: 'System & Plasma',
    command: 'ls ~/linux/system',
    blurb: 'Daemons and utilities that make the desktop, Steam and emulators behave.',
  },
  tools: {
    title: 'Command-line',
    command: 'ls ~/linux/bin',
    blurb: 'Single-binary tools for the terminal: install and run.',
  },
};

const SECTION_ORDER: LinuxTheme[] = ['desktop', 'agents', 'system', 'tools'];

/// Splits one group's apps (already best-first) by how they are shown: a large row for
/// heavyweight apps that have a screenshot, a screenshot card for the lighter ones, a full
/// card for anything substantial, and a one-line row for the rest.
export function partitionSection(
  theme: LinuxTheme,
  apps: LinuxApp[],
  now: Date = LINUX_NOW
): LinuxSection {
  const score = (app: LinuxApp) => linuxScore(app, now);
  const shown = (app: LinuxApp) => app.id in LINUX_SHOWCASE;
  return {
    theme,
    ...SECTION_COPY[theme],
    heroes: apps.filter((app) => shown(app) && score(app) >= HERO_SCORE),
    showcase: apps.filter((app) => shown(app) && score(app) < HERO_SCORE),
    featured: apps.filter((app) => !shown(app) && score(app) >= FEATURED_SCORE),
    compact: apps.filter((app) => !shown(app) && score(app) < FEATURED_SCORE),
    totals: {
      apps: apps.length,
      commits: apps.reduce((sum, app) => sum + app.commitCount, 0),
      releases: apps.reduce((sum, app) => sum + app.releaseCount, 0),
    },
  };
}

export const linuxSections: LinuxSection[] = SECTION_ORDER.map((theme) =>
  partitionSection(
    theme,
    linuxApps.filter((app) => app.theme === theme)
  )
).filter((section) => section.totals.apps > 0);

function orderedLanguages(): string[] {
  const counts = new Map<string, number>();
  for (const app of linuxApps) counts.set(app.language, (counts.get(app.language) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
}

export const linuxMax = {
  commits: Math.max(1, ...linuxApps.map((app) => app.commitCount)),
  releases: Math.max(1, ...linuxApps.map((app) => app.releaseCount)),
};

export const linuxStats = {
  appCount: linuxApps.length,
  releaseCount: linuxApps.reduce((sum, app) => sum + app.releaseCount, 0),
  commitCount: linuxApps.reduce((sum, app) => sum + app.commitCount, 0),
  starCount: linuxApps.reduce((sum, app) => sum + app.stars, 0),
  languages: orderedLanguages(),
};

/// Highest-scoring apps first for the homepage teaser, skipping any ids already featured
/// elsewhere on the page (e.g. the CLI section) to avoid duplicates.
export function featuredLinuxApps(limit = 3, exclude: string[] = []): LinuxApp[] {
  const skip = new Set(exclude);
  return linuxApps.filter((app) => !skip.has(app.id)).slice(0, limit);
}
