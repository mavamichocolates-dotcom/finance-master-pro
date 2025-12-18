
import React, { useState, useEffect } from 'react';
import { Plus, Save, Calendar, DollarSign, Tag, List, X, Building2, Settings, Edit2, Trash2, History, TrendingUp, TrendingDown, CheckCircle2, Copy, Repeat, Divide, ArrowRight, Upload, Sparkles, Loader2, Info } from 'lucide-react';
import { TransactionType, PaymentStatus, Transaction } from '../types';
import { generateId, getTodayString, formatCurrency, formatDate } from '../utils';
import { SINGLE_STORE_NAME } from '../constants';
import BankImportModal from './BankImportModal';
import { aiService, SuggestionResult } from '../services/ai';

interface TransactionFormProps {
  onAddTransaction: (transactions: Transaction[]) => void;
  incomeCategories: string[];
  expenseCategories: string[];
  onAddCategory: (type: TransactionType, category: string) => void;
  onRenameCategory: (type: TransactionType, oldName: string, newName: string) => void;
  onDeleteCategory: (type: TransactionType, name: string) => void;
  units: string[]; 
  onAddUnit: (unit: string) => void; 
  onRenameUnit: (oldName: string, newName: string) => void; 
  onDeleteUnit: (name: string) => void; 
  defaultUnit?: string;
  lastTransaction?: Transaction | null;
  existingTransactions: Transaction[];
}

