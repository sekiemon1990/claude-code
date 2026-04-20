import { useEffect, useState } from 'react';
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

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(DEMO_MODE ? DEMO_USER : null);
  const [loading, setLoading] = useState(!DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE) return;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(toAppUser(firebaseUser));
      setLoading(false);
    });
    return unsubscribe;
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
