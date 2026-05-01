"use client";

import { useEffect, useRef } from "react";
import {
  getOfflineQueue,
  removeFromOfflineQueue,
  useOfflineQueue,
} from "@/lib/offline-queue";
import { addItemToList } from "@/lib/list";
import { recordSearchKeyword } from "@/lib/api/search-keywords";
import { toast } from "@/lib/toast";

/**
 * オフライン検索キューの自動排出。
 *
 * - online 復帰時に保留中の検索を順次 addItemToList で実行
 * - 既にオンライン且つキューがあれば mount 時に即排出
 */
export function OfflineQueueDrainer() {
  const { isOnline, count } = useOfflineQueue();
  const drainingRef = useRef(false);

  useEffect(() => {
    if (!isOnline || count === 0 || drainingRef.current) return;

    drainingRef.current = true;
    (async () => {
      const items = getOfflineQueue();
      if (items.length === 0) {
        drainingRef.current = false;
        return;
      }

      let succeeded = 0;
      let failed = 0;
      for (const it of items) {
        try {
          const added = await addItemToList(it.query);
          if (added) {
            recordSearchKeyword(it.query.keyword).catch(() => {});
            succeeded++;
            removeFromOfflineQueue(it.id);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      if (succeeded > 0) {
        toast({
          message: `保留していた検索 ${succeeded} 件を実行しました`,
          actionLabel: "リストを見る",
          actionHref: "/list",
        });
      }
      if (failed > 0 && succeeded === 0) {
        toast({
          message: `保留検索の実行に失敗しました (${failed} 件)。後で /list から再実行してください`,
          variant: "error",
        });
      }
      drainingRef.current = false;
    })();
  }, [isOnline, count]);

  return null;
}
