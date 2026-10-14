import { workScore } from '../lib/work';
import appWork from './app-work.json';
import appsData from './apps.json';
import { landingApps, primaryDevice, type LandingApp, type Screenshot } from './landing';

type StoreApp = (typeof appsData.apps)[number];

export interface AppWork {
  repo: string;
  commitCount: number;
  releaseCount: number;
  latestReleaseDate: string | null;
  pushedAt: string;
}

export interface AppCardData {
  id: string;
  name: string;
  tagline: string;
  description: string;
  platforms: string[];
  category: string;
  price: string;
  appStoreUrl: string;
  icon: string;
  primaryColor: string;
  features: string[];
  releaseDate?: string;
}

export interface AppEntry {
  app: AppCardData;
  slug?: string;
  landingHref?: string;
  openSource: boolean;
  githubUrl?: string;
  work: AppWork | null;
  version?: string;
  device: string | null;
  shots: Screenshot[];
  score: number;
}

export const APPS_NOW = new Date();
export const APP_HERO_SCORE = 17;
const SHOT_COUNT = 3;

const workBySlug = appWork as unknown as Record<string, AppWork>;
const landingByTrack = new Map(landingApps.map((a) => [String(a.trackId), a]));
const trackIdFor = (appStoreUrl: string): string | undefined => appStoreUrl.match(/id(\d+)/)?.[1];

/// Landscape device buckets show fewer, wider shots than a phone does.
const LANDSCAPE = new Set(['mac', 'tv', 'linux', 'vision']);

/// The first few screenshots of an app's primary device, or none for an app without landing assets.
function shotsFor(landing: LandingApp | undefined): { device: string | null; shots: Screenshot[] } {
  if (!landing) return { device: null, shots: [] };
  const device = primaryDevice(landing);
  const all = landing.screenshots[device] ?? [];
  return { device, shots: all.slice(0, LANDSCAPE.has(device) ? 2 : SHOT_COUNT) };
}

function entryFor(app: AppCardData, landing: LandingApp | undefined, now: Date): AppEntry {
  const work = landing ? (workBySlug[landing.slug] ?? null) : null;
  const { device, shots } = shotsFor(landing);
  const latest = landing?.currentVersionReleaseDate ?? app.releaseDate ?? null;
  return {
    app,
    slug: landing?.slug,
    landingHref: landing ? `/${landing.slug}/` : undefined,
    openSource: landing?.openSource === true,
    githubUrl: landing?.githubUrl,
    work,
    version: landing?.version,
    device,
    shots,
    score: workScore(
      { commitCount: work?.commitCount, releaseCount: work?.releaseCount, latestDate: latest },
      now
    ),
  };
}

/// Prefer the curated landing price over the iTunes price, which lags a price change by hours,
/// and the self-hosted icon over the remote 512px artwork.
function storeEntry(app: StoreApp, now: Date): AppEntry {
  const id = trackIdFor(app.appStoreUrl);
  const landing = id ? landingByTrack.get(id) : undefined;
  const card = landing
    ? { ...app, price: landing.price, icon: landing.iconLocal ?? app.icon }
    : app;
  return entryFor(card, landing, now);
}

/// Open-source landing apps that are not on the App Store yet still earn a card.
function landingEntry(landing: LandingApp, now: Date): AppEntry {
  return entryFor(
    {
      id: landing.slug,
      name: landing.shortName,
      tagline: landing.content.heroHeadline,
      description: landing.description,
      platforms: landing.platforms,
      category: landing.category ?? 'App',
      price: landing.price,
      appStoreUrl: landing.githubUrl ?? '',
      icon: landing.iconLocal ?? landing.icon ?? '',
      primaryColor: landing.primaryColor,
      features: landing.content.highlights ?? [],
      releaseDate: landing.releaseDate,
    },
    landing,
    now
  );
}

export function buildAppEntries(now: Date = APPS_NOW): AppEntry[] {
  const store = [...appsData.apps].map((app) => storeEntry(app, now));
  const storeTracks = new Set(appsData.apps.map((app) => trackIdFor(app.appStoreUrl)));
  const openSource = landingApps
    .filter((a) => a.openSource && !storeTracks.has(String(a.trackId)))
    .map((a) => landingEntry(a, now));
  return [...store, ...openSource].sort(
    (a, b) => b.score - a.score || a.app.name.localeCompare(b.app.name)
  );
}

export const appEntries: AppEntry[] = buildAppEntries();

export const appStats = {
  storeCount: appsData.apps.length,
  total: appEntries.length,
  commits: appEntries.reduce((sum, entry) => sum + (entry.work?.commitCount ?? 0), 0),
  platforms: [...new Set(appEntries.flatMap((entry) => entry.app.platforms))],
};

export const appMax = {
  commits: Math.max(1, ...appEntries.map((entry) => entry.work?.commitCount ?? 0)),
  releases: Math.max(1, ...appEntries.map((entry) => entry.work?.releaseCount ?? 0)),
};

export const appHeroes = appEntries.filter(
  (entry) => entry.shots.length > 0 && entry.score >= APP_HERO_SCORE
);
const heroIds = new Set(appHeroes.map((entry) => entry.app.id));
export const appRest = appEntries.filter((entry) => !heroIds.has(entry.app.id));
