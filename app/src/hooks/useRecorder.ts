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

export function useRecorder() {
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
  const realRecordingRef = useRef<any>(null);
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
      if (!USE_FAKE_RECORDER && realRecordingRef.current) {
        realRecordingRef.current.stopAndUnloadAsync?.().catch(() => {});
      }
    };
  }, []);

  // フォアグラウンド復帰時、`interruption` 由来で pause していたら自動再開
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && pauseReasonRef.current === 'interruption') {
        // 自動再開を試みる（音声セッションが解放された前提）
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

  function stopMeter() {
    if (meterTickRef.current) {
      clearInterval(meterTickRef.current);
      meterTickRef.current = null;
    }
    setMeterDb(-160);
  }

  /**
   * iOS/Android で録音セッションを「他の音声を中断しない」「バックグラウンド継続」
   * に設定し、電話などの割り込みが起きてもデータが残るようにする。
   */
  async function configureAudioMode() {
    if (USE_FAKE_RECORDER) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Audio, InterruptionModeIOS, InterruptionModeAndroid } = require('expo-av');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true, // バックグラウンド・カメラ起動中も継続
      shouldDuckAndroid: true,
      // 他アプリの音声と「混ざる」モード。電話や別アプリの音声で奪われない
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });
  }

  /** 中断が解除されたら自動で再開する */
  async function resumeFromInterruption() {
    if (stateRef.current !== 'paused') return;
    if (pauseReasonRef.current !== 'interruption') return;
    try {
      if (!USE_FAKE_RECORDER && realRecordingRef.current) {
        await realRecordingRef.current.startAsync();
      }
      startTicker();
      if (USE_FAKE_RECORDER) startFakeMeter();
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

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Audio } = require('expo-av');
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setError('マイクへのアクセスが許可されていません');
        void logError('recording_failed', new Error('microphone permission denied'));
        return;
      }
      await configureAudioMode();

      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recording.setProgressUpdateInterval(200);
      recording.setOnRecordingStatusUpdate((status: any) => {
        if (typeof status?.metering === 'number') {
          setMeterDb(status.metering);
        }
        // 録音中のはずなのに iOS 側でレコーディング停止した = システム割込み
        if (status && status.canRecord === false && stateRef.current === 'recording') {
          // 電話 / 別アプリの優先 等
          stopTicker();
          stopMeter();
          if (startTimestampRef.current != null) {
            elapsedBeforePauseRef.current += Date.now() - startTimestampRef.current;
            startTimestampRef.current = null;
          }
          setPauseReason('interruption');
          setState('paused');
        }
      });
      realRecordingRef.current = recording;
      elapsedBeforePauseRef.current = 0;
      setDurationMs(0);
      setState('recording');
      setPauseReason(null);
      startTicker();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '録音開始に失敗しました';
      setError(msg);
      void logError('recording_failed', e);
    }
  }

  async function pause() {
    if (state !== 'recording') return;
    if (!USE_FAKE_RECORDER && realRecordingRef.current) {
      await realRecordingRef.current.pauseAsync();
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
    if (!USE_FAKE_RECORDER && realRecordingRef.current) {
      await realRecordingRef.current.startAsync();
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

    const rec = realRecordingRef.current;
    if (!rec) return null;
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    realRecordingRef.current = null;
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
