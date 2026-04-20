import { useEffect, useState } from 'react';

import { firebaseAuth } from '@/config/firebase';
import type { CrmContext } from '@/services/crm';

/**
 * CRM API 呼び出し用のコンテキスト（Firebase ID トークン + ユーザー email）を提供する。
 * トークンの期限切れに備えて、呼び出し都度 getIdToken() を使うことを推奨。
 */
export function useCrmContext(): CrmContext {
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setEmail(null);
      setToken(null);
      return;
    }
    setEmail(user.email);
    user.getIdToken().then(setToken).catch(() => setToken(null));
  }, []);

  return { userEmail: email, firebaseIdToken: token };
}
