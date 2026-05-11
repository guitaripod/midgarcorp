import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const username = url.searchParams.get('username');

  console.log('[WakaTime API] Request for username:', username);

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
  const apiKey = runtime?.env?.WAKATIME_API_KEY || import.meta.env.WAKATIME_API_KEY;

  console.log('[WakaTime API] API key configured:', !!apiKey);

  if (!apiKey) {
    console.error('[WakaTime API] No API key found in environment');
    return new Response(JSON.stringify({ error: 'WakaTime API key not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Fetch stats for the last 7 days
    const statsResponse = await fetch(
      `https://wakatime.com/api/v1/users/${username}/stats/last_7_days`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`,
        },
      }
    );

    console.log('[WakaTime API] Stats API response status:', statsResponse.status);

    if (!statsResponse.ok) {
      const errorBody = await statsResponse.text();
      console.error('[WakaTime API] Error response body:', errorBody);
      throw new Error(`WakaTime API error: ${statsResponse.status} - ${errorBody}`);
    }

    const data = await statsResponse.json();
    console.log('[WakaTime API] Successfully fetched stats');

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch WakaTime data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
