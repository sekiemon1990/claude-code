import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === 'true';

const required = (name: string): string => {
  const v = process.env[name];
  if (!v && !DEMO_MODE) {
    // 欠損を silent に空にせず、ビルド時に気付けるよう警告
    console.warn(`[app.config] ${name} is not set. Did you copy .env.example to .env?`);
  }
  return v ?? '';
};

const config: ExpoConfig = {
  name: '出張買取 録音',
  slug: 'sales-recording-app',
  version: '0.1.0',
  scheme: 'makxasrec',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a2540',
  },
  assetBundlePatterns: ['**/*'],
  web: {
    bundler: 'metro',
  },
  // 新アーキテクチャ（Fabric/TurboModules）は SDK 55 でデフォルト有効だが、
  // 一部のサードパーティ依存がまだ完全対応しておらずフリーズする現象が出るため
  // 一旦無効化。安定してから true に戻す。
  newArchEnabled: false,
  experiments: {
    // GitHub Pages の `https://<user>.github.io/claude-code/demo/` 配下に
    // 配信するためのベースパス。DEMO ビルド時のみ影響する。
    baseUrl: DEMO_MODE ? '/claude-code/demo' : undefined,
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.makxas.salesrecording',
    infoPlist: {
      NSMicrophoneUsageDescription:
        '商談の録音に使用します。お客様の同意を得た上で録音してください。',
      UIBackgroundModes: ['audio', 'fetch', 'processing'],
      BGTaskSchedulerPermittedIdentifiers: ['com.makxas.salesrecording.upload'],
    },
  },
  android: {
    package: 'com.makxas.salesrecording',
    permissions: [
      'RECORD_AUDIO',
      'MODIFY_AUDIO_SETTINGS',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_MICROPHONE',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a2540',
    },
  },
  plugins: [
    [
      'expo-audio',
      {
        microphonePermission:
          '商談の録音のためにマイクへのアクセスを許可してください。',
      },
    ],
  ],
  extra: {
    demoMode: DEMO_MODE,
    firebaseApiKey: required('FIREBASE_API_KEY'),
    firebaseAuthDomain: required('FIREBASE_AUTH_DOMAIN'),
    firebaseProjectId: required('FIREBASE_PROJECT_ID'),
    firebaseStorageBucket: required('FIREBASE_STORAGE_BUCKET'),
    firebaseMessagingSenderId: required('FIREBASE_MESSAGING_SENDER_ID'),
    firebaseAppId: required('FIREBASE_APP_ID'),
    googleWebClientId: required('GOOGLE_WEB_CLIENT_ID'),
    googleIosClientId: required('GOOGLE_IOS_CLIENT_ID'),
    googleAndroidClientId: required('GOOGLE_ANDROID_CLIENT_ID'),
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
};

export default config;
