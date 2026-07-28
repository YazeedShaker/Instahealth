# InstaHealth Design System

InstaHealth is an Egyptian healthcare-booking platform: patients discover nearby labs, clinics, and pharmacies, compare EGP prices, pick a real held slot (10-minute hold), and pay via Paymob, Fawry, or cash-at-branch. Booking refs look like `IH-2026-XXXXX`.

**Products / surfaces**

1. **Patient mobile app** (native, React Native + Expo) — Arabic-first, RTL default, light theme, bottom tab nav (Home, Search, Bookings, Profile), sticky booking CTA. THE product.
2. **Provider dashboard** (web, desktop) — dark theme default, dark-cerulean sidebar; live bookings, services & prices, slot management, reports.
3. Admin (web) — mentioned in sources, no visual spec provided; treat as provider-dashboard styling.

**Sources given** (local folder `Claude design prerequisits/`, read-only mount):

- `PRODUCT.md` — product principles, brand & color, WCAG AA rules, typography, layout, component behavior, booking-flow UX, tone, dark mode, perf budget.
- `design-tokens.css` / `design-tokens.ts` — the `--ih-*` token source of truth (copied nearly verbatim into `tokens/`).
- `instahealth_design_system.jsx` — interactive design-system preview; ground truth for the component inventory and exact values.

No Figma, no logo files, no image assets were provided.

## CONTENT FUNDAMENTALS

- **Arabic-first.** Copy is written in Arabic first; English is the secondary language, not the reverse. Direction switches font: RTL → Cairo, LTR → Atkinson Hyperlegible.
- **Tone: warm, clear, respectful — never clinical, never childish, never alarming.** Healthcare context is anxious enough; microcopy is calm and reassuring. Example CTA: "احجز الآن" (Book Now).
- **Errors are helpful, not blaming, never a dead end** — always offer the next action: "لم نتمكن من تأكيد الدفع. حاول مرة أخرى أو ادفع عند الوصول." / "Payment failed. Please try again or choose a different method."
- **Success copy feels like relief and certainty:** "تم تأكيد حجزك بنجاح! ستصلك رسالة تأكيد قريباً" / "Booking confirmed! You will receive a confirmation SMS shortly."
- **Numbers:** both Arabic-Indic (٩:٣٠، ٤.٨) and Western numerals supported; Arabic UI uses Arabic-Indic digits. Prices always carry "EGP" / "ج.م" (e.g. EGP 180).
- **No medical advice, ever.** Copy facilitates booking; it never diagnoses or interprets results.
- **Preparation notes are first-class content** (fasting rules etc.) — surfaced prominently on cream, at selection, confirmation, and reminder SMS.
- Sentence case in English; no shouting caps except tiny uppercase kicker labels. Emoji are not used in copy (they appear only as placeholder icons — see ICONOGRAPHY).

## VISUAL FOUNDATIONS

