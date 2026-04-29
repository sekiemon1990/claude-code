import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

import { subscribeToRecording, deleteRecording } from '@/services/recordings';
import { postMinutesToCrm } from '@/services/crm';
import { useCrmContext } from '@/hooks/useCrmContext';
import { formatMinutesAsText } from '@/services/minutesFormat';
import { logError } from '@/services/errorLog';
import {
  PIPELINE_STAGES,
  isPipelineProcessing,
  pipelineLabel,
  pipelinePercent,
} from '@/services/pipelineProgress';
import { DEMO_MODE } from '@/demo';
import { StatusBadge } from '@/components/StatusBadge';
import { ProgressBar } from '@/components/ProgressBar';
import type { Recording } from '@/types';

type Props = { recordingId: string; onBack: () => void };

const SUPPORTS_NATIVE_PLAYBACK = !DEMO_MODE && Platform.OS !== 'web';

export function RecordingDetailScreen({ recordingId, onBack }: Props) {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [postingToCrm, setPostingToCrm] = useState(false);
  const crm = useCrmContext();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsub = subscribeToRecording(recordingId, (rec) => {
      setRecording(rec);
      setLoading(false);
    });
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  async function handleCopyMinutes() {
    if (!recording) return;
    const text = formatMinutesAsText(recording);
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('コピーしました', '議事録をクリップボードにコピーしました。');
    } catch (e) {
      Alert.alert('コピー失敗', e instanceof Error ? e.message : '不明なエラー');
      void logError('other', e, { feature: 'copy_minutes' });
    }
  }

  async function handleCopyAudioUrl() {
    if (!recording?.downloadUrl) return;
    try {
      await Clipboard.setStringAsync(recording.downloadUrl);
      Alert.alert(
        '録音URLをコピーしました',
        '同僚や上長と共有して内容確認に使えます。',
      );
    } catch (e) {
      Alert.alert('コピー失敗', e instanceof Error ? e.message : '不明なエラー');
    }
  }

  async function handlePostToCrm() {
    if (!recording || !recording.minutes) return;
    setPostingToCrm(true);
    try {
      const result = await postMinutesToCrm(crm, recording.dealId, {
        minutesText: formatMinutesAsText(recording),
        audioUrl: recording.downloadUrl,
        recordingId: recording.id,
      });
      if (result.ok) {
        Alert.alert('送信完了', 'マクサスコアへ議事録を書き戻しました。');
      } else {
        throw new Error('CRM への書き戻しが失敗しました');
      }
    } catch (e) {
      Alert.alert('送信失敗', e instanceof Error ? e.message : '不明なエラー');
      void logError('crm_failed', e, { recordingId: recording.id, dealId: recording.dealId });
    } finally {
      setPostingToCrm(false);
    }
  }

  async function handleDelete() {
    if (!recording) return;
    Alert.alert('削除しますか？', 'この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteRecording(recording);
          onBack();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!recording) {
    return (
      <View style={styles.center}>
        <Text>録音が見つかりません</Text>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>戻る</Text>
        </Pressable>
      </View>
    );
  }

  const isProcessing = isPipelineProcessing(recording.status);
  const percent = pipelinePercent(recording.status);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
    >
      <Pressable onPress={onBack}>
        <Text style={styles.link}>← 一覧へ</Text>
      </Pressable>

      {recording.dealSnapshot ? (
        <View style={styles.dealCard}>
          <Text style={styles.dealLabel}>案件</Text>
          <Text style={styles.customerName}>{recording.dealSnapshot.customerName}</Text>
          <Text style={styles.reservation}>
            予約:{' '}
            {format(new Date(recording.dealSnapshot.reservationAt), 'M/d (E) HH:mm', {
              locale: ja,
            })}
          </Text>
          {recording.dealSnapshot.address ? (
            <Text style={styles.dealMeta}>{recording.dealSnapshot.address}</Text>
          ) : null}
          {recording.dealSnapshot.items ? (
            <Text style={styles.dealMeta}>査定対象: {recording.dealSnapshot.items}</Text>
          ) : null}
          {recording.dealSnapshot.dealUrl ? (
            <Pressable
              style={styles.openCrmBtn}
              onPress={() =>
                Linking.openURL(recording.dealSnapshot!.dealUrl!).catch(() => undefined)
              }
            >
              <Text style={styles.openCrmBtnText}>マクサスコアで案件を開く ↗</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={styles.title}>{recording.title}</Text>
      )}

      <Text style={styles.meta}>
        録音:{' '}
        {recording.createdAt
          ? format(recording.createdAt.toDate(), 'yyyy-MM-dd HH:mm')
          : ''}
        {'  ·  '}
        {Math.round(recording.durationMs / 1000)}秒
      </Text>
      <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
        <StatusBadge status={recording.status} />
      </View>

      {recording.errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{recording.errorMessage}</Text>
        </View>
      ) : null}

      {recording.downloadUrl ? (
        SUPPORTS_NATIVE_PLAYBACK ? (
          <NativePlaybackButton url={recording.downloadUrl} />
        ) : (
          <Pressable
            style={styles.playButton}
            onPress={() =>
              Alert.alert(
                'デモモード',
                'デモ用の録音のため再生はできません。実機ビルドでは録音を再生できます。',
              )
            }
          >
            <Text style={styles.playButtonText}>▶ 再生</Text>
          </Pressable>
        )
      ) : null}

      {isProcessing ? (
        <View style={styles.processing}>
          <View style={styles.processingHeader}>
            <Text style={styles.processingLabel}>{pipelineLabel(recording.status)}</Text>
            <Text style={styles.processingPercent}>{percent}%</Text>
          </View>
          <ProgressBar percent={percent} />
          <View style={styles.stageList}>
            {PIPELINE_STAGES.filter((s) => s.status !== 'uploading').map((s) => {
              const reached = percent >= s.percent;
              const current = s.status === recording.status;
              return (
                <View key={s.status} style={styles.stageRow}>
                  <Text
                    style={[
                      styles.stageMark,
                      reached ? styles.stageMarkDone : styles.stageMarkPending,
                      current ? styles.stageMarkCurrent : null,
                    ]}
                  >
                    {reached ? '✓' : '○'}
                  </Text>
                  <Text
                    style={[
                      styles.stageLabel,
                      current ? styles.stageLabelCurrent : null,
                    ]}
                  >
                    {s.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.processingText}>
            完了までしばらくお待ちください。アプリを閉じても処理は続行されます。
          </Text>
        </View>
      ) : null}

      {recording.minutes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>議事録</Text>
          <MinutesRow label="サマリ" value={recording.minutes.summary} />
          <MinutesRow label="お客様情報" value={recording.minutes.customerInfo} />
          <MinutesRow label="査定品目" value={recording.minutes.items} />
          <MinutesRow label="提示額" value={recording.minutes.offeredPrice} />
          <MinutesRow label="次回アクション" value={recording.minutes.nextActions} />

          <View style={styles.actionRow}>
            <Pressable style={styles.actionBtn} onPress={handleCopyMinutes}>
              <Text style={styles.actionBtnText}>📋 議事録をコピー</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.actionBtnPrimary, postingToCrm && styles.disabled]}
              disabled={postingToCrm}
              onPress={handlePostToCrm}
            >
              <Text style={styles.actionBtnPrimaryText}>
                {postingToCrm ? '送信中...' : '↗ マクサスコアへ書き戻す'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {recording.downloadUrl ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>録音内容を確認するURL</Text>
          <Text style={styles.urlText} numberOfLines={2}>
            {recording.downloadUrl}
          </Text>
          <Text style={styles.urlNote}>
            このURLにアクセスすると録音音声を直接再生できます。
            上長や同僚と内容を確認したい時にコピーして共有してください。
          </Text>
          <Pressable style={styles.actionBtn} onPress={handleCopyAudioUrl}>
            <Text style={styles.actionBtnText}>📋 録音URLをコピー</Text>
          </Pressable>
        </View>
      ) : null}

      {recording.transcript ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>文字起こし</Text>
          <Text style={styles.transcript}>{recording.transcript}</Text>
        </View>
      ) : null}

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>削除</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * expo-av の Audio.Sound を使った再生ボタン。
 * URL がある時だけこのコンポーネントを描画する。
 * web/DEMO 環境では SUPPORTS_NATIVE_PLAYBACK が false なので呼ばれない。
 */
function NativePlaybackButton({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        try {
          soundRef.current.unloadAsync();
        } catch {
          // ignore
        }
        soundRef.current = null;
      }
    };
  }, []);

  async function handle() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Audio } = require('expo-av');
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: url });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status?.didJustFinish) {
            setIsPlaying(false);
          } else if (status?.isLoaded) {
            setIsPlaying(!!status.isPlaying);
          }
        });
        await sound.playAsync();
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        if (status.positionMillis != null && status.durationMillis != null
            && status.positionMillis >= status.durationMillis - 100) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
      }
    } catch (e) {
      Alert.alert('再生エラー', e instanceof Error ? e.message : '不明なエラー');
    }
  }

  return (
    <Pressable style={styles.playButton} onPress={handle}>
      <Text style={styles.playButtonText}>
        {isPlaying ? '⏸ 一時停止' : '▶ 再生'}
      </Text>
    </Pressable>
  );
}

function MinutesRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.minutesRow}>
      <Text style={styles.minutesLabel}>{label}</Text>
      <Text style={styles.minutesValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  link: { color: '#2563EB', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  meta: { marginTop: 12, color: '#64748B' },
  dealCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dealLabel: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  customerName: { marginTop: 6, fontSize: 18, fontWeight: '700', color: '#0F172A' },
  reservation: { marginTop: 6, fontSize: 14, color: '#0F172A' },
  dealMeta: { marginTop: 4, fontSize: 13, color: '#475569' },
  openCrmBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
  },
  openCrmBtnText: { color: '#2563EB', fontWeight: '600', fontSize: 13 },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  errorText: { color: '#991B1B' },
  playButton: {
    marginTop: 20,
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  playButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  processing: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
  },
  processingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  processingLabel: { color: '#92400E', fontSize: 14, fontWeight: '700' },
  processingPercent: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  stageList: { marginTop: 12, gap: 4 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stageMark: { fontSize: 14, width: 18, textAlign: 'center' },
  stageMarkDone: { color: '#16A34A' },
  stageMarkPending: { color: '#94A3B8' },
  stageMarkCurrent: { color: '#92400E', fontWeight: '700' },
  stageLabel: { fontSize: 13, color: '#475569' },
  stageLabelCurrent: { color: '#0F172A', fontWeight: '600' },
  processingText: { color: '#92400E', textAlign: 'center', marginTop: 12, fontSize: 12 },
  section: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  minutesRow: { marginBottom: 12 },
  minutesLabel: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  minutesValue: { fontSize: 14, color: '#0F172A', lineHeight: 20 },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  actionBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
  actionBtnPrimary: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.6 },
  urlText: {
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 6,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  urlNote: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 8,
  },
  transcript: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 22,
  },
  deleteButton: {
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteButtonText: { color: '#DC2626', fontWeight: '600' },
});
