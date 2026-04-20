import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format } from 'date-fns';

import { useAuth } from '@/hooks/useAuth';
import { subscribeToRecordings } from '@/services/recordings';
import { StatusBadge } from '@/components/StatusBadge';
import type { Recording } from '@/types';

type Props = {
  onSelect: (recordingId: string) => void;
  onNewRecording: () => void;
  onSignOut: () => void;
};

export function RecordingListScreen({ onSelect, onNewRecording, onSignOut }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Recording[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToRecordings(user.uid, (recordings) => {
      setItems(recordings);
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>商談一覧</Text>
        <Pressable onPress={onSignOut}>
          <Text style={styles.signOut}>ログアウト</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={!loaded} onRefresh={() => {}} />}
        contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.listContent}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>まだ録音はありません</Text>
              <Text style={styles.emptyBody}>
                下の「新規録音」から商談の録音を開始できます。
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onSelect(item.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowMeta}>
                {item.createdAt
                  ? format(item.createdAt.toDate(), 'yyyy-MM-dd HH:mm')
                  : ''}
                {'  ·  '}
                {Math.round(item.durationMs / 1000)}秒
              </Text>
              <View style={{ marginTop: 6 }}>
                <StatusBadge status={item.status} />
              </View>
            </View>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={onNewRecording}>
        <Text style={styles.fabText}>+ 新規録音</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  signOut: { color: '#64748B' },
  listContent: { padding: 16, paddingBottom: 120 },
  emptyContent: { flex: 1, justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  emptyBody: {
    marginTop: 6,
    color: '#64748B',
    textAlign: 'center',
    fontSize: 14,
  },
  row: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  rowMeta: { marginTop: 4, color: '#64748B', fontSize: 13 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700' },
});
