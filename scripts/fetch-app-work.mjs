#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OWNER = 'guitaripod';
const OUT = path.join(process.cwd(), 'src', 'data', 'app-work.json');

/// Landing slug -> GitHub repo, for every App Store app whose source is on GitHub. Apps whose
/// repo is missing here simply show no commit count.
const APP_REPOS = {
  dreameater: 'DreamEater',
  psywave: 'psywave',
  doublekick: 'doublekick',
  pixiepocket: 'pixie',
  appofthedead: 'appofthedead',
  masterofflags: 'master-of-flags',
  masterofinventory: 'inventory',
  solarbeam: 'solarbeam',
  psybeam: 'psybeam',
  payday: 'PayDay',
  helia: 'Helia',
  embr: 'embr',
  crucible: 'Crucible',
  flaccy: 'flaccy',
  tailscode: 'Tailscode',
  livingdex: 'livingdex',
};

/// CI exports GITHUB_TOKEN; a local run borrows the gh CLI's login.
function resolveToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execSync('gh auth token', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const fields = `pushedAt
  releases(first: 1, orderBy: {field: CREATED_AT, direction: DESC}) { totalCount nodes { publishedAt } }
  defaultBranchRef { target { ... on Commit { history { totalCount } } } }`;

function buildQuery() {
  const aliases = Object.entries(APP_REPOS)
    .map(([slug, repo]) => `${slug}: repository(owner: "${OWNER}", name: "${repo}") { ${fields} }`)
    .join('\n');
  return `query { ${aliases} }`;
}

/// The committed snapshot, so a repo this token cannot see (CI's GITHUB_TOKEN reads public repos
/// only) keeps its last-known counts instead of dropping out of the ranking.
function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  const token = resolveToken();
  if (!token) {
    console.log('⚠️  No GITHUB_TOKEN and no gh login — keeping existing app-work.json.');
    return;
  }
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: buildQuery() }),
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const { data, errors } = await res.json();
  if (!data) throw new Error(errors?.[0]?.message ?? 'no data');

  const previous = readPrevious();
  const work = {};
  const kept = [];
  for (const [slug, repo] of Object.entries(APP_REPOS)) {
    const node = data[slug];
    if (!node) {
      if (previous[slug]) {
        work[slug] = previous[slug];
        kept.push(slug);
      }
      continue;
    }
    work[slug] = {
      repo,
      commitCount: node.defaultBranchRef?.target?.history?.totalCount ?? 0,
      releaseCount: node.releases.totalCount,
      latestReleaseDate: node.releases.nodes[0]?.publishedAt ?? null,
      pushedAt: node.pushedAt,
    };
  }
  fs.writeFileSync(OUT, JSON.stringify(work, null, 2) + '\n');
  const total = Object.values(work).reduce((sum, entry) => sum + entry.commitCount, 0);
  console.log(`✓ app-work.json: ${Object.keys(work).length} apps, ${total} commits`);
  if (kept.length) console.log(`  kept last-known counts for ${kept.join(', ')} (repo not visible)`);
}

main().catch((err) => {
  console.log(`⚠️  App work fetch failed (${err.message}) — keeping existing data.`);
});
