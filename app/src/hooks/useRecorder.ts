import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { DEMO_MODE } from '@/demo';
import { logError } from '@/services/errorLog';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * 録音中断の理由を区別する。
 * - user: ユーザーが手動で一時停止した
 * - interruption: 電話の着信や他アプリの音声優先など、システム要因で一時停止
 */
export type PauseReason = 'user' | 'interruption' | null;

const USE_FAKE_RECORDER = DEMO_MODE || Platform.OS === 'web';

/**
 * expo-av を使った録音フック。SDK 51 / RN 0.74 で安定動作する。
 * (expo-audio は v0.4 系がランタイムで Obj-C 例外を投げる事象があったため
 *  expo-av へ戻している)
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [meterDb, setMeterDb] = useState(-160);
  const [pauseReason, setPauseReason] = useState<PauseReason>(null);

  const recordingRef = useRef<any>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const meterTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);
  const stateRef = useRef<RecorderState>('idle');
  const pauseReasonRef = useRef<PauseReason>(null);
  const stoppingRef = useRef(false);

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
      if (recordingRef.current && !USE_FAKE_RECORDER) {
        try {
          recordingRef.current.stopAndUnloadAsync();
        } catch {
          // ignore
        }
      }
    };
  }, []);

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

  function stopMeter() {
    if (meterTickRef.current) {
      clearInterval(meterTickRef.current);
      meterTickRef.current = null;
    }
    setMeterDb(-160);
  }

  /**
   * OS による割り込み（電話着信、他アプリ音声優先など）で録音が止まったときに呼ばれる。
   * native 側はすでに pause 済みなので pauseAsync は呼ばず、UI 側の状態だけ整える。
   */
  function enterInterruption() {
    if (stateRef.current !== 'recording') return;
    if (pauseReasonRef.current === 'interruption') return; // すでに割り込み中
    stopTicker();
    stopMeter();
    if (startTimestampRef.current != null) {
      elapsedBeforePauseRef.current += Date.now() - startTimestampRef.current;
      startTimestampRef.current = null;
    }
    setPauseReason('interruption');
    setState('paused');
  }

  /**
   * iOS の AVAudioSession がリセットされたケース（入力ソース消失など）。
   * 録音セッションは復帰不能のため、エラー表示のうえ停止扱いにする。
   */
  function handleMediaServicesReset() {
    if (stateRef.current === 'stopped' || stateRef.current === 'idle') return;
    // stop() 実行中の status callback 連打でログ/エラーがスパムされないようにする
    if (stoppingRef.current) return;
    void logError('recording_failed', new Error('mediaServicesDidReset'), {
      phase: 'media_services_reset',
    });
    setError('マイクが利用できなくなりました。もう一度録音を開始してください');
    void stop();
  }

  async function resumeFromInterruption() {
    if (stateRef.current !== 'paused') return;
    if (pauseReasonRef.current !== 'interruption') return;

    if (USE_FAKE_RECORDER) {
      startFakeMeter();
      startTicker();
      setPauseReason(null);
      setState('recording');
      return;
    }

    if (!recordingRef.current) {
      // 復帰対象がない: 整理してユーザーに次のアクションを促す
      setError('録音を再開できませんでした。もう一度録音を開始してください');
      setPauseReason(null);
      void stop();
      return;
    }

    try {
      // iOS: 割り込み中に AVAudioSession が deactivate されている可能性があるため、
      // startAsync の前にセッションを再アクティブ化する
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      await recordingRef.current.startAsync();
      startTicker();
      setPauseReason(null);
      setState('recording');
    } catch (e) {
      void logError('recording_failed', e, { phase: 'resume_from_interruption' });
      setError('録音を再開できませんでした。もう一度録音を開始してください');
      setPauseReason(null);
      void stop();
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

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status: any) => {
          if (status?.metering != null && typeof status.metering === 'number') {
            setMeterDb(status.metering);
          }
          // iOS: 入力ソース消失等で AVAudioSession がリセットされた場合は復帰不能
          if (status?.mediaServicesDidReset === true) {
            handleMediaServicesReset();
            return;
          }
          // OS による割り込み (電話着信等): native 側で録音が止まっているが
          // ユーザー操作の pause ではないケースを検知して 'interruption' に遷移。
          // stop() 実行中（stoppingRef）の遷移途中 status は除外する。
          if (
            stateRef.current === 'recording' &&
            pauseReasonRef.current !== 'user' &&
            !stoppingRef.current &&
            status?.isRecording === false &&
            status?.isDoneRecording !== true
          ) {
            enterInterruption();
          }
        },
        200,
      );
      recordingRef.current = recording;

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
    // status callback とのレース対策: pauseAsync を await する前に
    // 同期で ref を更新し、割り込み判定 (pauseReason !== 'user') に弾かれるようにする
    pauseReasonRef.current = 'user';
    if (!USE_FAKE_RECORDER && recordingRef.current) {
      try {
        await recordingRef.current.pauseAsync();
      } catch (e) {
        void logError('recording_failed', e, { phase: 'pause' });
      }
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
    if (!USE_FAKE_RECORDER && recordingRef.current) {
      try {
        await recordingRef.current.startAsync();
      } catch (e) {
        void logError('recording_failed', e, { phase: 'resume' });
      }
    } else if (USE_FAKE_RECORDER) {
      startFakeMeter();
    }
    startTicker();
    setPauseReason(null);
    setState('recording');
  }

  async function stop(): Promise<{ uri: string; durationMs: number } | null> {
    // 二度呼び防止: 1回目の停止処理が完了するまで以降の呼び出しは null を返す
    if (stoppingRef.current) return null;
    stoppingRef.current = true;

    stopTicker();
    stopMeter();
    const finalDuration =
      state === 'recording' && startTimestampRef.current != null
        ? elapsedBeforePauseRef.current + (Date.now() - startTimestampRef.current)
        : elapsedBeforePauseRef.current;

    try {
      if (USE_FAKE_RECORDER) {
        return { uri: `demo://fake-recording-${Date.now()}.m4a`, durationMs: finalDuration };
      }

      const ref = recordingRef.current;
      if (!ref) return null;

      try {
        await ref.stopAndUnloadAsync();
      } catch (e) {
        void logError('recording_failed', e, { phase: 'stop' });
      }

      let uri: string | null = null;
      try {
        uri = ref.getURI?.() ?? null;
      } catch (e) {
        void logError('recording_failed', e, { phase: 'getURI' });
      }

      if (!uri) return null;
      return { uri, durationMs: finalDuration };
    } finally {
      // どの経路を通っても UI が「録音中」のまま固まらないようにする
      recordingRef.current = null;
      setState('stopped');
      setDurationMs(finalDuration);
      setPauseReason(null);
      stoppingRef.current = false;
    }
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
