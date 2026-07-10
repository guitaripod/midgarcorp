import factsData from './landing-facts.json';
import liveData from './landing-live.json';

export interface Screenshot {
  src: string;
  w: number;
  h: number;
  label: string;
}

export interface LandingFacts {
  slug: string;
  trackId: number;
  shortName: string;
  status: 'live' | 'review';
  primaryColor: string;
  name: string;
  appStoreUrl: string;
  description: string;
  releaseNotes?: string;
  promotionalText?: string;
  category?: string;
  genres?: string[];
  price: string;
  rating: number;
  ratingCount: number;
  version?: string;
  releaseDate?: string;
  currentVersionReleaseDate?: string;
  minimumOsVersion?: string;
  contentRating?: string;
  languages?: string[];
  bundleId?: string;
  sellerName?: string;
  icon?: string | null;
  iconLocal?: string;
  marketingUrl?: string | null;
  supportUrl?: string | null;
  keywords?: string;
  platforms: string[];
  screenshots: Record<string, Screenshot[]>;
  openSource?: boolean;
  githubUrl?: string;
  latestReleaseUrl?: string;
  license?: string;
}

export interface Feature {
  title: string;
  body: string;
  glyph: string;
}

export interface Step {
  step: string;
  body: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface LandingContent {
  seoTitle: string;
  metaDescription: string;
  keywords: string[];
  heroHeadline: string;
  heroSubhead: string;
  accentColor: string;
  highlights: string[];
  features: Feature[];
  howItWorks: Step[];
  faq: Faq[];
  screenshotCaptions: Record<string, string[]>;
  ctaLine: string;
  pricingNote: string;
  lifestyle?: { src: string; caption: string }[];
}

export type LandingApp = LandingFacts & { content: LandingContent };

const contentModules = import.meta.glob<{ default: LandingContent }>('./landing/*.json', {
  eager: true,
});

const contentBySlug: Record<string, LandingContent> = {};
for (const [path, mod] of Object.entries(contentModules)) {
  const slug = path.split('/').pop()!.replace('.json', '');
  contentBySlug[slug] = ((mod as { default?: LandingContent }).default ??
    (mod as unknown as LandingContent)) as LandingContent;
}

const facts = (factsData as unknown as { apps: LandingFacts[] }).apps;

/// Fast-changing store facts (version, price, rating, dates) regenerated every
/// build by `ct fetch-appstore` into landing-live.json, keyed by track id. They
/// override the hand-committed values in landing-facts.json so a new App Store
/// release never requires a manual edit.
const liveByTrack = liveData as unknown as Record<string, Partial<LandingFacts>>;

export const landingApps: LandingApp[] = facts
  .filter((f) => contentBySlug[f.slug])
  .map((f) => ({
    ...f,
    ...(liveByTrack[String(f.trackId)] ?? {}),
    content: contentBySlug[f.slug],
  }));

export const landingSlugs = landingApps.map((a) => a.slug);

export function getLandingApp(slug: string): LandingApp | undefined {
  return landingApps.find((a) => a.slug === slug);
}

export const DEVICE_LABELS: Record<string, string> = {
  iphone: 'iPhone',
  ipad: 'iPad',
  mac: 'Mac',
  linux: 'Linux',
  vision: 'Vision Pro',
  tv: 'Apple TV',
};

const DEVICE_ORDER = ['iphone', 'ipad', 'mac', 'linux', 'vision', 'tv'];

/// Returns the device bucket whose screenshots best represent the app in the hero.
export function primaryDevice(app: LandingApp): string {
  const keys = Object.keys(app.screenshots);
  return DEVICE_ORDER.find((d) => app.screenshots[d]?.length) ?? keys[0];
}

/// Device buckets present for an app, ordered for display.
export function deviceKeys(app: LandingApp): string[] {
  const keys = Object.keys(app.screenshots);
  return DEVICE_ORDER.filter((d) => keys.includes(d)).concat(
    keys.filter((k) => !DEVICE_ORDER.includes(k))
  );
}
