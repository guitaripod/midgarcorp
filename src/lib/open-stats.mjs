/**
 * Midgar's public numbers: the snapshot behind /open and the pure functions that read it.
 *
 * `src/data/open-stats.json` is the body of `STATS_URL`, written by `scripts/fetch-open-stats.mjs`
 * at build time; the page, the fetch script and the tests share these functions so a hidden or
 * missing value is handled the same way everywhere.
 *
 * @typedef {number | string | null} Cell A count or ratio, a hidden-count marker such as "<10", or null when it does not exist yet.
 * @typedef {{ period: string, [key: string]: Cell | string }} Row
 * @typedef {{ weeks: Row[], months: Row[], retention: { cohort: string, w1: Cell, w4: Cell }[] }} Series
 * @typedef {{ id: string, title: string, unit: string, caveat: string }} PublicMetric
 * @typedef {{ generated_at: string, rules: { min_count: number, weeks: number, months: number, note: string }, portfolio: Series, apps: Record<string, Series>, metrics: PublicMetric[] }} OpenStats
 */

export const STATS_URL = 'https://api.midgarcorp.cc/v1/ops/public/stats';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** True for a cell the API hid because too few installs were behind it, such as "<10". */
export function isHidden(cell) {
  return typeof cell === 'string' && cell.startsWith('<');
}

/** True for a cell that carries a number. */
export function isNumber(cell) {
  return typeof cell === 'number' && Number.isFinite(cell);
}

/** True for a cell that exists, whether it shows a number or is hidden. */
export function hasValue(cell) {
  return isNumber(cell) || isHidden(cell);
}

const isCell = (value) => value === null || isNumber(value) || isHidden(value);

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function rowsAreValid(rows, keyOf) {
  return (
    Array.isArray(rows) &&
    rows.every(
      (row) =>
        isRecord(row) &&
        typeof row[keyOf] === 'string' &&
        Object.entries(row).every(([key, value]) => key === keyOf || isCell(value))
    )
  );
}

function seriesIsValid(series) {
  return (
    isRecord(series) &&
    rowsAreValid(series.weeks, 'period') &&
    rowsAreValid(series.months, 'period') &&
    rowsAreValid(series.retention, 'cohort')
  );
}

/**
 * True when a fetched body has the shape the page reads. A failed or half-written answer must
 * never replace the committed snapshot, so every list and cell is checked.
 */
export function isUsable(stats) {
  return (
    isRecord(stats) &&
    typeof stats.generated_at === 'string' &&
    !Number.isNaN(Date.parse(stats.generated_at)) &&
    isRecord(stats.rules) &&
    isNumber(stats.rules.min_count) &&
    seriesIsValid(stats.portfolio) &&
    isRecord(stats.apps) &&
    Object.values(stats.apps).every(seriesIsValid) &&
    Array.isArray(stats.metrics) &&
    stats.metrics.every((metric) => isRecord(metric) && typeof metric.id === 'string')
  );
}

/** True while the committed snapshot is the hand-made sample, which marks itself in `rules.note`. */
export function isSample(stats) {
  return /^sample\b/i.test(stats?.rules?.note ?? '');
}

/** One column of a list as cells, with a missing key read as "not yet". */
export function seriesOf(rows, key) {
  return rows.map((row) => (row[key] === undefined ? null : row[key]));
}

/** The newest row whose cell exists, as `{ period, cell, index }`, or null when none does. */
export function latestOf(rows, key) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const cell = rows[index][key];
    if (hasValue(cell)) return { period: rows[index].period, cell, index };
  }
  return null;
}

/** True when the period that starts on `period` had not ended yet when the snapshot was made. */
export function isOpenPeriod(period, grain, generatedAt) {
  const start = Date.parse(`${period}T00:00:00Z`);
  if (Number.isNaN(start)) return false;
  const begin = new Date(start);
  const end =
    grain === 'month'
      ? Date.UTC(begin.getUTCFullYear(), begin.getUTCMonth() + 1, 1)
      : start + 7 * DAY_MS;
  return Date.parse(generatedAt) < end;
}

/** A count with thousands separators, a hidden marker as sent, or a dash for "not yet". */
export function formatCell(cell) {
  if (isNumber(cell)) return cell.toLocaleString('en-US');
  if (isHidden(cell)) return cell;
  return '–';
}

