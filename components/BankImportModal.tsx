
import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, ArrowRight, Trash2, FileText, Sparkles, Loader2, ListFilter } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          return result ? { ...item, category: result.category } : item;
        }));
      }
    } catch (error: any) {
      console.error("Erro na classificação:", error);
      const errorMsg = error.message === "API_KEY_MISSING" 
        ? "Configuração Incompleta: A Chave de API da IA não foi encontrada no servidor." 
        : "A IA encontrou um problema ao classificar. Verifique o console do navegador (F12) para detalhes técnicos.";
      alert(errorMsg);
    } finally {
      setAiLoading(false);
    }
  };

  const handleBulkApply = () => {
    if (!bulkCategory) return;
    setItems(prev => prev.map(item => item.selected ? { ...item, category: bulkCategory } : item));
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
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
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
                <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                   <span className="text-sm text-gray-300"><strong>{items.length}</strong> lançamentos.</span>
                   <button onClick={handleAiCategorization} disabled={aiLoading} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 transition-all hover:shadow-[0_0_15px_rgba(147,51,234,0.4)]">
                      {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} 
                      {aiLoading ? 'Processando IA...' : 'Classificar com Inteligência Artificial'}
                   </button>
                </div>

                <div className="flex items-center gap-2 bg-blue-900/10 p-2 rounded-lg border border-blue-900/30">
                    <ListFilter size={16} className="text-blue-400 ml-2" />
                    <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-xs text-white outline-none min-w-[200px] focus:border-blue-500">
                       <option value="">Definir Categoria em Massa...</option>
                       {([...expenseCategories, ...incomeCategories]).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button onClick={handleBulkApply} disabled={!bulkCategory} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-xs font-bold disabled:opacity-50 transition-colors">Aplicar</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-950 sticky top-0">
                      <tr><th className="p-3">Importar</th><th className="p-3">Data</th><th className="p-3">Descrição</th><th className="p-3">Valor</th><th className="p-3">Categoria</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {items.map((item) => (
                        <tr key={item.tempId} className={`hover:bg-gray-700/30 transition-colors ${!item.selected ? 'opacity-50' : ''}`}>
                          <td className="p-3 text-center"><input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-800" checked={item.selected} onChange={() => setItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, selected: !i.selected } : i))} /></td>
                          <td className="p-3 whitespace-nowrap">{item.date}</td>
                          <td className="p-3 truncate max-w-[200px]" title={item.description}>{item.description}</td>
                          <td className={`p-3 font-bold ${item.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(item.amount)}</td>
                          <td className="p-3">
                             <select value={item.category} onChange={(e) => setItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, category: e.target.value } : i))} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs w-full focus:border-blue-500 outline-none">
                                {(item.type === TransactionType.INCOME ? incomeCategories : expenseCategories).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                             </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          )}
        </div>

        {step === 2 && (
          <div className="p-6 border-t border-gray-700 flex justify-between items-center bg-gray-800 rounded-b-xl">
             <span className="text-sm text-gray-400 font-bold">{items.filter(i => i.selected).length} itens selecionados</span>
             <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">Voltar</button>
                <button onClick={handleProcessImport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-8 rounded-lg flex items-center gap-2 shadow-lg transition-transform hover:scale-105">
                  <CheckCircle2 size={18} /> Confirmar Importação
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankImportModal;
