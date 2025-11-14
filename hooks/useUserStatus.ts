import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { UserProfile, UserStatus } from '../types';
import { ADMIN_EMAIL } from '../adminConfig';

type CurrentStatus = 'loading' | 'no-auth' | 'admin' | 'approved' | 'pending' | 'rejected' | 'expired';

export function useUserStatus() {
  const [user, authLoading] = useAuthState(auth);
  const [status, setStatus] = useState<CurrentStatus>('loading');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      return;
    }

    if (!user) {
      setStatus('no-auth');
      setProfile(null);
      return;
    }

    const isAdmin = user.email === ADMIN_EMAIL;
    if (isAdmin) {
      setStatus('admin');
      setProfile(null); 
      return;
    }

    // FIX: Changed path from 'userProfiles' to 'users' to align with the new unified data structure.
    const userDocRef = doc(db, 'users', user.uid);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const userProfile = { id: docSnap.id, ...docSnap.data() } as UserProfile;
        setProfile(userProfile);

        if (userProfile.status === UserStatus.REJECTED) {
          setStatus('rejected');
        } else if (userProfile.status === UserStatus.PENDING) {
          setStatus('pending');
        } else if (userProfile.status === UserStatus.APPROVED) {
          const now = Date.now();
          if (userProfile.accessExpiresAt && userProfile.accessExpiresAt < now) {
            setStatus('expired');
          } else {
            setStatus('approved');
          }
        }
      } else {
        // With the new logic, a user should always have a profile upon sign-up.
        // If they don't, it's an error state. Treat them as rejected.
        console.warn(`User ${user.uid} is authenticated but has no profile document.`);
        setStatus('rejected');
      }
    }, (error) => {
        console.error("Error listening to user status:", error);
        // Fallback to a safe state if we can't even read the doc
        setStatus('rejected');
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  return { status, user, profile, authLoading };
}