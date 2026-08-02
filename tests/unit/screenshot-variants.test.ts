import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import manifest from '../../src/data/screenshot-variants.json';
import factsData from '../../src/data/landing-facts.json';
import { screenshotUrl } from '../../src/data/landing';

const PUBLIC = path.join(process.cwd(), 'public');
const variants = manifest as Record<string, number[]>;
type Shot = { src: string };
const apps = (
  factsData as unknown as {
    apps: { slug: string; iconLocal?: string; screenshots?: Record<string, Shot[] | undefined> }[];
  }
).apps;

const variantSrc = (src: string, width: number) => src.replace(/\.webp$/, `@${width}.webp`);
const onDisk = (src: string) => fs.existsSync(path.join(PUBLIC, src.replace(/^\//, '')));

/// DeviceFrame and AppIcon build their srcset straight from this manifest and
/// cannot stat the filesystem at render time, so an entry with no file behind it
/// ships a 404 to every visitor.
describe('screenshot variant manifest', () => {
  it('only lists widths that were actually written to public/', () => {
    const missing = Object.entries(variants).flatMap(([src, widths]) =>
      widths.map((w) => variantSrc(src, w)).filter((file) => !onDisk(file))
    );
    expect(missing).toEqual([]);
  });

  it('has an original behind every entry', () => {
    expect(Object.keys(variants).filter((src) => !onDisk(src))).toEqual([]);
  });

  it('has a file behind every screenshot a landing page renders', () => {
    const missing = apps.flatMap((a) =>
      Object.values(a.screenshots ?? {})
        .flatMap((bucket) => bucket ?? [])
        .map((shot) => shot.src)
        .filter((src) => !onDisk(src))
    );
    expect(missing).toEqual([]);
  });

  it('covers every app icon, so no landing page ships a 512px icon at 72px', () => {
    const uncovered = apps
      .filter((a) => a.iconLocal && onDisk(a.iconLocal))
      .filter((a) => !(variants[a.iconLocal as string] ?? []).length)
      .map((a) => a.slug);
    expect(uncovered).toEqual([]);
  });
});

/// `_headers` caches `/screenshots/*` for a week on stable paths, so any shot
/// URL that skips `screenshotUrl()` keeps serving the previous release's pixels
/// until the TTL lapses. The rendered `<img>` tags were fixed when the rev was
/// introduced but the JSON-LD `screenshot` array was not, which left crawlers
/// reading a structured-data list of stale artwork.
describe('screenshot cache-busting', () => {
  const landingPage = fs.readFileSync(
    path.join(process.cwd(), 'src', 'pages', '[app].astro'),
    'utf8'
  );

  it('routes every emitted screenshot path through screenshotUrl', () => {
    const raw = [...landingPage.matchAll(/(?<!screenshotUrl\()\babs\((\w+\.)?src\b/g)].map(
      (m) => m[0]
    );
    expect(raw).toEqual([]);
  });

  it('stamps a rev onto a screenshot path', () => {
    expect(screenshotUrl('/screenshots/solarbeam/mac-1.webp')).toMatch(
      /^\/screenshots\/solarbeam\/mac-1\.webp\?v=\d+$/
    );
  });
});
