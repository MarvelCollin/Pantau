import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

src = sys.argv[1]
font = TTFont(src)
inst = instancer.instantiateVariableFont(font, {"wght": 700, "opsz": 96} if "opsz" in [a.axisTag for a in font["fvar"].axes] else {"wght": 700})
gs = inst.getGlyphSet()
cmap = inst.getBestCmap()
upm = inst["head"].unitsPerEm
text = "Pantau"
tracking = -0.012 * upm
kern = {("P", "a"): -0.04 * upm}
x = 0
parts = []
prev = None
for ch in text:
    g = cmap[ord(ch)]
    if prev and (prev, ch) in kern: x += kern[(prev, ch)]
    pen = SVGPathPen(gs)
    gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
    parts.append(pen.getCommands())
    x += gs[g].width + tracking
    prev = ch
os2 = inst["OS/2"]
cap = os2.sCapHeight
print(f"{x:.1f} {cap} {upm} {os2.sxHeight}")
open("wordmark-raw.txt", "w").write(f"{x:.1f} {cap} {upm}\n" + "".join(parts))
