import type { APIRoute } from 'astro';

export const prerender = false;

const RA_USER = 'guitaripod';
const RA_BASE = 'https://retroachievements.org/API';

const raFetch = async (endpoint: string): Promise<any> => {
  const response = await fetch(`${RA_BASE}/${endpoint}&y=${encodeURIComponent(RA_API_KEY)}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`RetroAchievements API returned ${response.status}`);
  return response.json();
};

let RA_API_KEY = '';

export const GET: APIRoute = async (context) => {
  const runtime = (context.locals as any).runtime;
  RA_API_KEY = runtime?.env?.RETROACHIEVEMENTS_API_KEY || import.meta.env.RETROACHIEVEMENTS_API_KEY;

  if (!RA_API_KEY) {
    return new Response(JSON.stringify({ loading: true, message: 'API key not configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  }

  try {
    const [summaryData, awardsData, completionData, recentUnlocksData] = await Promise.allSettled([
      raFetch(`API_GetUserSummary.php?u=${RA_USER}`),
      raFetch(`API_GetUserAwards.php?u=${RA_USER}`),
      raFetch(`API_GetUserCompletionProgress.php?u=${RA_USER}&count=50&offset=0`),
      raFetch(`API_GetUserRecentAchievements.php?u=${RA_USER}`),
    ]);

    const summary = summaryData.status === 'fulfilled' ? summaryData.value : undefined;
    const awards = awardsData.status === 'fulfilled' ? awardsData.value : undefined;
    const completion = completionData.status === 'fulfilled' ? completionData.value : undefined;

    let recentUnlocks: any[] = [];
    if (recentUnlocksData.status === 'fulfilled' && Array.isArray(recentUnlocksData.value)) {
      recentUnlocks = recentUnlocksData.value;
    }

    let lastGame: any = null;
    const lastGameId = summary?.LastGameID;
    if (lastGameId) {
      const gameResult = await Promise.allSettled([raFetch(`API_GetGame.php?i=${lastGameId}`)]);
      if (gameResult[0].status === 'fulfilled') {
        const g = gameResult[0].value;
        lastGame = {
          id: g.ID ?? lastGameId,
          title: g.Title,
          consoleName: g.ConsoleName,
          genre: g.Genre,
          developer: g.Developer,
          imageBoxArt: g.ImageBoxArt ? `${RA_BASE.replace('/API', '')}${g.ImageBoxArt}` : null,
          imageIcon: g.ImageIcon ? `${RA_BASE.replace('/API', '')}${g.ImageIcon}` : null,
        };
      }
    }

    const games = completion?.Results || [];
    const mostRecentGame = [...games].sort(
      (a, b) =>
        new Date(b.MostRecentAwardedDate || 0).getTime() -
        new Date(a.MostRecentAwardedDate || 0).getTime()
    )[0];

    const topGames = games
      .filter((g: any) => g.NumAwarded > 0)
      .sort((a: any, b: any) => b.NumAwarded / b.MaxPossible - a.NumAwarded / a.MaxPossible)
      .slice(0, 3);

    return new Response(
      JSON.stringify({
        summary,
        awards,
        lastGame,
        stats: {
          gamesPlayed: completion?.Count ?? null,
          achievementsEarned: games.reduce((sum: number, g: any) => sum + g.NumAwarded, 0),
          achievementsPossible: games.reduce((sum: number, g: any) => sum + g.MaxPossible, 0),
        },
        mostRecentGame: mostRecentGame || null,
        topGames,
        recentUnlocks: recentUnlocks.slice(0, 5),
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
    return new Response(JSON.stringify({ loading: true, message: 'Temporary API error' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  }
};
