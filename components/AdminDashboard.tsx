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
                        <div className="flex items-center space-x-2 flex-shrink-0 self-end sm:self-center">
                            {updatingUser === user.id ? (
                                <p className="text-sm text-gray-500 italic">Updating...</p>
                            ) : (
                                <>
                                    {user.status === UserStatus.PENDING && (
                                        <>
                                            <div className="relative group">
                                                <button className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600">Approve</button>
                                                <div className="absolute right-0 bottom-full mb-2 w-32 bg-white dark:bg-slate-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-10 border dark:border-slate-600">
                                                    <button onClick={() => handleApprove(user.id, '30d')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 rounded-t-md">30 Days</button>
                                                    <button onClick={() => handleApprove(user.id, '1y')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600">1 Year</button>
                                                    <button onClick={() => handleApprove(user.id, 'life')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-600 rounded-b-md">Lifetime</button>
                                                </div>
                                            </div>
                                            <button onClick={() => handleReject(user.id)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Reject</button>
                                        </>
                                    )}
                                    {user.status === UserStatus.APPROVED && <button onClick={() => handleRevoke(user.id)} className="px-3 py-1 text-sm bg-yellow-500 text-white rounded-md hover:bg-yellow-600">Revoke</button>}
                                    {user.status === UserStatus.REJECTED && <button onClick={() => handleApprove(user.id, 'life')} className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">Re-approve</button>}
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