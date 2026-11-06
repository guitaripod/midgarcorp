import { describe, expect, it } from 'vitest';
import {
  agoLabel,
  daysSince,
  firstPublished,
  formatDay,
  indexFrom,
  rankApps,
  sumPublished,
  trimLeading,
  latestFinished,
  monthName,
  platformsOf,
  shipCadence,
  statsExcerpt,
  thresholdBars,
  weekRange,
} from '../../src/lib/open-page.mjs';

const NOW = Date.parse('2026-11-06T12:00:00Z');

describe('days and their words', () => {
  it('counts whole days back and never goes negative', () => {
    expect(daysSince('2026-11-06T01:00:00Z', NOW)).toBe(0);
    expect(daysSince('2026-11-05T11:00:00Z', NOW)).toBe(1);
    expect(daysSince('2026-10-30T12:00:00Z', NOW)).toBe(7);
    expect(daysSince('2026-11-08T00:00:00Z', NOW)).toBe(0);
    expect(daysSince('not a date', NOW)).toBeNull();
    expect(daysSince(undefined, NOW)).toBeNull();
  });

  it('says today, yesterday, days, weeks and months', () => {
    expect(agoLabel(0)).toBe('today');
    expect(agoLabel(1)).toBe('yesterday');
    expect(agoLabel(13)).toBe('13 days ago');
    expect(agoLabel(14)).toBe('2 weeks ago');
    expect(agoLabel(75)).toBe('2 months ago');
    expect(agoLabel(null)).toBe('date unknown');
  });
});

describe('apps on the App Store', () => {
  const apps = [
    {
      shortName: 'A',
      platforms: ['iPhone', 'Linux'],
      currentVersionReleaseDate: '2026-11-05T10:00:00Z',
    },
    {
      shortName: 'B',
      platforms: ['Mac', 'iPhone', 'Toaster'],
      currentVersionReleaseDate: '2026-10-20T10:00:00Z',
    },
    { shortName: 'C', platforms: ['Apple TV'], currentVersionReleaseDate: '2026-08-01T10:00:00Z' },
    { shortName: 'D', platforms: ['iPad'] },
  ];

  it('lists platforms in the fixed order, unknown ones last', () => {
    expect(platformsOf(apps)).toEqual(['iPhone', 'iPad', 'Mac', 'Apple TV', 'Linux', 'Toaster']);
    expect(platformsOf([])).toEqual([]);
  });

  it('counts releases in the last 7 and 30 days and names the newest', () => {
    expect(shipCadence(apps, NOW)).toEqual({
      total: 4,
      updated7: 1,
      updated30: 2,
      newest: { name: 'A', days: 1 },
    });
    expect(shipCadence([], NOW)).toEqual({ total: 0, updated7: 0, updated30: 0, newest: null });
  });
});

describe('periods', () => {
  const weeks = [
    { period: '2026-10-19', wau: '<10', purchases: '<10' },
    { period: '2026-10-26', wau: 197, purchases: 13 },
    { period: '2026-11-02', wau: 40, purchases: null },
  ];

  it('finds the newest week that had ended when the snapshot was made', () => {
    expect(latestFinished(weeks, 'week', '2026-11-06T08:00:00Z')?.period).toBe('2026-10-26');
    expect(latestFinished(weeks, 'week', '2026-11-10T08:00:00Z')?.period).toBe('2026-11-02');
    expect(latestFinished([], 'week', '2026-11-10T08:00:00Z')).toBeNull();
  });

  it('names a week by its Monday and Sunday, across a month end', () => {
    expect(weekRange('2026-10-26')).toBe('Oct 26 – Nov 1');
    expect(weekRange('2026-08-10')).toBe('Aug 10 – Aug 16');
    expect(weekRange('bad')).toBe('bad');
  });

  it('names a month in full', () => {
    expect(monthName('2026-10-01')).toBe('October 2026');
  });

  it('finds the first week with a published number', () => {
    expect(firstPublished(weeks, ['wau'])).toBe('2026-10-26');
    expect(firstPublished(weeks, ['nothing'])).toBeNull();
  });
});

