import { DAY_MS } from './work';

const HEADLINE_MAX = 110;
const BULLET = /^(?:[•·*–—-]\s*|\d+[.)]\s+)/;
const TERMINATOR =
  /(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|vs|e\.g|i\.e|U\.S|U\.K|[A-Z]))[.!?]["'”’)]*(?=\s+[\p{Lu}\p{N}"“'‘(]|\s*$)/u;

/// A line that only introduces what follows, such as "New:" or "WHAT'S NEW", says nothing
/// about the release itself.
function isHeading(line: string): boolean {
  return /:$/.test(line) || (line === line.toUpperCase() && /[A-Z]/.test(line));
}

/// Cuts a long line at the last word that fits, so a headline never ends mid-word; only a
/// single word longer than the whole limit is cut through.
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, '')}…`;
}

/// The first sentence of an App Store "What's New" text: headings, bullet marks and list
/// numbers are skipped, and "3 a.m.", "Last.fm" or "Dr. Who" never end the sentence early.
export function releaseHeadline(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const line = notes
    .split(/\n+/)
    .map((raw) => raw.trim().replace(BULLET, '').trim())
    .find((candidate) => candidate.length > 0 && !isHeading(candidate));
  if (!line) return null;
  const end = line.match(TERMINATOR);
  const sentence = end?.index !== undefined ? line.slice(0, end.index + end[0].length) : line;
  return clip(sentence, HEADLINE_MAX);
}

/// Whether a release landed within the last `days` days of `now`.
export function shippedWithin(iso: string | null | undefined, days: number, now: Date): boolean {
  if (!iso) return false;
  const age = now.getTime() - new Date(iso).getTime();
  return age >= 0 && age <= days * DAY_MS;
}

/// Folds items that share a key into one group at the position of the first, once at least
/// `atLeast` of them share it; every other item stays a group of one. Five apps that all
/// shipped "A maintenance update." the same day read as one line, not five.
export function foldShared<T>(items: T[], keyOf: (item: T) => string | null, atLeast = 3): T[][] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const groups: T[][] = [];
  const open = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null || (counts.get(key) ?? 0) < atLeast) {
      groups.push([item]);
      continue;
    }
    const group = open.get(key);
    if (group) {
      group.push(item);
    } else {
      const fresh = [item];
      open.set(key, fresh);
      groups.push(fresh);
    }
  }
  return groups;
}

export type NoteBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

/// An App Store "What's New" text as blocks a page can render: heading lines ("New:",
/// "WHAT'S NEW") lose their colon, bullet or numbered lines gather into one list, and every
/// other line is a paragraph.
export function releaseNoteBlocks(notes: string | null | undefined): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  for (const raw of (notes ?? '').split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (BULLET.test(line)) {
      const item = line.replace(BULLET, '').trim();
      const last = blocks.at(-1);
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
    } else if (isHeading(line)) {
      blocks.push({ kind: 'heading', text: line.replace(/:$/, '') });
    } else {
      blocks.push({ kind: 'paragraph', text: line });
    }
  }
  return blocks;
}
