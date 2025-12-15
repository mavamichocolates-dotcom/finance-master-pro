import React, { useState, useEffect } from 'react';
import { Plus, Save, Calendar, DollarSign, Tag, List, X, Building2, Settings, Edit2, Trash2, History, TrendingUp, TrendingDown, CheckCircle2, Copy, Repeat, Divide, ArrowRight, Upload } from 'lucide-react';
import { TransactionType, PaymentStatus, Transaction } from '../types';
import { generateId, getTodayString, formatCurrency, formatDate } from '../utils';
import BankImportModal from './BankImportModal';

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
}

type RepeatMode = 'SINGLE' | 'INSTALLMENT' | 'RECURRING';

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onAddTransaction, 
  incomeCategories, 
  expenseCategories,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
  units,
  onAddUnit,
  onRenameUnit,
  onDeleteUnit,
  defaultUnit,
  lastTransaction
}) => {
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  
  // Automation States
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('SINGLE');
  const [repeatCount, setRepeatCount] = useState(2);
  const [unit, setUnit] = useState(defaultUnit || (units.length > 0 ? units[0] : ''));

  // Update unit if defaultUnit changes or units load
  useEffect(() => {
    if (defaultUnit) {
      setUnit(defaultUnit);
    } else if (units.length > 0 && !unit) {
      setUnit(units[0]);
    }
  }, [defaultUnit, units]);

  // Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isCategoryManageOpen, setIsCategoryManageOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isUnitManageOpen, setIsUnitManageOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !category || !date || !unit) return;

    const numAmount = parseFloat(amount.replace(',', '.'));
    const newTransactions: Transaction[] = [];

    if (repeatMode === 'SINGLE') {
      // Single Transaction
      newTransactions.push({
        id: generateId(),
        description,
        amount: numAmount,
        type,
        category,
        date,
        status,
        unit,
      });
    } else {
      // Multiple Transactions (Installment OR Recurring)
      const baseDate = new Date(date);
      const isInstallment = repeatMode === 'INSTALLMENT';
      
      // LOGICA DE ARREDONDAMENTO (CORREÇÃO MATEMÁTICA)
      let installmentValue = numAmount;
      let firstInstallmentDiff = 0;

      if (isInstallment) {
        // Calcula o valor base truncado para 2 casas
        installmentValue = Math.floor((numAmount / repeatCount) * 100) / 100;
        // Calcula a diferença de centavos que sobrou
        const totalCalculated = installmentValue * repeatCount;
        firstInstallmentDiff = numAmount - totalCalculated;
        // Arredonda a diferença para evitar erros de ponto flutuante (ex: 0.009999999)
        firstInstallmentDiff = Math.round(firstInstallmentDiff * 100) / 100;
      }

      for (let i = 0; i < repeatCount; i++) {
        // Clone date safely
        const installmentDate = new Date(baseDate.getTime());
        // Handle month increment carefully to avoid timezone skips
        // Set the day to 1st to avoid month overflow (e.g. Jan 31 -> Feb 28), 
        // but here we likely want to keep the day if possible. 
        // Simple approach: Add month to the date object.
        installmentDate.setMonth(baseDate.getMonth() + i);
        
        // Adjust description based on mode
        let descSuffix = '';
        if (isInstallment) descSuffix = `(Parc. ${i + 1}/${repeatCount})`;
        else descSuffix = `(Mês ${i + 1}/${repeatCount})`;

        // Add the penny difference to the FIRST installment only
        let currentAmount = installmentValue;
        if (isInstallment && i === 0) {
            currentAmount += firstInstallmentDiff;
        }

        newTransactions.push({
          id: generateId(),
          description: `${description} ${descSuffix}`,
          amount: currentAmount,
          type,
          category,
          date: installmentDate.toISOString().split('T')[0],
          // First one takes current status, others usually pending (unless user wants all paid)
          status: i === 0 ? status : PaymentStatus.PENDING,
          installments: isInstallment ? { current: i + 1, total: repeatCount } : undefined,
          unit,
        });
      }
    }

    onAddTransaction(newTransactions);
    
    // Reset form partially
    setDescription('');
    setAmount('');
    setRepeatMode('SINGLE');
    setRepeatCount(2);
  };

  const handleCloneLast = () => {
    if (!lastTransaction) return;
    setType(lastTransaction.type);
    setDescription(lastTransaction.description);
    setAmount(lastTransaction.amount.toString());
    setCategory(lastTransaction.category);
    setUnit(lastTransaction.unit || unit);
    // Keep current date or set to last date? Usually keep 'today' for new entry is better flow
    // setDate(lastTransaction.date); 
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

  const handleSaveNewUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUnitName.trim()) {
      onAddUnit(newUnitName.trim());
      setUnit(newUnitName.trim());
      setNewUnitName('');
      setIsUnitModalOpen(false);
    }
  };

  const currentCategories = type === TransactionType.INCOME ? incomeCategories : expenseCategories;
  const headerColor = type === TransactionType.INCOME ? 'bg-green-700' : 'bg-red-700';

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700 relative flex flex-col">
      <div className={`${headerColor} p-4 text-white flex justify-between items-center transition-colors duration-300`}>
        <h2 className="text-xl font-bold flex items-center gap-2">
          {type === TransactionType.INCOME ? <Plus size={24} /> : <DollarSign size={24} />}
          Novo Lançamento
        </h2>
        <div className="flex gap-3">
          {/* IMPORT BUTTON */}
          <button 
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border border-white/20"
          >
            <Upload size={14} />
            Importar Extrato (XML)
          </button>

          <div className="flex bg-black/20 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setType(TransactionType.EXPENSE)}
              className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${
                type === TransactionType.EXPENSE ? 'bg-red-500 shadow-md' : 'hover:bg-white/10'
              }`}
            >
              Saída
            </button>
            <button
              type="button"
              onClick={() => setType(TransactionType.INCOME)}
              className={`px-4 py-1 rounded-md text-sm font-medium transition-all ${
                type === TransactionType.INCOME ? 'bg-green-500 shadow-md' : 'hover:bg-white/10'
              }`}
            >
              Entrada
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Description */}
        <div className="col-span-1 md:col-span-2">
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2">
            <List size={16} /> Descrição / Detalhes
          </label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Ex: Compra de insumos"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2">
            <Tag size={16} /> Categoria
          </label>
          <div className="flex gap-2">
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500"
            >
              <option value="">Selecione...</option>
              {currentCategories.map((cat, idx) => (
                <option key={`${cat}-${idx}`} value={cat}>{cat}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-md px-3 flex items-center justify-center transition-colors"
              title="Nova Categoria"
            >
              <Plus size={20} />
            </button>
             <button
              type="button"
              onClick={() => setIsCategoryManageOpen(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-md px-3 flex items-center justify-center transition-colors"
              title="Gerenciar Categorias"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

        {/* Value */}
        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2">
            <DollarSign size={16} /> Valor Total (R$)
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500"
            placeholder="0,00"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2">
            <Calendar size={16} /> Data do 1º Lançamento
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PaymentStatus)}
            className={`w-full text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none font-bold ${
              status === PaymentStatus.PAID ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
            }`}
          >
            <option value={PaymentStatus.PAID}>PAGO / RECEBIDO</option>
            <option value={PaymentStatus.PENDING}>PENDENTE</option>
          </select>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2">
            <Building2 size={16} /> Unidade
          </label>
          <div className="flex gap-2">
            <select
              required
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-gray-900 text-white border border-gray-600 rounded-md py-2 px-3 focus:outline-none focus:border-blue-500"
            >
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIsUnitModalOpen(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-md px-3 flex items-center justify-center transition-colors"
              title="Nova Unidade"
            >
              <Plus size={20} />
            </button>
            <button
              type="button"
              onClick={() => setIsUnitManageOpen(true)}
              className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600 rounded-md px-3 flex items-center justify-center transition-colors"
              title="Gerenciar Unidades"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>

         {/* Automation / Recurrence */}
         <div className="col-span-1 md:col-span-2">
          <label className="block text-gray-400 text-sm font-bold mb-2 flex items-center gap-2">
             <Repeat size={16} /> Automação / Repetição
          </label>
          <div className="flex flex-col md:flex-row gap-4 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
             
             <div className="flex items-center gap-4">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="radio" 
                   name="repeatMode" 
                   checked={repeatMode === 'SINGLE'} 
                   onChange={() => setRepeatMode('SINGLE')}
                   className="text-blue-600 focus:ring-blue-500"
                 />
                 <span className="text-sm text-gray-300">Único</span>
               </label>

               <label className="flex items-center gap-2 cursor-pointer" title="Divide o valor total em X parcelas">
                 <input 
                   type="radio" 
                   name="repeatMode" 
                   checked={repeatMode === 'INSTALLMENT'} 
                   onChange={() => setRepeatMode('INSTALLMENT')}
                   className="text-blue-600 focus:ring-blue-500"
                 />
                 <span className="text-sm text-gray-300 flex items-center gap-1"><Divide size={12}/> Parcelado</span>
               </label>

               <label className="flex items-center gap-2 cursor-pointer" title="Repete o MESMO valor por X meses (ex: Aluguel)">
                 <input 
                   type="radio" 
                   name="repeatMode" 
                   checked={repeatMode === 'RECURRING'} 
                   onChange={() => setRepeatMode('RECURRING')}
                   className="text-blue-600 focus:ring-blue-500"
                 />
                 <span className="text-sm text-gray-300 flex items-center gap-1"><Repeat size={12}/> Recorrente</span>
               </label>
             </div>

             {repeatMode !== 'SINGLE' && (
               <div className="flex items-center gap-2 animate-fade-in-up">
                 <span className="text-sm text-gray-400">Quantidade:</span>
                 <input
                    type="number"
                    min="2"
                    max="60"
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(parseInt(e.target.value) || 2)}
                    className="bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white w-16 text-center text-sm"
                  />
                  <span className="text-xs text-gray-500 italic">
                    {repeatMode === 'INSTALLMENT' 
                      ? `${formatCurrency((parseFloat(amount || '0') / repeatCount))} / mês`
                      : `${formatCurrency(parseFloat(amount || '0'))} / mês`
                    }
                  </span>
               </div>
             )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2 lg:col-span-4 flex justify-end mt-4">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transition-transform transform hover:scale-105"
          >
            <Save size={20} />
            {repeatMode === 'SINGLE' ? 'Registrar Lançamento' : `Gerar ${repeatCount} Lançamentos`}
          </button>
        </div>
      </form>
      
      {/* LAST TRANSACTION FOOTER */}
      {lastTransaction && (
        <div className="bg-gray-900/50 border-t border-gray-700 p-4 animate-fade-in-up">
           <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              
              <div className="flex items-center gap-3 flex-grow">
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1 mb-1">
                      <History size={12} /> Último Lançamento Salvo
                    </span>
                    <div className="flex items-center gap-2 text-white font-medium">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${lastTransaction.type === TransactionType.INCOME ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                         {lastTransaction.type === TransactionType.INCOME ? 'Entrada' : 'Saída'}
                      </span>
                      <span className="truncate max-w-[200px]">{lastTransaction.description}</span>
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-6 text-sm text-gray-300">
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 uppercase">Valor</span>
                    <span className={`font-bold ${lastTransaction.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(lastTransaction.amount)}
                    </span>
                 </div>
                 
                 <div className="h-8 w-px bg-gray-700 mx-2 hidden md:block"></div>

                 <button
                   onClick={handleCloneLast}
                   className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-gray-600 hover:border-gray-500"
                   title="Preencher formulário com estes dados"
                 >
                   <Copy size={14} />
                   Clonar para Novo
                 </button>
              </div>

           </div>
        </div>
      )}

      {/* --- MODALS --- */}

      <BankImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={onAddTransaction}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        units={units}
      />

      {/* Add Category Modal */}
      {isCategoryModalOpen && (
        <SimpleInputModal 
          title={`Nova Categoria de ${type === TransactionType.INCOME ? 'Entrada' : 'Saída'}`}
          value={newCategoryName}
          onChange={setNewCategoryName}
          onClose={() => setIsCategoryModalOpen(false)}
          onSubmit={handleSaveNewCategory}
        />
      )}

       {/* Manage Categories Modal */}
       {isCategoryManageOpen && (
        <ManageItemsModal 
          title={`Gerenciar Categorias (${type === TransactionType.INCOME ? 'Entrada' : 'Saída'})`}
          items={currentCategories}
          onClose={() => setIsCategoryManageOpen(false)}
          onRename={(oldName, newName) => onRenameCategory(type, oldName, newName)}
          onDelete={(name) => onDeleteCategory(type, name)}
        />
      )}

      {/* Add Unit Modal */}
      {isUnitModalOpen && (
        <SimpleInputModal 
           title="Nova Unidade / Loja"
           value={newUnitName}
           onChange={setNewUnitName}
           onClose={() => setIsUnitModalOpen(false)}
           onSubmit={handleSaveNewUnit}
        />
      )}

      {/* Manage Units Modal */}
      {isUnitManageOpen && (
        <ManageItemsModal 
          title="Gerenciar Unidades"
          items={units}
          onClose={() => setIsUnitManageOpen(false)}
          onRename={onRenameUnit}
          onDelete={onDeleteUnit}
        />
      )}

    </div>
  );
};

