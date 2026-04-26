import { useCallback, useEffect, useState } from 'react';

import { fetchAssignedScheduledDeals } from '@/services/crm';
import type { Deal } from '@/types';

import { useCrmContext } from './useCrmContext';

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 今日の予約案件を取得する。
 * - 既存の `fetchAssignedScheduledDeals` をそのまま流用（オフライン時は
 *   キャッシュ）
 * - 取得結果を「予約日が今日」でフィルタしてソート
 */
export function useTodayDeals() {
  const crm = useCrmContext();
  const [allTodayDeals, setAllTodayDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'network' | 'cache' | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAssignedScheduledDeals(crm);
      const today = new Date();
      const filtered = result.deals.filter((d) =>
        isSameDay(new Date(d.reservationAt), today),
      );
      setAllTodayDeals(filtered);
      setSource(result.source);
    } catch {
      setAllTodayDeals([]);
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, [crm]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { todayDeals: allTodayDeals, loading, source, reload };
}
