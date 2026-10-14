import { relativeTime } from './github-activity.mjs';

export interface ActivityRepo {
  name: string;
  fullName: string;
  url: string;
  homepageUrl: string | null;
  description: string;
  language: { name: string; color: string | null } | null;
  stars: number;
  isFork: boolean;
  pushedAt: string;
  commits7d: number;
  commits30d: number;
  commitsWindow: number;
  spark: number[];
  release: { tag: string; url: string; publishedAt: string; prerelease: boolean } | null;
}

export interface ActivitySnapshot {
  generatedAt: string;
  login: string;
  profileUrl: string;
  windowDays: number;
  focusWindow: 7 | 30;
  lastPush: string | null;
  calendar: { date: string; count: number }[];
  totals: {
    contributions7d: number;
    contributions30d: number;
    contributionsWindow: number;
    contributionsYear: number;
    activeRepos7d: number;
    activeRepos30d: number;
    streak: number;
    longestStreak: number;
  };
  repos: ActivityRepo[];
  languages: { name: string; color: string | null; commits: number; share: number }[];
}

const esc = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string
  );

const num = (n: number): string => Number(n ?? 0).toLocaleString('en-US');
const ago = (iso: string | null | undefined, now: Date): string => relativeTime(iso, now) ?? '—';
const fallbackLanguageColor = '#9198a1';

const SPARK_STEP = 5;
const SPARK_BAR = 4;
const SPARK_HEIGHT = 12;
const CELL = 10;
const STEP = 13;
const LEFT_PAD = 22;
const TOP_PAD = 12;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const muted = 'text-paper-muted dark:text-term-muted';
const faint = 'text-paper-faint dark:text-term-faint';
const text = 'text-paper-text dark:text-term-text';
const green = 'text-paper-green dark:text-term-green';
const amber = 'text-paper-amber dark:text-term-amber';
const hoverGreen = 'hover:text-paper-green dark:hover:text-term-green transition-colors';

/// Bars rather than block glyphs: JetBrains Mono has no U+2581–2588, so a text sparkline
/// fell through to whatever monospace the platform had, at whatever width it liked.
function sparkBars(counts: number[], large = false): string {
  const max = Math.max(0, ...counts);
  const bars = counts
    .map((c, i) => {
      const h =
        max === 0 || c === 0 ? 1 : Math.max(1.5, Math.round((c / max) * SPARK_HEIGHT * 2) / 2);
      return `<rect x="${i * SPARK_STEP}" y="${SPARK_HEIGHT - h}" width="${SPARK_BAR}" height="${h}" rx="0.5" />`;
    })
    .join('');
  const width = counts.length * SPARK_STEP - (SPARK_STEP - SPARK_BAR);
  return `<svg viewBox="0 0 ${width} ${SPARK_HEIGHT}" class="act-sparksvg${large ? ' act-sparksvg-lg' : ''} ${green}" fill="currentColor" role="img" aria-label="Commits per day, last ${counts.length} days">${bars}</svg>`;
}

/// Quartiles of the non-zero days, so a 90-commit outlier doesn't flatten a normal
/// 10-commit day down to the faintest shade.
function levelThresholds(calendar: ActivitySnapshot['calendar']): number[] {
  const active = calendar
    .map((d) => d.count)
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  if (!active.length) return [1, 2, 3, 4];
  const q = (p: number) => active[Math.min(active.length - 1, Math.floor(active.length * p))];
  return [q(0), q(0.25), q(0.5), q(0.75)];
}

function level(count: number, thresholds: number[]): number {
  if (count <= 0) return 0;
  let lvl = 1;
  for (let i = 1; i < thresholds.length; i++) if (count >= thresholds[i]) lvl = i + 1;
  return lvl;
}

function renderHeatmap(calendar: ActivitySnapshot['calendar']): string {
  if (!calendar.length) return '';
  const thresholds = levelThresholds(calendar);
  const firstWeekday = new Date(`${calendar[0].date}T00:00:00Z`).getUTCDay();
  const cols = Math.ceil((calendar.length + firstWeekday) / 7);
  const width = LEFT_PAD + cols * STEP;
  const height = TOP_PAD + 7 * STEP;

  const cells: string[] = [];
  const monthLabels: string[] = [];
  let lastMonth = -1;
  calendar.forEach((day, i) => {
    const slot = i + firstWeekday;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    const x = LEFT_PAD + col * STEP;
    const y = TOP_PAD + row * STEP;
    const month = Number(day.date.slice(5, 7)) - 1;
    if (row === 0 && month !== lastMonth) {
      if (lastMonth !== -1 || i === 0) {
        monthLabels.push(`<text x="${x}" y="8" class="act-hm-label">${MONTHS[month]}</text>`);
      }
      lastMonth = month;
    }
    const label = `${day.date} · ${day.count} contribution${day.count === 1 ? '' : 's'}`;
    cells.push(
      `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" class="act-c act-c${level(day.count, thresholds)}"><title>${esc(label)}</title></rect>`
    );
  });
  const dayLabels = [
    [1, 'M'],
    [3, 'W'],
    [5, 'F'],
  ]
    .map(
      ([row, label]) =>
        `<text x="0" y="${TOP_PAD + (row as number) * STEP + 8}" class="act-hm-label">${label}</text>`
    )
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Contributions per day over the last ${calendar.length} days" class="block act-heatmap">${monthLabels.join('')}${dayLabels}${cells.join('')}</svg>`;
}

