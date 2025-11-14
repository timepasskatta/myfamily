import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Transaction, Category, TransactionType, FamilyMember } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
  members: FamilyMember[];
}

const SummaryCard: React.FC<{ title: string; amount: number; color: string }> = ({ title, amount, color }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
    <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">{title}</h3>
    <p className={`text-4xl font-bold ${color} mt-2`}>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)}</p>
  </div>
);

const CategoryChart: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            No expense data to display.
        </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
};

const TrendChart: React.FC<{ data: any[] }> = ({ data }) => {
    if (!data || data.length === 0) {
    return (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            Not enough data for trend analysis.
        </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
        <XAxis dataKey="name" stroke="rgb(156 163 175)" />
        <YAxis stroke="rgb(156 163 175)" tickFormatter={(value) => new Intl.NumberFormat('en-IN', { notation: 'compact', compactDisplay: 'short' }).format(value as number)} />
        <Tooltip formatter={(value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)} />
        <Legend />
        <Line type="monotone" dataKey="Income" stroke="#22c55e" strokeWidth={2} activeDot={{ r: 8 }} />
        <Line type="monotone" dataKey="Expense" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 8 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const ContributionsChart: React.FC<{ data: { name: string; value: number }[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        Add members and transactions to see contributions.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
        <XAxis dataKey="name" stroke="rgb(156 163 175)" />
        <YAxis stroke="rgb(156 163 175)" tickFormatter={(value) => new Intl.NumberFormat('en-IN', { notation: 'compact', compactDisplay: 'short' }).format(value as number)} />
        <Tooltip formatter={(value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)} />
        <Bar dataKey="value">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#22c55e' : '#f97316'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};


export const Dashboard: React.FC<DashboardProps> = ({ transactions, categories, members }) => {
  const [dateRange, setDateRange] = React.useState('month');

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      if (dateRange === 'month') {
        return transactionDate.getMonth() === now.getMonth() && transactionDate.getFullYear() === now.getFullYear();
      }
      if (dateRange === 'year') {
        return transactionDate.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  }, [transactions, dateRange]);

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, t) => {
        if (t.type === TransactionType.INCOME) acc.totalIncome += t.amount;
        else acc.totalExpense += t.amount;
        acc.balance = acc.totalIncome - acc.totalExpense;
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, balance: 0 }
    );
  }, [filteredTransactions]);

  const categoryExpenseData = useMemo(() => {
    const expenseByCategory = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => {
        const category = categories.find(c => c.id === t.categoryId);
        if (category) {
          if (!acc[category.id]) {
            acc[category.id] = { name: category.name, value: 0, color: category.color };
          }
          acc[category.id].value += t.amount;
        }
        return acc;
      }, {} as { [key: string]: { name: string; value: number; color: string } });

    // FIX: Explicitly type `a` and `b` in the sort function. TypeScript is failing to infer
    // the correct type from `Object.values`, resulting in `a` and `b` being `unknown`.
    return Object.values(expenseByCategory).sort((a: { value: number }, b: { value: number }) => b.value - a.value);
  }, [filteredTransactions, categories]);

  const memberContributionsData = useMemo(() => {
    const contributions = members.reduce((acc, member) => {
      acc[member.id] = { name: member.name, value: 0 };
      return acc;
    }, {} as { [key: string]: { name: string, value: number } });
  
    filteredTransactions.forEach(t => {
      if (t.memberId && contributions[t.memberId]) {
        const amount = t.type === TransactionType.INCOME ? t.amount : -t.amount;
        contributions[t.memberId].value += amount;
      }
    });
  
    return Object.values(contributions);
  }, [filteredTransactions, members]);

  const trendData = useMemo(() => {
    const dataByMonth: { [key: string]: { name: string, Income: number, Expense: number } } = {};
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });

    const filteredForTrend = dateRange === 'year' 
        ? transactions.filter(t => new Date(t.date).getFullYear() === new Date().getFullYear())
        : filteredTransactions;


    filteredForTrend.forEach(t => {
      const date = new Date(t.date);
      const key = dateRange === 'year' 
        ? monthFormatter.format(date)
        : date.getDate().toString();
      const name = dateRange === 'year'
        ? monthFormatter.format(date)
        : `${monthFormatter.format(date)} ${date.getDate()}`;
      
      if (!dataByMonth[key]) {
        dataByMonth[key] = { name: name, Income: 0, Expense: 0 };
      }
      if (t.type === TransactionType.INCOME) {
        dataByMonth[key].Income += t.amount;
      } else {
        dataByMonth[key].Expense += t.amount;
      }
    });
    
    return Object.values(dataByMonth).sort((a, b) => {
        const dateA = new Date(dateRange === 'year' ? `01 ${a.name} 2023` : a.name);
        const dateB = new Date(dateRange === 'year' ? `01 ${b.name} 2023` : b.name);
        return dateA.getTime() - dateB.getTime();
    });
  }, [filteredTransactions, transactions, dateRange]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
        <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-lg p-1 self-start sm:self-center">
          {['This Month', 'This Year', 'All Time'].map((label, i) => {
             const value = ['month', 'year', 'all'][i];
             return (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                  dateRange === value
                    ? 'bg-white dark:bg-primary text-primary dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            )})}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard title="Total Income" amount={totalIncome} color="text-green-500" />
        <SummaryCard title="Total Expense" amount={totalExpense} color="text-red-500" />
        <SummaryCard title="Balance" amount={balance} color={balance >= 0 ? 'text-blue-500' : 'text-orange-500'} />
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Member Contributions</h3>
          <ContributionsChart data={memberContributionsData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Income vs Expense Trend</h3>
          <TrendChart data={trendData} />
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-lg">
          <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Expense by Category</h3>
          <CategoryChart data={categoryExpenseData} />
        </div>
      </div>
    </div>
  );
};