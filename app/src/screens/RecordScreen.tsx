import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

import { useRecorder } from '@/hooks/useRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useStorageStatus, formatBytes } from '@/hooks/useStorageStatus';
import { persistRecording } from '@/services/audioStorage';
import { enqueueRecording } from '@/services/uploadQueue';
import { createRecordingAndUpload } from '@/services/recordings';
import { toSnapshot } from '@/services/crm';
import { DEMO_MODE } from '@/demo';
import type { Deal } from '@/types';
import * as Crypto from 'expo-crypto';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

type Props = {
  deal: Deal;
  onDone: () => void;
  onChangeDeal: () => void;
};

export function RecordScreen({ deal, onDone, onChangeDeal }: Props) {
  const { user } = useAuth();
  const recorder = useRecorder();
  const storage = useStorageStatus();
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    if (storage.level === 'critical') {
      Alert.alert(
        'ストレージ残量が不足しています',
        `空き容量が ${formatBytes(storage.freeBytes)} しかありません。不要なファイルを削除してから録音してください。`,
      );
      return;
    }
    await recorder.start();
  }

  async function handleStop() {
    const result = await recorder.stop();
    if (!result || !user) return;

    const title = `${deal.customerName} ${format(new Date(deal.reservationAt), 'M/d HH:mm', {
      locale: ja,
    })}`;

    setSaving(true);
    try {
      if (DEMO_MODE) {
        // デモ: 永続化・キューをスキップし、直接 demoStore に流し込む
        await createRecordingAndUpload({
          ownerUid: user.uid,
          dealId: deal.id,
          dealSnapshot: toSnapshot(deal),
          title,
          localUri: result.uri,
          durationMs: result.durationMs,
        });
      } else {
        const queueId = Crypto.randomUUID();
        const persistedUri = await persistRecording(result.uri, queueId);

        await enqueueRecording({
          ownerUid: user.uid,
          dealId: deal.id,
          dealSnapshot: toSnapshot(deal),
          title,
          localUri: persistedUri,
          durationMs: result.durationMs,
        });
      }

      recorder.reset();
      onDone();
    } catch (e) {
      Alert.alert('保存失敗', e instanceof Error ? e.message : '不明なエラー');
    } finally {
      setSaving(false);
    }
  }

  const isIdle = recorder.state === 'idle';
  const isRecording = recorder.state === 'recording';
  const isPaused = recorder.state === 'paused';

  return (
    <View style={styles.container}>
      <View style={styles.dealCard}>
        <View style={styles.dealHeader}>
          <Text style={styles.dealLabel}>選択中の案件</Text>
          {isIdle ? (
            <Pressable onPress={onChangeDeal}>
              <Text style={styles.changeLink}>変更</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.customerName}>{deal.customerName}</Text>
        <Text style={styles.dealWhen}>
          予約:{' '}
          {format(new Date(deal.reservationAt), 'M/d (E) HH:mm', { locale: ja })}
        </Text>
        {deal.customerAddress ? (
          <Text style={styles.dealAddress}>{deal.customerAddress}</Text>
        ) : null}
        {deal.items ? <Text style={styles.dealItems}>査定対象: {deal.items}</Text> : null}
      </View>

      <View style={styles.timerBox}>
        <Text style={styles.timer}>{formatDuration(recorder.durationMs)}</Text>
        <Text style={styles.status}>
          {isIdle && '待機中'}
          {isRecording && '● 録音中'}
          {isPaused && '一時停止中'}
          {recorder.state === 'stopped' && '停止'}
        </Text>
      </View>

      {recorder.error ? <Text style={styles.error}>{recorder.error}</Text> : null}

      <View style={styles.controls}>
        {isIdle || recorder.state === 'stopped' ? (
          <Pressable
            style={[styles.mainBtn, styles.startBtn, saving && styles.disabled]}
            disabled={saving}
            onPress={handleStart}
          >
            <Text style={styles.mainBtnText}>録音開始</Text>
          </Pressable>
        ) : null}

        {isRecording ? (
          <>
            <Pressable style={styles.secondaryBtn} onPress={() => recorder.pause()}>
              <Text style={styles.secondaryBtnText}>一時停止</Text>
            </Pressable>
            <Pressable
              style={[styles.mainBtn, styles.stopBtn, saving && styles.disabled]}
              disabled={saving}
              onPress={handleStop}
            >
              <Text style={styles.mainBtnText}>
                {saving ? '保存中...' : '停止して保存'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {isPaused ? (
          <>
            <Pressable style={styles.secondaryBtn} onPress={() => recorder.resume()}>
              <Text style={styles.secondaryBtnText}>再開</Text>
            </Pressable>
            <Pressable
              style={[styles.mainBtn, styles.stopBtn, saving && styles.disabled]}
              disabled={saving}
              onPress={handleStop}
            >
              <Text style={styles.mainBtnText}>
                {saving ? '保存中...' : '停止して保存'}
              </Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {storage.level !== 'ok' ? (
        <View
          style={[
            styles.storageWarn,
            storage.level === 'critical' && styles.storageWarnCritical,
          ]}
        >
          <Text
            style={[
              styles.storageWarnText,
              storage.level === 'critical' && styles.storageWarnTextCritical,
            ]}
          >
            端末の空き容量: {formatBytes(storage.freeBytes)}
            {storage.level === 'critical'
              ? '（録音できません。容量を空けてください）'
              : '（残量が少なくなっています）'}
          </Text>
        </View>
      ) : null}

      <Text style={styles.offlineNote}>
        録音は停止と同時に端末へ保存されます。
        クラウドへのアップロードはバックグラウンドで行われ、
        送信完了するまでローカルのファイルは消えません。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F8FAFC' },
  dealCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dealLabel: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  changeLink: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
  customerName: { marginTop: 6, fontSize: 18, fontWeight: '700', color: '#0F172A' },
  dealWhen: { marginTop: 6, fontSize: 14, color: '#0F172A' },
  dealAddress: { marginTop: 4, fontSize: 13, color: '#475569' },
  dealItems: { marginTop: 4, fontSize: 13, color: '#475569' },
  timerBox: { marginTop: 28, alignItems: 'center' },
  timer: {
    fontSize: 60,
    fontVariant: ['tabular-nums'],
    fontWeight: '300',
    color: '#0F172A',
  },
  status: { marginTop: 8, color: '#64748B' },
  error: { marginTop: 12, color: '#DC2626', textAlign: 'center' },
  controls: { marginTop: 24, gap: 12 },
  mainBtn: { paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  startBtn: { backgroundColor: '#DC2626' },
  stopBtn: { backgroundColor: '#0F172A' },
  disabled: { opacity: 0.5 },
  mainBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
  },
  secondaryBtnText: { color: '#0F172A', fontWeight: '600' },
  offlineNote: {
    marginTop: 24,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  storageWarn: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  storageWarnCritical: { backgroundColor: '#FEE2E2' },
  storageWarnText: { color: '#92400E', fontSize: 13, textAlign: 'center' },
  storageWarnTextCritical: { color: '#991B1B' },
});
