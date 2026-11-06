export const SITE = 'https://midgarcorp.cc';

/// An absolute URL on the site; a path that names a page (no file extension) gets the
/// trailing slash its canonical URL has, so structured data never cites a 308.
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const [, pathname, rest] = path.match(/^([^?#]*)(.*)$/)!;
  const isFile = /\.[a-z0-9]+$/i.test(pathname);
  const normalized = isFile || pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${SITE}${normalized}${rest}`;
}

/// A link that may point back at this site with or without the trailing slash, made
/// canonical; any other URL passes through untouched.
export function canonicalLink(url: string): string {
  if (url !== SITE && !url.startsWith(`${SITE}/`)) return url;
  return absoluteUrl(url.slice(SITE.length) || '/');
}
