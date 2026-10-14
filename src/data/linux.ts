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

/// A row of linux-apps.json — generated live by scripts/fetch-linux-releases.mjs.
export interface LinuxApp {
  id: string;
  name: string;
  form: LinuxForm;
  group: LinuxGroup;
  lang: 'rust' | 'go' | 'cpp';
  language: string;
  description: string;
  stars: number;
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

/// Flagship apps lead the page regardless of release count. The generator writes
/// linux-apps.json already lead-first, but re-applying the order here keeps the
/// page independent of file ordering.
const LEAD = ['flaccy', 'emojipick', 'recview'];
const leadRank = (id: string) => {
  const i = LEAD.indexOf(id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

type RawLinuxApp = Omit<LinuxApp, 'formLabel'>;

export const linuxApps: LinuxApp[] = (linuxData.apps as RawLinuxApp[])
  .map((app) => ({ ...app, formLabel: FORM_LABELS[app.form] }))
  .sort(
    (a, b) =>
      leadRank(a.id) - leadRank(b.id) ||
      b.releaseCount - a.releaseCount ||
      b.stars - a.stars ||
      a.id.localeCompare(b.id)
  );

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

/// Apps with real window screenshots get a flagship row; every other app falls
/// through to the filterable bench, so a newly discovered tool needs no entry here.
/// `widths` lists the `@<width>.webp` variants that exist next to each file.
export const LINUX_SHOWCASE: Record<string, LinuxShowcase> = {
  flaccy: {
    blurb:
      'A lossless music player with gapless playback and Last.fm scrobbling, as a native GTK4 / libadwaita app: library, synced lyrics, queue, playlists and listening stats.',
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
        src: '/screenshots/flaccy/linux-9.webp',
        w: 1920,
        h: 1080,
        alt: 'flaccy on Linux: listening stats with a play heatmap',
        widths: [480, 960],
      },
    ],
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

export const linuxFlagships: LinuxApp[] = linuxApps.filter((app) => app.id in LINUX_SHOWCASE);

export const linuxBench: LinuxApp[] = linuxApps.filter((app) => !(app.id in LINUX_SHOWCASE));

function orderedLanguages(): string[] {
  const counts = new Map<string, number>();
  for (const app of linuxApps) counts.set(app.language, (counts.get(app.language) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
}

export const linuxStats = {
  appCount: linuxApps.length,
  releaseCount: linuxApps.reduce((sum, app) => sum + app.releaseCount, 0),
  starCount: linuxApps.reduce((sum, app) => sum + app.stars, 0),
  languages: orderedLanguages(),
};

/// Lead apps first for the homepage teaser, skipping any ids already featured
/// elsewhere on the page (e.g. the CLI section) to avoid duplicates.
export function featuredLinuxApps(limit = 3, exclude: string[] = []): LinuxApp[] {
  const skip = new Set(exclude);
  return linuxApps.filter((app) => !skip.has(app.id)).slice(0, limit);
}
