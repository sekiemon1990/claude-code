import Constants from 'expo-constants';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

// 注意: 以前は initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
// を使っていたが、iOS 実機ビルドで AsyncStorage のネイティブブリッジ越しに
// Obj-C 例外が出てアプリが起動直後にクラッシュする事象を確認したため、
// 永続化なしの getAuth(app) に切り替えた。
// → 副作用としてアプリ再起動時にログインが必要になる（セッションが揮発する）。
//   これは安定後に initializeAuth + 公式の RN 永続化に戻す。
const auth = getAuth(app);

export const firebaseApp = app;
export const firebaseAuth = auth;
export const firestore = getFirestore(app);
export const storage = getStorage(app);
