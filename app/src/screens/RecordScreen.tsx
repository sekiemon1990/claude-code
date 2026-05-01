import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

import { useRecorder } from '@/hooks/useRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useStorageStatus, formatBytes } from '@/hooks/useStorageStatus';
import { persistRecording } from '@/services/audioStorage';
import { enqueueRecording } from '@/services/uploadQueue';
import {
  createDemoRecording,
  createRecordingDocOnStart,
  markRecordingFailed,
  markRecordingStopped,
} from '@/services/recordings';
import { getDealUrl, toSnapshot } from '@/services/crm';
import { logError } from '@/services/errorLog';
import { AudioMeter } from '@/components/AudioMeter';
import { DEMO_MODE } from '@/demo';
import type { Deal } from '@/types';

function resolveAssessorName(user: { displayName: string | null; email: string | null }): string {
  if (user.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user.email) {
    const local = user.email.split('@')[0];
    if (local) return local;
  }
  return '担当者不明';
}

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

export function RecordScreen(props: Props) {
  return <RecordScreenInner {...props} />;
}

function _UnusedDiagnosticStages({
  stage,
  setStage,
  dealName,
}: {
  stage: number;
  setStage: (n: number) => void;
  dealName: string;
}) {
  const stages = [
    { num: 0, label: '0: 何もしない（タップで次へ）' },
    { num: 1, label: '1: useAuth() を呼ぶ' },
    { num: 2, label: '2: useStorageStatus() を呼ぶ（FileSystem.getFreeDiskStorageAsync）' },
    { num: 3, label: '3: useRecorder() を呼ぶ' },
    { num: 4, label: '4: 通常の RecordScreen 全体を描画' },
  ];

  // 段階的にフックを呼ぶサブコンポーネント
  if (stage === 1) return <Stage1 onNext={() => setStage(2)} />;
  if (stage === 2) return <Stage2 onNext={() => setStage(3)} />;
  if (stage === 3) return <Stage3 onNext={() => setStage(4)} />;

  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#0a2540' }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
        録音画面 診断
      </Text>
      <Text style={{ color: '#94A3B8', marginBottom: 24, fontSize: 13 }}>
        案件: {dealName}{'\n'}
        各ボタンをタップして次のステージへ進んでください。クラッシュしたら、そのボタンの内容が原因です。
      </Text>
      {stages.slice(0, stage + 2).map((s) => (
        <Pressable
          key={s.num}
          onPress={() => setStage(s.num)}
          style={{
            backgroundColor: stage === s.num ? '#2563EB' : '#1e3a5f',
            padding: 14,
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 13 }}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Stage1({ onNext }: { onNext: () => void }) {
  useAuth();
  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#0a2540' }}>
      <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '700' }}>
        ✓ Stage 1: useAuth() OK
      </Text>
      <Pressable
        onPress={onNext}
        style={{ backgroundColor: '#2563EB', padding: 14, borderRadius: 8, marginTop: 16 }}
      >
        <Text style={{ color: '#fff' }}>次のステージへ (Stage 2: useStorageStatus)</Text>
      </Pressable>
    </View>
  );
}

function Stage2({ onNext }: { onNext: () => void }) {
  useAuth();
  const storage = useStorageStatus();
  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#0a2540' }}>
      <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '700' }}>
        ✓ Stage 2: useStorageStatus() OK
      </Text>
      <Text style={{ color: '#94A3B8', marginTop: 8 }}>
        free: {formatBytes(storage.freeBytes)} / level: {storage.level}
      </Text>
      <Pressable
        onPress={onNext}
        style={{ backgroundColor: '#2563EB', padding: 14, borderRadius: 8, marginTop: 16 }}
      >
        <Text style={{ color: '#fff' }}>次のステージへ (Stage 3: useRecorder)</Text>
      </Pressable>
    </View>
  );
}

function Stage3({ onNext }: { onNext: () => void }) {
  useAuth();
  useStorageStatus();
  const recorder = useRecorder();
  return (
    <View style={{ flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#0a2540' }}>
      <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '700' }}>
        ✓ Stage 3: useRecorder() OK
      </Text>
      <Text style={{ color: '#94A3B8', marginTop: 8 }}>
        state: {recorder.state}
      </Text>
      <Pressable
        onPress={onNext}
        style={{ backgroundColor: '#2563EB', padding: 14, borderRadius: 8, marginTop: 16 }}
      >
        <Text style={{ color: '#fff' }}>次のステージへ (Stage 4: 本番画面)</Text>
      </Pressable>
    </View>
  );
}

