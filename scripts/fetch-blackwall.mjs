#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BOARD_URL, isUsable, summarize } from '../src/lib/blackwall.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'src', 'data', 'blackwall.json');

async function main() {
  const response = await fetch(BOARD_URL, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${BOARD_URL} answered ${response.status}`);
  const board = await response.json();
  const snapshot = summarize(board, 'max');
  if (!isUsable(snapshot)) throw new Error('the published board has no usable ranking');
  await fs.writeFile(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `✓ Blackwall board: ${snapshot.models.length} models, leader ${snapshot.models[0].name} (${snapshot.models[0].index})`
  );
}

main().catch((error) => {
  console.warn(`Blackwall board not refreshed, keeping the committed snapshot: ${error.message}`);
});
