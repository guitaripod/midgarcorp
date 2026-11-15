import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import copy from '../../src/data/landing/crucible.json';
import manifest from '../../src/data/screenshot-variants.json';

const ROOT = process.cwd();
const page = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'crucible', 'index.astro'), 'utf8');
const prose = page.replace(/\s+/g, ' ');
const appRoute = fs.readFileSync(path.join(ROOT, 'src', 'pages', '[app].astro'), 'utf8');
const variants = manifest as Record<string, number[]>;

const onDisk = (rel: string) => fs.existsSync(path.join(ROOT, 'public', rel.replace(/^\//, '')));

/// Every figure the page names through `phone(...)`, `pad(...)`, `tv(...)` or `figure(...)`, as its public path.
const referencedFigures = (): string[] => {
  const names = new Set<string>();
  for (const m of page.matchAll(/\bphone\('([^']+)'\)/g)) names.add(`phone-${m[1]}`);
  for (const m of page.matchAll(/\bpad\('([^']+)'\)/g)) names.add(`ipad-${m[1]}`);
  for (const m of page.matchAll(/\btv\('([^']+)'\)/g)) names.add(`tv-${m[1]}`);
  for (const m of page.matchAll(/\bfigure\('([^']+)'\s*,/g)) names.add(m[1]);
  names.delete('phone-${name}');
  names.delete('ipad-${name}');
  names.delete('tv-${name}');
  return [...names].map((name) => `/screenshots/crucible/web-${name}.webp`);
};

describe('Crucible landing page', () => {
  it('is the only page that renders /crucible/', () => {
    expect(appRoute).toContain("'crucible'");
  });

  it('ships every figure it references, with the variants its srcset cites', () => {
    const figures = referencedFigures();
    expect(figures.length).toBeGreaterThan(8);
    for (const src of figures) {
      expect(onDisk(src), src).toBe(true);
      for (const width of variants[src] ?? []) {
        expect(onDisk(src.replace(/\.webp$/, `@${width}.webp`)), `${src} @${width}`).toBe(true);
      }
    }
  });

  it('serves the display face it declares', () => {
    expect(page).toContain("url('/fonts/archivo-var-latin.woff2')");
    expect(onDisk('/fonts/archivo-var-latin.woff2')).toBe(true);
  });

  it('keeps the trademark, Trakt and Plex Pass lines', () => {
    expect(prose).toContain('not made by, endorsed by or affiliated with Plex, Inc.');
    expect(prose).toContain('Plex is a trademark of Plex, Inc.');
    expect(prose).toContain('uses Trakt but is not endorsed or certified by Trakt');
    expect(prose).toContain('Remote Watch Pass');
  });

  it('states what Crucible Pro costs and that the annual plan renews', () => {
    expect(page).toContain('c.pricing.tiers.map');
    expect(page).toContain('c.pricing.footnote');
    const tiers = copy.pricing.tiers.map((tier) => tier.price);
    expect(tiers).toEqual(expect.arrayContaining(['$17.99', '$7.99']));
    expect(copy.pricing.footnote).toMatch(/renews automatically/);
  });

  it('speaks as the developer, never as a company', () => {
    const markup = page.split('<style>')[0];
    expect(markup).not.toMatch(/\b(we|our|us)\b/i);
  });

  it('respects reduced motion', () => {
    expect(page).toContain('@media (prefers-reduced-motion: no-preference)');
  });
});
