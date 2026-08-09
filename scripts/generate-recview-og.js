#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const mono = "ui-monospace, 'DejaVu Sans Mono', Menlo, Monaco, 'Courier New', monospace";
const W = 1200;
const H = 630;
const ACCENT = '#619eeb';

const SHOT = { x: 690, y: 176, w: 440, h: 326 };

const lines = [
  'trim · crop · loop the selection',
  'cut · 9:16 · webp · ≤10 MB',
  'H.264 + AAC-LC, upload-ready',
];

const rows = lines
  .map((line, i) => {
    const y = 330 + i * 46;
    return `<text x="80" y="${y}" xml:space="preserve"><tspan class="accent">&gt; </tspan><tspan class="row">${line}</tspan></text>`;
  })
  .join('\n  ');

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: ${mono}; }
    .chrome { fill: #9198a1; font-size: 20px; }
    .prompt { fill: #9198a1; font-size: 24px; }
    .green { fill: #33ff66; }
    .accent { fill: ${ACCENT}; }
    .title { fill: #33ff66; font-size: 62px; font-weight: bold; }
    .tagline { fill: #e6edf3; font-size: 27px; }
    .row { fill: #c9d1d9; font-size: 26px; }
    .stats { fill: #ffb000; font-size: 24px; }
  </style>
  <rect width="${W}" height="${H}" fill="#0d1117"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="10" fill="#0d1117" stroke="#2d333b" stroke-width="2"/>
  <rect x="40" y="40" width="${W - 80}" height="48" rx="10" fill="#161b22"/>
  <rect x="40" y="72" width="${W - 80}" height="16" fill="#161b22"/>
  <circle cx="70" cy="64" r="7" fill="#ff7b72"/>
  <circle cx="94" cy="64" r="7" fill="#ffb000"/>
  <circle cx="118" cy="64" r="7" fill="#33ff66"/>
  <text x="150" y="71" class="chrome">guitaripod@midgar: ~/Clips</text>

  <text x="80" y="152" class="prompt" xml:space="preserve"><tspan class="green">$ </tspan>rec --toggle</text>
  <text x="78" y="228" class="title">recview</text>
  <text x="80" y="272" class="tagline">review it the second it ends</text>

  ${rows}

  <rect x="${SHOT.x - 2}" y="${SHOT.y - 2}" width="${SHOT.w + 4}" height="${SHOT.h + 4}" rx="8" fill="#161b22" stroke="#2d333b" stroke-width="2"/>

  <text x="80" y="556" class="stats">GTK4 · libmpv · NVENC · GPL-3.0 · cargo install recview</text>
</svg>`;

try {
  const sharp = (await import('sharp')).default;
  const shot = await sharp(path.join(ROOT, 'public', 'recview-window.png'))
    .resize(SHOT.w, SHOT.h, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();
  const png = await sharp(Buffer.from(svg))
    .composite([{ input: shot, top: SHOT.y, left: SHOT.x }])
    .png()
    .toBuffer();
  const outDir = path.join(ROOT, 'public', 'og');
  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, 'recview.png');
  await fs.writeFile(outputPath, png);
  console.log(`✓ recview OG image generated at: ${path.relative(ROOT, outputPath)} (${W}x${H})`);
} catch (error) {
  console.error('Error generating recview OG image:', error);
  process.exit(1);
}
