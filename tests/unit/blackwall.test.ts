import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import {
  shortName,
  setupOf,
  summarize,
  isUsable,
  frontier,
  verdict,
  wallLayout,
} from '../../src/lib/blackwall.mjs';
import snapshot from '../../src/data/blackwall.json';

const finished = 1792252463;
const now = new Date('2026-10-17T12:00:00Z');

function row(id: string, name: string, index: number | null, decode: number | null) {
  return {
    id,
    name,
    index: index == null ? undefined : { value: index, lo: index - 2, hi: index + 2 },
    tasks: {
      supergpqa: { value: 60 },
      math: { value: 80 },
      lcb: { value: 70 },
      mrcr: { value: 85 },
      graphwalks: { value: 90 },
      tools: { value: 100 },
    },
    speed: { decode: { value: decode } },
    energy: { perCorrect: { value: 2.6667 } },
    run: { finished },
  };
}

const board = {
  generated: finished,
  suite: 'full/v1',
  generator: { version: '2.1.0' },
  hardware: { gpu: 'NVIDIA RTX PRO 6000 Blackwell Workstation Edition', vram_mib: 97887 },
  rankings: {
    max: [
      row('low', 'Low · sglang · FP8', 60, 90),
      row('top', 'Top · vllm · BF16', 90, 120),
      row('mid', 'Mid · sglang · FP8', 75, 150),
      row('unscored', 'Unscored · llama · Q4', null, 200),
    ],
    medium: [row('mid', 'Mid · sglang · FP8', 70, 150), row('top', 'Top · vllm · BF16', 88, 120)],
  },
  live: [
    {
      id: 'live-1',
      name: 'Live · sglang · FP8',
      tasks: {
        supergpqa: { value: 50 },
        math: { value: 50 },
        mrcr: { value: 50 },
        graphwalks: { value: 50 },
        tools: { value: 50 },
      },
      progress: { current: { task: 'lcb', done: 3, total: 10 } },
    },
  ],
};

describe('blackwall names', () => {
  it('splits the short name from the setup on the middle dot', () => {
    expect(shortName('Qwen 3.8 27B · sglang · FP8')).toBe('Qwen 3.8 27B');
    expect(setupOf('Qwen 3.8 27B · sglang · FP8')).toBe('sglang · FP8');
  });

  it('returns an empty setup when the name has no separator', () => {
    expect(shortName('Plain')).toBe('Plain');
    expect(setupOf('Plain')).toBe('');
  });
});

describe('blackwall summarize', () => {
  it('sorts scored models by index descending and drops unscored ones', () => {
    const summary = summarize(board, 'max', now);
    expect(summary.models.map((m) => m.id)).toEqual(['top', 'mid', 'low']);
    expect(summary.models[0]).toMatchObject({
      name: 'Top',
      setup: 'vllm · BF16',
      index: 90,
      lo: 88,
      hi: 92,
      decode: 120,
      wh: 2.67,
      finished: new Date(finished * 1000).toISOString(),
    });
  });

  it('reduces the hardware and generator fields', () => {
    const summary = summarize(board, 'max', now);
    expect(summary.hardware).toEqual({ gpu: 'RTX PRO 6000 Blackwell', vramGb: 96 });
    expect(summary.version).toBe('2.1.0');
    expect(summary.suite).toBe('full/v1');
    expect(summary.fetched).toBe(now.toISOString());
    expect(summary.generated).toBe(new Date(finished * 1000).toISOString());
  });

  it('averages mrcr and graphwalks into the long-context group', () => {
    const summary = summarize(board, 'max', now);
    expect(summary.models[0].groups).toEqual({
      knowledge: 60,
      math: 80,
      code: 70,
      longContext: 87.5,
      tools: 100,
    });
  });

  it('reads the ranking for the requested effort', () => {
    const summary = summarize(board, 'medium', now);
    expect(summary.effort).toBe('medium');
    expect(summary.models.map((m) => m.id)).toEqual(['top', 'mid']);
    expect(summary.models[1].index).toBe(70);
  });

  it('counts live groups with a score and drops the missing lcb task', () => {
    const [live] = summarize(board, 'max', now).live;
    expect(live).toMatchObject({
      id: 'live-1',
      name: 'Live',
      setup: 'sglang · FP8',
      scored: 4,
      groups: 5,
      task: 'lcb',
      done: 3,
      total: 10,
    });
  });

  it('gives no models when the board has no rankings', () => {
    expect(summarize({ generated: finished }, 'max', now).models).toEqual([]);
    expect(summarize({}, 'max', now).models).toEqual([]);
  });
});

describe('blackwall isUsable', () => {
  it('rejects fewer than two models', () => {
    expect(isUsable({ models: [{ index: 80 }] })).toBe(false);
    expect(isUsable({ models: [] })).toBe(false);
  });

  it('rejects a model with an index of zero', () => {
    expect(isUsable({ models: [{ index: 80 }, { index: 0 }] })).toBe(false);
  });

  it('accepts a normal snapshot', () => {
    expect(isUsable({ models: [{ index: 80 }, { index: 60 }] })).toBe(true);
  });
});

