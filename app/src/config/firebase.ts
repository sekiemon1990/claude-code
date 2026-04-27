import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, { type FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage, { type FirebaseStorageTypes } from '@react-native-firebase/storage';

/**
 * @react-native-firebase は GoogleService-Info.plist (iOS) /
 * google-services.json (Android) を見て自動的に Firebase アプリを
 * 初期化する。明示的な initializeApp は不要。
 *
 * 既存コードからの移行を楽にするため、JS SDK と同じシンボル名で
 * インスタンスをエクスポートする（メソッド名/シグネチャは違うので
 * 各呼び出し側を書き換える必要はある）。
 */
export const firebaseAuth = auth();
export const firestoreDb = firestore();
export const firebaseStorage = storage();

// 型エイリアス（旧 firebase JS SDK の型名と互換）
export type FirebaseUser = FirebaseAuthTypes.User;
export type FirestoreTimestamp = FirebaseFirestoreTypes.Timestamp;
export type StorageReference = FirebaseStorageTypes.Reference;
