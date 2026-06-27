// Generates marketing screenshots for the Crucible landing page using real
// TMDB poster/backdrop artwork (what a real Plex library looks like).
// Artwork is fetched to a temp cache — nothing copyrighted is committed, only
// the rendered screenshots. Output: /tmp/crucible_screens/iphone-{1..4}.png

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCanvas, registerFont, loadImage } = require('canvas');

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

const outDir = '/tmp/crucible_screens';
fs.mkdirSync(outDir, { recursive: true });

// --- TMDB artwork (poster hashes from the public image CDN) ---
const POSTERS = {
  interstellar: 'wgtkLBiVfF53GQO9xiMXZU6JjNj',
  dune2: 'heM4XKC0jA8fTSNe8F7oUkcJV7Z',
  br2049: 'gajva2L0rPYkEWjzgFlBXCAVBE5',
  oppenheimer: '8Gxv8gSFCU0XGDykEGv7zR1n2ua',
  madmax: 'hA2ple9q4qnwxp3hKVNhroipsir',
  spiderverse: 'iiZZdoQBEYBv6id8su7ImL0oCbD',
  eeaao: 'u68AjlvlutfEIcpmbYpKcdi09ut',
  topgun: 'n0YuM4f5lvGAP6MAW2kBIzugXnc',
  arrival: 'x2FJsf1ElAgr63Y3PNPtJrcmpoe',
  parasite: '7IiTTgloJzvGI1TAYymCfbfl3vT',
  martian: 'fASz8A0yFE3QB6LgGoOfwvFSseV',
  dune1: 'gDzOcq0pfeCeqMBwKIJlSmQpjkZ',
};
const BACKDROP = 'mVr0UiqyltcfqxbAUcLl9zWL8ah'; // Blade Runner 2049, 16:9

