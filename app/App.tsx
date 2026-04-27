import React, { useEffect } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * トップレベルのエラーバウンダリ。React のレンダリング中に例外が出た場合、
 * 真っ黒な画面で止まる代わりに何が起きたかを表示する。
 *
 * iOS のスプラッシュ画面（ネイビー）が消えない症状はだいたいこのレベルで
 * 例外が出ているケース。バウンダリで救えれば原因が画面に出る。
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

// AppNavigator は遅延ロードする。`navigation/AppNavigator` の中で読み込まれる
// firebase などが万一例外を投げても、その瞬間の AppErrorBoundary で捕まえて
// 画面に出せるようにするため。
function AppContent() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppNavigator } = require('@/navigation/AppNavigator');
  return <AppNavigator />;
}

// === 起動切り分け用ミニマムモード ===
// クラッシュログが取れずに原因特定が進まない状況のため、
// 一旦 AppNavigator / firebase / react-native-screens などを
// 全てバイパスして「React Native だけは動く」かを確認する画面。
// 起動できたら原因はこれらの依存にある。逆にこれでも落ちるなら
// もっと根本（RN 0.79 のネイティブモジュール / プロビジョニング等）。
const SAFE_MODE = true;
// 自己診断モード: 各依存モジュールを順に require してどれが落ちるか特定する
const SELF_TEST = true;

type TestResult = { name: string; ok: boolean; error?: string };

function runSelfTests(): TestResult[] {
  const results: TestResult[] = [];
  function probe(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (e) {
      results.push({
        name,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 1. ナビゲーション系
  probe('react-native-safe-area-context', () => {
    require('react-native-safe-area-context');
  });
  probe('react-native-screens', () => {
    require('react-native-screens');
  });
  probe('@react-navigation/native', () => {
    require('@react-navigation/native');
  });
  probe('@react-navigation/native-stack', () => {
    require('@react-navigation/native-stack');
  });

  // 2. ストレージ
  probe('@react-native-async-storage/async-storage', () => {
    require('@react-native-async-storage/async-storage');
  });

  // 3. Firebase
  probe('firebase/app require', () => {
    require('firebase/app');
  });
  probe('firebase/auth require', () => {
    require('firebase/auth');
  });
  probe('firebase/firestore require', () => {
    require('firebase/firestore');
  });
  probe('firebase/storage require', () => {
    require('firebase/storage');
  });

  // 4. Firebase 初期化（最も怪しい）
  probe('firebase config init (initializeApp + initializeAuth)', () => {
    require('@/config/firebase');
  });

  // 5. Google Sign-in
  probe('expo-auth-session/providers/google', () => {
    require('expo-auth-session/providers/google');
  });
  probe('expo-web-browser', () => {
    require('expo-web-browser');
  });

  // 6. その他
  probe('expo-constants', () => {
    require('expo-constants');
  });
  probe('expo-linking', () => {
    require('expo-linking');
  });
  probe('expo-file-system', () => {
    require('expo-file-system');
  });
  probe('expo-clipboard', () => {
    require('expo-clipboard');
  });
  probe('@react-native-community/netinfo', () => {
    require('@react-native-community/netinfo');
  });

  return results;
}

function SelfTestScreen() {
  const [results, setResults] = React.useState<TestResult[] | null>(null);
  const [phase, setPhase] = React.useState('starting');

  React.useEffect(() => {
    setPhase('running tests');
    const r = runSelfTests();
    setResults(r);
    setPhase('done');
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a2540' }}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
    >
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
        自己診断 ({phase})
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 16 }}>
        ✗ が付いているモジュールがクラッシュ原因の候補です。
      </Text>
      {results == null ? (
        <Text style={{ color: '#fff' }}>診断中…</Text>
      ) : (
        results.map((r, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              marginBottom: 6,
              backgroundColor: r.ok ? '#0f3052' : '#7f1d1d',
              padding: 8,
              borderRadius: 6,
            }}
          >
            <Text style={{ color: r.ok ? '#10b981' : '#fca5a5', fontWeight: '700', marginRight: 8 }}>
              {r.ok ? '✓' : '✗'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>{r.name}</Text>
              {r.error ? (
                <Text style={{ color: '#fca5a5', fontSize: 10, marginTop: 2 }}>
                  {r.error}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}
      <Text style={{ color: '#64748B', fontSize: 11, marginTop: 24, textAlign: 'center' }}>
        この画面のスクショを送ってください
      </Text>
    </ScrollView>
  );
}

function SafeModeScreen() {
  const [tapped, setTapped] = React.useState(0);
  return (
    <View style={{ flex: 1, backgroundColor: '#0a2540', padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 }}>
        起動成功 (Safe Mode)
      </Text>
      <Text style={{ color: '#94A3B8', marginBottom: 24 }}>
        React Native は正常に動いています。タップすると数字が増えます: {tapped}
      </Text>
      <Text
        onPress={() => setTapped((t) => t + 1)}
        style={{
          color: '#fff',
          backgroundColor: '#2563EB',
          padding: 14,
          borderRadius: 12,
          textAlign: 'center',
          fontWeight: '600',
          overflow: 'hidden',
        }}
      >
        ここをタップ
      </Text>
      <Text style={{ color: '#64748B', fontSize: 11, marginTop: 24, textAlign: 'center' }}>
        この画面が出れば、React Native とビルドは健全です。
        次に AppNavigator / firebase の方を調査します。
      </Text>
    </View>
  );
}

// 起動安定化のため、バックグラウンドアップロードとプッシュ通知の登録を
// 一時的に無効化している。Obj-C 例外がネイティブブリッジ越しに JS の
// try/catch を貫通してアプリを abort させていたため、まず確実に起動して
// ログイン → 録音までできることを優先。安定後に再有効化する。
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

  if (SAFE_MODE) {
    return (
      <AppErrorBoundary>
        {SELF_TEST ? <SelfTestScreen /> : <SafeModeScreen />}
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <AppContent />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
