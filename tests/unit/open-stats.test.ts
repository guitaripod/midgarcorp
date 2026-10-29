/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  allHidden,
  appsWithData,
  describeSeries,
  formatCell,
  formatMonth,
  formatShare,
  formatStamp,
  formatWeek,
  hasData,
  isHidden,
  isOpenPeriod,
  isSample,
  isUsable,
  latestOf,
  seriesOf,
  sparkline,
} from '../../src/lib/open-stats.mjs';
import { refresh } from '../../scripts/fetch-open-stats.mjs';
import committed from '../../src/data/open-stats.json';

const H = '<10';

function validStats(overrides: Record<string, unknown> = {}) {
  return {
    generated_at: '2026-10-29T12:15:00Z',
    rules: { min_count: 10, weeks: 12, months: 6, note: 'Counts under 10 are hidden.' },
    portfolio: {
      weeks: [
        { period: '2026-10-19', wau: 12 },
        { period: '2026-10-26', wau: H },
      ],
      months: [{ period: '2026-10-01', mau: 40 }],
      retention: [{ cohort: '2026-10-19', w1: 0.4, w4: null }],
    },
    apps: {},
    metrics: [{ id: 'wau', title: 'Weekly active installs', unit: 'installs', caveat: '' }],
    ...overrides,
  };
}

describe('hidden and missing values', () => {
  it('treats a "<n" string as hidden and nothing else', () => {
    expect(isHidden('<10')).toBe(true);
    expect(isHidden('<5')).toBe(true);
    expect(isHidden(10)).toBe(false);
    expect(isHidden(null)).toBe(false);
    expect(isHidden('10')).toBe(false);
  });

  it('formats a count, a hidden marker and a missing cell', () => {
    expect(formatCell(1234)).toBe('1,234');
    expect(formatCell(H)).toBe('<10');
    expect(formatCell(null)).toBe('–');
    expect(formatShare(0.384)).toBe('38%');
    expect(formatShare(H)).toBe('<10');
    expect(formatShare(null)).toBe('–');
  });

  it('formats periods without a locale', () => {
    expect(formatWeek('2026-10-26')).toBe('Oct 26');
    expect(formatMonth('2026-08-01')).toBe('Aug 2026');
    expect(formatStamp('2026-10-29T12:15:00Z')).toBe('2026-10-29 12:15 UTC');
  });
});

describe('reading a list', () => {
  const rows = [
    { period: '2026-10-12', wau: H },
    { period: '2026-10-19', wau: 14 },
    { period: '2026-10-26', wau: null },
  ];

  it('reads a column with a missing key as not yet', () => {
    expect(seriesOf(rows, 'wau')).toEqual([H, 14, null]);
    expect(seriesOf(rows, 'nope')).toEqual([null, null, null]);
  });

  it('finds the newest cell that exists', () => {
    expect(latestOf(rows, 'wau')).toEqual({ period: '2026-10-19', cell: 14, index: 1 });
    expect(latestOf(rows.slice(0, 1), 'wau')?.cell).toBe(H);
    expect(latestOf([{ period: '2026-10-12', wau: null }], 'wau')).toBeNull();
  });

  it('knows a week or month that was still running when the snapshot was made', () => {
    expect(isOpenPeriod('2026-10-26', 'week', '2026-10-29T12:15:00Z')).toBe(true);
    expect(isOpenPeriod('2026-10-19', 'week', '2026-10-29T12:15:00Z')).toBe(false);
    expect(isOpenPeriod('2026-10-01', 'month', '2026-10-29T12:15:00Z')).toBe(true);
    expect(isOpenPeriod('2026-09-01', 'month', '2026-10-29T12:15:00Z')).toBe(false);
  });

  it('says in words what a chart shows', () => {
    expect(describeSeries('Active installs', rows, 'wau')).toBe(
      'Active installs: 1 of 3 weeks shown, from 14 to 14, 1 hidden for being too small.'
    );
    expect(describeSeries('Purchases', [{ period: 'a', purchases: H }], 'purchases')).toBe(
      'Purchases: too few to show in any of the last 1 weeks.'
    );
  });
});

describe('sparkline', () => {
  const box = { width: 100, height: 50, pad: 5 };

  it('joins consecutive numbers and breaks the line at a hidden or missing week', () => {
    const drawing = sparkline([1, 2, H, 4, null, 6], box);
    expect(drawing.paths).toHaveLength(3);
    expect(drawing.points.map((point) => point.kind)).toEqual([
      'value',
      'value',
      'hidden',
      'value',
      'none',
      'value',
    ]);
    expect(drawing.hidden).toHaveLength(1);
  });

  it('puts the largest number at the top and a hidden week on the floor', () => {
    const drawing = sparkline([0, 10, H], box);
    expect(drawing.top).toBe(10);
    expect(drawing.points[1].y).toBe(5);
    expect(drawing.points[0].y).toBe(drawing.floor);
    expect(drawing.points[2].y).toBe(drawing.floor);
  });

  it('spans the box from the left pad to the right pad and centres a single point', () => {
    const drawing = sparkline([1, 2, 3], box);
    expect(drawing.points[0].x).toBe(5);
    expect(drawing.points[2].x).toBe(95);
    expect(sparkline([7], box).points[0].x).toBe(50);
  });

  it('marks the newest number as the last point', () => {
    expect(sparkline([3, H, 5, H], box).last?.index).toBe(2);
    expect(sparkline([H, H], box).last).toBeNull();
  });

  it('tells a list with nothing to draw', () => {
    expect(allHidden([H, null, H])).toBe(true);
    expect(allHidden([H, 3])).toBe(false);
  });
});