describe('threshold bars', () => {
  it('draws numbers to scale, hidden cells as the band under the line and gaps as nothing', () => {
    const chart = thresholdBars(['<10', null, 50, 100], { minCount: 10, height: 100, headroom: 1 });
    expect(chart.top).toBe(100);
    expect(chart.band).toBe(10);
    expect(chart.lineY).toBe(90);
    expect(chart.bars.map((bar) => bar.kind)).toEqual(['hidden', 'none', 'value', 'value']);
    expect(chart.bars[0]).toMatchObject({ h: 10, y: 90, value: '<10' });
    expect(chart.bars[1]).toMatchObject({ h: 0, y: 100 });
    expect(chart.bars[2]).toMatchObject({ h: 50, y: 50 });
    expect(chart.bars[3]).toMatchObject({ h: 100, y: 0 });
  });

  it('keeps the band visible at a large scale and every number taller than it', () => {
    const chart = thresholdBars(['<10', 11, 1000], { minCount: 10, height: 100, floorMin: 6 });
    expect(chart.band).toBe(6);
    expect(chart.bars[1].h).toBe(8);
    expect(chart.bars[2].h).toBe(100);
  });

  it('gives an all-hidden chart a modest band instead of a full one', () => {
    const chart = thresholdBars(['<10', '<10'], { minCount: 10, height: 100 });
    expect(chart.band).toBe(25);
    expect(chart.bars.every((bar) => bar.kind === 'hidden')).toBe(true);
  });

  it('draws a series that barely clears the line as barely clearing it', () => {
    const chart = thresholdBars(['<10', 13], { minCount: 10, height: 100 });
    expect(chart.top).toBe(40);
    expect(chart.band).toBe(25);
    expect(chart.bars[1].h).toBe(32.5);
    expect(thresholdBars([13], { minCount: 10, height: 100, headroom: 1 }).top).toBe(13);
  });

  it('shares a scale when given a top', () => {
    const chart = thresholdBars([10, '<10'], { minCount: 10, height: 100, top: 100 });
    expect(chart.top).toBe(100);
    expect(chart.bars[0].h).toBe(12);
    expect(chart.band).toBe(10);
  });
});

describe('the quoted JSON', () => {
  const stats = {
    generated_at: '2026-11-06T08:47:11.838Z',
    rules: { min_count: 10, weeks: 12, months: 6, note: 'x' },
    portfolio: {
      weeks: [
        { period: '2026-10-12', wau: '<10' },
        { period: '2026-10-19', wau: 12 },
        { period: '2026-10-26', wau: 197 },
      ],
      months: [],
      retention: [],
    },
    apps: {},
    metrics: [],
  };

  it('quotes the stamp, the rule and the newest weeks and marks what it leaves out', () => {
    const text = statsExcerpt(stats, 2);
    expect(text).toContain('"generated_at": "2026-11-06T08:47:11.838Z"');
    expect(text).toContain('"min_count": 10');
    expect(text).toContain('"wau": 197');
    expect(text).toContain('/* 1 earlier weeks */');
    expect(text).not.toContain('2026-10-12');
  });

  it('marks nothing when every week fits', () => {
    expect(statsExcerpt(stats, 5)).not.toContain('/*');
  });
});

describe('Apple history helpers', () => {
  it('formats a day', () => {
    expect(formatDay('2025-11-13')).toBe('Nov 13, 2025');
    expect(formatDay('nonsense')).toBe('nonsense');
  });

  it('sums published numbers and counts the held-back cells', () => {
    expect(sumPublished([12, '<10', null, 30, '<10'])).toEqual({ total: 42, hidden: 2 });
    expect(sumPublished([])).toEqual({ total: 0, hidden: 0 });
  });

  it('drops the periods before a source began, keeping later gaps', () => {
    const rows = [
      { period: '2025-10-01', downloads: null, purchases: null },
      { period: '2025-11-01', downloads: '<10', purchases: null },
      { period: '2025-12-01', downloads: null, purchases: null },
    ];
    expect(trimLeading(rows).map((row: { period: string }) => row.period)).toEqual(['2025-11-01', '2025-12-01']);
    expect(trimLeading([{ period: '2025-10-01', downloads: null }])).toEqual([]);
  });

  it('finds where a later series begins inside a longer one', () => {
    const weeks = [{ period: '2026-10-05' }, { period: '2026-10-12' }, { period: '2026-10-19' }];
    expect(indexFrom(weeks, '2026-10-12')).toBe(1);
    expect(indexFrom(weeks, '2026-10-14')).toBe(2);
    expect(indexFrom(weeks, '2026-11-02')).toBe(-1);
    expect(indexFrom(weeks, null)).toBe(-1);
  });

  it('ranks apps by published downloads, then activity, then name', () => {
    const apple = {
      flaccy: { weeks: [{ period: 'w', downloads: 50 }] },
      embr: { weeks: [{ period: 'w', downloads: '<10' }] },
      helia: { weeks: [{ period: 'w', downloads: '<10' }] },
    };
    const activity = {
      embr: { weeks: [{ period: 'w', wau: 13 }] },
      helia: { weeks: [{ period: 'w', wau: '<10' }] },
    };
    expect(rankApps(['helia', 'embr', 'zeta', 'flaccy'], apple, activity)).toEqual([
      'flaccy',
      'embr',
      'helia',
      'zeta',
    ]);
    expect(rankApps(['b', 'a'])).toEqual(['a', 'b']);
  });
});
