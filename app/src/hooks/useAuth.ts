import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';

import { firebaseAuth } from '@/config/firebase';
import { DEMO_MODE, DEMO_USER } from '@/demo';
import type { AppUser } from '@/types';

function toAppUser(user: User | null): AppUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoURL,
  };
}

// Firebase の onAuthStateChanged が一度も発火しないと、loading=true のまま
// 真っ白なスピナー画面で固まる。実機 (Hermes/RN 0.79) では稀に初回発火が
// 来ない事象があるため、4 秒経っても応答が無ければログイン画面に進める。
const AUTH_BOOT_TIMEOUT_MS = 4000;

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(DEMO_MODE ? DEMO_USER : null);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const settledRef = useRef(false);

  useEffect(() => {
    if (DEMO_MODE) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      settledRef.current = true;
      setUser(toAppUser(firebaseUser));
      setLoading(false);
    });
    const timeout = setTimeout(() => {
      if (!settledRef.current) {
        // eslint-disable-next-line no-console
        console.warn('[useAuth] onAuthStateChanged did not fire within timeout; showing login screen');
        setLoading(false);
      }
    }, AUTH_BOOT_TIMEOUT_MS);
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    signOut: async () => {
      if (DEMO_MODE) {
        // デモモードではログアウトせず何もしない（即ログインに戻るため）
        return;
      }
      await signOut(firebaseAuth);
    },
  };
}
