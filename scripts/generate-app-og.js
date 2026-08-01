#!/usr/bin/env node
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const facts = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/landing-facts.json'), 'utf8')
).apps;

const W = 1200;
const H = 630;
const BG = '#0d1117';
const PANEL = '#161b22';
const TITLEBAR = '#1c2128';
const BORDER = '#2d333b';
const TEXT = '#e6edf3';
const MUTED = '#9198a1';
const FAINT = '#7d8590';
const GREEN = '#33ff66';
const AMBER = '#ffb000';
const RED = '#ff7b72';
const MONO = 'Menlo, Monaco, "DejaVu Sans Mono", monospace';
const SANS = '"Helvetica Neue", Helvetica, Arial, "DejaVu Sans", sans-serif';

const outDir = path.join(root, 'public', 'og');
fs.mkdirSync(outDir, { recursive: true });

function readContent(slug) {
  const p = path.join(root, 'src/data/landing', `${slug}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexA(hex, a) {
  const m = hex.replace('#', '');
  const n =
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Cheap ordered dither to kill banding on large smooth gradients.
function dither(ctx, x, y, w, h, amount = 6) {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (((i / 4) * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;
    const v = n * amount;
    d[i] += v;
    d[i + 1] += v;
    d[i + 2] += v;
  }
  ctx.putImageData(img, x, y);
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  let dropped = false;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) {
        line = '';
        dropped = true;
        break;
      }
    } else {
      line = test;
    }
  }
  if (line) {
    if (lines.length < maxLines) lines.push(line);
    else dropped = true;
  }
  if (lines.length) {
    let last = lines[lines.length - 1];
    const overflow = ctx.measureText(last).width > maxWidth;
    if (overflow || dropped) {
      while (last.length && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = `${last}…`;
    }
  }
  return lines;
}

async function loadShotPng(absWebp) {
  const buf = await sharp(absWebp).png().toBuffer();
  return loadImage(buf);
}

async function generate(app) {
  const content = readContent(app.slug);
  if (!content) return;
  const accent = content.accentColor || app.primaryColor || GREEN;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, y, W, 1);
  }

  // terminal window
  const tx = 52;
  const ty = 52;
  const tw = W - 104;
  const th = H - 104;
  ctx.fillStyle = PANEL;
  roundRectPath(ctx, tx, ty, tw, th, 14);
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  roundRectPath(ctx, tx, ty, tw, th, 14);
  ctx.stroke();
  ctx.fillStyle = TITLEBAR;
  roundRectPath(ctx, tx, ty, tw, 44, 14);
  ctx.fill();
  ctx.fillStyle = TITLEBAR;
  ctx.fillRect(tx, ty + 22, tw, 22);
  [RED, AMBER, GREEN].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(tx + 26 + i * 24, ty + 22, 6.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = FAINT;
  ctx.font = `15px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText(`guitaripod@midgar: ~/apps/${app.slug}`, W / 2, ty + 27);
  ctx.textAlign = 'left';

  // ambient accent wash inside the panel (behind all content), dithered to avoid banding
  ctx.save();
  roundRectPath(ctx, tx + 1, ty + 44, tw - 2, th - 45, 13);
  ctx.clip();
  const washL = ctx.createRadialGradient(
    tx + tw * 0.14,
    ty + th * 0.34,
    0,
    tx + tw * 0.14,
    ty + th * 0.34,
    tw * 0.5
  );
  washL.addColorStop(0, hexA(accent, 0.1));
  washL.addColorStop(1, hexA(accent, 0));
  ctx.fillStyle = washL;
  ctx.fillRect(tx, ty, tw, th);
  const washR = ctx.createRadialGradient(
    tx + tw * 0.86,
    ty + th * 0.7,
    0,
    tx + tw * 0.86,
    ty + th * 0.7,
    tw * 0.5
  );
  washR.addColorStop(0, hexA(accent, 0.08));
  washR.addColorStop(1, hexA(accent, 0));
  ctx.fillStyle = washR;
  ctx.fillRect(tx, ty, tw, th);
  ctx.restore();
  dither(ctx, tx + 2, ty + 46, tw - 4, th - 48, 7);

  const contentTop = ty + 44;
  const padX = tx + 52;

  // hero screenshot on the right
  const shotKey = ['iphone', 'tv', 'mac', 'ipad'].find((k) => app.screenshots[k]?.length);
  let rightEdge = tx + tw - 52;
  if (shotKey) {
    try {
      const shot = app.screenshots[shotKey][0];
      const abs = path.join(root, 'public', shot.src.replace(/^\//, ''));
      const img = await loadShotPng(abs);
      const portrait = shot.h >= shot.w;
      const boxH = portrait ? th - 150 : 272;
      const scale = boxH / shot.h;
      const drawW = shot.w * scale;
      const drawH = shot.h * scale;
      const dx = tx + tw - 52 - drawW;
      const dy = contentTop + (th - 44 - drawH) / 2 - 6;
      const rad = portrait ? 28 : 12;
      // soft accent bloom
      ctx.save();
      ctx.shadowColor = hexA(accent, 0.55);
      ctx.shadowBlur = 90;
      ctx.shadowOffsetY = 0;
      roundRectPath(ctx, dx, dy, drawW, drawH, rad);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
      // neutral depth shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 38;
      ctx.shadowOffsetY = 26;
      roundRectPath(ctx, dx, dy, drawW, drawH, rad);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
      ctx.save();
      roundRectPath(ctx, dx + 6, dy + 6, drawW - 12, drawH - 12, portrait ? 22 : 8);
      ctx.clip();
      ctx.drawImage(img, dx + 6, dy + 6, drawW - 12, drawH - 12);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      roundRectPath(ctx, dx, dy, drawW, drawH, portrait ? 28 : 12);
      ctx.stroke();
      rightEdge = dx - 40;
    } catch (e) {
      console.warn(`  shot failed for ${app.slug}: ${e.message}`);
    }
  }

  const leftMax = rightEdge - padX;

  // icon
  let cursorY = contentTop + 60;
  const iconAbs = path.join(root, 'public', `screenshots/${app.slug}/icon.png`);
  let textX = padX;
  if (fs.existsSync(iconAbs)) {
    const icon = await loadImage(iconAbs);
    const isz = 88;
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 30;
    roundRectPath(ctx, padX, cursorY, isz, isz, 20);
    ctx.clip();
    ctx.drawImage(icon, padX, cursorY, isz, isz);
    ctx.restore();
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    roundRectPath(ctx, padX, cursorY, isz, isz, 20);
    ctx.stroke();
    textX = padX + isz + 22;
  }

  ctx.fillStyle = TEXT;
  ctx.font = `bold 40px ${SANS}`;
  ctx.fillText(app.shortName, textX, cursorY + 38);
  ctx.fillStyle = MUTED;
  ctx.font = `19px ${MONO}`;
  const subtitle = app.name.includes(':')
    ? app.name.split(':').slice(1).join(':').trim()
    : app.category || '';
  ctx.fillText(wrapText(ctx, subtitle, leftMax - (textX - padX), 1)[0] || '', textX, cursorY + 70);

  // headline
  cursorY += 150;
  ctx.fillStyle = TEXT;
  ctx.font = `bold 33px ${SANS}`;
  const headlineLines = wrapText(ctx, content.heroHeadline, leftMax, 3);
  for (const line of headlineLines) {
    ctx.fillText(line, padX, cursorY);
    cursorY += 42;
  }

  // accent divider
  cursorY += 6;
  ctx.fillStyle = accent;
  ctx.fillRect(padX, cursorY, 64, 4);
  cursorY += 34;

  // chips
  ctx.font = `19px ${MONO}`;
  ctx.fillStyle = AMBER;
  ctx.fillText(app.price, padX, cursorY);
  let chipX = padX + ctx.measureText(app.price).width + 22;
  ctx.fillStyle = MUTED;
  const released = app.releaseDate ? Date.parse(app.releaseDate) : NaN;
  const isNew = !Number.isNaN(released) && Date.now() - released < 120 * 86400000;
  const meta = app.openSource
    ? app.license || 'Open source'
    : app.status === 'review'
      ? 'Coming soon'
      : app.ratingCount > 0
        ? `★ ${app.rating.toFixed(1)}`
        : isNew
          ? 'New'
          : 'No ratings yet';
  ctx.fillStyle = app.openSource || app.status === 'review' || app.ratingCount > 0 ? AMBER : MUTED;
  ctx.fillText(meta, chipX, cursorY);
  chipX += ctx.measureText(meta).width + 22;
  ctx.fillStyle = FAINT;
  ctx.fillText(app.platforms.join(' · '), chipX, cursorY);

  // prompt CTA
  const promptY = contentTop + th - 44 - 34;

  // feature highlights — fill the gap above the prompt with what fits
  if (Array.isArray(content.highlights) && content.highlights.length) {
    let hy = cursorY + 50;
    const lineH = 30;
    for (const h of content.highlights) {
      if (hy > promptY - 44) break;
      ctx.fillStyle = accent;
      ctx.font = `bold 18px ${SANS}`;
      ctx.fillText('▸', padX, hy);
      ctx.fillStyle = MUTED;
      ctx.font = `17px ${SANS}`;
      ctx.fillText(wrapText(ctx, h, leftMax - 28, 1)[0] || '', padX + 28, hy);
      hy += lineH;
    }
  }
  ctx.font = `bold 21px ${MONO}`;
  ctx.fillStyle = GREEN;
  const verb = app.openSource
    ? 'build it from source on GitHub'
    : app.status === 'review'
      ? 'coming soon to the App Store'
      : 'download on the App Store';
  ctx.fillText('$ ', padX, promptY);
  ctx.fillStyle = TEXT;
  ctx.fillText(verb, padX + ctx.measureText('$ ').width, promptY);

  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, `${app.slug}.png`), buf);
  console.log(`✓ og/${app.slug}.png`);
}

const only = process.argv.slice(2);
for (const app of facts) {
  if (only.length && !only.includes(app.slug)) continue;
  try {
    await generate(app);
  } catch (e) {
    console.warn(`✗ ${app.slug}: ${e.message}`);
  }
}
console.log('done.');
