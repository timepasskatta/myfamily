import React, { useState, useMemo, memo } from 'react';
import { Transaction, Category, TransactionType, FamilyMember } from '../types';
import { ICONS } from '../constants';

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Category[];
  members: FamilyMember[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

interface TransactionRowProps {
  transaction: Transaction;
  category: Category | undefined;
  memberName: string | undefined;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

const TransactionRow: React.FC<TransactionRowProps> = memo(({ transaction, category, memberName, onEdit, onDelete }) => {
  const isExpense = transaction.type === TransactionType.EXPENSE;

  return (
     <div className="flex items-center p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors duration-200 gap-3">
      {/* Icon */}
      <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: category?.color + '20', color: category?.color }}>
        {category ? ICONS[category.icon] || ICONS.OTHER : ICONS.OTHER}
      </div>
      
      {/* Middle Section: Info */}
      <div className="flex-grow min-w-0">
          <p className="font-semibold text-gray-800 dark:text-white truncate" title={transaction.description}>{transaction.description || 'No Description'}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {new Date(transaction.date).toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' })} &bull; {category?.name || 'Uncategorized'} &bull; <span className="font-medium">{memberName || ''}</span>
          </p>
      </div>

      {/* Right Section: Amount & Actions */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto pl-2">
          <p className={`font-semibold text-base whitespace-nowrap text-right ${isExpense ? 'text-red-500' : 'text-green-500'}`}>
            {isExpense ? '-' : '+'}
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(transaction.amount)}
          </p>
          <div className="flex items-center">
            <button onClick={() => onEdit(transaction)} className="p-1 text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" aria-label="Edit Transaction">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" /></svg>
            </button>
            <button onClick={() => onDelete(transaction.id)} className="p-1 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors" aria-label="Delete Transaction">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
      </div>
    </div>
  );
});

export const TransactionsList: React.FC<TransactionsListProps> = memo(({ transactions, categories, members, onEdit, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [sortOrder, setSortOrder] = useState('date-desc');

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const memberMap = useMemo(() => new Map(members.map(m => [m.id, m.name])), [members]);

  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...transactions]
      .filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()))
      .filter(t => filterCategory === 'all' || t.categoryId === filterCategory)
      .filter(t => filterType === 'all' || t.type === filterType)
      .filter(t => filterMember === 'all' || t.memberId === (filterMember === 'home' ? undefined : filterMember));
    
    return filtered.sort((a, b) => {
      switch(sortOrder) {
        case 'date-asc': return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'amount-desc': return b.amount - a.amount;
        case 'amount-asc': return a.amount - b.amount;
        case 'date-desc':
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
  }, [transactions, searchTerm, filterCategory, filterType, filterMember, sortOrder]);

  return (
    <div className="mt-12">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">All Transactions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg shadow-md">
        <input type="text" placeholder="Search description..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent"/>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent">
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent">
          <option value="all">All Types</option>
          <option value={TransactionType.INCOME}>Income</option>
          <option value={TransactionType.EXPENSE}>Expense</option>
        </select>
        <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent">
          <option value="all">All Members</option>
          <option value="home">Home Balance</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 border-transparent rounded-md p-2 focus:ring-2 focus:ring-primary focus:border-transparent">
          <option value="date-desc">Date (Newest)</option>
          <option value="date-asc">Date (Oldest)</option>
          <option value="amount-desc">Amount (High-Low)</option>
          <option value="amount-asc">Amount (Low-High)</option>
        </select>
      </div>
      <div className="space-y-4">
        {filteredAndSortedTransactions.length > 0 ? (
          filteredAndSortedTransactions.map(t => (
            <TransactionRow 
              key={t.id} 
              transaction={t}
              category={categoryMap.get(t.categoryId)}
              memberName={t.memberId ? memberMap.get(t.memberId) : 'Home Balance'}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">No transactions found.</p>
          </div>
        )}
      </div>
    </div>
  );
});