import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { format } from 'date-fns';

import { useRecorder } from '@/hooks/useRecorder';
import { useAuth } from '@/hooks/useAuth';
import { createRecordingAndUpload } from '@/services/recordings';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

type Props = { onDone: (recordingId: string) => void };

export function RecordScreen({ onDone }: Props) {
  const { user } = useAuth();
  const recorder = useRecorder();
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  async function handleStop() {
    const result = await recorder.stop();
    if (!result || !user) return;

    const finalTitle =
      title.trim() || `商談 ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;

    setUploading(true);
    try {
      const { recordingId } = await createRecordingAndUpload({
        ownerUid: user.uid,
        title: finalTitle,
        localUri: result.uri,
        durationMs: result.durationMs,
        onProgress: setUploadProgress,
      });
      recorder.reset();
      setTitle('');
      setUploadProgress(0);
      onDone(recordingId);
    } catch (e) {
      Alert.alert('アップロード失敗', e instanceof Error ? e.message : '不明なエラー');
    } finally {
      setUploading(false);
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
        editable={!uploading}
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

      {uploading ? (
        <View style={styles.uploadBox}>
          <ActivityIndicator />
          <Text style={styles.uploadText}>
            アップロード中... {uploadProgress}%
          </Text>
        </View>
      ) : (
        <View style={styles.controls}>
          {isIdle || recorder.state === 'stopped' ? (
            <Pressable
              style={[styles.mainBtn, styles.startBtn]}
              onPress={() => recorder.start()}
            >
              <Text style={styles.mainBtnText}>録音開始</Text>
            </Pressable>
          ) : null}

          {isRecording ? (
            <>
              <Pressable
                style={[styles.secondaryBtn]}
                onPress={() => recorder.pause()}
              >
                <Text style={styles.secondaryBtnText}>一時停止</Text>
              </Pressable>
              <Pressable
                style={[styles.mainBtn, styles.stopBtn]}
                onPress={handleStop}
              >
                <Text style={styles.mainBtnText}>停止してアップロード</Text>
              </Pressable>
            </>
          ) : null}

          {isPaused ? (
            <>
              <Pressable
                style={[styles.secondaryBtn]}
                onPress={() => recorder.resume()}
              >
                <Text style={styles.secondaryBtnText}>再開</Text>
              </Pressable>
              <Pressable
                style={[styles.mainBtn, styles.stopBtn]}
                onPress={handleStop}
              >
                <Text style={styles.mainBtnText}>停止してアップロード</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
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
  timerBox: {
    marginTop: 32,
    alignItems: 'center',
  },
  timer: {
    fontSize: 64,
    fontVariant: ['tabular-nums'],
    fontWeight: '300',
    color: '#0F172A',
  },
  status: {
    marginTop: 8,
    color: '#64748B',
  },
  error: {
    marginTop: 12,
    color: '#DC2626',
    textAlign: 'center',
  },
  uploadBox: {
    marginTop: 32,
    alignItems: 'center',
    gap: 8,
  },
  uploadText: {
    color: '#475569',
  },
  controls: {
    marginTop: 32,
    gap: 12,
  },
  mainBtn: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  startBtn: { backgroundColor: '#DC2626' },
  stopBtn: { backgroundColor: '#0F172A' },
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
});
