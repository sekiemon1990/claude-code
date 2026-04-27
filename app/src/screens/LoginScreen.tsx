import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { useGoogleSignIn } from '@/services/googleSignIn';

// 実機ビルドで env が EAS に渡っていないと OAuth クライアント ID が空文字となり、
// `useIdTokenAuthRequest` が常に request=null を返してボタンが無反応になる。
// その場合は画面に原因を出す。
function detectOAuthConfigIssue(): string | null {
  const extra = Constants.expoConfig?.extra ?? {};
  const ios = extra.googleIosClientId as string | undefined;
  const android = extra.googleAndroidClientId as string | undefined;
  const web = extra.googleWebClientId as string | undefined;
  const missing: string[] = [];
  if (!ios) missing.push('GOOGLE_IOS_CLIENT_ID');
  if (!android) missing.push('GOOGLE_ANDROID_CLIENT_ID');
  if (!web) missing.push('GOOGLE_WEB_CLIENT_ID');
  if (missing.length === 0) return null;
  return `セットアップエラー: ${missing.join(', ')} がビルドに含まれていません`;
}

export function LoginScreen() {
  const { ready, response, signIn, exchangeResponseForFirebaseUser } = useGoogleSignIn();
  const [signingIn, setSigningIn] = useState(false);
  const configIssue = detectOAuthConfigIssue();

  useEffect(() => {
    (async () => {
      if (response?.type === 'success') {
        try {
          await exchangeResponseForFirebaseUser();
        } catch (e) {
          Alert.alert('ログイン失敗', e instanceof Error ? e.message : '不明なエラー');
        } finally {
          setSigningIn(false);
        }
      } else if (response && response.type !== 'success') {
        setSigningIn(false);
      }
    })();
  }, [response, exchangeResponseForFirebaseUser]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.brand}>
        <Text style={styles.title}>出張買取 録音</Text>
        <Text style={styles.subtitle}>商談を録音して議事録を自動作成</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        disabled={!ready || signingIn}
        onPress={() => {
          setSigningIn(true);
          signIn();
        }}
      >
        {signingIn ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Googleでログイン</Text>
        )}
      </Pressable>

      {configIssue ? (
        <Text style={styles.configIssue}>{configIssue}</Text>
      ) : !ready ? (
        <Text style={styles.notReady}>認証モジュールを初期化中…</Text>
      ) : null}

      <Text style={styles.notice}>
        録音は常に端末に保存され、送信完了までローカルに残ります。
        {'\n'}※ 商談を録音する際は、必ずお客様の同意を得てください。
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a2540',
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  brand: {
    marginBottom: 48,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#94A3B8',
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: '#1D4ED8',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  notice: {
    marginTop: 24,
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  configIssue: {
    marginTop: 16,
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  notReady: {
    marginTop: 16,
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
});
