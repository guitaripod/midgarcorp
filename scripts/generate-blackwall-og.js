#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isUsable, verdict, wallLayout } from '../src/lib/blackwall.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const mono = "ui-monospace, 'DejaVu Sans Mono', Menlo, Monaco, 'Courier New', monospace";
const W = 1200;
const H = 630;
const GREEN = '#76b900';
const INK = '#a3e635';
const CYAN = '#19d3ff';
const RED = '#ff2d55';

const WORDMARK = {
  width: 8153,
  height: 686,
  path: 'M74 686V-2H668Q725 -2 771.5 19.5Q818 41 845.5 79Q873 117 873 167Q873 217 856 249Q839 281 810.5 299.5Q782 318 748 327V331Q787 339 819 358.5Q851 378 870 413Q889 448 889 503Q889 558 860.5 599Q832 640 783 663Q734 686 674 686ZM321 526H575Q602 526 619 510Q636 494 636 462Q636 447 628.5 434.5Q621 422 607 415Q593 408 575 408H321ZM321 266H559Q578 266 591.5 258.5Q605 251 612.5 237Q620 223 620 202Q620 180 602 164.5Q584 149 559 149H321ZM979 686V-2H1226V497H1672V686ZM1674 686 2007 -2H2279L2612 686H2347L2306 595H1969L1929 686ZM2044 424H2231L2183 308Q2180 300 2175 286.5Q2170 273 2164 256Q2158 239 2152.5 222Q2147 205 2142 191H2135Q2129 208 2121 230Q2113 252 2105.5 273Q2098 294 2092 308ZM3082 698Q2933 698 2835 657.5Q2737 617 2688.5 538Q2640 459 2640 342Q2640 171 2753 78.5Q2866 -14 3084 -14Q3204 -14 3295 23.5Q3386 61 3437.5 127.5Q3489 194 3489 281H3249Q3249 245 3228 217Q3207 189 3169 173Q3131 157 3080 157Q3016 157 2974.5 180Q2933 203 2913.5 242Q2894 281 2894 329V354Q2894 400 2913.5 439.5Q2933 479 2973 503Q3013 527 3075 527Q3132 527 3172.5 512Q3213 497 3234.5 470Q3256 443 3256 407H3489Q3489 491 3440.5 557Q3392 623 3301 660.5Q3210 698 3082 698ZM3583 686V-2H3830V302L4163 -2H4469L4165 279L4477 686H4176L3983 427L3830 551V686ZM4679 686 4477 -2H4729L4811 303Q4818 327 4823 350Q4828 373 4832 391.5Q4836 410 4838 421H4845Q4847 410 4850 395Q4853 380 4856 364Q4859 348 4863 332Q4867 316 4870 303L4948 -2H5249L5326 303Q5331 321 5335.5 342.5Q5340 364 5344 385Q5348 406 5351 421H5358Q5360 409 5363.5 394Q5367 379 5370.5 363Q5374 347 5378 331.5Q5382 316 5385 303L5468 -2H5697L5495 686H5211L5112 299Q5108 282 5103.5 265Q5099 248 5096 234Q5093 220 5091 212H5084Q5081 224 5077 240Q5073 256 5069.5 271.5Q5066 287 5063 299L4963 686ZM5685 686 6018 -2H6290L6623 686H6358L6317 595H5980L5940 686ZM6055 424H6242L6194 308Q6191 300 6186 286.5Q6181 273 6175 256Q6169 239 6163.5 222Q6158 205 6153 191H6146Q6140 208 6132 230Q6124 252 6116.5 273Q6109 294 6103 308ZM6680 686V-2H6927V497H7373V686ZM7441 686V-2H7688V497H8134V686Z',
};
const MARK = { x: 80, y: 158, w: 1040 };
const MARK_H = (WORDMARK.height / WORDMARK.width) * MARK.w;
const CHART = { x: 664, y: 292, w: 456, h: 250 };

const xml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Drops trailing words until a label fits in `limit` characters. */
function fit(name, limit = 18) {
  const words = name.split(' ');
  while (words.length > 1 && words.join(' ').length > limit) words.pop();
  return words.join(' ');
}

