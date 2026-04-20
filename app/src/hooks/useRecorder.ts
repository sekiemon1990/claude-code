import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

export function useRecorder() {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
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
      recordingRef.current = recording;
      elapsedBeforePauseRef.current = 0;
      setDurationMs(0);
      setState('recording');
      startTicker();
    } catch (e) {
      setError(e instanceof Error ? e.message : '録音開始に失敗しました');
    }
  }

  async function pause() {
    if (!recordingRef.current || state !== 'recording') return;
    await recordingRef.current.pauseAsync();
    stopTicker();
    if (startTimestampRef.current != null) {
      elapsedBeforePauseRef.current += Date.now() - startTimestampRef.current;
      startTimestampRef.current = null;
    }
    setState('paused');
  }

  async function resume() {
    if (!recordingRef.current || state !== 'paused') return;
    await recordingRef.current.startAsync();
    startTicker();
    setState('recording');
  }

  async function stop(): Promise<{ uri: string; durationMs: number } | null> {
    const rec = recordingRef.current;
    if (!rec) return null;
    stopTicker();
    await rec.stopAndUnloadAsync();
    const finalDuration =
      state === 'recording' && startTimestampRef.current != null
        ? elapsedBeforePauseRef.current + (Date.now() - startTimestampRef.current)
        : elapsedBeforePauseRef.current;
    const uri = rec.getURI();
    recordingRef.current = null;
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
