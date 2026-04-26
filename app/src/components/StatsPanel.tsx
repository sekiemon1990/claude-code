import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Recording } from '@/types';
import type { QueuedRecording } from '@/services/uploadQueue';
import { formatBytes } from '@/hooks/useStorageStatus';
import { getRecentErrors } from '@/services/errorLog';

type Props = {
  queue: QueuedRecording[];
  recordings: Recording[];
  freeBytes: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 録音容量・処理状況ダッシュボード。
 * - 端末内未送信の件数と推定容量
 * - 過去24時間の完了/失敗件数と成功率
 * - 平均処理時間
 * - 直近のエラーログ件数（メモリ上）
 */
export function StatsPanel({ queue, recordings, freeBytes }: Props) {
  const stats = useMemo(() => {
    const now = Date.now();
    const recent = recordings.filter((r) => {
      const t = r.createdAt?.toDate?.()?.getTime?.() ?? 0;
      return now - t < DAY_MS;
    });
    const completed = recent.filter((r) => r.status === 'completed');
    const failed = recent.filter((r) => r.status === 'failed');
    const successRate =
      recent.length === 0
        ? null
        : Math.round((completed.length / recent.length) * 100);

    // 平均処理時間: createdAt → updatedAt の差分（completed のみ）
    const processingMs = completed
      .map((r) => {
        const c = r.createdAt?.toDate?.()?.getTime?.() ?? 0;
        const u = r.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        return u - c;
      })
      .filter((d) => d > 0);
    const avgProcSec =
      processingMs.length === 0
        ? null
        : Math.round(processingMs.reduce((a, b) => a + b, 0) / processingMs.length / 1000);

    // 未送信ファイルの推定サイズ: 30秒で約400KB（128kbps m4a 想定）の概算
    const queueBytesEstimate = queue.reduce(
      (sum, q) => sum + Math.round((q.durationMs / 1000) * 16000),
      0,
    );

    return {
      queueCount: queue.length,
      queueBytesEstimate,
      recentTotal: recent.length,
      completedCount: completed.length,
      failedCount: failed.length,
      successRate,
      avgProcSec,
      errorCount: getRecentErrors().length,
    };
  }, [queue, recordings]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 ステータス（24h）</Text>
      <View style={styles.grid}>
        <Stat label="未送信" value={`${stats.queueCount}件`} sub={formatBytes(stats.queueBytesEstimate)} />
        <Stat label="完了" value={`${stats.completedCount}件`} valueColor="#16A34A" />
        <Stat label="失敗" value={`${stats.failedCount}件`} valueColor={stats.failedCount > 0 ? '#DC2626' : '#0F172A'} />
        <Stat
          label="成功率"
          value={stats.successRate == null ? '—' : `${stats.successRate}%`}
        />
        <Stat
          label="平均処理時間"
          value={stats.avgProcSec == null ? '—' : `${stats.avgProcSec}秒`}
        />
        <Stat label="端末空き" value={formatBytes(freeBytes)} />
      </View>
      {stats.errorCount > 0 ? (
        <Text style={styles.errorNote}>
          内部エラーログ: {stats.errorCount} 件（運用ログ送信済み）
        </Text>
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      {sub ? <Text style={styles.cellSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  title: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.3%', paddingVertical: 4 },
  cellLabel: { fontSize: 10, color: '#64748B', marginBottom: 2 },
  cellValue: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cellSub: { fontSize: 10, color: '#94A3B8', marginTop: 1 },
  errorNote: {
    marginTop: 8,
    fontSize: 11,
    color: '#DC2626',
  },
});
