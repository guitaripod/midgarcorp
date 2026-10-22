import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { legalApps, legalPages, legalPagesFrom, parseLegalKey } from '../../src/utils/legal';
import portfolio from '../../src/generated/portfolio.json';

const siteRoot = resolve(process.cwd());
const dist = `${siteRoot}/dist/`;
const siteAasa = resolve(siteRoot, 'public/.well-known/apple-app-site-association');
const registryAasa = resolve(siteRoot, '../../registry/generated/apple-app-site-association');

const EXPECTED_PAGES = [
  'embr/privacy',
  'embr/terms',
  'flaccy/privacy',
  'helia/privacy',
  'living-dex/privacy',
  'living-dex/terms',
  'master-of-flags/privacy',
  'master-of-inventory/privacy',
  'pay-day/privacy',
  'pay-day/terms',
  'pixiepocket/privacy',
  'psybeam/privacy',
  'psywave/privacy',
  'dream-eater/privacy',
  'double-kick/privacy',
].sort();

describe('legal content', () => {
  it('pairs every legal page with a registry app', () => {
    const slugs = new Set(portfolio.apps.map((app) => app.slug));
    for (const page of legalPages()) {
      expect(slugs.has(page.slug), page.slug).toBe(true);
    }
  });

  it('keeps the expected inventory of pages', () => {
    const keys = legalPages()
      .map((page) => `${page.slug}/${page.doc}`)
      .sort();
    expect(keys).toEqual(EXPECTED_PAGES);
  });

  it('gives each app the documents its content provides', () => {
    for (const app of legalApps()) {
      expect(app.docs.length, app.slug).toBeGreaterThan(0);
      expect(app.docs[0], app.slug).toBe('privacy');
    }
  });

  it('rejects a legal folder whose slug is not in the registry', () => {
    expect(() =>
      legalPagesFrom(
        { '/src/content/legal/no-such-app/privacy.html': '<h1>x</h1>' },
        portfolio.apps
      )
    ).toThrow(/no-such-app/);
  });

  it('ignores files that are not a legal document', () => {
    expect(parseLegalKey('/src/content/legal/flaccy/README.md')).toBeNull();
    expect(parseLegalKey('/src/content/legal/flaccy/privacy.html')).toEqual({
      slug: 'flaccy',
      doc: 'privacy',
    });
  });
});

describe('legal build output', () => {
  it('has both pages of every app with legal content', () => {
    for (const app of legalApps()) {
      for (const doc of app.docs) {
        const page = `${dist}legal/${app.slug}/${doc}/index.html`;
        expect(existsSync(page), page).toBe(true);
        expect(readFileSync(page, 'utf8')).toContain(app.name.replace(/&/g, '&amp;'));
      }
    }
  });

  it('publishes the legal index', () => {
    expect(existsSync(`${dist}legal/index.html`)).toBe(true);
  });

  it('serves the AASA file byte for byte from public/.well-known', () => {
    const built = readFileSync(`${dist}.well-known/apple-app-site-association`);
    expect(built.equals(readFileSync(siteAasa))).toBe(true);
  });

  it.skipIf(!existsSync(registryAasa))(
    'keeps the public AASA file equal to the registry copy in a monorepo checkout',
    () => {
      expect(readFileSync(siteAasa).equals(readFileSync(registryAasa))).toBe(true);
    }
  );

  it('serves the AASA file as application/json without a redirect', () => {
    const headers = readFileSync(`${dist}_headers`, 'utf8');
    expect(headers).toContain(
      '/.well-known/apple-app-site-association\n  Content-Type: application/json'
    );
    expect(readFileSync(`${dist}_redirects`, 'utf8')).not.toContain('.well-known');
  });
});
