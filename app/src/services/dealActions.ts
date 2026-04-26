import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 案件ごとのユーザーアクション履歴。
 * 「録音忘れた」と明示的にマークした案件 ID を保持する。
 *
 * 本番では Firestore に保存して別端末でも共有可能にすべきだが、
 * MVP では AsyncStorage（端末ローカル）で十分。
 *
 * 「録音した」については別途記録は不要：
 *   recordings コレクションに dealId 一致のレコードがあれば「録音済」
 */

const KEY_PREFIX = '@deal_forgotten/';

function key(userKey: string): string {
  return KEY_PREFIX + userKey;
}

export async function getForgottenDealIds(userKey: string): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(key(userKey));
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export async function markDealForgotten(userKey: string, dealId: string): Promise<void> {
  const set = await getForgottenDealIds(userKey);
  set.add(dealId);
  await AsyncStorage.setItem(key(userKey), JSON.stringify([...set]));
}

export async function unmarkDealForgotten(userKey: string, dealId: string): Promise<void> {
  const set = await getForgottenDealIds(userKey);
  set.delete(dealId);
  await AsyncStorage.setItem(key(userKey), JSON.stringify([...set]));
}
