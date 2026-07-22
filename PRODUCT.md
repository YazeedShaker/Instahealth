# PRODUCT.md — InstaHealth Design & Product Guidelines

> Design decisions, accessibility rules, and UX principles for the entire platform.
> Read alongside CLAUDE.md. This governs everything visual and interactive.
> When a design choice isn't specified here, follow the spirit: clarity, trust, accessibility.

---

## 1. Product principles

1. **Trust before delight.** This is healthcare. A patient handing over money to book a blood test
   needs to feel safe, not entertained. Clean, calm, professional. No gimmicks.
2. **Arabic-first, always.** Not a translation of an English app — an Arabic app. RTL is the
   default, Cairo is the default font, Arabic copy is written first.
3. **Mobile-first, truly.** The patient app is a **native mobile app** (React Native + Expo) — that
   is the product. Most users are on mid-range Android phones on 4G. Design for the phone screen
   first and only. Every patient feature must work one-handed, on a real device, in Arabic RTL. The
   web surfaces (provider dashboard, admin) are separate desktop tools, designed for their own context.
4. **Speed is a feature.** A patient comparing us to "just calling the lab" will leave if we're
   slow. Sub-3-second loads on 4G. Skeleton loaders, never blank screens.
5. **Every state is designed.** Loading, empty, error, success. "Something went wrong" in English
   on a dark screen is a bug, not an edge case.

---

## 2. Brand & color system

Palette (from Coolors — the InstaHealth brand):

| Token         | Hex                       | Role                                          |
| ------------- | ------------------------- | --------------------------------------------- |
| `primary-400` | `#02C39A` Caribbean Green | **Primary CTA, links, active states**         |
| `primary-500` | `#00A896` Persian Green   | Hover states, secondary                       |
| `primary-600` | `#028090` Cerulean        | Secondary actions, info                       |
| `primary-700` | `#05668D` Dark Cerulean   | Sidebar, headers, deep anchor                 |
| `accent-300`  | `#F0F3BD` Cream           | Highlights, warm tags, **the differentiator** |

Neutrals: cool-gray scale (`neutral-0` white → `neutral-950` near-black).
Semantic: success `#02C39A`, warning `#D97706`, error `#DC2626`, info `#028090`.
Booking status: confirmed (green), pending (amber), completed (gray), cancelled (red).

**Why cream matters:** every other Egyptian health app is blue-on-white. The `#F0F3BD` cream accent
is our visual signature — used for preparation notes, warm highlights, accent buttons. Use it
deliberately and sparingly; it loses power if overused.

Tokens live in `packages/design-tokens` as both CSS custom properties (`--ih-*`) and TS constants.
**Never hardcode a hex value in a component.** Always reference a token.

---

## 3. Contrast & accessibility rules (WCAG 2.1 AA — enforced)

This is a health app used by older patients and people with visual impairments. Accessibility is
not optional. We chose **Atkinson Hyperlegible** (Braille Institute font) specifically for this.

**Contrast minimums (AA):**

- **Normal text (< 18px):** contrast ratio **≥ 4.5:1** against its background
- **Large text (≥ 18px bold or ≥ 24px):** contrast ratio **≥ 3:1**
- **UI components & focus indicators:** **≥ 3:1** against adjacent colors
- **Never** put `primary-400` (#02C39A) text on white for body copy — it fails at 2.1:1.
  Use `primary-600`/`primary-700` for text on light. `primary-400` is for fills and large elements.

**Contrast enforcement:**

- The cream `#F0F3BD` is a background/accent only — text on cream must be `primary-700` or darker.
- White text requires a background darker than `neutral-600`.
- Test every text/background pairing. When unsure, run it through a contrast checker.

**Beyond contrast:**

- **Touch targets ≥ 44×44px.** Every button, link, tappable slot. No exceptions on mobile.
- **Focus visible:** every interactive element has a visible focus ring (`--ih-border-focus`,
  2px, offset 2px). Never `outline: none` without a replacement.
- **Semantic HTML:** real `<button>`, `<nav>`, `<main>`, headings in order. Screen readers depend on it.
- **Labels:** every input has an associated `<label>`. Icon-only buttons have `aria-label`.
- **Motion:** respect `prefers-reduced-motion`. Animations are enhancement, never required to use the app.
- **Don't rely on color alone:** status uses color + text/icon (a colorblind user must distinguish
  confirmed from cancelled without seeing green vs red).

---

## 4. Typography rules

- **Arabic:** Cairo. Weights 300–800 available. Body 400, emphasis 600, headings 700–800.
- **English:** Atkinson Hyperlegible. Weights 400 and 700 only.
- **Base size 16px.** Never below 12px for any readable text. Body copy 16px on mobile.
- **Line height:** 1.5 for body, 1.2 for headings. Arabic needs slightly more (1.6 body) for
  diacritic clearance.
- **Line length:** max ~70 characters for readable paragraphs.
- Font switches automatically with `dir` — `[dir="rtl"]` → Cairo, `[dir="ltr"]` → Atkinson.

---

## 5. Layout & spacing

