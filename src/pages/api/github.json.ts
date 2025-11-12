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

  // Optional: Use GitHub token for higher rate limits
  let githubToken: string | undefined;

  try {
    // Try Cloudflare Workers environment first
    const runtime = (context.locals as any).runtime;
    githubToken = runtime?.env?.GITHUB_TOKEN;
  } catch (e) {
    // Fallback for local development
  }

  // If not found in runtime, try import.meta.env
  if (!githubToken) {
    githubToken = import.meta.env.GITHUB_TOKEN;
  }

  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'midgarcorp-website',
  };

  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
    console.log('[GitHub API] Using authenticated requests');
  } else {
    console.log('[GitHub API] Using unauthenticated requests (rate limited to 60/hour)');
  }

  try {
    // Fetch user data
    const userResponse = await fetch(`https://api.github.com/users/${username}`, { headers });

    if (!userResponse.ok) {
      const rateLimitRemaining = userResponse.headers.get('X-RateLimit-Remaining');
      const errorText = await userResponse.text();
      console.error(
        '[GitHub API] User fetch failed. Status:',
        userResponse.status,
        'Rate limit remaining:',
        rateLimitRemaining,
        'Error:',
        errorText
      );

      // Return a more informative error response
      return new Response(
        JSON.stringify({
          error: 'GitHub API request failed',
          status: userResponse.status,
          rateLimitRemaining: rateLimitRemaining || 'unknown',
        }),
        {
          status: userResponse.status === 403 ? 429 : userResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    const userData = await userResponse.json();

    // Fetch recent repos
    const reposResponse = await fetch(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=3`,
      { headers }
    );

    const recentRepos = reposResponse.ok ? await reposResponse.json() : [];

    return new Response(JSON.stringify({ user: userData, repos: recentRepos }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('[GitHub API] Error:', error);

    // Provide more details about the error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      error: 'Failed to fetch GitHub data',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  }
};
