import { Platform } from 'react-native';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { firebaseAuth, firestore } from '@/config/firebase';
import { logError } from './errorLog';
import { DEMO_MODE } from '@/demo';

/**
 * プッシュ通知のセットアップ。
 *
 * - 実機ビルド時: expo-notifications で permission を要求し、Expo Push Token を取得し、
 *   Firestore の `users/{uid}` に保存する。
 * - Cloud Functions 側で recordings の status が `completed` に変わったタイミングで、
 *   その uid のトークンに対して通知を送信する。
 * - DEMO/Web では no-op（ブラウザの Notifications API を使う案もあるが、
 *   フォアグラウンドの体験は CompletionToast で代替する）。
 */
export async function registerPushNotifications(): Promise<{
  registered: boolean;
  reason?: string;
}> {
  if (DEMO_MODE || Platform.OS === 'web') {
    return { registered: false, reason: 'skipped in demo/web mode' };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device');

    if (!Device.isDevice) {
      return { registered: false, reason: 'simulator は通知をサポートしていません' };
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') {
      return { registered: false, reason: 'permission denied' };
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync();
    const token: string = tokenResult.data;

    const user = firebaseAuth.currentUser;
    if (!user) return { registered: false, reason: 'not signed in' };

    await setDoc(
      doc(firestore, 'users', user.uid),
      {
        pushToken: token,
        platform: Platform.OS,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { registered: true };
  } catch (e) {
    void logError('background_failed', e, { feature: 'push_register' });
    return { registered: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
