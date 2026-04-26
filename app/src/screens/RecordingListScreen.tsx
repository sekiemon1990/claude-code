import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@/hooks/useAuth';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { useStorageStatus, formatBytes } from '@/hooks/useStorageStatus';
import { subscribeToRecordings } from '@/services/recordings';
import { removeQueueItem, type QueuedRecording } from '@/services/uploadQueue';
import { StatusBadge } from '@/components/StatusBadge';
import { ProgressBar } from '@/components/ProgressBar';
import { HomeDashboard } from '@/components/HomeDashboard';
import { CompletionToast } from '@/components/CompletionToast';
import { useTodayDeals } from '@/hooks/useTodayDeals';
import { useRecentCompletedDeals } from '@/hooks/useRecentCompletedDeals';
import { useDealActions } from '@/hooks/useDealActions';
import type { Deal } from '@/types';
import {
  isPipelineProcessing,
  pipelineLabel,
  pipelinePercent,
} from '@/services/pipelineProgress';
import { DEMO_MODE } from '@/demo';
import type { Recording } from '@/types';

type Props = {
  onSelect: (recordingId: string) => void;
  onNewRecording: () => void;
  onSelectDeal: (deal: Deal) => void;
  onSignOut: () => void;
};

type ListRow =
  | { kind: 'queued'; item: QueuedRecording }
  | { kind: 'cloud'; item: Recording };

