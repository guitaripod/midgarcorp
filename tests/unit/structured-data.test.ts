import { describe, it, expect } from 'vitest';
import {
  ORGANIZATION_ID,
  PERSON_ID,
  WEBSITE_ID,
  appNode,
  appPageJsonLd,
  billingDuration,
  breadcrumbList,
  googleAppCategory,
  operatingSystems,
  siteGraph,
} from '../../src/utils/structured-data';
import { absoluteUrl, canonicalLink } from '../../src/utils/site-url';
import { landingApps } from '../../src/data/landing';

const GOOGLE_APP_TYPES = new Set([
  'GameApplication',
  'SocialNetworkingApplication',
  'TravelApplication',
  'ShoppingApplication',
  'SportsApplication',
  'LifestyleApplication',
  'BusinessApplication',
  'DesignApplication',
  'DeveloperApplication',
  'DriverApplication',
  'EducationalApplication',
  'HealthApplication',
  'FinanceApplication',
  'SecurityApplication',
  'BrowserApplication',
  'CommunicationApplication',
  'DesktopEnhancementApplication',
  'EntertainmentApplication',
  'MultimediaApplication',
  'HomeApplication',
  'UtilitiesApplication',
  'ReferenceApplication',
]);

describe('site urls', () => {
  it('gives a page path the trailing slash and leaves files and queries alone', () => {
    expect(absoluteUrl('/')).toBe('https://midgarcorp.cc/');
    expect(absoluteUrl('/apps')).toBe('https://midgarcorp.cc/apps/');
    expect(absoluteUrl('/apps/')).toBe('https://midgarcorp.cc/apps/');
    expect(absoluteUrl('/og/flaccy.png?v=13')).toBe('https://midgarcorp.cc/og/flaccy.png?v=13');
    expect(absoluteUrl('/flaccy?ref=x#faq')).toBe('https://midgarcorp.cc/flaccy/?ref=x#faq');
    expect(absoluteUrl('https://apps.apple.com/app/id1')).toBe('https://apps.apple.com/app/id1');
  });

  it('canonicalizes only links back to this site', () => {
    expect(canonicalLink('https://midgarcorp.cc/imago')).toBe('https://midgarcorp.cc/imago/');
    expect(canonicalLink('https://midgarcorp.cc')).toBe('https://midgarcorp.cc/');
    expect(canonicalLink('https://midgarcorp.cc.example.com/x')).toBe(
      'https://midgarcorp.cc.example.com/x'
    );
    expect(canonicalLink('https://github.com/guitaripod/imago')).toBe(
      'https://github.com/guitaripod/imago'
    );
  });
});

describe('structured data', () => {
  it('declares the website, studio and developer once, linked by id', () => {
    const [website, organization, person] = siteGraph('/apple-touch-icon.png');
    expect(website).toMatchObject({ '@type': 'WebSite', '@id': WEBSITE_ID, name: 'Midgar Corp' });
    expect(website.publisher).toEqual({ '@id': ORGANIZATION_ID });
    expect(organization).toMatchObject({
      '@type': 'Organization',
      '@id': ORGANIZATION_ID,
      name: 'Midgar Oy',
      logo: 'https://midgarcorp.cc/apple-touch-icon.png',
      founder: { '@id': PERSON_ID },
    });
    expect(organization).not.toHaveProperty('aggregateRating');
    expect(person).toMatchObject({ '@type': 'Person', '@id': PERSON_ID, name: 'guitaripod' });
  });

  it('builds breadcrumbs from Home with canonical URLs', () => {
    const crumbs = breadcrumbList([{ name: 'Apps', path: '/apps' }]) as {
      itemListElement: { position: number; item: string }[];
    };
    expect(crumbs.itemListElement.map((step) => [step.position, step.item])).toEqual([
      [1, 'https://midgarcorp.cc/'],
      [2, 'https://midgarcorp.cc/apps/'],
    ]);
  });

  it('names renewal periods as ISO 8601 durations and one-time purchases as none', () => {
    expect(billingDuration('P1M')).toBe('P1M');
    expect(billingDuration('year')).toBe('P1Y');
    expect(billingDuration('one-time')).toBeUndefined();
    expect(billingDuration(undefined)).toBeUndefined();
  });

  it('maps store categories onto Google app types and platforms onto operating systems', () => {
    expect(googleAppCategory('Photo & Video')).toBe('MultimediaApplication');
    expect(googleAppCategory('Developer Tools')).toBe('DeveloperApplication');
    expect(operatingSystems(['iPhone', 'iPad', 'Mac', 'Linux'])).toBe('iOS, iPadOS, macOS, Linux');
  });

  it('describes every app page with a supported app type and a price Google can read', () => {
    for (const app of landingApps) {
      const node = appNode(app);
      expect(GOOGLE_APP_TYPES.has(node.applicationCategory as string), app.slug).toBe(true);
      expect(node.url).toBe(`https://midgarcorp.cc/${app.slug}/`);
      const offers = [node.offers].flat() as { price: string; priceCurrency: string }[];
      expect(offers.length, app.slug).toBeGreaterThan(0);
      for (const offer of offers) expect(offer.price, app.slug).toMatch(/^\d+(\.\d+)?$/);
      if (app.ratingCount > 0) expect(node.aggregateRating, app.slug).toBeTruthy();
      else expect(node, app.slug).not.toHaveProperty('aggregateRating');
    }
  });

  it('mirrors each app FAQ and sits the app under /apps/ in its breadcrumb', () => {
    for (const app of landingApps) {
      const graph = (appPageJsonLd(app) as { '@graph': Record<string, unknown>[] })['@graph'];
      const faq = graph.find((node) => node['@type'] === 'FAQPage') as {
        mainEntity: { name: string }[];
      };
      expect(faq.mainEntity.map((q) => q.name)).toEqual(app.content.faq.map((f) => f.q));
      const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList') as {
        itemListElement: { item: string }[];
      };
      expect(crumbs.itemListElement.map((step) => step.item)).toEqual([
        'https://midgarcorp.cc/',
        'https://midgarcorp.cc/apps/',
        `https://midgarcorp.cc/${app.slug}/`,
      ]);
    }
  });
});
