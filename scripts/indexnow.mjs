import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const INDEXNOW_KEY = '986575f7276e69026bcf74c13842de02';
const HOST = 'midgarcorp.cc';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** Each <loc> in a sitemap with its <lastmod>, or an empty string when it has none. */
export function sitemapEntries(xml) {
  return new Map(
    [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => [
      block.match(/<loc>([^<]*)<\/loc>/)?.[1] ?? '',
      block.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1] ?? '',
    ])
  );
}

/**
 * The URLs worth telling search engines about after a deploy: pages that are new since the
 * previous sitemap, or whose lastmod moved. IndexNow asks for changed URLs only, so a deploy
 * that changed no dated page submits nothing.
 */
export function changedUrls(previousXml, nextXml) {
  const previous = sitemapEntries(previousXml);
  return [...sitemapEntries(nextXml)]
    .filter(([url, lastmod]) => url && (!previous.has(url) || previous.get(url) !== lastmod))
    .map(([url]) => url);
}

async function submit(urls) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });
  return response.status;
}

/// Run after a production deploy with the sitemap that was live before it and the one just
/// deployed. It never fails the deploy: a missed ping only means search engines find the
/// change on their next crawl. Without the previous sitemap it cannot tell what changed, so
/// it submits nothing rather than the whole site.
async function main([previousPath, nextPath]) {
  let previous;
  try {
    previous = readFileSync(previousPath, 'utf8');
  } catch {
    console.log('IndexNow: no previous sitemap to compare against; nothing submitted.');
    return;
  }
  const urls = changedUrls(previous, readFileSync(nextPath, 'utf8')).slice(0, 10000);
  if (urls.length === 0) {
    console.log('IndexNow: no changed URLs.');
    return;
  }
  try {
    const status = await submit(urls);
    console.log(`IndexNow: submitted ${urls.length} URL(s), HTTP ${status}.`);
  } catch (error) {
    console.log(`IndexNow: submission failed (${error.message}).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv.slice(2));
}
