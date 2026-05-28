export function cleanAppStoreDescription(description: string): string {
  if (!description) return '';

  const segments = description
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length <= 1) return segments[0] ?? '';

  const prose = segments.filter((segment) => {
    if (/^[•·–—\-*]\s/.test(segment)) return false;
    if (segment.length < 80 && !/[.!?]$/.test(segment)) return false;
    return true;
  });

  return (prose.length ? prose : segments).join(' ');
}
