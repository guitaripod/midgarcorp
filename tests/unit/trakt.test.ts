import { describe, it, expect } from 'vitest';
import {
  describeItem,
  episodeCode,
  heroState,
  imageURL,
  itemCount,
  nowWatching,
  recentPlays,
  summarize,
  timeAgo,
  topTitle,
  watchProgress,
  type RawTraktItem,
} from '../../src/lib/trakt';

const NOW = new Date('2026-11-13T20:30:00Z');

const southPark = {
  title: 'South Park',
  year: 1997,
  ids: { trakt: 2177 },
  images: { poster: ['media.trakt.tv/shows/2177/medium/poster.webp'] },
};

const office = {
  title: 'The Office',
  year: 2005,
  ids: { trakt: 2302 },
  images: { poster: ['media.trakt.tv/shows/2302/medium/poster.webp'] },
};

const episode = (
  show: typeof southPark,
  season: number,
  number: number,
  at: string,
  title = 'Ep'
): RawTraktItem => ({
  type: 'episode',
  watched_at: at,
  episode: {
    season,
    number,
    title,
    images: { screenshot: [`media.trakt.tv/episodes/${season}${number}/medium/screenshot.webp`] },
  },
  show,
});

const movie = (title: string, id: number, at: string): RawTraktItem => ({
  type: 'movie',
  watched_at: at,
  movie: {
    title,
    year: 2024,
    ids: { trakt: id },
    images: { poster: [], fanart: [`media.trakt.tv/movies/${id}/medium/fanart.webp`] },
  },
});

describe('imageURL', () => {
  it('gives Trakt media paths an https scheme', () => {
    expect(imageURL('media.trakt.tv/shows/2177/medium/poster.webp')).toBe(
      'https://media.trakt.tv/shows/2177/medium/poster.webp'
    );
  });

  it('upgrades http, keeps https and drops empty paths', () => {
    expect(imageURL('http://media.trakt.tv/a.webp')).toBe('https://media.trakt.tv/a.webp');
    expect(imageURL('https://media.trakt.tv/a.webp')).toBe('https://media.trakt.tv/a.webp');
    expect(imageURL('')).toBeNull();
    expect(imageURL(undefined)).toBeNull();
  });
});

describe('describeItem', () => {
  it('names an episode by its show, code and title', () => {
    expect(describeItem(episode(southPark, 3, 11, '2026-11-11T20:55:00Z', 'Chinpokomon'))).toEqual({
      kind: 'episode',
      title: 'South Park',
      detail: 'S03E11 · Chinpokomon',
      poster: 'https://media.trakt.tv/shows/2177/medium/poster.webp',
      still: 'https://media.trakt.tv/episodes/311/medium/screenshot.webp',
    });
  });

  it('names a movie by its year, takes its fanart as the still and tolerates a missing poster', () => {
    expect(describeItem(movie('Dune', 1, '2026-11-10T00:00:00Z'))).toEqual({
      kind: 'movie',
      title: 'Dune',
      detail: '2024',
      poster: null,
      still: 'https://media.trakt.tv/movies/1/medium/fanart.webp',
    });
  });

  it("falls back to the show's fanart when an episode has no screenshot", () => {
    const item: RawTraktItem = {
      type: 'episode',
      watched_at: '2026-11-10T00:00:00Z',
      episode: { season: 1, number: 1, title: 'Pilot' },
      show: {
        ...office,
        images: { ...office.images, fanart: ['media.trakt.tv/shows/2302/medium/fanart.webp'] },
      },
    };
    expect(describeItem(item)?.still).toBe('https://media.trakt.tv/shows/2302/medium/fanart.webp');
  });

  it('skips items it cannot name', () => {
    expect(describeItem({ type: 'episode', episode: { season: 1, number: 1 } })).toBeNull();
  });

  it('pads episode codes', () => {
    expect(episodeCode(1, 2)).toBe('S01E02');
    expect(episodeCode(12, 104)).toBe('S12E104');
    expect(episodeCode(undefined, 2)).toBeNull();
  });
});

describe('nowWatching', () => {
  it('keeps the scrobble window', () => {
    const now = nowWatching({
      type: 'episode',
      started_at: '2026-11-13T20:22:33Z',
      expires_at: '2026-11-13T20:44:33Z',
      episode: { season: 1, number: 2, title: 'Diversity Day' },
      show: office,
    });
    expect(now?.title).toBe('The Office');
    expect(now?.detail).toBe('S01E02 · Diversity Day');
    expect(now?.startedAt).toBe('2026-11-13T20:22:33Z');
  });

  it('is null when nothing plays', () => {
    expect(nowWatching(null)).toBeNull();
    expect(nowWatching({ type: 'episode', show: office })).toBeNull();
  });
});

