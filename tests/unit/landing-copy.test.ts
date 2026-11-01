import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import factsData from '../../src/data/landing-facts.json';
import solarbeam from '../../src/data/landing/solarbeam.json';

const facts = (factsData as { apps: { slug: string; description: string }[] }).apps;
const solarbeamFacts = facts.find((a) => a.slug === 'solarbeam');

/// App Store guideline 3.1.2: an app that is free to download with subscriptions
/// may not be sold as a one-off purchase. The claim was scrubbed from all 40
/// store localizations; these strings are what would put it back on the web.
const FORBIDDEN = [/one purchase/i, /single purchase/i, /buy once/i, /pay once/i];

const copyStrings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(copyStrings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(copyStrings);
  return [];
};

describe('Solar Beam landing copy', () => {
  it('never sells Premium as a one-time-only purchase', () => {
    const strings = [...copyStrings(solarbeam), solarbeamFacts?.description ?? ''];
    for (const phrase of FORBIDDEN) {
      const offenders = strings.filter((s) => phrase.test(s));
      expect(offenders, `"${phrase}" is a guideline 3.1.2 exposure`).toEqual([]);
    }
  });

  it('states every Premium price and auto-renewal', () => {
    const all = copyStrings(solarbeam).join(' ');
    for (const token of ['$4.99', '$19.99', '$39.99', 'auto-renew']) {
      expect(all, `landing copy must disclose ${token}`).toContain(token);
    }
  });

  it('describes the AI fact allowance as a lifetime total, not a daily one', () => {
    const all = copyStrings(solarbeam).join(' ');
    expect(all).not.toMatch(/3 (AI )?facts? (a|per) day/i);
    expect(all).toMatch(/one AI-generated fact set/);
  });

  it('advertises all five platforms', () => {
    const all = copyStrings(solarbeam).join(' ');
    for (const platform of ['iPhone', 'iPad', 'Mac', 'Apple TV', 'Vision Pro']) {
      expect(all).toContain(platform);
    }
  });

  it('keeps the ESA/Webb attribution the CC BY 4.0 licence requires', () => {
    const all = copyStrings(solarbeam).join(' ');
    expect(all).toContain('CC BY 4.0');
    expect(all).toContain('STScI');
  });
});

/// D22: no subscription sells with a free trial. Flaccy's seven days are its own in-app runway, not
/// a store offer, and its pages say so; every other landing page, store description and terms page
/// stays silent about trials.
const TRIAL = /free[- ]trial|free week|[0-9]+[- ]days? free|free for [0-9]+ days|try it free for/i;
const RUNWAY_APPS = new Set(['flaccy']);

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), 'utf8');

describe('No landing page promises a free trial', () => {
  it('keeps trials out of every landing copy file', () => {
    const dir = path.join(process.cwd(), 'src', 'data', 'landing');
    const offenders = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.json') && !RUNWAY_APPS.has(name.replace('.json', '')))
      .filter((name) => TRIAL.test(read('src', 'data', 'landing', name)));
    expect(offenders).toEqual([]);
  });

  it('keeps trials out of the store descriptions shown on the pages', () => {
    const offenders = facts
      .filter((a) => !RUNWAY_APPS.has(a.slug) && TRIAL.test(a.description))
      .map((a) => a.slug);
    expect(offenders).toEqual([]);
  });

  it('keeps trials out of the subscription terms', () => {
    const terms = [
      ['src', 'pages', 'appofthedead', 'terms.astro'],
      ['src', 'content', 'legal', 'pay-day', 'terms.html'],
      ['src', 'content', 'legal', 'living-dex', 'terms.html'],
    ];
    const offenders = terms.filter((parts) => TRIAL.test(read(...parts))).map((p) => p.join('/'));
    expect(offenders).toEqual([]);
  });
});
