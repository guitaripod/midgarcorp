import type { APIRoute } from 'astro';

export const prerender = false;

const STEAM_VANITY_URL = 'kratos42069';

const jsonFetch = async (url: string, timeoutMs = 5000): Promise<any> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Steam API returned ${response.status}`);
  return response.json();
};

export const GET: APIRoute = async (context) => {
  const runtime = (context.locals as any).runtime;
  const apiKey = runtime?.env?.STEAM_API_KEY || import.meta.env.STEAM_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ loading: true, message: 'API key not configured' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  }

  try {
    const resolveData = await jsonFetch(
      `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${STEAM_VANITY_URL}`
    );

    if (resolveData.response?.success !== 1) {
      throw new Error('Failed to resolve Steam vanity URL');
    }
    const STEAM_ID = resolveData.response.steamid;

    const [summaryData, levelData, ownedGamesData, badgesData, recentGamesData] =
      await Promise.allSettled([
        jsonFetch(
          `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${STEAM_ID}`
        ),
        jsonFetch(
          `https://api.steampowered.com/IPlayerService/GetSteamLevel/v0001/?key=${apiKey}&steamid=${STEAM_ID}`
        ),
        jsonFetch(
          `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${STEAM_ID}&include_appinfo=true&include_played_free_games=true`
        ),
        jsonFetch(
          `https://api.steampowered.com/IPlayerService/GetBadges/v0001/?key=${apiKey}&steamid=${STEAM_ID}`
        ),
        jsonFetch(
          `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${STEAM_ID}&count=5`
        ),
      ]);

    const player =
      summaryData.status === 'fulfilled' ? summaryData.value.response?.players?.[0] : undefined;

    let currentAchievements: any = null;
    if (player?.gameid) {
      const achResult = await Promise.allSettled([
        jsonFetch(
          `https://api.steampowered.com/IPlayerService/GetPlayerAchievements/v0001/?key=${apiKey}&steamid=${STEAM_ID}&appid=${player.gameid}&l=en`
        ),
      ]);
      const stats =
        achResult[0].status === 'fulfilled' ? achResult[0].value.playerstats : undefined;
      if (stats?.success) {
        const achievements = stats.achievements || [];
        currentAchievements = {
          gameName: stats.gameName,
          earned: achievements.filter((a: any) => a.achieved === 1).length,
          total: achievements.length,
        };
      }
    }

    let ownedGames: any = null;
    let recentActivity: any[] = [];
    if (ownedGamesData.status === 'fulfilled') {
      const response = ownedGamesData.value.response;
      if (response?.game_count !== undefined) {
        const games = response.games || [];
        ownedGames = {
          count: response.game_count,
          totalPlaytimeHours: Math.round(
            games.reduce((sum: number, g: any) => sum + (g.playtime_forever || 0), 0) / 60
          ),
        };
        const twoWeekByAppId = new Map(
          (recentGamesData.status === 'fulfilled'
            ? recentGamesData.value.response?.games || []
            : []
          ).map((g: any) => [g.appid, g.playtime_2weeks || 0])
        );
        recentActivity = games
          .filter((g: any) => (g.rtime_last_played || 0) > 0)
          .map((g: any) => ({
            appid: g.appid,
            name: g.name,
            img_icon_url: g.img_icon_url,
            playtime_forever: g.playtime_forever || 0,
            playtime_2weeks: twoWeekByAppId.get(g.appid) || 0,
            lastPlayed: g.rtime_last_played,
          }))
          .sort((a: any, b: any) => b.lastPlayed - a.lastPlayed)
          .slice(0, 5);
      }
    }

    let steamLevel: number | null = null;
    if (levelData.status === 'fulfilled') {
      steamLevel = levelData.value.response?.player_level ?? null;
    }

    let badges: any = null;
    if (badgesData.status === 'fulfilled') {
      const response = badgesData.value.response;
      if (response?.badges) {
        badges = { count: response.badges.length, xp: response.player_xp ?? null };
        if (steamLevel == null && response.player_level != null) {
          steamLevel = response.player_level;
        }
      }
    }

    let mostPlayed: any[] = [];
    if (ownedGamesData.status === 'fulfilled') {
      const response = ownedGamesData.value.response;
      if (response?.game_count !== undefined) {
        mostPlayed = (response.games || [])
          .filter((g: any) => (g.playtime_forever || 0) > 0)
          .sort((a: any, b: any) => b.playtime_forever - a.playtime_forever)
          .slice(0, 3)
          .map((g: any) => ({
            appid: g.appid,
            name: g.name,
            img_icon_url: g.img_icon_url,
            playtime_forever: g.playtime_forever || 0,
          }));
      }
    }

    let recentGames: any[] = [];
    if (recentGamesData.status === 'fulfilled') {
      recentGames = recentGamesData.value.response?.games || [];
    }

    return new Response(
      JSON.stringify({
        player,
        steamLevel,
        ownedGames,
        badges,
        recentGames,
        recentActivity,
        mostPlayed,
        currentGame: player?.gameid
          ? {
              id: player.gameid,
              name: player.gameextrainfo || 'In Game',
              achievements: currentAchievements,
            }
          : null,
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
