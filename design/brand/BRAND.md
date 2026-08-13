# BRAND.md — the InstaHealth mark, lockups and app icon

> Transcribed from `design/brand/InstaHealth Brand Assets.html`, which is the
> source of truth and is **deliberately not committed** (1.6 MB, founder's
> instruction). This file is the extract the code needs; where it quotes the
> bundle it says so, and where the bundle is **silent** it says that too — so
> nobody has to guess which is which.

## The mark

> "**The Open Slot.** A ring — the day — broken once at the top right, with a
> dot claiming the gap: the moment you reserved. Booking, not medicine.
> Geometry is fixed: 64-unit square, ring r=21 at stroke 9 with round caps, dash
> 98/34 leaving a 93° gap centred at 313.5°, dot r=6.5 at (46.4, 16.8).
> **Never redraw it by eye.**"

The masters live in `design/brand/logo/`. All five are byte-identical to the
bundle's embedded resources (verified by SHA-256):

| file | ring | dot | use |
| --- | --- | --- | --- |
| `mark-color.svg` | `#028090` | `#02C39A` | the default, on white |
| `mark-white.svg` | `#FFFFFF` | `#F0F3BD` | on a teal field |
| `mark-teal.svg` | `#028090` | `#028090` | single-ink teal |
| `mark-black.svg` | `#000000` | `#000000` | fax & legal |
| `app-icon-1024.svg` | white on `#028090` | `#F0F3BD` | the 1024 app-icon master |

## The four approved tones — and no others

> "Four approved tones and no others. `#028090` on white is 4.6:1 and white on
> `#028090` is 4.6:1 — both hold at the minimum sizes. Cream `#F0F3BD` never
> appears on white (1.1:1); it exists only as the dot on a teal field."

| tone | ring | dot | wordmark | Arabic line | shown on |
| --- | --- | --- | --- | --- | --- |
| `color` | `#028090` | `#02C39A` | `#044F6E` | `#5E737C` | `#FFFFFF` |
| `white` | `#FFFFFF` | `#F0F3BD` | `#FFFFFF` | `#BFEDEA` | `#028090` |
| `teal` | `#028090` | `#028090` | `#028090` | `#028090` | `#FFFFFF` |
| `black` | `#000000` | `#000000` | `#000000` | `#000000` | `#FFFFFF` |

⚠ Every brand hex maps to a design token **except `#000000`** — the nearest is
`neutral.950` `#070E12`, which is not the same colour. The black mono tone is
therefore a literal, not a token, until someone decides otherwise.

## Lockups — and which one goes where

> "Bilingual lockups — **English-led.** InstaHealth in Atkinson Hyperlegible
> Bold is the primary line; انستاهيلث in Cairo SemiBold sits beneath it as the
> secondary. This applies everywhere the brand appears in both languages —
> horizontal and stacked alike."

| lockup | the bundle's routing | minimum |
| --- | --- | --- |
| mark / app icon | "App icon, favicon, avatar, loading state" | 20px |
| `LogoHorizontal` | "Navigation, receipts, email header — the bilingual default" | 36px |
| `LogoStacked` | "Onboarding welcome, splash, centred hero" | 56px |
| `LogoArabic` | "Exclusively-Arabic contexts, e.g. Arabic ad creative" | 24px |
| `LogoEnglish` | "Tight horizontal space, partner & investor material" | 24px |

**Every dimension is a ratio of `size`**, which is what makes a lockup
reproducible without an outlined master:

| | horizontal | stacked |
| --- | --- | --- |
| gap, mark → type | `size × 0.34` | `size × 0.26` |
| gap between the two lines | `size × 0.05` | `size × 0.06` |
| «InstaHealth» | `size × 0.46`, Atkinson **700**, tracking `−0.015em`, line-height 1.1 | `size × 0.34`, same otherwise |
| «انستاهيلث» | `size × 0.32`, Cairo **600**, line-height 1.35 | `size × 0.22`, same otherwise |

⚠ **There is no outlined/vector lockup anywhere in the bundle** — not one
`<path>` element exists in it. Both wordmarks are live text. Any raster of a
lockup (splash, OG image) is therefore a *render*, and must load the real fonts
to be correct.

⚠ **Inconsistency in the source, unresolved:** `LogoArabic` sets the Arabic at
weight **700** in the wordmark colour, while both bilingual lockups set it at
**600** in the secondary colour. The prose only ever says "Cairo SemiBold".
Flagged for the next brand revision; the code follows the bilingual spec.

