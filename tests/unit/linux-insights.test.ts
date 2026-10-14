import { describe, it, expect } from 'vitest';
import type { LinuxApp } from '../../src/data/linux';
import { linuxApps, linuxScore, partitionSection } from '../../src/data/linux';
import {
  ageLabel,
  barFraction,
  channelBundles,
  formShare,
  freshness,
  heatLevel,
  languageShare,
  monthKeys,
  monthlyTotals,
  releasesSince,
  shipLog,
} from '../../src/lib/linux-insights';

const NOW = new Date('2026-10-14T12:00:00Z');

/// A minimal app with just the fields the insight functions read.
function fakeApp(overrides: Partial<LinuxApp>): LinuxApp {
  return {
    id: 'x',
    name: 'x',
    form: 'cli',
    group: 'bin',
    theme: 'tools',
    lang: 'rust',
    language: 'Rust',
    description: 'd',
    stars: 0,
    commitCount: 0,
    releaseCount: 0,
    releaseDates: [],
    githubUrl: 'https://github.com/guitaripod/x',
    homepageUrl: null,
    topics: [],
    latestVersion: null,
    latestReleaseDate: null,
    latestReleaseUrl: 'https://github.com/guitaripod/x/releases',
    hasLinuxBinary: false,
    linuxBinaryUrl: null,
    note: null,
    install: { primary: { channel: 'source', label: 'src', command: 'c' }, all: [] },
    formLabel: 'CLI',
    ...overrides,
  };
}

describe('freshness and age', () => {
  it('buckets by days since the last release', () => {
    expect(freshness('2026-10-01T00:00:00Z', NOW)).toBe('fresh');
    expect(freshness('2026-05-01T00:00:00Z', NOW)).toBe('steady');
    expect(freshness('2024-05-01T00:00:00Z', NOW)).toBe('quiet');
    expect(freshness(null, NOW)).toBe('quiet');
  });

  it('words the age at the right scale', () => {
    expect(ageLabel('2026-10-14T01:00:00Z', NOW)).toBe('today');
    expect(ageLabel('2026-10-04T12:00:00Z', NOW)).toBe('10d ago');
    expect(ageLabel('2026-07-14T12:00:00Z', NOW)).toBe('3 mo ago');
    expect(ageLabel('2023-10-14T12:00:00Z', NOW)).toBe('3 yr ago');
    expect(ageLabel(null, NOW)).toBe('no releases');
  });
});

describe('shares', () => {
  it('sums language and form shares to the whole set', () => {
    for (const shares of [languageShare(linuxApps), formShare(linuxApps)]) {
      expect(shares.reduce((sum, share) => sum + share.count, 0)).toBe(linuxApps.length);
      expect(shares.reduce((sum, share) => sum + share.fraction, 0)).toBeCloseTo(1, 6);
    }
  });

  it('orders forms desktop, daemon, TUI, CLI and drops empty ones', () => {
    const apps = [fakeApp({ form: 'cli' }), fakeApp({ form: 'gui' })];
    expect(formShare(apps).map((share) => share.key)).toEqual(['gui', 'cli']);
  });
});

