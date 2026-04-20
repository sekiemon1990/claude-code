import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { DEMO_MODE } from '@/demo';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

// DEMO / web 環境ではネイティブ録音モジュールが動かないため、
// タイマーのみで状態遷移を模擬する。
const USE_FAKE_RECORDER = DEMO_MODE || Platform.OS === 'web';

export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);
  const realRecordingRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (!USE_FAKE_RECORDER && realRecordingRef.current) {
        realRecordingRef.current.stopAndUnloadAsync?.().catch(() => {});
      }
    };
  }, []);

  function startTicker() {
    if (tickRef.current) clearInterval(tickRef.current);
    startTimestampRef.current = Date.now();
    tickRef.current = setInterval(() => {
      if (startTimestampRef.current == null) return;
      const now = Date.now();
      setDurationMs(elapsedBeforePauseRef.current + (now - startTimestampRef.current));
    }, 250);
  }

  function stopTicker() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function start() {
    try {
      setError(null);

      if (USE_FAKE_RECORDER) {
        elapsedBeforePauseRef.current = 0;
        setDurationMs(0);
        setState('recording');
        startTicker();
        return;
      }

      // 実機モード: expo-av を動的 require（Web バンドルに混入しないように）
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Audio } = require('expo-av');
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setError('マイクへのアクセスが許可されていません');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      realRecordingRef.current = recording;
      elapsedBeforePauseRef.current = 0;
      setDurationMs(0);
      setState('recording');
      startTicker();
    } catch (e) {
      setError(e instanceof Error ? e.message : '録音開始に失敗しました');
    }
  }

  async function pause() {
    if (state !== 'recording') return;
    if (!USE_FAKE_RECORDER && realRecordingRef.current) {
      await realRecordingRef.current.pauseAsync();
    }
    stopTicker();
    if (startTimestampRef.current != null) {
      elapsedBeforePauseRef.current += Date.now() - startTimestampRef.current;
      startTimestampRef.current = null;
    }
    setState('paused');
  }

  async function resume() {
    if (state !== 'paused') return;
    if (!USE_FAKE_RECORDER && realRecordingRef.current) {
      await realRecordingRef.current.startAsync();
    }
    startTicker();
    setState('recording');
  }

  async function stop(): Promise<{ uri: string; durationMs: number } | null> {
    stopTicker();
    const finalDuration =
      state === 'recording' && startTimestampRef.current != null
        ? elapsedBeforePauseRef.current + (Date.now() - startTimestampRef.current)
        : elapsedBeforePauseRef.current;

    if (USE_FAKE_RECORDER) {
      setState('stopped');
      setDurationMs(finalDuration);
      return { uri: `demo://fake-recording-${Date.now()}.m4a`, durationMs: finalDuration };
    }

    const rec = realRecordingRef.current;
    if (!rec) return null;
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    realRecordingRef.current = null;
    setState('stopped');
    setDurationMs(finalDuration);
    if (!uri) return null;
    return { uri, durationMs: finalDuration };
  }

  function reset() {
    setState('idle');
    setDurationMs(0);
    elapsedBeforePauseRef.current = 0;
    startTimestampRef.current = null;
  }

  return { state, durationMs, error, start, pause, resume, stop, reset };
}