describe('blackwall frontier', () => {
  it('excludes a point dominated on both axes', () => {
    expect(
      frontier([
        { x: 1, y: 1, id: 'dominated' },
        { x: 2, y: 2, id: 'best' },
      ])
    ).toEqual([{ x: 2, y: 2, id: 'best' }]);
  });

  it('keeps both points when they tie on both axes', () => {
    const p = { x: 1, y: 1, id: 'p' };
    const q = { x: 1, y: 1, id: 'q' };
    expect(frontier([p, q])).toEqual([p, q]);
  });

  it('keeps a single point as its own frontier', () => {
    const only = { x: 3, y: 4 };
    expect(frontier([only])).toEqual([only]);
  });
});

describe('blackwall verdict', () => {
  it('reports a tie when the runner-up upper bound reaches the leader lower bound', () => {
    const result = verdict([
      { name: 'A', index: 80, lo: 78, hi: 82 },
      { name: 'B', index: 79, lo: 75, hi: 78 },
    ]);
    expect(result).toEqual({ leader: 'A', index: 80, runnerUp: 'B', tied: true });
  });

  it('reports no tie when the runner-up upper bound stays below the leader lower bound', () => {
    const result = verdict([
      { name: 'A', index: 80, lo: 78, hi: 82 },
      { name: 'B', index: 70, lo: 68, hi: 77 },
    ]);
    expect(result?.tied).toBe(false);
  });

  it('returns null for an empty list', () => {
    expect(verdict([])).toBeNull();
  });
});

describe('blackwall wallLayout', () => {
  const width = 600;
  const height = 300;
  const models = [
    { id: 'a', name: 'A', index: 90, lo: 88, hi: 92, decode: 100 },
    { id: 'b', name: 'B', index: 80, lo: 70, hi: 85, decode: 200 },
    { id: 'c', name: 'C', index: 70, lo: 68, hi: 72, decode: 150 },
    { id: 'd', name: 'D', index: 60, lo: 50, hi: 65, decode: 300 },
  ];

  it('returns null with fewer than two timed models', () => {
    expect(wallLayout([models[0], { ...models[1], decode: null }], { width, height })).toBeNull();
    expect(wallLayout([models[0]], { width, height })).toBeNull();
  });

  it('maps higher index to smaller y and higher decode to larger x', () => {
    const layout = wallLayout(models, { width, height });
    const byId = Object.fromEntries(layout!.dots.map((d) => [d.id, d]));
    expect(byId.a.y).toBeLessThan(byId.b.y);
    expect(byId.b.y).toBeLessThan(byId.c.y);
    expect(byId.c.y).toBeLessThan(byId.d.y);
    expect(byId.a.x).toBeLessThan(byId.c.x);
    expect(byId.c.x).toBeLessThan(byId.b.x);
    expect(byId.b.x).toBeLessThan(byId.d.x);
  });

  it('marks only frontier models on the wall', () => {
    const layout = wallLayout(models, { width, height });
    const onWall = layout!.dots.filter((d) => d.wall).map((d) => d.id);
    expect(onWall.sort()).toEqual(['a', 'b', 'd']);
    expect(layout!.wallCount).toBe(3);
    expect(layout!.timedCount).toBe(4);
  });

  it('flags exactly one leader, the first model', () => {
    const layout = wallLayout(models, { width, height });
    const leaders = layout!.dots.filter((d) => d.leader);
    expect(leaders).toHaveLength(1);
    expect(leaders[0].id).toBe('a');
  });

  it('draws a staircase path that starts at the left edge and drops to the floor', () => {
    const layout = wallLayout(models, { width, height });
    expect(layout!.path.startsWith('M')).toBe(true);
    expect(layout!.path.endsWith(`V${height - layout!.pad.b}`)).toBe(true);
  });

  it('keeps every tick inside the plot box', () => {
    const layout = wallLayout(models, { width, height });
    const { pad } = layout!;
    for (const tick of layout!.xTicks) {
      expect(tick.x).toBeGreaterThanOrEqual(pad.l - 1e-6);
      expect(tick.x).toBeLessThanOrEqual(width - pad.r + 1e-6);
    }
    for (const tick of layout!.yTicks) {
      expect(tick.y).toBeGreaterThanOrEqual(pad.t - 1e-6);
      expect(tick.y).toBeLessThanOrEqual(height - pad.b + 1e-6);
    }
  });
});

describe('blackwall shipped snapshot', () => {
  it('is usable and sorted by index descending', () => {
    expect(isUsable(snapshot)).toBe(true);
    const indexes = snapshot.models.map((m) => m.index);
    expect(indexes).toEqual([...indexes].sort((a, b) => b - a));
  });
});

describe('blackwall landing page wiring', () => {
  const root = path.join(__dirname, '..', '..');

  it('ships its share image, board screenshots and page', () => {
    for (const file of [
      'public/og/blackwall.png',
      'public/blackwall/board.webp',
      'public/blackwall/board@960.webp',
      'src/pages/blackwall.astro',
    ]) {
      expect(existsSync(path.join(root, file)), file).toBe(true);
    }
  });

  it('refreshes its snapshot and share image on every build', () => {
    const prebuild = readFileSync(path.join(root, 'internal/build/prebuild.go'), 'utf8');
    const fetch = prebuild.indexOf('scripts/fetch-blackwall.mjs');
    const image = prebuild.indexOf('scripts/generate-blackwall-og.js');
    expect(fetch).toBeGreaterThan(-1);
    expect(image).toBeGreaterThan(fetch);
  });
});
