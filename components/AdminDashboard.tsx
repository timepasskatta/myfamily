import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, UserStatus } from '../types';
import { signOut, User } from 'firebase/auth';

export const AdminDashboard: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingUser, setUpdatingUser] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
    const [customDate, setCustomDate] = useState('');


    useEffect(() => {
        setLoading(true);
        const usersColRef = collection(db, 'userProfiles');
        const unsubscribe = onSnapshot(usersColRef, (snapshot) => {
            const userList: UserProfile[] = [];
            snapshot.forEach(doc => userList.push({ id: doc.id, ...doc.data() } as UserProfile));
            // Sort by creation date, newest first
            setUsers(userList.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
            setLoading(false);
        }, (err) => {
            console.error("Error fetching users:", err);
            setError("Failed to load user data.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateUserStatus = async (uid: string, status: UserStatus, expiresAt: number | null = null) => {
        setUpdatingUser(uid);
        setUpdateError(null);
        try {
            const userDocRef = doc(db, 'userProfiles', uid);
            await updateDoc(userDocRef, { status, accessExpiresAt: expiresAt });
        } catch (err: any) {
            console.error("Failed to update user status:", err);
            let message = "An unexpected error occurred. Please try again.";
            if (err.code === 'permission-denied') {
                message = "Permission Denied: Ensure your Firestore security rules grant the admin full read/write access to the 'userProfiles' collection.";
            }
            setUpdateError(message);
        } finally {
            setUpdatingUser(null);
            setApprovingUserId(null);
            setCustomDate('');
        }
    };

    const handleApprove = (uid: string, duration: '30d' | '1y' | 'life' | 'custom') => {
        let expiresAt: number | null = null;
        const now = Date.now();
        if (duration === '30d') expiresAt = now + 30 * 24 * 60 * 60 * 1000;
        else if (duration === '1y') expiresAt = now + 365 * 24 * 60 * 60 * 1000;
        else if (duration === 'life') expiresAt = null;
        else if (duration === 'custom') {
            if (!customDate) {
                setUpdateError("Please select a valid date.");
                return;
            }
            const date = new Date(customDate);
            date.setHours(23, 59, 59, 999); // Set to end of day
            expiresAt = date.getTime();
             if (expiresAt < now) {
                setUpdateError("Custom date cannot be in the past.");
                return;
            }
        }
        
        updateUserStatus(uid, UserStatus.APPROVED, expiresAt);
    };

    const handleReject = (uid: string) => updateUserStatus(uid, UserStatus.REJECTED);
    const handleRevoke = (uid: string) => updateUserStatus(uid, UserStatus.REJECTED);
    
    const startApproval = (uid: string) => {
      setApprovingUserId(uid);
      setCustomDate('');
      setUpdateError(null);
    }

    const renderUserList = (userList: UserProfile[], title: string, listType: 'pending' | 'active' | 'expired' | 'rejected') => (
        <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">{title} ({userList.length})</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto p-1">
                {userList.length === 0 ? <p className="text-gray-500 dark:text-gray-400">No users in this category.</p> : userList.map(user => (
                    <div key={user.id} className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-grow min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate" title={user.email}>{user.email}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 break-words">
                                {(listType === 'active' || listType === 'expired') && user.accessExpiresAt
                                    ? `Expires: ${new Date(user.accessExpiresAt).toLocaleDateString()}`
                                    : (listType === 'active' || listType === 'expired') && !user.accessExpiresAt
                                        ? 'Lifetime Access'
                                        : `UID: ${user.id}`
                                }
                            </p>
                        </div>
                        <div className="flex items-center justify-end flex-wrap gap-2 flex-shrink-0 self-end sm:self-center">
                            {updatingUser === user.id ? (
                                <p className="text-sm text-gray-500 italic">Updating...</p>
                            ) : (
                                <>
                                    {approvingUserId !== user.id && (
                                        <>
                                            {listType === 'pending' && (
                                                <>
                                                    <button onClick={() => startApproval(user.id)} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600">Approve</button>
                                                    <button onClick={() => handleReject(user.id)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Reject</button>
                                                </>
                                            )}
                                            {listType === 'active' && <button onClick={() => handleRevoke(user.id)} className="px-3 py-1 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600">Revoke</button>}
                                            {(listType === 'rejected' || listType === 'expired') && <button onClick={() => startApproval(user.id)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">Re-approve</button>}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                         {approvingUserId === user.id && (
                            <div className="w-full pt-3 mt-3 border-t border-gray-200 dark:border-slate-600 flex flex-col gap-3">
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Set Access Duration:</p>
                                <div className="flex flex-wrap items-center gap-2">
                                     <button onClick={() => handleApprove(user.id, '30d')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">30 Days</button>
                                    <button onClick={() => handleApprove(user.id, '1y')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">1 Year</button>
                                    <button onClick={() => handleApprove(user.id, 'life')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">Lifetime</button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        onChange={e => setCustomDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="p-1 text-sm bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        style={{ colorScheme: 'dark' }}
                                    />
                                    <button
                                        onClick={() => handleApprove(user.id, 'custom')}
                                        disabled={!customDate}
                                        className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        Set Date
                                    </button>
                                </div>
                                <button onClick={() => setApprovingUserId(null)} className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 self-start">Cancel</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
    
    if(loading) return <p className="text-center">Loading users...</p>;
    if(error) return <p className="text-center text-red-500">{error}</p>;

    const now = Date.now();
    const pendingUsers = users.filter(u => u.status === UserStatus.PENDING);
    const approvedUsers = users.filter(u => u.status === UserStatus.APPROVED);
    const rejectedUsers = users.filter(u => u.status === UserStatus.REJECTED);

    const activeUsers = approvedUsers.filter(u => !u.accessExpiresAt || u.accessExpiresAt >= now);
    const expiredUsers = approvedUsers.filter(u => u.accessExpiresAt && u.accessExpiresAt < now);


    return (
        <div className="space-y-6">
            {updateError && <p className="text-sm text-center font-medium text-red-500 p-2 bg-red-100 dark:bg-red-900/50 rounded-md">{updateError}</p>}
            {renderUserList(pendingUsers, "Pending Approval", 'pending')}
            {renderUserList(activeUsers, "Active Users", 'active')}
            {renderUserList(expiredUsers, "Expired Users", 'expired')}
            {renderUserList(rejectedUsers, "Rejected/Revoked Users", 'rejected')}
        </div>
    );
};

export const AdminPage: React.FC<{ user: User }> = ({ user }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-gray-200">
      <header className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">Admin Panel</h1>
          <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-sm hidden md:inline">{user?.email}</span>
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Toggle Theme">
                {theme === 'light' ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            </button>
            <button onClick={() => signOut(auth)} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-800 text-red-500 transition-colors" aria-label="Sign Out">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <AdminDashboard />
      </main>
    </div>
  );
};