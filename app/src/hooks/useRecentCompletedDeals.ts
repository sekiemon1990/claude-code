import { useCallback, useEffect, useState } from 'react';

import { fetchRecentCompletedDeals } from '@/services/crm';
import type { Deal } from '@/types';

import { useCrmContext } from './useCrmContext';

/**
 * 過去 N 日 (デフォルト7日) で CRM 上「完了」になっている自分担当の案件を取得する。
 * アプリ側の recordings.dealId と突き合わせることで「録音漏れ」を検知する。
 */
export function useRecentCompletedDeals(days = 7) {
  const crm = useCrmContext();
  const [completedDeals, setCompletedDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchRecentCompletedDeals(crm, days);
      setCompletedDeals(list);
    } catch {
      setCompletedDeals([]);
    } finally {
      setLoading(false);
    }
  }, [crm, days]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { completedDeals, loading, reload };
}
