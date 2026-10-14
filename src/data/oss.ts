import { workScore } from '../lib/work';
import openSourceData from './opensource.json';

export type OssProject = (typeof openSourceData.projects)[number];

export const OSS_NOW = new Date();

export function ossScore(project: OssProject, now: Date = OSS_NOW): number {
  return workScore(
    {
      commitCount: project.commitCount,
      releaseCount: project.releaseCount,
      stars: project.stars,
      latestDate: project.updatedAt,
    },
    now
  );
}

export const ossProjects: OssProject[] = [...openSourceData.projects].sort(
  (a, b) => ossScore(b) - ossScore(a) || a.name.localeCompare(b.name)
);

export const ossMax = {
  commits: Math.max(1, ...ossProjects.map((project) => project.commitCount ?? 0)),
  releases: Math.max(1, ...ossProjects.map((project) => project.releaseCount ?? 0)),
};

export const OSS_FEATURED_SCORE = 9;
export const OSS_LEADERS = 3;

export interface OssSection {
  category: string;
  title: string;
  command: string;
  blurb: string;
  featured: OssProject[];
  compact: OssProject[];
  totals: { repos: number; commits: number; releases: number };
}

const SECTION_COPY: { category: string; title: string; command: string; blurb: string }[] = [
  {
    category: 'Apps',
    title: 'Apps',
    command: 'ls oss/apps',
    blurb: 'Products people use: iOS, Mac and desktop apps with their source open.',
  },
  {
    category: 'AI & Agents',
    title: 'AI & agents',
    command: 'ls oss/ai-agents',
    blurb: 'Agent servers, a task dispatcher, local-model tooling and research agents.',
  },
  {
    category: 'Linux & System',
    title: 'Linux & system',
    command: 'ls oss/linux',
    blurb: 'Daemons and utilities for Linux desktops. More on the Linux page.',
  },
  {
    category: 'CLI Tools',
    title: 'Command-line',
    command: 'ls oss/cli-tools',
    blurb: 'Single-binary tools for the terminal.',
  },
  {
    category: 'Swift Packages',
    title: 'Swift packages',
    command: 'ls oss/swift-packages',
    blurb: 'Reusable Swift libraries and API clients.',
  },
  {
    category: 'SDKs & Libraries',
    title: 'SDKs & libraries',
    command: 'ls oss/sdks',
    blurb: 'API clients for Rust and Go.',
  },
];

const OTHER_COPY = {
  category: 'Other',
  title: 'Everything else',
  command: 'ls oss/misc',
  blurb: 'Dotfiles, web apps, mods and experiments.',
};

/// Splits one category's projects (already best-first) into cards for anything substantial and
/// one-line rows for the rest, with the totals the section header shows.
export function partitionOss(
  copy: { category: string; title: string; command: string; blurb: string },
  projects: OssProject[],
  now: Date = OSS_NOW
): OssSection {
  return {
    ...copy,
    featured: projects.filter((project) => ossScore(project, now) >= OSS_FEATURED_SCORE),
    compact: projects.filter((project) => ossScore(project, now) < OSS_FEATURED_SCORE),
    totals: {
      repos: projects.length,
      commits: projects.reduce((sum, project) => sum + (project.commitCount ?? 0), 0),
      releases: projects.reduce((sum, project) => sum + (project.releaseCount ?? 0), 0),
    },
  };
}

const named = new Set(SECTION_COPY.map((entry) => entry.category));

export const ossSections: OssSection[] = [
  ...SECTION_COPY.map((copy) =>
    partitionOss(
      copy,
      ossProjects.filter((project) => project.category === copy.category)
    )
  ),
  partitionOss(
    OTHER_COPY,
    ossProjects.filter((project) => !named.has(project.category))
  ),
].filter((section) => section.totals.repos > 0);

export const ossStats = {
  repos: ossProjects.length,
  commits: ossProjects.reduce((sum, project) => sum + (project.commitCount ?? 0), 0),
  releases: ossProjects.reduce((sum, project) => sum + (project.releaseCount ?? 0), 0),
  stars: ossProjects.reduce((sum, project) => sum + project.stars, 0),
  languages: [...new Set(ossProjects.map((project) => project.language).filter(Boolean))],
};
