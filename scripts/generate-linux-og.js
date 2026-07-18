#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const linuxData = JSON.parse(
  await fs.readFile(path.join(ROOT, 'src/data/linux-apps.json'), 'utf-8')
);

// linux-apps.json is already lead-first with live release counts and languages.
const apps = linuxData.apps;
const releaseCount = apps.reduce((sum, app) => sum + (app.releaseCount ?? 0), 0);
const languages = [...new Set(apps.map((app) => app.language))];
const topApps = apps.slice(0, 6);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mono = "ui-monospace, 'DejaVu Sans Mono', Menlo, Monaco, 'Courier New', monospace";
const W = 1200;
const H = 630;

const rows = topApps
  .map((app, i) => {
    const y = 292 + i * 46;
    const name = esc(app.id).padEnd(18, ' ');
    const version = `v${esc(app.latestVersion ?? '?')}`.padEnd(12, ' ');
    const releases = `${app.releaseCount} ${app.releaseCount === 1 ? 'release' : 'releases'}`;
    return `<text x="80" y="${y}" xml:space="preserve"><tspan class="green">$ </tspan><tspan class="name">${name}</tspan><tspan class="ver">${version}</tspan><tspan class="dim">${releases}</tspan></text>`;
  })
  .join('\n      ');

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: ${mono}; }
    .chrome { fill: #9198a1; font-size: 20px; }
    .prompt { fill: #9198a1; font-size: 24px; }
    .green { fill: #33ff66; }
    .title { fill: #e6edf3; font-size: 62px; font-weight: bold; }
    .title-accent { fill: #33ff66; font-size: 62px; font-weight: bold; }
    .name { fill: #e6edf3; font-size: 26px; }
    .ver { fill: #3fb950; font-size: 26px; }
    .dim { fill: #7d8590; font-size: 26px; }
    .stats { fill: #ffb000; font-size: 26px; }
  </style>
  <rect width="${W}" height="${H}" fill="#0d1117"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="10" fill="#0d1117" stroke="#2d333b" stroke-width="2"/>
  <rect x="40" y="40" width="${W - 80}" height="48" rx="10" fill="#161b22"/>
  <rect x="40" y="72" width="${W - 80}" height="16" fill="#161b22"/>
  <circle cx="70" cy="64" r="7" fill="#ff7b72"/>
  <circle cx="94" cy="64" r="7" fill="#ffb000"/>
  <circle cx="118" cy="64" r="7" fill="#33ff66"/>
  <text x="150" y="71" class="chrome">guitaripod@midgar: ~/linux</text>

  <text x="80" y="150" class="prompt"><tspan class="green">$ </tspan>ls ~/linux --sort=releases</text>
  <text x="78" y="222" xml:space="preserve"><tspan class="title-accent">Linux</tspan><tspan class="title"> Apps &amp; Tools</tspan></text>

  ${rows}

  <text x="80" y="562" class="stats">${apps.length} apps · ${releaseCount} releases · ${esc(
    languages.join(' · ')
  )} · by guitaripod</text>
</svg>`;

try {
  const sharp = (await import('sharp')).default;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const outputPath = path.join(ROOT, 'public', 'og-linux.png');
  await fs.writeFile(outputPath, png);
  console.log(`✓ Linux OG image generated at: ${path.relative(ROOT, outputPath)} (${W}x${H})`);
} catch (error) {
  console.error('Error generating Linux OG image:', error);
  process.exit(1);
}
