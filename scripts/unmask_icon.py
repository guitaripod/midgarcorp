#!/usr/bin/env python3
"""Rebuild a store icon that ships with the rounded-rect mask baked in.

Every other app's 1024px App Store artwork is full-bleed to the corner, so the
site's own `rounded-lg` frames it cleanly. An icon submitted pre-rounded (Helia)
arrives with opaque black wedges outside the squircle, which read as a floating
tile that doesn't fill its rectangle. Detection is deliberately narrow — all four
corners pure black, every edge midpoint not, the black region border-connected
and nowhere near the centre — so a legitimately dark icon is never touched.

Imported by fetch-store-assets.py; standalone: python3 scripts/unmask_icon.py <icon.png> [...]
"""

import sys

from PIL import Image

BLACK_SUM = 12
MIN_MASK_FRACTION = 0.005
MAX_MASK_FRACTION = 0.15
SMOOTHING_PASSES = 40
DILATE_PX = 2
RIM_PASSES = 32
RIM_RATIO = 0.7
RIM_MAX_LUMA = 90


def _looks_masked(px, w, h):
    """True when the four corners are black but the edge midpoints are not.

    A fully dark icon fails the midpoint test, which is what keeps this from
    eating artwork whose background just happens to be near-black.
    """
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    midpoints = [(w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    return all(_is_black(px[p]) for p in corners) and not any(_is_black(px[p]) for p in midpoints)


def _is_black(rgb):
    return rgb[0] + rgb[1] + rgb[2] <= BLACK_SUM


def _flood_corners(px, w, h):
    """Border-connected black pixels reachable from the four corners."""
    mask = set()
    stack = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in mask or not (0 <= x < w and 0 <= y < h) or not _is_black(px[x, y]):
            continue
        mask.add((x, y))
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return mask


def _ring(mask, grown, w, h):
    ring = set()
    for x, y in mask:
        for nx in (x - 1, x, x + 1):
            for ny in (y - 1, y, y + 1):
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in grown:
                    ring.add((nx, ny))
    return ring


def _luma(rgb):
    return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]


def _grow_over_rim(px, mask, w, h):
    """Absorb the mask's shaded edge, which fades to artwork over several pixels.

    A flat dilation can't cover it: where the corner curve runs nearly parallel
    to an edge, a two-pixel-wide feather smears across a dozen pixels of that
    row, and anything left behind draws a dark hairline around the corner. So the
    frontier keeps advancing while a pixel is markedly darker than the artwork
    just inside it, which stops on its own once the gradient goes flat.
    """
    grown = set(mask)
    frontier = mask
    for _ in range(DILATE_PX):
        frontier = _ring(frontier, grown, w, h)
        grown |= frontier
    for _ in range(RIM_PASSES):
        candidates = _ring(frontier, grown, w, h)
        frontier = set()
        for x, y in candidates:
            dx = 1 if x < w / 2 else -1
            dy = 1 if y < h / 2 else -1
            inward = px[min(max(x + 3 * dx, 0), w - 1), min(max(y + 3 * dy, 0), h - 1)]
            here = _luma(px[x, y])
            if here < RIM_MAX_LUMA and here < RIM_RATIO * _luma(inward):
                frontier.add((x, y))
        if not frontier:
            break
        grown |= frontier
    return grown


def _confined_to_corners(mask, w, h):
    inner_x = range(w // 5, w - w // 5)
    inner_y = range(h // 5, h - h // 5)
    return not any(x in inner_x and y in inner_y for x, y in mask)


def _run_ends(line_masked, length):
    """Map each masked index to (before, after) — the valid indices flanking its run."""
    ends = {}
    i = 0
    while i < length:
        if i not in line_masked:
            i += 1
            continue
        start = i
        while i < length and i in line_masked:
            i += 1
        before = start - 1 if start > 0 else None
        after = i if i < length else None
        for j in range(start, i):
            ends[j] = (before, after)
    return ends


def _extend(px, mask, w, h):
    """Inverse-distance blend of the nearest valid pixel on each side.

    Store-icon backgrounds are smooth gradients, so extending the row and column
    neighbours into the wedge reconstructs what the mask covered up.
    """
    rows = {}
    for y in range(h):
        masked = {x for x in range(w) if (x, y) in mask}
        if masked:
            rows[y] = _run_ends(masked, w)
    cols = {}
    for x in range(w):
        masked = {y for y in range(h) if (x, y) in mask}
        if masked:
            cols[x] = _run_ends(masked, h)

    filled = {}
    for x, y in mask:
        samples = []
        left, right = rows[y][x]
        if left is not None:
            samples.append((px[left, y], x - left))
        if right is not None:
            samples.append((px[right, y], right - x))
        top, bottom = cols[x][y]
        if top is not None:
            samples.append((px[x, top], y - top))
        if bottom is not None:
            samples.append((px[x, bottom], bottom - y))
        if not samples:
            continue
        total = sum(1 / d for _, d in samples)
        filled[(x, y)] = tuple(
            round(sum(c[i] / d for c, d in samples) / total) for i in range(3)
        )
    for pos, rgb in filled.items():
        px[pos] = rgb


def _smooth(px, mask, w, h):
    """Jacobi passes over the filled wedges only, so no seam survives the join."""
    for _ in range(SMOOTHING_PASSES):
        updates = {}
        for x, y in mask:
            neighbours = [
                px[nx, ny]
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
                if 0 <= nx < w and 0 <= ny < h
            ]
            updates[(x, y)] = tuple(
                round(sum(n[i] for n in neighbours) / len(neighbours)) for i in range(3)
            )
        for pos, rgb in updates.items():
            px[pos] = rgb


def _save(im, path, fmt):
    """Write back in the format the file arrived as — iTunes serves JPEG bytes
    under a .png name, and re-encoding those as PNG quadruples the repo weight."""
    if fmt == "JPEG":
        im.save(path, "JPEG", quality=92, subsampling=0)
    else:
        im.save(path, fmt or "PNG", optimize=True)


def unmask(path):
    """Fill a baked-in corner mask with the surrounding artwork; True if changed."""
    original = Image.open(path)
    fmt = original.format
    im = original.convert("RGB")
    w, h = im.size
    px = im.load()
    if not _looks_masked(px, w, h):
        return False
    mask = _flood_corners(px, w, h)
    fraction = len(mask) / (w * h)
    if not MIN_MASK_FRACTION <= fraction <= MAX_MASK_FRACTION:
        return False
    if not _confined_to_corners(mask, w, h):
        return False
    mask = _grow_over_rim(px, mask, w, h)
    _extend(px, mask, w, h)
    _smooth(px, mask, w, h)
    _save(im, path, fmt)
    return True


def main():
    paths = sys.argv[1:]
    if not paths:
        sys.exit(__doc__)
    for path in paths:
        print(f"{path}: {'unmasked' if unmask(path) else 'no baked mask'}")


if __name__ == "__main__":
    main()
