import { describe, it, expect } from 'vitest';
import {
  buildCalendar,
  computeStreak,
  rankRepos,
  pickFocusWindow,
  relativeTime,
  sumSince,
} from '../../src/lib/github-activity.mjs';
import { renderActivityBoard, repoLink, type ActivitySnapshot } from '../../src/lib/activity-board';
import snapshot from '../../src/data/github-activity.json';

const now = new Date('2026-09-11T12:00:00Z');

describe('github activity calendar', () => {
  it('builds one entry per day ending today, oldest first', () => {
    const counts = new Map([
      ['2026-09-11', 3],
      ['2026-09-09', 1],
    ]);
    const cal = buildCalendar(counts, now, 4);
    expect(cal.map((d) => d.date)).toEqual([
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
    ]);
    expect(cal.map((d) => d.count)).toEqual([0, 1, 0, 3]);
  });

  it('counts a streak through today', () => {
    const cal = [0, 2, 1, 4].map((count, i) => ({ date: `d${i}`, count }));
    expect(computeStreak(cal)).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the streak alive when today is still empty', () => {
    const cal = [1, 1, 0, 1, 1, 0].map((count, i) => ({ date: `d${i}`, count }));
    expect(computeStreak(cal)).toEqual({ current: 2, longest: 2 });
  });

  it('breaks the streak after a full day off', () => {
    const cal = [1, 1, 0, 0].map((count, i) => ({ date: `d${i}`, count }));
    expect(computeStreak(cal).current).toBe(0);
  });

  it('sums only days on or after the cutoff', () => {
    const days = new Map([
      ['2026-09-01', 5],
      ['2026-09-05', 2],
      ['2026-09-11', 1],
    ]);
    expect(sumSince(days, '2026-09-05')).toBe(3);
  });
});

describe('repo ranking', () => {
  const repos = [
    { name: 'a', commits7d: 2, commits30d: 40, pushedAt: '2026-09-01T00:00:00Z' },
    { name: 'b', commits7d: 9, commits30d: 12, pushedAt: '2026-09-10T00:00:00Z' },
    { name: 'c', commits7d: 9, commits30d: 30, pushedAt: '2026-09-11T00:00:00Z' },
  ];

  it('leads with the week and breaks ties by latest push', () => {
    expect(rankRepos(repos, 7).map((r) => r.name)).toEqual(['c', 'b', 'a']);
  });

  it('falls back to the month when the week is quiet', () => {
    const quiet = repos.map((r) => ({ ...r, commits7d: 0 }));
    expect(pickFocusWindow(quiet)).toBe(30);
    expect(rankRepos(quiet, 30).map((r) => r.name)).toEqual(['a', 'c', 'b']);
  });
});

describe('relative time', () => {
  it('uses compact units', () => {
    expect(relativeTime('2026-09-11T11:58:30Z', now)).toBe('1m ago');
    expect(relativeTime('2026-09-11T09:00:00Z', now)).toBe('3h ago');
    expect(relativeTime('2026-09-01T12:00:00Z', now)).toBe('1w ago');
    expect(relativeTime(null, now)).toBeNull();
  });
});

describe('activity board renderer', () => {
  const data = snapshot as ActivitySnapshot;

  it('renders the committed snapshot with the focus repo as the h1', () => {
    const html = renderActivityBoard(data, now);
    expect(html).toContain('<h1');
    expect(html).toContain(data.repos[0].name);
    expect(html).toContain('act-heatmap');
    const sparkRects = data.repos.reduce((n, r) => n + r.spark.length, 0);
    expect((html.match(/<rect /g) ?? []).length).toBe(data.calendar.length + sparkRects);
  });

  it('escapes everything that came from GitHub', () => {
    const hostile: ActivitySnapshot = {
      ...data,
      repos: [
        {
          ...data.repos[0],
          name: '<img src=x onerror=alert(1)>',
          description: '"><script>alert(2)</script>',
        },
        { ...data.repos[1], name: '<b>bold</b> & "quoted"' },
      ],
    };
    const html = renderActivityBoard(hostile, now);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot;');
  });

  it('still renders when nothing was pushed', () => {
    const idle: ActivitySnapshot = { ...data, repos: [], languages: [] };
    const html = renderActivityBoard(idle, now);
    expect(html).toContain('Between');
    expect(html).toContain('act-heatmap');
  });
});

describe('repo links', () => {
  const repo = {
    name: 'Embr',
    url: 'https://github.com/guitaripod/embr',
    homepageUrl: null as string | null,
  };

  it('prefers the page the GitHub homepage field names on this site', () => {
    const link = repoLink(
      { ...repo, name: 'pixie', homepageUrl: 'https://midgarcorp.cc/pixiepocket' },
      {}
    );
    expect(link).toEqual({ href: '/pixiepocket/', external: false });
  });

  it('falls back to the landing page keyed by lowercase repo name', () => {
    expect(repoLink(repo, { embr: '/embr/' })).toEqual({ href: '/embr/', external: false });
  });

  it('keeps GitHub when no page exists or the homepage is elsewhere', () => {
    const github = { href: repo.url, external: true };
    expect(repoLink(repo, {})).toEqual(github);
    expect(repoLink({ ...repo, homepageUrl: 'https://midgarcorp.cc' }, {})).toEqual(github);
    expect(repoLink({ ...repo, homepageUrl: 'https://example.com/embr/' }, {})).toEqual(github);
    expect(repoLink({ ...repo, homepageUrl: 'not a url' }, {})).toEqual(github);
  });

  it('renders internal links without a new tab', () => {
    const base = snapshot as ActivitySnapshot;
    const focus = { ...base.repos[0], name: 'Focus', homepageUrl: null };
    const html = renderActivityBoard({ ...base, repos: [focus, ...base.repos.slice(1)] }, now, {
      focus: '/focus-page/',
    });
    expect(html).toMatch(/<a href="\/focus-page\/" class="phosphor/);
  });
});
