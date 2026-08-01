import { describe, it, expect } from 'vitest';
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

  it('states every Premium price, the trial length and auto-renewal', () => {
    const all = copyStrings(solarbeam).join(' ');
    for (const token of ['$2.99', '$19.99', '$49.99', '1-week free trial', 'auto-renew']) {
      expect(all, `landing copy must disclose ${token}`).toContain(token);
    }
  });

  it('describes the AI fact allowance as a lifetime total, not a daily one', () => {
    const all = copyStrings(solarbeam).join(' ');
    expect(all).not.toMatch(/3 (AI )?facts? (a|per) day/i);
    expect(all).toMatch(/3 AI-generated fact sets/);
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
