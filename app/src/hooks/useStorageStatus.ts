import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system';

// しきい値（バイト）
const WARN_THRESHOLD = 500 * 1024 * 1024; //  500MB
const CRITICAL_THRESHOLD = 100 * 1024 * 1024; //  100MB
const POLL_INTERVAL_MS = 60 * 1000;

export type StorageLevel = 'ok' | 'warning' | 'critical';

export type StorageStatus = {
  level: StorageLevel;
  freeBytes: number | null;
  check: () => Promise<void>;
};

export function useStorageStatus(): StorageStatus {
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [level, setLevel] = useState<StorageLevel>('ok');

  const check = useCallback(async () => {
    try {
      const free = await FileSystem.getFreeDiskStorageAsync();
      setFreeBytes(free);
      if (free < CRITICAL_THRESHOLD) {
        setLevel('critical');
      } else if (free < WARN_THRESHOLD) {
        setLevel('warning');
      } else {
        setLevel('ok');
      }
    } catch {
      // 計測失敗時は OK 扱い（警告を誤表示しない）
      setLevel('ok');
    }
  }, []);

  useEffect(() => {
    void check();
    const interval = setInterval(() => void check(), POLL_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [check]);

  return { level, freeBytes, check };
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}
