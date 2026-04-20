import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) {
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
      'expo-av',
      {
        microphonePermission:
          '商談の録音のためにマイクへのアクセスを許可してください。',
      },
    ],
  ],
  extra: {
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
