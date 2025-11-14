import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  AuthError
} from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { UserStatus } from '../types';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // After creating the user in Auth, create their profile document in Firestore
        try {
          const userDocRef = doc(db, 'userProfiles', user.uid);
          await setDoc(userDocRef, {
              email: user.email,
              status: UserStatus.PENDING,
              accessExpiresAt: null,
              createdAt: Timestamp.now(),
          });
        } catch (dbError) {
          console.error("Firestore Error: Failed to create user profile.", dbError);
          // This is a critical error. The user is created in Auth but not in DB.
          // Inform the user and sign them out to prevent them from being in a broken state.
          setError("Account created, but failed to set up profile. Please contact the administrator.");
          await auth.signOut();
        }
      }
    } catch (err) {
      const authError = err as AuthError;
       // Don't show the generic error if we've already set a specific one for DB failure.
      if (!error) {
        setError(authError.message.replace('Firebase: ', ''));
      }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg">
        <div>
          <h1 className="text-3xl font-bold text-center text-primary">Family Expense Tracker</h1>
          <h2 className="mt-2 text-xl text-center text-gray-600 dark:text-gray-300">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAuthAction}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 dark:border-slate-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-slate-700 rounded-t-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password-sr" className="sr-only">Password</label>
              <input
                id="password-sr"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 dark:border-slate-600 placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-slate-700 rounded-b-md focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign in' : 'Sign up')}
            </button>
          </div>
        </form>
        <div className="text-sm text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="font-medium text-primary hover:text-primary-400"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};