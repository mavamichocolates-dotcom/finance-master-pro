
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

  const visibleItems = useMemo(() => {
    if (!hideCategorized) return items;
    return items.filter(item => item.category === 'Outros');
  }, [items, hideCategorized]);

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
        transactions.push({
          tempId: generateId(),
          date: formattedDate,
          amount: Math.abs(rawAmount),
          description: description,
          type: type,
          category: "Outros",
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
      const results = await aiService.classifyBulk(items, allCats);
      setItems(prev => prev.map(item => {
        const result = results.find(r => r.description === item.description);
        return result ? { ...item, category: result.category, isAutoCategorized: true } : item;
      }));
    } catch (error) {
      alert("Erro na IA");
    } finally {
      setAiLoading(false);
    }
  };

  const handleProcessImport = () => {
    const selectedItems = items.filter(i => i.selected);
    // APRENDIZADO AUTOMÁTICO: Antes de importar, ensinamos a IA as decisões tomadas nesta lista.
    selectedItems.forEach(item => {
      if (item.category !== 'Outros') {
        aiService.learn(item.description, item.category);
      }
    });

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
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Upload className="text-blue-500" /> Importar Extrato</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
          {step === 1 ? (
            <div className="h-full flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-700 rounded-xl">
               <input type="file" ref={fileInputRef} accept=".ofx,.xml" onChange={handleFileUpload} className="hidden" />
               <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg">Selecionar Arquivo</button>
            </div>
          ) : (
             <div className="space-y-4">
                <div className="flex justify-between bg-gray-900/50 p-4 rounded-lg">
                   <button onClick={() => setHideCategorized(!hideCategorized)} className="flex items-center gap-2 text-sm text-gray-400">
                     {hideCategorized ? <Eye size={16} /> : <EyeOff size={16} />} Analisados
                   </button>
                   <button onClick={handleAiCategorization} disabled={aiLoading} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                     {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} IA Categorizar
                   </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-700">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-950">
                      <tr><th className="p-3 w-10">#</th><th className="p-3">Data</th><th className="p-3">Descrição</th><th className="p-3">Valor</th><th className="p-3">Categoria</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {visibleItems.map((item) => (
                        <tr key={item.tempId} className={`hover:bg-gray-700/30 ${item.isAutoCategorized ? 'bg-purple-900/10' : ''}`}>
                          <td className="p-3 text-center"><input type="checkbox" checked={item.selected} onChange={() => setItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, selected: !i.selected } : i))} /></td>
                          <td className="p-3 text-xs">{item.date}</td>
                          <td className="p-3 truncate max-w-[250px]">{item.description}</td>
                          <td className={`p-3 font-bold ${item.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(item.amount)}</td>
                          <td className="p-3">
                             <select 
                                value={item.category} 
                                onChange={(e) => {
                                  // Quando o usuário muda manualmente aqui, também podemos marcar para aprender
                                  setItems(prev => prev.map(i => i.tempId === item.tempId ? { ...i, category: e.target.value, isAutoCategorized: false } : i));
                                }} 
                                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs w-full"
                              >
                                {(item.type === TransactionType.INCOME ? incomeCategories : expenseCategories).sort().map(cat => (<option key={cat} value={cat}>{cat}</option>))}
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
          <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-gray-800">
            <button onClick={handleProcessImport} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-8 rounded-lg flex items-center gap-2">
              <CheckCircle2 size={18} /> Confirmar Lançamentos
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankImportModal;
