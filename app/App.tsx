import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Background task の TaskManager.defineTask をモジュールロード時に呼ぶため、
// ここで import するだけで副作用として定義される
import '@/services/backgroundTask';

import { AppNavigator } from '@/navigation/AppNavigator';
import { registerBackgroundUploadTask } from '@/services/backgroundTask';
import { registerPushNotifications } from '@/services/notifications';

/**
 * iOS Safari / Android Chrome の Web ビルド向けに、単指スクロールが
 * Pressable に吸われずに動くよう touch-action を強制する。
 *
 * 症状: ScrollView の中に Pressable（案件カード等）がいると、単指タッチが
 *       Pressable のタップ判定に持っていかれて、ドラッグしても画面が
 *       スクロールしない（2本指スクロール=ピンチではなんとか動く）。
 * 対処: スクロール可能領域に touch-action: pan-y を強制し、ブラウザに
 *       「ここは縦パンが優先」と早めに判定させる。タップは引き続き有効。
 */
function injectWebTouchFix() {
  if (Platform.OS !== 'web') return () => {};
  if (typeof document === 'undefined') return () => {};
  const style = document.createElement('style');
  style.id = 'rn-touch-action-fix';
  style.textContent = `
    /* iOS Safari の単指スクロール改善:
       react-native-web の Pressable は touch-action: manipulation を付けるため、
       単指タッチが Pressable に吸われて親 ScrollView の縦スクロールが
       開始されない症状が出る。全要素に touch-action: pan-y を強制し、
       「単指の縦移動は常にパンとして扱う」ことを明示。タップ判定は維持される。 */
    * {
      touch-action: pan-y !important;
      -webkit-tap-highlight-color: transparent;
    }
    /* スクロール領域の慣性スクロール / オーバースクロール挙動を健全に */
    html, body {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-y: contain;
    }
  `;
  document.head.appendChild(style);
  return () => {
    document.getElementById('rn-touch-action-fix')?.remove();
  };
}

export default function App() {
  useEffect(() => {
    // 起動時にバックグラウンドアップロードタスクとプッシュ通知を登録
    void registerBackgroundUploadTask();
    void registerPushNotifications();
    return injectWebTouchFix();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
