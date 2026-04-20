import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = { percent: number; color?: string };

export function ProgressBar({ percent, color = '#2563EB' }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
});
