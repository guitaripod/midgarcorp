#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STATS_URL, isSample, isUsable } from '../src/lib/open-stats.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'src', 'data', 'open-stats.json');

/**
 * Writes the published stats to `out` and returns them. Throws, leaving `out` untouched, when the
 * answer is not a success, not the expected shape, or still marked as a sample.
 */
export async function refresh(url = STATS_URL, out = OUT) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  const stats = await response.json();
  if (!isUsable(stats)) throw new Error('the published stats do not have the expected shape');
  if (isSample(stats)) throw new Error('the published stats are marked as a sample');
  await fs.writeFile(out, `${JSON.stringify(stats, null, 2)}\n`);
  return stats;
}

async function main() {
  const stats = await refresh();
  console.log(
    `✓ Open stats: ${Object.keys(stats.apps).length} apps, generated ${stats.generated_at}`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.warn(`Open stats not refreshed, keeping the committed snapshot: ${error.message}`);
  });
}
