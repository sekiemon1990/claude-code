import { useEffect, useRef, useState } from 'react';

import { firebaseAuth, type FirebaseUser } from '@/config/firebase';
import { DEMO_MODE, DEMO_USER } from '@/demo';
import type { AppUser } from '@/types';

function toAppUser(user: FirebaseUser | null): AppUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoURL,
  };
}

const AUTH_BOOT_TIMEOUT_MS = 4000;

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(DEMO_MODE ? DEMO_USER : null);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const settledRef = useRef(false);

  useEffect(() => {
    if (DEMO_MODE) return;
    const unsubscribe = firebaseAuth.onAuthStateChanged((firebaseUser) => {
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
      if (DEMO_MODE) return;
      await firebaseAuth.signOut();
    },
  };
}
