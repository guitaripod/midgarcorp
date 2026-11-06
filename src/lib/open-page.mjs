/**
 * Pure helpers behind the /open page's hero, threshold charts, app cards and JSON excerpt. They
 * read the public stats (`open-stats.mjs` cells) and the site's own App Store facts, never
 * anything private, so the page can only say what those sources already say.
 *
 * @typedef {import('./open-stats.mjs').Cell} Cell
 * @typedef {{ period: string, [key: string]: Cell | string }} Row
 * @typedef {{ shortName: string, platforms?: string[], currentVersionReleaseDate?: string, version?: string }} StoreApp
 */

import { formatEur, isHidden, isNumber, isOpenPeriod } from './open-stats.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The order platforms are listed in; any other platform follows in the order it was seen. */
export const PLATFORM_ORDER = [
  'iPhone',
  'iPad',
  'Mac',
  'Apple TV',
  'Apple Watch',
  'Vision Pro',
  'Linux',
];

/** Whole days from an ISO timestamp to `now` (milliseconds), never below zero; null for a bad date. */
export function daysSince(iso, now) {
  const at = Date.parse(iso ?? '');
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((now - at) / DAY_MS));
}

/** A day count as words: "today", "yesterday", "3 days ago", "2 weeks ago". */
export function agoLabel(days) {
  if (days === null || days === undefined) return 'date unknown';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** Every platform the apps run on, in `PLATFORM_ORDER`, then the rest in the order first seen. */
export function platformsOf(apps) {
  const seen = [];
  for (const app of apps) {
    for (const platform of app.platforms ?? []) {
      if (!seen.includes(platform)) seen.push(platform);
    }
  }
  const known = PLATFORM_ORDER.filter((platform) => seen.includes(platform));
  return [...known, ...seen.filter((platform) => !PLATFORM_ORDER.includes(platform))];
}

/**
 * How recently the apps shipped, from each app's current App Store version date: how many apps
 * there are, how many released in the last 7 and 30 days, and the newest release.
 */
export function shipCadence(apps, now) {
  const dated = apps
    .map((app) => ({ app, days: daysSince(app.currentVersionReleaseDate, now) }))
    .filter((entry) => entry.days !== null);
  const newest = dated.reduce(
    (best, entry) => (best && best.days <= entry.days ? best : entry),
    null
  );
  return {
    total: apps.length,
    updated7: dated.filter((entry) => entry.days < 7).length,
    updated30: dated.filter((entry) => entry.days < 30).length,
    newest: newest ? { name: newest.app.shortName, days: newest.days } : null,
  };
}

/** The newest row whose period had ended when the snapshot was made, or null. */
export function latestFinished(rows, grain, generatedAt) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (!isOpenPeriod(rows[index].period, grain, generatedAt)) return rows[index];
  }
  return null;
}

/** "2026-10-26" as "Oct 26 – Nov 1": the Monday a week starts on and its Sunday. */
export function weekRange(period) {
  const start = Date.parse(`${period}T00:00:00Z`);
  if (Number.isNaN(start)) return period;
  const label = (ms) => {
    const date = new Date(ms);
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  };
  return `${label(start)} – ${label(start + 6 * DAY_MS)}`;
}