- **Palette:** 4-step teal ramp #02C39A (Caribbean Green, primary CTA) → #00A896 (hover) → #028090 (secondary/info) → #05668D (sidebar/headers/deep anchor), plus the signature **cream #F0F3BD** — the differentiator vs. blue-on-white competitors. Cream is background/accent only, used deliberately and sparingly (preparation notes, warm highlights, accent buttons); text on cream is primary-700 or darker.
- **Contrast is enforced (WCAG AA):** never #02C39A text on white for body copy (2.1:1); use primary-600/700 for text on light. White text needs backgrounds darker than neutral-600.
- **Type:** Cairo (Arabic, 300–800; body 400, emphasis 600, headings 700–800, line-height 1.6 body) + Atkinson Hyperlegible (English, 400/700 only, 1.5 body). Base 16px, floor 12px. Headings 1.2. Slight negative letter-spacing on large English headings; none for Arabic.
- **Spacing:** strict 4px grid (`--ih-space-*`). Touch targets ≥ 44×44px.
- **Backgrounds:** flat white / #F6F8F9 subtle gray; cream tint (#F0F3BD at 10%) for warm zones; dark-cerulean → teal gradients (135deg, primary-700→primary-500/400) only for card headers and the brand mark. No textures, patterns, illustrations, or photography provided.
- **Corner radii:** 4/8/12/16/24/32px scale. Inputs & buttons 8px, cards 12–14px, panels 16px, modals 24px, pills/avatars full.
- **Cards:** white surface, subtle teal-tinted shadow (`--ih-shadow-sm`), 12px radius, 1px #E0E5E8 border — never a hard border alone on white. Stat cards may take a 3px primary-400 top border.
- **Shadows:** entire elevation scale is tinted with primary-700 at 6–18% (rgba(5,102,141,…)) — never plain black on light. Dark theme uses black shadows. Teal glow rings (`--ih-glow-*`) for CTA focus/active.
- **Borders:** hairline 1px #E0E5E8; inputs 1.5px, focus turns border teal #02C39A. Focus ring: 2px teal, offset 2px, always visible.
- **Motion:** 80/180/350/600ms; ease-smooth cubic-bezier(0.22,1,0.36,1) default, ease-bounce for playful confirmations; respect prefers-reduced-motion. Skeleton loaders, never blank screens.
- **Hover:** primary fills darken one step (#02C39A→#00A896); sidebar items get rgba(255,255,255,0.12) wash. **Press:** darken to #028090. **Disabled:** 45% opacity + not-allowed.
- **Transparency/blur:** white-wash chips on gradient headers (rgba(255,255,255,0.18)); overlay surfaces at 95% opacity; no heavy glassmorphism.
- **Themes:** patient app light-only (dark is Phase 2+); provider dashboard/admin dark by default. Always semantic tokens (`--ih-bg`, `--ih-surface`, `--ih-text-primary`) — never hardcode theme colors or any hex in components.
- **Status is never color alone** — pill badge with color + label (+ icon where useful).
- Fixed elements: sticky header (56px, light shadow), sticky bottom CTA on mobile booking (safe-area aware), bottom tab bar, fixed 220px sidebar (dark cerulean #05668D on light theme).

## ICONOGRAPHY

- **No icon font or SVG icon set exists in the sources.** The preview JSX uses **emoji as placeholder icons** (🔬 📍 📅 🏠 🔍 👤 💰 🧪) and simple unicode glyphs (★ ● ✓ ⚠ ✕ ℹ ← ↑) for ratings, alerts, and affordances. The heart mark in the header is the unicode ♥ on a gradient tile — not a real logo.
- **Logo: none provided.** Render the wordmark in type: **Insta** (text-primary) + **Health** (#02C39A), Cairo/Atkinson extrabold 800. `assets/wordmark.html`-style type treatment; do not draw a mark.
- Recommendation for production: a rounded outline icon set (e.g. Lucide via CDN) matches the friendly-professional tone — **flagged as a substitution**, not in the sources. The UI kits here keep the emoji placeholders (ground truth) — swap when a real icon set arrives.

## Component inventory (from `instahealth_design_system.jsx` — the source IS the list)

Buttons (primary/secondary/outline/ghost/destructive/accent × sm/md/lg, loading, disabled, icons) · Inputs (text, search, phone +20, select, textarea, error state) · Cards (provider/branch, booking details, stat, service category) · StatusBadge (confirmed/pending/completed/cancelled) · Chip/pill tags · Alerts (info/success/warning/error) · PreparationNote (cream callout) · SlotPicker (dates + time grid, full/selected states) · BookingSteps (4-step progress) · BottomNav (mobile) · SidebarNav (dashboard).
**Intentional additions:** none.

## Index

- `styles.css` — global entry; imports `tokens/` (fonts, colors, typography, spacing, effects, themes, base).
- `guidelines/` — foundation specimen cards (Design System tab).
- `components/core/` — Button, Input, Select, Textarea, StatusBadge, Chip, Alert, PreparationNote, Card primitives.
- `components/patterns/` — SlotPicker, BookingSteps, BottomNav, SidebarNav.
- `ui_kits/patient-app/` — mobile RTL patient app screens (light).
- `ui_kits/provider-dashboard/` — desktop dashboard (dark).
- `SKILL.md` — agent-skill entry point.
