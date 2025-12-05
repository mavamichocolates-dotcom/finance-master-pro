import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, PaymentStatus, User } from './types';
import { db } from './services/db';
import { auth } from './services/auth';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import SummaryCard from './components/SummaryCard';
import ConfirmModal from './components/ConfirmModal';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import { formatCurrency } from './utils';
import { LayoutDashboard, Wallet, Receipt, TrendingUp, TrendingDown, DollarSign, Building2, LogOut, Shield, User as UserIcon, Loader2 } from 'lucide-react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from './constants';

// Tabs Enum
enum ActiveTab {
  INPUT = 'INPUT',
  DASHBOARD = 'DASHBOARD',
  MANAGEMENT = 'MANAGEMENT',
  USERS = 'USERS', // Admin Only
}

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // App State
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.INPUT);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Data State
  const [categories, setCategories] = useState<{income: string[], expense: string[]}>(() => {
    const savedCats = localStorage.getItem('finance_categories');
    return savedCats ? JSON.parse(savedCats) : {
      income: INCOME_CATEGORIES,
      expense: EXPENSE_CATEGORIES
    };
  });

  const [units, setUnits] = useState<string[]>([]);
  
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

  // --- INITIALIZATION ---
  useEffect(() => {
    const initApp = async () => {
      const user = auth.getCurrentUser();
      setCurrentUser(user);
      setAuthChecked(true);
      
      if (user) {
        setIsLoading(true);
        try {
          const [txs, dbUnits] = await Promise.all([
            db.getTransactions(),
            db.getUnits()
          ]);
          setTransactions(txs);
          setUnits(dbUnits);
        } catch (error) {
          console.error("Failed to load initial data", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    initApp();
  }, []);

  // Save Categories to LocalStorage (Legacy/Hybrid)
  useEffect(() => {
    localStorage.setItem('finance_categories', JSON.stringify(categories));
  }, [categories]);


  // --- HANDLERS ---

  const handleLoginSuccess = async () => {
    const user = auth.getCurrentUser();
    setCurrentUser(user);
    
    setIsLoading(true);
    try {
      const [txs, dbUnits] = await Promise.all([
        db.getTransactions(),
        db.getUnits()
      ]);
      setTransactions(txs);
      setUnits(dbUnits);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    auth.logout();
    setCurrentUser(null);
    setTransactions([]);
  };

  const handleAddTransactions = async (newTxs: Transaction[]) => {
    setIsLoading(true);
    try {
      const savedTxs: Transaction[] = [];
      for (const t of newTxs) {
        const txWithUser = { ...t, userId: currentUser?.id };
        const saved = await db.addTransaction(txWithUser);
        if (saved) savedTxs.push(saved);
      }
      setTransactions((prev) => [...prev, ...savedTxs]);
    } catch (error) {
      alert("Erro ao salvar transação. Verifique a conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    const t = transactions.find((tr) => tr.id === id);
    const message = t 
      ? `Deseja excluir o lançamento "${t.description}" de ${formatCurrency(t.amount)}?`
      : 'Tem certeza que deseja excluir este lançamento?';

    openConfirm('Excluir Lançamento', message, async () => {
      setIsLoading(true);
      try {
        await db.deleteTransaction(id);
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      } catch (e) {
        alert("Erro ao excluir.");
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleUpdateTransaction = async (updated: Transaction) => {
    setIsLoading(true);
    try {
      await db.updateTransaction(updated);
      setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e) {
      alert("Erro ao atualizar.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Categories & Units ---

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
    setCategories(prev => {
      const listKey = type === TransactionType.INCOME ? 'income' : 'expense';
      const newList = prev[listKey].map(c => c === oldName ? newName : c);
      return { ...prev, [listKey]: newList };
    });
    // In a real app we might batch update DB, here we update local state representation
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
      `Deseja remover a categoria "${name}"? Lançamentos existentes NÃO serão excluídos.`,
      () => {
        setCategories(prev => {
          const listKey = type === TransactionType.INCOME ? 'income' : 'expense';
          return { ...prev, [listKey]: prev[listKey].filter(c => c !== name) };
        });
      }
    );
  };

  const handleAddUnit = async (name: string) => {
    if (!units.includes(name)) {
      setIsLoading(true);
      try {
        await db.addUnit(name);
        setUnits(prev => [...prev, name]);
      } catch (e) {
        alert("Erro ao criar unidade.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleRenameUnit = (oldName: string, newName: string) => {
    // DB rename not implemented in simple store table for now, would require ID based logic
    // We update local state
    setUnits(prev => prev.map(u => u === oldName ? newName : u));
  };

  const handleDeleteUnit = (name: string) => {
    openConfirm(
      'Excluir Unidade',
      `Deseja remover a unidade "${name}"?`,
      async () => {
        setIsLoading(true);
        try {
          await db.deleteUnit(name);
          setUnits(prev => prev.filter(u => u !== name));
        } catch (e) {
          alert("Erro ao excluir unidade.");
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  const openConfirm = (title: string, message: string, action: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm: action });
  };
  
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
  const handleConfirmAction = () => { confirmModal.onConfirm(); closeConfirm(); };

  // --- RENDERING HELPERS ---

  // Filter Units based on User Permissions
  const availableUnits = currentUser?.role === 'ADMIN' 
    ? units 
    : units.filter(u => currentUser?.allowedUnits?.includes(u));

  // Filter Transactions based on Unit selection AND User Permissions
  const filteredTransactions = transactions.filter(t => {
    // 1. Check Permission
    if (!auth.canAccessUnit(currentUser!, t.unit || '')) return false;
    // 2. Check Selection
    if (selectedUnit === 'ALL') return true;
    return t.unit === selectedUnit;
  });

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const currentMonthTxs = filteredTransactions.filter(t => {
    const d = new Date(t.date + 'T12:00:00');
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthIncome = currentMonthTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
  const monthExpense = currentMonthTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
  const pendingExpense = currentMonthTxs.filter(t => t.type === TransactionType.EXPENSE && t.status === PaymentStatus.PENDING).reduce((s, t) => s + t.amount, 0);

  // --- RENDER ---

  if (!authChecked) return null;

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-12 relative">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center backdrop-blur-sm">
          <Loader2 className="animate-spin text-blue-500" size={48} />
        </div>
      )}

      {/* HEADER */}
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
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <UserIcon size={10} />
                  <span className="uppercase tracking-widest">{currentUser.name} ({currentUser.role})</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto">
              {/* Unit Selector */}
              <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
                  <Building2 size={16} className="text-gray-400" />
                  <select 
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="bg-transparent text-sm text-white focus:outline-none min-w-[120px]"
                  >
                    <option value="ALL">Todas as Unidades</option>
                    {availableUnits.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
              </div>

              {/* Navigation */}
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
                {currentUser.role === 'ADMIN' && (
                  <TabButton 
                    active={activeTab === ActiveTab.USERS} 
                    onClick={() => setActiveTab(ActiveTab.USERS)}
                    icon={<Shield size={18} />}
                    label="Usuários"
                  />
                )}
              </nav>

              <button 
                onClick={handleLogout}
                className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="container mx-auto px-4 py-8 flex flex-col gap-8">
        
        {/* TOP CARDS (Summary) - Always visible except on Dashboard */}
        {activeTab !== ActiveTab.DASHBOARD && activeTab !== ActiveTab.USERS && (
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

        {/* TABS CONTENT */}
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
                units={availableUnits}
                onAddUnit={handleAddUnit}
                onRenameUnit={handleRenameUnit}
                onDeleteUnit={handleDeleteUnit}
                defaultUnit={selectedUnit !== 'ALL' ? selectedUnit : availableUnits[0]}
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
                  units={availableUnits}
               />
            </div>
          )}

          {activeTab === ActiveTab.DASHBOARD && (
            <div className="animate-fade-in-up">
              <Dashboard 
                transactions={transactions.filter(t => auth.canAccessUnit(currentUser, t.unit || ''))} 
                units={availableUnits} 
              />
            </div>
          )}

          {activeTab === ActiveTab.USERS && currentUser.role === 'ADMIN' && (
            <UserManagement availableUnits={units} />
          )}

        </div>
      </main>
      
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

// Helper for Tab Button
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