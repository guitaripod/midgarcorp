export type SearchKind = 'app' | 'post' | 'tool' | 'page';

export const SEARCH_KINDS: readonly SearchKind[] = ['app', 'post', 'tool', 'page'];

const TOOL_PATHS = new Set(['/imago', '/yoink', '/unrager', '/recview', '/cli-tools', '/linux']);

/** Buckets a pathname into the kind of result the search palette groups and filters by. */
export function searchKind(pathname: string, appSlugs: readonly string[]): SearchKind {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path.startsWith('/blog/')) return 'post';
  if (TOOL_PATHS.has(path)) return 'tool';
  if (appSlugs.some((slug) => path === `/${slug}` || path.startsWith(`/${slug}/`))) return 'app';
  return 'page';
}

/** Trims the site suffix and SEO tagline from a document title so results show the bare name. */
export function searchTitle(title: string): string {
  const head = title.split(/\s+[|—–]\s+/)[0]?.trim();
  return head || title.trim();
}

export function isSearchKind(value: unknown): value is SearchKind {
  return typeof value === 'string' && (SEARCH_KINDS as readonly string[]).includes(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escapes a Pagefind excerpt for innerHTML while keeping only its own `<mark>` highlights. */
export function safeExcerpt(excerpt: string): string {
  return escapeHtml(excerpt)
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>');
}

/** Moves a list selection by `delta`, wrapping at both ends; -1 means nothing is selected. */
export function moveSelection(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : length - 1;
  return (current + delta + length) % length;
}
