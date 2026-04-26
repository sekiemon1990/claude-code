import { useCallback, useEffect, useState } from 'react';

import { fetchAssignedScheduledDeals } from '@/services/crm';
import type { Deal } from '@/types';

import { useCrmContext } from './useCrmContext';

const NEAR_FUTURE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24時間
const NEAR_PAST_WINDOW_MS = 6 * 60 * 60 * 1000; // 6時間（直前にズレた案件を拾うため）

/**
 * 直近の予約案件を取得する。
 * - 既存の `fetchAssignedScheduledDeals` をそのまま流用（オフライン時はキャッシュ）
 * - 取得結果を「今から24時間以内 + 直近6時間以内に過ぎた案件」でフィルタ
 *
 * 当日扱いを「カレンダー上の今日」で見るとカレンダー深夜帯（23時に
 * 開いた時の翌1時の予約など）がフィルタアウトされてしまうため、
 * 「今からの相対時間」で判定する。
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
      const now = Date.now();
      const filtered = result.deals.filter((d) => {
        const t = new Date(d.reservationAt).getTime();
        return t >= now - NEAR_PAST_WINDOW_MS && t <= now + NEAR_FUTURE_WINDOW_MS;
      });
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
