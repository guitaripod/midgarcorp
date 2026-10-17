/**
 * Blackwall leaderboard snapshot and the geometry of its "wall" chart.
 *
 * The landing page and its share image both read `src/data/blackwall.json`, which
 * `scripts/fetch-blackwall.mjs` builds from the published `board.json`. Everything here is a
 * pure function so the page, the image script and the tests agree on one chart.
 */

export const BOARD_URL = 'https://guitaripod.github.io/blackwall/board.json';
export const SITE_URL = 'https://guitaripod.github.io/blackwall/';

/**
 * @typedef {{ knowledge: number | null, math: number | null, code: number | null, longContext: number | null, tools: number | null }} Groups
 * @typedef {{ id: string, name: string, setup: string, index: number, lo: number, hi: number, groups: Groups, decode: number | null, wh: number | null, finished: string | null }} Model
 * @typedef {{ id: string, name: string, setup: string, scored: number, groups: number, task: string | null, done: number | null, total: number | null }} LiveModel
 * @typedef {{ fetched: string, generated: string | null, suite: string | null, effort: string, version: string | null, hardware: { gpu: string, vramGb: number } | null, models: Model[], live: LiveModel[] }} Snapshot
 */

const GROUPS = [
  ['knowledge', ['supergpqa']],
  ['math', ['math']],
  ['code', ['lcb']],
  ['longContext', ['mrcr', 'graphwalks']],
  ['tools', ['tools']],
];

const round1 = (value) => Math.round(value * 10) / 10;

/** "Qwen 3.8 27B · sglang · FP8" becomes "Qwen 3.8 27B". */
export function shortName(name) {
  return String(name).split(' · ')[0].trim();
}

/** "Qwen 3.8 27B · sglang · FP8" becomes "sglang · FP8". */
export function setupOf(name) {
  return String(name).split(' · ').slice(1).join(' · ').trim();
}