const CACHE = path.join(os.tmpdir(), 'crucible-tmdb');
fs.mkdirSync(CACHE, { recursive: true });
async function fetchImg(file, url) {
  const p = path.join(CACHE, file);
  if (!fs.existsSync(p)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
    fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return loadImage(p);
}

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

function fitSize(ctx, str, maxW, maxSize, weight, min = 44) {
  let s = maxSize;
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px "${SANS}"`;
    if (ctx.measureText(str).width <= maxW) break;
  }
  return s;
}

function coverImage(ctx, img, x, y, w, h) {
  const ir = img.width / img.height;
  const br = w / h;
  let sw, sh, sx, sy;
  if (ir > br) {
    sh = img.height;
    sw = sh * br;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / br;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// real-poster tile
function poster(ctx, x, y, w, h, img, opts = {}) {
  const r = w * 0.06;
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  if (img) coverImage(ctx, img, x, y, w, h);
  else {
    ctx.fillStyle = '#16181e';
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (opts.progress != null) {
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = lin(ctx, x, y + h - w * 0.22, x, y + h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.78)']]);
    ctx.fillRect(x, y + h - w * 0.24, w, w * 0.24);
    ctx.restore();
    const by = y + h - w * 0.07;
    rr(ctx, x + w * 0.06, by, w * 0.88, w * 0.022, w * 0.012);
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fill();
    rr(ctx, x + w * 0.06, by, w * 0.88 * opts.progress, w * 0.022, w * 0.012);
    ctx.fillStyle = ACCENT;
    ctx.fill();
  }
  if (opts.play) {
    const cx = x + w - w * 0.21;
    const cy = y + h - w * 0.21;
    const pr = w * 0.13;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - pr * 0.26, cy - pr * 0.4);
    ctx.lineTo(cx - pr * 0.26, cy + pr * 0.4);
    ctx.lineTo(cx + pr * 0.44, cy);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}

function statusBar(ctx, y = 0) {
  text(ctx, '9:41', PAD + 8, y + 96, { size: 38, weight: '700', color: '#fff' });
  const rx = W - PAD - 8;
  let bx = rx - 150;
  [14, 22, 30, 38].forEach((bh) => {
    ctx.fillStyle = '#fff';
    rr(ctx, bx, y + 90 - bh, 16, bh, 4);
    ctx.fill();
    bx += 24;
  });
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 7;
  const wx = rx - 78;
  const wy = y + 86;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(wx, wy, i * 11, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(wx, wy, 5, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = 'rgba(10,10,12,0.9)';
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
      if (on) ctx.fillRect(cx - 18, cy, 36, 24);
      else ctx.strokeRect(cx - 18, cy, 36, 24);
    } else if (i === 1) {
      for (let k = 0; k < 3; k++) {
        rr(ctx, cx - 24, cy - 22 + k * 16, 48, 10, 3);
        ctx.fill();
      }
    } else if (i === 2) {
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 8, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 8, cy + 6);
      ctx.lineTo(cx + 24, cy + 22);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy - 6, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - 6, 8, 0, Math.PI * 2);
      ctx.stroke();
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
    poster(ctx, x, ty, pw, ph, it.img, it);
    x += pw + gap;
  });
  return ty + ph + 64;
}

// ---------- screens ----------
function home(I) {
  const { c, ctx } = base();
  statusBar(ctx);
  text(ctx, 'Home', PAD, 250, { size: 80, weight: '900', color: '#fff' });
  let y = 360;
  y = carousel(ctx, 'Continue Watching', y, [
    { img: I.interstellar, progress: 0.62 },
    { img: I.dune2, progress: 0.31 },
    { img: I.br2049, progress: 0.48 },
    { img: I.oppenheimer, progress: 0.8 },
  ]);
  y = carousel(ctx, 'On Deck', y, [{ img: I.topgun }, { img: I.arrival }, { img: I.madmax }, { img: I.spiderverse }]);
  y = carousel(ctx, 'Recently Added', y, [{ img: I.parasite }, { img: I.eeaao }, { img: I.martian }, { img: I.dune1 }]);
  tabBar(ctx, 0);
  homeIndicator(ctx);
  return c;
}

function detail(I) {
  const { c, ctx } = base();
  const heroH = 1180;
  ctx.save();
  rr(ctx, 0, 0, W, heroH, 0);
  ctx.clip();
  coverImage(ctx, I.backdrop, 0, 0, W, heroH);
  ctx.fillStyle = lin(ctx, 0, heroH * 0.35, 0, heroH, [[0, 'rgba(0,0,0,0)'], [0.65, 'rgba(0,0,0,0.55)'], [1, '#000']]);
  ctx.fillRect(0, 0, W, heroH);
  ctx.restore();

  statusBar(ctx);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(PAD + 26, 168);
  ctx.lineTo(PAD + 4, 192);
  ctx.lineTo(PAD + 26, 216);
  ctx.stroke();

  let y = heroH - 250;
  const title = 'BLADE RUNNER 2049';
  const ts = fitSize(ctx, title, W - PAD * 2, 92, '900', 54);
  text(ctx, title, PAD, y, { size: ts, weight: '900', color: '#fff' });
  y += 64;
  let mx = PAD;
  mx += text(ctx, '2017', mx, y, { size: 34, weight: '500', color: W70 }) + 26;
  text(ctx, '★', mx, y, { size: 34, weight: '700', color: ACCENT });
  mx += 44;
  mx += text(ctx, '8.0', mx, y, { size: 34, weight: '500', color: W70 }) + 26;
  text(ctx, 'Sci-Fi · 2h 44m', mx, y, { size: 34, weight: '500', color: W70 });
  y += 56;
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
  text(ctx, 'Resume from 1:12:40', pcx + 52, y + 70, { size: 38, weight: '700', color: '#fff' });

  y += 190;
  const ov = [
    'Thirty years after the events of the first film, a new',
    'blade runner, LAPD Officer K, unearths a long-buried',
    'secret that has the potential to plunge what is left of',
    'society into chaos.',
  ];
  ov.forEach((line, i) => text(ctx, line, PAD, y + i * 46, { size: 32, weight: '400', color: W70 }));
  y += ov.length * 46 + 40;

  text(ctx, 'Cast & Crew', PAD, y, { size: 42, weight: '700', color: '#fff' });
  y += 70;
  const cast = [
    ['Ryan Gosling', 'Officer K', '#2563EB'],
    ['Ana de Armas', 'Joi', '#E11D48'],
    ['Harrison Ford', 'Rick Deckard', '#0EA5A4'],
    ['Sylvia Hoeks', 'Luv', '#7C3AED'],
    ['Robin Wright', 'Lt. Joshi', '#F59E0B'],
  ];
  const av = 150;
  const agap = (W - PAD * 2 - av * 5) / 4;
  cast.forEach(([name, role, col], i) => {
    const ax = PAD + i * (av + agap);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + av / 2, y + av / 2, av / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = lin(ctx, ax, y, ax + av, y + av, [[0, col], [1, 'rgba(0,0,0,0.55)']]);
    ctx.fillRect(ax, y, av, av);
    const initials = name.split(' ').map((s) => s[0]).join('');
    text(ctx, initials, ax + av / 2, y + av / 2 + 22, { size: 56, weight: '700', color: 'rgba(255,255,255,0.95)', align: 'center' });
    ctx.restore();
    text(ctx, ellip(ctx, name, av + agap * 0.6, 26), ax + av / 2, y + av + 44, { size: 26, weight: '500', color: '#fff', align: 'center' });
    text(ctx, ellip(ctx, role, av + agap * 0.6, 24), ax + av / 2, y + av + 78, { size: 24, weight: '400', color: W50, align: 'center' });
  });

  y += av + 150;
  text(ctx, 'More Like This', PAD, y, { size: 42, weight: '700', color: '#fff' });
  y += 36;
  const pw = 300;
  const ph = pw * 1.5;
  [I.arrival, I.interstellar, I.dune1, I.oppenheimer].forEach((img, i) => {
    poster(ctx, PAD + i * (pw + 28), y, pw, ph, img);
  });
  homeIndicator(ctx);
  return c;
}

function ellip(ctx, str, max, size) {
  ctx.font = `400 ${size}px "${SANS}"`;
  if (ctx.measureText(str).width <= max) return str;
  let s = str;
  while (s.length && ctx.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

function player(I) {
  const { c, ctx } = base();
  coverImage(ctx, I.backdrop, 0, 0, W, H);
  // cinematic scrims
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = lin(ctx, 0, 0, 0, 320, [[0, 'rgba(0,0,0,0.65)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 0, W, 320);
  ctx.fillStyle = lin(ctx, 0, H - 560, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.82)']]);
  ctx.fillRect(0, H - 560, W, 560);

  statusBar(ctx);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(PAD + 26, 168);
  ctx.lineTo(PAD + 4, 192);
  ctx.lineTo(PAD + 26, 216);
  ctx.stroke();
  text(ctx, 'Blade Runner 2049', PAD + 60, 204, { size: 40, weight: '700', color: '#fff' });
  text(ctx, 'Crucible', W - PAD, 204, { size: 30, weight: '500', color: W50, align: 'right' });

  const cy = H * 0.46;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 38, cy - 56);
  ctx.lineTo(W / 2 - 38, cy + 56);
  ctx.lineTo(W / 2 + 60, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 9;
  for (const dir of [-1, 1]) {
    const sx = W / 2 + dir * 300;
    ctx.beginPath();
    ctx.arc(sx, cy, 50, Math.PI * 0.55 * dir, Math.PI * 1.85 * dir, dir < 0);
    ctx.stroke();
    text(ctx, '10', sx, cy + 14, { size: 32, weight: '700', color: '#fff', align: 'center' });
  }

  // Skip Intro glass pill
  const piw = 360;
  const pih = 96;
  const px = W - PAD - piw;
  const py = H - 540;
  rr(ctx, px, py, piw, pih, pih / 2);
  ctx.fillStyle = 'rgba(20,20,24,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();
  text(ctx, 'Skip Intro', px + 56, py + 62, { size: 40, weight: '700', color: '#fff' });
  ctx.fillStyle = '#fff';
  const ix = px + piw - 78;
  ctx.beginPath();
  ctx.moveTo(ix, py + 32);
  ctx.lineTo(ix, py + 64);
  ctx.lineTo(ix + 26, py + 48);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(ix + 22, py + 32);
  ctx.lineTo(ix + 22, py + 64);
  ctx.lineTo(ix + 48, py + 48);
  ctx.closePath();
  ctx.fill();

  const by = H - 360;
  text(ctx, '1:12:40', PAD, by - 30, { size: 30, weight: '500', color: '#fff' });
  text(ctx, '-1:31:20', W - PAD, by - 30, { size: 30, weight: '500', color: W70, align: 'right' });
  const tw = W - PAD * 2;
  rr(ctx, PAD, by, tw, 12, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();
  const prog = 0.44;
  rr(ctx, PAD, by, tw * prog, 12, 6);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(PAD + tw * prog, by + 6, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  const ry = H - 230;
  const icons = ['captions', 'audio', 'speed', 'pip', 'airplay'];
  const sp = tw / icons.length;
  icons.forEach((ic, i) => {
    const x = PAD + sp * i + sp / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 5;
    if (ic === 'captions') {
      rr(ctx, x - 30, ry - 22, 60, 44, 8);
      ctx.stroke();
      text(ctx, 'cc', x, ry + 6, { size: 26, weight: '700', color: '#fff', align: 'center' });
    } else if (ic === 'pip') {
      rr(ctx, x - 30, ry - 22, 60, 44, 8);
      ctx.stroke();
      ctx.fillRect(x - 2, ry - 4, 28, 20);
    } else if (ic === 'airplay') {
      ctx.beginPath();
      ctx.moveTo(x - 28, ry + 6);
      ctx.lineTo(x + 28, ry + 6);
      ctx.lineTo(x, ry - 24);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 16, ry + 26);
      ctx.lineTo(x + 16, ry + 26);
      ctx.lineTo(x, ry + 6);
      ctx.closePath();
      ctx.fill();
    } else if (ic === 'audio') {
      ctx.beginPath();
      ctx.arc(x, ry, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, ry, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, ry + 4, 22, Math.PI * 0.8, Math.PI * 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, ry + 4);
      ctx.lineTo(x + 12, ry - 8);
      ctx.stroke();
    }
  });
  homeIndicator(ctx);
  return c;
}

function library(I) {
  const { c, ctx } = base();
  statusBar(ctx);
  text(ctx, 'Movies', PAD, 250, { size: 80, weight: '900', color: '#fff' });
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 7;
  let ix = W - PAD - 40;
  rr(ctx, ix - 6, 188, 84, 60, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ix - 6, 198);
  ctx.lineTo(ix + 18, 198);
  ctx.lineTo(ix + 28, 210);
  ctx.stroke();
  ix -= 130;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(ix - 30 + k * 6, 200 + k * 22);
    ctx.lineTo(ix + 38 - k * 6, 200 + k * 22);
    ctx.stroke();
  }

  let y = 360;
  y = carousel(ctx, 'Continue Watching', y, [
    { img: I.dune2, progress: 0.48, play: true },
    { img: I.interstellar, progress: 0.74, play: true },
    { img: I.madmax, progress: 0.4, play: true },
    { img: I.topgun, progress: 0.85, play: true },
  ], { pw: 300 });

  const cols = 3;
  const gap = 28;
  const pw = (W - PAD * 2 - gap * (cols - 1)) / cols;
  const ph = pw * 1.5;
  const grid = [I.br2049, I.oppenheimer, I.arrival, I.spiderverse, I.eeaao, I.parasite, I.martian, I.dune1, I.dune2];
  text(ctx, 'All Movies', PAD, y, { size: 42, weight: '700', color: '#fff' });
  y += 40;
  grid.forEach((img, i) => {
    const cx = PAD + (i % cols) * (pw + gap);
    const cyy = y + Math.floor(i / cols) * (ph + 30);
    poster(ctx, cx, cyy, pw, ph, img);
  });
  tabBar(ctx, 1);
  homeIndicator(ctx);
  return c;
}

(async () => {
  const I = {};
  for (const [k, hash] of Object.entries(POSTERS)) {
    I[k] = await fetchImg(`poster_${k}.jpg`, `https://image.tmdb.org/t/p/w780/${hash}.jpg`);
  }
  I.backdrop = await fetchImg('backdrop.jpg', `https://image.tmdb.org/t/p/w1280/${BACKDROP}.jpg`);

  const screens = [home, detail, player, library];
  screens.forEach((fn, i) => {
    fs.writeFileSync(path.join(outDir, `iphone-${i + 1}.png`), fn(I).toBuffer('image/png'));
    console.log(`✓ iphone-${i + 1}.png`);
  });
  console.log('done');
})();
