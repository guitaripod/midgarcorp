export const DAY_MS = 86_400_000;

/// What an app or repo is worth showing: commits and releases carry the weight, stars barely
/// count, and a release in the last year earns a small recency bonus. One formula ranks the
/// Linux page, the open-source page, the apps page and the homepage.
const SCORE_WEIGHTS = { commits: 2, releases: 2.5, stars: 0.4 };
const RECENCY_BONUS: { withinDays: number; bonus: number }[] = [
  { withinDays: 90, bonus: 1.5 },
  { withinDays: 365, bonus: 0.75 },
];

export interface WorkInput {
  commitCount?: number;
  releaseCount?: number;
  stars?: number;
  latestDate?: string | null;
}

export function workScore(input: WorkInput, now: Date = new Date()): number {
  const base =
    SCORE_WEIGHTS.commits * Math.log(1 + (input.commitCount ?? 0)) +
    SCORE_WEIGHTS.releases * Math.log(1 + (input.releaseCount ?? 0)) +
    SCORE_WEIGHTS.stars * Math.log(1 + (input.stars ?? 0));
  if (!input.latestDate) return base;
  const age = (now.getTime() - new Date(input.latestDate).getTime()) / DAY_MS;
  const recent = RECENCY_BONUS.find((tier) => age <= tier.withinDays);
  return base + (recent?.bonus ?? 0);
}

export const LANGUAGE_COLORS: Record<string, string> = {
  Rust: '#CE422B',
  Go: '#00ADD8',
  'C++': '#F34B7D',
  Swift: '#F05138',
  Python: '#3572A5',
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  Astro: '#FF5D01',
  Lua: '#5B5BD6',
  Kotlin: '#A97BFF',
  C: '#9198A1',
};

const FALLBACK_LANGUAGE_COLOR = '#7d8590';

export const languageColor = (language: string): string =>
  LANGUAGE_COLORS[language] ?? FALLBACK_LANGUAGE_COLOR;

/// A bar's fill as a share of the largest value, on a square-root scale so one giant repo
/// does not flatten everything else, with a floor so any non-zero value stays visible.
export function barFraction(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(0.04, Math.min(1, Math.sqrt(value / max)));
}

export type Freshness = 'fresh' | 'steady' | 'quiet';

const FRESH_DAYS = 90;
const STEADY_DAYS = 365;

const daysSince = (iso: string, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS));

export function freshness(iso: string | null, now: Date): Freshness {
  if (!iso) return 'quiet';
  const days = daysSince(iso, now);
  if (days <= FRESH_DAYS) return 'fresh';
  return days <= STEADY_DAYS ? 'steady' : 'quiet';
}

export const FRESHNESS_STYLE: Record<Freshness, { dot: string; text: string; title: string }> = {
  fresh: {
    dot: 'bg-paper-green dark:bg-term-green',
    text: 'text-paper-green dark:text-term-green',
    title: 'Released in the last 90 days',
  },
  steady: {
    dot: 'bg-paper-amber dark:bg-term-amber',
    text: 'text-paper-amber dark:text-term-amber',
    title: 'Released in the last year',
  },
  quiet: {
    dot: 'bg-paper-border2 dark:bg-term-border2',
    text: 'text-paper-muted dark:text-term-faint',
    title: 'No release in over a year',
  },
};

export function ageLabel(iso: string | null, now: Date): string {
  if (!iso) return 'no releases';
  const days = daysSince(iso, now);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30.44)} mo ago`;
  return `${Math.floor(days / 365.25)} yr ago`;
}
