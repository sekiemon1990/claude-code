import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@/hooks/useAuth';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { useStorageStatus, formatBytes } from '@/hooks/useStorageStatus';
import { deleteRecording, subscribeToRecordings } from '@/services/recordings';
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

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '全て' },
  { key: 'pending', label: '未送信' },
  { key: 'processing', label: '処理中' },
  { key: 'completed', label: '完了' },
  { key: 'failed', label: '失敗' },
];

function classifyRow(row: ListRow): StatusFilter {
  if (row.kind === 'queued') {
    if (row.item.status === 'failed') return 'failed';
    return 'pending'; // pending or uploading
  }
  const s = row.item.status;
  if (s === 'completed') return 'completed';
  if (s === 'failed') return 'failed';
  return 'processing'; // uploading / uploaded / transcribing / transcribed / generating_minutes
}

function rowSearchText(row: ListRow): string {
  if (row.kind === 'queued') {
    const q = row.item;
    return `${q.dealSnapshot.customerName} ${q.dealSnapshot.address ?? ''} ${q.dealSnapshot.items ?? ''}`.toLowerCase();
  }
  const r = row.item;
  return `${r.dealSnapshot?.customerName ?? ''} ${r.dealSnapshot?.address ?? ''} ${r.dealSnapshot?.items ?? ''} ${r.minutes?.summary ?? ''} ${r.minutes?.customerInfo ?? ''}`.toLowerCase();
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  // 検索 + ステータスでフィルタ
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (statusFilter !== 'all' && classifyRow(row) !== statusFilter) return false;
    if (normalizedQuery && !rowSearchText(row).includes(normalizedQuery)) return false;
    return true;
  });

  const uploadingCount = queue.filter((q) => q.status === 'uploading').length;
  const waitingCount = queue.filter((q) => q.status === 'pending').length;
  const failedCount = queue.filter((q) => q.status === 'failed').length;

  async function handleDiscardQueued(item: QueuedRecording) {
    if (!user) return;
    await removeQueueItem(user.uid, item.queueId);
    await refresh();
  }

  // status='recording' のままリストに残った doc は、アプリが録音中に kill された
  // 等の理由で取り残されたもの。MVP では中断検知の自動遷移を行わないため、
  // ユーザーが手動で削除できるようにする。再生・編集系の操作は出さない。
  function handleDeleteRecordingState(rec: Recording) {
    Alert.alert(
      '録音を削除',
      '録音中状態のまま残っている記録です。削除しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRecording(rec);
            } catch (e) {
              Alert.alert('削除失敗', e instanceof Error ? e.message : '不明なエラー');
            }
          },
        },
      ],
    );
  }

  // ダッシュボード + 各種バナーを FlatList の ListHeaderComponent に
  // まとめて入れることで、ヘッダ以外のすべてが一緒にスクロールする。
  // これがないとダッシュボードが大きい時、画面外に出た部分にアクセスできない。
  const listHeader = (
    <>
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
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={!loaded} onRefresh={() => drain()} />
        }
      >
        {listHeader}
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
        {rows.length > 0 ? (
          <>
            <Text style={styles.listSectionTitle}>📁 過去の録音</Text>
            <View style={styles.searchBox}>
              <TextInput
                style={styles.searchInput}
                placeholder="🔍 顧客名 / 住所 / 議事録の内容で検索"
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {searchQuery !== '' ? (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnText}>×</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.filterChips}>
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setStatusFilter(f.key)}
                  >
                    <Text
                      style={[styles.filterChipText, active && styles.filterChipTextActive]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.resultCount}>
              {filteredRows.length}件
              {filteredRows.length !== rows.length ? ` / 全 ${rows.length}件` : ''}
            </Text>
          </>
        ) : null}

        {rows.length === 0 && loaded ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>まだ録音はありません</Text>
            <Text style={styles.emptyBody}>
              下の「新規録音」から案件を選択して録音を開始できます。
            </Text>
          </View>
        ) : null}

        {rows.length > 0 && filteredRows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>該当する録音がありません</Text>
            <Text style={styles.emptyBody}>
              検索条件・フィルタを変更してみてください。
            </Text>
          </View>
        ) : null}

        {filteredRows.map((row) => {
          if (row.kind === 'queued') {
            const q = row.item;
            const percent = progress[q.queueId];
            const isUploading = q.status === 'uploading';
            const isFailed = q.status === 'failed';

            return (
              <View key={`q:${q.queueId}`} style={[styles.row, styles.rowQueued]}>
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
          // 'recording' は録音中で音声ファイルがまだ無い (アプリ kill 等の取り残し)。
          // 詳細画面 (再生・議事録・CRM 投稿) は無意味なので開かせず、削除のみ可能にする。
          if (rec.status === 'recording') {
            return (
              <View key={`c:${rec.id}`} style={styles.row}>
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
                  <View style={{ marginTop: 6 }}>
                    <StatusBadge status={rec.status} />
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable onPress={() => handleDeleteRecordingState(rec)}>
                      <Text style={styles.discard}>削除</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }
          const processing = isPipelineProcessing(rec.status);
          const percent = pipelinePercent(rec.status);
          return (
            <Pressable
              key={`c:${rec.id}`}
              style={styles.row}
              onPress={() => onSelect(rec.id)}
            >
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
        })}
      </ScrollView>

      <Pressable style={styles.fab} onPress={onNewRecording}>
        <Text style={styles.fabText}>+ 新規録音</Text>
      </Pressable>
    </SafeAreaView>
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
  listContent: { paddingBottom: 120 },
  listSectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  clearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearBtnText: { fontSize: 18, color: '#94A3B8', fontWeight: '600' },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  resultCount: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
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
    marginHorizontal: 16,
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
