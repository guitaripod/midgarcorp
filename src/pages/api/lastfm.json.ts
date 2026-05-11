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
  const apiKey = runtime?.env?.PUBLIC_LASTFM_API_KEY || import.meta.env.PUBLIC_LASTFM_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Last.fm API key not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Fetch multiple endpoints in parallel
    const [recentTracksResponse, userInfoResponse, topArtistsResponse] = await Promise.all([
      // Get recent tracks (last 5)
      fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&limit=5`
      ),
      // Get user info for total scrobbles
      fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${username}&api_key=${apiKey}&format=json`
      ),
      // Get top artists (7 day period for recent favorites)
      fetch(
        `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&api_key=${apiKey}&format=json&period=7day&limit=5`
      ),
    ]);

    const [recentTracks, userInfo, topArtists] = await Promise.all([
      recentTracksResponse.json(),
      userInfoResponse.json(),
      topArtistsResponse.json(),
    ]);

    // Combine all data
    const combinedData = {
      recenttracks: recentTracks.recenttracks,
      user: userInfo.user,
      topartists: topArtists.topartists,
    };

    return new Response(JSON.stringify(combinedData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch Last.fm data' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
