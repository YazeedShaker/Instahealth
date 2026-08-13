import type { ConfigContext, ExpoConfig } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'InstaHealth',
  slug: 'instahealth',
  owner: 'instahealth',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'instahealth',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.instahealth.app',
  },
  android: {
    package: 'com.instahealth.app',
    adaptiveIcon: {
      // ⚠ Brand teal, not white. `backgroundImage` wins when both are set, but
      // this is the fallback a launcher uses if the image cannot be decoded —
      // and white would put a WHITE ring on a WHITE field, i.e. an invisible
      // icon. `#028090` is the bundle's app-icon field colour.
      backgroundColor: '#028090',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    // SPA mode — no static/server rendering. The patient web experience is
    // Next.js's job later (CLAUDE.md §3); Expo's web target only needs to not
    // crash. 'static' pre-renders in Node where `window` doesn't exist.
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        // ⚠ `#028090`, not the mint `#02C39A`. The bundle's splash specimen is
        // `LogoStacked tone="white"` on `#028090`, and the white lockup is what
        // `splash-icon.png` now contains — the mint field was left over from the
        // scaffold and would put a white-on-mint lockup at 1.9:1.
        backgroundColor: '#028090',
        image: './assets/images/splash-icon.png',
        // ⚠ INVENTED, AND FLAGGED. The bundle routes splash to LogoStacked but
        // states NO size, no safe area and no dark variant — see BRAND.md's
        // "what the bundle does not specify". 320 renders the lockup at roughly
        // 160pt on a phone, which clears the 56px stacked minimum with room to
        // spare. ⚠ ONLY A DEV BUILD CAN CONFIRM THIS VISUALLY — Expo Go shows
        // its own splash, never the app's.
        imageWidth: 320,
      },
    ],
    'expo-font',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'نستخدم موقعك لعرض أقرب المراكز الطبية إليك.',
      },
    ],
    // Expo Go carries its own permission strings, so "أضف إلى التقويم" appears
    // to work there without this entry — but WITHOUT it a dev build or a store
    // build ships no NSCalendars*UsageDescription and no Android
    // READ/WRITE_CALENDAR, and the feature dies on first use. The plugin sets
    // both the legacy and the iOS 17+ full-access keys.
    [
      'expo-calendar',
      {
        calendarPermission: 'نضيف موعد حجزك إلى تقويمك حتى لا تفوته.',
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
  },
  extra: {
    // Arabic-first: native RTL support flag; runtime forcing happens in app/_layout.tsx
    supportsRTL: true,
    eas: {
      projectId: '52149366-c84d-4ec9-9c6a-6c8ed6b08ec4',
    },
  },
})
