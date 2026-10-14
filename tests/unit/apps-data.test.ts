import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import appWork from '../../src/data/app-work.json';
import { APP_HERO_SCORE, appEntries, appHeroes, appRest } from '../../src/data/apps';
import { landingSlugs } from '../../src/data/landing';

describe('apps data', () => {
  it('lists every app once, best first', () => {
    const ids = appEntries.map((entry) => entry.app.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < appEntries.length; i++) {
      expect(appEntries[i - 1].score).toBeGreaterThanOrEqual(appEntries[i].score);
    }
  });

  it('splits heroes from the rest without overlap or loss', () => {
    const ids = [...appHeroes, ...appRest].map((entry) => entry.app.id).sort();
    expect(ids).toEqual(appEntries.map((entry) => entry.app.id).sort());
  });

  it('only gives a hero row to a heavy app that has screenshots', () => {
    for (const entry of appHeroes) {
      expect(entry.score).toBeGreaterThanOrEqual(APP_HERO_SCORE);
      expect(entry.shots.length).toBeGreaterThan(0);
      expect(entry.device).toBeTruthy();
    }
  });

  it('only tracks work for apps that have a landing page', () => {
    for (const slug of Object.keys(appWork)) {
      expect(landingSlugs, slug).toContain(slug);
    }
  });
});

describe('site structure', () => {
  const root = process.cwd();

  it('redirects the retired CLI page to the Linux command-line section before the catch-all', () => {
    const rules = fs.readFileSync(path.join(root, 'public/_redirects'), 'utf8').split('\n');
    const redirect = rules.findIndex((line) => line.startsWith('/cli-tools '));
    const catchAll = rules.findIndex((line) => line.startsWith('/* '));
    expect(redirect).toBeGreaterThanOrEqual(0);
    expect(redirect).toBeLessThan(catchAll);
    expect(rules[redirect]).toContain('/linux/#command-line');
  });

  it('no longer links the retired CLI page from the nav, footer or pages', () => {
    for (const file of ['src/components/Header.astro', 'src/components/Footer.astro']) {
      expect(fs.readFileSync(path.join(root, file), 'utf8')).not.toContain('/cli-tools');
    }
    expect(fs.existsSync(path.join(root, 'src/pages/cli-tools.astro'))).toBe(false);
  });

  it('has a share image on disk for every tab that names one', () => {
    for (const name of ['opensource', 'services', 'links', 'archive']) {
      expect(fs.existsSync(path.join(root, 'public/og', `${name}.png`)), name).toBe(true);
    }
  });
});
