import type { LinuxApp, LinuxForm } from '../data/linux';
import { DAY_MS } from './work';

export {
  FRESHNESS_STYLE,
  LANGUAGE_COLORS,
  ageLabel,
  barFraction,
  freshness,
  languageColor,
  type Freshness,
} from './work';

export const FORM_ORDER: LinuxForm[] = ['gui', 'daemon', 'tui', 'cli'];

export const FORM_NOUNS: Record<LinuxForm, string> = {
  gui: 'desktop',
  daemon: 'daemon',
  tui: 'TUI',
  cli: 'CLI',
};

export const FORM_GLYPHS: Record<LinuxForm, string> = {
  cli: '[cli]',
  tui: '[tui]',
  gui: '[app]',
  daemon: '[svc]',
};

export interface Share {
  key: string;
  count: number;
  fraction: number;
}

/// Turns tallies into shares of their total, keeping the given order.
function toShares(entries: [string, number][]): Share[] {
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({ key, count, fraction: total ? count / total : 0 }));
}

export function languageShare(apps: LinuxApp[]): Share[] {
  const counts = new Map<string, number>();
  for (const app of apps) counts.set(app.language, (counts.get(app.language) ?? 0) + 1);
  return toShares([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

export function formShare(apps: LinuxApp[]): Share[] {
  return toShares(
    FORM_ORDER.map(
      (form) => [form, apps.filter((app) => app.form === form).length] as [string, number]
    )
  );
}

export function releasesSince(apps: LinuxApp[], days: number, now: Date): number {
  const cutoff = now.getTime() - days * DAY_MS;
  return apps.reduce(
    (sum, app) =>
      sum + app.releaseDates.filter((date) => new Date(date).getTime() >= cutoff).length,
    0
  );
}

const monthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

/// Every `YYYY-MM` from the month of `start` through the month of `end`, inclusive.
export function monthKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
  while (cursor.getTime() <= last) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

export interface MonthTotal {
  key: string;
  count: number;
}

/// Releases per month across all apps for the `months` most recent months.
export function monthlyTotals(apps: LinuxApp[], months: number, now: Date): MonthTotal[] {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const totals = new Map(monthKeys(start, now).map((key) => [key, 0]));
  for (const app of apps) {
    for (const date of app.releaseDates) {
      const key = monthKey(new Date(date));
      if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + 1);
    }
  }
  return [...totals.entries()].map(([key, count]) => ({ key, count }));
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export function heatLevel(count: number): HeatLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 7) return 3;
  return 4;
}

export interface ShipRow {
  app: LinuxApp;
  counts: number[];
}

export interface ShipYear {
  label: string;
  index: number;
}

export interface ShipLog {
  months: string[];
  years: ShipYear[];
  rows: ShipRow[];
}

/// One row per app, one column per month from the first release anywhere to now;
/// rows sort by newest release so what is alive sits on top.
export function shipLog(apps: LinuxApp[], now: Date): ShipLog {
  const stamps = apps.flatMap((app) => app.releaseDates.map((date) => new Date(date).getTime()));
  if (stamps.length === 0) return { months: [], years: [], rows: [] };

  const months = monthKeys(new Date(Math.min(...stamps)), now);
  const column = new Map(months.map((key, index) => [key, index]));

  const rows = apps
    .map((app) => {
      const counts = months.map(() => 0);
      for (const date of app.releaseDates) {
        const index = column.get(monthKey(new Date(date)));
        if (index !== undefined) counts[index] += 1;
      }
      return { app, counts };
    })
    .sort(
      (a, b) =>
        (b.app.releaseDates.at(-1) ?? '').localeCompare(a.app.releaseDates.at(-1) ?? '') ||
        a.app.id.localeCompare(b.app.id)
    );

  const years = months.flatMap((key, index) =>
    key.endsWith('-01') || index === 0 ? [{ label: key.slice(0, 4), index }] : []
  );

  return { months, years, rows };
}

export interface ChannelBundle {
  channel: 'cargo' | 'brew' | 'aur';
  title: string;
  command: string;
  packages: string[];
  apps: string[];
}

const BUNDLES: {
  channel: ChannelBundle['channel'];
  title: string;
  source: string;
  prefix: string;
}[] = [
  { channel: 'cargo', title: 'cargo', source: 'crates.io', prefix: 'cargo install ' },
  { channel: 'brew', title: 'Homebrew', source: 'homebrew', prefix: 'brew install ' },
  { channel: 'aur', title: 'AUR', source: 'aur', prefix: 'yay -S ' },
];

/// One install command per package manager covering every app that ships on it,
/// built from each app's own recorded command so renamed crates and tap paths
/// (`flyr` is `flyr-cli` on crates.io) stay correct.
export function channelBundles(apps: LinuxApp[]): ChannelBundle[] {
  return BUNDLES.flatMap(({ channel, title, source, prefix }) => {
    const entries = apps.flatMap((app) => {
      const hit = app.install.all.find(
        (candidate) => candidate.channel === source && candidate.command.startsWith(prefix)
      );
      return hit ? [{ app: app.name, pkg: hit.command.slice(prefix.length).trim() }] : [];
    });
    if (entries.length === 0) return [];
    return [
      {
        channel,
        title,
        command: `${prefix}${entries.map((entry) => entry.pkg).join(' ')}`,
        packages: entries.map((entry) => entry.pkg),
        apps: entries.map((entry) => entry.app),
      },
    ];
  });
}
