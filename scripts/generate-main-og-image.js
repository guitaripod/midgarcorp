import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readJSON = (rel) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'));
const apps = readJSON('src/data/apps.json').apps;
const projects = readJSON('src/data/opensource.json').projects;
const career = readJSON('src/data/career.json');
const statsLine = `${career.summary.yearsActive} yrs shipping · ${apps.length} apps live · ${projects.length} OSS projects`;

const width = 1200;
const height = 630;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

const BG = '#0d1117';
const PANEL = '#161b22';
const TITLEBAR = '#1c2128';
const BORDER = '#2d333b';
const TEXT = '#e6edf3';
const MUTED = '#9198a1';
const GREEN = '#33ff66';
const AMBER = '#ffb000';
const RED = '#ff7b72';
const MONO = 'Menlo, Monaco, "Courier New", monospace';

ctx.fillStyle = BG;
ctx.fillRect(0, 0, width, height);

for (let y = 0; y < height; y += 4) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(0, y, width, 1);
}

const termX = 80;
const termY = 90;
const termW = width - 160;
const termH = height - 180;

ctx.fillStyle = PANEL;
ctx.fillRect(termX, termY, termW, termH);
ctx.strokeStyle = BORDER;
ctx.lineWidth = 2;
ctx.strokeRect(termX, termY, termW, termH);

ctx.fillStyle = TITLEBAR;
ctx.fillRect(termX, termY, termW, 44);
ctx.strokeStyle = BORDER;
ctx.strokeRect(termX, termY, termW, 44);

[RED, AMBER, GREEN].forEach((color, i) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(termX + 26 + i * 26, termY + 22, 7, 0, Math.PI * 2);
  ctx.fill();
});

ctx.fillStyle = MUTED;
ctx.font = `16px ${MONO}`;
ctx.textAlign = 'center';
ctx.fillText('marcus@midgar: ~', termX + termW / 2, termY + 28);
ctx.textAlign = 'left';

let lineY = termY + 100;
const lineX = termX + 40;

ctx.font = `24px ${MONO}`;
ctx.fillStyle = GREEN;
ctx.fillText('$', lineX, lineY);
ctx.fillStyle = MUTED;
ctx.fillText('whoami', lineX + 34, lineY);

lineY += 82;
ctx.font = `bold 66px ${MONO}`;
ctx.fillStyle = TEXT;
ctx.fillText('Engineer who', lineX, lineY);

lineY += 80;
ctx.shadowColor = GREEN;
ctx.shadowBlur = 24;
ctx.fillStyle = GREEN;
ctx.fillText('ships.', lineX, lineY);
ctx.shadowBlur = 0;
const shipsWidth = ctx.measureText('ships.').width;
ctx.fillRect(lineX + shipsWidth + 18, lineY - 52, 28, 60);

lineY += 66;
ctx.font = `22px ${MONO}`;
ctx.fillStyle = MUTED;
ctx.fillText('Marcus Ziadé — iOS · backend · AI · open source', lineX, lineY);

lineY += 42;
ctx.fillStyle = AMBER;
ctx.fillText(statsLine, lineX, lineY);

ctx.font = `18px ${MONO}`;
ctx.fillStyle = MUTED;
ctx.fillText('midgarcorp.cc', termX + 40, termY + termH - 26);
ctx.fillStyle = GREEN;
ctx.textAlign = 'right';
ctx.fillText('exit 0', termX + termW - 40, termY + termH - 26);
ctx.textAlign = 'left';

const buffer = canvas.toBuffer('image/png');
const outputPath = path.join(__dirname, '..', 'public', 'og-image.png');
fs.writeFileSync(outputPath, buffer);
console.log('✓ Generated og-image.png');