function languageDot(language: ActivityRepo['language']): string {
  if (!language) return '';
  const color = language.color ?? fallbackLanguageColor;
  return `<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${esc(color)}"></span>${esc(language.name)}</span>`;
}

function renderLanguages(languages: ActivitySnapshot['languages'], windowLabel: string): string {
  if (!languages.length) return '';
  const segments = languages
    .map(
      (l) =>
        `<span class="h-full" style="width:${(l.share * 100).toFixed(2)}%;background:${esc(l.color ?? fallbackLanguageColor)}" title="${esc(l.name)} · ${num(l.commits)} commits"></span>`
    )
    .join('');
  const legend = languages
    .slice(0, 4)
    .map(
      (l) =>
        `<span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background:${esc(l.color ?? fallbackLanguageColor)}"></span>${esc(l.name)} <span class="${faint}">${Math.round(l.share * 100)}%</span></span>`
    )
    .join('');
  return `
    <div class="mt-4">
      <span class="term-label">languages · ${windowLabel}</span>
      <div class="flex h-1.5 gap-px rounded-sm overflow-hidden bg-paper-raised dark:bg-term-raised mt-1.5">${segments}</div>
      <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] ${muted}">${legend}</div>
    </div>`;
}

function statTile(value: string, label: string, accent = false): string {
  return `
    <div class="flex flex-col">
      <dt class="order-2 text-[11px] ${muted} mt-0.5 whitespace-nowrap">${label}</dt>
      <dd class="order-1 text-xl sm:text-2xl font-bold tracking-tight ${accent ? 'phosphor' : text}">${value}</dd>
    </div>`;
}

function releaseChip(repo: ActivityRepo, now: Date): string {
  if (!repo.release) return '';
  return `<a href="${esc(repo.release.url)}" target="_blank" rel="noopener noreferrer" class="${amber} ${hoverGreen} whitespace-nowrap">${esc(repo.release.tag)} · ${ago(repo.release.publishedAt, now)}</a>`;
}

function renderFocus(data: ActivitySnapshot, now: Date): string {
  const focus = data.repos[0];
  const windowLabel = data.focusWindow === 7 ? 'this week' : 'this month';
  if (!focus) {
    return `
      <p class="term-label mb-3">now building</p>
      <h1 class="text-4xl sm:text-6xl md:text-7xl font-bold mb-6 leading-[1.05] tracking-tight ${text}">
        Between<br /><span class="phosphor cursor-blink">pushes.</span>
      </h1>
      <p class="text-base sm:text-lg ${muted} max-w-2xl">
        Nothing public landed in the last 30 days. The calendar is what the quiet looks like.
      </p>`;
  }
  const commitsInWindow = data.focusWindow === 7 ? focus.commits7d : focus.commits30d;
  const chips: string[] = [];
  if (focus.language) chips.push(languageDot(focus.language));
  if (focus.stars > 0) chips.push(`<span class="${amber}">★ ${num(focus.stars)}</span>`);
  chips.push(
    `<span><strong class="${text}">${num(commitsInWindow)}</strong> commits · ${data.focusWindow}d</span>`
  );
  if (data.focusWindow === 7 && focus.commits30d > focus.commits7d) {
    chips.push(`<span><strong class="${text}">${num(focus.commits30d)}</strong> · 30d</span>`);
  }
  chips.push(`<span>pushed ${ago(focus.pushedAt, now)}</span>`);
  if (focus.release) chips.push(releaseChip(focus, now));
  return `
    <p class="term-label mb-3">now building · ${windowLabel}</p>
    <h1 class="text-4xl sm:text-6xl md:text-7xl font-bold mb-4 leading-[1.05] tracking-tight break-words">
      <a href="${esc(focus.url)}" target="_blank" rel="noopener noreferrer" class="phosphor cursor-blink hover:opacity-90 transition-opacity">${esc(focus.name)}</a>
    </h1>
    <p class="text-base sm:text-lg ${muted} leading-relaxed max-w-2xl">${esc(focus.description || 'No description yet.')}</p>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-xs ${muted}">${chips.join('')}</div>
    <div class="mt-6 flex items-end gap-3 text-xs ${faint}">
      ${sparkBars(focus.spark, true)}
      <span>${focus.spark.length}d</span>
    </div>`;
}