export function RecordingListScreen({
  onSelect,
  onNewRecording,
  onSelectDeal,
  onSignOut,
}: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Recording[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [toast, setToast] = useState<Recording | null>(null);
  const previouslyCompletedIds = useRef<Set<string>>(new Set());
  const { queue, progress, draining, online, drain, refresh, retryItem, retryAll } =
    useUploadQueue(user?.uid);
  const storage = useStorageStatus();
  const { todayDeals, source: todayDealsSource } = useTodayDeals();
  const { completedDeals: recentCompletedDeals } = useRecentCompletedDeals();
  const { forgotten, markForgotten, unmarkForgotten } = useDealActions(user?.email ?? user?.uid);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRecordings(user.uid, (recordings) => {
      setItems(recordings);
      setLoaded(true);

      // 新たに completed に変わった録音があれば通知トーストを出す
      // 初回ロード時の既存 completed は通知対象外
      const initial = previouslyCompletedIds.current.size === 0;
      const justCompleted = recordings.find(
        (r) => r.status === 'completed' && !previouslyCompletedIds.current.has(r.id),
      );
      recordings.forEach((r) => {
        if (r.status === 'completed') previouslyCompletedIds.current.add(r.id);
      });
      if (!initial && justCompleted) {
        setToast(justCompleted);
      }
    });
    return unsub;
  }, [user]);

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

  const uploadingCount = queue.filter((q) => q.status === 'uploading').length;
  const waitingCount = queue.filter((q) => q.status === 'pending').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;

  async function handleDiscardQueued(item: QueuedRecording) {
    if (!user) return;
    await removeQueueItem(user.uid, item.queueId);
    await refresh();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.headerTitle}>商談一覧</Text>
            {DEMO_MODE ? (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>DEMO</Text>
              </View>
            ) : null}
          </View>
          {user ? (
            <Text style={styles.userInfo} numberOfLines={1}>
              {user.displayName ? `${user.displayName} · ` : ''}
              {user.email}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => setDashboardOpen((v) => !v)}
          hitSlop={8}
          style={{ marginRight: 14 }}
        >
          <Text style={styles.iconBtn}>{dashboardOpen ? '📊' : '📊'}</Text>
        </Pressable>
        <Pressable onPress={onSignOut} hitSlop={8}>
          <Text style={styles.signOut}>ログアウト</Text>
        </Pressable>
      </View>

      {dashboardOpen ? (
        <HomeDashboard
          todayDeals={todayDeals}
          todayDealsSource={todayDealsSource}
          recordings={items}
          queue={queue}
          freeBytes={storage.freeBytes}
          recentCompletedDeals={recentCompletedDeals}
          forgottenDealIds={forgotten}
          onSelectDeal={onSelectDeal}
          onShowAllDeals={onNewRecording}
          onMarkForgotten={markForgotten}
          onUnmarkForgotten={unmarkForgotten}
        />
      ) : null}

      {toast ? (
        <CompletionToast
          recording={toast}
          onPress={() => {
            const id = toast.id;
            setToast(null);
            onSelect(id);
          }}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      {storage.level !== 'ok' ? (
        <View
          style={[
            styles.storageBanner,
            storage.level === 'critical' && styles.storageBannerCritical,
          ]}
        >
          <Text
            style={[
              styles.storageBannerText,
              storage.level === 'critical' && styles.storageBannerTextCritical,
            ]}
          >
            {storage.level === 'critical'
              ? `ストレージ残量が少ないです（空き ${formatBytes(storage.freeBytes)}）。録音ができない可能性があります。`
              : `ストレージ残量が減っています（空き ${formatBytes(storage.freeBytes)}）。未送信の録音を送信するか、不要なファイルを削除してください。`}
          </Text>
        </View>
      ) : null}

      {queue.length > 0 || !online ? (
        <View style={[styles.banner, !online && styles.bannerOffline]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerText}>
              {!online ? 'オフライン中' : 'クラウドへ送信中'}
            </Text>
            <Text style={styles.bannerSubText}>
              {[
                uploadingCount > 0 ? `送信中 ${uploadingCount}` : null,
                waitingCount > 0 ? `待機 ${waitingCount}` : null,
                failedCount > 0 ? `失敗 ${failedCount}` : null,
              ]
                .filter(Boolean)
                .join('  ·  ') || 'すべてローカル保存済み'}
            </Text>
          </View>
          {online && (waitingCount > 0 || failedCount > 0) ? (
            <Pressable onPress={retryAll} disabled={draining}>
              <Text style={styles.bannerAction}>
                {draining ? '処理中...' : '再試行'}
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
                下の「新規録音」から案件を選択して録音を開始できます。
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'queued') {
            const q = row.item;
            const percent = progress[q.queueId];
            const isUploading = q.status === 'uploading';
            const isFailed = q.status === 'failed';

            return (
              <View style={[styles.row, styles.rowQueued]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName} numberOfLines={1}>
                    {q.dealSnapshot.customerName}
                  </Text>
                  <Text style={styles.reservation}>
                    予約:{' '}
                    {format(new Date(q.dealSnapshot.reservationAt), 'M/d (E) HH:mm', {
                      locale: ja,
                    })}
                  </Text>
                  <Text style={styles.rowMeta}>
                    録音: {format(new Date(q.createdAt), 'M/d HH:mm', { locale: ja })}
                    {'  ·  '}
                    {Math.round(q.durationMs / 1000)}秒
                  </Text>

                  <View style={styles.queuedStatusRow}>
                    <Text style={[styles.queuedLabel, isFailed && styles.queuedLabelFailed]}>
                      {isUploading
                        ? `送信中 ${percent ?? 0}%${!online ? '（電波待ち）' : ''}`
                        : isFailed
                        ? `送信失敗（${q.attempts}回試行）${
                            q.nextRetryAt && q.nextRetryAt > Date.now()
                              ? ` · 次回 ${Math.ceil((q.nextRetryAt - Date.now()) / 60000)}分後`
                              : ''
                          }`
                        : !online
                        ? 'ローカル保存済み・電波復帰待ち'
                        : 'ローカル保存済み・送信待ち'}
                    </Text>
                  </View>

                  {isUploading ? (
                    <View style={{ marginTop: 6 }}>
                      <ProgressBar percent={percent ?? 0} />
                    </View>
                  ) : null}

                  {q.lastError ? (
                    <Text style={styles.queuedError} numberOfLines={3}>
                      {q.lastError}
                    </Text>
                  ) : null}

                  {(isFailed || q.status === 'pending') && !draining ? (
                    <View style={styles.rowActions}>
                      <Pressable onPress={() => retryItem(q.queueId)}>
                        <Text style={styles.retry}>再試行</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDiscardQueued(q)}>
                        <Text style={styles.discard}>破棄</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }
          const rec = row.item;
          const processing = isPipelineProcessing(rec.status);
          const percent = pipelinePercent(rec.status);
          return (
            <Pressable style={styles.row} onPress={() => onSelect(rec.id)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {rec.dealSnapshot?.customerName ?? rec.title}
                </Text>
                {rec.dealSnapshot ? (
                  <Text style={styles.reservation}>
                    予約:{' '}
                    {format(new Date(rec.dealSnapshot.reservationAt), 'M/d (E) HH:mm', {
                      locale: ja,
                    })}
                  </Text>
                ) : null}
                <Text style={styles.rowMeta}>
                  録音:{' '}
                  {rec.createdAt
                    ? format(rec.createdAt.toDate(), 'M/d HH:mm', { locale: ja })
                    : ''}
                  {'  ·  '}
                  {Math.round(rec.durationMs / 1000)}秒
                </Text>

                {processing ? (
                  <View style={{ marginTop: 8 }}>
                    <View style={styles.pipelineRow}>
                      <Text style={styles.pipelineLabel}>{pipelineLabel(rec.status)}</Text>
                      <Text style={styles.pipelinePercent}>{percent}%</Text>
                    </View>
                    <View style={{ marginTop: 4 }}>
                      <ProgressBar percent={percent} />
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 6 }}>
                    <StatusBadge status={rec.status} />
                  </View>
                )}
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
  userInfo: { marginTop: 2, fontSize: 12, color: '#64748B' },
  iconBtn: { fontSize: 18 },
  signOut: { color: '#64748B' },
  demoBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  demoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerOffline: { backgroundColor: '#FEF3C7' },
  storageBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
  },
  storageBannerCritical: { backgroundColor: '#FEE2E2' },
  storageBannerText: { color: '#92400E', fontSize: 13, lineHeight: 18 },
  storageBannerTextCritical: { color: '#991B1B' },
  bannerText: { color: '#1E40AF', fontWeight: '700', fontSize: 14 },
  bannerSubText: { color: '#334155', fontSize: 12, marginTop: 2 },
  bannerAction: { color: '#2563EB', fontWeight: '700' },
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
  },
  rowQueued: {
    borderStyle: 'dashed',
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  customerName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  reservation: { marginTop: 4, color: '#0F172A', fontSize: 13 },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 12 },
  pipelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  pipelineLabel: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  pipelinePercent: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  queuedStatusRow: { marginTop: 6 },
  queuedLabel: { color: '#92400E', fontSize: 12, fontWeight: '700' },
  queuedLabelFailed: { color: '#991B1B' },
  queuedError: {
    marginTop: 4,
    color: '#991B1B',
    fontSize: 11,
    lineHeight: 16,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 10,
  },
  retry: { color: '#2563EB', fontWeight: '700' },
  discard: { color: '#DC2626', fontWeight: '600' },
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
