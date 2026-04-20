import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { format } from 'date-fns';

import { useRecorder } from '@/hooks/useRecorder';
import { useAuth } from '@/hooks/useAuth';
import { persistRecording } from '@/services/audioStorage';
import { enqueueRecording } from '@/services/uploadQueue';
import * as Crypto from 'expo-crypto';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

type Props = { onDone: () => void };

export function RecordScreen({ onDone }: Props) {
  const { user } = useAuth();
  const recorder = useRecorder();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleStop() {
    const result = await recorder.stop();
    if (!result || !user) return;

    const finalTitle =
      title.trim() || `商談 ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;

    setSaving(true);
    try {
      // 1. 音声ファイルを永続ディレクトリへ移動（アプリ再起動でも残す）
      const queueId = Crypto.randomUUID();
      const persistedUri = await persistRecording(result.uri, queueId);

      // 2. アップロードキューに追加（オフライン時はここで止まり、オンライン復帰時に自動送信）
      await enqueueRecording({
        ownerUid: user.uid,
        title: finalTitle,
        localUri: persistedUri,
        durationMs: result.durationMs,
      });

      recorder.reset();
      setTitle('');
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
      <TextInput
        style={styles.titleInput}
        placeholder="タイトル（空欄の場合は自動付与）"
        placeholderTextColor="#94A3B8"
        value={title}
        onChangeText={setTitle}
        editable={!saving}
      />

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
            onPress={() => recorder.start()}
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

      <Text style={styles.offlineNote}>
        オフラインでも録音できます。電波が復帰すると自動でアップロードされます。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#F8FAFC' },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timerBox: { marginTop: 32, alignItems: 'center' },
  timer: {
    fontSize: 64,
    fontVariant: ['tabular-nums'],
    fontWeight: '300',
    color: '#0F172A',
  },
  status: { marginTop: 8, color: '#64748B' },
  error: { marginTop: 12, color: '#DC2626', textAlign: 'center' },
  controls: { marginTop: 32, gap: 12 },
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
});
