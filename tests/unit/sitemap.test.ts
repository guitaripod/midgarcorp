import { describe, it, expect } from 'vitest';
import { isIndexable, lastmodByPath, postDates, withLastmod } from '../../src/lib/sitemap.mjs';

describe('sitemap', () => {
  it('keeps noindex pages and design previews out', () => {
    expect(isIndexable('https://midgarcorp.cc/')).toBe(true);
    expect(isIndexable('https://midgarcorp.cc/flaccy/')).toBe(true);
    expect(isIndexable('https://midgarcorp.cc/404/')).toBe(false);
    expect(isIndexable('https://midgarcorp.cc/tags/')).toBe(false);
    expect(isIndexable('https://midgarcorp.cc/tags/swift/')).toBe(false);
    expect(isIndexable('https://midgarcorp.cc/og-preview/')).toBe(false);
  });

  it('reads post dates from frontmatter', () => {
    const source = "---\ntitle: 'x'\npubDate: 2024-01-20\nupdatedDate: '2026-08-02'\n---\nbody";
    expect(postDates(source)).toEqual({
      pubDate: '2024-01-20',
      updatedDate: '2026-08-02',
      draft: false,
    });
    expect(postDates('---\npubDate: 2024-01-20\ndraft: true\n---\n').draft).toBe(true);
  });

  it('dates pages by the records they show and leaves fixed copy undated', () => {
    const dates = lastmodByPath({
      apps: [
        { slug: 'flaccy', currentVersionReleaseDate: '2026-11-02T21:00:00Z' },
        { slug: 'helia', releaseDate: '2026-07-01T07:00:00Z' },
      ],
      posts: [{ slug: 'go', pubDate: '2024-01-20', updatedDate: '2026-08-02' }],
      linux: [{ latestReleaseDate: '2026-10-24T12:00:00Z' }, { latestReleaseDate: null }],
      oss: [{ updatedAt: '2026-11-05T00:00:00Z' }],
    });
    expect(dates.get('/flaccy/')?.toISOString()).toBe('2026-11-02T21:00:00.000Z');
    expect(dates.get('/helia/')?.toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(dates.get('/blog/go/')?.toISOString()).toBe('2026-08-02T00:00:00.000Z');
    expect(dates.get('/apps/')?.toISOString()).toBe('2026-11-02T21:00:00.000Z');
    expect(dates.get('/linux/')?.toISOString()).toBe('2026-10-24T12:00:00.000Z');
    expect(dates.get('/')?.toISOString()).toBe('2026-11-05T00:00:00.000Z');
    expect(dates.has('/services/')).toBe(false);
    expect(dates.has('/blackwall/')).toBe(false);
  });

  it('adds lastmod only where a date is known', () => {
    const dates = new Map([['/flaccy/', new Date('2026-11-02T21:00:00Z')]]);
    expect(withLastmod({ url: 'https://midgarcorp.cc/flaccy/' }, dates)).toEqual({
      url: 'https://midgarcorp.cc/flaccy/',
      lastmod: '2026-11-02T21:00:00.000Z',
    });
    expect(withLastmod({ url: 'https://midgarcorp.cc/links/' }, dates)).toEqual({
      url: 'https://midgarcorp.cc/links/',
    });
  });
});
