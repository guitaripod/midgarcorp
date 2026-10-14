import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import factsData from '../../src/data/landing-facts.json';
import manifest from '../../src/data/screenshot-variants.json';
import dreameater from '../../src/data/landing/dreameater.json';
import masterofflags from '../../src/data/landing/masterofflags.json';
import masterofinventory from '../../src/data/landing/masterofinventory.json';

type Shot = { src: string };
type Facts = { slug: string; screenshots: Record<string, Shot[]> };
type Copy = {
  seoTitle: string;
  metaDescription: string;
  screenshotCaptions: Record<string, string[]>;
  pricing: { tiers: { price: string }[]; footnote: string };
};

const facts = (factsData as unknown as { apps: Facts[] }).apps;
const variants = manifest as Record<string, number[]>;
const pages: Record<string, Copy> = {
  dreameater: dreameater as unknown as Copy,
  masterofflags: masterofflags as unknown as Copy,
  masterofinventory: masterofinventory as unknown as Copy,
};

const strings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
};

describe.each(Object.keys(pages))('%s landing page', (slug) => {
  const copy = pages[slug];
  const app = facts.find((a) => a.slug === slug)!;

  it('captions every store screenshot of every device', () => {
    for (const [device, shots] of Object.entries(app.screenshots)) {
      expect(copy.screenshotCaptions[device]?.length, `${slug} ${device}`).toBe(shots.length);
    }
  });

  it('has a file and responsive variants behind every screenshot', () => {
    for (const shot of Object.values(app.screenshots).flat()) {
      const file = path.join(process.cwd(), 'public', shot.src.replace(/^\//, ''));
      expect(fs.existsSync(file), shot.src).toBe(true);
      expect(variants[shot.src]?.length, shot.src).toBeGreaterThan(0);
    }
  });

  it('keeps the head tags inside what a result page shows', () => {
    expect(copy.seoTitle.length).toBeLessThanOrEqual(65);
    expect(copy.metaDescription.length).toBeLessThanOrEqual(165);
  });

  it('states every price it lists', () => {
    const all = strings(copy).join(' ');
    for (const tier of copy.pricing.tiers) expect(all).toContain(tier.price);
  });

  it('uses no em dashes in the copy', () => {
    expect(strings(copy).filter((s) => s.includes('—'))).toEqual([]);
  });
});

describe('subscription disclosure', () => {
  it.each(['dreameater', 'masterofinventory'])('%s says subscriptions auto-renew', (slug) => {
    expect(pages[slug].pricing.footnote).toMatch(/renew automatically/);
  });
});
