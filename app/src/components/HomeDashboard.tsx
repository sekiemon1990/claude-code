import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ja } from 'date-fns/locale';

import type { Recording, Deal } from '@/types';
import type { QueuedRecording } from '@/services/uploadQueue';
import { formatBytes } from '@/hooks/useStorageStatus';
import {
  ESTIMATED_GROSS_MARGIN_RATE,
  countItems,
  estimateGrossProfit,
  formatYen,
  parsePrice,
} from '@/services/metrics';
import { PeriodSelector, presetToRange, type PeriodRange } from './PeriodSelector';

type Props = {
  todayDeals: Deal[];
  todayDealsSource: 'network' | 'cache' | null;
  recordings: Recording[];
  queue: QueuedRecording[];
  freeBytes: number | null;
  /** 過去7日で CRM 上「完了」になっている自分担当の案件（録音漏れ検知用） */
  recentCompletedDeals: Deal[];
  /** 「録音忘れた」と明示的にマークされた dealId */
  forgottenDealIds: Set<string>;
  onSelectDeal: (deal: Deal) => void;
  onShowAllDeals: () => void;
  onMarkForgotten: (dealId: string) => void;
  onUnmarkForgotten: (dealId: string) => void;
};

export function HomeDashboard({
  todayDeals,
  todayDealsSource,
  recordings,
  queue,
  freeBytes,
  recentCompletedDeals,
  forgottenDealIds,
  onSelectDeal,
  onShowAllDeals,
  onMarkForgotten,
  onUnmarkForgotten,
}: Props) {
  /** dealId → 録音件数のマップ */
  const recordingsByDeal = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recordings) {
      m.set(r.dealId, (m.get(r.dealId) ?? 0) + 1);
    }
    return m;
  }, [recordings]);

  // 集計期間（査定パフォーマンス・録音漏れの両方に効く）
  const [period, setPeriod] = useState<PeriodRange>(
    () => presetToRange('1m')!, // 既定: 直近1ヶ月
  );
  const stats = useMemo(() => {
    const today = new Date();
    const isToday = (r: Recording) => {
      const d = r.createdAt?.toDate?.();
      if (!d) return false;
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    };
    const recsToday = recordings.filter(isToday);

    // 期間内の録音
    const fromMs = period.from.getTime();
    const toMs = period.to.getTime();
    const recsInPeriod = recordings.filter((r) => {
      const t = r.createdAt?.toDate?.()?.getTime?.() ?? 0;
      return t >= fromMs && t <= toMs;
    });
    const completedInPeriod = recsInPeriod.filter((r) => r.status === 'completed');

    const totalConvSecToday = recsToday.reduce(
      (sum, r) => sum + Math.round(r.durationMs / 1000),
      0,
    );
    const completedDealIds = new Set(
      recordings.filter((r) => r.status === 'completed').map((r) => r.dealId),
    );
    const visitedToday = todayDeals.filter((d) => completedDealIds.has(d.id)).length;
    const remainingToday = todayDeals.length - visitedToday;

    // ===== 査定パフォーマンス =====
    const completedSecs: number[] = [];
    const completedPrices: number[] = [];
    const completedItemCounts: number[] = [];
    for (const r of completedInPeriod) {
      const sec = Math.round(r.durationMs / 1000);
      const price = parsePrice(r.minutes?.offeredPrice);
      const itemCount = countItems(r.dealSnapshot?.items);
      if (sec > 0) completedSecs.push(sec);
      if (price != null) completedPrices.push(price);
      if (itemCount > 0) completedItemCounts.push(itemCount);
    }
    const avgAssessSec =
      completedSecs.length > 0
        ? Math.round(completedSecs.reduce((a, b) => a + b, 0) / completedSecs.length)
        : null;
    const totalSec = completedSecs.reduce((a, b) => a + b, 0);
    const totalPrice = completedPrices.reduce((a, b) => a + b, 0);
    const totalItems = completedItemCounts.reduce((a, b) => a + b, 0);
    const totalGrossProfit = estimateGrossProfit(totalPrice) ?? 0;
    const grossPerHour =
      totalSec > 0 && totalGrossProfit > 0
        ? Math.round(totalGrossProfit / (totalSec / 3600))
        : null;
    const secPerItem = totalItems > 0 && totalSec > 0 ? Math.round(totalSec / totalItems) : null;

    // ===== 録音漏れ（期間内）=====
    const allRecordedDealIds = new Set(recordings.map((r) => r.dealId));

    const completedInPeriodDeals = recentCompletedDeals.filter((d) => {
      const t = new Date(d.reservationAt).getTime();
      return t >= fromMs && t <= toMs;
    });
    const missedFromCompleted = completedInPeriodDeals.filter(
      (d) => !allRecordedDealIds.has(d.id),
    );
    const missedFromMarked = todayDeals.filter(
      (d) => forgottenDealIds.has(d.id) && !allRecordedDealIds.has(d.id),
    );
    // 重複排除
    const missedById = new Map<string, Deal>();
    [...missedFromCompleted, ...missedFromMarked].forEach((d) => missedById.set(d.id, d));
    const missedDeals = [...missedById.values()];

    const totalCompleted = completedInPeriodDeals.length + missedFromMarked.length;
    const missedCount = missedDeals.length;
    const missRate =
      totalCompleted === 0 ? null : Math.round((missedCount / totalCompleted) * 100);

    // 今日の予定で「未対応」のもの（録音もマークもされていない）
    const unhandledTodayCount = todayDeals.filter(
      (d) => !allRecordedDealIds.has(d.id) && !forgottenDealIds.has(d.id),
    ).length;

    // 失敗キュー
    const queueBytesEstimate = queue.reduce(
      (sum, q) => sum + Math.round((q.durationMs / 1000) * 16000),
      0,
    );
    const failedCount = queue.filter((q) => q.status === 'failed').length;

    return {
      recsTodayCount: recsToday.length,
      totalConvSecToday,
      visitedToday,
      remainingToday,
      periodCount: completedInPeriod.length,
      avgAssessSec,
      grossPerHour,
      totalGrossProfit,
      secPerItem,
      pendingQueueCount: queue.length,
      queueBytesEstimate,
      failedCount,
      missedDeals,
      missedCount,
      missRate,
      totalCompleted,
      unhandledTodayCount,
    };
  }, [todayDeals, recordings, queue, recentCompletedDeals, forgottenDealIds, period]);

  const upcomingDeals = useMemo(() => {
    const now = Date.now();
    return todayDeals
      .slice()
      .sort((a, b) => {
        const da = Math.abs(new Date(a.reservationAt).getTime() - now);
        const db = Math.abs(new Date(b.reservationAt).getTime() - now);
        return da - db;
      });
  }, [todayDeals]);

  return (
    <View style={styles.container}>
      {/* ===== 今日の予定 ===== */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📅 今日の予定</Text>
          <Text style={styles.sectionSub}>
            残り {stats.unhandledTodayCount} / 全 {todayDeals.length}件
          </Text>
        </View>
        {todayDealsSource === 'cache' ? (
          <Text style={styles.cacheBadge}>📡 オフライン（キャッシュ）</Text>
        ) : null}

        {upcomingDeals.length === 0 ? (
          <Text style={styles.emptyText}>本日の予約はありません。</Text>
        ) : (
          upcomingDeals.map((deal) => {
            const date = new Date(deal.reservationAt);
            const recordedCount = recordingsByDeal.get(deal.id) ?? 0;
            const isForgotten = forgottenDealIds.has(deal.id);
            const isRecorded = recordedCount > 0;
            const isUnhandled = !isRecorded && !isForgotten;

            return (
              <View key={deal.id} style={styles.dealCard}>
                {/* 上半分：タップで録音画面へ遷移（追加録音もここから） */}
                <Pressable
                  style={({ pressed }) => [
                    styles.dealCardHead,
                    pressed && styles.dealCardHeadPressed,
                  ]}
                  onPress={() => onSelectDeal(deal)}
                >
                  <View style={styles.dealTime}>
                    <Text style={styles.dealTimeText}>
                      {format(date, 'HH:mm', { locale: ja })}
                    </Text>
                    <Text style={styles.dealTimeSub}>
                      {date.getTime() < Date.now()
                        ? formatDistanceToNowStrict(date, { addSuffix: true, locale: ja })
                        : `${formatDistanceToNowStrict(date, { locale: ja })}後`}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.dealNameRow}>
                      <Text
                        style={[
                          styles.dealName,
                          isForgotten ? styles.dealNameForgotten : null,
                        ]}
                        numberOfLines={1}
                      >
                        {deal.customerName}
                      </Text>
                      {isRecorded ? (
                        <View style={styles.statusPillRecorded}>
                          <Text style={styles.statusPillRecordedText}>
                            ✓ 録音済 {recordedCount}件
                          </Text>
                        </View>
                      ) : isForgotten ? (
                        <View style={styles.statusPillForgotten}>
                          <Text style={styles.statusPillForgottenText}>✗ 録音忘れ</Text>
                        </View>
                      ) : null}
                    </View>
                    {deal.customerAddress ? (
                      <Text style={styles.dealAddress} numberOfLines={1}>
                        {deal.customerAddress}
                      </Text>
                    ) : null}
                    <Text style={styles.dealHint}>
                      {isRecorded
                        ? 'タップで追加録音'
                        : isForgotten
                        ? 'タップで録音開始'
                        : 'タップで録音開始'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>

                {/* 下半分：明示的なアクション（録音忘れだけ） */}
                <View style={styles.dealActions}>
                  {isUnhandled ? (
                    <Pressable
                      style={[styles.btn, styles.btnGhost]}
                      onPress={() => onMarkForgotten(deal.id)}
                    >
                      <Text style={styles.btnGhostText}>✗ 録音忘れた（マーク）</Text>
                    </Pressable>
                  ) : isForgotten ? (
                    <Pressable
                      style={[styles.btn, styles.btnGhost]}
                      onPress={() => onUnmarkForgotten(deal.id)}
                    >
                      <Text style={styles.btnGhostText}>↺ 録音忘れマークを取消</Text>
                    </Pressable>
                  ) : null}
                  {/* isRecorded の時はアクション不要 - 録音済が確認 */}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ===== 今日の進捗 ===== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 今日の進捗</Text>
        <View style={styles.statsGrid}>
          <Stat
            label="訪問済み / 予定"
            value={`${stats.visitedToday}/${todayDeals.length}件`}
          />
          <Stat label="商談時間合計" value={formatDuration(stats.totalConvSecToday)} />
          <Stat label="残り訪問" value={`${stats.remainingToday}件`} />
        </View>
      </View>

      {/* ===== 期間選択（パフォーマンス・録音漏れ共通）===== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗓 集計期間</Text>
        <PeriodSelector value={period} onChange={setPeriod} />
        <Text style={styles.periodLabel}>
          {period.label}（{stats.periodCount}件の完了録音）
        </Text>
      </View>

      {/* ===== 査定パフォーマンス ===== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🧮 査定パフォーマンス
          <Text style={styles.sectionSub}>（{period.label}）</Text>
        </Text>
        <View style={styles.statsGrid}>
          <Stat
            label="平均査定時間"
            value={stats.avgAssessSec == null ? '—' : formatDuration(stats.avgAssessSec)}
          />
          <Stat
            label="1商品あたり"
            value={
              stats.secPerItem == null ? '—' : formatDuration(stats.secPerItem)
            }
          />
          <Stat
            label="想定粗利合計"
            value={formatYen(stats.totalGrossProfit > 0 ? stats.totalGrossProfit : null)}
          />
          <Stat
            label="時間あたり粗利"
            value={
              stats.grossPerHour == null ? '—' : `${formatYen(stats.grossPerHour)}/時`
            }
          />
        </View>
        <Text style={styles.formulaNote}>
          ※想定粗利 = 提示額 × {Math.round(ESTIMATED_GROSS_MARGIN_RATE * 100)}%（暫定）。
          CRM に実粗利が入った時点で実績値に置き換え可能。
        </Text>
      </View>

      {/* ===== 録音漏れ ===== */}
      <View
        style={[styles.section, stats.missedCount > 0 ? styles.alertSection : null]}
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {stats.missedCount > 0 ? '⚠️ 録音漏れ' : '✅ 録音漏れなし'}
            <Text style={styles.sectionSub}>（{period.label}）</Text>
          </Text>
        </View>
        <View style={styles.statsGrid}>
          <Stat
            label="録音漏れ件数"
            value={`${stats.missedCount}件 / ${stats.totalCompleted}件中`}
            valueColor={stats.missedCount > 0 ? '#DC2626' : '#16A34A'}
          />
          <Stat
            label="録音漏れ率"
            value={stats.missRate == null ? '—' : `${stats.missRate}%`}
            valueColor={stats.missRate != null && stats.missRate >= 30 ? '#DC2626' : undefined}
          />
        </View>
        {stats.missedDeals.length > 0 ? (
          <View style={styles.missList}>
            <Text style={styles.missListTitle}>未録音案件:</Text>
            {stats.missedDeals.slice(0, 5).map((d) => (
              <Text key={d.id} style={styles.missItem}>
                ・{d.customerName}（
                {formatDistanceToNowStrict(new Date(d.reservationAt), {
                  addSuffix: true,
                  locale: ja,
                })}
                ）
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* ===== 要対応 ===== */}
      {stats.pendingQueueCount > 0 || stats.failedCount > 0 ? (
        <View style={[styles.section, styles.alertSection]}>
          <Text style={styles.sectionTitle}>📤 要対応（送信状況）</Text>
          {stats.pendingQueueCount > 0 ? (
            <Text style={styles.alertText}>
              未送信の録音が {stats.pendingQueueCount} 件あります（合計 {formatBytes(stats.queueBytesEstimate)} 程度）
            </Text>
          ) : null}
          {stats.failedCount > 0 ? (
            <Text style={[styles.alertText, styles.alertTextDanger]}>
              送信失敗が {stats.failedCount} 件あります。下の一覧から確認してください
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ===== 端末状態 ===== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 端末状態</Text>
        <View style={styles.statsGrid}>
          <Stat label="空き容量" value={formatBytes(freeBytes)} />
          <Stat
            label="未送信容量"
            value={
              stats.queueBytesEstimate === 0 ? '—' : formatBytes(stats.queueBytesEstimate)
            }
          />
        </View>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

function formatDuration(totalSec: number): string {
  if (totalSec === 0) return '—';
  if (totalSec < 60) return `${totalSec}秒`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  section: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  alertSection: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  sectionSub: { fontSize: 12, color: '#64748B', fontWeight: '400' },
  cacheBadge: {
    fontSize: 11,
    color: '#92400E',
    marginBottom: 6,
    fontWeight: '600',
  },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', paddingVertical: 8 },
  periodLabel: {
    marginTop: 6,
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  formulaNote: {
    marginTop: 8,
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 14,
  },
  dealCard: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dealCardHead: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  dealCardHeadPressed: { backgroundColor: '#F1F5F9' },
  dealHint: { fontSize: 10, color: '#2563EB', marginTop: 4 },
  chevron: { fontSize: 22, color: '#94A3B8', marginLeft: 4 },
  dealTime: { width: 64 },
  dealTimeText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  dealTimeSub: { fontSize: 10, color: '#2563EB' },
  dealNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dealName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  dealNameForgotten: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  dealAddress: { fontSize: 11, color: '#64748B', marginTop: 2 },
  statusPillRecorded: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusPillRecordedText: { fontSize: 11, color: '#166534', fontWeight: '700' },
  statusPillForgotten: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusPillForgottenText: { fontSize: 11, color: '#991B1B', fontWeight: '700' },
  dealActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingLeft: 76, // dealTime の幅と揃える
  },
  btn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#DC2626',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  btnSecondaryText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
  btnGhost: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnGhostText: { color: '#475569', fontWeight: '600', fontSize: 13 },
  linkText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: 4 },
  cellLabel: { fontSize: 10, color: '#64748B', marginBottom: 2 },
  cellValue: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  alertText: {
    color: '#92400E',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  alertTextDanger: { color: '#991B1B', fontWeight: '600' },
  missList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FCD34D',
  },
  missListTitle: { fontSize: 11, color: '#92400E', fontWeight: '700', marginBottom: 4 },
  missItem: { fontSize: 12, color: '#92400E', lineHeight: 18 },
});
