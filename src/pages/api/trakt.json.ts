import type { APIRoute } from 'astro';
import { TRAKT_USER, itemCount, summarize, type RawTraktItem } from '../../lib/trakt';

export const prerender = false;

const RECENT_PLAYS = 12;
const RECENT_SHOWN = 6;
const WEEK_PLAYS = 100;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const json = (body: unknown, status: number, cacheControl: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });

/** Trakt sits behind Cloudflare's bot check, which answers 403 to any request without a User-Agent, as Workers send by default. */
function traktHeaders(clientId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'trakt-api-version': '2',
    'trakt-api-key': clientId,
    'User-Agent': 'midgarcorp.cc/1.0 (+https://midgarcorp.cc/links/)',
  };
}

async function traktGet(path: string, clientId: string): Promise<Response> {
  const response = await fetch(`https://api.trakt.tv${path}`, { headers: traktHeaders(clientId) });
  if (!response.ok) throw new Error(`Trakt answered ${response.status} for ${path.split('?')[0]}`);
  return response;
}

export const GET: APIRoute = async (context) => {
  const runtime = (context.locals as any).runtime;
  const clientId = runtime?.env?.TRAKT_CLIENT_ID || import.meta.env.TRAKT_CLIENT_ID;
  if (!clientId) return json({ error: 'Trakt client ID not configured' }, 503, 'no-cache');

  const user = `/users/${TRAKT_USER}`;
  const weekStart = new Date(Date.now() - WEEK_MS).toISOString();

  try {
    const [watchingResponse, historyResponse, weekResponse] = await Promise.all([
      traktGet(`${user}/watching?extended=images`, clientId),
      traktGet(`${user}/history?limit=${RECENT_PLAYS}&extended=images`, clientId),
      traktGet(
        `${user}/history?limit=${WEEK_PLAYS}&start_at=${encodeURIComponent(weekStart)}`,
        clientId
      ),
    ]);

    const watching: RawTraktItem | null =
      watchingResponse.status === 204 ? null : await watchingResponse.json();
    const history: RawTraktItem[] = await historyResponse.json();
    const week: RawTraktItem[] = await weekResponse.json();

    const summary = summarize({
      watching,
      history: Array.isArray(history) ? history : [],
      week: Array.isArray(week) ? week : [],
      totalPlays: itemCount(historyResponse.headers.get('X-Pagination-Item-Count')),
      weekPlays: itemCount(weekResponse.headers.get('X-Pagination-Item-Count')),
      recentLimit: RECENT_SHOWN,
    });
    return json(summary, 200, 'public, max-age=60, s-maxage=60');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    return json({ error: `Trakt unavailable: ${message}` }, 502, 'no-cache');
  }
};
