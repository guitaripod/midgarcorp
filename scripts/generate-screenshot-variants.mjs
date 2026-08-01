#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const FACTS = path.join(ROOT, 'src', 'data', 'landing-facts.json');
const MANIFEST = path.join(ROOT, 'src', 'data', 'screenshot-variants.json');
const PUBLIC = path.join(ROOT, 'public');
const WIDTHS = [480, 960];
const ICON_WIDTHS = [72, 144, 216];

const only = new Set(process.argv.slice(2));

const counters = { made: 0, skipped: 0 };

/// Emits `<name>@<width>.webp` beside `publicSrc` for every requested width the
/// source is actually larger than, and returns the widths that now exist — the
/// srcset may only cite files that were written, or the browser 404s.
async function writeVariants(publicSrc, sourceWidth, widths, slug) {
  const src = path.join(PUBLIC, publicSrc.replace(/^\//, ''));
  if (!fs.existsSync(src)) return [];
  const made = [];
  for (const width of widths) {
    if (sourceWidth <= width) continue;
    const out = src.replace(/\.webp$/, `@${width}.webp`);
    if (fs.existsSync(out)) {
      counters.skipped++;
    } else if (!only.size || only.has(slug)) {
      await sharp(src).resize({ width }).webp({ quality: 82 }).toFile(out);
      counters.made++;
    } else {
      continue;
    }
    made.push(width);
  }
  return made;
}

/// Store screenshots are archived at capture resolution (1320–3840px wide) and
/// icons at 512px, but the page frames them into a few hundred — or, for icons,
/// 24–72 — CSS pixels; these variants are what the srcsets pick from.
async function main() {
  const facts = JSON.parse(fs.readFileSync(FACTS, 'utf8'));
  const manifest = {};

  for (const app of facts.apps) {
    for (const shots of Object.values(app.screenshots ?? {})) {
      for (const shot of shots) {
        if (!shot.src.endsWith('.webp')) continue;
        const widths = await writeVariants(shot.src, shot.w, WIDTHS, app.slug);
        if (widths.length) manifest[shot.src] = widths;
      }
    }
  }

  for (const app of facts.apps) {
    const icon = app.iconLocal;
    if (!icon || !icon.endsWith('.webp')) continue;
    const file = path.join(PUBLIC, icon.replace(/^\//, ''));
    if (!fs.existsSync(file)) continue;
    const { width } = await sharp(file).metadata();
    const widths = await writeVariants(icon, width ?? 0, ICON_WIDTHS, app.slug);
    if (widths.length) manifest[icon] = widths;
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `✓ screenshot variants: ${counters.made} written, ${counters.skipped} already present, ${Object.keys(manifest).length} in manifest`
  );
}

main().catch((err) => {
  console.error(`screenshot variants: ${err.message}`);
  process.exit(1);
});
