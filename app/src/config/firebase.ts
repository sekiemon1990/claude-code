import Constants from 'expo-constants';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const extra = Constants.expoConfig?.extra ?? {};

// DEMO モード時は設定値が空でもクラッシュしないようダミーで埋める
const demoMode = !!extra.demoMode;
const firebaseConfig = {
  apiKey: (extra.firebaseApiKey as string) || (demoMode ? 'demo-api-key' : ''),
  authDomain: (extra.firebaseAuthDomain as string) || 'demo.firebaseapp.com',
  projectId: (extra.firebaseProjectId as string) || 'demo-project',
  storageBucket: (extra.firebaseStorageBucket as string) || 'demo-project.appspot.com',
  messagingSenderId: (extra.firebaseMessagingSenderId as string) || '000000000000',
  appId: (extra.firebaseAppId as string) || '1:000000000000:web:demo',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export const firebaseApp = app;
export const firebaseAuth = auth;
export const firestore = getFirestore(app);
export const storage = getStorage(app);