// --- Reusable Sub Components ---

interface SimpleInputModalProps {
  title: string;
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const SimpleInputModal: React.FC<SimpleInputModalProps> = ({ title, value, onChange, onClose, onSubmit }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up">
       <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
       </div>
       <form onSubmit={onSubmit}>
          <input 
              autoFocus
              type="text" 
              placeholder="Nome..."
              className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-white mb-6 focus:border-blue-500 outline-none placeholder-gray-500"
              value={value}
              onChange={e => onChange(e.target.value)}
          />
          <div className="flex justify-end gap-3">
              <button 
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={!value.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
          </div>
       </form>
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
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (item: string) => {
    setEditingItem(item);
    setEditValue(item);
  };

  const saveEdit = (oldName: string) => {
    if (editValue.trim() && editValue !== oldName) {
      onRename(oldName, editValue.trim());
    }
    setEditingItem(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in-up flex flex-col max-h-[80vh]">
         <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
         </div>
         
         <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-2">
            {items.length === 0 && <p className="text-gray-500 italic text-center py-4">Nenhum item cadastrado.</p>}
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                {editingItem === item ? (
                  <div className="flex flex-grow gap-2">
                    <input 
                      autoFocus
                      className="bg-gray-800 border border-blue-500 rounded px-2 py-1 text-white w-full text-sm"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(item);
                        if (e.key === 'Escape') setEditingItem(null);
                      }}
                    />
                    <button type="button" onClick={() => saveEdit(item)} className="text-green-400 p-1 hover:bg-green-900/20 rounded"><Save size={16} /></button>
                    <button type="button" onClick={() => setEditingItem(null)} className="text-gray-400 p-1 hover:bg-gray-700 rounded"><X size={16} /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-gray-200">{item}</span>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => startEdit(item)}
                        className="text-blue-400 p-1.5 hover:bg-blue-900/20 rounded transition-colors"
                        title="Renomear (Corrige histórico)"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => onDelete(item)}
                        className="text-red-400 p-1.5 hover:bg-red-900/20 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
         </div>
         
         <div className="mt-4 pt-2 border-t border-gray-700 text-center">
            <p className="text-xs text-gray-500">Ao renomear um item, todos os lançamentos históricos serão atualizados automaticamente.</p>
         </div>
      </div>
    </div>
  );
};

export default TransactionForm;