/** The wordmark as the page draws it: a cyan and a red slice slipping sideways, and a gap for the scan line. */
function wordmark() {
  const scale = MARK.w / WORDMARK.width;
  const place = (dx = 0) => `translate(${MARK.x + dx} ${MARK.y}) scale(${scale})`;
  const band = (from, to) =>
    `<clipPath id="${from}"><rect x="0" y="${MARK.y + MARK_H * from}" width="${W}" height="${MARK_H * (to - from)}"/></clipPath>`;
  const gapTop = MARK.y + MARK_H * 0.48;
  const gapBottom = MARK.y + MARK_H * 0.545;
  const scan = (gapTop + gapBottom) / 2;
  return `
  <defs>
    ${band(0.18, 0.34)}
    ${band(0.7, 0.86)}
    <mask id="gap"><rect width="${W}" height="${H}" fill="#fff"/><rect x="0" y="${gapTop}" width="${W}" height="${gapBottom - gapTop}" fill="#000"/></mask>
    <filter id="glow" x="-5%" y="-400%" width="110%" height="900%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g clip-path="url(#0.18)"><path d="${WORDMARK.path}" transform="${place(-8)}" fill="${CYAN}"/></g>
  <g clip-path="url(#0.7)"><path d="${WORDMARK.path}" transform="${place(9)}" fill="${RED}"/></g>
  <g mask="url(#gap)"><path d="${WORDMARK.path}" transform="${place()}" fill="#f4f7f2"/></g>
  <rect x="41" y="${scan - 5}" width="${W - 82}" height="10" fill="${GREEN}" opacity="0.55" filter="url(#glow)"/>
  <rect x="41" y="${scan - 1.25}" width="${W - 82}" height="2.5" fill="${GREEN}"/>`;
}

/** The wall, drawn from the live board: the green staircase, the dots, and the models on it. */
function chart(models) {
  const wall = wallLayout(models, {
    width: CHART.w,
    height: CHART.h,
    pad: { l: 30, r: 12, t: 12, b: 26 },
  });
  if (!wall) return '';
  const grid = [
    ...wall.yTicks.map(
      (t) =>
        `<line x1="${wall.pad.l}" x2="${wall.width - wall.pad.r}" y1="${t.y}" y2="${t.y}" class="grid"/><text x="${wall.pad.l - 6}" y="${t.y + 4}" text-anchor="end" class="tick">${t.value}</text>`
    ),
    ...wall.xTicks.map(
      (t) =>
        `<line x1="${t.x}" x2="${t.x}" y1="${wall.pad.t}" y2="${wall.height - wall.pad.b}" class="grid"/><text x="${t.x}" y="${wall.height - wall.pad.b + 17}" text-anchor="middle" class="tick">${t.value}</text>`
    ),
  ].join('');
  const dots = wall.dots
    .map(
      (d) =>
        `<line x1="${d.x}" x2="${d.x}" y1="${d.y1}" y2="${d.y2}" class="whisker"/><circle cx="${d.x}" cy="${d.y}" r="${d.leader ? 7.5 : 6}" class="${d.wall ? 'dot-wall' : 'dot'}"/>`
    )
    .join('');
  const labels = wall.dots
    .filter((d) => d.wall)
    .map((d) => {
      const label = fit(d.name);
      const width = label.length * 8;
      const flip = d.x + 12 + width > wall.width - 2;
      return `<text x="${flip ? d.x - 12 : d.x + 12}" y="${d.y - 11}" text-anchor="${flip ? 'end' : 'start'}" class="label">${xml(label)}</text>`;
    })
    .join('');
  return `
  <g transform="translate(${CHART.x} ${CHART.y})">
    ${grid}
    <path d="${wall.area}" fill="${GREEN}" opacity="0.14"/>
    <path d="${wall.path}" fill="none" stroke="${GREEN}" stroke-width="7" opacity="0.28" filter="url(#glow)"/>
    <path d="${wall.path}" fill="none" stroke="${GREEN}" stroke-width="3" stroke-linejoin="round"/>
    ${dots}
    ${labels}
    <text x="${wall.width - wall.pad.r}" y="${wall.pad.t + 14}" text-anchor="end" class="better">better ↗</text>
  </g>
  <text x="${CHART.x}" y="${CHART.y - 12}" class="axis">quality ↑   decode speed (tok/s) →</text>`;
}

