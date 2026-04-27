import Constants from 'expo-constants';
import { initializeApp, getApps, getApp } from 'firebase/app';
// firebase/auth をトップレベルで import すると、モジュール評価時に
// auth コンポーネントが firebase/app へ自動登録される。これが無いと
// 後の getAuth() で "Component auth has not been registered yet" になる。
import { initializeAuth, getAuth } from 'firebase/auth';
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
// - getAuth(app) は tree-shaking 等で auth コンポーネントが
//   firebase/app に登録されていない状況で "Component auth has not
//   been registered yet" を投げる。
// - initializeAuth(app) は明示的に Auth を作成・登録するため確実。
// - 永続化オプション (getReactNativePersistence) は iOS で Obj-C 例外
//   を投げる事象があるため一旦付けない。アプリ再起動で再ログインが必要。
let auth;
try {
  auth = initializeAuth(app);
} catch {
  // すでに初期化済みの場合は getAuth で既存インスタンスを取得
  auth = getAuth(app);
}

export const firebaseApp = app;
export const firebaseAuth = auth;
export const firestore = getFirestore(app);
export const storage = getStorage(app);
