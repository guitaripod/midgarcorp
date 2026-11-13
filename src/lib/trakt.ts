export const TRAKT_USER = 'guitaripod';

/** One play as the links page shows it: an episode under its show's name, or a movie with its year. */
export interface TraktTitle {
  kind: 'episode' | 'movie';
  title: string;
  detail: string | null;
  poster: string | null;
  still: string | null;
}

/** What is playing right now, with the window Trakt keeps the scrobble open for. */
export interface TraktNow extends TraktTitle {
  startedAt: string;
  expiresAt: string;
}

/** A finished play from the history. */
export interface TraktRecent extends TraktTitle {
  watchedAt: string;
}

export interface TraktSummary {
  watching: TraktNow | null;
  recent: TraktRecent[];
  totalPlays: number | null;
  weekPlays: number | null;
  topOfWeek: { title: string; plays: number } | null;
}

interface RawImages {
  poster?: string[];
  fanart?: string[];
  thumb?: string[];
  screenshot?: string[];
}

interface RawMedia {
  title?: string;
  year?: number | null;
  ids?: { trakt?: number };
  images?: RawImages;
}

interface RawEpisode {
  title?: string | null;
  season?: number;
  number?: number;
  images?: RawImages;
}

export interface RawTraktItem {
  type?: string;
  watched_at?: string;
  started_at?: string;
  expires_at?: string;
  episode?: RawEpisode;
  show?: RawMedia;
  movie?: RawMedia;
}

/** Trakt's media paths come without a scheme ("media.trakt.tv/shows/…/poster.webp"); the page needs a full https URL. */
export function imageURL(path: string | undefined | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//.test(trimmed)) return trimmed.replace(/^http:/, 'https:');
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

/** "S03E11", the way episode lists name an episode. */
export function episodeCode(season: number | undefined, number: number | undefined): string | null {
  if (season === undefined || number === undefined) return null;
  return `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`;
}

/** The media an item is about and the key that groups its plays: the show for an episode, the movie itself otherwise. */
function subject(
  item: RawTraktItem
): { key: string; media: RawMedia; kind: TraktTitle['kind'] } | null {
  if (item.type === 'episode' && item.show?.title) {
    return {
      key: `show:${item.show.ids?.trakt ?? item.show.title}`,
      media: item.show,
      kind: 'episode',
    };
  }
  if (item.type === 'movie' && item.movie?.title) {
    return {
      key: `movie:${item.movie.ids?.trakt ?? item.movie.title}`,
      media: item.movie,
      kind: 'movie',
    };
  }
  return null;
}

export function describeItem(item: RawTraktItem): TraktTitle | null {
  const found = subject(item);
  if (!found) return null;
  const images = found.media.images;
  const poster = imageURL(images?.poster?.[0]);
  const backdrop = imageURL(images?.fanart?.[0]) ?? imageURL(images?.thumb?.[0]);
  if (found.kind === 'movie') {
    return {
      kind: 'movie',
      title: found.media.title!,
      detail: found.media.year ? String(found.media.year) : null,
      poster,
      still: backdrop,
    };
  }
  const code = episodeCode(item.episode?.season, item.episode?.number);
  const name = item.episode?.title?.trim();
  const detail = [code, name].filter(Boolean).join(' · ') || null;
  const still = imageURL(item.episode?.images?.screenshot?.[0]) ?? backdrop;
  return { kind: 'episode', title: found.media.title!, detail, poster, still };
}

export function nowWatching(item: RawTraktItem | null | undefined): TraktNow | null {
  if (!item?.started_at || !item.expires_at) return null;
  const title = describeItem(item);
  return title ? { ...title, startedAt: item.started_at, expiresAt: item.expires_at } : null;
}

/**
 * The newest plays, one per episode or movie: a binge stays a run of distinct episodes, each with its own still,
 * while a play Trakt recorded twice (a rewatch, or two apps scrobbling the same episode) shows once.
 */
export function recentPlays(history: RawTraktItem[], limit: number): TraktRecent[] {
  const rows: TraktRecent[] = [];
  const seen = new Set<string>();
  for (const item of history) {
    if (rows.length >= limit) break;
    const found = subject(item);
    if (!found || !item.watched_at) continue;
    const key = `${found.key}:${item.episode?.season ?? ''}x${item.episode?.number ?? ''}`;
    if (seen.has(key)) continue;
    const title = describeItem(item);
    if (!title) continue;
    seen.add(key);
    rows.push({ ...title, watchedAt: item.watched_at });
  }
  return rows;
}

/** The show or movie played most in a window of history; ties go to the one played most recently. */
export function topTitle(history: RawTraktItem[]): { title: string; plays: number } | null {
  const counts = new Map<string, { title: string; plays: number }>();
  for (const item of history) {
    const found = subject(item);
    if (!found) continue;
    const entry = counts.get(found.key) ?? { title: found.media.title!, plays: 0 };
    entry.plays += 1;
    counts.set(found.key, entry);
  }
  let best: { title: string; plays: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.plays > best.plays) best = entry;
  }
  return best;
}

/** Reads Trakt's X-Pagination-Item-Count, the size of the whole list a page came from. */
export function itemCount(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

export function summarize(input: {
  watching: RawTraktItem | null;
  history: RawTraktItem[];
  week: RawTraktItem[];
  totalPlays: number | null;
  weekPlays: number | null;
  recentLimit: number;
}): TraktSummary {
  return {
    watching: nowWatching(input.watching),
    recent: recentPlays(input.history, input.recentLimit),
    totalPlays: input.totalPlays,
    weekPlays: input.weekPlays ?? input.week.length,
    topOfWeek: topTitle(input.week),
  };
}

/** How far into the scrobble window "now" is, from 0 to 1. */
export function watchProgress(startedAt: string, expiresAt: string, now: Date): number {
  const start = Date.parse(startedAt);
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

/** "2 days ago", the way the other live cards on the links page say it. */
export function timeAgo(iso: string, now: Date): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const seconds = Math.floor((now.getTime() - then) / 1000);
  const units: [string, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, size] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) return count === 1 ? `1 ${name} ago` : `${count} ${name}s ago`;
  }
  return 'just now';
}

/** What the card's lead line says and shows: the live scrobble, one that just ran out, or the newest finished play. */
export interface TraktHero {
  title: TraktTitle | null;
  label: string;
  live: boolean;
  progress: number | null;
}

/**
 * A scrobble stays in Trakt's watching answer (and its cache) a little past its estimated end, so one whose window has
 * closed reads as just watched instead of a full bar that claims it is still playing.
 */
export function heroState(summary: TraktSummary, now: Date): TraktHero {
  const watching = summary.watching;
  if (watching) {
    const ended = Date.parse(watching.expiresAt) <= now.getTime();
    if (!ended) {
      return {
        title: watching,
        label: 'Watching now',
        live: true,
        progress: watchProgress(watching.startedAt, watching.expiresAt, now),
      };
    }
    return { title: watching, label: 'Just watched', live: false, progress: null };
  }
  const last = summary.recent[0];
  if (last) {
    return {
      title: last,
      label: `Last watched · ${timeAgo(last.watchedAt, now)}`,
      live: false,
      progress: null,
    };
  }
  return { title: null, label: 'Nothing watched yet', live: false, progress: null };
}