type RepeatMode = 'SINGLE' | 'INSTALLMENT' | 'RECURRING';

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onAddTransaction, 
  incomeCategories, 
  expenseCategories,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  lastTransaction,
  existingTransactions
}) => {
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  
  // Estados da IA
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const [aiResult, setAiResult] = useState<SuggestionResult | null>(null);
  
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('SINGLE');
  const [repeatCount, setRepeatCount] = useState(2);
  const unit = SINGLE_STORE_NAME;

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Limpa sugestões se mudar a descrição significativamente
  useEffect(() => {
    if (aiResult) setAiResult(null);
  }, [description, type]);

  const handleAiSuggest = async () => {
    if (!description) return;
    setIsAiSuggesting(true);
    try {
      const cats = type === TransactionType.INCOME ? incomeCategories : expenseCategories;
      const result = await aiService.suggestCategory(description, type, cats);
      setAiResult(result);
      setCategory(result.category);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiSuggesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !category || !date) return;

    const numAmount = parseFloat(amount.replace(',', '.'));
    const newTransactions: Transaction[] = [];
    const isReviewed = type === TransactionType.INCOME || (category !== 'Outros');

    if (repeatMode === 'SINGLE') {
      newTransactions.push({
        id: generateId(),
        description,
        amount: numAmount,
        type,
        category,
        date,
        status,
        unit,
        reviewed: isReviewed,
      });
    } else {
      const baseDate = new Date(date);
      for (let i = 0; i < repeatCount; i++) {
        const installmentDate = new Date(baseDate.getTime());
        installmentDate.setMonth(baseDate.getMonth() + i);
        newTransactions.push({
          id: generateId(),
          description: repeatMode === 'INSTALLMENT' ? `${description} (${i + 1}/${repeatCount})` : description,
          amount: repeatMode === 'INSTALLMENT' ? numAmount / repeatCount : numAmount,
          type,
          category,
          date: installmentDate.toISOString().split('T')[0],
          status: i === 0 ? status : PaymentStatus.PENDING,
          unit,
          reviewed: isReviewed,
        });
      }
    }

    onAddTransaction(newTransactions);
    setDescription('');
    setAmount('');
    setRepeatMode('SINGLE');
    setAiResult(null);
  };

  const handleCloneLast = () => {
    if (!lastTransaction) return;
    setType(lastTransaction.type);
    setDescription(lastTransaction.description);
    setAmount(lastTransaction.amount.toString());
    setCategory(lastTransaction.category);
    setStatus(lastTransaction.status);
  };

  const handleSaveNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      onAddCategory(type, newCategoryName.trim());
      setCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
    }
  };

  const currentCategories = type === TransactionType.INCOME ? incomeCategories : expenseCategories;
  const headerColor = type === TransactionType.INCOME ? 'bg-green-700' : 'bg-red-700';

  // Helper para cor da confiança
  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400 bg-green-900/30 border-green-700/50';
    if (score >= 0.5) return 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50';
    return 'text-red-400 bg-red-900/30 border-red-700/50';
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700 relative flex flex-col">
      <div className={`${headerColor} p-4 text-white flex justify-between items-center transition-colors duration-300`}>
        <h2 className="text-xl font-bold flex items-center gap-2">
          {type === TransactionType.INCOME ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          Novo Lançamento {type === TransactionType.INCOME ? '(Venda)' : '(Despesa)'}
        </h2>
        <div className="flex gap-3">
          <button type="button" onClick={() => setIsImportModalOpen(true)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-white/20">
            <Upload size={14} /> Importar Extrato
          </button>
          <div className="flex bg-black/20 rounded-lg p-1">
            <button type="button" onClick={() => setType(TransactionType.EXPENSE)} className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${type === TransactionType.EXPENSE ? 'bg-red-500 shadow-md' : 'hover:bg-white/10'}`}>Saída</button>
            <button type="button" onClick={() => setType(TransactionType.INCOME)} className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${type === TransactionType.INCOME ? 'bg-green-500 shadow-md' : 'hover:bg-white/10'}`}>Entrada</button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="col-span-1 md:col-span-2">
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2">
            <List size={16} /> Descrição / Detalhes
          </label>
          <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500 transition-colors" placeholder="Ex: Venda Balcão ou Compra Embalagens" />
        </div>

        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><Tag size={16} /> Categoria</span>
            <div className="flex items-center gap-2">
              {aiResult && (
                <div className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase flex items-center gap-1 ${getConfidenceColor(aiResult.confidence)} animate-fade-in-up`}>
                  <Sparkles size={8} /> {Math.round(aiResult.confidence * 100)}% Confiança
                </div>
              )}
              <button 
                type="button" 
                onClick={handleAiSuggest} 
                disabled={isAiSuggesting || !description}
                className="text-[10px] flex items-center gap-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30 transition-all disabled:opacity-30"
              >
                {isAiSuggesting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                IA Sugerir
              </button>
            </div>
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500">
                <option value="">Selecione...</option>
                {currentCategories.map((cat, idx) => (
                  <option key={`${cat}-${idx}`} value={cat}>{cat}</option>
                ))}
              </select>
              <button type="button" onClick={() => setIsCategoryModalOpen(true)} className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-md px-3 flex items-center justify-center transition-colors"><Plus size={20} /></button>
              <button type="button" onClick={() => setIsCategoryManageOpen(true)} className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-md px-3 flex items-center justify-center transition-colors"><Settings size={20} /></button>
            </div>
            
            {/* Alternativas Sugeridas */}
            {aiResult && aiResult.alternatives.length > 0 && (
              <div className="mt-1 animate-fade-in-up">
                <p className="text-[10px] text-gray-500 mb-1 flex items-center gap-1 uppercase font-bold tracking-tight">
                   <Info size={10} /> Ou prefere:
                </p>
                <div className="flex flex-wrap gap-1">
                  {aiResult.alternatives.map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      onClick={() => setCategory(alt)}
                      className="text-[10px] bg-gray-700 hover:bg-blue-900/50 text-gray-300 hover:text-blue-300 px-2 py-0.5 rounded border border-gray-600 hover:border-blue-500 transition-all"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2"><DollarSign size={16} /> Valor Total (R$)</label>
          <input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500" placeholder="0,00" />
        </div>

        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2"><Calendar size={16} /> Data</label>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2 text-xs">Status do Pagamento</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)} className={`w-full text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none font-bold ${status === PaymentStatus.PAID ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
            <option value={PaymentStatus.PAID}>{type === TransactionType.INCOME ? 'RECEBIDO' : 'PAGO'}</option>
            <option value={PaymentStatus.PENDING}>PENDENTE</option>
          </select>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2"><Repeat size={16} /> Repetição</label>
          <div className="flex gap-4 bg-gray-900/50 p-2.5 rounded-lg border border-gray-700">
             <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={repeatMode === 'SINGLE'} onChange={() => setRepeatMode('SINGLE')} /> <span className="text-sm">Único</span></label>
             <label className="flex items-center gap-2 cursor-pointer"><input type="radio" checked={repeatMode === 'INSTALLMENT'} onChange={() => setRepeatMode('INSTALLMENT')} /> <span className="text-sm">Parcelar</span></label>
             {repeatMode !== 'SINGLE' && <input type="number" min="2" value={repeatCount} onChange={e => setRepeatCount(parseInt(e.target.value))} className="w-16 bg-gray-800 border border-blue-500 rounded text-center text-sm" />}
          </div>
        </div>

        <div className="md:col-span-2 lg:col-span-4 flex justify-end mt-4">
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transition-transform transform hover:scale-105">
            <Save size={20} /> Salvar Lançamento
          </button>
        </div>
      </form>
      
      {lastTransaction && (
        <div className="bg-gray-900/50 border-t border-gray-700 p-4">
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <History size={16} className="text-gray-500" />
                 <span className="text-xs text-gray-400 font-bold uppercase">Último: {lastTransaction.description}</span>
                 <span className={`text-xs font-bold ${lastTransaction.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(lastTransaction.amount)}</span>
              </div>
              <button type="button" onClick={handleCloneLast} className="text-[10px] font-bold text-blue-400 hover:underline uppercase">Clonar dados</button>
           </div>
        </div>
      )}

      <BankImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImport={onAddTransaction} incomeCategories={incomeCategories} expenseCategories={expenseCategories} units={[unit]} />

      {isCategoryModalOpen && (
        <SimpleInputModal title={`Nova Categoria`} value={newCategoryName} onChange={setNewCategoryName} onClose={() => setIsCategoryModalOpen(false)} onSubmit={handleSaveNewCategory} />
      )}

       {isCategoryManageOpen && (
        <ManageItemsModal 
          title={`Categorias`} 
          items={currentCategories} 
          onClose={() => setIsCategoryManageOpen(false)} 
          onRename={(old, n) => onRenameCategory(type, old, n)} 
          onDelete={(n) => onDeleteCategory(type, n)} 
        />
      )}
    </div>
  );
};

interface SimpleInputModalProps { title: string; value: string; onChange: (val: string) => void; onClose: () => void; onSubmit: (e: React.FormEvent) => void; }
const SimpleInputModal: React.FC<SimpleInputModalProps> = ({ title, value, onChange, onClose, onSubmit }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
       <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
       <form onSubmit={onSubmit}><input autoFocus type="text" className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white mb-6" value={value} onChange={e => onChange(e.target.value)} /><div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 text-gray-300">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Adicionar</button></div></form>
    </div>
  </div>
);

interface ManageItemsModalProps { 
  title: string; 
  items: string[]; 
  onClose: () => void; 
  onRename: (oldName: string, newName: string) => void; 
  onDelete: (name: string) => void; 
}
const ManageItemsModal: React.FC<ManageItemsModalProps> = ({ title, items, onClose, onRename, onDelete }) => {
  const handleEditClick = (item: string) => {
    const newName = window.prompt(`Renomear "${item}" para:`, item);
    if (newName && newName.trim() && newName.trim() !== item) {
      onRename(item, newName.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[80vh] flex flex-col">
         <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={20} /></button></div>
         <div className="overflow-y-auto space-y-2 custom-scrollbar">
           {items.map(item => (
             <div key={item} className="bg-gray-900 p-3 rounded-lg flex justify-between items-center border border-gray-700/50 hover:border-gray-600 transition-colors">
               <span className="text-gray-200 font-medium">{item}</span>
               <div className="flex gap-1">
                 {item !== 'Outros' && (
                   <>
                    <button 
                      onClick={() => handleEditClick(item)} 
                      className="text-gray-400 hover:text-blue-400 p-2 rounded-md hover:bg-gray-800 transition-colors"
                      title="Renomear"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => onDelete(item)} 
                      className="text-gray-400 hover:text-red-400 p-2 rounded-md hover:bg-gray-800 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                   </>
                 )}
                 {item === 'Outros' && <span className="text-[9px] text-gray-600 font-bold uppercase py-2 px-1">Sistema</span>}
               </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
};

export default TransactionForm;
