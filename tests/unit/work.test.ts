import { describe, it, expect } from 'vitest';
import { barFraction, workScore } from '../../src/lib/work';

const NOW = new Date('2026-10-14T12:00:00Z');

describe('workScore', () => {
  it('weighs commits and releases far above stars', () => {
    const worked = workScore({ commitCount: 300, releaseCount: 30, stars: 0 }, NOW);
    const starred = workScore({ commitCount: 5, releaseCount: 1, stars: 60 }, NOW);
    expect(worked).toBeGreaterThan(starred);
  });

  it('treats missing counts as zero', () => {
    expect(workScore({}, NOW)).toBe(0);
  });

  it('adds a recency bonus that shrinks with age and stops after a year', () => {
    const base = { commitCount: 20, releaseCount: 3 };
    const fresh = workScore({ ...base, latestDate: '2026-10-01T00:00:00Z' }, NOW);
    const year = workScore({ ...base, latestDate: '2026-02-01T00:00:00Z' }, NOW);
    const old = workScore({ ...base, latestDate: '2022-02-01T00:00:00Z' }, NOW);
    expect(fresh).toBeGreaterThan(year);
    expect(year).toBeGreaterThan(old);
    expect(old).toBe(workScore(base, NOW));
  });
});

describe('barFraction', () => {
  it('scales on a square root with a visible floor', () => {
    expect(barFraction(0, 100)).toBe(0);
    expect(barFraction(100, 100)).toBe(1);
    expect(barFraction(25, 100)).toBeCloseTo(0.5, 6);
    expect(barFraction(1, 10000)).toBe(0.04);
  });
});
