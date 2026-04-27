import React, { useEffect } from 'react';
import { Platform, ScrollView, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * トップレベルのエラーバウンダリ。React のレンダリング中に例外が出た場合、
 * 真っ黒な画面で止まる代わりに何が起きたかを表示する。
 */
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView
          style={{ flex: 1, backgroundColor: '#fff' }}
          contentContainerStyle={{ padding: 24, paddingTop: 64 }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#DC2626' }}>
            起動エラー
          </Text>
          <Text style={{ color: '#0F172A', marginBottom: 12 }}>
            {this.state.error.message || String(this.state.error)}
          </Text>
          {this.state.error.stack ? (
            <Text style={{ color: '#64748B', fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) }}>
              {this.state.error.stack}
            </Text>
          ) : null}
        </ScrollView>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

/**
 * iOS Safari / Android Chrome の Web ビルド向けに、単指スクロールが
 * Pressable に吸われずに動くよう touch-action を強制する。
 */
function injectWebTouchFix() {
  if (Platform.OS !== 'web') return () => {};
  if (typeof document === 'undefined') return () => {};
  const style = document.createElement('style');
  style.id = 'rn-touch-action-fix';
  style.textContent = `
    * {
      touch-action: pan-y !important;
      -webkit-tap-highlight-color: transparent;
    }
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

// AppNavigator は遅延ロードする。AppNavigator の中で読み込まれるモジュールが
// 万一例外を投げても、その瞬間の AppErrorBoundary で捕まえて画面に出せるよう。
function AppContent() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppNavigator } = require('@/navigation/AppNavigator');
  return <AppNavigator />;
}

// バックグラウンドアップロードとプッシュ通知の登録は安定後に再有効化する。
const ENABLE_BACKGROUND_FEATURES = false;

export default function App() {
  useEffect(() => {
    if (ENABLE_BACKGROUND_FEATURES) {
      (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { registerBackgroundUploadTask } = require('@/services/backgroundTask');
          await registerBackgroundUploadTask();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[App] registerBackgroundUploadTask failed:', err);
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { registerPushNotifications } = require('@/services/notifications');
          await registerPushNotifications();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[App] registerPushNotifications failed:', err);
        }
      })();
    }
    return injectWebTouchFix();
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <AppContent />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
