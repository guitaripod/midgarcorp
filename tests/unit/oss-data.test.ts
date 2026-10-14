import { describe, it, expect } from 'vitest';
import {
  OSS_FEATURED_SCORE,
  OSS_NOW,
  ossProjects,
  ossScore,
  ossSections,
  ossStats,
  partitionOss,
} from '../../src/data/oss';

describe('open-source data', () => {
  it('orders projects by the work behind them', () => {
    for (let i = 1; i < ossProjects.length; i++) {
      expect(ossScore(ossProjects[i - 1]), ossProjects[i].name).toBeGreaterThanOrEqual(
        ossScore(ossProjects[i])
      );
    }
  });

  it('places every project in exactly one section and tier', () => {
    const placed = ossSections.flatMap((section) => [...section.featured, ...section.compact]);
    const ids = placed.map((project) => project.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(ossProjects.map((project) => project.id).sort());
  });

  it('keeps the featured tier above the score cutoff and the compact tier below it', () => {
    for (const section of ossSections) {
      expect(section.featured.every((p) => ossScore(p) >= OSS_FEATURED_SCORE)).toBe(true);
      expect(section.compact.every((p) => ossScore(p) < OSS_FEATURED_SCORE)).toBe(true);
    }
  });

  it('totals each section from its projects', () => {
    for (const section of ossSections) {
      const projects = [...section.featured, ...section.compact];
      expect(section.totals.repos).toBe(projects.length);
      expect(section.totals.commits).toBe(projects.reduce((s, p) => s + (p.commitCount ?? 0), 0));
    }
    expect(ossStats.commits).toBe(
      ossSections.reduce((sum, section) => sum + section.totals.commits, 0)
    );
  });

  it('splits one category by the cutoff', () => {
    const copy = { category: 'Test', title: 't', command: 'c', blurb: 'b' };
    const heavy = { ...ossProjects[0], commitCount: 400, releaseCount: 20, stars: 0 };
    const tiny = { ...ossProjects[0], id: 'tiny', commitCount: 2, releaseCount: 0, stars: 0 };
    const section = partitionOss(copy, [heavy, tiny], OSS_NOW);
    expect(section.featured.map((p) => p.id)).toEqual([heavy.id]);
    expect(section.compact.map((p) => p.id)).toEqual(['tiny']);
  });
});
