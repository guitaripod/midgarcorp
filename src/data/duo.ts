import manifest from './duo-combos.json';

interface DuoEntry {
  w: number;
  h: number;
  widths: number[];
}

export interface DuoCombo {
  src: string;
  srcset: string;
  w: number;
  h: number;
}

/// Bump when a combo image is regenerated so browsers refetch the stable path.
const DUO_REV = '1';

const entries = manifest as Record<string, DuoEntry>;

/// The iPhone Duo picture for an app: its outer display in front of its open inner display.
/// Undefined for an app that has none, so a page renders no Duo section at all.
export function duoCombo(slug: string): DuoCombo | undefined {
  const entry = entries[slug];
  if (!entry) return undefined;
  const url = (file: string) => `/duo/${file}?v=${DUO_REV}`;
  return {
    src: url(`${slug}.webp`),
    srcset: [
      ...entry.widths.map((wide) => `${url(`${slug}@${wide}.webp`)} ${wide}w`),
      `${url(`${slug}.webp`)} ${entry.w}w`,
    ].join(', '),
    w: entry.w,
    h: entry.h,
  };
}
