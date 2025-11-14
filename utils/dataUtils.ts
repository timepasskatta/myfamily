
import { Transaction, Category } from './types';

export const exportToCsv = (transactions: Transaction[], categories: Category[]) => {
  const categoryMap = new Map(categories.map(c => [c.id, c.name]));
  let csvContent = "data:text/csv;charset=utf-t8,";
  csvContent += "Date,Type,Description,Category,Amount\n";

  transactions.forEach(t => {
    const row = [
      t.date,
      t.type,
      `"${t.description.replace(/"/g, '""')}"`,
      categoryMap.get(t.categoryId) || 'Uncategorized',
      t.amount.toFixed(2)
    ].join(',');
    csvContent += row + "\r\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "expenses.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToJson = (transactions: Transaction[], categories: Category[]) => {
  const data = {
    transactions,
    categories,
    timestamp: new Date().toISOString(),
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(data, null, 2)
  )}`;
  
  const link = document.createElement("a");
  link.href = jsonString;
  link.download = `expense_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
};

export const importFromJson = (file: File, onImport: (data: { transactions: Transaction[], categories: Category[] }) => void) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      if (event.target?.result) {
        const data = JSON.parse(event.target.result as string);
        if (data.transactions && data.categories) {
          onImport(data);
        } else {
          alert('Invalid JSON format. Make sure it contains "transactions" and "categories" keys.');
        }
      }
    } catch (error) {
      alert('Error parsing JSON file.');
      console.error(error);
    }
  };
  reader.readAsText(file);
};
