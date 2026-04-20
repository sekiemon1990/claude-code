import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';

import { firebaseAuth } from '@/config/firebase';
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(toAppUser(firebaseUser));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return {
    user,
    loading,
    signOut: () => signOut(firebaseAuth),
  };
}
