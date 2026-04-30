import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// 注意: <StatusBar /> (expo-status-bar / RN StatusBar) は iOS 26+ で
// RCTStatusBarManager.setStyle が Scene API と非互換でクラッシュするため、
// 一切使わない。ステータスバーのスタイルは OS デフォルトに任せる。

// === グローバル JS エラーキャプチャ ===
// クラッシュ瞬間の JS エラーメッセージを画面に出すため、ErrorUtils と
// Promise rejection の両方をフックする。
let _globalLastError: { message: string; stack?: string; isFatal: boolean } | null = null;
const _onErrorCallbacks: Array<() => void> = [];

(function installGlobalErrorHandler() {
  // @ts-ignore
  const ErrorUtils = global.ErrorUtils;
  if (!ErrorUtils) return;
  const previousHandler = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    _globalLastError = {
      message: error?.message || String(error),
      stack: error?.stack,
      isFatal: !!isFatal,
    };
    _onErrorCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
    if (previousHandler) {
      try {
        previousHandler(error, isFatal);
      } catch {}
    }
  });
})();

function GlobalErrorBanner() {
  const [, force] = useState(0);
  useEffect(() => {
    const cb = () => force((x) => x + 1);
    _onErrorCallbacks.push(cb);
    return () => {
      const i = _onErrorCallbacks.indexOf(cb);
      if (i >= 0) _onErrorCallbacks.splice(i, 1);
    };
  }, []);
  if (!_globalLastError) return null;
  return (
    <ScrollView
      style={{
        position: 'absolute',
        left: 8,
        right: 8,
        top: 60,
        bottom: 60,
        backgroundColor: '#7f1d1d',
        borderRadius: 8,
        padding: 12,
        zIndex: 9999,
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 6 }}>
        ⚠ JS Error{_globalLastError.isFatal ? ' (FATAL)' : ''}
      </Text>
      <Text style={{ color: '#fee2e2', fontSize: 12, marginBottom: 8 }}>
        {_globalLastError.message}
      </Text>
      {_globalLastError.stack ? (
        <Text style={{ color: '#fecaca', fontSize: 10, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) }}>
          {_globalLastError.stack}
        </Text>
      ) : null}
      <Text
        onPress={() => {
          _globalLastError = null;
          force((x) => x + 1);
        }}
        style={{
          color: '#fff',
          marginTop: 12,
          fontSize: 12,
          textAlign: 'center',
          padding: 8,
          backgroundColor: '#991b1b',
          borderRadius: 6,
        }}
      >
        閉じる
      </Text>
    </ScrollView>
  );
}

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

function AppContent() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppNavigator } = require('@/navigation/AppNavigator');
  return <AppNavigator />;
}

// === 切り分け用: @react-native-firebase の各モジュールが正常にロード/初期化
// できるかを画面で確認する。
type Step = { name: string; ok?: boolean; error?: string };

function FirebaseDiagnostic({ onAllOk }: { onAllOk: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState<string | null>('starting…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const out: Step[] = [];
      const tests: Array<{ name: string; run: () => any }> = [
        {
          name: '@react-native-firebase/app require',
          run: () => require('@react-native-firebase/app'),
        },
        {
          name: '@react-native-firebase/auth require',
          run: () => require('@react-native-firebase/auth'),
        },
        {
          name: '@react-native-firebase/firestore require',
          run: () => require('@react-native-firebase/firestore'),
        },
        {
          name: '@react-native-firebase/storage require',
          run: () => require('@react-native-firebase/storage'),
        },
        {
          name: 'firebase.app() default',
          run: () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const firebase = require('@react-native-firebase/app').default;
            return firebase.app();
          },
        },
        {
          name: 'firebase.app().options (plist が読まれているか)',
          run: () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const firebase = require('@react-native-firebase/app').default;
            const opts = firebase.app().options;
            // bundle ID, projectId 等が入っているはず
            return JSON.stringify({
              projectId: opts.projectId,
              appId: opts.appId,
              apiKey: opts.apiKey ? '***' : 'MISSING',
            });
          },
        },
        {
          name: 'auth() instance 取得',
          run: () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const auth = require('@react-native-firebase/auth').default;
            return typeof auth();
          },
        },
        {
          name: 'firestore() instance 取得',
          run: () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const firestore = require('@react-native-firebase/firestore').default;
            return typeof firestore();
          },
        },
        {
          name: 'storage() instance 取得',
          run: () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const storage = require('@react-native-firebase/storage').default;
            return typeof storage();
          },
        },
      ];
      for (const t of tests) {
        if (cancelled) return;
        setRunning(t.name);
        await sleep(800);
        if (cancelled) return;
        try {
          const result = t.run();
          out.push({ name: t.name, ok: true, error: result ? `=> ${String(result).slice(0, 200)}` : undefined });
        } catch (e) {
          out.push({ name: t.name, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
        setSteps([...out]);
      }
      setRunning(null);
      if (out.every((s) => s.ok)) onAllOk();
    })();
    return () => {
      cancelled = true;
    };
  }, [onAllOk]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a2540' }}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
    >
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
        Firebase 診断
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 16 }}>
        ✗ が出ているステップが原因。クラッシュしたらその直前の「実行中」が原因。
      </Text>
      {running ? (
        <View style={{ backgroundColor: '#1e3a5f', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#fbbf24', fontWeight: '700', fontSize: 12 }}>▶ 実行中</Text>
          <Text style={{ color: '#fff', marginTop: 4 }}>{running}</Text>
        </View>
      ) : null}
      {steps.map((s, i) => (
        <View
          key={i}
          style={{
            backgroundColor: s.ok ? '#0f3052' : '#7f1d1d',
            padding: 8,
            borderRadius: 6,
            marginBottom: 6,
            flexDirection: 'row',
          }}
        >
          <Text style={{ color: s.ok ? '#10b981' : '#fca5a5', fontWeight: '700', marginRight: 8 }}>
            {s.ok ? '✓' : '✗'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{s.name}</Text>
            {s.error ? (
              <Text style={{ color: s.ok ? '#94a3b8' : '#fca5a5', fontSize: 10, marginTop: 2 }}>
                {s.error}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const ENABLE_BACKGROUND_FEATURES = false;
// Firebase 診断は build 27 で全て動作確認済み（storage の require 警告は実害なし）。
// 通常モードへ戻す。
const FIREBASE_DIAGNOSTIC = false;

export default function App() {
  const [diagnosticPassed, setDiagnosticPassed] = useState(false);

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
      })();
    }
    return injectWebTouchFix();
  }, []);

  if (FIREBASE_DIAGNOSTIC && !diagnosticPassed) {
    return (
      <AppErrorBoundary>
        <FirebaseDiagnostic onAllOk={() => setDiagnosticPassed(true)} />
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AppContent />
        <GlobalErrorBanner />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