describe('shape of the published stats', () => {
  it('accepts the committed snapshot', () => {
    expect(isUsable(committed)).toBe(true);
  });

  it('accepts hidden values, nulls and empty lists', () => {
    expect(isUsable(validStats())).toBe(true);
    expect(
      isUsable(validStats({ portfolio: { weeks: [], months: [], retention: [] }, metrics: [] }))
    ).toBe(true);
  });

  it('rejects an error body, a missing list and a wrong cell', () => {
    expect(isUsable({ error: 'not found' })).toBe(false);
    expect(isUsable(null)).toBe(false);
    expect(isUsable(validStats({ generated_at: 'yesterday' }))).toBe(false);
    expect(isUsable(validStats({ portfolio: { weeks: [], months: [] } }))).toBe(false);
    expect(
      isUsable(
        validStats({
          portfolio: {
            weeks: [{ period: '2026-10-19', wau: 'many' }],
            months: [],
            retention: [],
          },
        })
      )
    ).toBe(false);
    expect(isUsable(validStats({ apps: { psywave: { weeks: [] } } }))).toBe(false);
  });

  it('marks a snapshot as a sample only by its note', () => {
    expect(isSample(validStats())).toBe(false);
    expect(isSample(validStats({ rules: { min_count: 10, note: 'SAMPLE DATA, not real' } }))).toBe(
      true
    );
  });

  it('marks the committed snapshot as a sample exactly when its note says so', () => {
    expect(isSample(committed)).toBe(/^SAMPLE DATA/.test(committed.rules.note));
  });

  it('keeps the committed snapshot inside its own rules', () => {
    const weeks = committed.portfolio.weeks;
    expect(weeks.length).toBeLessThanOrEqual(committed.rules.weeks);
    expect(committed.portfolio.months.length).toBeLessThanOrEqual(committed.rules.months);
    const numbers = weeks.flatMap((row) =>
      Object.entries(row)
        .filter(([key]) => key !== 'period')
        .map(([, cell]) => cell)
        .filter((cell): cell is number => typeof cell === 'number')
    );
    expect(numbers.filter((n) => n < committed.rules.min_count)).toEqual([]);
  });
});

describe('apps with data', () => {
  const series = (wau: unknown) => ({
    weeks: [{ period: '2026-10-26', wau }],
    months: [],
    retention: [],
  });

  it('counts an app with a number or a hidden value and skips one with neither', () => {
    expect(hasData(series(5))).toBe(true);
    expect(hasData(series(H))).toBe(true);
    expect(hasData(series(null))).toBe(false);
    expect(hasData({ weeks: [], months: [], retention: [] })).toBe(false);
  });

  it('ranks by newest active installs, hidden apps after, then by name', () => {
    const stats = validStats({
      apps: {
        zeta: series(H),
        beta: series(30),
        alpha: series(H),
        gamma: series(null),
        delta: series(90),
      },
    });
    expect(appsWithData(stats)).toEqual(['delta', 'beta', 'alpha', 'zeta']);
  });
});

describe('refresh', () => {
  let server: Server;
  let dir: string;
  let out: string;
  let reply: { status: number; body: string };
  let url: string;

  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'open-stats-'));
    out = path.join(dir, 'open-stats.json');
    writeFileSync(out, 'committed\n');
    reply = { status: 200, body: JSON.stringify(validStats()) };
    server = createServer((request, response) => {
      response.writeHead(reply.status, { 'content-type': 'application/json' });
      response.end(reply.body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/stats`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });

  it('replaces the committed file with a usable answer', async () => {
    await refresh(url, out);
    expect(JSON.parse(readFileSync(out, 'utf8')).generated_at).toBe('2026-10-29T12:15:00Z');
  });

  it('keeps the committed file when the endpoint does not exist yet', async () => {
    reply = { status: 404, body: '{"error":"not found"}' };
    await expect(refresh(url, out)).rejects.toThrow(/404/);
    expect(readFileSync(out, 'utf8')).toBe('committed\n');
  });

  it('keeps the committed file when the answer has the wrong shape', async () => {
    reply = { status: 200, body: '{"ok":true}' };
    await expect(refresh(url, out)).rejects.toThrow(/expected shape/);
    expect(readFileSync(out, 'utf8')).toBe('committed\n');
  });

  it('keeps the committed file when the answer is not JSON', async () => {
    reply = { status: 200, body: '<html>maintenance</html>' };
    await expect(refresh(url, out)).rejects.toThrow();
    expect(readFileSync(out, 'utf8')).toBe('committed\n');
  });

  it('refuses an answer that is itself marked as a sample', async () => {
    reply = {
      status: 200,
      body: JSON.stringify(validStats({ rules: { min_count: 10, note: 'Sample data' } })),
    };
    await expect(refresh(url, out)).rejects.toThrow(/sample/);
    expect(readFileSync(out, 'utf8')).toBe('committed\n');
  });
});
