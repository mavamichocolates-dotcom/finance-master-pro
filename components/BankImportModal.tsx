import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, ArrowRight, Trash2, FileText, Sparkles, Loader2, ListFilter } from 'lucide-react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { generateId, formatCurrency } from '../utils';
import { GoogleGenAI, Type } from "@google/genai";

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
  
  // Bulk Edit State
  const [bulkCategory, setBulkCategory] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // --- PARSING LOGIC ---
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
    // Robust Parsing Logic for OFX/XML
    const transactions: ImportedItem[] = [];
    
    // Normalize XML slightly to handle line breaks within tags or missing newlines
    const cleanText = text.replace(/>\s+</g, '><');

    // Split by <STMTTRN> to get individual transaction blocks
    // Using Case Insensitive split regex
    const rawTransactions = cleanText.split(/<STMTTRN>/i);

    rawTransactions.forEach((block, index) => {
      if (index === 0) return; // Skip header info before first transaction

      // Extract Data using flexible regex that allows whitespace or attributes
      const getValue = (tag: string) => {
        const regex = new RegExp(`<${tag}[^>]*>(.*?)(?:<\/${tag}>|<|$)`, 'i');
        const match = block.match(regex);
        return match ? match[1].trim() : null;
      };

      const typeRaw = getValue('TRNTYPE');
      const dateRaw = getValue('DTPOSTED');
      const amountRaw = getValue('TRNAMT');
      const memoRaw = getValue('MEMO');
      const nameRaw = getValue('NAME'); // Often contains the description in BR banks

      if (dateRaw && amountRaw) {
        // Parse Date: YYYYMMDD...
        const formattedDate = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`;
        
        // Parse Amount Robustly (Handle BR 1.000,00 vs US 1000.00)
        let rawAmount = 0;
        // Check for specific BR pattern: contains both . and , OR contains only ,
        if (amountRaw.includes(',') && amountRaw.includes('.')) {
             // Likely 1.234,56 -> Remove dot, replace comma
             rawAmount = parseFloat(amountRaw.replace(/\./g, '').replace(',', '.'));
        } else if (amountRaw.includes(',')) {
             // Likely 1234,56 -> Replace comma
             rawAmount = parseFloat(amountRaw.replace(',', '.'));
        } else {
             // Likely 1234.56 or 1234 -> Parse directly
             rawAmount = parseFloat(amountRaw);
        }
        
        // Parse Description (Prefer MEMO, fallback to NAME, fallback to "Transferência")
        let description = (memoRaw || nameRaw || 'Movimentação Bancária').trim();
        // Remove excessive spaces
        description = description.replace(/\s+/g, ' ');

        // Determine Type
        const type = rawAmount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
        
        // --- BASIC REGEX CATEGORIZATION (First Pass) ---
        let category = 'Outros';
        const lowerDesc = description.toLowerCase();

        // Categorization Rules Map
        const rules = [
          // EXPENSES
          { terms: ['lalamove', 'loggi', 'uber', '99app', 'entreg', 'motoboy', 'flash'], cat: 'Frete/Entregas', type: TransactionType.EXPENSE },
          { terms: ['ifood', 'comis', 'taxa', 'tarif', 'sodexo', 'ticket', 'vr', 'alelo'], cat: 'Comissões/Taxas', type: TransactionType.EXPENSE },
          { terms: ['luz', 'energia', 'enel', 'eletropaulo', 'cpfl', 'light'], cat: 'Energia', type: TransactionType.EXPENSE },
          { terms: ['agua', 'sabesp', 'sanepar', 'copasa'], cat: 'Água', type: TransactionType.EXPENSE },
          { terms: ['net', 'claro', 'vivo', 'tim', 'oi', 'fibra', 'internet'], cat: 'Internet', type: TransactionType.EXPENSE },
          { terms: ['aluguel', 'condom', 'predio', 'imob'], cat: 'Aluguel', type: TransactionType.EXPENSE },
          { terms: ['simples', 'das', 'darf', 'inss', 'fgts', 'guia', 'tribut', 'imposto', 'mei'], cat: 'Impostos', type: TransactionType.EXPENSE },
          { terms: ['salario', 'folha', 'pagto', 'bco', 'func', 'rh '], cat: 'Salários', type: TransactionType.EXPENSE },
          { terms: ['atacad', 'assai', 'tenda', 'roldao', 'mercado', 'makro', 'sams', 'carrefour', 'extra', 'pao de acucar', 'embalagem', 'plastico'], cat: 'Insumos Gerais', type: TransactionType.EXPENSE },
          { terms: ['nutella', 'ferrero'], cat: 'Nutella', type: TransactionType.EXPENSE },
          { terms: ['kinder'], cat: 'Kinder Bueno', type: TransactionType.EXPENSE },
          { terms: ['manut', 'repar', 'obra', 'pintura', 'eletric'], cat: 'Manutenção', type: TransactionType.EXPENSE },
          { terms: ['face', 'insta', 'google', 'ads', 'mkt', 'promo'], cat: 'Marketing', type: TransactionType.EXPENSE },
          { terms: ['maquin', 'equip', 'forno', 'batedeira', 'freezer'], cat: 'Compras de Equipamentos', type: TransactionType.EXPENSE },
          
          // INCOME
          { terms: ['ifood', 'repasse', 'zoop', 'movile'], cat: 'iFood', type: TransactionType.INCOME },
          { terms: ['pix', 'transf', 'ted', 'doc', 'dep', 'venda', 'pagamento recebido'], cat: 'Vendas Loja', type: TransactionType.INCOME },
          { terms: ['rappi'], cat: 'Rappi', type: TransactionType.INCOME },
          { terms: ['99food'], cat: '99Food', type: TransactionType.INCOME },
        ];

        // Apply rules
        for (const rule of rules) {
          if (rule.type === type && rule.terms.some(term => lowerDesc.includes(term))) {
            category = rule.cat;
            break;
          }
        }
        
        // Validate Category against existing lists
        const validCategories = type === TransactionType.INCOME ? incomeCategories : expenseCategories;
        // If exact match doesn't exist, try to match partially or default to first/Outros
        if (!validCategories.includes(category)) {
           const match = validCategories.find(c => c.toLowerCase() === category.toLowerCase());
           if (match) {
             category = match;
           } else {
             category = validCategories.includes('Outros') ? 'Outros' : (validCategories[0] || 'Geral');
           }
        }

        transactions.push({
          tempId: generateId(),
          date: formattedDate,
          amount: Math.abs(rawAmount),
          description: description,
          type: type,
          category: category,
          unit: units[0] || '', // Default to first unit
          selected: true
        });
      }
    });

    setItems(transactions);
  };

  // --- AI CATEGORIZATION ---
  const handleAiCategorization = async () => {
    if (!process.env.API_KEY) {
       alert("Chave de API não configurada. A IA não pode ser iniciada.");
       return;
    }

    setAiLoading(true);
    try {
      // 1. Filter unique descriptions to save tokens and time
      const uniqueItems = Array.from(new Set(items.map(i => i.description)));
      const allCategories = [...incomeCategories, ...expenseCategories];

      // 2. Init Gemini
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 3. Prompt Engineering
      const prompt = `
        You are a financial assistant. I have a list of bank transaction descriptions.
        Map each description to the EXACT category name from the provided list that best fits.
        
        Categories Available: ${JSON.stringify(allCategories)}
        
        Transactions:
        ${JSON.stringify(uniqueItems)}
        
        If you are unsure, use "Outros".
        Return a JSON array of objects with 'description' and 'category'.
      `;

      // 4. Call Model
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                category: { type: Type.STRING },
              }
            }
          }
        }
      });

      // 5. Parse and Apply (CLEAN MARKDOWN)
      let text = response.text || '[]';
      // Safety: Strip markdown blocks if the model adds them despite MIME type
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      const jsonResponse = JSON.parse(text);
      const categoryMap = new Map<string, string>();
      
      jsonResponse.forEach((item: any) => {
        if (item.description && item.category) {
          categoryMap.set(item.description, item.category);
        }
      });

      // 6. Update State
      setItems(prevItems => prevItems.map(item => {
        const newCat = categoryMap.get(item.description);
        if (newCat) {
          return { ...item, category: newCat };
        }
        return item;
      }));

    } catch (error) {
      console.error("AI Categorization failed:", error);
      alert("Erro ao classificar com IA. Verifique sua conexão ou tente novamente.");
    } finally {
      setAiLoading(false);
    }
  };

  // --- BULK ACTIONS ---
  const handleBulkApply = () => {
    if (!bulkCategory) return;
    
    setItems(prev => prev.map(item => {
      // Only update selected items
      if (item.selected) {
        return { ...item, category: bulkCategory };
      }
      return item;
    }));
    
    // Optional: clear selector after apply or keep it? Keeping it allows re-apply.
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
    setTimeout(() => {
      setStep(1);
      setItems([]);
      setBulkCategory('');
    }, 500);
  };

  const toggleSelect = (id: string) => {
    setItems(prev => prev.map(item => item.tempId === id ? { ...item, selected: !item.selected } : item));
  };

  const updateItem = (id: string, field: keyof ImportedItem, value: any) => {
    setItems(prev => prev.map(item => item.tempId === id ? { ...item, [field]: value } : item));
  };

  // --- RENDER ---

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Upload className="text-blue-500" /> Importar Extrato Bancário
            </h2>
            <p className="text-sm text-gray-400">Suporta arquivos .OFX e .XML (Padrão Bancário)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6">
          
          {step === 1 && (
            <div className="h-full flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-700 rounded-xl bg-gray-900/30 hover:bg-gray-900/50 transition-colors">
               <FileText size={64} className="text-gray-600 mb-4" />
               <p className="text-lg text-gray-300 font-medium mb-2">Arraste seu arquivo OFX aqui ou clique para selecionar</p>
               <p className="text-sm text-gray-500 mb-6">Compatível com Nubank, Inter, Itaú, Bradesco, etc.</p>
               
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 accept=".ofx,.xml" 
                 onChange={handleFileUpload} 
                 className="hidden" 
               />
               
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
                 disabled={loading}
               >
                 {loading ? 'Lendo Arquivo...' : 'Selecionar Arquivo'}
               </button>
            </div>
          )}

          {step === 2 && (
             <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-700 gap-4">
                   <div className="text-sm text-gray-300">
                     Encontrados <strong>{items.length}</strong> lançamentos.
                   </div>
                   
                   <div className="flex gap-2 items-center">
                      <button 
                        onClick={handleAiCategorization}
                        disabled={aiLoading}
                        className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg transition-all border border-purple-500 disabled:opacity-50"
                        title="Usar Inteligência Artificial para classificar automaticamente"
                      >
                         {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                         {aiLoading ? 'Classificando...' : 'Classificar com IA'}
                      </button>

                      <div className="w-px h-6 bg-gray-700 mx-2 hidden md:block"></div>

                      <button onClick={() => setItems(prev => prev.map(i => ({...i, selected: true})))} className="text-xs text-blue-400 hover:underline whitespace-nowrap">Marcar Todos</button>
                      <button onClick={() => setItems(prev => prev.map(i => ({...i, selected: false})))} className="text-xs text-gray-400 hover:underline whitespace-nowrap">Desmarcar Todos</button>
                   </div>
                </div>

                {/* BULK EDIT TOOLBAR */}
                <div className="flex items-center gap-2 bg-blue-900/10 p-2 rounded-lg border border-blue-900/30">
                    <ListFilter size={16} className="text-blue-400 ml-2" />
                    <span className="text-xs font-bold text-gray-300 uppercase">Definir Categoria em Massa:</span>
                    
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-xs text-white focus:border-blue-500 outline-none min-w-[200px]"
                    >
                       <option value="">Selecione para aplicar...</option>
                       <optgroup label="Despesas">
                          {expenseCategories.map(cat => <option key={`exp-${cat}`} value={cat}>{cat}</option>)}
                       </optgroup>
                       <optgroup label="Entradas">
                          {incomeCategories.map(cat => <option key={`inc-${cat}`} value={cat}>{cat}</option>)}
                       </optgroup>
                    </select>

                    <button 
                      onClick={handleBulkApply}
                      disabled={!bulkCategory}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-xs font-bold shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                       Aplicar aos Selecionados
                    </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-xs uppercase bg-gray-900 text-gray-500 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-center">Importar</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Descrição (Banco)</th>
                        <th className="px-4 py-3">Valor</th>
                        <th className="px-4 py-3">Categoria (Sugerida)</th>
                        <th className="px-4 py-3">Unidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {items.map((item) => (
                        <tr key={item.tempId} className={`hover:bg-gray-700/30 transition-colors ${!item.selected ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            <input 
                              type="checkbox" 
                              checked={item.selected} 
                              onChange={() => toggleSelect(item.tempId)}
                              className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-800 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input 
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(item.tempId, 'date', e.target.value)}
                              className="bg-transparent border border-gray-700 rounded px-2 py-1 text-xs w-28 focus:border-blue-500 outline-none"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(item.tempId, 'description', e.target.value)}
                              className="bg-transparent border border-gray-700 rounded px-2 py-1 text-xs w-full focus:border-blue-500 outline-none"
                            />
                          </td>
                          <td className={`px-4 py-3 font-bold ${item.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>
                            {item.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(item.amount)}
                          </td>
                          <td className="px-4 py-3">
                             <select
                               value={item.category}
                               onChange={(e) => updateItem(item.tempId, 'category', e.target.value)}
                               className={`bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs w-32 focus:border-blue-500 outline-none text-white ${item.category === 'Outros' ? 'opacity-70' : ''}`}
                             >
                                {(item.type === TransactionType.INCOME ? incomeCategories : expenseCategories).map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                             </select>
                          </td>
                          <td className="px-4 py-3">
                             <select
                               value={item.unit}
                               onChange={(e) => updateItem(item.tempId, 'unit', e.target.value)}
                               className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs w-24 focus:border-blue-500 outline-none text-white"
                             >
                                {units.map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
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

        {/* Footer */}
        {step === 2 && (
          <div className="p-6 border-t border-gray-700 flex justify-between items-center bg-gray-800 rounded-b-xl">
             <div className="text-sm text-gray-400">
               <span className="text-white font-bold">{items.filter(i => i.selected).length}</span> itens selecionados
             </div>
             <div className="flex gap-3">
                <button 
                  onClick={() => { setStep(1); setItems([]); setBulkCategory(''); }}
                  className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleProcessImport}
                  disabled={items.filter(i => i.selected).length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={18} />
                  Confirmar Importação
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankImportModal;