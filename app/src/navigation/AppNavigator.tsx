import React, { useEffect, useRef, useState } from 'react';
import {
  NavigationContainer,
  type NavigationContainerRef,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, View } from 'react-native';
import * as Linking from 'expo-linking';

import { useAuth } from '@/hooks/useAuth';
import { useCrmContext } from '@/hooks/useCrmContext';
import { fetchDeal } from '@/services/crm';
import { LoginScreen } from '@/screens/LoginScreen';
import { RecordingListScreen } from '@/screens/RecordingListScreen';
import { RecordScreen } from '@/screens/RecordScreen';
import { RecordingDetailScreen } from '@/screens/RecordingDetailScreen';
import { DealSelectScreen } from '@/screens/DealSelectScreen';
import type { Deal } from '@/types';

export type RootStackParamList = {
  List: undefined;
  DealSelect: undefined;
  Record: { deal: Deal };
  Detail: { recordingId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    Linking.createURL('/'), // Expo Go 用
    'makxasrec://',
    'https://app.makxas.com', // 将来的な Universal Link 想定
  ],
  config: {
    screens: {
      List: '',
      DealSelect: 'deals',
      // Record は Deal オブジェクト経由で渡すため、直接 URL では紐付けない
      // 代わりに DealSelect の下層として deal/:dealId を扱う（下の getStateFromPath で変換）
      Detail: 'recordings/:recordingId',
    },
  },
  // `makxasrec://deal/{id}` を受け取った時は、案件取得後に Record へ遷移するため
  // 独自処理する。ここでは subscribe で URL 変化を拾う。
};

export function AppNavigator() {
  const { user, loading, signOut } = useAuth();
  const crm = useCrmContext();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);

  // 起動時にディープリンクを取得
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => sub.remove();
  }, []);

  function handleIncomingUrl(url: string) {
    const parsed = Linking.parse(url);
    // 期待パターン: makxasrec://deal/{dealId}
    const parts = (parsed.path ?? '').split('/').filter(Boolean);
    if (parts[0] === 'deal' && parts[1]) {
      setPendingDealId(parts[1]);
    }
  }

  // 案件ID が届いたら、ログイン済みになってから案件を取得して Record へ
  useEffect(() => {
    if (!pendingDealId || !user) return;
    (async () => {
      try {
        const deal = await fetchDeal(crm, pendingDealId);
        if (!deal) {
          Alert.alert('案件が見つかりません', `ID: ${pendingDealId}`);
          setPendingDealId(null);
          return;
        }
        if (
          deal.assessorEmail &&
          user.email &&
          deal.assessorEmail.toLowerCase() !== user.email.toLowerCase()
        ) {
          Alert.alert(
            'アクセス権がありません',
            'この案件はあなたに割り当てられていません。',
          );
          setPendingDealId(null);
          return;
        }
        if (deal.status !== 'scheduled') {
          Alert.alert(
            '録音できない案件です',
            `この案件は「予約中」ではありません（現在のステータス: ${deal.status}）`,
          );
          setPendingDealId(null);
          return;
        }
        navRef.current?.navigate('Record', { deal });
      } catch (e) {
        Alert.alert('案件取得エラー', e instanceof Error ? e.message : String(e));
      } finally {
        setPendingDealId(null);
      }
    })();
  }, [pendingDealId, user, crm]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer ref={navRef} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="List">
          {({ navigation }) => (
            <RecordingListScreen
              onSelect={(id) => navigation.navigate('Detail', { recordingId: id })}
              onNewRecording={() => navigation.navigate('DealSelect')}
              onSignOut={signOut}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="DealSelect">
          {({ navigation }) => (
            <DealSelectScreen
              onSelect={(deal) => navigation.replace('Record', { deal })}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Record" options={{ headerShown: true, title: '新規録音' }}>
          {({ route, navigation }) => (
            <RecordScreen
              deal={route.params.deal}
              onDone={() => {
                navigation.navigate('List');
              }}
              onChangeDeal={() => {
                navigation.replace('DealSelect');
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Detail" options={{ headerShown: true, title: '詳細' }}>
          {({ route, navigation }) => (
            <RecordingDetailScreen
              recordingId={route.params.recordingId}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
