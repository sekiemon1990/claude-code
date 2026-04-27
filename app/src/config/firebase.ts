import Constants from 'expo-constants';
import { initializeApp, getApps, getApp } from 'firebase/app';
// firebase/auth をトップレベルで import すると、モジュール評価時に
// auth コンポーネントが firebase/app へ自動登録される。
import { initializeAuth, getAuth, inMemoryPersistence } from 'firebase/auth';
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

// 注意:
// - firebase/auth の React Native バンドルは、persistence オプション無しの
//   initializeAuth(app) を呼ぶと "Component auth has not been registered yet"
//   を投げる事象を確認 (build 14 自己診断)。
// - getReactNativePersistence(AsyncStorage) を使うと iOS で Obj-C 例外
//   →アプリクラッシュ (build 6 以前)。
// - 現実解として inMemoryPersistence を渡す。永続化はメモリ内のみで
//   アプリ再起動時には毎回ログインが必要だが、確実に動く。
let auth;
try {
  auth = initializeAuth(app, { persistence: inMemoryPersistence });
} catch {
  // 既に初期化済みの場合は getAuth で既存インスタンスを取得
  auth = getAuth(app);
}

export const firebaseApp = app;
export const firebaseAuth = auth;
export const firestore = getFirestore(app);
export const storage = getStorage(app);