describe('release timeline', () => {
  it('lists every month between two dates inclusive, across a year boundary', () => {
    expect(monthKeys(new Date('2025-11-20T00:00:00Z'), new Date('2026-02-03T00:00:00Z'))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('counts releases inside a trailing window', () => {
    const app = fakeApp({
      releaseDates: ['2026-10-10T00:00:00Z', '2026-09-01T00:00:00Z', '2025-01-01T00:00:00Z'],
    });
    expect(releasesSince([app], 30, NOW)).toBe(1);
    expect(releasesSince([app], 90, NOW)).toBe(2);
  });

  it('totals releases per month for the trailing months only', () => {
    const app = fakeApp({
      releaseDates: [
        '2026-10-10T00:00:00Z',
        '2026-10-12T00:00:00Z',
        '2026-08-01T00:00:00Z',
        '2020-01-01T00:00:00Z',
      ],
    });
    const totals = monthlyTotals([app], 3, NOW);
    expect(totals).toEqual([
      { key: '2026-08', count: 1 },
      { key: '2026-09', count: 0 },
      { key: '2026-10', count: 2 },
    ]);
  });

  it('maps heat levels monotonically', () => {
    expect([0, 1, 2, 3, 4, 7, 8, 40].map(heatLevel)).toEqual([0, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('builds one row per app, newest release first, with every release in a month cell', () => {
    const older = fakeApp({
      id: 'older',
      releaseCount: 1,
      releaseDates: ['2025-01-15T00:00:00Z'],
      latestReleaseDate: '2025-01-15T00:00:00Z',
    });
    const newer = fakeApp({
      id: 'newer',
      releaseCount: 2,
      releaseDates: ['2026-09-02T00:00:00Z', '2026-09-20T00:00:00Z'],
      latestReleaseDate: '2026-09-20T00:00:00Z',
    });
    const log = shipLog([older, newer], NOW);
    expect(log.months[0]).toBe('2025-01');
    expect(log.months.at(-1)).toBe('2026-10');
    expect(log.rows.map((row) => row.app.id)).toEqual(['newer', 'older']);
    expect(log.rows[0].counts.reduce((a, b) => a + b, 0)).toBe(2);
    expect(log.rows[0].counts[log.months.indexOf('2026-09')]).toBe(2);
    expect(log.years.map((year) => year.label)).toEqual(['2025', '2026']);
  });

  it('plots every release the data records', () => {
    const log = shipLog(linuxApps, NOW);
    const plotted = log.rows.reduce((sum, row) => sum + row.counts.reduce((a, b) => a + b, 0), 0);
    expect(plotted).toBe(linuxApps.reduce((sum, app) => sum + app.releaseDates.length, 0));
  });

  it('returns an empty log when nothing has been released', () => {
    expect(shipLog([fakeApp({})], NOW)).toEqual({ months: [], years: [], rows: [] });
  });
});

describe('channel bundles', () => {
  it('builds one command per package manager from the apps own install lines', () => {
    const apps = [
      fakeApp({
        name: 'a',
        install: {
          primary: { channel: 'crates.io', label: 'crates.io', command: 'cargo install a-cli' },
          all: [
            { channel: 'crates.io', label: 'crates.io', command: 'cargo install a-cli' },
            { channel: 'aur', label: 'AUR', command: 'yay -S a-bin' },
          ],
        },
      }),
      fakeApp({
        name: 'b',
        install: {
          primary: {
            channel: 'homebrew',
            label: 'Homebrew',
            command: 'brew install guitaripod/tap/b',
          },
          all: [
            { channel: 'homebrew', label: 'Homebrew', command: 'brew install guitaripod/tap/b' },
            { channel: 'crates.io', label: 'crates.io', command: 'cargo install b' },
          ],
        },
      }),
    ];
    const bundles = channelBundles(apps);
    expect(bundles.map((bundle) => bundle.command)).toEqual([
      'cargo install a-cli b',
      'brew install guitaripod/tap/b',
      'yay -S a-bin',
    ]);
    expect(bundles[0].apps).toEqual(['a', 'b']);
  });

  it('never bundles a from-source command and only lists real package names', () => {
    for (const bundle of channelBundles(linuxApps)) {
      expect(bundle.command).not.toContain('git clone');
      expect(bundle.command).not.toContain('--git');
      expect(
        bundle.packages.every((pkg) => /^[\w./-]+$/.test(pkg)),
        bundle.channel
      ).toBe(true);
    }
  });
});

describe('score and tiers', () => {
  it('lets commits and releases outweigh stars', () => {
    const worked = fakeApp({
      commitCount: 300,
      releaseCount: 30,
      stars: 0,
      latestReleaseDate: '2025-01-01T00:00:00Z',
    });
    const starred = fakeApp({
      commitCount: 5,
      releaseCount: 1,
      stars: 60,
      latestReleaseDate: '2025-01-01T00:00:00Z',
    });
    expect(linuxScore(worked, NOW)).toBeGreaterThan(linuxScore(starred, NOW));
  });

  it('adds a recency bonus that shrinks with age', () => {
    const base = { commitCount: 20, releaseCount: 3 };
    const fresh = linuxScore(fakeApp({ ...base, latestReleaseDate: '2026-10-01T00:00:00Z' }), NOW);
    const year = linuxScore(fakeApp({ ...base, latestReleaseDate: '2026-02-01T00:00:00Z' }), NOW);
    const old = linuxScore(fakeApp({ ...base, latestReleaseDate: '2022-02-01T00:00:00Z' }), NOW);
    expect(fresh).toBeGreaterThan(year);
    expect(year).toBeGreaterThan(old);
  });

  it('shows an app with a screenshot big only when it also carries weight', () => {
    const heavy = fakeApp({
      id: 'tailscode',
      theme: 'desktop',
      commitCount: 480,
      releaseCount: 46,
      latestReleaseDate: '2026-10-13T00:00:00Z',
    });
    const light = fakeApp({
      id: 'emojipick',
      theme: 'desktop',
      commitCount: 12,
      releaseCount: 1,
      latestReleaseDate: '2026-07-13T00:00:00Z',
    });
    const plain = fakeApp({
      id: 'plain-heavy',
      theme: 'desktop',
      commitCount: 90,
      releaseCount: 12,
      latestReleaseDate: '2026-10-01T00:00:00Z',
    });
    const tiny = fakeApp({
      id: 'plain-tiny',
      theme: 'desktop',
      commitCount: 3,
      releaseCount: 1,
      latestReleaseDate: '2024-01-01T00:00:00Z',
    });
    const section = partitionSection('desktop', [heavy, plain, light, tiny], NOW);
    expect(section.heroes.map((a) => a.id)).toEqual(['tailscode']);
    expect(section.showcase.map((a) => a.id)).toEqual(['emojipick']);
    expect(section.featured.map((a) => a.id)).toEqual(['plain-heavy']);
    expect(section.compact.map((a) => a.id)).toEqual(['plain-tiny']);
    expect(section.totals).toEqual({ apps: 4, commits: 585, releases: 60 });
  });

  it('scales bars on a square root with a visible floor', () => {
    expect(barFraction(0, 100)).toBe(0);
    expect(barFraction(100, 100)).toBe(1);
    expect(barFraction(25, 100)).toBeCloseTo(0.5, 6);
    expect(barFraction(1, 10000)).toBe(0.04);
  });
});