function verdictBlock(models) {
  const call = verdict(models);
  if (!call) return '';
  return `
  <text x="78" y="520" class="big">${call.index.toFixed(1)}</text>
  <text x="${80 + String(call.index.toFixed(1)).length * 46 + 24}" y="486" class="lead">${xml(fit(call.leader, 20))}</text>
  <text x="${80 + String(call.index.toFixed(1)).length * 46 + 24}" y="518" class="sub">${call.tied ? 'leads, within the margin' : 'leads the board'}</text>`;
}

function render(snapshot) {
  const ready = isUsable(snapshot);
  const models = ready ? snapshot.models : [];
  const card = snapshot?.hardware?.gpu ?? 'RTX PRO 6000 Blackwell';
  const memory = snapshot?.hardware?.vramGb ?? 96;
  const stats = ready
    ? `${models.length} models · ${card} · ${memory} GB · GPL-3.0`
    : `${card} · ${memory} GB · GPL-3.0`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    text { font-family: ${mono}; }
    .chrome { fill: #9198a1; font-size: 20px; }
    .prompt { fill: #9198a1; font-size: 22px; }
    .tag { fill: #e6edf3; font-size: 28px; font-weight: bold; }
    .copy { fill: #9198a1; font-size: 22px; }
    .big { fill: ${INK}; font-size: 84px; font-weight: bold; }
    .lead { fill: #e6edf3; font-size: 30px; font-weight: bold; }
    .sub { fill: #9198a1; font-size: 22px; }
    .stats { fill: #ffb000; font-size: 20px; }
    .url { fill: #9198a1; font-size: 20px; }
    .grid { stroke: #e6edf3; stroke-opacity: 0.09; stroke-width: 1; }
    .tick { fill: #9198a1; font-size: 12px; }
    .axis { fill: #9198a1; font-size: 13px; }
    .better { fill: ${INK}; font-size: 13px; }
    .whisker { stroke: #e6edf3; stroke-opacity: 0.5; stroke-width: 1.5; }
    .dot { fill: #0d1117; stroke: #9198a1; stroke-width: 2; }
    .dot-wall { fill: ${GREEN}; stroke: ${INK}; stroke-width: 2; }
    .label { fill: #e6edf3; font-size: 13px; font-weight: bold; }
  </style>
  <rect width="${W}" height="${H}" fill="#0d1117"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="10" fill="#0d1117" stroke="#2d333b" stroke-width="2"/>
  <rect x="40" y="40" width="${W - 80}" height="48" rx="10" fill="#161b22"/>
  <rect x="40" y="72" width="${W - 80}" height="16" fill="#161b22"/>
  <circle cx="70" cy="64" r="7" fill="#ff7b72"/>
  <circle cx="94" cy="64" r="7" fill="#ffb000"/>
  <circle cx="118" cy="64" r="7" fill="#33ff66"/>
  <text x="150" y="71" class="chrome">guitaripod@midgar: ~/blackwall</text>

  <text x="80" y="136" class="prompt" xml:space="preserve"><tspan fill="${INK}">$ </tspan>blackwall run gpt-oss-120b</text>
  ${wordmark()}

  <text x="80" y="300" class="tag">open models, ranked on one card</text>
  <text x="80" y="342" class="copy">speed and answer quality, measured</text>
  <text x="80" y="372" class="copy">the same way every time.</text>
  ${verdictBlock(models)}
  ${chart(models)}

  <text x="80" y="572" class="stats">${xml(stats)}</text>
  <text x="${W - 80}" y="572" text-anchor="end" class="url">midgarcorp.cc/blackwall</text>
</svg>`;
}

try {
  const snapshot = JSON.parse(
    await fs.readFile(path.join(ROOT, 'src', 'data', 'blackwall.json'), 'utf8')
  );
  const sharp = (await import('sharp')).default;
  const png = await sharp(Buffer.from(render(snapshot)))
    .png()
    .toBuffer();
  const outDir = path.join(ROOT, 'public', 'og');
  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, 'blackwall.png');
  await fs.writeFile(outputPath, png);
  console.log(`✓ Blackwall OG image generated at: ${path.relative(ROOT, outputPath)} (${W}x${H})`);
} catch (error) {
  console.error('Error generating Blackwall OG image:', error);
  process.exit(1);
}
