import { describe, it, expect } from 'vitest';
import { siblingApps } from '../../src/utils/sibling-apps';
import { landingApps } from '../../src/data/landing';

const apps = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((slug, index) => ({
  slug,
  releaseDate: new Date(Date.UTC(2026, 0, 30 - index)).toISOString(),
}));

describe('sibling apps', () => {
  it('leads with the newest releases, then the apps after this one', () => {
    expect(siblingApps(apps, 'h').map((app) => app.slug)).toEqual(['a', 'b', 'c', 'i', 'j', 'd']);
    expect(siblingApps(apps, 'a').map((app) => app.slug)).toEqual(['b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('never links an app to itself or twice', () => {
    for (const app of apps) {
      const picked = siblingApps(apps, app.slug).map((a) => a.slug);
      expect(picked).not.toContain(app.slug);
      expect(new Set(picked).size).toBe(picked.length);
      expect(picked).toHaveLength(6);
    }
  });

  it('links every landing app from at least three other app pages', () => {
    const inbound = new Map(landingApps.map((app) => [app.slug, 0]));
    for (const app of landingApps) {
      for (const sibling of siblingApps(landingApps, app.slug)) {
        inbound.set(sibling.slug, (inbound.get(sibling.slug) ?? 0) + 1);
      }
    }
    for (const [slug, count] of inbound) expect(count, slug).toBeGreaterThanOrEqual(3);
  });
});