- **4px base grid.** All spacing is a multiple of 4 (use `--ih-space-*` tokens).
- **Mobile (patient app):** design for phone screens (~360–430px range). Native navigation.
- **Web (dashboard/admin):** desktop-first layouts; responsive down to tablet.
- **Sticky primary CTA** on mobile booking screens (the "Book Now" / "Continue" button stays reachable
  with the thumb, respecting the safe area).
- **Bottom tab nav** for the patient app (Home, Search, Bookings, Profile) — thumb-reachable, native.
- **Safe areas:** respect iOS notch / Android gesture bar and status bar via `SafeAreaView` /
  `env(safe-area-inset-*)`.
- **Touch-friendly by default:** the native app should feel native — momentum scroll, native
  transitions, haptic feedback on key actions (booking confirmed).

---

## 6. Component behavior standards

- **Buttons:** primary (teal fill), secondary (cerulean), outline, ghost, destructive (red), accent
  (cream). Loading state shows a spinner and disables. Disabled is 45% opacity + `not-allowed`.
- **Inputs:** 1.5px border, focus turns border teal. Error state = red border + red helper text +
  icon. Never rely on red alone — always red + message.
- **Cards:** subtle shadow (`--ih-shadow-sm`), 12px radius, never a hard border alone on white.
- **Slot picker:** available slots tappable, full slots disabled + marked, selected slot filled teal.
  Held slot shows a live countdown timer (turns red under 2 min).
- **Status badges:** pill shape, color + label always together.
- **Toasts:** for transient feedback (booking confirmed, error). Auto-dismiss success, persist errors.
- **Modals:** for confirmation of destructive actions (cancel booking). Always have a clear "back out."

---

## 7. Booking flow UX (the core experience)

The booking flow is the heart of the product. It must feel effortless.

1. **Discovery** — patient sees nearby providers on a map + list. Distance, rating, open/closed,
   first available slot shown upfront.
2. **Branch profile** — services with clear EGP prices, preparation notes (fasting etc.), reviews.
3. **Select services** — checkbox list, running total always visible.
4. **Pick slot** — calendar (14–30 days), available times. Selecting starts a **10-minute hold**
   with a visible countdown. This urgency is honest, not manufactured — the slot really is held.
5. **Details** — name pre-filled, phone confirmed, optional notes.
6. **Pay** — Paymob inline (card), Fawry (reference code), or cash-at-branch. Order summary before paying.
7. **Confirmation** — booking ref (`IH-2026-XXXXX`), all details, preparation reminder, SMS sent,
   add-to-calendar. This screen must feel like relief and certainty.

**Preparation notes are critical in Egypt** — many patients don't know fasting rules. Surface them
prominently at selection, confirmation, and in the reminder SMS. Use the cream accent for these.

---

## 8. Content & tone

- **Arabic copy is warm, clear, respectful.** Not clinical, not childish. "احجز الآن" not jargon.
- **Never alarm.** Medical context is anxious enough. Calm, reassuring microcopy.
- **Errors are helpful, not blaming.** "لم نتمكن من تأكيد الدفع. حاول مرة أخرى أو ادفع عند الوصول."
  — offer the next action, never a dead end.
- **Numbers:** support both Arabic and Western numerals. Prices always with "EGP" / "ج.م".
- **No medical advice.** We facilitate booking. We never diagnose, recommend treatments, or interpret
  results. Copy must never cross into practicing medicine.

---

## 9. Dark mode

- **Patient app:** light theme default. Dark mode is a nice-to-have (Phase 2+), not MVP.
- **Provider dashboard & admin:** dark theme is the default (they stare at it all day; easier on eyes).
- Both themes defined in tokens. Never hardcode theme colors — use semantic tokens
  (`--ih-bg`, `--ih-surface`, `--ih-text-primary`) that flip with theme.

---

## 10. Performance budget

**Mobile patient app (native):**

- **Cold start < 2s** to interactive on a mid-range Android device.
- **60fps** scrolling and transitions — no jank on branch lists or slot pickers.
- **Optimistic UI** where safe (e.g. selecting a slot feels instant while the hold is created).
- **Offline resilience:** cache last-seen data (TanStack Query persistence) so the app opens to
  content, not a spinner, on flaky 4G. Booking actions require connectivity and say so clearly.
- **Image optimization:** Supabase image transforms, lazy-load below the fold, cache aggressively.
- **Bundle discipline:** keep the JS bundle lean; lazy-load heavy screens (maps) via Expo Router.

**Web (dashboard/admin, later patient PWA):**

- FCP < 1.8s, LCP < 2.5s on 4G. Branch profile pages (patient PWA) server-rendered for SEO.
- No layout shift (CLS < 0.1). First-load JS < 200KB gzipped for the patient PWA entry.

---

## 11. What we explicitly do NOT do (product guardrails)

- We do not show a provider's full schedule — only OUR allocated slots (see CLAUDE.md §1).
- We do not store medical records in MVP (Phase 3 — with proper compliance).
- We do not give medical advice or symptom diagnosis in MVP (Phase 3 AI assistant, carefully scoped).
- We do not do real-time CRM integration — the dedicated-slot model avoids it.
- We do not display another patient's data, ever — RLS + UI both enforce this.

---

_Last updated: July 2026 · This document evolves with the product. Update it when a design decision is made so the reasoning is never lost._
