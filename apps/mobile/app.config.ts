import type { ConfigContext, ExpoConfig } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'InstaHealth',
  slug: 'instahealth',
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
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#02C39A',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    'expo-font',
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
