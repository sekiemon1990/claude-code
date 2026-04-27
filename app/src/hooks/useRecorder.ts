import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { DEMO_MODE } from '@/demo';
import { logError } from '@/services/errorLog';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * 録音中断の理由を区別する。
 * - user: ユーザーが手動で一時停止した
 * - interruption: 電話の着信や他アプリの音声優先など、システム要因で一時停止
 *   （ユーザーが解除すれば自動的に再開される）
 */
export type PauseReason = 'user' | 'interruption' | null;

// DEMO / web 環境ではネイティブ録音モジュールが動かないため、
// タイマーのみで状態遷移を模擬する。
const USE_FAKE_RECORDER = DEMO_MODE || Platform.OS === 'web';

/**
 * expo-audio を使った録音フック（SDK 55+）。
 * 旧 expo-av からの移行版：API が変わっているがフックが返すインターフェースは
 * 互換に保ち、画面側のコードは変更不要にしている。
 */
export function useRecorder() {
  // expo-audio を動的 require（DEMO / web ではモジュール評価を避ける）
  // useAudioRecorder はフックなので、必ず最上位で呼ぶ必要がある
  const audioRecorder = useNativeAudioRecorder();

  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** -160 (silence) 〜 0 (max). 録音中以外は -160 */
  const [meterDb, setMeterDb] = useState(-160);
  /** ユーザー意図 / システム中断のどちらで pause しているか */
  const [pauseReason, setPauseReason] = useState<PauseReason>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);
  const stateRef = useRef<RecorderState>('idle');
  const pauseReasonRef = useRef<PauseReason>(null);

  // 内部参照を最新の state に同期
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    pauseReasonRef.current = pauseReason;
  }, [pauseReason]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (meterTickRef.current) clearInterval(meterTickRef.current);
    };
  }, []);

  // フォアグラウンド復帰時、`interruption` 由来で pause していたら自動再開
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && pauseReasonRef.current === 'interruption') {
        void resumeFromInterruption();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function startFakeMeter() {
    if (meterTickRef.current) clearInterval(meterTickRef.current);
    let phase = 0;
    meterTickRef.current = setInterval(() => {
      phase += 0.4;
      const base = -33 + Math.sin(phase) * 12 + (Math.random() - 0.5) * 8;
      setMeterDb(Math.max(-60, Math.min(0, base)));
    }, 100);
  }

  function startNativeMeter() {
    if (meterTickRef.current) clearInterval(meterTickRef.current);
    meterTickRef.current = setInterval(() => {
      const m = audioRecorder?.metering;
      if (typeof m === 'number') setMeterDb(m);
    }, 200);
  }

  function stopMeter() {
    if (meterTickRef.current) {
      clearInterval(meterTickRef.current);
      meterTickRef.current = null;
    }
    setMeterDb(-160);
  }

  /** 中断が解除されたら自動で再開する */
  async function resumeFromInterruption() {
    if (stateRef.current !== 'paused') return;
    if (pauseReasonRef.current !== 'interruption') return;
    try {
      if (!USE_FAKE_RECORDER && audioRecorder) {
        audioRecorder.record();
        startNativeMeter();
      } else if (USE_FAKE_RECORDER) {
        startFakeMeter();
      }
      startTicker();
      setPauseReason(null);
      setState('recording');
    } catch (e) {
      void logError('recording_failed', e, { phase: 'resume_from_interruption' });
    }
  }

  async function start() {
    try {
      setError(null);

      if (USE_FAKE_RECORDER) {
        elapsedBeforePauseRef.current = 0;
        setDurationMs(0);
        setState('recording');
        setPauseReason(null);
        startTicker();
        startFakeMeter();
        return;
      }

      if (!audioRecorder) {
        throw new Error('expo-audio recorder is not initialized');
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { AudioModule, setAudioModeAsync } = require('expo-audio');

      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('マイクへのアクセスが許可されていません');
        void logError('recording_failed', new Error('microphone permission denied'));
        return;
      }

      // 電話などの割込みが起きてもデータが残るように音声モードを設定
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        shouldRouteThroughEarpiece: false,
        // バックグラウンド継続（カメラ起動中等）
        shouldPlayInBackground: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      elapsedBeforePauseRef.current = 0;
      setDurationMs(0);
      setState('recording');
      setPauseReason(null);
      startTicker();
      startNativeMeter();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '録音開始に失敗しました';
      setError(msg);
      void logError('recording_failed', e);
    }
  }

  async function pause() {
    if (state !== 'recording') return;
    if (!USE_FAKE_RECORDER && audioRecorder) {
      audioRecorder.pause();
    }
    stopTicker();
    stopMeter();
    if (startTimestampRef.current != null) {
      elapsedBeforePauseRef.current += Date.now() - startTimestampRef.current;
      startTimestampRef.current = null;
    }
    setPauseReason('user');
    setState('paused');
  }

  async function resume() {
    if (state !== 'paused') return;
    if (!USE_FAKE_RECORDER && audioRecorder) {
      audioRecorder.record();
      startNativeMeter();
    } else if (USE_FAKE_RECORDER) {
      startFakeMeter();
    }
    startTicker();
    setPauseReason(null);
    setState('recording');
  }

  async function stop(): Promise<{ uri: string; durationMs: number } | null> {
    stopTicker();
    stopMeter();
    const finalDuration =
      state === 'recording' && startTimestampRef.current != null
        ? elapsedBeforePauseRef.current + (Date.now() - startTimestampRef.current)
        : elapsedBeforePauseRef.current;

    if (USE_FAKE_RECORDER) {
      setState('stopped');
      setDurationMs(finalDuration);
      setPauseReason(null);
      return { uri: `demo://fake-recording-${Date.now()}.m4a`, durationMs: finalDuration };
    }

    if (!audioRecorder) return null;
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    setState('stopped');
    setDurationMs(finalDuration);
    setPauseReason(null);
    if (!uri) return null;
    return { uri, durationMs: finalDuration };
  }

  function reset() {
    setState('idle');
    setDurationMs(0);
    elapsedBeforePauseRef.current = 0;
    startTimestampRef.current = null;
    setPauseReason(null);
  }

  return {
    state,
    durationMs,
    meterDb,
    error,
    pauseReason,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}

/**
 * expo-audio の useAudioRecorder を、DEMO / web ではダミーで返すラッパー。
 * フックなので必ず最上位で呼ぶが、内部で動的 require して評価コストを抑える。
 */
function useNativeAudioRecorder(): any {
  if (USE_FAKE_RECORDER) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useAudioRecorder, RecordingPresets } = require('expo-audio');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAudioRecorder(RecordingPresets.HIGH_QUALITY);
}
