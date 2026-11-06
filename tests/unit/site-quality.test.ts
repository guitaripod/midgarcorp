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
      const description = decode(
        html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? ''
      );
      return [
        ...(title.length > 70 ? [`${route} title ${title.length}`] : []),
        ...(description.length > 165 ? [`${route} description ${description.length}`] : []),
      ];
    });
    expect(long).toEqual([]);
  });

  /// The site's own URLs inside a page's JSON-LD, which must be the canonical form.
  const jsonLdSiteUrls = (html: string): string[] =>
    [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(
      (match) =>
        [
          ...JSON.stringify(JSON.parse(match[1])).matchAll(/"(https:\/\/midgarcorp\.cc[^"]*)"/g),
        ].map((url) => url[1])
    );

  const isNoindex = (html: string): boolean => /<meta name="robots" content="noindex/.test(html);

  const sitePath = (url: string): string => new URL(url).pathname.replace(/index\.html$/, '');

  const served = (path: string): boolean =>
    routes.has(path) || fileSet.has(path) || fileSet.has(`${path}index.html`);

  it('cites only canonical, existing pages in its structured data', () => {
    const offenders = pages.flatMap(({ route, html }) =>
      jsonLdSiteUrls(html)
        .map((url) => url.replace(/[?#].*$/, ''))
        .filter((url) => !served(sitePath(url)))
        .map((url) => `${route} -> ${url}`)
    );
    expect([...new Set(offenders)].slice(0, 20)).toEqual([]);
  });

  it('gives every indexable page a canonical URL and keeps it off noindex pages', () => {
    const offenders = pages.flatMap(({ route, html }) => {
      const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
      if (isNoindex(html)) return canonical ? [`${route} noindex with canonical`] : [];
      return canonical === `https://midgarcorp.cc${route}`
        ? []
        : [`${route} canonical ${canonical}`];
    });
    expect(offenders).toEqual([]);
  });

  it('lists every indexable page in the sitemap and no noindex page', () => {
    const sitemap = readFileSync(join(dist, 'sitemap-0.xml'), 'utf8');
    const listed = new Set(
      [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => sitePath(m[1]))
    );
    const missing = pages
      .filter(({ html }) => !isNoindex(html))
      .map(({ route }) => route)
      .filter((route) => !listed.has(route));
    const noindexed = pages
      .filter(({ route, html }) => isNoindex(html) && listed.has(route))
      .map(({ route }) => route);
    expect({ missing, noindexed }).toEqual({ missing: [], noindexed: [] });
  });

  it('links each page to a Markdown twin that exists', () => {
    const offenders = pages.flatMap(({ route, html }) => {
      const twin = html.match(/<link rel="alternate" type="text\/markdown" href="([^"]*)"/)?.[1];
      return twin && !fileSet.has(twin) ? [`${route} -> ${twin}`] : [];
    });
    expect(offenders).toEqual([]);
    const appPage = pages.find(({ route }) => route === '/flaccy/');
    expect(appPage?.html).toContain('href="/flaccy/index.html.md"');
  });

  it('serves an llms.txt whose site links all resolve', () => {
    const index = readFileSync(join(dist, 'llms.txt'), 'utf8');
    const links = [...index.matchAll(/\]\((https:\/\/midgarcorp\.cc[^)]*)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(20);
    const broken = links.filter((url) => !served(sitePath(url)));
    expect(broken).toEqual([]);
  });

  it('shows the Smart App Banner only on pages of apps live on the App Store', () => {
    const banners = pages
      .filter(({ html }) => html.includes('name="apple-itunes-app"'))
      .map(({ route }) => route);
    expect(banners).toContain('/flaccy/');
    expect(banners).not.toContain('/');
    expect(banners).not.toContain('/apps/');
  });
});