## Clear space & minimum sizes

> "X = one quarter of the mark's height. Keep **2X** free of type, imagery and
> layout edges on all four sides of any lockup."

> "Bilingual floors are higher than single-language ones because they are set by
> the Arabic secondary line — 0.32× the mark on the horizontal lockup, 0.22× on
> the stacked. **That line must never render below 11px**: Cairo's counters
> close up beneath it. Need a smaller horizontal mark? Use `LogoEnglish`, not a
> shrunken bilingual lockup."

## The app icon

> "The app icon is **the mark alone on a solid brand field — never a lockup**.
> The master is authored at 1024×1024 with the mark inside a 600px box, leaving
> 212px margins that survive Android maskable circles and the iOS squircle."

- canvas **1024**, mark box **600**, inset **212** on every side
- `transform="translate(212 212) scale(9.375)"` over the 64-unit mark, **centred**
- field `#028090`; `deep` = `#05668D`; `white` inverts to a teal ring on white
- `rx=229` for the squircle preview; **`rx=0` is what ships** — iOS and Android
  apply their own masks, and pre-rounding double-rounds the corners

The 212/1024 inset is 58.6% of the canvas, inside Android's 66/108 (61.1%) safe
circle — which is what "survive Android maskable circles" means numerically.

## Typefaces

> "**Two faces, no substitutes.**"
>
> - "Atkinson Hyperlegible Bold · Latin wordmark and all Latin UI. Chosen for
>   legibility at small sizes and for low-vision readers."
> - "Cairo SemiBold · Arabic secondary line and all Arabic UI. Set at 600 in
>   lockups so it reads as supporting, not competing."

## Don't

The bundle has a **"Don't" list and no "Do" list**. Verbatim:

- **Don't stretch** — "Scale proportionally only"
- **Don't recolour** — "Only the four approved tones"
- **Don't sit on busy art** — "Use the white tone over a scrim"
- **Don't add effects** — "No shadows, outlines or bevels"

> "Also: never rebuild a lockup by setting the type yourself, never swap the
> language order on a bilingual lockup, and never place the full-colour tone on
> photography."

Plus, scattered through the prose: "Never redraw it by eye." · "Two faces, no
substitutes." · "The app icon is the mark alone on a solid brand field — never a
lockup." · "Four approved tones and no others."

## ⚠ What the bundle does NOT specify

Recorded so nobody mistakes an implementation choice for a brand rule:

| gap | what we chose, and where |
| --- | --- |
| **Splash size / safe area / dark variant** | The bundle routes splash to `LogoStacked` and shows two specimens at `size={62}`, but states no px, no safe area, no dark rule. We set `imageWidth: 320` in `app.config.ts` — flagged in a comment there. |
| **Android adaptive foreground/background split** | Not in the bundle at all. Derived from the stated 212/1024 inset against Android's 66/108 safe circle. |
| **Monochrome / themed icon** | Not in the bundle. Uses the `black` tone on transparency, because Android 13+ discards colour and tints the alpha. |
| **Favicon sizes / `.ico` / `apple-touch-icon`** | The bundle gives only a 16/20/24/32 *legibility test*, and its own `<link rel="icon">` is the bare colour mark on transparency — which is what both apps ship. |
| **App-icon minimum size** | Not stated. |
| **A "Do" list** | Does not exist. |
| **`readme.md`, "full system guide"** | Referenced in the bundle's footer; **does not exist** in the bundle or the repo. Dangling. |

## Where the code lives

| | |
| --- | --- |
| masters | `design/brand/logo/*.svg` |
| mobile lockups | `apps/mobile/components/brand/Logo.tsx` |
| mobile icons/splash | `apps/mobile/assets/images/` — `icon.png`, `android-icon-{foreground,background,monochrome}.png`, `splash-icon.png` (white tone, for the teal field), `splash-icon-light.png` (colour tone, for a white field — **not currently wired**, the app ships a teal splash) |
| web lockup | `apps/web/components/ui/Logo.tsx` |
| web icons | `apps/web/app/` — `icon.svg`, `favicon.ico`, `apple-icon.png` |

⚠ **Only a dev build can verify the icon and splash visually.** Expo Go shows
its own icon and its own splash screen, never the app's — so neither can be
confirmed from Expo Go, and the first real check is an EAS `preview` build on a
device.
