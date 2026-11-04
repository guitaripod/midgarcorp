import { describe, it, expect } from 'vitest';
import { foldShared, releaseHeadline, shippedWithin } from '../../src/lib/app-release';

describe('releaseHeadline', () => {
  it('takes the first sentence of the notes', () => {
    expect(
      releaseHeadline('Send music over Wi-Fi. Choose On my computer when Flaccy welcomes you.')
    ).toBe('Send music over Wi-Fi.');
  });

  it('skips headings and bullet marks', () => {
    expect(releaseHeadline('New:\n• Notifications say what happened and answer back. More.')).toBe(
      'Notifications say what happened and answer back.'
    );
    expect(releaseHeadline("WHAT'S NEW\n- Faster search")).toBe('Faster search');
  });

  it('keeps abbreviations and dotted names inside the sentence', () => {
    expect(releaseHeadline('Wake at 3 a.m. and speak. Then sleep.')).toBe(
      'Wake at 3 a.m. and speak.'
    );
    expect(releaseHeadline('Every play goes to Last.fm, even offline. Also fixes.')).toBe(
      'Every play goes to Last.fm, even offline.'
    );
  });

  it('skips list numbers and keeps titles and initials inside the sentence', () => {
    expect(releaseHeadline('1. New feature here\n2. Other thing')).toBe('New feature here');
    expect(releaseHeadline('Added support for Mr. Smith today. More.')).toBe(
      'Added support for Mr. Smith today.'
    );
    expect(releaseHeadline('Sync for U.S. users and J. Doe. Also fixes.')).toBe(
      'Sync for U.S. users and J. Doe.'
    );
    expect(releaseHeadline('Version 3.0 is here. Enjoy.')).toBe('Version 3.0 is here.');
  });

  it('never cuts a word when a long token follows a short start', () => {
    const headline =
      releaseHeadline(
        'Fixed a bug in https://example.com/some/very/long/path/that/goes/on/and/on/and/on/and/on/forever-and-ever-amen-amen.'
      ) ?? '';
    expect(headline).toBe('Fixed a bug in…');
  });

  it('clips a long sentence at a word boundary', () => {
    const long = `${'word '.repeat(40)}end.`;
    const headline = releaseHeadline(long) ?? '';
    expect(headline.length).toBeLessThanOrEqual(110);
    expect(headline.endsWith('word…')).toBe(true);
  });

  it('returns null when there is nothing to show', () => {
    expect(releaseHeadline(undefined)).toBeNull();
    expect(releaseHeadline('')).toBeNull();
    expect(releaseHeadline('NEW\n\n')).toBeNull();
  });
});

describe('shippedWithin', () => {
  const now = new Date('2026-11-04T12:00:00Z');

  it('counts a release inside the window', () => {
    expect(shippedWithin('2026-11-02T18:38:44Z', 7, now)).toBe(true);
    expect(shippedWithin('2026-10-17T19:04:10Z', 7, now)).toBe(false);
  });

  it('ignores missing and future dates', () => {
    expect(shippedWithin(null, 7, now)).toBe(false);
    expect(shippedWithin('2026-11-05T00:00:00Z', 7, now)).toBe(false);
  });
});

describe('foldShared', () => {
  const rows = [
    { name: 'a', note: 'New thing.' },
    { name: 'b', note: 'A maintenance update.' },
    { name: 'c', note: 'A maintenance update.' },
    { name: 'd', note: null },
    { name: 'e', note: 'A maintenance update.' },
  ];

  it('folds a note shared often enough into the first position', () => {
    const groups = foldShared(rows, (row) => row.note);
    expect(groups.map((group) => group.map((row) => row.name))).toEqual([
      ['a'],
      ['b', 'c', 'e'],
      ['d'],
    ]);
  });

  it('leaves notes below the threshold alone', () => {
    const groups = foldShared(rows, (row) => row.note, 4);
    expect(groups).toHaveLength(5);
  });
});
