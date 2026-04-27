import { Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';

import { firebaseAuth } from '@/config/firebase';
import { logError } from './errorLog';
import { DEMO_MODE } from '@/demo';

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

    await firestore()
      .collection('users')
      .doc(user.uid)
      .set(
        {
          pushToken: token,
          platform: Platform.OS,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return { registered: true };
  } catch (e) {
    void logError('background_failed', e, { feature: 'push_register' });
    return { registered: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
