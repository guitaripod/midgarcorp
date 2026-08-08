#!/usr/bin/env node

import https from 'https';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appsDataPath = path.join(__dirname, '..', 'src', 'data', 'apps.json');
const appsData = JSON.parse(await fs.readFile(appsDataPath, 'utf-8'));
const factsPath = path.join(__dirname, '..', 'src', 'data', 'landing-facts.json');
const facts = JSON.parse(await fs.readFile(factsPath, 'utf-8'));

const localIconByTrack = new Map(
  facts.apps.filter((a) => a.iconLocal).map((a) => [String(a.trackId), a.iconLocal])
);

const trackIdFor = (appStoreUrl) => appStoreUrl.match(/id(\d+)/)?.[1] ?? '';

/// The self-hosted icon is the same artwork with the corner-mask repair applied
/// (scripts/unmask_icon.py), so prefer it and only reach for the store artwork
/// when an app has no landing assets yet.
async function readIcon(app) {
  const local = localIconByTrack.get(trackIdFor(app.appStoreUrl));
  if (local) {
    return fs.readFile(path.join(__dirname, '..', 'public', local.replace(/^\//, '')));
  }
  return downloadImage(app.icon);
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
  });
}

async function generateOGGrid(sharp) {
  console.log('Generating OG image grid from app icons...');

  const ogWidth = 1200;
  const ogHeight = 630;

  const apps = appsData.apps;
  const rows = apps.length > 5 ? 2 : 1;
  const cols = Math.ceil(apps.length / rows);
  const padding = 28;
  const maxGridWidth = ogWidth - 120;
  const iconSize = Math.min(150, Math.floor((maxGridWidth - (cols - 1) * padding) / cols));

  const icons = await Promise.all(
    apps.map(async (app) => {
      const iconBuffer = await readIcon(app);
      return sharp(iconBuffer)
        .resize(iconSize, iconSize, { fit: 'cover' })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${iconSize}" height="${iconSize}">
                <rect width="${iconSize}" height="${iconSize}" rx="24" fill="none" stroke="#2d333b" stroke-width="2"/>
              </svg>`
            ),
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();
    })
  );

  const background = await sharp({
    create: {
      width: ogWidth,
      height: ogHeight,
      channels: 4,
      background: { r: 13, g: 17, b: 23, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const totalGridWidth = cols * iconSize + (cols - 1) * padding;
  const totalGridHeight = rows * iconSize + (rows - 1) * padding;
  const startX = Math.floor((ogWidth - totalGridWidth) / 2);
  const titleBlockHeight = 150;
  const bottomBlockHeight = 90;
  const startY =
    titleBlockHeight +
    Math.floor((ogHeight - titleBlockHeight - bottomBlockHeight - totalGridHeight) / 2);

  const composites = [];

  for (let i = 0; i < icons.length; i++) {
    const lastRowCount = apps.length - cols * (rows - 1);
    const row = Math.floor(i / cols);
    const indexInRow = i % cols;
    const rowCount = row === rows - 1 ? lastRowCount : cols;
    const rowWidth = rowCount * iconSize + (rowCount - 1) * padding;
    const rowStartX = Math.floor((ogWidth - rowWidth) / 2);
    composites.push({
      input: icons[i],
      left: rowStartX + indexInRow * (iconSize + padding),
      top: startY + row * (iconSize + padding),
    });
  }

  const mono = "Menlo, Monaco, 'Courier New', monospace";
  const titleText = Buffer.from(
    `<svg width="${ogWidth}" height="${titleBlockHeight}">
      <style>
        .prompt { fill: #9198a1; font-size: 22px; font-family: ${mono}; }
        .dollar { fill: #33ff66; font-size: 22px; font-family: ${mono}; }
        .title { fill: #e6edf3; font-size: 46px; font-weight: bold; font-family: ${mono}; }
      </style>
      <text x="${ogWidth / 2}" y="52" text-anchor="middle"><tspan class="dollar">$ </tspan><tspan class="prompt">ls ~/apps</tspan></text>
      <text x="${ogWidth / 2}" y="108" text-anchor="middle" class="title">Apple Platform Apps</text>
    </svg>`
  );

  composites.push({ input: titleText, top: 0, left: 0 });

  const bottomText = Buffer.from(
    `<svg width="${ogWidth}" height="${bottomBlockHeight}">
      <style>
        .stats { fill: #ffb000; font-size: 22px; font-family: ${mono}; }
      </style>
      <text x="${ogWidth / 2}" y="50" text-anchor="middle" class="stats">${apps.length} apps · iPhone · iPad · Mac · Apple TV · by guitaripod</text>
    </svg>`
  );

  composites.push({ input: bottomText, top: ogHeight - bottomBlockHeight, left: 0 });

  const result = await sharp(background).composite(composites).png().toBuffer();

  const outputPath = path.join(__dirname, '..', 'public', 'og-apps-grid.png');
  await fs.writeFile(outputPath, result);

  console.log(`✓ OG grid image generated successfully at: ${outputPath}`);
  console.log(`  Dimensions: ${ogWidth}x${ogHeight}px, apps included: ${icons.length}`);
}

try {
  const sharp = (await import('sharp')).default;
  await generateOGGrid(sharp);
} catch (error) {
  console.error('Error generating OG grid:', error);
  process.exit(1);
}
