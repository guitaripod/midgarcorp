import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const username = url.searchParams.get('username');

  if (!username) {
    return new Response(JSON.stringify({ error: 'Username required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // In Cloudflare Pages, secrets are available via context.locals.runtime.env
  const runtime = (context.locals as any).runtime;
  const clientId = runtime?.env?.TRAKT_CLIENT_ID || import.meta.env.TRAKT_CLIENT_ID;

  if (!clientId) {
    return new Response(JSON.stringify({ error: 'Trakt.tv client ID not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Fetch currently watching
    const watchingResponse = await fetch(`https://api.trakt.tv/users/${username}/watching`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      },
    });

    let currentlyWatching = null;
    if (watchingResponse.status === 200) {
      currentlyWatching = await watchingResponse.json();
    }

    // Fetch watch history (last 5 items)
    const historyResponse = await fetch(`https://api.trakt.tv/users/${username}/history?limit=5`, {
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': clientId,
      },
    });

    const history = historyResponse.ok ? await historyResponse.json() : [];

    return new Response(
      JSON.stringify({
        currentlyWatching,
        history,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, s-maxage=300',
        },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch Trakt.tv data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
