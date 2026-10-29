import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const siteRoot = resolve(process.cwd());
const dist = `${siteRoot}/dist/`;
const legalRoot = `${siteRoot}/src/content/legal`;

const SENTENCE =
  'Midgar may publish aggregate statistics built from anonymous counts, such as weekly active installs, which never identify a person';

const SEPARATE_POLICIES = [
  { name: 'tailscode', source: 'src/pages/tailscode/privacy.astro', page: 'tailscode/privacy' },
  { name: 'crucible', source: 'src/pages/crucible/privacy.astro', page: 'crucible/privacy' },
];

const legalSlugs = readdirSync(legalRoot).filter((slug) =>
  existsSync(`${legalRoot}/${slug}/privacy.html`)
);

const occurrences = (text: string) => text.split(SENTENCE).length - 1;

describe('statistics sentence in the privacy policies', () => {
  it('covers every app with legal content', () => {
    expect(legalSlugs.length).toBeGreaterThanOrEqual(14);
  });

  it('says once that Midgar may publish aggregate statistics from anonymous counts', () => {
    for (const slug of legalSlugs) {
      const html = readFileSync(`${legalRoot}/${slug}/privacy.html`, 'utf8');
      expect(occurrences(html), slug).toBe(1);
    }
  });

  it('states in the Master of Flags policy that the Kids Category app sends no usage counts', () => {
    const html = readFileSync(`${legalRoot}/master-of-flags/privacy.html`, 'utf8');
    expect(html.includes(`${SENTENCE}; Master of Flags sends no usage counts`)).toBe(true);
  });

  it('is in the policies that are not in src/content/legal too', () => {
    for (const policy of SEPARATE_POLICIES) {
      const source = readFileSync(`${siteRoot}/${policy.source}`, 'utf8');
      expect(occurrences(source), policy.name).toBe(1);
    }
  });

  it('survives the build on every policy page', () => {
    const pages = [
      ...legalSlugs.map((slug) => `legal/${slug}/privacy`),
      ...SEPARATE_POLICIES.map((policy) => policy.page),
    ];
    for (const page of pages) {
      const file = `${dist}${page}/index.html`;
      expect(existsSync(file), file).toBe(true);
      expect(occurrences(readFileSync(file, 'utf8')), page).toBe(1);
    }
  });
});