function RecordScreenInner({ deal, onDone, onChangeDeal }: Props) {
  const { user } = useAuth();
  const recorder = useRecorder();
  const storage = useStorageStatus();
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  // 非同期反映の連打レース対策として同期 ref も併用する
  const savingRef = useRef(false);
  const startingRef = useRef(false);
  // 録音開始時に発番される Firestore recordings/{id} の ID を保持。
  // 録音停止時の doc update / キュー投入で使用する。
  const recordingIdRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();

  // 録音中・停止保存中はバックナビゲーションを禁止する。
  // iOS のスワイプバック (gestureEnabled) と Android の物理 BACK の両方を塞ぐ。
  const isRecording = recorder.state === 'recording';
  const isPaused = recorder.state === 'paused';
  const isLocked = starting || saving || isRecording || isPaused;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !isLocked });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => isLocked);
    return () => sub.remove();
  }, [navigation, isLocked]);

  async function handleStart() {
    if (startingRef.current || savingRef.current) return;
    if (storage.level === 'critical') {
      Alert.alert(
        'ストレージ残量が不足しています',
        `空き容量が ${formatBytes(storage.freeBytes)} しかありません。不要なファイルを削除してから録音してください。`,
      );
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      await recorder.start();
      if (DEMO_MODE) {
        // デモは Firestore doc を一切作らない (Chatwork 通知も飛ばない)
        return;
      }
      if (!user) return;
      const assessorName = resolveAssessorName(user);
      const title = `${deal.customerName} ${format(new Date(deal.reservationAt), 'M/d HH:mm', {
        locale: ja,
      })}`;
      const { recordingId } = await createRecordingDocOnStart({
        ownerUid: user.uid,
        dealId: deal.id,
        dealSnapshot: toSnapshot(deal),
        title,
        assessorName,
      });
      recordingIdRef.current = recordingId;
    } catch (e) {
      // doc 作成失敗時は録音を巻き戻す
      try {
        await recorder.stop();
      } catch {
        // 二次エラーは握りつぶす
      }
      recorder.reset();
      Alert.alert('録音開始失敗', e instanceof Error ? e.message : '不明なエラー');
      void logError('recording_failed', e, { dealId: deal.id, phase: 'start' });
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  async function handleStop() {
    // 同期ガード: 連打で2回目以降が走らないようにする
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    try {
      const result = await recorder.stop();

      if (!result) {
        // stop が null を返した = 録音ファイル取得失敗。UI はすでに 'stopped' に遷移済み。
        // 既に Firestore doc が作られている場合 (非DEMO) は failed に倒す。
        if (!DEMO_MODE && recordingIdRef.current) {
          await markRecordingFailed({
            recordingId: recordingIdRef.current,
            errorMessage: '録音ファイルの取得に失敗しました',
          });
          recordingIdRef.current = null;
        }
        Alert.alert('保存失敗', '録音ファイルの取得に失敗しました。もう一度録音し直してください。');
        recorder.reset();
        return;
      }
      if (!user) return;

      const title = `${deal.customerName} ${format(new Date(deal.reservationAt), 'M/d HH:mm', {
        locale: ja,
      })}`;

      if (DEMO_MODE) {
        // デモ: 永続化・キューをスキップし、直接 demoStore に流し込む。Firestore は触らない。
        await createDemoRecording({
          ownerUid: user.uid,
          dealSnapshot: toSnapshot(deal),
          title,
          durationMs: result.durationMs,
        });
      } else {
        const recordingId = recordingIdRef.current;
        if (!recordingId) {
          // 通常はあり得ない (handleStart で必ず発番される)。安全側で停止。
          throw new Error('録音セッションが見つかりません。録音を最初からやり直してください。');
        }
        // 録音 doc を 'recording' → 'uploading' に遷移させる。
        // この瞬間に notifyRecordingEnd Function が発火する。
        await markRecordingStopped({
          recordingId,
          durationMs: result.durationMs,
        });
        const persistedUri = await persistRecording(result.uri, recordingId);
        await enqueueRecording({
          recordingId,
          ownerUid: user.uid,
          dealId: deal.id,
          dealSnapshot: toSnapshot(deal),
          title,
          localUri: persistedUri,
          durationMs: result.durationMs,
        });
        recordingIdRef.current = null;
      }

      recorder.reset();
      onDone();
    } catch (e) {
      Alert.alert('保存失敗', e instanceof Error ? e.message : '不明なエラー');
      void logError('recording_failed', e, { dealId: deal.id });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const isIdle = recorder.state === 'idle';

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 60 : 20) }]}>
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

        <Pressable
          style={styles.openCrmBtn}
          onPress={() => Linking.openURL(getDealUrl(deal)).catch(() => undefined)}
        >
          <Text style={styles.openCrmBtnText}>マクサスコアで案件を開く ↗</Text>
        </Pressable>
      </View>

      <View style={styles.timerBox}>
        <Text style={styles.timer}>{formatDuration(recorder.durationMs)}</Text>
        <Text
          style={[
            styles.status,
            isPaused && recorder.pauseReason === 'interruption' ? styles.statusInterrupted : null,
          ]}
        >
          {isIdle && '待機中'}
          {isRecording && '● 録音中'}
          {isPaused && recorder.pauseReason === 'user' && '⏸ 一時停止中（手動）'}
          {isPaused && recorder.pauseReason === 'interruption' && '⏸ 中断（電話/他アプリ優先）— 復帰すれば自動で再開します'}
          {recorder.state === 'stopped' && '停止'}
        </Text>
        <AudioMeter level={recorder.meterDb} active={isRecording} />
      </View>

      {recorder.error ? <Text style={styles.error}>{recorder.error}</Text> : null}

      <View style={styles.controls}>
        {isIdle || recorder.state === 'stopped' ? (
          <Pressable
            style={[styles.mainBtn, styles.startBtn, (saving || starting) && styles.disabled]}
            disabled={saving || starting}
            onPress={handleStart}
          >
            <Text style={styles.mainBtnText}>{starting ? '開始中...' : '録音開始'}</Text>
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
  openCrmBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
  },
  openCrmBtnText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
  timerBox: { marginTop: 28, alignItems: 'center' },
  timer: {
    fontSize: 60,
    fontVariant: ['tabular-nums'],
    fontWeight: '300',
    color: '#0F172A',
  },
  status: { marginTop: 8, color: '#64748B', textAlign: 'center' },
  statusInterrupted: { color: '#92400E', fontWeight: '600' },
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
