import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@/hooks/useAuth';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { subscribeToRecordings } from '@/services/recordings';
import { removeQueueItem, type QueuedRecording } from '@/services/uploadQueue';
import { StatusBadge } from '@/components/StatusBadge';
import type { Recording } from '@/types';

type Props = {
  onSelect: (recordingId: string) => void;
  onNewRecording: () => void;
  onSignOut: () => void;
};

type ListRow =
  | { kind: 'queued'; item: QueuedRecording }
  | { kind: 'cloud'; item: Recording };

export function RecordingListScreen({ onSelect, onNewRecording, onSignOut }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Recording[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { queue, draining, online, drain, refresh } = useUploadQueue(user?.uid);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRecordings(user.uid, (recordings) => {
      setItems(recordings);
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  // 画面がフォーカスされた時にキューを再読み込み（録音画面からの戻り直後など）
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void drain();
    }, [refresh, drain]),
  );

  const rows: ListRow[] = [
    ...queue.map((q): ListRow => ({ kind: 'queued', item: q })),
    ...items.map((r): ListRow => ({ kind: 'cloud', item: r })),
  ];

  async function handleRetryAll() {
    await drain();
  }

  async function handleDiscardQueued(item: QueuedRecording) {
    if (!user) return;
    await removeQueueItem(user.uid, item.queueId);
    await refresh();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>商談一覧</Text>
        <Pressable onPress={onSignOut}>
          <Text style={styles.signOut}>ログアウト</Text>
        </Pressable>
      </View>

      {queue.length > 0 || !online ? (
        <View style={[styles.banner, !online && styles.bannerOffline]}>
          <Text style={styles.bannerText}>
            {!online
              ? `オフライン中：未送信 ${queue.length} 件`
              : `未送信の録音が ${queue.length} 件あります`}
          </Text>
          {online && queue.length > 0 ? (
            <Pressable onPress={handleRetryAll} disabled={draining}>
              <Text style={styles.bannerAction}>
                {draining ? '送信中...' : '再試行'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(row) =>
          row.kind === 'queued' ? `q:${row.item.queueId}` : `c:${row.item.id}`
        }
        refreshControl={
          <RefreshControl refreshing={!loaded} onRefresh={() => drain()} />
        }
        contentContainerStyle={rows.length === 0 ? styles.emptyContent : styles.listContent}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>まだ録音はありません</Text>
              <Text style={styles.emptyBody}>
                下の「新規録音」から商談の録音を開始できます。
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'queued') {
            const q = row.item;
            return (
              <View style={[styles.row, styles.rowQueued]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {q.title}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {format(new Date(q.createdAt), 'yyyy-MM-dd HH:mm')}
                    {'  ·  '}
                    {Math.round(q.durationMs / 1000)}秒
                  </Text>
                  <Text style={styles.queuedLabel}>
                    {q.status === 'uploading'
                      ? '送信中...'
                      : q.status === 'failed'
                      ? `送信失敗（${q.attempts}回リトライ）`
                      : '未送信'}
                  </Text>
                  {q.lastError ? (
                    <Text style={styles.queuedError} numberOfLines={2}>
                      {q.lastError}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => handleDiscardQueued(q)}>
                  <Text style={styles.discard}>破棄</Text>
                </Pressable>
              </View>
            );
          }
          const rec = row.item;
          return (
            <Pressable style={styles.row} onPress={() => onSelect(rec.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {rec.title}
                </Text>
                <Text style={styles.rowMeta}>
                  {rec.createdAt
                    ? format(rec.createdAt.toDate(), 'yyyy-MM-dd HH:mm')
                    : ''}
                  {'  ·  '}
                  {Math.round(rec.durationMs / 1000)}秒
                </Text>
                <View style={{ marginTop: 6 }}>
                  <StatusBadge status={rec.status} />
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={onNewRecording}>
        <Text style={styles.fabText}>+ 新規録音</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  signOut: { color: '#64748B' },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerOffline: { backgroundColor: '#FEE2E2' },
  bannerText: { color: '#92400E', fontWeight: '600' },
  bannerAction: { color: '#2563EB', fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },
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
  rowQueued: {
    borderStyle: 'dashed',
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 13 },
  queuedLabel: { marginTop: 6, color: '#92400E', fontSize: 12, fontWeight: '600' },
  queuedError: { marginTop: 4, color: '#991B1B', fontSize: 11 },
  discard: { color: '#DC2626', padding: 8, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700' },
});
