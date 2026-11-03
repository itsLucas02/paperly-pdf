"""Render "paperly" from the real DM Sans 800 into SVG path outlines.

The wordmark must be DM Sans 800 with -1.5px tracking (see .brand in globals.css).
sharp/libvips cannot see webfonts, so we vectorise the glyphs here instead of
letting the renderer silently fall back to Helvetica.

Emits two paths: the letters, and the trailing period on its own, so the dot can
be filled with the brand coral independently.
"""
import json
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

FONT = "node_modules/@fontsource/dm-sans/files/dm-sans-latin-800-normal.woff"
TEXT = "paperly."
DOT_CHAR = "."
EM = 1000.0
TRACKING_EM = -1.5 / 30.0     # -1.5px at the 30px design size, in em
TARGET_EM = 1000.0

font = TTFont(FONT)
glyphset = font.getGlyphSet()
cmap = font.getBestCmap()
upem = font["head"].unitsPerEm
hmtx = font["hmtx"]

scale = TARGET_EM / upem
letters = []
dot = None
dot_x = 0.0
x = 0.0
bounds = {"xMin": None, "xMax": None, "yMin": None, "yMax": None}

for ch in TEXT:
    gname = cmap.get(ord(ch))
    if gname is None:
        continue
    glyph = glyphset[gname]
    spen = SVGPathPen(glyphset, ntos=lambda v: f"{v:.2f}")
    tpen = TransformPen(spen, Transform(scale, 0, 0, -scale, x, 0))
    glyph.draw(tpen)
    d = spen.getCommands()
    if d:
        if ch == DOT_CHAR:
            dot = d
            dot_x = x
        else:
            letters.append(d)
    # track the true ink bounds of the letters (not the period)
    if ch != DOT_CHAR and hasattr(glyph, "width"):
        try:
            from fontTools.pens.boundsPen import BoundsPen
            bp = BoundsPen(glyphset)
            glyph.draw(TransformPen(bp, Transform(scale, 0, 0, -scale, x, 0)))
            if bp.bounds:
                x0, y0, x1, y1 = bp.bounds
                bounds["xMin"] = x0 if bounds["xMin"] is None else min(bounds["xMin"], x0)
                bounds["xMax"] = x1 if bounds["xMax"] is None else max(bounds["xMax"], x1)
                bounds["yMin"] = y0 if bounds["yMin"] is None else min(bounds["yMin"], y0)
                bounds["yMax"] = y1 if bounds["yMax"] is None else max(bounds["yMax"], y1)
        except Exception:
            pass
    x += hmtx[gname][0] * scale + TRACKING_EM * TARGET_EM

print(json.dumps({
    "letters": " ".join(letters),
    "dot": dot or "",
    "advance": round(x, 2),
    "dotX": round(dot_x, 2),
    "bounds": bounds,
}))