// Generates clean, original marketing screenshots for the Crucible landing page.
// Pure node-canvas (no real Plex content) — Home, Detail, Player, Library.
// Output: /tmp/crucible_screens/iphone-{1..4}.png  (converted to webp afterwards)

const fs = require('fs');
const path = require('path');
const { createCanvas, registerFont } = require('canvas');

const FONT = '/usr/share/fonts/noto';
registerFont(`${FONT}/NotoSans-Regular.ttf`, { family: 'Noto Sans', weight: '400' });
registerFont(`${FONT}/NotoSans-Medium.ttf`, { family: 'Noto Sans', weight: '500' });
registerFont(`${FONT}/NotoSans-Bold.ttf`, { family: 'Noto Sans', weight: '700' });
registerFont(`${FONT}/NotoSans-Black.ttf`, { family: 'Noto Sans', weight: '900' });
const SANS = 'Noto Sans';

const W = 1290;
const H = 2796;
const PAD = 56;
const ACCENT = '#FF9500';
const BG = '#000000';
const W70 = 'rgba(255,255,255,0.72)';
const W50 = 'rgba(255,255,255,0.5)';
const W38 = 'rgba(255,255,255,0.38)';

const outDir = '/tmp/crucible_screens';
fs.mkdirSync(outDir, { recursive: true });

// ---------- helpers ----------
function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function text(ctx, str, x, y, { size = 30, weight = '400', color = '#fff', align = 'left', spacing = 0 } = {}) {
  ctx.font = `${weight} ${size}px "${SANS}"`;
  ctx.fillStyle = color;
  ctx.textAlign = spacing ? 'left' : align;
  ctx.textBaseline = 'alphabetic';
  if (!spacing) {
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }
  // letter-spaced (for uppercase eyebrows)
  let cx = x;
  if (align === 'center') {
    let tot = 0;
    for (const ch of str) tot += ctx.measureText(ch).width + spacing;
    cx = x - tot / 2;
  }
  for (const ch of str) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - x;
}

function ellipsize(ctx, str, max, font) {
  ctx.font = font;
  if (ctx.measureText(str).width <= max) return str;
  let s = str;
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

function grain(ctx, x, y, w, h, amount = 0.04, step = 3) {
  // cheap dither to kill gradient banding
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if ((i / 4) % step !== 0) continue;
    const n = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const v = (n - 0.5) * 255 * amount;
    d[i] += v; d[i + 1] += v; d[i + 2] += v;
  }
  ctx.putImageData(img, x, y);
}

const PALETTES = [
  ['#2742B0', '#0A1024'], ['#0F8F86', '#08191A'], ['#5B21B6', '#0C0A1E'],
  ['#9F1239', '#1A0810'], ['#C2671C', '#1C1206'], ['#B21368', '#1A0814'],
  ['#1A7F47', '#07160E'], ['#D24A12', '#1C0A05'], ['#3C4A63', '#0A0E16'],
  ['#C42A2A', '#1A0808'], ['#1782A8', '#06141B'], ['#B07A12', '#1A1305'],
];

