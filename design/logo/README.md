# Pantau logo

The mark is an eye whose upper lid is a volcano peak, watching over the land. Pantau means to watch over.

![Pantau lockup](final/pantau-lockup.svg)

## Files

| File | Use |
|---|---|
| `final/pantau-symbol.svg` | Symbol on light backgrounds, 48 px and larger |
| `final/pantau-symbol-small.svg` | Symbol below 48 px (thicker lids, bigger pupil) |
| `final/pantau-symbol-reversed.svg`, `final/pantau-symbol-small-reversed.svg` | Symbol on dark backgrounds |
| `final/pantau-symbol-black.svg`, `-white.svg`, `-teal.svg` | One colour versions |
| `final/pantau-lockup.svg`, `-reversed.svg`, `-black.svg`, `-white.svg` | Horizontal lockup |
| `final/pantau-lockup-stacked.svg`, `-stacked-reversed.svg` | Stacked lockup |
| `final/pantau-app-icon.svg`, `-square.svg` | App icon tile, rounded and square |
| `export/` | favicon.ico, PNG icons, maskable icon, manifest and head snippet |
| `slides/`, `board.html` | Presentation board with mockups |

Every file is outlined. There is no live text, so no font is needed to open them.

## Colour

| Name | HEX | RGB | Use |
|---|---|---|---|
| Deep teal | `#1f4d55` | 31 77 85 | Lids and wordmark on light, app icon tile |
| Lava | `#c8582a` | 200 88 42 | Pupil on light backgrounds |
| Pale aqua | `#bfe3e8` | 191 227 232 | Lids on dark backgrounds |
| Apricot | `#f2b98f` | 242 185 143 | Pupil on dark backgrounds |
| Near white | `#e4edee` | 228 237 238 | Wordmark on dark backgrounds |

When only one colour is possible, use the teal, black or white versions. The pupil then takes the same colour as the lids.

## Type

The wordmark is Bricolage Grotesque at weight 700 with tracking of minus 1.2 percent and a tighter P to a pair, turned into outlines. Bricolage Grotesque uses the SIL Open Font License, which allows logo use. Interface text uses IBM Plex Sans.

## Clear space and size

* Keep clear space around the logo equal to the pupil diameter on every side.
* Use the small cut below 48 px. The smallest symbol size is 16 px, and the smallest lockup is 96 px wide.
* In the horizontal lockup the wordmark cap height is 104 units next to a 256 unit symbol, with a gap of about half a cap height. Do not change these proportions.

## Don't

* Don't stretch, rotate or redraw the eye.
* Don't change the pupil to any colour other than lava, apricot or the one colour of the version.
* Don't place the light version on dark or busy photos. Use the reversed version or the app icon tile.
* Don't add shadows, outlines, gradients or glows.
* Don't set "Pantau" in another font next to the symbol. Use the lockup files.

## Notes

The geometry is built in `build_eye.py` (exact 45 degree lids, round outer corners, offset curve for the lower lid) and assembled in `build_kit.py`. An eye under a peak can recall the Eye of Providence. The rounded open lid and the lava pupil keep this mark apart from it, but a trademark search is still recommended before registering it.
