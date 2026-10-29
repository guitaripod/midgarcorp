import metricsCatalogData from '../generated/metrics-catalog.json';
import signalsCatalogData from '../generated/signals-catalog.json';
import { appsWithData, isSample, STATS_URL } from '../lib/open-stats.mjs';
import {
  eventViews,
  metricViews,
  type MetricsCatalog,
  type SignalsCatalog,
} from '../lib/open-catalog';
import statsData from './open-stats.json';
import { landingApps, type LandingApp } from './landing';

export type Cell = number | string | null;
export type Row = { period: string } & Record<string, Cell>;

export interface Retention {
  cohort: string;
  w1: Cell;
  w4: Cell;
}

export interface Series {
  weeks: Row[];
  months: Row[];
  retention: Retention[];
}

export interface PublicMetric {
  id: string;
  title: string;
  unit: string;
  caveat: string;
}

export interface OpenStats {
  generated_at: string;
  rules: { min_count: number; weeks: number; months: number; note: string };
  portfolio: Series;
  apps: Record<string, Series>;
  metrics: PublicMetric[];
}

export interface OpenApp {
  slug: string;
  name: string;
  href: string | null;
  icon: string | null;
}

export const GITHUB_ORG = 'https://github.com/guitaripod';
/** The public mirror of this site, which carries the generated event and metric catalogs. */
export const SITE_REPO = `${GITHUB_ORG}/midgarcorp`;
export const KIT_SIGNALS = `${GITHUB_ORG}/MidgarKit/tree/master/Sources/MidgarCore/Signals`;
export const KIDS_APP_SLUG = 'master-of-flags';

export const stats = statsData as unknown as OpenStats;
export const sample = isSample(stats);
export const statsUrl = STATS_URL;
export const statsApps = appsWithData(stats);
export const events = eventViews(signalsCatalogData as unknown as SignalsCatalog);
export const metrics = metricViews(
  metricsCatalogData as unknown as MetricsCatalog,
  stats.metrics.map((metric) => metric.id)
);

/// A registry slug as a name: "living-dex" becomes "Living Dex".
export function nameFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/// The landing app a registry slug belongs to. The site spells some slugs without hyphens
/// ("pay-day" is `payday`), so both spellings are tried.
export function landingFor(slug: string, apps: LandingApp[] = landingApps): LandingApp | undefined {
  const joined = slug.replace(/-/g, '');
  return apps.find((app) => app.slug === slug || app.slug === joined);
}

/// Name, icon and landing page of a registry app, falling back to the slug for an app with no landing page.
export function openAppFor(slug: string, apps: LandingApp[] = landingApps): OpenApp {
  const landing = landingFor(slug, apps);
  if (!landing) return { slug, name: nameFromSlug(slug), href: null, icon: null };
  return {
    slug,
    name: landing.shortName,
    href: `/${landing.slug}/`,
    icon: landing.iconLocal ?? null,
  };
}

/// The Kids Category app that sends no usage counts, for the note on the page.
export const kidsApp = openAppFor(KIDS_APP_SLUG);
