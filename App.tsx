import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, PaymentStatus } from './types';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import SummaryCard from './components/SummaryCard';
import ConfirmModal from './components/ConfirmModal';
import { formatCurrency } from './utils';
import { LayoutDashboard, Wallet, Receipt, TrendingUp, TrendingDown, DollarSign, Building2 } from 'lucide-react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, UNITS as DEFAULT_UNITS } from './constants';

// Tabs Enum
enum ActiveTab {
  INPUT = 'INPUT',
  DASHBOARD = 'DASHBOARD',
  MANAGEMENT = 'MANAGEMENT',
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.INPUT);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Categories State
  const [categories, setCategories] = useState<{income: string[], expense: string[]}>(() => {
    const savedCats = localStorage.getItem('finance_categories');
    return savedCats ? JSON.parse(savedCats) : {
      income: INCOME_CATEGORIES,
      expense: EXPENSE_CATEGORIES
    };
  });

  // Units State
  const [units, setUnits] = useState<string[]>(() => {
    const savedUnits = localStorage.getItem('finance_units');
    return savedUnits ? JSON.parse(savedUnits) : DEFAULT_UNITS;
  });

  // Global Unit Filter State
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Load Transactions from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('finance_transactions');
    if (saved) {
      try {
        setTransactions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse transactions", e);
      }
    }
    setLoading(false);
  }, []);

  // Save Transactions to LocalStorage
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('finance_transactions', JSON.stringify(transactions));
    }
  }, [transactions, loading]);

  // Save Categories to LocalStorage
  useEffect(() => {
    localStorage.setItem('finance_categories', JSON.stringify(categories));
  }, [categories]);

  // Save Units to LocalStorage
  useEffect(() => {
    localStorage.setItem('finance_units', JSON.stringify(units));
  }, [units]);

  // --- Confirm Modal Helpers ---
  const openConfirm = (title: string, message: string, action: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: action,
    });
  };

  const closeConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirmAction = () => {
    confirmModal.onConfirm();
    closeConfirm();
  };

  // --- Transaction Management ---

  const handleAddTransactions = (newTxs: Transaction[]) => {
    setTransactions((prev) => [...prev, ...newTxs]);
  };

  const handleDeleteTransaction = (id: string) => {
    const t = transactions.find((tr) => tr.id === id);
    const message = t 
      ? `Deseja excluir o lançamento "${t.description}" de ${formatCurrency(t.amount)}?`
      : 'Tem certeza que deseja excluir este lançamento?';

    openConfirm('Excluir Lançamento', message, () => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    });
  };

  const handleUpdateTransaction = (updated: Transaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  // --- Category Management ---

  const handleAddCategory = (type: TransactionType, name: string) => {
    setCategories(prev => ({
      ...prev,
      [type === TransactionType.INCOME ? 'income' : 'expense']: [
        ...(type === TransactionType.INCOME ? prev.income : prev.expense),
        name
      ]
    }));
  };

  const handleRenameCategory = (type: TransactionType, oldName: string, newName: string) => {
    // 1. Update List
    setCategories(prev => {
      const listKey = type === TransactionType.INCOME ? 'income' : 'expense';
      const newList = prev[listKey].map(c => c === oldName ? newName : c);
      return { ...prev, [listKey]: newList };
    });

    // 2. Update all existing transactions with this category
    setTransactions(prev => prev.map(t => {
      if (t.type === type && t.category === oldName) {
        return { ...t, category: newName };
      }
      return t;
    }));
  };

  const handleDeleteCategory = (type: TransactionType, name: string) => {
    openConfirm(
      'Excluir Categoria',
      `Deseja remover a categoria "${name}"? Lançamentos existentes com essa categoria NÃO serão excluídos.`,
      () => {
        setCategories(prev => {
          const listKey = type === TransactionType.INCOME ? 'income' : 'expense';
          return { ...prev, [listKey]: prev[listKey].filter(c => c !== name) };
        });
      }
    );
  };

  // --- Unit Management ---

  const handleAddUnit = (name: string) => {
    if (!units.includes(name)) {
      setUnits(prev => [...prev, name]);
    }
  };

  const handleRenameUnit = (oldName: string, newName: string) => {
    // 1. Update List
    setUnits(prev => prev.map(u => u === oldName ? newName : u));

    // 2. Update all existing transactions with this unit
    setTransactions(prev => prev.map(t => {
      if (t.unit === oldName) {
        return { ...t, unit: newName };
      }
      return t;
    }));
  };

  const handleDeleteUnit = (name: string) => {
    openConfirm(
      'Excluir Unidade',
      `Deseja remover a unidade "${name}"? Lançamentos existentes desta unidade NÃO serão excluídos.`,
      () => {
        setUnits(prev => prev.filter(u => u !== name));
      }
    );
  };


  // Filter Logic (For Table and Quick Summary)
  const filteredTransactions = transactions.filter(t => {
    if (selectedUnit === 'ALL') return true;
    return t.unit === selectedUnit;
  });

  // Quick Stats for Header (Based on Filtered Transactions)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthTxs = filteredTransactions.filter(t => {
    const d = new Date(t.date + 'T12:00:00');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthIncome = currentMonthTxs
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);

  const monthExpense = currentMonthTxs
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingExpense = currentMonthTxs
    .filter(t => t.type === TransactionType.EXPENSE && t.status === PaymentStatus.PENDING)
    .reduce((sum, t) => sum + t.amount, 0);

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-12 relative">
      {/* Top Navigation / Header */}
      <header className="bg-gray-950 border-b border-gray-800 shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-blue-600 to-blue-400 p-2 rounded-lg">
                <LayoutDashboard size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300">
                  FinanceMaster Pro
                </h1>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Controle Financeiro</p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
              {/* Global Unit Filter (Affects Cards & Table) */}
              <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
                  <Building2 size={16} className="text-gray-400" />
                  <select 
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="bg-transparent text-sm text-white focus:outline-none min-w-[120px]"
                  >
                    <option value="ALL">Todas as Unidades</option>
                    {units.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
              </div>

              {/* Navigation Tabs */}
              <nav className="flex bg-gray-800 rounded-lg p-1">
                <TabButton 
                  active={activeTab === ActiveTab.INPUT} 
                  onClick={() => setActiveTab(ActiveTab.INPUT)}
                  icon={<Wallet size={18} />}
                  label="Entradas/Saídas"
                />
                <TabButton 
                  active={activeTab === ActiveTab.MANAGEMENT} 
                  onClick={() => setActiveTab(ActiveTab.MANAGEMENT)}
                  icon={<Receipt size={18} />}
                  label="Gerenciamento"
                />
                <TabButton 
                  active={activeTab === ActiveTab.DASHBOARD} 
                  onClick={() => setActiveTab(ActiveTab.DASHBOARD)}
                  icon={<TrendingUp size={18} />}
                  label="Fluxo de Caixa"
                />
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="container mx-auto px-4 py-8 flex flex-col gap-8">
        
        {/* Quick Month Summary (Dados) */}
        {/* Layout: Always display summary cards on top */}
        {activeTab !== ActiveTab.DASHBOARD && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard 
              title="Recebido (Mês Atual)" 
              value={formatCurrency(monthIncome)} 
              colorClass="bg-gradient-to-br from-green-800 to-green-900 border border-green-700"
              icon={<TrendingUp size={24} className="text-green-300"/>}
            />
            <SummaryCard 
              title="Pago (Mês Atual)" 
              value={formatCurrency(monthExpense - pendingExpense)} 
              colorClass="bg-gradient-to-br from-red-800 to-red-900 border border-red-700"
              icon={<TrendingDown size={24} className="text-red-300"/>}
            />
            <SummaryCard 
              title="A Pagar (Mês Atual)" 
              value={formatCurrency(pendingExpense)} 
              colorClass="bg-gradient-to-br from-orange-800 to-orange-900 border border-orange-700"
              icon={<Receipt size={24} className="text-orange-300"/>}
            />
            <SummaryCard 
              title="Saldo (Mês Atual)" 
              value={formatCurrency(monthIncome - monthExpense)} 
              colorClass={`bg-gradient-to-br border ${monthIncome - monthExpense >= 0 ? 'from-blue-800 to-blue-900 border-blue-700' : 'from-gray-700 to-gray-800 border-gray-600'}`}
              icon={<DollarSign size={24} className="text-blue-300"/>}
            />
          </div>
        )}

        {/* Tab Content */}
        {/* Layout: Always below the summary cards */}
        <div className="transition-opacity duration-300">
          {activeTab === ActiveTab.INPUT && (
            <div className="space-y-6 animate-fade-in-up">
              <TransactionForm 
                onAddTransaction={handleAddTransactions} 
                incomeCategories={categories.income}
                expenseCategories={categories.expense}
                onAddCategory={handleAddCategory}
                onRenameCategory={handleRenameCategory}
                onDeleteCategory={handleDeleteCategory}
                units={units}
                onAddUnit={handleAddUnit}
                onRenameUnit={handleRenameUnit}
                onDeleteUnit={handleDeleteUnit}
                defaultUnit={selectedUnit !== 'ALL' ? selectedUnit : units[0]}
              />
              <div className="text-center text-gray-500 mt-8 hidden md:block">
                <p>Cadastre suas entradas e saídas acima. Utilize a aba "Gerenciamento" para editar erros.</p>
              </div>
            </div>
          )}

          {activeTab === ActiveTab.MANAGEMENT && (
            <div className="animate-fade-in-up">
               <TransactionTable 
                  transactions={filteredTransactions} 
                  onDelete={handleDeleteTransaction}
                  onUpdate={handleUpdateTransaction}
                  units={units}
               />
            </div>
          )}

          {activeTab === ActiveTab.DASHBOARD && (
            <div className="animate-fade-in-up">
              {/* Pass ALL transactions to Dashboard so it can handle its own advanced filtering */}
              <Dashboard transactions={transactions} units={units} />
            </div>
          )}
        </div>
      </main>
      
      {/* Global Confirmation Modal */}
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
      />
    </div>
  );
};

// Helper Sub-component for Tabs
const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
      active 
        ? 'bg-blue-600 text-white shadow-lg transform scale-105' 
        : 'text-gray-400 hover:text-white hover:bg-gray-700'
    }`}
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </button>
);

export default App;