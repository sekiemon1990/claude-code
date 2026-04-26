import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Deal } from '@/types';

const KEY_PREFIX = '@deals_cache/';
const META_PREFIX = '@deals_cache_meta/';

type Meta = { fetchedAt: number };

/**
 * 案件一覧のローカルキャッシュ。
 * オフライン時に直近の案件リストから選択できるようにする。
 * ユーザーごとに分けて保存（複数アカウントでログインし直す可能性のため）。
 */
export async function setCachedDeals(userKey: string, deals: Deal[]): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + userKey, JSON.stringify(deals));
  const meta: Meta = { fetchedAt: Date.now() };
  await AsyncStorage.setItem(META_PREFIX + userKey, JSON.stringify(meta));
}

export async function getCachedDeals(
  userKey: string,
): Promise<{ deals: Deal[]; fetchedAt: number } | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + userKey);
  if (!raw) return null;
  const metaRaw = await AsyncStorage.getItem(META_PREFIX + userKey);
  let meta: Meta = { fetchedAt: 0 };
  if (metaRaw) {
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      // ignore
    }
  }
  try {
    const deals = JSON.parse(raw) as Deal[];
    return { deals, fetchedAt: meta.fetchedAt };
  } catch {
    return null;
  }
}

export async function clearCachedDeals(userKey: string): Promise<void> {
  await AsyncStorage.removeItem(KEY_PREFIX + userKey);
  await AsyncStorage.removeItem(META_PREFIX + userKey);
}
