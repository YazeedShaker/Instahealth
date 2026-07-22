# SPEC · SETUP-01 — Monorepo Scaffold

> Hand this to Claude Code. Read `CLAUDE.md` and `PRODUCT.md` first.
> This spec creates the foundation. Nothing else can be built until this is done.
> One PR. All CI gates must pass before merge.

---

## Goal

Stand up the Turborepo monorepo with pnpm workspaces, TypeScript strict config, ESLint, Prettier,
design tokens, and the package structure — with **both** app shells: `apps/mobile` (Expo/React
Native, the primary patient app) and `apps/web` (Next.js, provider dashboard + admin). Each app boots
to a placeholder that proves tokens + fonts + RTL work on its platform. Core package is empty but
structured (filled in CORE-01).

**Mobile-first:** the Expo app is the priority shell. The web app shell is created now but its
features come later (provider dashboard). Both must build in CI.

---

## Prerequisites

- Node 20+, pnpm 9+
- For mobile: Expo CLI (via `pnpm dlx expo`), an Expo account (free) for EAS later
- Supabase `instahealth-dev` already exists (credentials in `.env.local`, not committed)

---

## Deliverables

### 1. Root workspace

```
instahealth/
├── package.json            # root — workspace scripts, turbo
├── pnpm-workspace.yaml     # apps/* and packages/*
├── turbo.json             # pipeline: build, lint, typecheck, test, dev
├── tsconfig.base.json     # strict base config extended everywhere
├── .eslintrc.cjs          # shared, extends typescript-eslint strict (+ next for web, + expo for mobile)
├── .prettierrc            # shared formatting
├── .gitignore             # node_modules, .next, .expo, .env*, coverage, etc.
├── .env.example           # documents every env var (no real values)
└── .nvmrc                 # node 20
```

**`pnpm-workspace.yaml`:**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Root `package.json` scripts:**

```json
{
  "scripts": {
    "dev": "turbo dev",
    "dev:mobile": "turbo dev --filter=@instahealth/mobile",
    "dev:web": "turbo dev --filter=@instahealth/web",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test:unit": "turbo test:unit",
    "test:e2e": "turbo test:e2e",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

**`tsconfig.base.json`** — strict mode ON:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

> `any` is banned via ESLint rule `@typescript-eslint/no-explicit-any: error`.

### 2. Packages (structure only — implementation in later specs)

```
packages/
├── config/                 # shared tsconfig, eslint, prettier presets
│   ├── package.json        # name: @instahealth/config
│   ├── tsconfig.json
│   └── eslint-preset.cjs
├── design-tokens/          # the tokens we already built
│   ├── package.json        # name: @instahealth/design-tokens
│   ├── src/
│   │   ├── tokens.css      # ← copy from our existing design-tokens.css (web)
│   │   ├── tokens.ts       # ← copy from our existing design-tokens.ts (shared values)
│   │   ├── nativewind.ts   # NativeWind theme mapping for the mobile app
│   │   └── index.ts        # re-exports tokens.ts
│   └── tsconfig.json
└── core/                   # shared logic — EMPTY structure for now, filled in CORE-01
    ├── package.json        # name: @instahealth/core
    ├── src/
    │   ├── types/  schemas/  api/  business/  constants/   # (empty — CORE-01)
    │   └── index.ts        # barrel export
    └── tsconfig.json
```

### 3. Mobile app (PRIMARY — `apps/mobile`)

```
apps/mobile/
├── package.json            # name: @instahealth/mobile, deps: @instahealth/core + design-tokens
├── app.config.ts           # Expo config (name, slug, icon, splash, RTL, fonts)
├── eas.json                # EAS Build profiles: development, preview, production
├── tsconfig.json           # extends base, paths to @instahealth/*
├── babel.config.js         # expo + nativewind
├── metro.config.js         # monorepo-aware (watch packages/*)
├── tailwind.config.ts      # NativeWind, imports tokens
├── global.css              # NativeWind directives
├── app/                    # Expo Router
│   ├── _layout.tsx         # root: force RTL (I18nManager), load Cairo+Atkinson, providers
│   └── index.tsx           # placeholder proving tokens/fonts/RTL (see acceptance)
├── components/             # (empty — features add these)
├── lib/
│   └── env.ts              # env access (Expo public env)
└── e2e/
    └── smoke.test.yaml     # Maestro: app launches, placeholder visible, RTL confirmed
```

**Expo essentials:**

- Expo SDK 52+, Expo Router (file-based)
- `app.config.ts`: set `extra.eas`, enable RTL, register fonts (Cairo, Atkinson Hyperlegible via `expo-font`)
- Force RTL at startup: `I18nManager.allowRTL(true); I18nManager.forceRTL(true)`
- NativeWind v4 wired to design tokens (same palette as web)

### 4. Web app (`apps/web` — shells for dashboard/admin, features later)

```
apps/web/
├── package.json            # name: @instahealth/web, deps: @instahealth/core + design-tokens
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts      # imports tailwindExtension from design-tokens
├── postcss.config.mjs
├── playwright.config.ts    # web E2E
├── vitest.config.ts
├── app/
│   ├── layout.tsx          # root layout, fonts, tokens.css
│   ├── page.tsx            # placeholder (redirects to /provider or /admin later)
│   ├── globals.css
│   └── providers.tsx       # TanStack Query provider
├── components/ui/          # (empty — features add these)
├── lib/env.ts              # Zod-validated env
└── e2e/smoke.spec.ts       # Playwright: app boots, placeholder renders
```

### 5. Environment validation

- **Web** (`apps/web/lib/env.ts`): Zod-validated as before (throws on missing/invalid).
- **Mobile** (`apps/mobile/lib/env.ts`): read `expo-constants` / `process.env.EXPO_PUBLIC_*`,
  validate the public keys with Zod. Never put the service role key in the mobile app — ever.

### 6. `.env.example` (documents everything, no real values)

```
# ── Web (apps/web) ──
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never expose to client
NEXT_PUBLIC_GOOGLE_MAPS_KEY=

