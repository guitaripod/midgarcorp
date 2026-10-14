#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const mono = "ui-monospace, 'DejaVu Sans Mono', Menlo, Monaco, 'Courier New', monospace";
const W = 1200;
const H = 630;
const GREEN = '#33ff66';
const AMBER = '#ffb000';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (n) => Number(n).toLocaleString('en-US');
const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const readJson = async (file) => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf-8'));

/// The same weighting as `workScore` in src/lib/work.ts without the recency bonus.
const workScore = (project) =>
  2 * Math.log(1 + (project.commitCount ?? 0)) +
  2.5 * Math.log(1 + (project.releaseCount ?? 0)) +
  0.4 * Math.log(1 + (project.stars ?? 0));

/// One row with a commit bar sized like the site's weight bars.
function weightRow(project, y, maxCommits) {
  const fill = Math.max(0.04, Math.sqrt((project.commitCount ?? 0) / maxCommits));
  return `<text x="80" y="${y}" class="name">${esc(clip(project.name, 20))}</text>
  <rect x="330" y="${y - 9}" width="220" height="6" rx="3" fill="#21262d"/>
  <rect x="330" y="${y - 9}" width="${Math.round(220 * fill)}" height="6" rx="3" fill="${GREEN}"/>
  <text x="566" y="${y}" class="count">${num(project.commitCount ?? 0)}</text>`;
}

/// A line of the list: a green marker, then the text.
const bulletRow = (text, y) =>
  `<text x="80" y="${y}" xml:space="preserve"><tspan class="green">&gt; </tspan><tspan class="row">${esc(text)}</tspan></text>`;

/// A dated line of the list: the date dimmed, then the text.
const datedRow = (date, text, y) =>
  `<text x="80" y="${y}" xml:space="preserve"><tspan class="dim">${esc(date)}  </tspan><tspan class="row">${esc(text)}</tspan></text>`;

/// The shared terminal card every tab's share image uses: window chrome, a prompt, a two-tone
/// title, a body, and a footer line with the page URL on the right.
function card({ prompt, cwd, accent, title, body, footer, url }) {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="82%" cy="40%" r="48%">
      <stop offset="0" stop-color="${GREEN}" stop-opacity="0.09"/>
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
    .row { fill: #c9d1d9; font-size: 24px; }
    .dim { fill: #7d8590; font-size: 22px; }
    .name { fill: #e6edf3; font-size: 22px; }
    .count { fill: #9198a1; font-size: 20px; }
    .footer { fill: ${AMBER}; font-size: 22px; }
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
  <text x="150" y="71" class="chrome">guitaripod@midgar: ${esc(cwd)}</text>

  <text x="80" y="150" class="prompt" xml:space="preserve"><tspan class="green">$ </tspan>${esc(prompt)}</text>
  <text x="78" y="224" class="title-accent">${esc(accent)}</text>
  <text x="78" y="294" class="title">${esc(title)}</text>

  ${body}

  <text x="80" y="562" class="footer">${esc(footer)}</text>
  <text x="1120" y="562" class="url" text-anchor="end">${esc(url)}</text>
</svg>`;
}

/// Titles and dates of the newest published posts, read from the MDX frontmatter.
async function latestPosts(limit) {
  const dir = path.join(ROOT, 'src/content/blog');
  const files = (await fs.readdir(dir)).filter((name) => /\.mdx?$/.test(name));
  const posts = [];
  for (const file of files) {
    const text = await fs.readFile(path.join(dir, file), 'utf-8');
    const front = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    if (/^draft:\s*true/m.test(front)) continue;
    const title = front.match(/^title:\s*['"]?(.*?)['"]?\s*$/m)?.[1];
    const date = front.match(/^pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
    if (title && date) posts.push({ title: title.replace(/\\'/g, "'"), date });
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));
  return { posts: posts.slice(0, limit), total: posts.length };
}

async function buildCards() {
  const oss = (await readJson('src/data/opensource.json')).projects;
  const apps = (await readJson('src/data/apps.json')).apps;
  const ranked = [...oss].sort((a, b) => workScore(b) - workScore(a));
  const maxCommits = Math.max(1, ...oss.map((p) => p.commitCount ?? 0));
  const commits = oss.reduce((sum, p) => sum + (p.commitCount ?? 0), 0);
  const releases = oss.reduce((sum, p) => sum + (p.releaseCount ?? 0), 0);
  const blog = await latestPosts(4);

  return {
    opensource: card({
      prompt: 'gh repo list guitaripod --limit 100',
      cwd: '~/oss',
      accent: 'Open',
      title: 'Source',
      body: ranked
        .slice(0, 4)
        .sort((a, b) => (b.commitCount ?? 0) - (a.commitCount ?? 0))
        .map((project, i) => weightRow(project, 372 + i * 40, maxCommits))
        .join('\n  '),
      footer: `${oss.length} repos · ${num(commits)} commits · ${releases} releases`,
      url: 'midgarcorp.cc/opensource',
    }),
    services: card({
      prompt: 'man guitaripod',
      cwd: '~/services',
      accent: 'Engineering',
      title: 'Services',
      body: [
        'Native iOS & SDK',
        'AI integration',
        'Backend & infrastructure',
        'System design & code review',
      ]
        .map((line, i) => bulletRow(line, 372 + i * 40))
        .join('\n  '),
      footer: 'Seven years shipping · available for new engagements',
      url: 'midgarcorp.cc/services',
    }),
    links: card({
      prompt: 'cat ~/.profile',
      cwd: '~',
      accent: 'Links',
      title: 'guitaripod',
      body: [
        'github.com/guitaripod',
        'youtube.com/@guitaripod',
        'x.com/guitaripod',
        'twitch.tv/guitaripod',
      ]
        .map((line, i) => bulletRow(line, 372 + i * 40))
        .join('\n  '),
      footer: `${apps.length} apps · ${oss.length} repos · one handle everywhere`,
      url: 'midgarcorp.cc/links',
    }),
    archive: card({
      prompt: 'ls ~/blog --sort=date',
      cwd: '~/blog',
      accent: 'Blog',
      title: 'Archive',
      body: blog.posts
        .map((post, i) => datedRow(post.date, clip(post.title, 56), 372 + i * 40))
        .join('\n  '),
      footer: `${blog.total} posts on Swift, Rust, Cloudflare and AI`,
      url: 'midgarcorp.cc/archive',
    }),
  };
}

try {
  const sharp = (await import('sharp')).default;
  const outDir = path.join(ROOT, 'public', 'og');
  await fs.mkdir(outDir, { recursive: true });
  for (const [name, svg] of Object.entries(await buildCards())) {
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    await fs.writeFile(path.join(outDir, `${name}.png`), png);
    console.log(`✓ ${name} OG image generated at: public/og/${name}.png (${W}x${H})`);
  }
} catch (error) {
  console.error('Error generating page OG images:', error);
  process.exit(1);
}
