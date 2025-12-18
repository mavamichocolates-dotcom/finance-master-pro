
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, PaymentStatus, User } from './types';
import { db } from './services/db';
import { auth } from './services/auth';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import PDV from './components/PDV';
import SummaryCard from './components/SummaryCard';
import ConfirmModal from './components/ConfirmModal';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import { formatCurrency, formatDate } from './utils';
import { LayoutDashboard, Wallet, Receipt, TrendingUp, TrendingDown, DollarSign, LogOut, Loader2, Database, ChevronLeft, ChevronRight, PiggyBank, Edit3, Users, Cloud, CloudOff, ShoppingCart } from 'lucide-react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, MONTH_NAMES, SINGLE_STORE_NAME } from './constants';
import { isSupabaseConfigured } from './src/supabase';

enum ActiveTab {
  INPUT = 'INPUT',
  PDV = 'PDV',
  DASHBOARD = 'DASHBOARD',
  MANAGEMENT = 'MANAGEMENT',
  USERS = 'USERS',
}

const SQL_SETUP_SCRIPT = `-- SCRIPT DE REPARAÇÃO
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed boolean DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pdv_data jsonb;
`;

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDatabaseReady, setIsDatabaseReady] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.INPUT);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const [systemBaselineBalance, setSystemBaselineBalance] = useState<number>(() => {
    const saved = localStorage.getItem('fm_baseline_balance');
    return saved ? parseFloat(saved) : 0;
  });
  
  const [isEditingBaseline, setIsEditingBaseline] = useState(false);
  const [tempBalance, setTempBalance] = useState(systemBaselineBalance.toString());

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('finance_categories');
    return saved ? JSON.parse(saved) : { income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES };
  });
  
  const units = [SINGLE_STORE_NAME];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useEffect(() => {
    const initApp = async () => {
      try {
        const user = auth.getCurrentUser();
        setCurrentUser(user);
        setAuthChecked(true);
        if (user) {
          // SE FOR COLABORADOR, FORÇA ABA DO PDV E BLOQUEIA RESTO
          if (user.role === 'COLLABORATOR') {
            setActiveTab(ActiveTab.PDV);
          } else if (activeTab === ActiveTab.INPUT) {
             // Redireciona para PDV como default se for colaborador tentando acessar algo restrito
             // (embora os botões já sumam, é uma camada extra de segurança)
          }
          setIsLoading(true);
          const txs = await db.getTransactions();
          setTransactions(txs);
        }
      } catch (error: any) {
        if (error.message?.includes('reviewed') || error.message?.includes('42P01')) setIsDatabaseReady(false);
      } finally { setIsLoading(false); }
    };
    initApp();
  }, []);

  const handleSaveBaseline = () => {
    const val = parseFloat(tempBalance.replace(',', '.'));
    if (!isNaN(val)) {
      setSystemBaselineBalance(val);
      localStorage.setItem('fm_baseline_balance', val.toString());
      setIsEditingBaseline(false);
    }
  };

  const handleUpdateTransaction = async (updated: Transaction) => {
    setIsLoading(true);
    try {
      await db.updateTransaction(updated);
      setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e: any) {
      if (e.message?.includes('reviewed') || e.message?.includes('column')) setIsDatabaseReady(false);
    } finally { setIsLoading(false); }
  };

  const handleAddTransactions = async (newTxs: Transaction[]) => {
    setIsLoading(true);
    try {
      const savedTxs: Transaction[] = [];
      for (const t of newTxs) {
        const saved = await db.addTransaction({ ...t, userId: currentUser?.id });
        if (saved) savedTxs.push(saved);
      }
      setTransactions((prev) => [...prev, ...savedTxs]);
    } catch (error: any) {
      if (error.message?.includes('reviewed')) setIsDatabaseReady(false);
    } finally { setIsLoading(false); }
  };

  const handleRenameCategory = async (type: TransactionType, oldName: string, newName: string) => {
    if (oldName === 'Outros') return;
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || trimmedNewName === oldName) return;
    setIsLoading(true);
    try {
      const typeKey = type === TransactionType.INCOME ? 'income' : 'expense';
      const updatedCategories = {
        ...categories,
        [typeKey]: categories[typeKey].map((c: string) => c === oldName ? trimmedNewName : c)
      };
      setCategories(updatedCategories);
      localStorage.setItem('finance_categories', JSON.stringify(updatedCategories));
      const updatedTxsList = transactions.map(t => t.type === type && t.category === oldName ? { ...t, category: trimmedNewName } : t);
      setTransactions(updatedTxsList);
    } finally { setIsLoading(false); }
  };

  const handleDeleteCategory = async (type: TransactionType, categoryName: string) => {
    if (categoryName === 'Outros') return;
    if (!window.confirm(`Excluir "${categoryName}"? Lançamentos irão para "Outros".`)) return;
    setIsLoading(true);
    try {
      const typeKey = type === TransactionType.INCOME ? 'income' : 'expense';
      const updatedCategories = {
        ...categories,
        [typeKey]: categories[typeKey].filter((c: string) => c !== categoryName)
      };
      setCategories(updatedCategories);
      localStorage.setItem('finance_categories', JSON.stringify(updatedCategories));
      setTransactions(transactions.map(t => t.type === type && t.category === categoryName ? { ...t, category: 'Outros' } : t));
    } finally { setIsLoading(false); }
  };

  const selectedMonthIndex = currentDate.getMonth();
  const selectedYear = currentDate.getFullYear();
  const selectedMonthName = MONTH_NAMES[selectedMonthIndex];
  const firstDayOfSelectedMonth = new Date(selectedYear, selectedMonthIndex, 1);

  const previousBalance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      const tDate = new Date(t.date + 'T12:00:00');
      if (tDate < firstDayOfSelectedMonth) {
        return acc + (t.type === TransactionType.INCOME ? t.amount : -t.amount);
      }
      return acc;
    }, systemBaselineBalance);
  }, [transactions, systemBaselineBalance, selectedMonthIndex, selectedYear]);

  const currentMonthTxs = transactions.filter(t => {
    const d = new Date(t.date + 'T12:00:00');
    return d.getMonth() === selectedMonthIndex && d.getFullYear() === selectedYear;
  });

  const monthIncome = currentMonthTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
  const monthExpense = currentMonthTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
  const closingBalance = previousBalance + monthIncome - monthExpense;

  if (!authChecked) return null;
  if (!isDatabaseReady && currentUser) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-8">
           <div className="flex flex-col items-center mb-6 text-center">
             <div className="bg-orange-600/20 p-4 rounded-full mb-4"><Database size={48} className="text-orange-500" /></div>
             <h1 className="text-2xl font-bold text-white mb-2">Reparo Necessário</h1>
             <p className="text-gray-400">Execute o código SQL no painel do Supabase:</p>
           </div>
           <pre className="bg-gray-950 text-green-400 p-4 rounded-lg text-xs overflow-auto mb-6">{SQL_SETUP_SCRIPT}</pre>
           <button onClick={() => window.location.reload()} className="w-full bg-blue-600 py-3 rounded-lg font-bold">Recarregar Sistema</button>
        </div>
      </div>
    );
  }

  if (!currentUser) return <Login onLoginSuccess={() => window.location.reload()} />;

  const isAdmin = currentUser.role === 'ADMIN';
  const isCollaborator = currentUser.role === 'COLLABORATOR';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 pb-12">
      {isLoading && <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-blue-500" size={48} /></div>}
      
      <header className="bg-gray-950 border-b border-gray-800 shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg"><LayoutDashboard size={28} className="text-white" /></div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Mirella Pro</h1>
                <span className="text-[10px] font-black uppercase text-green-500 bg-green-500/10 px-1.5 rounded flex items-center gap-1 w-fit mt-1">
                  <Cloud size={10} /> {isSupabaseConfigured ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4">
              {!isCollaborator && (
                <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg p-1">
                  <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} className="p-1 text-gray-400 hover:text-white"><ChevronLeft size={16} /></button>
                  <div className="px-3 text-sm font-bold text-white min-w-[140px] text-center capitalize">{selectedMonthName} {selectedYear}</div>
                  <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} className="p-1 text-gray-400 hover:text-white"><ChevronRight size={16} /></button>
                </div>
              )}
              
              <nav className="flex bg-gray-800 rounded-lg p-1">
                {!isCollaborator ? (
                  <>
                    <TabButton active={activeTab === ActiveTab.INPUT} onClick={() => setActiveTab(ActiveTab.INPUT)} icon={<Wallet size={18} />} label="Entradas" />
                    <TabButton active={activeTab === ActiveTab.MANAGEMENT} onClick={() => setActiveTab(ActiveTab.MANAGEMENT)} icon={<Receipt size={18} />} label="Gestão" />
                    <TabButton active={activeTab === ActiveTab.DASHBOARD} onClick={() => setActiveTab(ActiveTab.DASHBOARD)} icon={<TrendingUp size={18} />} label="Fluxo" />
                    <TabButton active={activeTab === ActiveTab.PDV} onClick={() => setActiveTab(ActiveTab.PDV)} icon={<ShoppingCart size={18} />} label="PDV" />
                    {isAdmin && <TabButton active={activeTab === ActiveTab.USERS} onClick={() => setActiveTab(ActiveTab.USERS)} icon={<Users size={18} />} label="Usuários" />}
                  </>
                ) : (
                  <TabButton active={activeTab === ActiveTab.PDV} onClick={() => setActiveTab(ActiveTab.PDV)} icon={<ShoppingCart size={18} />} label="Terminal de Vendas PDV" />
                )}
              </nav>

              <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-white">{currentUser.name}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{currentUser.role === 'COLLABORATOR' ? 'Vendedor PDV' : currentUser.role}</p>
                </div>
                <button onClick={() => { auth.logout(); window.location.reload(); }} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg"><LogOut size={20} /></button>
              </div>
            </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex flex-col gap-6">
        {activeTab !== ActiveTab.USERS && activeTab !== ActiveTab.PDV && !isCollaborator && (
          <>
            <div className="flex justify-between items-center bg-gray-800/50 border border-gray-700/50 rounded-xl px-6 py-3">
              <div className="flex items-center gap-2 text-gray-400">
                <PiggyBank size={20} className="text-pink-500" />
                <span className="text-xs font-bold uppercase tracking-widest">Caixa Inicial:</span>
                <div 
                  className="flex items-center gap-2 cursor-pointer bg-gray-900 px-3 py-1 rounded border border-gray-700 group"
                  onClick={() => { if(!isCollaborator) { setTempBalance(systemBaselineBalance.toString()); setIsEditingBaseline(true); } }}
                >
                  {isEditingBaseline ? (
                    <input autoFocus value={tempBalance} onChange={e => setTempBalance(e.target.value)} onBlur={handleSaveBaseline} onKeyDown={e => e.key === 'Enter' && handleSaveBaseline()} className="bg-transparent text-sm text-white w-20 text-right outline-none" />
                  ) : (
                    <>
                      <span className="text-sm font-bold text-white">{formatCurrency(systemBaselineBalance)}</span>
                      {!isCollaborator && <Edit3 size={12} className="text-gray-600 group-hover:text-blue-400" />}
                    </>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-gray-500 font-bold uppercase">
                 Saldo Anterior: <span className={previousBalance >= 0 ? "text-green-500" : "text-red-500"}>{formatCurrency(previousBalance)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard title="Abertura" value={formatCurrency(previousBalance)} colorClass="bg-gray-800" icon={<PiggyBank size={24} />} />
                <SummaryCard title="Entradas" value={formatCurrency(monthIncome)} colorClass="bg-green-900/30" icon={<TrendingUp size={24} />} />
                <SummaryCard title="Saídas" value={formatCurrency(monthExpense)} colorClass="bg-red-900/30" icon={<TrendingDown size={24} />} />
                <SummaryCard title="Fechamento" value={formatCurrency(closingBalance)} colorClass={closingBalance >= 0 ? "bg-blue-900/30" : "bg-orange-900/30"} icon={<DollarSign size={24} />} />
            </div>
          </>
        )}

        {activeTab === ActiveTab.INPUT && !isCollaborator && <TransactionForm onAddTransaction={handleAddTransactions} incomeCategories={categories.income} expenseCategories={categories.expense} onAddCategory={(t, c) => setCategories((p: any) => ({...p, [t === TransactionType.INCOME ? 'income' : 'expense']: [...p[t === TransactionType.INCOME ? 'income' : 'expense'], c]}))} onRenameCategory={handleRenameCategory} onDeleteCategory={handleDeleteCategory} units={units} onAddUnit={() => {}} onRenameUnit={() => {}} onDeleteUnit={() => {}} existingTransactions={transactions} />}
        {activeTab === ActiveTab.PDV && <PDV onAddTransaction={handleAddTransactions} existingTransactions={transactions} />}
        {activeTab === ActiveTab.MANAGEMENT && !isCollaborator && <TransactionTable transactions={transactions} onDelete={(id) => db.deleteTransaction(id).then(() => setTransactions(p => p.filter(t => t.id !== id)))} onDeleteMany={() => {}} onUpdate={handleUpdateTransaction} units={units} incomeCategories={categories.income} expenseCategories={categories.expense} />}
        {activeTab === ActiveTab.DASHBOARD && !isCollaborator && <Dashboard transactions={transactions} units={units} />}
        {activeTab === ActiveTab.USERS && isAdmin && <UserManagement availableUnits={units} />}
      </main>
      
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(p => ({...p, isOpen: false}))} />
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>{icon}<span className="hidden sm:inline">{label}</span></button>
);

export default App;
