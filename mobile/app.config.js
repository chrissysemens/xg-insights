import { version } from 'react';

export default ({ config }) => {
  const storybookEnabled = process.env.EXPO_PUBLIC_STORYBOOK_ENABLED === 'true';

  return {
    ...config,

    name: 'xG Insights',
    slug: 'footyboostmachine',
    scheme: 'xginsights',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    owner: 'chrissysemens',

    icon: './assets/icon.png',

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    extra: {
      eas: {
        projectId: '1bb1f767-14d1-45fd-a7d1-84a368dd056e',
      },
    },
    ios: {
      bundleIdentifier: 'com.chrissysemens.footyboostmachine',
      supportsTablet: true,
      buildNumber: '2',
    },

    android: {
      package: 'com.chrissysemens.footyboostmachine',
      versionCode: 2,
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },

    web: {
      favicon: './assets/favicon.png',
    },

    plugins: [
      'expo-dev-client',
      ['expo-router', storybookEnabled ? { root: './src/storybook-app' } : {}],
      'expo-localization',
      '@react-native-community/datetimepicker',
    ],
  };
};
