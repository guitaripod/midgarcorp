export interface Dated {
  slug: string;
  releaseDate?: string;
}

const newestFirst = (a: Dated, b: Dated): number =>
  new Date(b.releaseDate ?? 0).getTime() - new Date(a.releaseDate ?? 0).getTime();

/// The other apps an app page links to: the newest releases first, so they surface, then the
/// apps that follow this one in release order, wrapping around. Every app is then linked from
/// several other app pages, not only the newest ones from all of them.
export function siblingApps<T extends Dated>(apps: T[], slug: string, count = 6, newest = 3): T[] {
  const ordered = [...apps].sort(newestFirst);
  const others = ordered.filter((app) => app.slug !== slug);
  const picked = others.slice(0, newest);
  const start = ordered.findIndex((app) => app.slug === slug);
  for (let step = 1; step < ordered.length && picked.length < count; step += 1) {
    const next = ordered[(start + step) % ordered.length];
    if (next.slug !== slug && !picked.includes(next)) picked.push(next);
  }
  return picked;
}
