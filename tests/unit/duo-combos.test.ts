import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import manifest from '../../src/data/duo-combos.json';
import { duoCombo } from '../../src/data/duo';
import factsData from '../../src/data/landing-facts.json';

const PUBLIC = path.join(process.cwd(), 'public');
const entries = manifest as Record<string, { w: number; h: number; widths: number[] }>;
const onDisk = (file: string) => fs.existsSync(path.join(PUBLIC, 'duo', file));
const pageSource = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const apps = (factsData as unknown as { apps: { slug: string; platforms: string[] }[] }).apps;

/// DuoCombo builds its srcset straight from this manifest and cannot stat the
/// filesystem at render time, so an entry with no file behind it is a 404 for every visitor.
describe('iPhone Duo combo images', () => {
  it('has a file behind every manifest entry and width', () => {
    const missing = Object.entries(entries).flatMap(([slug, entry]) =>
      [`${slug}.webp`, ...entry.widths.map((w) => `${slug}@${w}.webp`)].filter(
        (file) => !onDisk(file)
      )
    );
    expect(missing).toEqual([]);
  });

  it('has an entry behind every file in public/duo', () => {
    const orphans = fs
      .readdirSync(path.join(PUBLIC, 'duo'))
      .filter((file) => !(file.replace(/(@\d+)?\.webp$/, '') in entries));
    expect(orphans).toEqual([]);
  });

  it('gives every iPhone landing page a combo, and no Mac-only app one', () => {
    const iphone = apps.filter((a) => a.platforms.includes('iPhone')).map((a) => a.slug);
    expect(iphone.filter((slug) => !(slug in entries))).toEqual([]);
    const macOnly = apps.filter((a) => !a.platforms.includes('iPhone')).map((a) => a.slug);
    expect(macOnly.filter((slug) => slug in entries)).toEqual([]);
  });

  it('lists the largest width last in the srcset', () => {
    const combo = duoCombo('dreameater');
    expect(combo?.srcset.endsWith(`${entries.dreameater.w}w`)).toBe(true);
    expect(duoCombo('sforesight')).toBeUndefined();
  });

  it('is rendered by the shared landing template and the bespoke Tailscode page', () => {
    expect(pageSource('src/pages/[app].astro')).toContain('<DuoCombo slug={app.slug}');
    expect(pageSource('src/pages/tailscode/index.astro')).toContain('<DuoCombo slug="tailscode"');
  });
});
