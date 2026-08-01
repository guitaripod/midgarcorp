#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'src', 'data', 'webb-live.json');
const SCHEDULE_PAGE = 'https://www.stsci.edu/jwst/science-execution/observing-schedules';
const STATUS_API = 'https://nasa-api-worker.guitaripod.workers.dev/api/jwst/status';
const TIMEOUT_MS = 25000;

async function get(url, as = 'text') {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'user-agent': 'midgarcorp.cc build (https://midgarcorp.cc)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return as === 'json' ? res.json() : res.text();
}

/// STScI publishes one plain-text report per week at a dated path; the newest is
/// the first `_documents/*_report_*.txt` link on the observing-schedules page.
function newestReportUrl(html) {
  const hrefs = [...html.matchAll(/href="([^"]*_documents\/[^"]*report[^"]*\.txt)"/g)].map(
    (m) => m[1]
  );
  if (!hrefs.length) throw new Error('no schedule report link found');
  const best = hrefs
    .map((h) => ({ h, stamp: (h.match(/(\d{8})_report/) || [])[1] || '' }))
    .sort((a, b) => b.stamp.localeCompare(a.stamp))[0];
  return new URL(best.h, 'https://www.stsci.edu').toString();
}

/// The report is fixed-width; the dashed rule under the header gives exact column
/// spans, so slice by those rather than guessing at whitespace runs.
function columnSpans(ruleLine) {
  const spans = [];
  const re = /-+/g;
  let m;
  while ((m = re.exec(ruleLine)) !== null) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

function durationSeconds(text) {
  const m = /^(\d+)\/(\d{2}):(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  return +m[1] * 86400 + +m[2] * 3600 + +m[3] * 60 + +m[4];
}

function titleCase(text) {
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\bWfsc\b/g, 'WFSC');
}

function parseSchedule(txt) {
  const lines = txt.split(/\r?\n/);
  const ruleIndex = lines.findIndex((l) => /^-{5,}\s+-{5,}/.test(l));
  if (ruleIndex < 0) throw new Error('no column rule in report');
  const spans = columnSpans(lines[ruleIndex]);
  if (spans.length < 8) throw new Error(`unexpected column count ${spans.length}`);
  const cell = (line, i) => (line.slice(spans[i][0], spans[i][1]) || '').trim();

  const observations = [];
  for (const line of lines.slice(ruleIndex + 1)) {
    if (!line.trim()) continue;
    const visit = cell(line, 0);
    const start = cell(line, 3);
    if (!visit || !/^\d{4}-\d{2}-\d{2}T/.test(start)) continue;
    const seconds = durationSeconds(cell(line, 4));
    const target = cell(line, 6);
    const instrument = cell(line, 5);
    if (!seconds || !target || !instrument) continue;
    observations.push({
      visit,
      start: new Date(start).toISOString(),
      seconds,
      instrument,
      target,
      category: titleCase(cell(line, 7) || 'Observation'),
      keywords: cell(line, 8),
    });
  }
  observations.sort((a, b) => a.start.localeCompare(b.start));
  return observations;
}

async function main() {
  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const next = previous ? { ...previous } : {};

  try {
    const reportUrl = newestReportUrl(await get(SCHEDULE_PAGE));
    const observations = parseSchedule(await get(reportUrl));
    if (!observations.length) throw new Error('report parsed to zero observations');
    next.schedule = {
      reportUrl,
      sourceUrl: SCHEDULE_PAGE,
      coversFrom: observations[0].start,
      coversTo: new Date(
        Date.parse(observations.at(-1).start) + observations.at(-1).seconds * 1000
      ).toISOString(),
      observations,
    };
    console.log(`✓ webb schedule: ${observations.length} observations from ${reportUrl}`);
  } catch (err) {
    console.log(`! webb schedule fetch failed (${err.message}) — keeping committed schedule`);
  }

  try {
    const s = await get(STATUS_API, 'json');
    next.status = {
      launchIso: s.launch_iso,
      orbit: s.orbit,
      phase: s.phase,
      distanceKm: s.distance_km_approx,
      mirrorDiameterM: s.mirror_diameter_m,
      mirrorSegments: s.mirror_segments,
      warmSideC: Array.isArray(s.warm_side_c) ? Math.max(...s.warm_side_c) : null,
      coolSideC: Array.isArray(s.cool_side_c) ? Math.min(...s.cool_side_c) : null,
      deployIndex: s.deploy_index,
      source: s.source,
    };
    console.log('✓ webb mission status');
  } catch (err) {
    console.log(`! webb status fetch failed (${err.message}) — keeping committed status`);
  }

  if (!next.schedule && !next.status) {
    console.log('! nothing to write and no committed data — leaving webb-live.json alone');
    return;
  }
  next.fetchedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log(`✓ ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(`webb-live: ${err.message}`);
  process.exit(0);
});
