import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { FirebaseStorageTypes } from '@react-native-firebase/storage';

/**
 * @react-native-firebase は GoogleService-Info.plist (iOS) /
 * google-services.json (Android) を見て自動的に Firebase アプリを
 * 初期化する。明示的な initializeApp は不要。
 *
 * ただしモジュール読み込み時に auth() / firestore() / storage() を
 * 同期的に呼ぶと、Firebase ネイティブ初期化が失敗している場合 (plist
 * 不在 / bundle ID 不一致 等) に Obj-C 例外で即クラッシュする。
 * → 全てを「最初に使われた瞬間」まで遅延化する。
 */

let _auth: FirebaseAuthTypes.Module | null = null;
let _firestore: FirebaseFirestoreTypes.Module | null = null;
let _storage: FirebaseStorageTypes.Module | null = null;

export function getFirebaseAuth(): FirebaseAuthTypes.Module {
  if (_auth) return _auth;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const auth = require('@react-native-firebase/auth').default;
  _auth = auth();
  return _auth!;
}

export function getFirebaseFirestore(): FirebaseFirestoreTypes.Module {
  if (_firestore) return _firestore;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const firestore = require('@react-native-firebase/firestore').default;
  _firestore = firestore();
  return _firestore!;
}

export function getFirebaseStorage(): FirebaseStorageTypes.Module {
  if (_storage) return _storage;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const storage = require('@react-native-firebase/storage').default;
  _storage = storage();
  return _storage!;
}

// 既存コードの `import { firebaseAuth } from '@/config/firebase'` 互換のため
// Proxy で「初回プロパティアクセス時に初期化」する。
function lazy<T extends object>(getter: () => T): T {
  return new Proxy(
    {},
    {
      get(_t, p) {
        const v = getter() as any;
        const out = v[p];
        return typeof out === 'function' ? out.bind(v) : out;
      },
      set(_t, p, val) {
        const v = getter() as any;
        v[p] = val;
        return true;
      },
      has(_t, p) {
        return p in (getter() as any);
      },
    },
  ) as T;
}

export const firebaseAuth = lazy(getFirebaseAuth);
export const firestoreDb = lazy(getFirebaseFirestore);
export const firebaseStorage = lazy(getFirebaseStorage);

export type FirebaseUser = FirebaseAuthTypes.User;
export type FirestoreTimestamp = FirebaseFirestoreTypes.Timestamp;
export type StorageReference = FirebaseStorageTypes.Reference;
