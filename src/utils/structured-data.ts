import { screenshotUrl, type Faq, type LandingApp } from '../data/landing';
import { SITE, absoluteUrl } from './site-url';

export { SITE, absoluteUrl, canonicalLink } from './site-url';

export const ORGANIZATION_ID = `${SITE}/#organization`;
export const PERSON_ID = `${SITE}/#guitaripod`;
export const WEBSITE_ID = `${SITE}/#website`;
export const APP_STORE_DEVELOPER_URL = 'https://apps.apple.com/us/developer/midgar-oy/id1484270247';

const PERSON_PROFILES = [
  'https://github.com/guitaripod',
  'https://x.com/guitaripod',
  'https://youtube.com/@guitaripod',
  'https://twitch.tv/guitaripod',
];

/// The studio as any page names it: the `@id` the home page defines in full, plus the
/// name and URL a reader of that one page needs without the home page's graph.
export const organizationRef = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: 'Midgar Oy',
  url: `${SITE}/`,
};

/// The developer as any page names them, by the handle the site signs its work with.
export const personRef = {
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'guitaripod',
  url: `${SITE}/`,
};

/// The site-wide entities the home page declares once and every other page points at
/// by `@id`: the website (its name in results), the studio and its developer.
export function siteGraph(logo: string): Record<string, unknown>[] {
  return [
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      name: 'Midgar Corp',
      alternateName: ['Midgar', 'midgarcorp.cc'],
      url: `${SITE}/`,
      inLanguage: 'en',
      publisher: { '@id': ORGANIZATION_ID },
    },
    {
      ...organizationRef,
      alternateName: ['Midgar Corp', 'Midgar'],
      logo: absoluteUrl(logo),
      description:
        'Independent Finnish software studio making iPhone, iPad, Mac, Apple Watch and Apple TV apps, Linux tools and open-source software.',
      address: { '@type': 'PostalAddress', addressCountry: 'FI' },
      founder: { '@id': PERSON_ID },
      sameAs: [APP_STORE_DEVELOPER_URL, 'https://github.com/guitaripod'],
    },
    {
      ...personRef,
      jobTitle: 'Software engineer',
      worksFor: { '@id': ORGANIZATION_ID },
      sameAs: PERSON_PROFILES,
    },
  ];
}

/// A BreadcrumbList from Home down to the current page, each step an absolute canonical URL.
export function breadcrumbList(trail: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...trail].map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

export function faqPage(faq: Faq[]): Record<string, unknown> {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

const GOOGLE_APP_CATEGORIES: Record<string, string> = {
  Books: 'ReferenceApplication',
  Business: 'BusinessApplication',
  'Developer Tools': 'DeveloperApplication',
  Education: 'EducationalApplication',
  Entertainment: 'EntertainmentApplication',
  Finance: 'FinanceApplication',
  'Food & Drink': 'LifestyleApplication',
  Games: 'GameApplication',
  'Graphics & Design': 'DesignApplication',
  'Health & Fitness': 'HealthApplication',
  Lifestyle: 'LifestyleApplication',
  Medical: 'HealthApplication',
  Music: 'MultimediaApplication',
  Navigation: 'TravelApplication',
  News: 'ReferenceApplication',
  'Photo & Video': 'MultimediaApplication',
  Productivity: 'BusinessApplication',
  Reference: 'ReferenceApplication',
  Shopping: 'ShoppingApplication',
  'Social Networking': 'SocialNetworkingApplication',
  Sports: 'SportsApplication',
  Travel: 'TravelApplication',
  Utilities: 'UtilitiesApplication',
  Weather: 'LifestyleApplication',
};

/// Google's software-app rich result takes one of its own app types, not the App Store
/// category name; anything the store adds later falls back to the store's own label.
export function googleAppCategory(storeCategory?: string): string | undefined {
  if (!storeCategory) return undefined;
  return GOOGLE_APP_CATEGORIES[storeCategory] ?? storeCategory;
}

const PERIOD_WORDS: Record<string, string> = {
  week: 'P1W',
  weekly: 'P1W',
  month: 'P1M',
  monthly: 'P1M',
  year: 'P1Y',
  yearly: 'P1Y',
  annual: 'P1Y',
};

/// A pricing tier's renewal period as an ISO 8601 duration, or `undefined` for a one-time purchase.
export function billingDuration(period?: string): string | undefined {
  if (!period) return undefined;
  if (/^P\d+[DWMY]$/.test(period)) return period;
  return PERIOD_WORDS[period.toLowerCase()];
}

const OPERATING_SYSTEMS: Record<string, string> = {
  iPhone: 'iOS',
  iPad: 'iPadOS',
  Mac: 'macOS',
  'Apple Watch': 'watchOS',
  'Apple TV': 'tvOS',
  'Vision Pro': 'visionOS',
  Linux: 'Linux',
};

export function operatingSystems(platforms: string[]): string {
  return [...new Set(platforms.map((p) => OPERATING_SYSTEMS[p]).filter(Boolean))].join(', ');
}

const MOBILE_PLATFORMS = new Set(['iPhone', 'iPad', 'Apple Watch']);

/// The app's offers: the download itself, then each paid tier the page states, so the
/// structured price of a free app with paid unlocks is not only its free download.
function appOffers(app: LandingApp): Record<string, unknown> | Record<string, unknown>[] {
  const url = app.appStoreUrl;
  const download = {
    '@type': 'Offer',
    name: `${app.shortName} download`,
    price: app.price === 'Free' ? '0' : app.price.replace(/[^0-9.]/g, ''),
    priceCurrency: 'USD',
    url,
    availability: 'https://schema.org/InStock',
  };
  const pricing = app.content.pricing;
  const tiers = (pricing?.tiers ?? []).filter((tier) => typeof tier.amount === 'number');
  if (!pricing || tiers.length === 0) return download;
  return [
    download,
    ...tiers.map((tier) => {
      const duration = billingDuration(tier.period);
      return {
        '@type': 'Offer',
        name: `${pricing.premium.title} — ${tier.name}`,
        price: String(tier.amount),
        priceCurrency: 'USD',
        url,
        availability: 'https://schema.org/InStock',
        category: duration ? 'Subscription' : 'InAppPurchase',
        ...(duration
          ? {
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: String(tier.amount),
                priceCurrency: 'USD',
                billingDuration: duration,
              },
            }
          : {}),
      };
    }),
  ];
}

