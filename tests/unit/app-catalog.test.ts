import { describe, it, expect } from 'vitest';
import appsData from '../../src/data/apps.json';

type App = {
  id: string;
  name: string;
  platforms?: string[];
  appStoreUrl?: string;
};

const apps: App[] = Array.isArray(appsData)
  ? (appsData as App[])
  : ((appsData as { apps: App[] }).apps ?? []);

/// Track ids that are another platform's build of an app already in the catalog. The generator
/// reads a developer-wide iTunes lookup, which returns every record, so each of these would
/// otherwise appear as its own card next to the app it belongs to.
const COMPANION_EDITION_IDS = ['6789594504']; // Flaccy for Mac

describe('app catalog', () => {
  it('lists every app exactly once', () => {
    const ids = apps.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives each App Store record a single entry', () => {
    const trackIds = apps
      .map((a) => a.appStoreUrl?.match(/id(\d+)/)?.[1])
      .filter((id): id is string => Boolean(id));
    expect(new Set(trackIds).size).toBe(trackIds.length);
  });

  it('excludes companion editions of apps already listed', () => {
    const trackIds = apps.map((a) => a.appStoreUrl?.match(/id(\d+)/)?.[1]);
    for (const companion of COMPANION_EDITION_IDS) {
      expect(trackIds, `companion edition ${companion} must not get its own card`)
        .not.toContain(companion);
    }
  });

  it("advertises Mac on Flaccy rather than as a second entry", () => {
    const flaccy = apps.find((a) => a.id === 'flaccy');
    expect(flaccy, 'flaccy entry').toBeDefined();
    expect(flaccy?.platforms ?? []).toContain('Mac');
    const named = apps.filter((a) => /flaccy/i.test(a.name));
    expect(named).toHaveLength(1);
  });
});
