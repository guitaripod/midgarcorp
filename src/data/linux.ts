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
const LEAD = ['flaccy', 'emojipick'];
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

export interface LinuxGroupSection {
  key: LinuxGroup;
  title: string;
  command: string;
  blurb: string;
  apps: LinuxApp[];
}

const GROUP_ORDER: { key: LinuxGroup; title: string; command: string; blurb: string }[] = [
  {
    key: 'desktop',
    title: 'Desktop & daemons',
    command: 'ls ~/linux/desktop',
    blurb: 'Native GTK/KDE apps and background services built for the Linux desktop.',
  },
  {
    key: 'bin',
    title: 'Command-line',
    command: 'ls ~/linux/bin',
    blurb: 'Single-binary tools for the terminal — install and run.',
  },
];

export const linuxGroups: LinuxGroupSection[] = GROUP_ORDER.map((g) => ({
  ...g,
  apps: linuxApps.filter((app) => app.group === g.key),
})).filter((section) => section.apps.length > 0);

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
