
import React, { useState, useRef, useMemo } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, ArrowRight, Trash2, FileText, Sparkles, Loader2, ListFilter, EyeOff, Eye } from 'lucide-react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { generateId, formatCurrency } from '../utils';
import { aiService } from '../services/ai';

interface BankImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (transactions: Transaction[]) => void;
  incomeCategories: string[];
  expenseCategories: string[];
  units: string[];
}

interface ImportedItem {
  tempId: string;
  date: string;
  amount: number;
  description: string;
  type: TransactionType;
  category: string;
  unit: string;
  selected: boolean;
  isAutoCategorized?: boolean;
}

const BankImportModal: React.FC<BankImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  incomeCategories,
  expenseCategories,
  units
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [items, setItems] = useState<ImportedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [hideCategorized, setHideCategorized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtragem para mostrar apenas o que falta analisar
  const visibleItems = useMemo(() => {
    if (!hideCategorized) return items;
    return items.filter(item => item.category === 'Outros');
  }, [items, hideCategorized]);

  const stats = useMemo(() => {
    const total = items.length;
    const categorized = items.filter(i => i.category !== 'Outros').length;
    const pending = total - categorized;
    return { total, categorized, pending };
  }, [items]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseOFX(text);
      setLoading(false);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const parseOFX = (text: string) => {
    const transactions: ImportedItem[] = [];
    const cleanText = text.replace(/>\s+</g, '><');
    const rawTransactions = cleanText.split(/<STMTTRN>/i);

    rawTransactions.forEach((block, index) => {
      if (index === 0) return;
      const getValue = (tag: string) => {
        const regex = new RegExp(`<${tag}[^>]*>(.*?)(?:<\/${tag}>|<|$)`, 'i');
        const match = block.match(regex);
        return match ? match[1].trim() : null;
      };

      const dateRaw = getValue('DTPOSTED');
      const amountRaw = getValue('TRNAMT');
      const memoRaw = getValue('MEMO');
      const nameRaw = getValue('NAME');

      if (dateRaw && amountRaw) {
        const formattedDate = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;
        let rawAmount = parseFloat(amountRaw.replace(',', '.'));
        let description = (memoRaw || nameRaw || 'Movimentação Bancária').trim().replace(/\s+/g, ' ');
        const type = rawAmount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
        const category = "Outros";

        transactions.push({
          tempId: generateId(),
          date: formattedDate,
          amount: Math.abs(rawAmount),
          description: description,
          type: type,
          category: category,
          unit: units[0] || '',
          selected: true
        });
      }
    });
    setItems(transactions);
  };

  const handleAiCategorization = async () => {
    if (items.length === 0) return;
    
    setAiLoading(true);
    try {
      const allCats = [...incomeCategories, ...expenseCategories];
      const payload = items.map(i => ({ description: i.description, type: i.type }));
      const results = await aiService.classifyBulk(payload, allCats);

      if (results && Array.isArray(results)) {
        setItems(prevItems => prevItems.map(item => {
          const result = results.find((r: any) => r.description === item.description);
          if (result && result.category !== 'Outros') {
            return { ...item, category: result.category, isAutoCategorized: true };
          }
          return item;
        }));
      }
    } catch (error: any) {
      console.error("Erro na classificação:", error);
      alert("Houve um erro na categorização. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleBulkApply = () => {
    if (!bulkCategory) return;
    setItems(prev => prev.map(item => (item.selected && visibleItems.includes(item)) ? { ...item, category: bulkCategory } : item));
  };

  const handleProcessImport = () => {
    const selectedItems = items.filter(i => i.selected);
    const newTransactions: Transaction[] = selectedItems.map(i => ({
      id: generateId(),
      date: i.date,
      description: i.description,
      amount: i.amount,
      type: i.type,
      category: i.category,
      unit: i.unit,
      status: PaymentStatus.PAID,
      createdAt: new Date().toISOString()
    }));
    onImport(newTransactions);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Upload className="text-blue-500" /> Importar Extrato Bancário</h2>
            <p className="text-sm text-gray-400">Suporta arquivos .OFX e .XML</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
          {step === 1 ? (
            <div className="h-full flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-700 rounded-xl bg-gray-900/30">
               <FileText size={64} className="text-gray-600 mb-4" />
               <input type="file" ref={fileInputRef} accept=".ofx,.xml" onChange={handleFileUpload} className="hidden" />
               <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-transform hover:scale-105">Selecionar Arquivo</button>
            </div>
          ) : (
             <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                   <div className="flex gap-4">
                      <div className="text-center">
                         <p className="text-[10px] text-gray-500 uppercase font-bold">Total</p>
                         <p className="text-lg font-bold text-white">{stats.total}</p>
                      </div>
                      <div className="text-center border-l border-gray-700 pl-4">
                         <p className="text-[10px] text-gray-500 uppercase font-bold">Analisados</p>
                         <p className="text-lg font-bold text-green-400">{stats.categorized}</p>
                      </div>
                      <div className="text-center border-l border-gray-700 pl-4">
                         <p className="text-[10px] text-gray-500 uppercase font-bold">Pendentes</p>
                         <p className="text-lg font-bold text-orange-400">{stats.pending}</p>
                      </div>
                   </div>

                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setHideCategorized(!hideCategorized)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${hideCategorized ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
                        title="Oculta da lista o que já tem categoria definida para você focar no que falta"
                      >
                        {hideCategorized ? <Eye size={16} /> : <EyeOff size={16} />}
                        {hideCategorized ? 'Mostrar Tudo' : 'Limpar Analisados'}
                      </button>

                      <button onClick={handleAiCategorization} disabled={aiLoading} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 transition-all hover:shadow-[0_0_15px_rgba(147,51,234,0.4)]">
                        {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                        {aiLoading ? 'Processando...' : 'IA Categorizar'}
                      </button>
                   </div>
                </div>

                <div className="flex items-center gap-2 bg-blue-900/10 p-2 rounded-lg border border-blue-900/30">
                    <ListFilter size={16} className="text-blue-400 ml-2" />
                    <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-xs text-white outline-none min-w-[200px] focus:border-blue-500">
                       <option value="">Definir Categoria em Massa...</option>
                       {([...expenseCategories, ...incomeCategories]).sort().map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button onClick={handleBulkApply} disabled={!bulkCategory} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-xs font-bold disabled:opacity-50 transition-colors">Aplicar na Visão</button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-700">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-950 sticky top-0">
                      <tr><th className="p-3 w-10">#</th><th className="p-3">Data</th><th className="p-3">Descrição</th><th className="p-3">Valor</th><th className="p-3">Categoria</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {visibleItems.length === 0 ? (
                        <tr><td colSpan={5} className="p-10 text-center text-gray-500 italic">Nada para mostrar. {hideCategorized ? 'Todos os itens visíveis já foram categorizados!' : 'Importe um arquivo primeiro.'}</td></tr>
                      ) : (
                        visibleItems.map((item) => (
                          <tr key={item.tempId} className={`hover:bg-gray-700/30 transition-colors ${!item.selected ? 'opacity-50' : ''} ${item.isAutoCategorized ? 'bg-purple-900/5' : ''}`}>
                            <td className="p-3 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-800" checked={item.selected} onChange={() => setItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, selected: !i.selected } : i))} /></td>
                            <td className="p-3 whitespace-nowrap text-xs">{item.date}</td>
                            <td className="p-3 truncate max-w-[250px]" title={item.description}>{item.description}</td>
                            <td className={`p-3 font-bold ${item.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(item.amount)}</td>
                            <td className="p-3">
                               <select 
                                  value={item.category} 
                                  onChange={(e) => setItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, category: e.target.value, isAutoCategorized: false } : i))} 
                                  className={`bg-gray-900 border rounded px-2 py-1 text-xs w-full outline-none focus:border-blue-500 transition-colors ${item.category !== 'Outros' ? 'border-green-800 text-green-300' : 'border-gray-700 text-gray-400'}`}
                                >
                                  {(item.type === TransactionType.INCOME ? incomeCategories : expenseCategories).sort().map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                               </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          )}
        </div>

        {step === 2 && (
          <div className="p-6 border-t border-gray-700 flex justify-between items-center bg-gray-800 rounded-b-xl">
             <div className="flex flex-col">
                <span className="text-sm text-gray-200 font-bold">{items.filter(i => i.selected).length} itens selecionados</span>
                <span className="text-[10px] text-gray-500">Dica: Os analisados podem ser ocultados para facilitar a conferência.</span>
             </div>
             <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Voltar</button>
                <button onClick={handleProcessImport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-8 rounded-lg flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
                  <CheckCircle2 size={18} /> Confirmar {items.filter(i => i.selected).length} Lançamentos
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankImportModal;
