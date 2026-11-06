const SITE = 'https://midgarcorp.cc';

/// Paths that stay out of the sitemap: pages marked noindex (404, tag archives) and the
/// design previews in public/ that are served but never linked.
const EXCLUDED = [/^\/404\/?$/, /^\/tags\//, /-preview(\.html)?\/?$/];

/** True when a built page belongs in the sitemap. */
export function isIndexable(url) {
  const path = url.startsWith(SITE) ? url.slice(SITE.length) || '/' : url;
  return !EXCLUDED.some((pattern) => pattern.test(path));
}

const time = (value) => {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(ms) ? undefined : ms;
};

const latest = (values) => {
  const times = values.map(time).filter((ms) => ms !== undefined);
  return times.length ? new Date(Math.max(...times)) : undefined;
};

/// Frontmatter dates of one MDX post, read without a YAML parser: the content schema
/// already guarantees `pubDate` and an optional `updatedDate` as plain dates.
export function postDates(source) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const field = (name) => frontmatter.match(new RegExp(`^${name}:\\s*['"]?([^'"\\n]+)`, 'm'))?.[1];
  return {
    pubDate: field('pubDate'),
    updatedDate: field('updatedDate'),
    draft: /^draft:\s*true\s*$/m.test(frontmatter),
  };
}

/**
 * When each page last changed in a way a reader would notice, keyed by path.
 *
 * Only pages whose content follows a dated record get a date: an app page changes with
 * its App Store release, a post with its frontmatter, the indexes with the newest of
 * what they list. Pages of fixed copy get none, because a sitemap date that moves on
 * every build teaches search engines to ignore all of them.
 *
 * @param {{
 *   apps: { slug: string, currentVersionReleaseDate?: string, releaseDate?: string }[],
 *   posts: { slug: string, pubDate?: string, updatedDate?: string }[],
 *   linux: { latestReleaseDate?: string | null }[],
 *   oss: { updatedAt?: string }[],
 *   blackwall?: string,
 *   open?: string,
 * }} data
 * @returns {Map<string, Date>}
 */
export function lastmodByPath(data) {
  const dates = new Map();
  const set = (path, date) => date && dates.set(path, date);

  for (const app of data.apps) {
    set(`/${app.slug}/`, latest([app.currentVersionReleaseDate ?? app.releaseDate]));
  }
  for (const post of data.posts) {
    set(`/blog/${post.slug}/`, latest([post.updatedDate ?? post.pubDate]));
  }

  set('/apps/', latest(data.apps.map((app) => app.currentVersionReleaseDate ?? app.releaseDate)));
  set('/archive/', latest(data.posts.map((post) => post.pubDate)));
  set('/linux/', latest(data.linux.map((app) => app.latestReleaseDate)));
  set('/opensource/', latest(data.oss.map((project) => project.updatedAt)));
  set('/blackwall/', latest([data.blackwall]));
  set('/open/', latest([data.open]));
  set('/', latest([...dates.values()].map((date) => date.toISOString())));
  return dates;
}

/** The sitemap item for a URL, dated when its page has a known last change. */
export function withLastmod(item, dates) {
  const path = item.url.startsWith(SITE) ? item.url.slice(SITE.length) || '/' : item.url;
  const date = dates.get(path);
  return date ? { ...item, lastmod: date.toISOString() } : item;
}
