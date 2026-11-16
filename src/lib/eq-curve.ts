export interface EqBand {
  label: string;
  x: number;
}

const LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const LEFT = 100;
const RIGHT = 940;
const ZERO_Y = 210;
const PX_PER_DB = 15;
const FLOOR_Y = 390;

/// The ten bands of Flaccy's Simple equalizer, spaced evenly across the drawing like its own grid.
export const EQ_BANDS: EqBand[] = LABELS.map((label, i) => ({
  label,
  x: LEFT + ((RIGHT - LEFT) * i) / (LABELS.length - 1),
}));

/// The curve the page opens on: the bass lift on the Equalizer screen of Flaccy's store set.
export const EQ_START = [6, 5, 4, 2, 0, 0, 0, 0, 0, 0];

/// A gain kept to whole decibels between −12 and +12, as the Simple equalizer stores it.
export function clampGain(gain: number): number {
  return Math.max(-12, Math.min(12, Math.round(gain)));
}

/// The gain a vertical position in the drawing stands for.
export function gainAt(y: number): number {
  return clampGain((ZERO_Y - y) / PX_PER_DB);
}

/// An SVG path through every band's point, smoothed with Catmull-Rom segments and held flat to
/// the edges; `area` closes it to the floor so it can be filled.
export function eqPath(gains: number[], area: boolean): string {
  const points = EQ_BANDS.map((band, i) => ({ x: band.x, y: ZERO_Y - gains[i] * PX_PER_DB }));
  const all = [{ x: 60, y: points[0].y }, ...points, { x: 980, y: points[points.length - 1].y }];
  let d = `M ${all[0].x} ${all[0].y.toFixed(1)}`;
  for (let i = 0; i < all.length - 1; i++) {
    const p0 = all[Math.max(0, i - 1)];
    const p1 = all[i];
    const p2 = all[i + 1];
    const p3 = all[Math.min(all.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x} ${p2.y.toFixed(1)}`;
  }
  return area ? `${d} L 980 ${FLOOR_Y} L 60 ${FLOOR_Y} Z` : d;
}
