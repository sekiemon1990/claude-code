import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ja } from 'date-fns/locale';

import { useCrmContext } from '@/hooks/useCrmContext';
import { fetchAssignedScheduledDeals } from '@/services/crm';
import type { Deal } from '@/types';

type Props = { onSelect: (deal: Deal) => void; onBack: () => void };

export function DealSelectScreen({ onSelect, onBack }: Props) {
  const crm = useCrmContext();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchAssignedScheduledDeals(crm);
      setDeals(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '案件の取得に失敗しました');
    }
  }, [crm]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← 戻る</Text>
        </Pressable>
        <Text style={styles.headerTitle}>案件を選択</Text>
        <View style={{ width: 48 }} />
      </View>

      <Text style={styles.subtitle}>
        自分が査定担当者の予約中案件（予約日時が近い順）
      </Text>

      {deals == null && !error ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>再試行</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={deals ?? []}
          keyExtractor={(d) => d.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={
            (deals ?? []).length === 0 ? styles.emptyContent : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>対象の案件はありません</Text>
              <Text style={styles.emptyBody}>
                予約中かつあなたが査定担当に設定されている案件が表示されます。
              </Text>
            </View>
          }
          renderItem={({ item: deal }) => (
            <Pressable style={styles.row} onPress={() => onSelect(deal)}>
              <View style={styles.rowMain}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {deal.customerName}
                </Text>
                <Text style={styles.when}>
                  {format(new Date(deal.reservationAt), 'M/d (E) HH:mm', { locale: ja })}
                </Text>
                <Text style={styles.relative}>
                  {formatDistanceToNowStrict(new Date(deal.reservationAt), {
                    addSuffix: true,
                    locale: ja,
                  })}
                </Text>
                {deal.customerAddress ? (
                  <Text style={styles.address} numberOfLines={2}>
                    {deal.customerAddress}
                  </Text>
                ) : null}
                {deal.items ? (
                  <Text style={styles.items} numberOfLines={2}>
                    査定対象: {deal.items}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  back: { color: '#2563EB', width: 48 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  subtitle: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    color: '#64748B',
    fontSize: 13,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#DC2626', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyContent: { flex: 1, justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  emptyBody: {
    marginTop: 6,
    color: '#64748B',
    textAlign: 'center',
    fontSize: 14,
  },
  row: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMain: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  when: { marginTop: 4, color: '#0F172A', fontWeight: '600' },
  relative: { marginTop: 2, color: '#2563EB', fontSize: 12 },
  address: { marginTop: 6, color: '#475569', fontSize: 13 },
  items: { marginTop: 4, color: '#475569', fontSize: 13 },
  chevron: { fontSize: 28, color: '#94A3B8', marginLeft: 8 },
});
