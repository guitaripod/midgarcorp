import { describe, it, expect } from 'vitest';
import {
  daysInSpace,
  upcomingVisits,
  utcStamp,
  visitEnd,
  visitLength,
  type WebbVisit,
} from '../../src/lib/webb-live';

const visit = (start: string, seconds: number, target: string): WebbVisit => ({
  visit: target,
  start,
  seconds,
  instrument: 'NIRCam Imaging',
  target,
  category: 'Galaxy',
  keywords: '',
});

describe('webb live', () => {
  const now = Date.parse('2026-09-08T12:00:00Z');
  const data = {
    schedule: {
      reportUrl: '',
      sourceUrl: '',
      coversFrom: '',
      coversTo: '',
      observations: [
        visit('2026-09-08T08:00:00Z', 3600, 'done'),
        visit('2026-09-08T11:30:00Z', 3600, 'running'),
        visit('2026-09-08T14:00:00Z', 600, 'next'),
      ],
    },
  };

  it('keeps only visits that have not ended, up to the limit', () => {
    expect(upcomingVisits(data, now).map((v) => v.target)).toEqual(['running', 'next']);
    expect(upcomingVisits(data, now, 1).map((v) => v.target)).toEqual(['running']);
    expect(upcomingVisits({}, now)).toEqual([]);
  });

  it('ends a visit after its length', () => {
    expect(visitEnd(data.schedule.observations[0])).toBe(Date.parse('2026-09-08T09:00:00Z'));
  });

  it('counts whole days in space', () => {
    expect(daysInSpace('2021-12-25T12:20Z', Date.parse('2021-12-26T12:19Z'))).toBe(0);
    expect(daysInSpace('2021-12-25T12:20Z', Date.parse('2021-12-26T12:21Z'))).toBe(1);
  });

  it('writes lengths and times the way the schedule reads', () => {
    expect(visitLength(49343)).toBe('13h 42m');
    expect(visitLength(14400)).toBe('4h');
    expect(visitLength(1399)).toBe('23m');
    expect(utcStamp('2026-09-07T05:20:40Z')).toBe('Mon 7 Sept, 05:20');
  });
});
