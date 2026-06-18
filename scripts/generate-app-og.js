#!/usr/bin/env node
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const facts = JSON.parse(fs.readFileSync(path.join(root, 'src/data/landing-facts.json'), 'utf8')).apps;

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

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
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
      const boxH = portrait ? th - 150 : 300;
      const scale = boxH / shot.h;
      const drawW = shot.w * scale;
      const drawH = shot.h * scale;
      const dx = tx + tw - 52 - drawW;
      const dy = contentTop + (th - 44 - drawH) / 2 - 6;
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 48;
      ctx.shadowOffsetY = 18;
      roundRectPath(ctx, dx, dy, drawW, drawH, portrait ? 28 : 12);
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
  const subtitle = app.name.includes(':') ? app.name.split(':').slice(1).join(':').trim() : app.category || '';
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
  const meta = app.status === 'review' ? 'Coming soon' : app.ratingCount > 0 ? `★ ${app.rating.toFixed(1)}` : 'New';
  ctx.fillStyle = app.status === 'review' ? AMBER : app.ratingCount > 0 ? AMBER : MUTED;
  ctx.fillText(meta, chipX, cursorY);
  chipX += ctx.measureText(meta).width + 22;
  ctx.fillStyle = FAINT;
  ctx.fillText(app.platforms.join(' · '), chipX, cursorY);

  // prompt CTA
  const promptY = contentTop + th - 44 - 34;
  ctx.font = `bold 21px ${MONO}`;
  ctx.fillStyle = GREEN;
  const verb = app.status === 'review' ? 'coming soon to the App Store' : 'download on the App Store';
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
