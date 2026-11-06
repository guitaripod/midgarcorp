import { getCollection } from 'astro:content';
import { appEntries } from '@data/apps';
import { landingApps } from '@data/landing';
import { linuxApps } from '@data/linux';
import { ossProjects } from '@data/oss';
import { PRODUCT_PAGES } from '@data/product-pages';
import type { LlmsSite } from '@utils/llms';

/// Everything /llms.txt and the Markdown twins describe, ordered the way the site ranks it:
/// apps by the work behind them, posts newest first.
export async function llmsSite(): Promise<LlmsSite> {
  const rank = new Map(appEntries.map((entry, index) => [entry.slug, index]));
  const apps = [...landingApps].sort(
    (a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity)
  );
  const posts = (await getCollection('blog'))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return { apps, products: PRODUCT_PAGES, linux: linuxApps, oss: ossProjects, posts };
}

export const markdownHeaders = { 'Content-Type': 'text/markdown; charset=utf-8' };
export const textHeaders = { 'Content-Type': 'text/plain; charset=utf-8' };