/** A retention share as a whole percentage, a hidden marker as sent, or a dash for "not yet". */
export function formatShare(cell) {
  if (isNumber(cell)) return `${Math.round(cell * 100)}%`;
  if (isHidden(cell)) return cell;
  return '–';
}

/** "2026-10-26" as "Oct 26". */
export function formatWeek(period) {
  const [, month, day] = period.split('-').map(Number);
  return `${MONTHS[month - 1] ?? '?'} ${day}`;
}

/** "2026-10-01" as "Oct 2026". */
export function formatMonth(period) {
  const [year, month] = period.split('-').map(Number);
  return `${MONTHS[month - 1] ?? '?'} ${year}`;
}

/** An ISO timestamp as "2026-10-29 14:00 UTC". */
export function formatStamp(iso) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** True when an app has at least one number or hidden value anywhere in its lists. */
export function hasData(series) {
  const rows = [...series.weeks, ...series.months];
  const cells = rows.flatMap((row) => Object.entries(row).filter(([key]) => key !== 'period'));
  const shares = series.retention.flatMap((row) => [row.w1, row.w4]);
  return [...cells.map(([, cell]) => cell), ...shares].some(hasValue);
}

/** True when every cell of a list is hidden or missing, so there is nothing to draw. */
export function allHidden(cells) {
  return !cells.some(isNumber);
}

/**
 * Registry slugs of the apps with data, the most active first. An app is ranked by its newest
 * weekly active installs; apps whose numbers are all hidden follow, then the rest by name.
 */
export function appsWithData(stats) {
  const entries = Object.entries(stats.apps).filter(([, series]) => hasData(series));
  const level = ([, series]) => {
    const latest = latestOf(series.weeks, 'wau');
    return latest && isNumber(latest.cell) ? latest.cell : -1;
  };
  return entries
    .sort((a, b) => level(b) - level(a) || a[0].localeCompare(b[0]))
    .map(([slug]) => slug);
}

/**
 * The drawing of a sparkline for a list of cells. Numbers join into line segments; a hidden week
 * is a mark on the floor (somewhere under the threshold) and breaks the line; a missing week is
 * left out. `last` is the point to emphasise: the newest number.
 *
 * @param {Cell[]} cells
 * @param {{ width: number, height: number, pad?: number }} box
 */
export function sparkline(cells, { width, height, pad = 3 }) {
  const numbers = cells.filter(isNumber);
  const top = Math.max(1, ...numbers);
  const floor = height - pad;
  const span = Math.max(1, cells.length - 1);
  const xAt = (index) =>
    cells.length === 1 ? width / 2 : pad + (index / span) * (width - 2 * pad);
  const yAt = (value) => floor - (value / top) * (height - 2 * pad);
  const round = (value) => Math.round(value * 10) / 10;

  const points = cells.map((cell, index) => ({
    index,
    x: round(xAt(index)),
    y: isNumber(cell) ? round(yAt(cell)) : floor,
    kind: isNumber(cell) ? 'value' : isHidden(cell) ? 'hidden' : 'none',
  }));

  const segments = [];
  let run = [];
  for (const point of points) {
    if (point.kind === 'value') {
      run.push(point);
    } else {
      if (run.length) segments.push(run);
      run = [];
    }
  }
  if (run.length) segments.push(run);

  const paths = segments.map((segment) =>
    segment.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
  );
  const lastValue = [...points].reverse().find((point) => point.kind === 'value') ?? null;
  return {
    points,
    paths,
    floor: round(floor),
    top,
    last: lastValue,
    hidden: points.filter((point) => point.kind === 'hidden'),
  };
}

/** A sentence a screen reader gets in place of a sparkline. */
export function describeSeries(label, rows, key, unit = 'weeks') {
  const cells = seriesOf(rows, key);
  const numbers = cells.filter(isNumber);
  const hidden = cells.filter(isHidden).length;
  if (numbers.length === 0) {
    return `${label}: too few to show in any of the last ${cells.length} ${unit}.`;
  }
  const parts = [
    `${label}: ${numbers.length} of ${cells.length} ${unit} shown`,
    `from ${formatCell(Math.min(...numbers))} to ${formatCell(Math.max(...numbers))}`,
  ];
  if (hidden > 0) parts.push(`${hidden} hidden for being too small`);
  return `${parts.join(', ')}.`;
}
