import { useEffect, useMemo, useState } from 'react';

import { firebaseAuth } from '@/config/firebase';
import type { CrmContext } from '@/services/crm';
import { useAuth } from './useAuth';

/**
 * CRM API 呼び出し用のコンテキスト（Firebase ID トークン + ユーザー email）を提供する。
 *
 * email は `useAuth` 経由で取得するので、本番（Firebase 認証）と DEMO の両方で同じ
 * 流れで動く（DEMO では DEMO_USER の email がそのまま使われる）。
 *
 * トークンは本番時のみ Firebase から取得する。
 *
 * 戻り値は `useMemo` で安定化している。これを怠ると、利用側で `useCallback`/
 * `useEffect` の依存配列に渡した時に毎レンダー新オブジェクト扱いされ、無限再
 * レンダーループの原因になる。
 */
export function useCrmContext(): CrmContext {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) {
      setToken(null);
      return;
    }
    fbUser
      .getIdToken()
      .then((t: string) => setToken(t))
      .catch(() => setToken(null));
  }, [user?.uid]);

  return useMemo(
    () => ({ userEmail: user?.email ?? null, firebaseIdToken: token }),
    [user?.email, token],
  );
}
