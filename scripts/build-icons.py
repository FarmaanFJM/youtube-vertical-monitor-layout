#!/usr/bin/env python3
"""Regenerates the extension icons from the approved logo master.

Usage: python3 scripts/build-icons.py [source.png]

With a source image (the approved logo on a white canvas) it first rebuilds
assets/logo.png: the canvas is cropped to the logo, and the white background
connected to the image border is made transparent. White inside the logo is
untouched. Without arguments it only re-renders icons/icon-<size>.png from
assets/logo.png.
"""
import sys
from collections import deque
from PIL import Image

SIZES = (16, 32, 48, 128)
DARK = 36  # luminance of the logo's dark tile edge


def make_master(src):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    px = im.load()
    lum = lambda p: (p[0] + p[1] + p[2]) / 3
    bg = [[False] * w for _ in range(h)]
    q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or bg[y][x] or lum(px[x, y]) < 250:
            continue
        bg[y][x] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if bg[y][x]:
                op[x, y] = (0, 0, 0, 0)
                continue
            near = any(
                bg[j][i]
                for j in range(max(0, y - 2), min(h, y + 3))
                for i in range(max(0, x - 2), min(w, x + 3))
            )
            if near and lum(p) > DARK:
                # antialiased fringe: dark tile blended with white canvas
                a = max(0.0, min(1.0, 1 - (lum(p) - DARK) / (255 - DARK)))
                op[x, y] = (DARK, DARK, DARK + 2, round(a * 255))
            else:
                op[x, y] = p + (255,)
    out = out.crop(out.getbbox())
    # The source has faint light lines hugging the tile edge. Anything within a
    # few pixels of the outline is tile, so pull stray light pixels back to the
    # tile's dark colour (alpha is kept, so the antialiased edge stays smooth).
    ow, oh = out.size
    ob = out.load()
    edge = 6
    for y in range(oh):
        for x in range(ow):
            r, g, b, a = ob[x, y]
            if a == 0 or (r + g + b) / 3 <= DARK + 20:
                continue
            near = (
                min(x, y, ow - 1 - x, oh - 1 - y) < edge
                or any(
                    ob[i, j][3] == 0
                    for j in range(max(0, y - edge), min(oh, y + edge + 1))
                    for i in range(max(0, x - edge), min(ow, x + edge + 1))
                )
            )
            if near:
                ob[x, y] = (DARK, DARK, DARK + 2, a)
    side = max(out.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(out, ((side - out.width) // 2, (side - out.height) // 2))
    sq.resize((512, 512), Image.LANCZOS).save("assets/logo.png", optimize=True)


if len(sys.argv) > 1:
    make_master(sys.argv[1])
master = Image.open("assets/logo.png").convert("RGBA")
for s in SIZES:
    master.resize((s, s), Image.LANCZOS).save(f"icons/icon-{s}.png", optimize=True)
    print("wrote", f"icons/icon-{s}.png")
