import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { UserProfile, UserStatus } from '../types';
import { ADMIN_UID } from '../adminConfig';

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

    const isAdmin = user.uid === ADMIN_UID;
    if (isAdmin) {
      setStatus('admin');
      setProfile(null); 
      return;
    }

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
        // User exists in Auth, but not in our 'users' collection. Attempt to create it.
        setDoc(userDocRef, {
            email: user.email,
            status: UserStatus.PENDING,
            accessExpiresAt: null,
            createdAt: serverTimestamp(),
        }).catch(error => {
            // This is a critical failure, likely due to Firestore security rules.
            // The user cannot use the app without a profile. Fallback to a rejected state.
            console.error("CRITICAL: Failed to create user profile. This is likely a Firestore security rule issue.", error);
            setStatus('rejected');
        });
        // The onSnapshot listener will automatically pick up the new doc if creation is successful.
        // If it fails, we've already set the status to 'rejected'.
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