# ── Mobile (apps/mobile) — EXPO_PUBLIC_ prefix is bundled into the app ──
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=      # anon key only — NEVER the service role key in mobile
EXPO_PUBLIC_GOOGLE_MAPS_KEY=

# ── Shared server-side (Edge Functions / API routes) ──
PAYMOB_API_KEY=                     # added at F05
PAYMOB_HMAC_SECRET=
VONAGE_API_KEY=                     # SMS — added at F01
VONAGE_API_SECRET=
VONAGE_FROM=InstaHealth

# ── Analytics (added later) ──
NEXT_PUBLIC_POSTHOG_KEY=
EXPO_PUBLIC_POSTHOG_KEY=
POSTHOG_HOST=
```

> **Critical:** the mobile app bundles anything with `EXPO_PUBLIC_`. The service role key must NEVER
> have that prefix and must NEVER appear in `apps/mobile`. CI enforces this.

### 7. Turborepo pipeline (`turbo.json`)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**", ".expo/**"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test:unit": { "dependsOn": ["^build"] },
    "test:e2e": { "dependsOn": ["build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

> Mobile `build` in CI means: typecheck + `expo prebuild` succeeds + Metro bundles. Full native
> binaries are built by EAS on demand, not in the standard CI job (see SETUP-02).

---

## Acceptance criteria

- [ ] `pnpm install` succeeds from a clean clone
- [ ] `pnpm dev:mobile` boots the Expo app (Expo Go or dev build) on a device/simulator
- [ ] `pnpm dev:web` boots the Next.js app on localhost
- [ ] `pnpm build` builds all packages, the web app, and bundles the mobile app clean
- [ ] `pnpm lint` passes with zero warnings across all workspaces
- [ ] `pnpm typecheck` passes in strict mode with no `any`
- [ ] **Mobile placeholder** (`apps/mobile/app/index.tsx`) demonstrates ALL of:
  - [ ] App is forced **RTL** via `I18nManager` (layout flows right-to-left)
  - [ ] Arabic heading in **Cairo** (e.g. "إنستاهيلث — منصة الحجوزات الطبية")
  - [ ] An English subtitle in **Atkinson Hyperlegible**
  - [ ] A primary button using the **teal token** (`#02C39A` via token, not hardcoded)
  - [ ] A cream accent element (`#F0F3BD` via token)
  - [ ] Colors come from shared tokens (NativeWind theme), not hardcoded hex
- [ ] **Web placeholder** demonstrates: renders, Cairo + Atkinson fonts load, teal + cream via tokens
- [ ] `@instahealth/core` and `@instahealth/design-tokens` import cleanly from BOTH apps
- [ ] Env validation throws clearly if a required var is missing (both apps)
- [ ] Mobile Maestro smoke passes: app launches, placeholder visible, RTL confirmed
- [ ] Web Playwright smoke passes: app boots, placeholder visible
- [ ] All CI gates green (lint, typecheck, unit, build, e2e, security)

---

## Test requirements

- **Mobile `e2e/smoke.test.yaml` (Maestro)** — launches the app, asserts the placeholder renders,
  asserts the Arabic heading is visible. (RTL is forced at startup; verify layout visually in the flow.)
- **Web `e2e/smoke.spec.ts` (Playwright)** — navigates to `/`, asserts the page renders and the
  Arabic heading text is visible.
- **Unit:** `packages/design-tokens` — a trivial test importing a token and asserting its value
  (proves the package resolves and exports correctly for both consumers).

---

## Notes for the implementer

- Copy the existing `design-tokens.css` and `design-tokens.ts` we already built into
  `packages/design-tokens/src/`. Add `nativewind.ts` mapping the same palette to a NativeWind theme.
  Don't invent new colors — same tokens, two consumers.
- **Mobile is the priority shell.** Get the Expo app booting with RTL + fonts + tokens first; the web
  placeholder can be minimal (it becomes the dashboard later).
- Do NOT build any feature UI here. Scaffold only. Screens/components arrive with features.
- Keep `packages/core` empty but structured — CORE-01 fills it.
- Each placeholder's only job is to PROVE the foundation works — tokens, fonts, RTL, cross-package imports.
- Metro must be monorepo-aware (watch `packages/*`) or the mobile app won't resolve `@instahealth/core`.
- Commit `.env.example`, never `.env.local`.
- The service role key must not exist anywhere under `apps/mobile`. Ever.

---

## When done

Update `PROGRESS.md`:

- Move SETUP-01 from "Next up" to "Shipped" with date + what was built + any decisions
- Note the exact Node/pnpm/Next versions locked in
- Flag anything the next spec (SETUP-02 / CORE-01) needs to know
