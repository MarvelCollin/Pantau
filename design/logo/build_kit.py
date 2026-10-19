import re
from build_eye import eye

def r1(d): return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.1f}".rstrip("0").rstrip("."), d)

TEAL, AQUA, LAVA, APRICOT, INK_DARK = "#1f4d55", "#bfe3e8", "#c8582a", "#f2b98f", "#e4edee"
W, CAP, UPM = open("wordmark-raw.txt").readline().split()
W, CAP = float(W), float(CAP)
word = r1(open("wordmark-raw.txt").read().split("\n", 1)[1])

def symbol_paths(small=False):
    lid, pupil, m = eye(32, 30, 147) if small else eye(22, 25, 149)
    shift = 128 - (m["top"] + m["bottom"]) / 2 - 3
    return r1(lid), r1(pupil), shift

def sym_svg(lid_c, pupil_c, small=False, bg=None, rx=0, size=256):
    lid, pupil, shift = symbol_paths(small)
    bgr = f'<rect width="256" height="256" rx="{rx}" fill="{bg}"/>' if bg else ""
    inset = ' transform="translate(25.6 25.6) scale(0.8)"' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="{size}" height="{size}">{bgr}'
            f'<g{inset}><g transform="translate(0 {shift:.2f})"><path fill="{lid_c}" fill-rule="evenodd" d="{lid}"/>'
            f'<path fill="{pupil_c}" d="{pupil}"/></g></g></svg>\n')

def lockup(lid_c, pupil_c, word_c, stacked=False):
    lid, pupil, shift = symbol_paths()
    cap_px = 104
    s = cap_px / CAP
    word_w = W * s
    if not stacked:
        bx, by = 287, 128 + shift - 2 + cap_px / 2
        vw, vh = int(bx + word_w + 16), 256
        sym = f'<g transform="translate(0 {shift:.2f})">'
    else:
        vw = int(max(word_w, 256) + 48)
        sx = (vw - 256) / 2
        by = 256 + 24 + cap_px
        bx = (vw - word_w) / 2
        vh = int(by + 36)
        sym = f'<g transform="translate({sx:.2f} {shift:.2f})">'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" width="{vw}" height="{vh}">'
            f'{sym}<path fill="{lid_c}" fill-rule="evenodd" d="{lid}"/><path fill="{pupil_c}" d="{pupil}"/></g>'
            f'<g transform="translate({bx:.2f} {by:.2f}) scale({s:.5f})"><path fill="{word_c}" d="{word}"/></g></svg>\n')

out = "final/"
files = {
    "pantau-symbol.svg": sym_svg(TEAL, LAVA),
    "pantau-symbol-reversed.svg": sym_svg(AQUA, APRICOT),
    "pantau-symbol-black.svg": sym_svg("#000", "#000"),
    "pantau-symbol-white.svg": sym_svg("#fff", "#fff"),
    "pantau-symbol-teal.svg": sym_svg(TEAL, TEAL),
    "pantau-symbol-small.svg": sym_svg(TEAL, LAVA, small=True),
    "pantau-symbol-small-black.svg": sym_svg("#000", "#000", small=True),
    "pantau-app-icon.svg": sym_svg(AQUA, APRICOT, small=True, bg=TEAL, rx=56),
    "pantau-app-icon-square.svg": sym_svg(AQUA, APRICOT, small=True, bg=TEAL, rx=0),
    "pantau-lockup.svg": lockup(TEAL, LAVA, TEAL),
    "pantau-lockup-reversed.svg": lockup(AQUA, APRICOT, INK_DARK),
    "pantau-lockup-black.svg": lockup("#000", "#000", "#000"),
    "pantau-lockup-white.svg": lockup("#fff", "#fff", "#fff"),
    "pantau-lockup-stacked.svg": lockup(TEAL, LAVA, TEAL, stacked=True),
    "pantau-lockup-stacked-reversed.svg": lockup(AQUA, APRICOT, INK_DARK, stacked=True),
}
for name, content in files.items():
    open(out + name, "w").write(content)
print(len(files), "files")