function motif(ctx, x, y, w, h, kind, tint) {
  ctx.save();
  rr(ctx, x, y, w, h, 0);
  ctx.clip();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.strokeStyle = tint;
  ctx.fillStyle = tint;
  if (kind === 0) {
    // concentric orbits
    ctx.lineWidth = w * 0.012;
    for (let r = w * 0.2; r < w * 1.1; r += w * 0.16) {
      ctx.beginPath();
      ctx.arc(x + w * 0.72, y + h * 0.26, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (kind === 1) {
    // peaks
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + w * 0.32, y + h * 0.52);
    ctx.lineTo(x + w * 0.58, y + h * 0.78);
    ctx.lineTo(x + w * 0.82, y + h * 0.44);
    ctx.lineTo(x + w, y + h * 0.66);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 2) {
    // rays
    ctx.lineWidth = w * 0.05;
    for (let i = -2; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, y - h * 0.1);
      ctx.lineTo(x + w * (i * 0.28), y + h * 1.2);
      ctx.stroke();
    }
  } else {
    // soft beam circle
    const g = ctx.createRadialGradient(x + w * 0.32, y + h * 0.3, 0, x + w * 0.32, y + h * 0.3, w * 0.9);
    g.addColorStop(0, tint);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

// A cinematic poster tile
function poster(ctx, x, y, w, h, opts) {
  const { title, sub, genre, pi = 0, progress, badge, play } = opts;
  const pal = PALETTES[pi % PALETTES.length];
  ctx.save();
  rr(ctx, x, y, w, h, w * 0.07);
  ctx.clip();
  ctx.fillStyle = lin(ctx, x, y, x + w, y + h, [[0, pal[0]], [1, pal[1]]]);
  ctx.fillRect(x, y, w, h);
  // top sheen
  const sheen = ctx.createRadialGradient(x + w * 0.3, y + h * 0.12, 0, x + w * 0.3, y + h * 0.12, w);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  motif(ctx, x, y, w, h, pi % 4, 'rgba(255,255,255,0.5)');
  // bottom scrim
  ctx.fillStyle = lin(ctx, x, y + h * 0.45, x, y + h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.85)']]);
  ctx.fillRect(x, y + h * 0.4, w, h * 0.6);
  grain(ctx, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0.05, 2);

  const tx = x + w * 0.075;
  let ty = y + h - (progress != null ? w * 0.2 : w * 0.11);
  if (genre) {
    text(ctx, genre.toUpperCase(), tx, ty - w * 0.13, { size: w * 0.052, weight: '700', color: 'rgba(255,255,255,0.78)', spacing: w * 0.01 });
  }
  const tf = `700 ${Math.round(w * 0.082)}px "${SANS}"`;
  text(ctx, ellipsize(ctx, title, w * 0.85, tf), tx, ty, { size: w * 0.082, weight: '700', color: '#fff' });
  if (sub) text(ctx, ellipsize(ctx, sub, w * 0.85, `400 ${Math.round(w * 0.058)}px "${SANS}"`), tx, ty + w * 0.085, { size: w * 0.058, weight: '500', color: 'rgba(255,255,255,0.7)' });
  ctx.restore();

  if (progress != null) {
    const by = y + h - w * 0.05;
    rr(ctx, x + w * 0.075, by, w * 0.85, w * 0.018, w * 0.01);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    rr(ctx, x + w * 0.075, by, w * 0.85 * progress, w * 0.018, w * 0.01);
    ctx.fillStyle = ACCENT;
    ctx.fill();
  }
  if (badge) {
    ctx.font = `700 ${Math.round(w * 0.06)}px "${SANS}"`;
    const bw = ctx.measureText(badge).width + w * 0.09;
    rr(ctx, x + w - bw - w * 0.06, y + w * 0.06, bw, w * 0.11, w * 0.03);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    text(ctx, badge, x + w - bw - w * 0.06 + bw / 2, y + w * 0.06 + w * 0.078, { size: w * 0.06, weight: '700', color: '#fff', align: 'center' });
  }
  if (play) {
    const cx = x + w / 2, cy = y + h / 2, r = w * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.32, cy - r * 0.42);
    ctx.lineTo(cx - r * 0.32, cy + r * 0.42);
    ctx.lineTo(cx + r * 0.46, cy);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

function statusBar(ctx, y = 0) {
  text(ctx, '9:41', PAD + 8, y + 96, { size: 38, weight: '700', color: '#fff' });
  // signal
  const rx = W - PAD - 8;
  const bars = [14, 22, 30, 38];
  let bx = rx - 150;
  bars.forEach((bh, i) => {
    ctx.fillStyle = '#fff';
    rr(ctx, bx, y + 90 - bh, 16, bh, 4);
    ctx.fill();
    bx += 24;
  });
  // wifi
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 7;
  const wx = rx - 78, wy = y + 86;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(wx, wy, i * 11, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(wx, wy, 5, 0, Math.PI * 2);
  ctx.fill();
  // battery
  rr(ctx, rx - 52, y + 60, 46, 24, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  rr(ctx, rx - 48, y + 64, 34, 16, 3);
  ctx.fill();
  ctx.fillRect(rx - 4, y + 67, 5, 10);
}

function homeIndicator(ctx) {
  rr(ctx, W / 2 - 110, H - 22, 220, 9, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
}

function tabBar(ctx, active) {
  const top = H - 200;
  ctx.fillStyle = 'rgba(10,10,12,0.86)';
  ctx.fillRect(0, top, W, H - top);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(W, top);
  ctx.stroke();
  const tabs = ['Home', 'Library', 'Search', 'Settings'];
  const cw = W / 4;
  tabs.forEach((t, i) => {
    const cx = cw * i + cw / 2;
    const cy = top + 64;
    const on = i === active;
    const col = on ? ACCENT : 'rgba(255,255,255,0.45)';
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 6;
    if (i === 0) {
      ctx.beginPath();
      ctx.moveTo(cx - 26, cy + 2);
      ctx.lineTo(cx, cy - 24);
      ctx.lineTo(cx + 26, cy + 2);
      ctx.stroke();
      if (on) { ctx.fillRect(cx - 18, cy, 36, 24); } else { ctx.strokeRect(cx - 18, cy, 36, 24); }
    } else if (i === 1) {
      for (let k = 0; k < 3; k++) { rr(ctx, cx - 24, cy - 22 + k * 16, 48, 10, 3); ctx.fill(); }
    } else if (i === 2) {
      ctx.beginPath(); ctx.arc(cx - 6, cy - 8, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 8, cy + 6); ctx.lineTo(cx + 24, cy + 22); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(cx, cy - 6, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy - 6, 8, 0, Math.PI * 2); ctx.stroke();
    }
    text(ctx, t, cx, top + 130, { size: 24, weight: on ? '700' : '500', color: col, align: 'center' });
  });
}

function base() {
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  return { c, ctx };
}

function carousel(ctx, label, y, items, { pw = 348, gap = 28 } = {}) {
  text(ctx, label, PAD, y, { size: 42, weight: '700', color: '#fff' });
  const ph = pw * 1.5;
  let x = PAD;
  const ty = y + 36;
  items.forEach((it) => {
    poster(ctx, x, ty, pw, ph, it);
    x += pw + gap;
  });
  return ty + ph + 64;
}

// ---------- screen 1: Home ----------
function home() {
  const { c, ctx } = base();
  statusBar(ctx);
  text(ctx, 'Home', PAD, 250, { size: 80, weight: '900', color: '#fff' });
  let y = 360;
  y = carousel(ctx, 'Continue Watching', y, [
    { title: 'Continuum', sub: 'S2 · E4 · The Quiet Hour', pi: 10, progress: 0.62 },
    { title: 'Harbor Lights', sub: 'S1 · E7 · Undertow', pi: 11, progress: 0.31 },
    { title: 'Aurora Drift', sub: '1h 12m left', pi: 0, progress: 0.48 },
    { title: 'Field Notes', sub: 'S3 · E2 · The Intern', pi: 6, progress: 0.8 },
  ]);
  y = carousel(ctx, 'On Deck', y, [
    { title: 'The Long Static', genre: 'Mystery', pi: 2 },
    { title: 'Cold Open', genre: 'Comedy', pi: 5 },
    { title: 'Nightfall Province', genre: 'Thriller', pi: 3 },
    { title: 'Solar Saints', genre: 'Sci-Fi', pi: 7 },
  ]);
  y = carousel(ctx, 'Recently Added', y, [
    { title: 'Crimson Harbor', genre: 'Crime', pi: 3 },
    { title: 'Paper Cities', genre: 'Drama', pi: 4 },
    { title: 'Velvet Machine', genre: 'Sci-Fi', pi: 5 },
    { title: 'Ember & Ash', genre: 'Drama', pi: 9 },
  ]);
  tabBar(ctx, 0);
  homeIndicator(ctx);
  return c;
}

// ---------- screen 2: Detail ----------
function detail() {
  const { c, ctx } = base();
  const heroH = 1180;
  const pal = PALETTES[0];
  // backdrop
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, 0, W, heroH, [[0, pal[0]], [1, pal[1]]]);
  ctx.fillRect(0, 0, W, heroH);
  const sheen = ctx.createRadialGradient(W * 0.7, 200, 0, W * 0.7, 200, W);
  sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, heroH);
  motif(ctx, 0, 0, W, heroH, 0, 'rgba(255,255,255,0.45)');
  ctx.fillStyle = lin(ctx, 0, heroH * 0.45, 0, heroH, [[0, 'rgba(0,0,0,0)'], [0.7, 'rgba(0,0,0,0.55)'], [1, '#000']]);
  ctx.fillRect(0, heroH * 0.4, W, heroH * 0.6);
  grain(ctx, 0, 0, W, heroH, 0.045, 2);
  ctx.restore();

  statusBar(ctx);
  // back chevron
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(PAD + 26, 168);
  ctx.lineTo(PAD + 4, 192);
  ctx.lineTo(PAD + 26, 216);
  ctx.stroke();

  let y = heroH - 250;
  text(ctx, 'AURORA DRIFT', PAD, y, { size: 92, weight: '900', color: '#fff' });
  y += 66;
  // meta
  let mx = PAD;
  mx += text(ctx, '2025', mx, y, { size: 34, weight: '500', color: W70 }) + 26;
  text(ctx, '★', mx, y, { size: 34, weight: '700', color: ACCENT });
  mx += 44;
  mx += text(ctx, '8.4', mx, y, { size: 34, weight: '500', color: W70 }) + 26;
  text(ctx, 'Sci-Fi · 2h 12m', mx, y, { size: 34, weight: '500', color: W70 });
  y += 56;
  // badges
  let bx = PAD;
  ['4K', 'HDR', 'HEVC', 'ATMOS'].forEach((b) => {
    ctx.font = `700 26px "${SANS}"`;
    const bw = ctx.measureText(b).width + 36;
    rr(ctx, bx, y - 34, bw, 48, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, b, bx + bw / 2, y, { size: 26, weight: '700', color: 'rgba(255,255,255,0.92)', align: 'center' });
    bx += bw + 16;
  });

  // play button
  y = heroH + 70;
  rr(ctx, PAD, y, W - PAD * 2, 110, 26);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  const pcx = W / 2 - 150;
  ctx.beginPath();
  ctx.moveTo(pcx, y + 36);
  ctx.lineTo(pcx, y + 74);
  ctx.lineTo(pcx + 34, y + 55);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  text(ctx, 'Resume from 24:10', pcx + 52, y + 70, { size: 38, weight: '700', color: '#fff' });

  // overview
  y += 190;
  const ov = [
    'A deep-space salvage crew wakes from cryo to find their',
    'ship drifting off course — and something awake in the',
    'cargo hold. A taut, luminous thriller about trust at the',
    'edge of the map.',
  ];
  ov.forEach((line, i) => text(ctx, line, PAD, y + i * 46, { size: 32, weight: '400', color: W70 }));
  y += ov.length * 46 + 40;

  // cast
  text(ctx, 'Cast & Crew', PAD, y, { size: 42, weight: '700', color: '#fff' });
  y += 70;
  const cast = [
    ['Mara Vance', 'Cmdr. Idris', '#7C3AED'],
    ['Eli Cho', 'Nav. Rourke', '#0EA5A4'],
    ['Nadia Frost', 'Dr. Salk', '#E11D48'],
    ['Theo Reyes', 'Director', '#F59E0B'],
    ['June Park', 'Writer', '#2563EB'],
  ];
  const av = 150, agap = (W - PAD * 2 - av * 5) / 4;
  cast.forEach(([name, role, col], i) => {
    const ax = PAD + i * (av + agap);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + av / 2, y + av / 2, av / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = lin(ctx, ax, y, ax + av, y + av, [[0, col], [1, 'rgba(0,0,0,0.55)']]);
    ctx.fillRect(ax, y, av, av);
    const initials = name.split(' ').map((s) => s[0]).join('');
    text(ctx, initials, ax + av / 2, y + av / 2 + 22, { size: 60, weight: '700', color: 'rgba(255,255,255,0.92)', align: 'center' });
    ctx.restore();
    text(ctx, ellipsize(ctx, name, av + agap * 0.6, `500 26px "${SANS}"`), ax + av / 2, y + av + 44, { size: 26, weight: '500', color: '#fff', align: 'center' });
    text(ctx, ellipsize(ctx, role, av + agap * 0.6, `400 24px "${SANS}"`), ax + av / 2, y + av + 78, { size: 24, weight: '400', color: W50, align: 'center' });
  });

  // more like this peek
  y += av + 150;
  text(ctx, 'More Like This', PAD, y, { size: 42, weight: '700', color: '#fff' });
  y += 36;
  const pw = 300, ph = pw * 1.5;
  [['Velvet Machine', 5, 'Sci-Fi'], ['Solar Saints', 7, 'Sci-Fi'], ['The Long Static', 2, 'Mystery'], ['Hollow Tide', 8, 'Horror']].forEach(([t, pi, genre], i) => {
    poster(ctx, PAD + i * (pw + 28), y, pw, ph, { title: t, genre, pi });
  });
  homeIndicator(ctx);
  return c;
}

// ---------- screen 3: Player + Skip Intro ----------
function player() {
  const { c, ctx } = base();
  // scene
  ctx.fillStyle = lin(ctx, 0, 0, W, H, [[0, '#15324A'], [0.45, '#1A2138'], [1, '#05070C']]);
  ctx.fillRect(0, 0, W, H);
  // sun glow
  const sun = ctx.createRadialGradient(W * 0.7, H * 0.34, 0, W * 0.7, H * 0.34, W * 0.7);
  sun.addColorStop(0, 'rgba(255,170,80,0.5)');
  sun.addColorStop(0.4, 'rgba(255,140,60,0.12)');
  sun.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.arc(W * 0.7, H * 0.34, 130, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,200,130,0.85)';
  ctx.fill();
  // mountains silhouette
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.62);
  ctx.lineTo(W * 0.22, H * 0.5);
  ctx.lineTo(W * 0.44, H * 0.6);
  ctx.lineTo(W * 0.66, H * 0.44);
  ctx.lineTo(W * 0.86, H * 0.57);
  ctx.lineTo(W, H * 0.5);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = lin(ctx, 0, H * 0.6, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']]);
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
  grain(ctx, 0, 0, W, H, 0.04, 2);

  // top scrim
  ctx.fillStyle = lin(ctx, 0, 0, 0, 320, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 0, W, 320);
  statusBar(ctx);
  // back + title
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(PAD + 26, 168);
  ctx.lineTo(PAD + 4, 192);
  ctx.lineTo(PAD + 26, 216);
  ctx.stroke();
  text(ctx, 'Aurora Drift', PAD + 60, 204, { size: 40, weight: '700', color: '#fff' });
  text(ctx, 'Crucible', W - PAD, 204, { size: 30, weight: '500', color: W50, align: 'right' });

  // center transport
  const cy = H * 0.46;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  // play triangle
  ctx.beginPath();
  ctx.moveTo(W / 2 - 38, cy - 56);
  ctx.lineTo(W / 2 - 38, cy + 56);
  ctx.lineTo(W / 2 + 60, cy);
  ctx.closePath();
  ctx.fill();
  // skip back / forward
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 9;
  for (const dir of [-1, 1]) {
    const sx = W / 2 + dir * 300;
    ctx.beginPath();
    ctx.arc(sx, cy, 50, Math.PI * 0.55 * dir, Math.PI * (1.85) * dir, dir < 0);
    ctx.stroke();
    text(ctx, '10', sx, cy + 14, { size: 32, weight: '700', color: '#fff', align: 'center' });
  }

  // Skip Intro pill (the hero feature)
  const piw = 360, pih = 96, px = W - PAD - piw, py = H - 540;
  ctx.save();
  rr(ctx, px, py, piw, pih, pih / 2);
  ctx.fillStyle = 'rgba(20,20,24,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  text(ctx, 'Skip Intro', px + 56, py + 62, { size: 40, weight: '700', color: '#fff' });
  // forward icon
  ctx.fillStyle = '#fff';
  const ix = px + piw - 78;
  ctx.beginPath();
  ctx.moveTo(ix, py + 32); ctx.lineTo(ix, py + 64); ctx.lineTo(ix + 26, py + 48); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ix + 22, py + 32); ctx.lineTo(ix + 22, py + 64); ctx.lineTo(ix + 48, py + 48); ctx.closePath(); ctx.fill();

  // scrubber
  const by = H - 360;
  text(ctx, '24:10', PAD, by - 30, { size: 30, weight: '500', color: '#fff' });
  text(ctx, '-1:47:50', W - PAD, by - 30, { size: 30, weight: '500', color: W70, align: 'right' });
  const tw = W - PAD * 2;
  rr(ctx, PAD, by, tw, 12, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fill();
  const prog = 0.2;
  rr(ctx, PAD, by, tw * prog, 12, 6);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(PAD + tw * prog, by + 6, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // bottom controls row
  const ry = H - 230;
  const icons = ['captions', 'audio', 'speed', 'pip', 'airplay'];
  const spacing = tw / icons.length;
  icons.forEach((ic, i) => {
    const x = PAD + spacing * i + spacing / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 5;
    if (ic === 'captions') {
      rr(ctx, x - 30, ry - 22, 60, 44, 8); ctx.stroke();
      text(ctx, 'cc', x, ry + 6, { size: 26, weight: '700', color: '#fff', align: 'center' });
    } else if (ic === 'pip') {
      rr(ctx, x - 30, ry - 22, 60, 44, 8); ctx.stroke();
      ctx.fillRect(x - 2, ry - 4, 28, 20);
    } else if (ic === 'airplay') {
      ctx.beginPath(); ctx.moveTo(x - 28, ry + 6); ctx.lineTo(x + 28, ry + 6); ctx.lineTo(x, ry - 24); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 16, ry + 26); ctx.lineTo(x + 16, ry + 26); ctx.lineTo(x, ry + 6); ctx.closePath(); ctx.fill();
    } else if (ic === 'audio') {
      ctx.beginPath(); ctx.arc(x, ry, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, ry, 9, 0, Math.PI * 2); ctx.fill();
    } else {
      // speed gauge
      ctx.beginPath(); ctx.arc(x, ry + 4, 22, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, ry + 4); ctx.lineTo(x + 12, ry - 8); ctx.stroke();
    }
  });
  homeIndicator(ctx);
  return c;
}

// ---------- screen 4: Library grid ----------
function library() {
  const { c, ctx } = base();
  statusBar(ctx);
  text(ctx, 'Movies', PAD, 250, { size: 80, weight: '900', color: '#fff' });
  // top-right icons: filter + folder
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 7;
  let ix = W - PAD - 40;
  // folder
  rr(ctx, ix - 6, 188, 84, 60, 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ix - 6, 198); ctx.lineTo(ix + 18, 198); ctx.lineTo(ix + 28, 210); ctx.stroke();
  // filter
  ix -= 130;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(ix - 30 + k * 6, 200 + k * 22); ctx.lineTo(ix + 38 - k * 6, 200 + k * 22); ctx.stroke(); }

  let y = 360;
  y = carousel(ctx, 'Continue Watching', y, [
    { title: 'Aurora Drift', sub: '1h 12m left', pi: 0, progress: 0.48, play: true },
    { title: 'Crimson Harbor', sub: '38m left', pi: 3, progress: 0.74, play: true },
    { title: 'Paper Cities', sub: '1h 02m left', pi: 4, progress: 0.4, play: true },
    { title: 'Solar Saints', sub: '22m left', pi: 7, progress: 0.85, play: true },
  ], { pw: 300 });

  // 3-col grid
  const cols = 3;
  const gap = 28;
  const pw = (W - PAD * 2 - gap * (cols - 1)) / cols;
  const ph = pw * 1.5;
  const grid = [
    ['The Glass Atlas', 1], ['Nightfall Province', 3], ['Velvet Machine', 5],
    ['The Last Cartographer', 6], ['Ember & Ash', 9], ['Hollow Tide', 8],
    ['Paper Cities', 4], ['Solar Saints', 7], ['Crimson Harbor', 10],
  ];
  text(ctx, 'All Movies', PAD, y, { size: 42, weight: '700', color: '#fff' });
  y += 40;
  grid.forEach(([t, pi], i) => {
    const cx = PAD + (i % cols) * (pw + gap);
    const cy = y + Math.floor(i / cols) * (ph + 66);
    poster(ctx, cx, cy, pw, ph, { title: t, pi });
  });
  tabBar(ctx, 1);
  homeIndicator(ctx);
  return c;
}

const screens = [home, detail, player, library];
screens.forEach((fn, i) => {
  const canvas = fn();
  fs.writeFileSync(path.join(outDir, `iphone-${i + 1}.png`), canvas.toBuffer('image/png'));
  console.log(`✓ iphone-${i + 1}.png`);
});
console.log('done');
