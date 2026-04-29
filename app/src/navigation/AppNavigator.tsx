import React, { useEffect, useRef, useState } from 'react';
import {
  NavigationContainer,
  type NavigationContainerRef,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Alert, Platform, View } from 'react-native';
import * as Linking from 'expo-linking';

import { useAuth } from '@/hooks/useAuth';
import { useCrmContext } from '@/hooks/useCrmContext';
import { emailsMatch, fetchDeal } from '@/services/crm';
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

// 実機（ネイティブ）でだけ React Navigation の linking 機能を有効化する。
// Web/DEMO 環境で linking を有効にすると、baseUrl と React Navigation の
// 内部 path 解釈が噛み合わず、navigation.navigate がブラウザ URL を意図せず
// 上書きしてボタンが反応しないように見える挙動になるため、Web ではオフ。
// なお `makxasrec://deal/{id}` のディープリンクは下記の Linking.addEventListener
// で独自に拾うので、linking 設定なしでも問題ない。
const linking: LinkingOptions<RootStackParamList> | undefined =
  Platform.OS === 'web'
    ? undefined
    : {
        prefixes: ['makxasrec://', 'https://app.makxas.com'],
        config: {
          screens: {
            List: '',
            DealSelect: 'deals',
            Detail: 'recordings/:recordingId',
          },
        },
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
        if (deal.assessorEmail && !emailsMatch(deal.assessorEmail, user.email)) {
          Alert.alert(
            'アクセス権がありません',
            `この案件は別の担当者（${deal.assessorEmail}）に割り当てられています。\nあなた: ${user.email}`,
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
              onSelectDeal={(deal) => {
                const safeDeal = JSON.parse(JSON.stringify(deal));
                navigation.navigate('Record', { deal: safeDeal });
              }}
              onSignOut={signOut}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="DealSelect">
          {({ navigation }) => (
            <DealSelectScreen
              onSelect={(deal) => {
                // navigation.replace は iOS 26 / native-stack でクラッシュする
                // 事象があったため navigate 経由に統一。また、deal オブジェクトの
                // 参照が循環していると serialize で死ぬ可能性があるので
                // JSON 経由でディープコピーしてプリミティブのみに正規化する。
                const safeDeal = JSON.parse(JSON.stringify(deal));
                navigation.navigate('Record', { deal: safeDeal });
              }}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Record">
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
        <Stack.Screen name="Detail">
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
