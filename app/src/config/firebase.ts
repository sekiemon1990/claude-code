import Constants from 'expo-constants';

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

// 完全遅延初期化。モジュール読み込み時には Firebase API を一切呼ばない。
// iOS 実機で Firebase 初期化がネイティブブリッジ越しに Obj-C 例外を投げる
// 事象を踏まえ、最初に必要になった瞬間まで初期化を遅らせる。
let _app: unknown = null;
let _auth: unknown = null;
let _firestore: unknown = null;
let _storage: unknown = null;

function _getApp() {
  if (_app) return _app;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initializeApp, getApps, getApp } = require('firebase/app');
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return _app;
}

export function getFirebaseApp() {
  return _getApp();
}

export function getFirebaseAuth() {
  if (_auth) return _auth;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getAuth } = require('firebase/auth');
  _auth = getAuth(_getApp());
  return _auth;
}

export function getFirebaseFirestore() {
  if (_firestore) return _firestore;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getFirestore } = require('firebase/firestore');
  _firestore = getFirestore(_getApp());
  return _firestore;
}

export function getFirebaseStorage() {
  if (_storage) return _storage;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getStorage } = require('firebase/storage');
  _storage = getStorage(_getApp());
  return _storage;
}

// 既存コードの `import { firebaseAuth } from '@/config/firebase'` 等を
// 動かし続けるため、Proxy で「初回プロパティアクセス時に初期化」する
// オブジェクトをエクスポートする。
function lazy(getter: () => any) {
  return new Proxy(
    {},
    {
      get(_t, p) {
        const v = getter();
        const out = (v as any)[p];
        return typeof out === 'function' ? out.bind(v) : out;
      },
      set(_t, p, val) {
        const v = getter();
        (v as any)[p] = val;
        return true;
      },
      has(_t, p) {
        return p in (getter() as any);
      },
    },
  );
}

export const firebaseApp = lazy(getFirebaseApp);
export const firebaseAuth = lazy(getFirebaseAuth);
export const firestore = lazy(getFirebaseFirestore);
export const storage = lazy(getFirebaseStorage);
