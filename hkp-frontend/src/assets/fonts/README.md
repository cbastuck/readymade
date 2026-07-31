# Bundled fonts

Font files here are third-party works and are **not** covered by the AGPL-3.0
licence of this repository. Each remains under its own licence.

Every file in this directory is used. Anything that stops being referenced
should be deleted rather than left behind — see "Removed" below.

## SIL Open Font License 1.1

| File                    | Family                   | Licence text             | Registered in                    |
| ----------------------- | ------------------------ | ------------------------ | -------------------------------- |
| `recursive-*.woff2`     | Recursive (variable)     | `OFL-Recursive.txt`      | `src/index.css`                  |
| `space-grotesk-*.woff2` | Space Grotesk (variable) | `OFL-SpaceGrotesk.txt`   | `src/ui-components/ThemeContext.tsx` |
| `archivo-*.woff2`       | Archivo (variable)       | `OFL-Archivo.txt`        | `src/ui-components/ThemeContext.tsx` |
| `Kalam-*.woff2`         | Kalam (400, 700)         | `OFL-Kalam.txt`          | `src/index.css`                  |

Recursive, Space Grotesk and Archivo are Google Fonts webfont builds (latin and
latin-ext subsets). None of the four declares a Reserved Font Name, so the
subsets keep their original family names. Each carries its copyright notice and
licence URL in its `name` table.

Space Grotesk and Archivo back the optional appearance presets and are
registered lazily, so their files are fetched only when a user selects that
preset. All fonts are served from the app's own origin — do not reintroduce a
`fonts.googleapis.com` link or `@import`.

## Freeware

| File                | Source                             | Terms                                                                                        |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| `Walkway Black.ttf` | dafont.com/walkway.font (GemFonts) | Listed "100% Free" — free for personal and commercial use. Freeware; no licence file exists. |

Registered as `hkp-fnt-sans` in `src/index.css` and ships in the app bundles.
Its only embedded metadata is `©G.M.` with the trademark `GM / Walkway`; there
is no licence text, so the "100% Free" listing is the whole of the grant.

## Removed

Deleted on 2026-07-31 as unreferenced (~3.9 MB):

- `Intrigora-Medium.ttf` — dafont listed it "100% Free", but the file's own
  `name` table gave its licence and vendor URL as
  `https://www.creativefabrica.com` (designer "plotomad"), whose free downloads
  are generally personal-use only. The sources disagreed and nothing used it.
  Do not re-add it without a written licence.
- `cutive.regular.ttf`, `Cabin-VariableFont_wdth,wght.ttf`,
  `lato-v15-latin-regular.ttf` — had `@font-face` rules
  (`hkp-fnt-serif-dry`, `hkp-fnt-serif`, `hkp-fnt-lato`) that nothing ever
  applied. Rules removed with the files.
- `Cormorant`, `CourierPrime`, `DellaRespira`, `FjordOne`, `Geist`,
  `GeistMono`, `Lora`, `RobotoMono`, `SpecialElite`, `YoungSerif`, `Poly`,
  `nimbusmono`, and the whole `Roboto/` family — never referenced at all. The
  "Roboto" that appears in the website's font stacks is the system font, not
  these files.
