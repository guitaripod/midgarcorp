import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INDEXNOW_KEY, changedUrls, sitemapEntries } from '../../scripts/indexnow.mjs';

const sitemap = (urls: [string, string?][]): string =>
  `<urlset>${urls
    .map(
      ([loc, lastmod]) =>
        `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
    )
    .join('')}</urlset>`;

describe('IndexNow', () => {
  it('serves its key from the site root, as the protocol requires', () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
    const file = join(process.cwd(), 'public', `${INDEXNOW_KEY}.txt`);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(INDEXNOW_KEY);
  });

  it('reads each URL with its lastmod', () => {
    const entries = sitemapEntries(
      sitemap([['https://midgarcorp.cc/', '2026-11-01'], ['https://midgarcorp.cc/a/']])
    );
    expect([...entries]).toEqual([
      ['https://midgarcorp.cc/', '2026-11-01'],
      ['https://midgarcorp.cc/a/', ''],
    ]);
  });

  it('submits only pages that are new or whose lastmod moved', () => {
    const before = sitemap([
      ['https://midgarcorp.cc/', '2026-11-01'],
      ['https://midgarcorp.cc/flaccy/', '2026-11-02'],
      ['https://midgarcorp.cc/links/'],
    ]);
    const after = sitemap([
      ['https://midgarcorp.cc/', '2026-11-05'],
      ['https://midgarcorp.cc/flaccy/', '2026-11-02'],
      ['https://midgarcorp.cc/links/'],
      ['https://midgarcorp.cc/newapp/', '2026-11-05'],
    ]);
    expect(changedUrls(before, after)).toEqual([
      'https://midgarcorp.cc/',
      'https://midgarcorp.cc/newapp/',
    ]);
    expect(changedUrls(after, after)).toEqual([]);
    expect(changedUrls('', before)).toHaveLength(3);
  });
});