describe('recentPlays', () => {
  const history = [
    episode(southPark, 3, 11, '2026-11-11T20:55:00Z'),
    episode(southPark, 3, 11, '2026-11-11T20:54:00Z'),
    episode(southPark, 3, 10, '2026-11-11T20:30:00Z'),
    movie('Dune', 1, '2026-11-10T22:00:00Z'),
    episode(office, 1, 1, '2026-11-10T20:00:00Z'),
    { type: 'episode', watched_at: '2026-11-10T19:00:00Z' },
    episode(southPark, 3, 9, '2026-11-09T20:00:00Z'),
    movie('Heat', 2, '2026-11-08T20:00:00Z'),
  ];

  it('keeps every episode of a binge in order and shows a doubled play once', () => {
    const rows = recentPlays(history, 6);
    expect(rows.map((r) => `${r.title} ${r.detail}`)).toEqual([
      'South Park S03E11 · Ep',
      'South Park S03E10 · Ep',
      'Dune 2024',
      'The Office S01E01 · Ep',
      'South Park S03E09 · Ep',
      'Heat 2024',
    ]);
    expect(rows[0].watchedAt).toBe('2026-11-11T20:55:00Z');
  });

  it('stops at the limit', () => {
    expect(recentPlays(history, 2).map((r) => r.detail)).toEqual(['S03E11 · Ep', 'S03E10 · Ep']);
  });

  it('tells two movies with one name apart by their Trakt id', () => {
    const rows = recentPlays(
      [movie('Dune', 1, '2026-11-10T00:00:00Z'), movie('Dune', 3, '2026-11-09T00:00:00Z')],
      6
    );
    expect(rows).toHaveLength(2);
  });
});

describe('topTitle', () => {
  it('picks the most played title and lets the newest win a tie', () => {
    expect(
      topTitle([
        movie('Dune', 1, '2026-11-12T00:00:00Z'),
        episode(office, 1, 2, '2026-11-11T00:00:00Z'),
        episode(office, 1, 1, '2026-11-10T00:00:00Z'),
      ])
    ).toEqual({ title: 'The Office', plays: 2 });
    expect(
      topTitle([movie('Dune', 1, '2026-11-12T00:00:00Z'), movie('Heat', 2, '2026-11-11T00:00:00Z')])
    ).toEqual({ title: 'Dune', plays: 1 });
    expect(topTitle([])).toBeNull();
  });
});

describe('itemCount', () => {
  it('reads the pagination header', () => {
    expect(itemCount('9466')).toBe(9466);
    expect(itemCount('0')).toBe(0);
    expect(itemCount(null)).toBeNull();
    expect(itemCount('')).toBeNull();
    expect(itemCount('nope')).toBeNull();
  });
});

describe('summarize', () => {
  it('falls back to the week page length when the count header is missing', () => {
    const week = [episode(office, 1, 1, '2026-11-12T00:00:00Z')];
    const summary = summarize({
      watching: null,
      history: week,
      week,
      totalPlays: 10,
      weekPlays: null,
      recentLimit: 6,
    });
    expect(summary.weekPlays).toBe(1);
    expect(summary.watching).toBeNull();
    expect(summary.topOfWeek).toEqual({ title: 'The Office', plays: 1 });
  });
});

describe('watchProgress', () => {
  it('measures the scrobble window and clamps', () => {
    expect(watchProgress('2026-11-13T20:20:00Z', '2026-11-13T20:40:00Z', NOW)).toBeCloseTo(0.5, 6);
    expect(watchProgress('2026-11-13T21:00:00Z', '2026-11-13T21:20:00Z', NOW)).toBe(0);
    expect(watchProgress('2026-11-13T19:00:00Z', '2026-11-13T19:20:00Z', NOW)).toBe(1);
    expect(watchProgress('bad', '2026-11-13T19:20:00Z', NOW)).toBe(0);
  });
});

describe('timeAgo', () => {
  it('speaks like the other live cards', () => {
    expect(timeAgo('2026-11-13T20:29:45Z', NOW)).toBe('just now');
    expect(timeAgo('2026-11-13T19:30:00Z', NOW)).toBe('1 hour ago');
    expect(timeAgo('2026-11-11T20:30:00Z', NOW)).toBe('2 days ago');
    expect(timeAgo('nope', NOW)).toBe('');
  });
});

describe('heroState', () => {
  const watching = {
    kind: 'episode' as const,
    title: 'The Office',
    detail: 'S01E02 · Diversity Day',
    poster: null,
    still: null,
    startedAt: '2026-11-13T20:20:00Z',
    expiresAt: '2026-11-13T20:40:00Z',
  };
  const recent = [{ ...watching, title: 'South Park', watchedAt: '2026-11-11T20:30:00Z' }];
  const base = { totalPlays: 1, weekPlays: 1, topOfWeek: null };

  it('shows a live scrobble with its progress', () => {
    const state = heroState({ ...base, watching, recent }, NOW);
    expect(state.live).toBe(true);
    expect(state.label).toBe('Watching now');
    expect(state.progress).toBeCloseTo(0.5, 6);
    expect(state.title?.title).toBe('The Office');
  });

  it('calls a scrobble past its window just watched, without a bar', () => {
    const state = heroState({ ...base, watching, recent }, new Date('2026-11-13T20:41:00Z'));
    expect(state).toMatchObject({ live: false, label: 'Just watched', progress: null });
    expect(state.title?.title).toBe('The Office');
  });

  it('falls back to the newest play, then to nothing', () => {
    expect(heroState({ ...base, watching: null, recent }, NOW).label).toBe(
      'Last watched · 2 days ago'
    );
    expect(heroState({ ...base, watching: null, recent: [] }, NOW)).toMatchObject({
      title: null,
      label: 'Nothing watched yet',
    });
  });
});
