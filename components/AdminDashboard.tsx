import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, UserStatus } from '../types';
import { signOut, User } from 'firebase/auth';

// --- Reusable Icon Components ---
const Icon: React.FC<{ path: string }> = ({ path }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);
const DashboardIcon = () => <Icon path="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h-2a2 2 0 01-2-2v-6a2 2 0 012-2h2m6 0h2a2 2 0 002-2v-6a2 2 0 00-2-2h-2m-6 0H9a2 2 0 00-2 2v6a2 2 0 002 2h2" />;
const UsersIcon = () => <Icon path="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.995 5.995 0 0112 12.75a5.995 5.995 0 01-3-1.003m0 0A4 4 0 0012 4.354a4 4 0 00-3 7.397" />;
const LogoutIcon = () => <Icon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />;
const SunIcon = () => <Icon path="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />;
const MoonIcon = () => <Icon path="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />;


// --- Data Fetching Hook ---
const useUsers = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        const usersColRef = collection(db, 'users');
        const unsubscribe = onSnapshot(usersColRef, (snapshot) => {
            const userList: UserProfile[] = [];
            snapshot.forEach(doc => userList.push({ id: doc.id, ...doc.data() } as UserProfile));
            setUsers(userList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
            setLoading(false);
        }, (err) => {
            console.error("Error fetching users:", err);
            setError(err.code === 'permission-denied'
                ? "Permission Denied: Ensure Firestore rules grant admin access."
                : "Failed to load user data."
            );
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return { users, loading, error };
};

// --- Main Admin Page Component ---
const AdminPage: React.FC<{ user: User }> = ({ user }) => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');
    const [view, setView] = useState('dashboard');
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const { users, loading, error } = useUsers();

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const NavItem: React.FC<{
        icon: React.ReactNode,
        label: string,
        isActive: boolean,
        onClick: () => void,
    }> = ({ icon, label, isActive, onClick }) => (
        <button onClick={onClick} className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${isActive ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}>
            {icon}
            <span className="ml-3">{label}</span>
        </button>
    );

    const renderContent = () => {
        if (loading) return <div className="flex items-center justify-center h-full"><p>Loading...</p></div>;
        if (error) return <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>;

        const otherUsers = users.filter(u => u.id !== user.id);
        if (view === 'dashboard') return <DashboardView users={otherUsers} />;
        if (view === 'users') return <UserManagementView users={otherUsers} />;
        return null;
    };

    return (
        <div className="min-h-screen flex text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-slate-900">
             {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-800 shadow-lg transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:shadow-none`}>
                <div className="p-4">
                    <h1 className="text-2xl font-bold text-primary">Admin Panel</h1>
                </div>
                <nav className="p-4 space-y-2">
                    <NavItem icon={<DashboardIcon />} label="Dashboard" isActive={view === 'dashboard'} onClick={() => { setView('dashboard'); setSidebarOpen(false);}} />
                    <NavItem icon={<UsersIcon />} label="User Management" isActive={view === 'users'} onClick={() => { setView('users'); setSidebarOpen(false); }} />
                </nav>
            </aside>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg sticky top-0 z-40 shadow-sm flex items-center justify-between p-4">
                    <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700">
                        <Icon path="M4 6h16M4 12h16M4 18h16" />
                    </button>
                    <div className="flex-1"></div>
                    <div className="flex items-center space-x-4">
                        <span className="text-sm hidden sm:inline">{user.email}</span>
                        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700">{theme === 'light' ? <MoonIcon /> : <SunIcon />}</button>
                        <button onClick={() => signOut(auth)} className="p-2 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"><LogoutIcon /></button>
                    </div>
                </header>

                <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                    {renderContent()}
                </main>
            </div>
             {isSidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-40 md:hidden"></div>}
        </div>
    );
};

// --- Dashboard View ---
const StatCard: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md flex items-center gap-4">
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-3xl font-bold">{value}</p>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        </div>
    </div>
);

const DashboardView: React.FC<{ users: UserProfile[] }> = ({ users }) => {
    const pending = users.filter(u => u.status === 'pending').length;
    const active = users.filter(u => u.status === 'approved' && (!u.accessExpiresAt || u.accessExpiresAt >= Date.now())).length;
    const expiredOrRejected = users.length - pending - active;
    const recentUsers = users.slice(0, 5);

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold">Dashboard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Users" value={users.length} icon={<UsersIcon />} color="bg-blue-100 text-blue-600" />
                <StatCard title="Pending Approval" value={pending} icon={<Icon path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />} color="bg-yellow-100 text-yellow-600" />
                <StatCard title="Active Users" value={active} icon={<Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />} color="bg-green-100 text-green-600" />
                <StatCard title="Rejected / Expired" value={expiredOrRejected} icon={<Icon path="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />} color="bg-red-100 text-red-600" />
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                <h3 className="text-xl font-semibold mb-4">Recent Sign-ups</h3>
                <div className="space-y-3">
                    {recentUsers.length > 0 ? recentUsers.map(u => (
                         <div key={u.id} className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50">
                             <div>
                                <p className="font-medium">{u.email}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Joined on {new Date(u.createdAt.seconds * 1000).toLocaleDateString()}</p>
                             </div>
                             <StatusBadge status={u.status} expiresAt={u.accessExpiresAt} />
                         </div>
                    )) : <p className="text-gray-500 dark:text-gray-400">No recent user activity.</p>}
                </div>
            </div>
        </div>
    );
};

// --- User Management View ---
const StatusBadge: React.FC<{ status: UserStatus, expiresAt?: number | null }> = ({ status, expiresAt }) => {
    const isExpired = status === 'approved' && expiresAt && expiresAt < Date.now();
    const effectiveStatus = isExpired ? 'Expired' : status.charAt(0).toUpperCase() + status.slice(1);

    const colors = {
        Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        Approved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        Rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        Expired: 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300',
    };
    
    return <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${colors[effectiveStatus as keyof typeof colors]}`}>{effectiveStatus}</span>
};

const UserManagementView: React.FC<{ users: UserProfile[] }> = ({ users }) => {
    type Tab = 'pending' | 'active' | 'expired' | 'rejected';
    const [currentTab, setCurrentTab] = useState<Tab>('pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingUser, setUpdatingUser] = useState<string | null>(null);
    const [updateError, setUpdateError] = useState('');
    const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
    const [customDate, setCustomDate] = useState('');

    const filteredUsers = useMemo(() => {
        const now = Date.now();
        const byStatus = {
            pending: users.filter(u => u.status === 'pending'),
            active: users.filter(u => u.status === 'approved' && (!u.accessExpiresAt || u.accessExpiresAt >= now)),
            expired: users.filter(u => u.status === 'approved' && u.accessExpiresAt && u.accessExpiresAt < now),
            rejected: users.filter(u => u.status === 'rejected'),
        };
        return byStatus[currentTab].filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [users, currentTab, searchTerm]);

    const updateUser = async (uid: string, status: UserStatus, expiresAt: number | null = null) => {
        setUpdatingUser(uid);
        setUpdateError('');
        try {
            await updateDoc(doc(db, 'users', uid), { status, accessExpiresAt: expiresAt });
        } catch (err: any) {
            setUpdateError("Failed to update user. Check permissions.");
            console.error(err);
        } finally {
            setUpdatingUser(null);
            setApprovingUserId(null);
        }
    };
    
    const handleApprove = (uid: string, duration: '30d' | '1y' | 'life' | 'custom') => {
        let expiresAt: number | null = null;
        const now = Date.now();
        if (duration === '30d') expiresAt = now + 30 * 24 * 60 * 60 * 1000;
        else if (duration === '1y') expiresAt = now + 365 * 24 * 60 * 60 * 1000;
        else if (duration === 'life') expiresAt = null;
        else if (duration === 'custom' && customDate) {
            const date = new Date(customDate);
            date.setHours(23, 59, 59, 999);
            if (date.getTime() < now) { setUpdateError("Date cannot be in the past."); return; }
            expiresAt = date.getTime();
        } else { return; }
        updateUser(uid, UserStatus.APPROVED, expiresAt);
    };

    const ApprovalForm: React.FC<{ uid: string }> = ({ uid }) => (
        <div className="w-full pt-3 mt-3 border-t border-gray-200 dark:border-slate-600 flex flex-col gap-3">
            <p className="text-sm font-semibold">Set Access Duration:</p>
            <div className="flex flex-wrap items-center gap-2">
                 <button onClick={() => handleApprove(uid, '30d')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">30 Days</button>
                <button onClick={() => handleApprove(uid, '1y')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">1 Year</button>
                <button onClick={() => handleApprove(uid, 'life')} className="px-2 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">Lifetime</button>
            </div>
            <div className="flex items-center gap-2">
                <input type="date" onChange={e => setCustomDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="p-1 text-sm bg-gray-100 dark:bg-slate-600 border border-gray-300 dark:border-slate-500 rounded-md" style={{ colorScheme: 'dark' }}/>
                <button onClick={() => handleApprove(uid, 'custom')} disabled={!customDate} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400">Set Date</button>
            </div>
            <button onClick={() => setApprovingUserId(null)} className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 self-start">Cancel</button>
        </div>
    );
    
    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold">User Management</h2>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                    <div className="relative flex-grow">
                         <input type="text" placeholder="Search by email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                         <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                           <Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                         </div>
                    </div>
                    <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-1 self-start sm:self-center">
                        {(['pending', 'active', 'expired', 'rejected'] as Tab[]).map(tab => (
                            <button key={tab} onClick={() => setCurrentTab(tab)} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 capitalize ${currentTab === tab ? 'bg-white dark:bg-primary text-primary dark:text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>{tab}</button>
                        ))}
                    </div>
                </div>

                {updateError && <p className="text-sm text-center font-medium text-red-500 p-2 bg-red-100 dark:bg-red-900/50 rounded-md my-2">{updateError}</p>}
                
                <div className="space-y-3">
                    {filteredUsers.length > 0 ? filteredUsers.map(user => (
                        <div key={user.id} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                             <div className="flex-grow min-w-0">
                                <p className="font-medium truncate">{user.email}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Joined: {new Date(user.createdAt.seconds * 1000).toLocaleDateString()} | 
                                    Expires: {user.accessExpiresAt ? new Date(user.accessExpiresAt).toLocaleDateString() : 'Never'}
                                </p>
                             </div>
                             <div className="flex items-center justify-end gap-2 flex-shrink-0 self-end sm:self-center">
                                 <StatusBadge status={user.status} expiresAt={user.accessExpiresAt} />
                                 {updatingUser === user.id ? <p className="text-sm italic">Updating...</p> : (approvingUserId !== user.id &&
                                    <>
                                        {currentTab === 'pending' && <button onClick={() => setApprovingUserId(user.id)} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Approve</button>}
                                        {currentTab === 'pending' && <button onClick={() => updateUser(user.id, UserStatus.REJECTED)} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Reject</button>}
                                        {currentTab === 'active' && <button onClick={() => updateUser(user.id, UserStatus.REJECTED)} className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600">Revoke</button>}
                                        {(currentTab === 'rejected' || currentTab === 'expired') && <button onClick={() => setApprovingUserId(user.id)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">Re-approve</button>}
                                    </>
                                 )}
                             </div>
                             {approvingUserId === user.id && <ApprovalForm uid={user.id} />}
                        </div>
                    )) : <p className="text-center py-4 text-gray-500">No users found in this category.</p>}
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
