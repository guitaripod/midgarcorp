import { describe, it, expect } from 'vitest';
import { linuxApps, linuxGroups, linuxStats, featuredLinuxApps } from '../../src/data/linux';

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

  it('partitions apps into non-overlapping groups covering the whole set', () => {
    const grouped = linuxGroups.flatMap((section) => section.apps.map((app) => app.id));
    expect(new Set(grouped).size).toBe(grouped.length);
    expect(grouped.sort()).toEqual(linuxApps.map((a) => a.id).sort());
  });

  it('keeps stats consistent with the app list', () => {
    expect(linuxStats.appCount).toBe(linuxApps.length);
    expect(linuxStats.releaseCount).toBe(linuxApps.reduce((sum, a) => sum + a.releaseCount, 0));
    expect(linuxStats.starCount).toBe(linuxApps.reduce((sum, a) => sum + a.stars, 0));
    expect(linuxStats.languages.length).toBeGreaterThan(0);
    for (const lang of linuxStats.languages) {
      expect(['Rust', 'Go', 'C++']).toContain(lang);
    }
  });

  it('leads with the flagship desktop apps', () => {
    expect(linuxApps[0]?.id).toBe('flaccy');
    expect(linuxApps[1]?.id).toBe('emojipick');
  });

  it('discovers shipped tools while excluding SDKs and web apps', () => {
    const ids = new Set(linuxApps.map((a) => a.id));
    // Auto-discovered Rust/Go/C++ tools that ship releases.
    for (const id of ['themeswitch', 'circadia', 'flyr', 'unrager']) {
      expect(ids.has(id), `expected ${id} on /linux`).toBe(true);
    }
    // Libraries and web apps must never be discovered.
    for (const id of ['lastfm-rs', 'nasa-rs', 'musickitkat', 'emobanana']) {
      expect(ids.has(id), `${id} should not be on /linux`).toBe(false);
    }
  });

  it('sorts the non-lead apps by release count, then stars', () => {
    const lead = new Set(['flaccy', 'emojipick']);
    const tail = linuxApps.filter((app) => !lead.has(app.id));
    for (let i = 1; i < tail.length; i++) {
      const prev = tail[i - 1];
      const curr = tail[i];
      const ordered =
        prev.releaseCount > curr.releaseCount ||
        (prev.releaseCount === curr.releaseCount && prev.stars >= curr.stars);
      expect(ordered, `${prev.id} before ${curr.id}`).toBe(true);
    }
  });

  it('features the lead apps first on the homepage teaser', () => {
    const featured = featuredLinuxApps(3);
    expect(featured.length).toBeLessThanOrEqual(3);
    expect(featured).toEqual(linuxApps.slice(0, featured.length));
    expect(featured[0]?.id).toBe('flaccy');
  });
});
