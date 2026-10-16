import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  linuxApps,
  linuxSections,
  linuxStats,
  featuredLinuxApps,
  linuxScore,
  LINUX_SHOWCASE,
  shotSrcset,
} from '../../src/data/linux';

describe('linux data module', () => {
  it('exposes at least one Linux app', () => {
    expect(linuxApps.length).toBeGreaterThan(0);
  });

  it('gives every app complete, owner-scoped metadata', () => {
    for (const app of linuxApps) {
      expect(app.name, `${app.id} name`).toBeTruthy();
      expect(app.githubUrl, `${app.id} githubUrl`).toMatch(/^https:\/\/github\.com\/guitaripod\//);
      expect(app.description, `${app.id} description`).toBeTruthy();
    }
  });

  it('gives every app a usable primary install command', () => {
    for (const app of linuxApps) {
      expect(app.install.primary, `${app.id} primary`).toBeTruthy();
      expect(app.install.primary.command.trim().length, `${app.id} command`).toBeGreaterThan(0);
      expect(app.install.primary.label.trim().length, `${app.id} label`).toBeGreaterThan(0);
      expect(app.install.all[0]).toEqual(app.install.primary);
    }
  });

  it('never leaks the pre-rename username or a fabricated value', () => {
    for (const app of linuxApps) {
      for (const channel of app.install.all) {
        expect(channel.command, `${app.id}/${channel.channel}`).not.toContain('marcusziade');
        expect(channel.command).not.toContain('undefined');
        expect(channel.command).not.toContain('null');
      }
    }
  });

  it('omits go install (stale/broken module paths post-rename)', () => {
    for (const app of linuxApps) {
      for (const channel of app.install.all) {
        expect(channel.command.startsWith('go install '), `${app.id}`).toBe(false);
      }
    }
  });

  it('only advertises a download link when a Linux binary exists', () => {
    for (const app of linuxApps) {
      if (app.linuxBinaryUrl) {
        expect(app.hasLinuxBinary, `${app.id}`).toBe(true);
        expect(app.linuxBinaryUrl).toMatch(/^https:\/\/github\.com\/guitaripod\//);
      }
    }
  });

  it('places every app in exactly one section and one tier', () => {
    const placed = linuxSections.flatMap((section) =>
      [section.heroes, section.showcase, section.featured, section.compact].flat()
    );
    const ids = placed.map((app) => app.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(linuxApps.map((a) => a.id).sort());
    for (const section of linuxSections) {
      const apps = [section.heroes, section.showcase, section.featured, section.compact].flat();
      expect(
        apps.every((app) => app.theme === section.theme),
        section.theme
      ).toBe(true);
      expect(section.totals.apps).toBe(apps.length);
    }
  });

  it('gives every app a valid theme, a commit count and a release history', () => {
    for (const app of linuxApps) {
      expect(['desktop', 'agents', 'system', 'tools'], app.id).toContain(app.theme);
      expect(app.commitCount, `${app.id} commits`).toBeGreaterThan(0);
      expect(app.releaseCount, `${app.id} releases`).toBeGreaterThan(0);
    }
  });

  it('records a release date for every release it counts', () => {
    for (const app of linuxApps) {
      expect(app.releaseDates.length, `${app.id} dates`).toBe(app.releaseCount);
      for (const date of app.releaseDates) {
        expect(Number.isNaN(new Date(date).getTime()), `${app.id} ${date}`).toBe(false);
      }
      if (app.latestReleaseDate) {
        expect(app.releaseDates, `${app.id} latest`).toContain(app.latestReleaseDate);
      }
    }
  });

  it('only features apps that are on the page and have their screenshots on disk', () => {
    const ids = new Set(linuxApps.map((a) => a.id));
    const onDisk = (src: string) => fs.existsSync(path.join(process.cwd(), 'public', src));
    for (const [id, showcase] of Object.entries(LINUX_SHOWCASE)) {
      expect(ids.has(id), `${id} is in linux-apps.json`).toBe(true);
      for (const shot of [showcase.shot, ...showcase.more]) {
        expect(onDisk(shot.src), shot.src).toBe(true);
        for (const width of shot.widths) {
          expect(
            onDisk(shot.src.replace(/\.webp$/, `@${width}.webp`)),
            `${shot.src}@${width}`
          ).toBe(true);
        }
        expect(shot.alt.length).toBeGreaterThan(10);
      }
    }
  });

  it('builds a srcset from the variants plus the original', () => {
    const srcset = shotSrcset({
      src: '/a/b.webp',
      w: 1920,
      h: 1080,
      alt: 'x',
      widths: [480, 960],
    });
    expect(srcset).toBe('/a/b@480.webp 480w, /a/b@960.webp 960w, /a/b.webp 1920w');
  });

  it('keeps stats consistent with the app list', () => {
    expect(linuxStats.appCount).toBe(linuxApps.length);
    expect(linuxStats.releaseCount).toBe(linuxApps.reduce((sum, a) => sum + a.releaseCount, 0));
    expect(linuxStats.starCount).toBe(linuxApps.reduce((sum, a) => sum + a.stars, 0));
    expect(linuxStats.languages.length).toBeGreaterThan(0);
    for (const lang of linuxStats.languages) {
      expect(['Rust', 'Go', 'C++', 'Swift', 'Python']).toContain(lang);
    }
    expect(linuxStats.commitCount).toBe(linuxApps.reduce((sum, a) => sum + a.commitCount, 0));
  });

  it('orders apps by the work behind them: commits and releases, stars barely count', () => {
    for (let i = 1; i < linuxApps.length; i++) {
      expect(
        linuxScore(linuxApps[i - 1]),
        `${linuxApps[i - 1].id} before ${linuxApps[i].id}`
      ).toBeGreaterThanOrEqual(linuxScore(linuxApps[i]));
    }
    const top = linuxApps.slice(0, 2).map((app) => app.id);
    expect(top).toContain('tailscode');
    expect(top).toContain('unrager');
  });

  it('discovers shipped tools while excluding SDKs and web apps', () => {
    const ids = new Set(linuxApps.map((a) => a.id));
    // Auto-discovered Rust/Go/C++ tools that ship releases.
    for (const id of [
      'themeswitch',
      'circadia',
      'flyr',
      'unrager',
      'recview',
      'tailscode',
      'claude-bridge',
      'blackwall',
      'tokenmaxxing',
      'imago',
    ]) {
      expect(ids.has(id), `expected ${id} on /linux`).toBe(true);
    }
    // Libraries and web apps must never be discovered.
    for (const id of ['lastfm-rs', 'nasa-rs', 'musickitkat', 'emobanana']) {
      expect(ids.has(id), `${id} should not be on /linux`).toBe(false);
    }
  });

  it('features the highest-scoring apps first on the homepage teaser', () => {
    const featured = featuredLinuxApps(3);
    expect(featured.length).toBeLessThanOrEqual(3);
    expect(featured).toEqual(linuxApps.slice(0, featured.length));
    expect(featuredLinuxApps(2, [linuxApps[0].id]).map((a) => a.id)).not.toContain(linuxApps[0].id);
  });
});
