import { useCallback, useEffect, useState } from 'react';

import { fetchRecentCompletedDeals } from '@/services/crm';
import type { Deal } from '@/types';

import { useCrmContext } from './useCrmContext';

/**
 * 過去 N 日 (デフォルト90日) で CRM 上「完了」になっている自分担当の案件を取得する。
 * アプリ側の recordings.dealId と突き合わせることで「録音漏れ」を検知する。
 *
 * 期間フィルタ（1週間 / 1ヶ月 / 3ヶ月 / 当月 / 期間指定）はダッシュボード側で
 * client-side に行う前提で、最大期間 (90日) を取得しておく。
 */
export function useRecentCompletedDeals(days = 90) {
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