/** Mean of the scored tasks in a group, or null when the group is not fully scored. */
function groupValue(tasks, members) {
  const values = members.map((id) => tasks?.[id]?.value);
  if (values.some((value) => value == null)) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function groupsOf(tasks) {
  return Object.fromEntries(GROUPS.map(([id, members]) => [id, groupValue(tasks, members)]));
}

/**
 * Reduces a published `board.json` to what the landing page and share image draw.
 * @param {any} board
 * @param {string} [effort]
 * @param {Date} [now]
 * @returns {Snapshot}
 */
export function summarize(board, effort = 'max', now = new Date()) {
  const rows = board?.rankings?.[effort] ?? [];
  const models = rows
    .filter((m) => m.index?.value != null)
    .map((m) => ({
      id: m.id,
      name: shortName(m.name),
      setup: setupOf(m.name),
      index: round1(m.index.value),
      lo: round1(m.index.lo ?? m.index.value),
      hi: round1(m.index.hi ?? m.index.value),
      groups: groupsOf(m.tasks),
      decode: m.speed?.decode?.value != null ? Math.round(m.speed.decode.value) : null,
      wh:
        m.energy?.perCorrect?.value != null
          ? Math.round(m.energy.perCorrect.value * 100) / 100
          : null,
      finished: m.run?.finished ? new Date(m.run.finished * 1000).toISOString() : null,
    }))
    .sort((a, b) => b.index - a.index);
  const live = (board?.live ?? []).map((m) => {
    const groups = groupsOf(m.tasks);
    return {
      id: m.id,
      name: shortName(m.name),
      setup: setupOf(m.name),
      scored: Object.values(groups).filter((value) => value != null).length,
      groups: GROUPS.length,
      task: m.progress?.current?.task ?? null,
      done: m.progress?.current?.done ?? null,
      total: m.progress?.current?.total ?? null,
    };
  });
  return {
    fetched: now.toISOString(),
    generated: board?.generated ? new Date(board.generated * 1000).toISOString() : null,
    suite: board?.suite ?? null,
    effort,
    version: board?.generator?.version ?? null,
    hardware: board?.hardware
      ? {
          gpu: String(board.hardware.gpu)
            .replace(/^NVIDIA /, '')
            .replace(/ Workstation Edition$/, ''),
          vramGb: Math.round(board.hardware.vram_mib / 1024),
        }
      : null,
    models,
    live,
  };
}

/**
 * A board is worth publishing on the page only with a real ranking in it.
 * @param {{ models?: Model[] } | null | undefined} snapshot
 */
export function isUsable(snapshot) {
  return Boolean(snapshot?.models?.length >= 2 && snapshot.models.every((m) => m.index > 0));
}

/**
 * Points no other point matches on both axes while beating it on one. Larger is better on both.
 * @template {{ x: number, y: number }} P
 * @param {P[]} points
 * @returns {P[]}
 */
export function frontier(points) {
  return points.filter(
    (p) => !points.some((q) => q !== p && q.x >= p.x && q.y >= p.y && (q.x > p.x || q.y > p.y))
  );
}

/**
 * The sentence under the headline: who leads, and whether the runner-up is inside the margin.
 * @param {Model[]} models
 */
export function verdict(models) {
  const [first, second] = models;
  if (!first) return null;
  const tied = second != null && second.hi >= first.lo;
  return {
    leader: first.name,
    index: first.index,
    runnerUp: second?.name ?? null,
    tied,
  };
}

function niceStep(span, count) {
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((v) => v >= raw) ?? magnitude * 10;
}

function niceTicks(low, high, count) {
  const step = niceStep(high - low, count);
  const ticks = [];
  for (let t = Math.ceil(low / step) * step; t <= high + 1e-9; t += step) ticks.push(+t.toFixed(6));
  return ticks;
}

/**
 * Lays quality against decode speed into a `width` x `height` box. Returns every dot with its
 * interval whisker, the staircase through the frontier, and axis ticks, all in box coordinates.
 * @param {Model[]} models
 * @param {{ width: number, height: number, pad?: { l: number, r: number, t: number, b: number } }} box
 */
export function wallLayout(models, { width, height, pad = { l: 44, r: 16, t: 14, b: 34 } }) {
  const timed = models.filter((m) => m.decode != null);
  if (timed.length < 2) return null;
  const speeds = timed.map((m) => m.decode);
  const lows = timed.map((m) => m.lo);
  const highs = timed.map((m) => m.hi);
  const xMin = Math.floor((Math.min(...speeds) - 12) / 10) * 10;
  const xMax = Math.ceil((Math.max(...speeds) + 12) / 10) * 10;
  const yMin = Math.floor((Math.min(...lows) - 4) / 10) * 10;
  const yMax = Math.min(100, Math.ceil((Math.max(...highs) + 2) / 5) * 5);
  const sx = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (width - pad.l - pad.r);
  const sy = (v) => height - pad.b - ((v - yMin) / (yMax - yMin)) * (height - pad.t - pad.b);

  const wall = frontier(timed.map((m) => ({ x: m.decode, y: m.index, m }))).sort(
    (a, b) => a.x - b.x
  );
  const onWall = new Set(wall.map((p) => p.m.id));
  const dots = timed.map((m) => ({
    id: m.id,
    name: m.name,
    x: sx(m.decode),
    y: sy(m.index),
    y1: sy(m.lo),
    y2: sy(m.hi),
    wall: onWall.has(m.id),
    leader: m.id === models[0].id,
  }));

  const left = pad.l;
  const floor = height - pad.b;
  let path = `M${left} ${sy(wall[0].y).toFixed(1)}`;
  wall.forEach((p, i) => {
    path += `H${sx(p.x).toFixed(1)}`;
    const next = wall[i + 1];
    path += next ? `V${sy(next.y).toFixed(1)}` : `V${floor}`;
  });
  const area = `${path}H${left}Z`;

  return {
    width,
    height,
    pad,
    dots,
    path,
    area,
    xTicks: niceTicks(xMin, xMax, 4).map((v) => ({ value: v, x: sx(v) })),
    yTicks: niceTicks(yMin, yMax, 4).map((v) => ({ value: v, y: sy(v) })),
    wallCount: wall.length,
    timedCount: timed.length,
  };
}
