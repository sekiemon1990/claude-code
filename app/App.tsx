import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Background task の TaskManager.defineTask をモジュールロード時に呼ぶため、
// ここで import するだけで副作用として定義される
import '@/services/backgroundTask';

import { AppNavigator } from '@/navigation/AppNavigator';
import { registerBackgroundUploadTask } from '@/services/backgroundTask';

export default function App() {
  useEffect(() => {
    // 起動時にバックグラウンドアップロードタスクを登録
    void registerBackgroundUploadTask();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
