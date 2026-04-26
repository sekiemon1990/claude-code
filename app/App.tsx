import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Background task の TaskManager.defineTask をモジュールロード時に呼ぶため、
// ここで import するだけで副作用として定義される
import '@/services/backgroundTask';

import { AppNavigator } from '@/navigation/AppNavigator';
import { registerBackgroundUploadTask } from '@/services/backgroundTask';
import { registerPushNotifications } from '@/services/notifications';

export default function App() {
  useEffect(() => {
    // 起動時にバックグラウンドアップロードタスクとプッシュ通知を登録
    void registerBackgroundUploadTask();
    void registerPushNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
