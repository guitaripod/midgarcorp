import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const built = existsSync(join(dist, 'index.html'));

/// Every file under dist, as the absolute paths the site serves them at.
function servedFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? servedFiles(path) : [`/${relative(dist, path)}`];
  });
}

const files = built ? servedFiles(dist) : [];
const fileSet = new Set(files);
const pages = files
  .filter((file) => file.endsWith('/index.html'))
  .map((file) => ({
    route: file.slice(0, -'index.html'.length),
    html: readFileSync(join(dist, file), 'utf8'),
  }));
const routes = new Set(pages.map((page) => page.route));

/// The pathname of every same-site link on a page, without its fragment or query.
const internalLinks = (html: string): string[] =>
  [...html.matchAll(/href="(\/[^"#?]*)/g)]
    .map((match) => match[1])
    .filter((href) => !href.startsWith('//') && !href.startsWith('/api/'));

const decode = (text: string): string =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"');

describe.skipIf(!built)('built site', () => {
  it('links every page with the trailing slash its canonical URL has', () => {
    const offenders = pages.flatMap(({ route, html }) =>
      internalLinks(html)
        .filter((href) => !href.endsWith('/') && routes.has(`${href}/`))
        .map((href) => `${route} -> ${href}`)
    );
    expect([...new Set(offenders)].slice(0, 20)).toEqual([]);
  });

  it('has no internal link to a page or file that does not exist', () => {
    const offenders = pages.flatMap(({ route, html }) =>
      internalLinks(html)
        .filter((href) => !routes.has(href) && !fileSet.has(href) && !routes.has(`${href}/`))
        .map((href) => `${route} -> ${href}`)
    );
    expect([...new Set(offenders)].slice(0, 20)).toEqual([]);
  });

  it('keeps every title and description inside what a result page shows', () => {
    const long = pages.flatMap(({ route, html }) => {
      const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
      const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
      return [
        ...(title.length > 70 ? [`${route} title ${title.length}`] : []),
        ...(description.length > 165 ? [`${route} description ${description.length}`] : []),
      ];
    });
    expect(long).toEqual([]);
  });
});
