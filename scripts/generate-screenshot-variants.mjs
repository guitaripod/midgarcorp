#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const FACTS = path.join(ROOT, 'src', 'data', 'landing-facts.json');
const MANIFEST = path.join(ROOT, 'src', 'data', 'screenshot-variants.json');
const PUBLIC = path.join(ROOT, 'public');
const WIDTHS = [480, 960];

const only = new Set(process.argv.slice(2));

/// Store screenshots are archived at capture resolution (1320–3840px wide) but
/// the page frames them into a few hundred CSS pixels; these variants are what
/// the srcset in DeviceFrame picks from.
async function main() {
  const facts = JSON.parse(fs.readFileSync(FACTS, 'utf8'));
  const manifest = {};
  let made = 0;
  let skipped = 0;

  for (const app of facts.apps) {
    for (const shots of Object.values(app.screenshots ?? {})) {
      for (const shot of shots) {
        if (!shot.src.endsWith('.webp')) continue;
        const src = path.join(PUBLIC, shot.src.replace(/^\//, ''));
        if (!fs.existsSync(src)) continue;
        const widths = [];
        for (const width of WIDTHS) {
          if (shot.w <= width) continue;
          const out = src.replace(/\.webp$/, `@${width}.webp`);
          if (fs.existsSync(out)) {
            skipped++;
          } else if (!only.size || only.has(app.slug)) {
            await sharp(src).resize({ width }).webp({ quality: 82 }).toFile(out);
            made++;
          } else {
            continue;
          }
          widths.push(width);
        }
        if (widths.length) manifest[shot.src] = widths;
      }
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `✓ screenshot variants: ${made} written, ${skipped} already present, ${Object.keys(manifest).length} in manifest`
  );
}

main().catch((err) => {
  console.error(`screenshot variants: ${err.message}`);
  process.exit(1);
});
