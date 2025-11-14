import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { signOut, User } from 'firebase/auth';
import { useFirestoreCollection } from './hooks/useFirestoreCollection';
import { useUserStatus } from './hooks/useUserStatus';

import { Category, Transaction, TransactionType, FamilyMember } from './types';
import { DEFAULT_CATEGORIES, COLORS, ICONS, DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES } from './constants';
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
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md m-4 transform transition-all" onClick={e => e.stopPropagation()}>
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
  const { data: members, loading: membersLoading, addDocument: addMemberDoc, updateDocument: updateMember, deleteDocument: deleteMember, addDocumentsBatch: addMembersBatch } = useFirestoreCollection<FamilyMember>('members');
  
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
        addCategoriesBatch(DEFAULT_CATEGORIES);
        // Add a default member if none exist
        if (members.length === 0) {
          addMemberDoc({ name: "Default Member" });
        }
      }
    }
  }, [user, categories, categoriesLoading, addCategoriesBatch, members, addMemberDoc]);


  const handleMigration = () => {
    try {
      const localTransactions: Transaction[] = JSON.parse(localStorage.getItem('transactions') || '[]');
      // This type assertion is needed because old local categories don't have the new fields
      const localCategories: any[] = JSON.parse(localStorage.getItem('categories') || '[]');
      
      if (localTransactions.length > 0) {
        addTransactionsBatch(localTransactions.map(({id, ...rest}) => rest));
      }
      if (localCategories.length > 0) {
          const iconKeys = Object.keys(ICONS);
          // FIX: Explicitly type `sanitizedCategories` to ensure the `type` property is correctly
          // inferred as '"income" | "expense"' instead of the wider `string` type, resolving the
          // assignment error when calling `addCategoriesBatch`.
          const sanitizedCategories: Omit<Category, 'id'>[] = localCategories.map(({ id, ...c }) => {
          const iconKey = String(c.name).toUpperCase().replace(/\s+/g, '_');
          const isIncome = ['SALARY', 'GIFTS', 'INVESTMENT'].includes(iconKey);
          return {
              name: c.name,
              color: c.color,
              icon: iconKeys.includes(iconKey) ? iconKey : 'OTHER',
              type: isIncome ? 'income' : 'expense'
          };
        });
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
    if (member.name.toLowerCase() === 'home balance') {
        alert('"Home Balance" is a default member and cannot be modified.');
        return;
    }
    if ('id' in member) {
      const { id, ...dataToUpdate } = member;
      updateMember(id, dataToUpdate);
    } else {
      addMemberDoc(member);
    }
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
        if(window.confirm('This will add data from the backup file to your account. It will not replace or delete existing data. Continue?')) {
            const iconKeys = Object.keys(ICONS);
            const sanitizedCategories = data.categories.map((c: any) => {
              const iconKey = String(c.name).toUpperCase().replace(/\s+/g, '_');
              const isIncome = DEFAULT_INCOME_CATEGORIES.some(def => def.name === c.name);
              return {
                name: c.name,
                color: c.color,
                icon: iconKeys.includes(iconKey) ? iconKey : 'OTHER',
                type: c.type || (isIncome ? 'income' : 'expense'),
              }
            });
            
            const promises = [];
            if (data.transactions.length > 0) {
              promises.push(addTransactionsBatch(data.transactions.map(({id, ...rest}) => rest)));
            }
            if (sanitizedCategories.length > 0) {
              promises.push(addCategoriesBatch(sanitizedCategories));
            }
            if (data.members && data.members.length > 0) {
              const membersToAdd = data.members.filter(m => m.name.toLowerCase() !== 'home balance');
              if (membersToAdd.length > 0) {
                promises.push(addMembersBatch(membersToAdd.map(({id, ...rest}) => rest)));
              }
            }

            Promise.all(promises).then(() => {
              alert('Data restored successfully!');
              setBackupRestoreModalOpen(false);
            }).catch(err => {
              console.error("Restore error: ", err);
              alert("An error occurred during restore.");
            });
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
      return <PendingScreen user={user} onSignOut={() => signOut(auth)} />;
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
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H7a2 2 0 00-2 2v2m14 0H5" /></svg>
            </button>
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Toggle Theme">
              {theme === 'light' ? <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            </button>
             <button onClick={() => setBackupRestoreModalOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors" aria-label="Backup and Restore">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </button>
            <button onClick={() => signOut(auth)} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-800 text-red-500 transition-colors" aria-label="Sign Out">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
         {transactionsLoading || categoriesLoading || membersLoading ? (
            <div className="text-center py-10"><p>Loading data...</p></div>
         ) : (
            <>
              <Dashboard transactions={transactions} categories={categories} members={members} />
              <div className="mt-8">
                <button
                  onClick={() => { setEditingTransaction(null); setAddTransactionModalOpen(true); }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg shadow-lg hover:opacity-90 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  Add Transaction
                </button>
              </div>
              <TransactionsList 
                transactions={transactions} 
                categories={categories} 
                members={members}
                onEdit={handleEditTransaction} 
                onDelete={handleDeleteTransaction}
              />
            </>
         )}
      </main>

      <TransactionFormModal 
        isOpen={isAddTransactionModalOpen}
        onClose={() => { setAddTransactionModalOpen(false); setEditingTransaction(null); }}
        onSubmit={handleAddOrUpdateTransaction}
        transaction={editingTransaction}
        categories={categories}
        members={members}
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
        onExportCsv={() => exportToCsv(transactions, categories, members)}
        onExportJson={() => exportToJson(transactions, categories, members)}
        onRestore={handleRestore}
      />

      <Modal isOpen={isAdminPanelOpen} onClose={() => setAdminPanelOpen(false)} title="Admin Panel">
        <AdminDashboard />
      </Modal>

    </div>
  );
}

// Sub-components
const TransactionFormModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: Omit<Transaction, 'id'> & { id?: string }) => void;
  transaction: Transaction | null;
  categories: Category[];
  members: FamilyMember[];
}> = ({ isOpen, onClose, onSubmit, transaction, categories, members }) => {
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [memberId, setMemberId] = useState<string>(''); // Empty string for 'Home Balance'

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setCategoryId(transaction.categoryId);
      setDate(transaction.date);
      setDescription(transaction.description);
      setMemberId(transaction.memberId || '');
    } else {
      setType(TransactionType.EXPENSE);
      setAmount('');
      setCategoryId('');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setMemberId('');
    }
  }, [transaction, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !categoryId || !date) {
      alert('Please fill out all required fields.');
      return;
    }
    onSubmit({
      id: transaction?.id,
      type,
      amount: parseFloat(amount),
      categoryId,
      date,
      description,
      memberId: memberId || undefined
    });
  };

  const filteredCategories = categories.filter(c => c.type === type);
  
  // Reset category if type changes and selected category is no longer valid
  useEffect(() => {
    if(!filteredCategories.some(c => c.id === categoryId)) {
      setCategoryId('');
    }
  }, [type, filteredCategories, categoryId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={transaction ? 'Edit Transaction' : 'Add Transaction'}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setType(TransactionType.EXPENSE)} className={`p-3 rounded-lg font-semibold transition-colors ${type === TransactionType.EXPENSE ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>Expense</button>
          <button type="button" onClick={() => setType(TransactionType.INCOME)} className={`p-3 rounded-lg font-semibold transition-colors ${type === TransactionType.INCOME ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-slate-700'}`}>Income</button>
        </div>
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
          <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} required className="mt-1 block w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-3 focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="0.00" />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
          <select id="category" value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="mt-1 block w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-3 focus:ring-2 focus:ring-primary focus:border-transparent">
            <option value="" disabled>Select a category</option>
            {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="member" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Member</label>
          <select id="member" value={memberId} onChange={e => setMemberId(e.target.value)} className="mt-1 block w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-3 focus:ring-2 focus:ring-primary focus:border-transparent">
            <option value="">Home Balance</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
          <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} required className="mt-1 block w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-3 focus:ring-2 focus:ring-primary focus:border-transparent" style={{ colorScheme: 'dark' }} />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 block w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-3 focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="e.g., Weekly groceries"></textarea>
        </div>
        <div className="flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-slate-600 font-semibold rounded-lg hover:opacity-90">Cancel</button>
          <button type="submit" className="px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:opacity-90">{transaction ? 'Update' : 'Save'}</button>
        </div>
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
}> = ({ isOpen, onClose, categories, onAddOrUpdate, onDelete }) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState(COLORS[0]);
    const [newCategoryIcon, setNewCategoryIcon] = useState(Object.keys(ICONS)[0]);
    const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense');

    const handleAddCategory = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName) {
            alert("Please enter a category name.");
            return;
        }
        onAddOrUpdate({ 
          name: newCategoryName,
          color: newCategoryColor,
          icon: newCategoryIcon,
          type: newCategoryType,
        });
        setNewCategoryName('');
        setNewCategoryColor(COLORS[0]);
        setNewCategoryIcon(Object.keys(ICONS)[0]);
    };
    
    const renderCategoryList = (type: 'income' | 'expense') => {
        const filtered = categories.filter(c => c.type === type);
        return (
            <div className="space-y-2">
                {filtered.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2 bg-gray-100 dark:bg-slate-700 rounded-md">
                        <div className="flex items-center gap-3">
                            <span className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: c.color + '30', color: c.color }}>{ICONS[c.icon]}</span>
                            <span className="font-medium">{c.name}</span>
                        </div>
                        <button onClick={() => onDelete(c.id)} className="p-1 text-gray-400 hover:text-red-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}
                {filtered.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No {type} categories yet.</p>}
            </div>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manage Categories">
            <div className="space-y-6">
                <div>
                    <h3 className="font-semibold text-lg mb-2 text-gray-700 dark:text-gray-200">Add New Category</h3>
                    <form onSubmit={handleAddCategory} className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg space-y-4">
                         <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setNewCategoryType('expense')} className={`p-2 rounded-lg text-sm font-semibold ${newCategoryType === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-slate-600'}`}>Expense</button>
                            <button type="button" onClick={() => setNewCategoryType('income')} className={`p-2 rounded-lg text-sm font-semibold ${newCategoryType === 'income' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-slate-600'}`}>Income</button>
                        </div>
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            placeholder="Category Name"
                            className="w-full bg-white dark:bg-slate-600 border-gray-300 dark:border-slate-500 rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <select value={newCategoryIcon} onChange={e => setNewCategoryIcon(e.target.value)} className="w-full bg-white dark:bg-slate-600 border-gray-300 dark:border-slate-500 rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent">
                            {Object.keys(ICONS).map(iconKey => <option key={iconKey} value={iconKey}>{iconKey.charAt(0) + iconKey.slice(1).toLowerCase()}</option>)}
                          </select>
                           <input type="color" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)} className="w-full h-10 p-1 bg-white dark:bg-slate-600 border-gray-300 dark:border-slate-500 rounded-md cursor-pointer"/>
                        </div>
                        <button type="submit" className="w-full px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:opacity-90">Add Category</button>
                    </form>
                </div>
                <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-green-600 dark:text-green-400">Income Categories</h3>
                      {renderCategoryList('income')}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-2 text-red-600 dark:text-red-400">Expense Categories</h3>
                      {renderCategoryList('expense')}
                    </div>
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
    const [newMemberName, setNewMemberName] = useState('');

    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName.trim()) {
            alert("Please enter a member name.");
            return;
        }
        onAddOrUpdate({ name: newMemberName.trim() });
        setNewMemberName('');
    };
    
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Manage Members">
        <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-2 text-gray-700 dark:text-gray-200">Add New Member</h3>
              <form onSubmit={handleAddMember} className="flex gap-2">
                  <input
                      type="text"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Member Name"
                      className="flex-grow bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button type="submit" className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:opacity-90">Add</button>
              </form>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2 text-gray-700 dark:text-gray-200">Existing Members</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
                    <span className="font-medium text-gray-500 dark:text-gray-400">Home Balance (Default)</span>
                </div>
                {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
                        <span className="font-medium flex-grow">{m.name}</span>
                        <button onClick={() => onDelete(m.id)} className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}
              </div>
            </div>
        </div>
      </Modal>
    );
}

const BackupRestoreModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onRestore: (file: File) => void;
}> = ({ isOpen, onClose, onExportCsv, onExportJson, onRestore }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onRestore(file);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Backup & Restore">
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg mb-2 text-gray-700 dark:text-gray-200">Backup Data</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Export all your transactions, categories, and members into a file.</p>
          <div className="flex gap-4">
            <button onClick={onExportJson} className="flex-1 px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600">Export as JSON</button>
            <button onClick={onExportCsv} className="flex-1 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600">Export as CSV</button>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-lg mb-2 text-gray-700 dark:text-gray-200">Restore Data</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Import data from a JSON backup file. This will add the data to your existing records.</p>
          <input type="file" accept=".json" onChange={handleFileChange} ref={fileInputRef} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700">
            Import from JSON
          </button>
        </div>
      </div>
    </Modal>
  );
};


export default App;