import { useCallback, useEffect, useState } from 'react';

import {
  getForgottenDealIds,
  markDealForgotten,
  unmarkDealForgotten,
} from '@/services/dealActions';

/**
 * 「録音忘れた」と明示的にマークした案件 ID を扱うフック。
 *
 * @param userKey ユーザーごとに分離するためのキー（メールや UID）
 */
export function useDealActions(userKey: string | null | undefined) {
  const [forgotten, setForgotten] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!userKey) {
      setForgotten(new Set());
      return;
    }
    const set = await getForgottenDealIds(userKey);
    setForgotten(set);
  }, [userKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markForgotten = useCallback(
    async (dealId: string) => {
      if (!userKey) return;
      await markDealForgotten(userKey, dealId);
      await refresh();
    },
    [userKey, refresh],
  );

  const unmarkForgotten = useCallback(
    async (dealId: string) => {
      if (!userKey) return;
      await unmarkDealForgotten(userKey, dealId);
      await refresh();
    },
    [userKey, refresh],
  );

  return { forgotten, markForgotten, unmarkForgotten, refresh };
}
