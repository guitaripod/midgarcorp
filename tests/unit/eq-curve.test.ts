import { describe, it, expect } from 'vitest';
import { EQ_BANDS, EQ_START, clampGain, eqPath, gainAt } from '../../src/lib/eq-curve';

describe('eq curve', () => {
  it('spaces ten bands from 32 Hz to 16 kHz', () => {
    expect(EQ_BANDS.map((b) => b.label)).toEqual([
      '32',
      '64',
      '125',
      '250',
      '500',
      '1k',
      '2k',
      '4k',
      '8k',
      '16k',
    ]);
    expect(EQ_START).toHaveLength(EQ_BANDS.length);
  });

  it('keeps gains to whole decibels between -12 and +12', () => {
    expect(clampGain(13.4)).toBe(12);
    expect(clampGain(-20)).toBe(-12);
    expect(clampGain(2.6)).toBe(3);
  });

  it('reads a gain back from a position in the drawing', () => {
    expect(gainAt(210)).toBe(0);
    expect(gainAt(30)).toBe(12);
    expect(gainAt(0)).toBe(12);
    expect(gainAt(255)).toBe(-3);
  });

  it('draws a path through every point and closes the area to the floor', () => {
    const line = eqPath(EQ_START, false);
    expect(line.startsWith('M 60 120.0')).toBe(true);
    expect(line.match(/ C /g)).toHaveLength(EQ_BANDS.length + 1);
    expect(eqPath(EQ_START, true).endsWith('L 980 390 L 60 390 Z')).toBe(true);
  });
});
