#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const linuxData = JSON.parse(
  await fs.readFile(path.join(ROOT, 'src/data/linux-apps.json'), 'utf-8')
);

/// The same weighting as `linuxScore` in src/data/linux.ts without the recency bonus:
/// commits and releases carry the weight, stars barely count.
const workScore = (app) =>
  2 * Math.log(1 + (app.commitCount ?? 0)) +
  2.5 * Math.log(1 + (app.releaseCount ?? 0)) +
  0.4 * Math.log(1 + (app.stars ?? 0));

const apps = linuxData.apps;
const releaseCount = apps.reduce((sum, app) => sum + (app.releaseCount ?? 0), 0);
const commitCount = apps.reduce((sum, app) => sum + (app.commitCount ?? 0), 0);
const ranked = [...apps].sort((a, b) => workScore(b) - workScore(a));
const topApps = ranked.slice(0, 4).sort((a, b) => (b.commitCount ?? 0) - (a.commitCount ?? 0));
const maxCommits = Math.max(1, ...apps.map((app) => app.commitCount ?? 0));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => Number(n).toLocaleString('en-US');
const mono = "ui-monospace, 'DejaVu Sans Mono', Menlo, Monaco, 'Courier New', monospace";
const W = 1200;
const H = 630;
const GREEN = '#33ff66';
const AMBER = '#ffb000';

/// Windows of the collage, back to front. Each is a real screenshot from the page.
const WINDOWS = [
  { file: 'public/screenshots/flaccy/linux-1.webp', x: 762, y: 116, w: 368, h: 207 },
  { file: 'public/screenshots/tailscode/desk-dark-chat.webp', x: 690, y: 208, w: 440, h: 248 },
  { file: 'public/screenshots/linux/unrager.webp', x: 662, y: 336, w: 204, h: 188 },
];
const RADIUS = 8;

/// One row of the weight list: the app, a bar sized like the page's commit bars, the count.
const weightRows = topApps
  .map((app, i) => {
    const y = 388 + i * 40;
    const fill = Math.max(0.04, Math.sqrt((app.commitCount ?? 0) / maxCommits));
    const barW = Math.round(150 * fill);
    return `<text x="80" y="${y}" class="name">${esc(app.id)}</text>
  <rect x="268" y="${y - 9}" width="150" height="6" rx="3" fill="#21262d"/>
  <rect x="268" y="${y - 9}" width="${barW}" height="6" rx="3" fill="${GREEN}"/>
  <text x="432" y="${y}" class="count">${num(app.commitCount ?? 0)}</text>`;
  })
  .join('\n  ');

const shadows = WINDOWS.map(
  (win) =>
    `<rect x="${win.x + 4}" y="${win.y + 14}" width="${win.w}" height="${win.h}" rx="${RADIUS}" fill="#000" opacity="0.55" filter="url(#blur)"/>`
).join('\n  ');

const base = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="16"/></filter>
    <radialGradient id="glow" cx="78%" cy="46%" r="46%">
      <stop offset="0" stop-color="${GREEN}" stop-opacity="0.11"/>
      <stop offset="1" stop-color="${GREEN}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="frame"><rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="10"/></clipPath>
  </defs>
  <style>
    text { font-family: ${mono}; }
    .chrome { fill: #9198a1; font-size: 20px; }
    .prompt { fill: #9198a1; font-size: 24px; }
    .green { fill: ${GREEN}; }
    .title { fill: #e6edf3; font-size: 66px; font-weight: bold; }
    .title-accent { fill: ${GREEN}; font-size: 66px; font-weight: bold; }
    .label { fill: #7d8590; font-size: 15px; letter-spacing: 3px; }
    .name { fill: #e6edf3; font-size: 22px; }
    .count { fill: #9198a1; font-size: 20px; }
    .stats { fill: ${AMBER}; font-size: 24px; }
    .url { fill: #3fb950; font-size: 20px; }
  </style>
  <rect width="${W}" height="${H}" fill="#0d1117"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="10" fill="#0d1117" stroke="#2d333b" stroke-width="2"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="10" fill="url(#glow)" clip-path="url(#frame)"/>
  <rect x="40" y="40" width="${W - 80}" height="48" rx="10" fill="#161b22"/>
  <rect x="40" y="72" width="${W - 80}" height="16" fill="#161b22"/>
  <circle cx="70" cy="64" r="7" fill="#ff7b72"/>
  <circle cx="94" cy="64" r="7" fill="${AMBER}"/>
  <circle cx="118" cy="64" r="7" fill="${GREEN}"/>
  <text x="150" y="71" class="chrome">guitaripod@midgar: ~/linux</text>

  <text x="80" y="150" class="prompt" xml:space="preserve"><tspan class="green">$ </tspan>ls ~/linux --sort=work</text>
  <text x="78" y="224" class="title-accent">Linux</text>
  <text x="78" y="294" class="title">Apps &amp; Tools</text>

  <text x="80" y="346" class="label">MOST WORK · COMMITS</text>
  ${weightRows}

  <text x="80" y="562" class="stats">${apps.length} apps · ${num(commitCount)} commits · ${releaseCount} releases</text>
  <text x="1120" y="562" class="url" text-anchor="end">midgarcorp.cc/linux</text>
  ${shadows}
</svg>`;

/// A 1px frame drawn over a window so its edge reads against the dark card.
const borderFor = (win) =>
  Buffer.from(
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect x="${win.x + 0.5}" y="${win.y + 0.5}" width="${win.w - 1}" height="${win.h - 1}" rx="${RADIUS}" fill="none" stroke="#3d444d" stroke-width="1"/></svg>`
  );

try {
  const sharp = (await import('sharp')).default;

  const mask = (win) =>
    Buffer.from(
      `<svg width="${win.w}" height="${win.h}" xmlns="http://www.w3.org/2000/svg"><rect width="${win.w}" height="${win.h}" rx="${RADIUS}" fill="#fff"/></svg>`
    );

  const layers = [];
  for (const win of WINDOWS) {
    const shot = await sharp(path.join(ROOT, win.file))
      .resize(win.w, win.h, { fit: 'cover', position: 'top' })
      .composite([{ input: mask(win), blend: 'dest-in' }])
      .png()
      .toBuffer();
    layers.push({ input: shot, top: win.y, left: win.x });
    layers.push({ input: borderFor(win), top: 0, left: 0 });
  }

  const png = await sharp(Buffer.from(base)).composite(layers).png().toBuffer();
  const outputPath = path.join(ROOT, 'public', 'og-linux.png');
  await fs.writeFile(outputPath, png);
  console.log(`✓ Linux OG image generated at: ${path.relative(ROOT, outputPath)} (${W}x${H})`);
} catch (error) {
  console.error('Error generating Linux OG image:', error);
  process.exit(1);
}
