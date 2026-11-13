import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import factsData from '../../src/data/landing-facts.json';
import copy from '../../src/data/landing/tailscode.json';
import manifest from '../../src/data/screenshot-variants.json';

const ROOT = process.cwd();
const page = fs.readFileSync(path.join(ROOT, 'src', 'pages', 'tailscode', 'index.astro'), 'utf8');
const facts = (
  factsData as unknown as {
    apps: {
      slug: string;
      name: string;
      description: string;
      keywords: string;
      platforms: string[];
    }[];
  }
).apps.find((a) => a.slug === 'tailscode')!;
const variants = manifest as Record<string, number[]>;

const onDisk = (rel: string) => fs.existsSync(path.join(ROOT, 'public', rel.replace(/^\//, '')));

/// Every screenshot name the page hands to `faces(...)`, `phone(...)` or `shot(...)`.
const referencedShots = (): string[] => {
  const names = new Set<string>();
  for (const m of page.matchAll(/faces\(\s*'([^']+)'\s*,\s*'([^']+)'/g)) {
    names.add(m[1]);
    names.add(m[2]);
  }
  for (const m of page.matchAll(/\bphone\('([^']+)'\)/g)) names.add(`phone-${m[1]}`);
  for (const m of page.matchAll(/\bshot\('([^']+)'\)/g)) names.add(m[1]);
  for (const m of page.matchAll(/phoneRoles = \[([^\]]+)\]/g)) {
    for (const role of m[1].matchAll(/'([^']+)'/g)) names.add(`phone-${role[1]}`);
  }
  return [...names];
};

describe('Tailscode landing page', () => {
  it('names the app the way the store does', () => {
    expect(facts.name).toBe('Tailscode: Coding Agent Remote');
    expect(
      facts.description.startsWith(
        "Your coding agents don't stop when you leave the desk, so neither should you."
      )
    ).toBe(true);
    expect(facts.keywords).toContain('tailnet');
  });

  it('has a file behind every screenshot the page names', () => {
    const missing = referencedShots().filter(
      (name) => !onDisk(`screenshots/tailscode/${name}.webp`)
    );
    expect(missing).toEqual([]);
  });

  it('has responsive variants for every shot that is listed in the facts', () => {
    const listed = Object.values(
      (
        factsData as unknown as {
          apps: { slug: string; screenshots: Record<string, { src: string }[]> }[];
        }
      ).apps.find((a) => a.slug === 'tailscode')!.screenshots
    ).flat();
    const bare = listed.filter((s) => !(variants[s.src] ?? []).length).map((s) => s.src);
    expect(bare).toEqual([]);
  });

  it('ships the promo video in both containers with a poster', () => {
    for (const file of ['video/tailscode-promo.mp4', 'video/tailscode-promo.webm']) {
      expect(onDisk(file), file).toBe(true);
    }
    expect(onDisk('screenshots/tailscode/promo-poster.webp')).toBe(true);
  });

  it('keeps the head tags inside what a result page shows', () => {
    expect(copy.seoTitle.length).toBeLessThanOrEqual(65);
    expect(copy.metaDescription.length).toBeLessThanOrEqual(165);
  });

  it('says nothing that went stale when iOS 1.75 shipped', () => {
    const all = JSON.stringify(copy) + page;
    expect(all).not.toMatch(/iOS 1\.73/);
    expect(all).not.toMatch(/arrive with 1\.78/);
    expect(all).not.toMatch(/now in App Review/i);
    expect(all).not.toMatch(/Linux is in the AUR and on the App Store/);
  });

  it("leads with the store's header line and keeps the trust claim beside it", () => {
    expect(copy.heroHeadline).toBe('Leave your desk. Your agent finds you.');
    for (const fact of ['No relay', 'No sign-in', 'No tracking', 'GPL-3.0']) {
      expect(page).toContain(fact);
    }
  });

  it("tells the store's story in the store's order", () => {
    const at = (id: string) => page.indexOf(`<section id="${id}"`);
    const order = ['setup', 'agents', 'models', 'lockscreen', 'transcript', 'money', 'trust'];
    const found = order.map(at);
    expect(found.every((i) => i >= 0)).toBe(true);
    expect([...found].sort((a, b) => a - b)).toEqual(found);
    expect(page).not.toContain('man tailscode');
  });

  it("captions the store's ten iPhone panels, one per role", () => {
    const roles = /phoneRoles = \[([^\]]+)\]/.exec(page)![1].match(/'([^']+)'/g)!;
    expect(roles).toHaveLength(10);
    expect(copy.screenshotCaptions.iphone).toHaveLength(roles.length);
    for (const caption of copy.screenshotCaptions.iphone) expect(caption).toContain(' — ');
  });

  it('makes no privacy claim the App Privacy label contradicts', () => {
    const policy = fs.readFileSync(
      path.join(ROOT, 'src', 'pages', 'tailscode', 'privacy.astro'),
      'utf8'
    );
    const all = JSON.stringify(copy) + page + policy;
    expect(all).not.toMatch(/collects nothing\.|zero collected|no analytics|no account/i);
    for (const row of ['User ID', 'Device ID', 'Purchase History', 'Product Interaction']) {
      expect(policy).toContain(row);
    }
  });

  it('answers the questions a buyer asks, and the JSON-LD mirrors them', () => {
    const questions = copy.faq.map((f) => f.q);
    for (const q of [
      'Is it free?',
      'What do I need?',
      'Is my code sent anywhere?',
      'Does it work without Tailscale?',
    ]) {
      expect(questions).toContain(q);
    }
    expect(page).toContain('appPageJsonLd(app, { ratingShown: showsRating })');
  });

  it('keeps the delegate board the last perk of Pro', () => {
    const items = copy.pricing.premium.items;
    expect(items[items.length - 1]).toMatch(/delegate/i);
  });
});
