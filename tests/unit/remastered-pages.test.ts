import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import manifest from '../../src/data/screenshot-variants.json';
import solarbeam from '../../src/data/landing/solarbeam.json';

const ROOT = process.cwd();
const read = (...parts: string[]) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const onDisk = (rel: string) => fs.existsSync(path.join(ROOT, 'public', rel.replace(/^\//, '')));
const variants = manifest as Record<string, number[]>;
const appRoute = read('src', 'pages', '[app].astro');

/// The page's markup without the words in it that only look like a company speaking: the Webb
/// sphere Our Solar System, US dollars, the en-US locale and the first line of Flaccy's demo song.
const voice = (page: string) =>
  page
    .split('<style>')[0]
    .replace(/\s+/g, ' ')
    .replace(/Our Solar System|US dollars|'en-US'|We are the miles we never squandered/g, '');

/// Every webp the page names under /screenshots/, as its public path.
const figures = (page: string) => [
  ...new Set(
    [...page.matchAll(/\/screenshots\/[a-z]+\/[a-z0-9@/-]+\.webp/g)]
      .map((m) => m[0])
      .filter((src) => !src.includes('${'))
  ),
];

const PAGES = [
  {
    slug: 'solarbeam',
    font: '/fonts/instrument-serif-latin.woff2',
    prefixed: (page: string) =>
      [...page.matchAll(/\b(?:phone|pad|mac|screen)\('([^']+)'\)/g)].map((m) => {
        const kind = m[0].split('(')[0];
        const name = { phone: 'phone-', pad: 'ipad-', mac: 'mac-', screen: '' }[kind] + m[1];
        return `/screenshots/solarbeam/web-${name}.webp`;
      }),
  },
  {
    slug: 'masterofflags',
    font: '/fonts/fraunces-var-latin.woff2',
    prefixed: (page: string) =>
      [...page.matchAll(/\b(phone|pad|mac)\('([^']+)'\)/g)].map(
        (m) =>
          `/screenshots/masterofflags/web-${{ phone: 'phone', pad: 'ipad', mac: 'mac' }[m[1]]}-${m[2]}.webp`
      ),
  },
];

describe.each(PAGES)('$slug landing page', ({ slug, font, prefixed }) => {
  const page = read('src', 'pages', slug, 'index.astro');

  it('is the only page that renders its route', () => {
    expect(appRoute).toContain(`'${slug}'`);
  });

  it('ships every figure it references, with the variants its srcset cites', () => {
    const all = [...new Set([...figures(page), ...prefixed(page)])];
    expect(all.length).toBeGreaterThan(4);
    for (const src of all) {
      expect(onDisk(src), src).toBe(true);
      for (const width of variants[src] ?? []) {
        expect(onDisk(src.replace(/\.webp$/, `@${width}.webp`)), `${src} @${width}`).toBe(true);
      }
    }
  });

  it('serves the display face it declares', () => {
    expect(page).toContain(`url('${font}')`);
    expect(onDisk(font)).toBe(true);
  });

  it('speaks as the developer, never as a company', () => {
    expect(voice(page)).not.toMatch(/\b(we|our|us)\b/i);
  });

  it('respects reduced motion', () => {
    expect(page).toContain('prefers-reduced-motion');
  });

  it('marks up a rating only beside a visible one', () => {
    expect(page).toContain('ratingShown: showsRating');
    expect(page).toContain('showsRating && ');
  });
});

describe('Solar Beam page', () => {
  const page = read('src', 'pages', 'solarbeam', 'index.astro').replace(/\s+/g, ' ');

  it('keeps the ESA/Webb licence and the independence line', () => {
    expect(page).toContain('CC BY 4.0');
    expect(page).toContain('not affiliated with or endorsed by NASA, ESA, CSA or STScI');
  });

  it('never calls the sunshield temperatures live', () => {
    expect(page).toContain('commissioning readings');
  });

  it('prices every Planetarium sphere the way the store does', () => {
    for (const price of ['$4.99', '$6.99', '$19.99', '$14.99', '$39.99']) {
      expect(page).toContain(price);
    }
    expect(solarbeam.pricing.footnote).toContain('$6.99 for Picture of the Month');
  });

  it('textures every sphere of the drawing with a file that exists', () => {
    const ids = [...page.matchAll(/id: '([a-z]+)', name:/g)].map((m) => m[1]);
    expect(ids).toHaveLength(10);
    for (const id of ids)
      expect(onDisk(`/screenshots/solarbeam/spheres/${id}.webp`), id).toBe(true);
  });
});

describe('Master of Flags page', () => {
  const page = read('src', 'pages', 'masterofflags', 'index.astro');
  const rounds = [...page.matchAll(/answer: '([A-Z]{3})',[\s\S]*?options: \[([^\]]+)\]/g)].map(
    (m) => ({ answer: m[1], options: m[2].match(/[A-Z]{3}/g) ?? [] })
  );

  it('asks five rounds, each with its answer among three different flags', () => {
    expect(rounds).toHaveLength(5);
    for (const round of rounds) {
      expect(round.options).toHaveLength(3);
      expect(new Set(round.options).size).toBe(3);
      expect(round.options).toContain(round.answer);
    }
  });

  it('names and ships every flag the quiz can show', () => {
    for (const code of rounds.flatMap((r) => r.options)) {
      expect(page).toMatch(new RegExp(`${code}: '`));
      expect(onDisk(`/screenshots/masterofflags/flags/${code.toLowerCase()}.webp`), code).toBe(
        true
      );
    }
  });

  it('draws its hero from the flag wall', () => {
    expect(onDisk('/screenshots/masterofflags/flags/wall.webp')).toBe(true);
  });
});