function renderCalendarPanel(data: ActivitySnapshot, now: Date): string {
  const t = data.totals;
  const windowLabel = data.focusWindow === 7 ? '7d' : '30d';
  const weeks = Math.round(data.windowDays / 7);
  return `
    <div class="term-frame p-4 sm:p-5">
      <div class="flex items-baseline justify-between gap-3 mb-3">
        <p class="prompt-line truncate">git log --since=${weeks}.weeks</p>
        <span class="text-[11px] ${faint} whitespace-nowrap">${num(t.contributionsWindow)} total</span>
      </div>
      ${renderHeatmap(data.calendar)}
      <dl class="flex flex-wrap justify-between gap-x-6 gap-y-3 mt-4">
        ${statTile(`${num(t.streak)}d`, 'streak', true)}
        ${statTile(num(t.contributions30d), 'contributions · 30d')}
        ${statTile(num(t.activeRepos30d), 'repos · 30d')}
      </dl>
      ${renderLanguages(data.languages, windowLabel)}
      <p class="mt-4 text-[10px] ${faint}">counts include private work · repos shown are public · synced ${ago(data.generatedAt, now)}</p>
    </div>`;
}

function renderBench(data: ActivitySnapshot, now: Date): string {
  const rows = data.repos.slice(1);
  if (!rows.length) return '';
  const key = data.focusWindow === 7 ? 'commits7d' : 'commits30d';
  const cells = rows
    .map(
      (repo) => `
      <li class="min-w-0">
        <a href="${esc(repo.url)}" target="_blank" rel="noopener noreferrer" class="group/row block py-2.5 sm:py-3 border-t border-paper-border dark:border-term-border">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${esc(repo.language?.color ?? fallbackLanguageColor)}" title="${esc(repo.language?.name ?? '')}"></span>
            <span class="text-sm font-semibold ${text} truncate group-hover/row:text-paper-green dark:group-hover/row:text-term-green transition-colors" title="${esc(repo.name)}">${esc(repo.name)}</span>
            ${repo.release ? `<span class="text-[11px] ${amber} whitespace-nowrap" title="released ${ago(repo.release.publishedAt, now)}">${esc(repo.release.tag)}</span>` : ''}
            <span class="text-xs ${muted} whitespace-nowrap ml-auto pl-2"><strong class="${text}">${num(repo[key])}</strong> · ${data.focusWindow}d</span>
          </div>
          <div class="flex items-center gap-3 pl-[18px] mt-1.5 text-[11px] ${faint}">
            ${sparkBars(repo.spark)}
            <span class="whitespace-nowrap">pushed ${ago(repo.pushedAt, now)}</span>
          </div>
        </a>
      </li>`
    )
    .join('');
  const active = data.totals[data.focusWindow === 7 ? 'activeRepos7d' : 'activeRepos30d'];
  return `
    <div class="term-frame px-4 sm:px-5 pt-4 sm:pt-5 pb-1">
      <div class="flex items-baseline justify-between gap-3 mb-1">
        <p class="prompt-line truncate">ls ~/bench --sort=commits</p>
        <span class="text-[11px] ${faint} whitespace-nowrap">${num(active)} active · ${data.focusWindow}d</span>
      </div>
      <ul class="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">${cells}</ul>
    </div>`;
}

export function renderActivityBoard(data: ActivitySnapshot, now: Date): string {
  const lastPush = data.lastPush ? ago(data.lastPush, now) : null;
  return `
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-6">
      <p class="prompt-line">tail -f ~/activity.log</p>
      ${
        lastPush
          ? `<a href="${esc(data.profileUrl)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-xs text-paper-greendim dark:text-term-greendim ${hoverGreen}">
              <span class="relative flex w-1.5 h-1.5">
                <span class="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-paper-green dark:bg-term-green opacity-75"></span>
                <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-paper-green dark:bg-term-green"></span>
              </span>
              last push ${lastPush} · @${esc(data.login)}
            </a>`
          : ''
      }
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div class="lg:col-span-7 min-w-0">
        ${renderFocus(data, now)}
        <div class="mt-8">${renderBench(data, now)}</div>
      </div>
      <div class="lg:col-span-5 min-w-0">${renderCalendarPanel(data, now)}</div>
    </div>`;
}