export interface AppPageOptions {
  /// Whether the page shows the App Store rating; Google only accepts a rating in the
  /// markup when readers can see it. Defaults to whenever the store has one.
  ratingShown?: boolean;
}

/// The schema.org node for an App Store app's landing page: a MobileApplication when it
/// runs on iPhone, iPad or Apple Watch, otherwise a SoftwareApplication.
export function appNode(app: LandingApp, options: AppPageOptions = {}): Record<string, unknown> {
  const ratingShown = options.ratingShown ?? (app.ratingCount > 0 && app.status !== 'review');
  const canonical = absoluteUrl(`/${app.slug}/`);
  const onAppStore = app.trackId > 0 && app.status !== 'review';
  const isMobile = app.platforms.some((p) => MOBILE_PLATFORMS.has(p));
  const minimumOs = app.platforms.some((p) => p === 'iPhone' || p === 'iPad')
    ? 'iOS'
    : app.platforms.includes('Mac')
      ? 'macOS'
      : undefined;
  const screenshots = Object.values(app.screenshots)
    .flat()
    .map((shot) => absoluteUrl(screenshotUrl(shot.src)));
  const sameAs = [onAppStore ? app.appStoreUrl : undefined, app.githubUrl].filter(Boolean);
  return {
    '@type': isMobile ? 'MobileApplication' : 'SoftwareApplication',
    '@id': `${canonical}#app`,
    name: app.name,
    ...(app.name !== app.shortName ? { alternateName: app.shortName } : {}),
    description: app.content.metaDescription,
    url: canonical,
    operatingSystem: operatingSystems(app.platforms),
    applicationCategory: googleAppCategory(app.category),
    ...(app.category ? { applicationSubCategory: app.category } : {}),
    ...(onAppStore ? { installUrl: app.appStoreUrl, downloadUrl: app.appStoreUrl } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    image: app.iconLocal ? absoluteUrl(app.iconLocal) : undefined,
    screenshot: screenshots,
    featureList: app.content.features.map((f) => f.title),
    offers: appOffers(app),
    isAccessibleForFree: app.price === 'Free',
    author: organizationRef,
    publisher: organizationRef,
    ...(app.version ? { softwareVersion: app.version } : {}),
    ...(app.content.requires
      ? { softwareRequirements: app.content.requires }
      : minimumOs && app.minimumOsVersion
        ? { softwareRequirements: `${minimumOs} ${app.minimumOsVersion} or later` }
        : {}),
    ...(app.releaseDate ? { datePublished: app.releaseDate } : {}),
    ...(app.currentVersionReleaseDate ? { dateModified: app.currentVersionReleaseDate } : {}),
    ...(ratingShown && app.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: app.rating,
            ratingCount: app.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(app.openSource
      ? {
          license: 'https://www.gnu.org/licenses/gpl-3.0.html',
          ...(app.githubUrl ? { codeRepository: app.githubUrl } : {}),
        }
      : {}),
  };
}

/// The whole JSON-LD document for an app landing page: the app, where it sits in the
/// site, and its FAQ.
export function appPageJsonLd(
  app: LandingApp,
  options: AppPageOptions = {}
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      appNode(app, options),
      breadcrumbList([
        { name: 'Apps', path: '/apps/' },
        { name: app.shortName, path: `/${app.slug}/` },
      ]),
      faqPage(app.content.faq),
    ],
  };
}
