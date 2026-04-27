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
// firebase 初期化のクラッシュを更に細分化して特定するため再度 SELF_TEST を ON。
const SAFE_MODE = true;
const SELF_TEST = true;

type TestResult = { name: string; ok: boolean; error?: string };

// 各テスト項目。画面に「次に試すモジュール」を表示してから 800ms 待ち、
// その後実際に require する。クラッシュした場合、画面には**直前に表示した
// モジュール名**が残るので、それが原因モジュール。
const TESTS: Array<{ name: string; run: () => void }> = [
  { name: 'react-native-safe-area-context', run: () => { require('react-native-safe-area-context'); } },
  { name: 'react-native-screens', run: () => { require('react-native-screens'); } },
  { name: '@react-navigation/native', run: () => { require('@react-navigation/native'); } },
  { name: '@react-navigation/native-stack', run: () => { require('@react-navigation/native-stack'); } },
  { name: '@react-native-async-storage/async-storage', run: () => { require('@react-native-async-storage/async-storage'); } },
  { name: 'firebase/app (require)', run: () => { require('firebase/app'); } },
  { name: 'firebase/auth (require)', run: () => { require('firebase/auth'); } },
  { name: 'firebase/firestore (require)', run: () => { require('firebase/firestore'); } },
  { name: 'firebase/storage (require)', run: () => { require('firebase/storage'); } },
  { name: 'firebase initializeApp(config)', run: () => {
      const { initializeApp, getApps } = require('firebase/app');
      const Constants = require('expo-constants').default;
      const extra = Constants.expoConfig?.extra ?? {};
      const cfg = {
        apiKey: extra.firebaseApiKey || 'demo',
        authDomain: extra.firebaseAuthDomain || 'demo.firebaseapp.com',
        projectId: extra.firebaseProjectId || 'demo',
        storageBucket: extra.firebaseStorageBucket || 'demo.appspot.com',
        messagingSenderId: extra.firebaseMessagingSenderId || '0',
        appId: extra.firebaseAppId || '1:0:web:demo',
      };
      if (getApps().length === 0) initializeApp(cfg);
    },
  },
  { name: 'firebase getAuth(app)', run: () => {
      const { getApp, getApps, initializeApp } = require('firebase/app');
      const { getAuth } = require('firebase/auth');
      const Constants = require('expo-constants').default;
      const extra = Constants.expoConfig?.extra ?? {};
      const cfg = {
        apiKey: extra.firebaseApiKey || 'demo',
        authDomain: extra.firebaseAuthDomain || 'demo.firebaseapp.com',
        projectId: extra.firebaseProjectId || 'demo',
        storageBucket: extra.firebaseStorageBucket || 'demo.appspot.com',
        messagingSenderId: extra.firebaseMessagingSenderId || '0',
        appId: extra.firebaseAppId || '1:0:web:demo',
      };
      const app = getApps().length === 0 ? initializeApp(cfg) : getApp();
      getAuth(app);
    },
  },
  { name: 'firebase getFirestore(app)', run: () => {
      const { getApp } = require('firebase/app');
      const { getFirestore } = require('firebase/firestore');
      getFirestore(getApp());
    },
  },
  { name: 'firebase getStorage(app)', run: () => {
      const { getApp } = require('firebase/app');
      const { getStorage } = require('firebase/storage');
      getStorage(getApp());
    },
  },
  { name: '@/config/firebase (lazy)', run: () => { require('@/config/firebase'); } },
  { name: 'expo-auth-session/providers/google', run: () => { require('expo-auth-session/providers/google'); } },
  { name: 'expo-web-browser', run: () => { require('expo-web-browser'); } },
  { name: 'expo-constants', run: () => { require('expo-constants'); } },
  { name: 'expo-linking', run: () => { require('expo-linking'); } },
  { name: 'expo-file-system', run: () => { require('expo-file-system'); } },
  { name: 'expo-clipboard', run: () => { require('expo-clipboard'); } },
  { name: '@react-native-community/netinfo', run: () => { require('@react-native-community/netinfo'); } },
];

function SelfTestScreen() {
  const [results, setResults] = React.useState<TestResult[]>([]);
  const [running, setRunning] = React.useState<string | null>('preparing…');
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
      const out: TestResult[] = [];
      for (const t of TESTS) {
        if (cancelled) return;
        // ① まず「これからこのモジュールを試す」を画面に出す
        setRunning(t.name);
        // ② 800ms 待つ → React が再描画する時間を確保
        await sleep(800);
        if (cancelled) return;
        // ③ 実行。Obj-C 例外でクラッシュしたら画面は ① のまま残る
        try {
          t.run();
          out.push({ name: t.name, ok: true });
        } catch (e) {
          out.push({ name: t.name, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
        setResults([...out]);
      }
      setRunning(null);
      setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a2540' }}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
    >
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
        自己診断
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 16 }}>
        途中でクラッシュした場合は、「実行中」に表示されているモジュールが原因です。
        その状態でスクショを送ってください。
      </Text>

      {running ? (
        <View style={{ backgroundColor: '#1e3a5f', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '700' }}>
            ▶ 実行中
          </Text>
          <Text style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>{running}</Text>
        </View>
      ) : null}

      {done ? (
        <View style={{ backgroundColor: '#065f46', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>全テスト完了 — クラッシュ無し</Text>
        </View>
      ) : null}

      {results.map((r, i) => (
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
              <Text style={{ color: '#fca5a5', fontSize: 10, marginTop: 2 }}>{r.error}</Text>
            ) : null}
          </View>
        </View>
      ))}
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
