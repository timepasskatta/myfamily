import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { signOut } from 'firebase/auth';
import { useFirestoreCollection } from './hooks/useFirestoreCollection';
import { useUserStatus } from './hooks/useUserStatus';

import { Category, Transaction, TransactionType, FamilyMember } from './types';
import { DEFAULT_CATEGORIES, COLORS, ICONS } from './constants';
import { Dashboard } from './components/Dashboard';
import { TransactionsList } from './components/TransactionsList';
import { Auth } from './components/Auth';
import { AdminDashboard } from './components/AdminDashboard';
import { PendingScreen, RejectedScreen, ExpiredScreen } from './components/UserStatusScreens';
import { exportToCsv, exportToJson, importFromJson } from './utils/dataUtils';

// UI Components defined in the same file to reduce file count
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md m-4 transform transition-all" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const { status, user, authLoading } = useUserStatus();
  const { data: transactions, loading: transactionsLoading, addDocument: addTransaction, updateDocument: updateTransaction, deleteDocument: deleteTransaction, addDocumentsBatch: addTransactionsBatch } = useFirestoreCollection<Transaction>('transactions');
  const { data: categories, loading: categoriesLoading, addDocument: addCategoryDoc, updateDocument: updateCategory, deleteDocument: deleteCategory, addDocumentsBatch: addCategoriesBatch } = useFirestoreCollection<Category>('categories');
  const { data: members, loading: membersLoading, addDocument: addMemberDoc, updateDocument: updateMember, deleteDocument: deleteMember } = useFirestoreCollection<FamilyMember>('members');
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'light');

  const [isAddTransactionModalOpen, setAddTransactionModalOpen] = useState(false);
  const [isManageCategoriesModalOpen, setManageCategoriesModalOpen] = useState(false);
  const [isManageMembersModalOpen, setManageMembersModalOpen] = useState(false);
  const [isBackupRestoreModalOpen, setBackupRestoreModalOpen] = useState(false);
  const [isAdminPanelOpen, setAdminPanelOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
   // Check for migration opportunity
  useEffect(() => {
    if (user && !categoriesLoading && categories.length === 0) {
      const localTransactions = localStorage.getItem('transactions');
      const localCategories = localStorage.getItem('categories');
      if (localTransactions && localCategories) {
        setShowMigrationPrompt(true);
      } else if (categories.length === 0) {
        // If no local data and no remote data, seed with defaults
        addCategoriesBatch(DEFAULT_CATEGORIES.map(({id, ...rest}) => rest));
      }
    }
  }, [user, categories, categoriesLoading, addCategoriesBatch]);


  const handleMigration = () => {
    try {
      const localTransactions: Transaction[] = JSON.parse(localStorage.getItem('transactions') || '[]');
      const localCategories: Category[] = JSON.parse(localStorage.getItem('categories') || '[]');
      
      if (localTransactions.length > 0) {
        addTransactionsBatch(localTransactions.map(({id, ...rest}) => rest));
      }
      if (localCategories.length > 0) {
        const sanitizedCategories = localCategories.map(({id, ...c}) => ({...c, icon: ICONS[c.name.toUpperCase() as keyof typeof ICONS] || ICONS.OTHER }));
        addCategoriesBatch(sanitizedCategories);
      }
      
      alert("Data migrated successfully!");
      localStorage.removeItem('transactions');
      localStorage.removeItem('categories');
      setShowMigrationPrompt(false);

    } catch (error) {
      alert("An error occurred during migration.");
      console.error("Migration error: ", error);
    }
  }

  const toggleTheme = () => setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));

  const handleAddOrUpdateTransaction = (transaction: Omit<Transaction, 'id'> & { id?: string }) => {
    if (transaction.id) {
      const {id, ...dataToUpdate} = transaction;
      updateTransaction(id, dataToUpdate);
    } else {
      const {id, ...dataToAdd} = transaction;
      addTransaction(dataToAdd);
    }
    setAddTransactionModalOpen(false);
    setEditingTransaction(null);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setAddTransactionModalOpen(true);
  };

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(id);
    }
  };

  const handleAddOrUpdateCategory = (category: Omit<Category, 'id'> | Category) => {
    if ('id' in category) {
      const { id, ...dataToUpdate} = category;
      updateCategory(id, dataToUpdate);
    } else {
      addCategoryDoc(category);
    }
    // Bug Fix: Clear form after submission
    // This logic is now handled inside the ManageCategoriesModal component
  };
  
  const handleDeleteCategory = (id: string) => {
      if(transactions.some(t => t.categoryId === id)) {
          alert("Cannot delete category with associated transactions. Please re-assign them first.");
          return;
      }
      if (window.confirm('Are you sure you want to delete this category?')) {
          deleteCategory(id);
      }
  }

  const handleAddOrUpdateMember = (member: Omit<FamilyMember, 'id'> | FamilyMember) => {
    if ('id' in member) {
      const { id, ...dataToUpdate } = member;
      updateMember(id, dataToUpdate);
    } else {
      addMemberDoc(member);
    }
    // Bug Fix: Clear form after submission
    // This logic is now handled inside the ManageMembersModal component
  };

  const handleDeleteMember = (id: string) => {
    if (transactions.some(t => t.memberId === id)) {
        alert("Cannot delete a member with associated transactions. Please re-assign their transactions first.");
        return;
    }
    if (window.confirm('Are you sure you want to delete this family member?')) {
        deleteMember(id);
    }
  };
  
  const handleRestore = (file: File) => {
    importFromJson(file, (data) => {
        if(window.confirm('This will overwrite your current data on the server. Are you sure?')) {
            const sanitizedCategories = data.categories.map(c => ({...c, icon: ICONS[c.name.toUpperCase() as keyof typeof ICONS] || ICONS.OTHER }));
            addTransactionsBatch(data.transactions.map(({id, ...rest}) => rest));
            addCategoriesBatch(sanitizedCategories.map(({id, ...rest}) => rest));
            alert('Data restored successfully!');
            setBackupRestoreModalOpen(false);
        }
    });
  }

  if (authLoading || status === 'loading') {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
            <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Loading Application...</h1>
        </div>
    )
  }

  switch(status) {
    case 'no-auth':
      return <Auth />;
    case 'pending':
      return <PendingScreen />;
    case 'rejected':
      return <RejectedScreen />;
    case 'expired':
      return <ExpiredScreen />;
    case 'admin':
    case 'approved':
      // User is approved or is the admin, show the main app
      break; // fallthrough to render the app
    default:
       return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
            <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-300">An unexpected error occurred.</h1>
        </div>
      )
  }


  return (
    <div className="min-h-screen text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      {showMigrationPrompt && (
        <div className="bg-yellow-100 dark:bg-yellow-900 border-l-4 border-yellow-500 text-yellow-700 dark:text-yellow-200 p-4" role="alert">
          <p className="font-bold">Welcome Back!</p>
          <p>We've found data in your browser from your previous session. Would you like to import it to your account?</p>
          <div className="mt-2">
            <button onClick={handleMigration} className="bg-yellow-500 text-white font-bold py-1 px-3 rounded text-xs mr-2">Import Data</button>
            <button onClick={() => setShowMigrationPrompt(false)} className="bg-transparent text-yellow-700 dark:text-yellow-200 font-semibold py-1 px-3 text-xs">Dismiss</button>
          </div>
        </div>
      )}
      <header className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-lg sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary">Family Expense<br className="block sm:hidden" /> Tracker</h1>
          <div className="flex items-center space-x-1 sm:space-x-2">
            {status === 'admin' && (
               <button onClick={() => setAdminPanelOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Admin Panel">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </button>
            )}
            <span className="text-sm hidden md:inline">{user?.email}</span>
            <button onClick={() => setManageMembersModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Manage Members">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.274-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.274.356-1.857m0 0a3.001 3.001 0 015.644 0M12 12a3 3 0 100-6 3 3 0 000 6z" /></svg>
            </button>
            <button onClick={() => setManageCategoriesModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Manage Categories">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </button>
            <button onClick={() => setBackupRestoreModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Backup and Restore">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Toggle Theme">
            {theme === 'light' ? 
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> :
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            }
            </button>
             <button onClick={() => signOut(auth)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Logout">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {(transactionsLoading || categoriesLoading || membersLoading) ? <p>Loading data...</p> : (
            <>
                <Dashboard transactions={transactions} categories={categories} members={members} />
                <TransactionsList transactions={transactions} categories={categories} members={members} onEdit={handleEditTransaction} onDelete={handleDeleteTransaction}/>
            </>
        )}
      </main>

       <button onClick={() => setAddTransactionModalOpen(true)} className="sm:hidden fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-lg z-30" aria-label="Add Transaction">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
      </button>

      {/* Modals */}
      <Modal isOpen={isAdminPanelOpen} onClose={() => setAdminPanelOpen(false)} title="Admin Panel">
        <AdminDashboard />
      </Modal>
      <AddTransactionModal 
        isOpen={isAddTransactionModalOpen}
        onClose={() => { setAddTransactionModalOpen(false); setEditingTransaction(null); }}
        onSubmit={handleAddOrUpdateTransaction}
        categories={categories}
        members={members}
        transaction={editingTransaction}
      />
      <ManageCategoriesModal 
        isOpen={isManageCategoriesModalOpen}
        onClose={() => setManageCategoriesModalOpen(false)}
        categories={categories}
        onAddOrUpdate={handleAddOrUpdateCategory}
        onDelete={handleDeleteCategory}
      />
      <ManageMembersModal
        isOpen={isManageMembersModalOpen}
        onClose={() => setManageMembersModalOpen(false)}
        members={members}
        onAddOrUpdate={handleAddOrUpdateMember}
        onDelete={handleDeleteMember}
      />
      <BackupRestoreModal 
        isOpen={isBackupRestoreModalOpen}
        onClose={() => setBackupRestoreModalOpen(false)}
        onExportCsv={() => exportToCsv(transactions, categories)}
        onExportJson={() => exportToJson(transactions, categories)}
        onRestore={handleRestore}
      />
    </div>
  );
}


// Transaction Modal Component
const AddTransactionModal: React.FC<{ isOpen: boolean; onClose: () => void; onSubmit: (data: any) => void; categories: Category[]; members: FamilyMember[]; transaction: Transaction | null; }> = ({ isOpen, onClose, onSubmit, categories, members, transaction }) => {
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [memberId, setMemberId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setCategoryId(transaction.categoryId);
      setMemberId(transaction.memberId);
      setDate(transaction.date);
      setDescription(transaction.description);
    } else {
      // Reset form
      setType(TransactionType.EXPENSE);
      setAmount('');
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setMemberId(undefined);
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    }
  }, [transaction, isOpen, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !date) {
      alert('Please fill all required fields');
      return;
    }
    onSubmit({ id: transaction?.id, type, amount: parseFloat(amount), categoryId, date, description, memberId });
  };
  
  const incomeCategoryNames = ['Salary', 'Gifts', 'Other'];
  const filteredCategories = categories.filter(c => (type === 'income' ? incomeCategoryNames.includes(c.name) : true));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={transaction ? 'Edit Transaction' : 'Add Transaction'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
          <button type="button" onClick={() => setType(TransactionType.EXPENSE)} className={`w-1/2 p-2 rounded-md font-semibold transition-colors ${type === 'expense' ? 'bg-white dark:bg-primary shadow text-primary dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>Expense</button>
          <button type="button" onClick={() => setType(TransactionType.INCOME)} className={`w-1/2 p-2 rounded-md font-semibold transition-colors ${type === 'income' ? 'bg-white dark:bg-primary shadow text-primary dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>Income</button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent" />
        </div>
         <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent">
                <option value="">Select Category</option>
                {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Member</label>
              <select value={memberId || ''} onChange={e => setMemberId(e.target.value || undefined)} className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent">
                <option value="">Family Pool</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Weekly groceries" className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent" />
        </div>
        <button type="submit" className="w-full bg-primary text-white p-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">{transaction ? 'Update' : 'Add'} Transaction</button>
      </form>
    </Modal>
  );
};

const ManageCategoriesModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    categories: Category[];
    onAddOrUpdate: (category: Omit<Category, 'id'> | Category) => void; 
    onDelete: (id: string) => void; 
}> = ({isOpen, onClose, categories, onAddOrUpdate, onDelete}) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState(COLORS[0]);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    useEffect(() => {
      if (editingCategory) {
        setName(editingCategory.name);
        setColor(editingCategory.color);
      } else {
        setName('');
        setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
      }
    }, [editingCategory, isOpen]);


    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !color) return;
        
        if (editingCategory) {
            onAddOrUpdate({ ...editingCategory, name: name.trim(), color });
        } else {
            const iconKey = name.trim().toUpperCase() as keyof typeof ICONS;
            onAddOrUpdate({ name: name.trim(), color, icon: ICONS[iconKey] || ICONS.OTHER });
        }
        setEditingCategory(null);
        setName('');
        setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Categories">
            <div className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-3 pb-4 border-b dark:border-slate-700">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Category name" required className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                    <div className="flex items-center space-x-2">
                      <label htmlFor="color-picker" className="text-sm font-medium text-gray-700 dark:text-gray-300">Color:</label>
                      <input id="color-picker" type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-md p-0 border-none cursor-pointer bg-transparent" />
                      <div className="flex-grow flex items-center space-x-2 justify-end">
                        {editingCategory && <button type="button" onClick={() => setEditingCategory(null)} className="bg-gray-200 dark:bg-slate-600 text-black dark:text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">Cancel</button>}
                        <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">{editingCategory ? 'Update' : 'Add'}</button>
                      </div>
                    </div>
                </form>
                <div className="max-h-60 overflow-y-auto space-y-2">
                    {categories.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-slate-700">
                            <div className="flex items-center space-x-3">
                                <span className="w-6 h-6 rounded-full flex-shrink-0" style={{backgroundColor: c.color}}></span>
                                <span>{c.name}</span>
                            </div>
                            <div className='flex items-center'>
                                <button onClick={() => setEditingCategory(c)} className="p-2 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => onDelete(c.id)} className="p-2 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

const ManageMembersModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  members: FamilyMember[];
  onAddOrUpdate: (member: Omit<FamilyMember, 'id'> | FamilyMember) => void;
  onDelete: (id: string) => void;
}> = ({ isOpen, onClose, members, onAddOrUpdate, onDelete }) => {
    const [name, setName] = useState('');
    const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);

    useEffect(() => {
        if(editingMember) setName(editingMember.name);
        else setName('');
    }, [editingMember, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        if(editingMember) {
            onAddOrUpdate({ ...editingMember, name: name.trim() });
        } else {
            onAddOrUpdate({ name: name.trim() });
        }
        setEditingMember(null);
        setName('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Family Members">
            <div className="space-y-4">
                <form onSubmit={handleSubmit} className="space-y-3 pb-4 border-b dark:border-slate-700">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Member name" required className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
                    <div className="flex justify-end space-x-2">
                        {editingMember && <button type="button" onClick={() => setEditingMember(null)} className="bg-gray-200 dark:bg-slate-600 text-black dark:text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">Cancel</button>}
                        <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">{editingMember ? 'Update' : 'Add'}</button>
                    </div>
                </form>
                <div className="max-h-60 overflow-y-auto space-y-2">
                    {members.map(m => (
                        <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-slate-700">
                           <span>{m.name}</span>
                            <div className='flex items-center'>
                                <button onClick={() => setEditingMember(m)} className="p-2 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
                                </button>
                                <button onClick={() => onDelete(m.id)} className="p-2 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
    )
}

const BackupRestoreModal: React.FC<{isOpen: boolean, onClose: () => void, onExportCsv: () => void, onExportJson: () => void, onRestore: (file: File) => void }> = ({isOpen, onClose, onExportCsv, onExportJson, onRestore}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files && e.target.files[0]) {
            onRestore(e.target.files[0]);
            e.target.value = ''; // Reset file input
        }
    }
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Backup & Restore">
            <div className="space-y-6">
                <div>
                    <h3 className="font-semibold mb-2 text-lg dark:text-gray-200">Export Data</h3>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                        <button onClick={onExportCsv} className="w-full text-center bg-green-500 text-white p-3 rounded-lg font-semibold hover:bg-green-600 transition-colors">Export as CSV</button>
                        <button onClick={onExportJson} className="w-full text-center bg-blue-500 text-white p-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors">Backup as JSON</button>
                    </div>
                </div>
                <div>
                    <h3 className="font-semibold mb-2 text-lg dark:text-gray-200">Restore Data from JSON</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">This will add the data from the backup file to your account. It will not delete existing data.</p>
                    <input type="file" accept=".json" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="w-full text-center bg-orange-500 text-white p-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors">Restore from JSON</button>
                </div>
            </div>
        </Modal>
    )
}

export default App;