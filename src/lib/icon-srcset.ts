import variantManifest from '../data/screenshot-variants.json';

/// Self-hosted icons ship at 512px for slots that are never wider than 80 CSS px, so cite the
/// downscales generate-screenshot-variants.mjs actually wrote. A remote App Store artwork URL
/// has no manifest entry and stays srcset-less.
export function iconSrcset(icon: string): string | undefined {
  const widths = (variantManifest as Record<string, number[]>)[icon] ?? [];
  return widths.length
    ? widths.map((w) => `${icon.replace(/\.webp$/, `@${w}.webp`)} ${w}w`).join(', ')
    : undefined;
}
