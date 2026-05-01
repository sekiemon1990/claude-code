import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RecordingStatus } from '@/types';

const LABELS: Record<RecordingStatus, string> = {
  recording: '録音中',
  uploading: 'アップロード中',
  uploaded: '待機中',
  transcribing: '文字起こし中',
  transcribed: '文字起こし完了',
  generating_minutes: '議事録生成中',
  completed: '完了',
  failed: 'エラー',
};

const COLORS: Record<RecordingStatus, { bg: string; fg: string }> = {
  recording: { bg: '#FEE2E2', fg: '#991B1B' },
  uploading: { bg: '#E0F2FE', fg: '#075985' },
  uploaded: { bg: '#E0F2FE', fg: '#075985' },
  transcribing: { bg: '#FEF3C7', fg: '#92400E' },
  transcribed: { bg: '#FEF3C7', fg: '#92400E' },
  generating_minutes: { bg: '#FEF3C7', fg: '#92400E' },
  completed: { bg: '#DCFCE7', fg: '#166534' },
  failed: { bg: '#FEE2E2', fg: '#991B1B' },
};

type Props = { status: RecordingStatus };

export function StatusBadge({ status }: Props) {
  const { bg, fg } = COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
