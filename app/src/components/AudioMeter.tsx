import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  /** -160 (silence) 〜 0 (max) [dB] */
  level: number;
  active: boolean;
};

const SEGMENTS = 20;

/**
 * 録音中のマイク入力レベルを示す簡易メーター。
 * 緑→黄→赤のグラデーションで音量を視覚化し、マイクが拾っているかを確認する。
 */
export function AudioMeter({ level, active }: Props) {
  // -60dB〜0dB を 0〜1 にマッピング
  const normalized = Math.max(0, Math.min(1, (level + 60) / 60));
  const litCount = active ? Math.round(normalized * SEGMENTS) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.bars}>
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const lit = i < litCount;
          const color = i < SEGMENTS * 0.6 ? '#22C55E' : i < SEGMENTS * 0.85 ? '#F59E0B' : '#EF4444';
          return (
            <View
              key={i}
              style={[
                styles.bar,
                { backgroundColor: lit ? color : '#E2E8F0', opacity: lit ? 1 : 0.6 },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.label}>
        {active
          ? litCount === 0
            ? '無音（マイク未検出？）'
            : litCount < SEGMENTS * 0.3
            ? '小さい'
            : litCount < SEGMENTS * 0.85
            ? '良好'
            : '大きすぎ'
          : '待機中'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 12 },
  bars: {
    flexDirection: 'row',
    gap: 3,
    height: 22,
  },
  bar: {
    width: 6,
    height: 22,
    borderRadius: 2,
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});
