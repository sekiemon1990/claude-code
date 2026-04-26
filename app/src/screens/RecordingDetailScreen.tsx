import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

import { subscribeToRecording, deleteRecording } from '@/services/recordings';
import { DEMO_MODE } from '@/demo';
import { StatusBadge } from '@/components/StatusBadge';
import type { Recording } from '@/types';

type Props = { recordingId: string; onBack: () => void };

export function RecordingDetailScreen({ recordingId, onBack }: Props) {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<any>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const unsub = subscribeToRecording(recordingId, (rec) => {
      setRecording(rec);
      setLoading(false);
    });
    return () => {
      unsub();
      sound?.unloadAsync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  async function handlePlayPause() {
    if (!recording?.downloadUrl) return;
    if (DEMO_MODE) {
      Alert.alert(
        'デモモード',
        'デモ用の録音のため再生はできません。実機ビルドでは録音を再生できます。',
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Audio } = require('expo-av');
    if (sound) {
      if (playing) {
        await sound.pauseAsync();
        setPlaying(false);
      } else {
        await sound.playAsync();
        setPlaying(true);
      }
      return;
    }
    const { sound: s } = await Audio.Sound.createAsync(
      { uri: recording.downloadUrl },
      { shouldPlay: true },
    );
    s.setOnPlaybackStatusUpdate((status: any) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        setPlaying(false);
      }
    });
    setSound(s);
    setPlaying(true);
  }

  async function handleDelete() {
    if (!recording) return;
    Alert.alert('削除しますか？', 'この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await sound?.unloadAsync();
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

  const isProcessing =
    recording.status === 'uploading' ||
    recording.status === 'uploaded' ||
    recording.status === 'transcribing' ||
    recording.status === 'generating_minutes';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
        <Pressable style={styles.playButton} onPress={handlePlayPause}>
          <Text style={styles.playButtonText}>
            {playing ? '⏸ 一時停止' : '▶ 再生'}
          </Text>
        </Pressable>
      ) : null}

      {isProcessing ? (
        <View style={styles.processing}>
          <ActivityIndicator />
          <Text style={styles.processingText}>
            処理中です。完了まで数分かかる場合があります。
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
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
  },
  processingText: { color: '#92400E', textAlign: 'center' },
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
