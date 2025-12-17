
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, PaymentStatus, User } from './types';
import { db } from './services/db';
import { auth } from './services/auth';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import TransactionTable from './components/TransactionTable';
import SummaryCard from './components/SummaryCard';
import ConfirmModal from './components/ConfirmModal';
import Login from './components/Login';
import { formatCurrency, formatDate } from './utils';
import { LayoutDashboard, Wallet, Receipt, TrendingUp, TrendingDown, DollarSign, LogOut, Loader2, Database, Copy, ChevronLeft, ChevronRight, PiggyBank, Edit3, ArrowRight } from 'lucide-react';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, MONTH_NAMES, SINGLE_STORE_NAME } from './constants';

enum ActiveTab {
  INPUT = 'INPUT',
  DASHBOARD = 'DASHBOARD',
  MANAGEMENT = 'MANAGEMENT',
  USERS = 'USERS',
}

const SQL_SETUP_SCRIPT = `-- SCRIPT DE REPARAÇÃO
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reviewed boolean DEFAULT false;
`;

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDatabaseReady, setIsDatabaseReady] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.INPUT);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Este é o saldo absoluto no dia que você começou a usar o sistema
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
          setIsLoading(true);
          const [txs] = await Promise.all([db.getTransactions(), db.getUsers()]);
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
      else alert("Erro ao atualizar");
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

  const selectedMonthIndex = currentDate.getMonth();
  const selectedYear = currentDate.getFullYear();
  const selectedMonthName = MONTH_NAMES[selectedMonthIndex];
  
  // 1. DATA DE CORTE: Primeiro dia do mês selecionado
  const firstDayOfSelectedMonth = new Date(selectedYear, selectedMonthIndex, 1);

  // 2. SALDO ANTERIOR (ROLLOVER): Soma tudo que aconteceu ANTES do mês atual
  const previousBalance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      const tDate = new Date(t.date + 'T12:00:00');
      if (tDate < firstDayOfSelectedMonth) {
        return acc + (t.type === TransactionType.INCOME ? t.amount : -t.amount);
      }
      return acc;
    }, systemBaselineBalance);
  }, [transactions, systemBaselineBalance, selectedMonthIndex, selectedYear]);

  // 3. MOVIMENTAÇÃO DO MÊS ATUAL
  const currentMonthTxs = transactions.filter(t => {
    const d = new Date(t.date + 'T12:00:00');
    return d.getMonth() === selectedMonthIndex && d.getFullYear() === selectedYear;
  });

  const monthIncome = currentMonthTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
  const monthExpense = currentMonthTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
  const pendingExpense = currentMonthTxs.filter(t => t.type === TransactionType.EXPENSE && t.status === PaymentStatus.PENDING).reduce((s, t) => s + t.amount, 0);
  
  // 4. SALDO FINAL DO MÊS (O que vai para o próximo)
  const closingBalance = previousBalance + monthIncome - monthExpense;

  if (!authChecked) return null;
  if (!isDatabaseReady && currentUser) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-2xl w-full p-8">
           <div className="flex flex-col items-center mb-6 text-center">
             <div className="bg-orange-600/20 p-4 rounded-full mb-4"><Database size={48} className="text-orange-500" /></div>
             <h1 className="text-2xl font-bold text-white mb-2">Reparo Necessário</h1>
             <p className="text-gray-400">Execute o código abaixo no SQL Editor do Supabase:</p>
           </div>
           <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 mb-6 relative">
              <pre className="text-xs text-green-400 font-mono overflow-x-auto p-2 h-32">{SQL_SETUP_SCRIPT}</pre>
              <button onClick={() => { navigator.clipboard.writeText(SQL_SETUP_SCRIPT); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }} className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold">
                {copySuccess ? 'Copiado!' : 'Copiar'}
              </button>
           </div>
           <button onClick={() => window.location.reload()} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">Recarregar</button>
        </div>
      </div>
    );
  }

  if (!currentUser) return <Login onLoginSuccess={() => window.location.reload()} />;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 pb-12">
      {isLoading && <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-blue-500" size={48} /></div>}
      
      <header className="bg-gray-950 border-b border-gray-800 shadow-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg"><LayoutDashboard size={28} className="text-white" /></div>
              <h1 className="text-2xl font-bold text-white">FinanceMaster Pro</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg p-1">
                 <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()-1); setCurrentDate(d); }} className="p-1 text-gray-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
                 <div className="px-3 text-sm font-bold text-white min-w-[140px] text-center capitalize">{selectedMonthName} {selectedYear}</div>
                 <button onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth()+1); setCurrentDate(d); }} className="p-1 text-gray-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
              </div>
              <nav className="flex bg-gray-800 rounded-lg p-1">
                <TabButton active={activeTab === ActiveTab.INPUT} onClick={() => setActiveTab(ActiveTab.INPUT)} icon={<Wallet size={18} />} label="Entradas" />
                <TabButton active={activeTab === ActiveTab.MANAGEMENT} onClick={() => setActiveTab(ActiveTab.MANAGEMENT)} icon={<Receipt size={18} />} label="Gerenciamento" />
                <TabButton active={activeTab === ActiveTab.DASHBOARD} onClick={() => setActiveTab(ActiveTab.DASHBOARD)} icon={<TrendingUp size={18} />} label="Fluxo" />
              </nav>
              <button onClick={() => { auth.logout(); window.location.reload(); }} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"><LogOut size={20} /></button>
            </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex flex-col gap-6">
        {/* CONFIGURAÇÃO DO FUNDO DE CAIXA INICIAL (Onde tudo começou) */}
        <div className="flex justify-between items-center bg-gray-800/50 border border-gray-700/50 rounded-xl px-6 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <PiggyBank size={20} className="text-pink-500" />
            <span className="text-xs font-bold uppercase tracking-widest">Fundo de Caixa Inicial (Baseline):</span>
            <div 
              className="flex items-center gap-2 cursor-pointer bg-gray-900 px-3 py-1 rounded border border-gray-700 hover:border-blue-500 transition-all group"
              onClick={() => { setTempBalance(systemBaselineBalance.toString()); setIsEditingBaseline(true); }}
            >
              {isEditingBaseline ? (
                <input 
                  type="text" 
                  autoFocus
                  value={tempBalance}
                  onChange={(e) => setTempBalance(e.target.value)}
                  onBlur={handleSaveBaseline}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveBaseline()}
                  className="bg-transparent text-sm text-white w-20 text-right outline-none"
                />
              ) : (
                <>
                  <span className="text-sm font-bold text-white">{formatCurrency(systemBaselineBalance)}</span>
                  <Edit3 size={12} className="text-gray-600 group-hover:text-blue-400" />
                </>
              )}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase">
             <span>Saldo Acumulado Anterior:</span>
             <span className={previousBalance >= 0 ? "text-green-500" : "text-red-500"}>{formatCurrency(previousBalance)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard title="Saldo de Abertura" value={formatCurrency(previousBalance)} colorClass="bg-gray-800 border-gray-700 border" icon={<PiggyBank size={24} className="text-gray-400" />} />
            <SummaryCard title="Entradas do Mês" value={formatCurrency(monthIncome)} colorClass="bg-green-900/40 border-green-700/50" icon={<TrendingUp size={24} className="text-green-500" />} />
            <SummaryCard title="Saídas do Mês" value={formatCurrency(monthExpense)} colorClass="bg-red-900/40 border-red-700/50" icon={<TrendingDown size={24} className="text-red-500" />} />
            <SummaryCard 
              title="Saldo de Fechamento" 
              value={formatCurrency(closingBalance)} 
              colorClass={`${closingBalance >= 0 ? 'bg-blue-900/40 border-blue-700/50' : 'bg-red-900/40 border-red-700/50'}`} 
              icon={<DollarSign size={24} className={closingBalance >= 0 ? "text-blue-400" : "text-red-400"} />} 
            />
        </div>

        {activeTab === ActiveTab.INPUT && <TransactionForm onAddTransaction={handleAddTransactions} incomeCategories={categories.income} expenseCategories={categories.expense} onAddCategory={(t, c) => setCategories((p: any) => ({...p, [t === TransactionType.INCOME ? 'income' : 'expense']: [...p[t === TransactionType.INCOME ? 'income' : 'expense'], c]}))} onRenameCategory={() => {}} onDeleteCategory={() => {}} units={units} onAddUnit={() => {}} onRenameUnit={() => {}} onDeleteUnit={() => {}} existingTransactions={transactions} />}
        {activeTab === ActiveTab.MANAGEMENT && <TransactionTable transactions={transactions} onDelete={(id) => db.deleteTransaction(id).then(() => setTransactions(p => p.filter(t => t.id !== id)))} onDeleteMany={() => {}} onUpdate={handleUpdateTransaction} units={units} incomeCategories={categories.income} expenseCategories={categories.expense} />}
        {activeTab === ActiveTab.DASHBOARD && <Dashboard transactions={transactions} units={units} />}
      </main>
      
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(p => ({...p, isOpen: false}))} />
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button type="button" onClick={onClick} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>{icon}<span className="hidden sm:inline">{label}</span></button>
);

export default App;