/** "2026-10-01" as "October 2026". */
export function monthName(period) {
  const [year, month] = period.split('-').map(Number);
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${names[month - 1] ?? '?'} ${year}`;
}

/** The period of the first row with a published number in any of `fields`, or null. */
export function firstPublished(rows, fields) {
  const row = rows.find((entry) => fields.some((field) => isNumber(entry[field])));
  return row ? row.period : null;
}

/**
 * The bars of a threshold chart: one per cell, drawn on a linear scale from zero. A published
 * number is a solid bar; a hidden cell ("<10") is a hatched block that fills the band under the
 * publish line, because the true value is somewhere in it; a missing cell is left empty. The band
 * never shrinks below `floorMin` units, and a published bar is always taller than the band, so the
 * line between "held back" and "published" stays readable at any scale. The scale reaches at least
 * `headroom` times the publish line, so a series that barely clears it is drawn as barely
 * clearing it and the band never fills the chart; `top` shares one scale across several charts.
 * Money is drawn with `minCount` and `floorMin` at zero: no band, no publish line. A zero or
 * negative number (a week with no sales, or only refunds) has no height; any positive number
 * stands at least `minBar` units above the band.
 *
 * @param {Cell[]} cells
 * @param {{ minCount: number, height: number, floorMin?: number, top?: number, headroom?: number, minBar?: number }} box
 */
export function thresholdBars(
  cells,
  { minCount, height, floorMin = 6, top: shared, headroom = 4, minBar = 2 }
) {
  const numbers = cells.filter(isNumber);
  const top = Math.max(minCount * headroom, shared ?? 0, ...numbers, 1);
  const scale = height / top;
  const band = Math.min(height, Math.max(minCount * scale, floorMin));
  const round = (value) => Math.round(value * 10) / 10;
  const bars = cells.map((cell, index) => {
    if (isNumber(cell)) {
      const size = cell <= 0 ? 0 : Math.min(height, Math.max(cell * scale, band + minBar));
      return { index, kind: 'value', value: cell, h: round(size), y: round(height - size) };
    }
    if (isHidden(cell)) {
      return { index, kind: 'hidden', value: cell, h: round(band), y: round(height - band) };
    }
    return { index, kind: 'none', value: null, h: 0, y: height };
  });
  return { top, band: round(band), lineY: round(height - band), bars };
}

/**
 * The opening of the public JSON as the page quotes it: the stamp, the rule, the newest `weeks`
 * portfolio rows and, when the answer has one, the head of the Apple section. The rest is elided
 * with a marker, never invented.
 */
export function statsExcerpt(stats, weeks = 2) {
  const recent = stats.portfolio.weeks.slice(-weeks);
  const body = {
    generated_at: stats.generated_at,
    rules: { min_count: stats.rules.min_count, weeks: stats.rules.weeks },
    portfolio: { weeks: recent },
  };
  if (stats.apple) {
    body.apple = {
      source: stats.apple.source,
      first_day: stats.apple.first_day,
      through: stats.apple.through,
      totals: stats.apple.totals,
      ...(stats.apple.money ? { money: stats.apple.money } : {}),
    };
  }
  let text = JSON.stringify(body, null, 2);
  const elided = stats.portfolio.weeks.length - recent.length;
  if (elided > 0) {
    text = text.replace('"weeks": [', `"weeks": [ /* ${elided} earlier weeks */`);
  }
  if (stats.apple) {
    text = text.replace('"apple": {', '"apple": { /* weeks, months and apps elided */');
  }
  return text;
}

/** "2025-11-13" as "Nov 13, 2025". */
export function formatDay(day) {
  const [year, month, date] = (day ?? '').split('-').map(Number);
  if (!year || !month || !date) return day ?? '';
  return `${MONTHS[month - 1] ?? '?'} ${date}, ${year}`;
}

/** The sum of the published numbers in a list and how many of its cells were held back. */
export function sumPublished(cells) {
  return cells.reduce(
    (acc, cell) => {
      if (isNumber(cell)) acc.total += cell;
      else if (isHidden(cell)) acc.hidden += 1;
      return acc;
    },
    { total: 0, hidden: 0 }
  );
}

/** The rows from the first one that holds any value: leading periods before a source began are dropped. */
export function trimLeading(rows) {
  const start = rows.findIndex((row) =>
    Object.entries(row).some(
      ([key, cell]) => key !== 'period' && cell !== null && cell !== undefined
    )
  );
  return start === -1 ? [] : rows.slice(start);
}

/** The index of the first row whose period is on or after `period`, or -1 when there is none. */
export function indexFrom(rows, period) {
  if (!period) return -1;
  return rows.findIndex((row) => row.period >= period);
}

/**
 * App slugs in the order the page lists them: most published Apple downloads first, then most
 * recent weekly active installs, then by name. An app with no Apple series ranks on activity alone.
 */
export function rankApps(slugs, appleApps = {}, activity = {}) {
  const downloads = (slug) =>
    sumPublished((appleApps[slug]?.weeks ?? []).map((row) => row.downloads ?? null)).total;
  const active = (slug) => {
    const rows = activity[slug]?.weeks ?? [];
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (isNumber(rows[index].wau)) return rows[index].wau;
    }
    return -1;
  };
  return [...slugs].sort(
    (a, b) => downloads(b) - downloads(a) || active(b) - active(a) || a.localeCompare(b)
  );
}

/** A sentence a screen reader gets in place of a money chart: its span, range and newest value. */
export function describeMoney(label, rows, key, unit = 'weeks') {
  const numbers = rows.map((row) => row[key]).filter(isNumber);
  if (numbers.length === 0) return `${label}: nothing published yet.`;
  const newest = numbers.at(-1);
  return `${label} over ${rows.length} ${unit}, in approximate euros: from ${formatEur(Math.min(...numbers))} to ${formatEur(Math.max(...numbers))}, ${formatEur(newest)} in the newest.`;
}

/** The sum of a money column over some rows, or undefined when none of them carries it. */
export function sumMoney(rows, key = 'proceeds_eur') {
  const numbers = rows.map((row) => row[key]).filter(isNumber);
  if (numbers.length === 0) return undefined;
  return Math.round(numbers.reduce((total, value) => total + value, 0) * 100) / 100;
}
