import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import type { Recording } from '@/types';

type Props = {
  recording: Recording;
  onPress: () => void;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 6000;

/**
 * 録音が completed に遷移した時に画面上部に出すトースト。
 * 実機ビルドでは push 通知（FCM）と併用するが、フォアグラウンドで
 * アプリを開いている場合の通知体験はこのトーストで担う。
 */
export function CompletionToast({ recording, onPress, onDismiss }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [opacity, onDismiss]);

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="box-none">
      <Pressable style={styles.toast} onPress={onPress}>
        <Text style={styles.icon}>✓</Text>
        <Text style={styles.text} numberOfLines={2}>
          議事録が完成しました{'\n'}
          <Text style={styles.subtext}>
            {recording.dealSnapshot?.customerName ?? recording.title} - タップで詳細
          </Text>
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  toast: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  icon: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '700',
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1 },
  subtext: { fontSize: 12, fontWeight: '500' },
});
