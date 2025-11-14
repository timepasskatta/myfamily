import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, UserStatus } from '../types';

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
        const usersColRef = collection(db, 'users');
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
            const userDocRef = doc(db, 'users', uid);
            await updateDoc(userDocRef, { status, accessExpiresAt: expiresAt });
        } catch (err: any) {
            console.error("Failed to update user status:", err);
            let message = "An unexpected error occurred. Please try again.";
            if (err.code === 'permission-denied') {
                message = "Permission Denied: Ensure your Firestore security rules grant the admin full read/write access to the 'users' collection.";
            }
            setUpdateError(message);
        } finally {
            setUpdatingUser(null);
        }
    };

    const handleApprove = (uid: string, duration: '30d' | '1y' | 'life') => {
        let expiresAt: number | null = null;
        const now = Date.now();
        if (duration === '30d') expiresAt = now + 30 * 24 * 60 * 60 * 1000;
        if (duration === '1y') expiresAt = now + 365 * 24 * 60 * 60 * 1000;
        
        updateUserStatus(uid, UserStatus.APPROVED, expiresAt);
        setApprovingUserId(null);
    };

    const handleApproveCustomDate = (uid: string, dateString: string) => {
        if (!dateString) {
            setUpdateError("Please select a valid date.");
            return;
        }
        const date = new Date(dateString);
        // Set time to the end of the selected day in the user's local timezone
        date.setHours(23, 59, 59, 999);
        const expiresAt = date.getTime();
        
        updateUserStatus(uid, UserStatus.APPROVED, expiresAt);
        setApprovingUserId(null);
        setCustomDate('');
    };

    const handleReject = (uid: string) => updateUserStatus(uid, UserStatus.REJECTED);
    const handleRevoke = (uid: string) => updateUserStatus(uid, UserStatus.REJECTED);

    const renderUserList = (userList: UserProfile[], title: string) => (
        <div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white">{title} ({userList.length})</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto p-1">
                {userList.length === 0 ? <p className="text-gray-500 dark:text-gray-400">No users in this category.</p> : userList.map(user => (
                    <div key={user.id} className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-grow min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate" title={user.email}>{user.email}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 break-words">
                                UID: {user.id} <br />
                                {user.status === UserStatus.APPROVED && (user.accessExpiresAt ? `Expires: ${new Date(user.accessExpiresAt).toLocaleDateString()}` : 'Lifetime Access')}
                            </p>
                        </div>
                        <div className="flex items-center justify-end flex-wrap gap-2 flex-shrink-0 self-end sm:self-center">
                            {updatingUser === user.id ? (
                                <p className="text-sm text-gray-500 italic">Updating...</p>
                            ) : approvingUserId === user.id ? (
                                <div className="flex flex-wrap items-center justify-end gap-2 w-full">
                                    <button onClick={() => handleApprove(user.id, '30d')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">30d</button>
                                    <button onClick={() => handleApprove(user.id, '1y')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">1y</button>
                                    <button onClick={() => handleApprove(user.id, 'life')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">Life</button>
                                    <div className="flex items-center border border-gray-300 dark:border-slate-500 rounded-md">
                                        <input
                                            type="date"
                                            onChange={e => setCustomDate(e.target.value)}
                                            min={new Date().toISOString().split('T')[0]}
                                            className="p-1 text-xs bg-transparent dark:text-white focus:outline-none rounded-l-md"
                                            style={{ colorScheme: 'dark' }}
                                        />
                                        <button
                                            onClick={() => handleApproveCustomDate(user.id, customDate)}
                                            disabled={!customDate}
                                            className="px-2 py-1 text-xs bg-green-500 text-white rounded-r-md hover:bg-green-600 disabled:bg-gray-400"
                                        >
                                            Set
                                        </button>
                                    </div>
                                    <button onClick={() => setApprovingUserId(null)} className="px-2 py-1 text-xs bg-gray-500 text-white rounded-md hover:bg-gray-600">Cancel</button>
                                </div>
                            ) : (
                                <>
                                    {user.status === UserStatus.PENDING && (
                                        <>
                                            <button onClick={() => setApprovingUserId(user.id)} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600">Approve</button>
                                            <button onClick={() => handleReject(user.id)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Reject</button>
                                        </>
                                    )}
                                    {user.status === UserStatus.APPROVED && <button onClick={() => handleRevoke(user.id)} className="px-3 py-1 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600">Revoke</button>}
                                    {user.status === UserStatus.REJECTED && <button onClick={() => setApprovingUserId(user.id)} className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">Re-approve</button>}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    
    if(loading) return <p className="text-center">Loading users...</p>;
    if(error) return <p className="text-center text-red-500">{error}</p>;

    const pendingUsers = users.filter(u => u.status === UserStatus.PENDING);
    const approvedUsers = users.filter(u => u.status === UserStatus.APPROVED);
    const rejectedUsers = users.filter(u => u.status === UserStatus.REJECTED);

    return (
        <div className="space-y-6">
            {updateError && <p className="text-sm text-center font-medium text-red-500 p-2 bg-red-100 dark:bg-red-900/50 rounded-md">{updateError}</p>}
            {renderUserList(pendingUsers, "Pending Approval")}
            {renderUserList(approvedUsers, "Approved Users")}
            {renderUserList(rejectedUsers, "Rejected/Revoked Users")}
        </div>
    );
};
