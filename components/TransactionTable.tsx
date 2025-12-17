
import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Trash2, Edit, Search, Download, Calendar, FilterX, List as ListIcon, Sparkles, CheckCircle, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { aiService } from '../services/ai';

interface TransactionTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onUpdate: (updated: Transaction) => void;
  units: string[];
  incomeCategories: string[];
  expenseCategories: string[];
}

const TransactionTable: React.FC<TransactionTableProps> = ({ 
  transactions, 
  onDelete, 
  onDeleteMany, 
  onUpdate, 
  units,
  incomeCategories,
  expenseCategories
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || t.type === filterType;
    let matchesDate = true;
    if (startDate) matchesDate = matchesDate && t.date >= startDate;
    if (endDate) matchesDate = matchesDate && t.date <= endDate;
    
    // REGRA DE OURO: Apenas Saídas podem ser "Pendentes". 
    // Entradas são sempre consideradas revisadas.
    const isPending = t.type === TransactionType.EXPENSE && (!t.reviewed || t.category === 'Outros');
    const matchesPending = !showOnlyPending || isPending;

    return matchesSearch && matchesType && matchesDate && matchesPending;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleQuickCategoryChange = (t: Transaction, newCategory: string) => {
    aiService.learn(t.description, newCategory);
    
    // Para saídas, atualizar a categoria pode marcar como revisado se não for 'Outros'
    // Para entradas, continua sempre como revisado
    onUpdate({ 
      ...t, 
      category: newCategory, 
      reviewed: t.type === TransactionType.INCOME ? true : (newCategory !== 'Outros')
    });
  };

  const handleQuickStatusChange = (t: Transaction, newStatus: PaymentStatus) => {
    onUpdate({ ...t, status: newStatus });
  };

  const toggleReviewStatus = (t: Transaction) => {
     if (t.type === TransactionType.INCOME) return; // Não faz nada para entradas

     const nextReviewedState = !t.reviewed;
     if (nextReviewedState && t.category !== 'Outros') {
       aiService.learn(t.description, t.category);
     }
     
     onUpdate({ ...t, reviewed: nextReviewedState });
  };

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ["ID", "Data", "Tipo", "Categoria", "Descrição", "Valor", "Status", "Revisado"];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map(t => [
        t.id, t.date, t.type, `"${t.category}"`, `"${t.description}"`, t.amount.toFixed(2), t.status, t.reviewed ? 'SIM' : 'NÃO'
      ].join(","))
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financeiro_mirella_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 flex flex-col h-[750px]">
      <div className="p-4 border-b border-gray-700 flex flex-col gap-4 bg-gray-900 rounded-t-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ListIcon className="text-blue-500" size={24} />
              Gerenciamento de Lançamentos
            </h2>
            <button 
              onClick={() => setShowOnlyPending(!showOnlyPending)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border ${showOnlyPending ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-gray-800 border-gray-600 text-gray-500 hover:text-white'}`}
              title={showOnlyPending ? "Ver todos os lançamentos" : "Ver apenas Saídas pendentes de revisão"}
            >
              {showOnlyPending ? <Eye size={12} /> : <EyeOff size={12} />}
              {showOnlyPending ? 'Limpando Saídas Pendentes' : 'Filtrar Pendências'}
            </button>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button onClick={() => { onDeleteMany(Array.from(selectedIds)); setSelectedIds(new Set()); }} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-lg flex items-center gap-2">
                <Trash2 size={16} /> Excluir ({selectedIds.size})
              </button>
            )}
            <button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-lg flex items-center gap-2">
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input type="text" placeholder="Buscar por descrição ou categoria..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 bg-gray-900 text-white border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 w-full text-sm" />
          </div>
          <div className="md:col-span-4 flex gap-2 items-center">
             <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-lg py-2 px-2 text-xs focus:border-blue-500" />
             <span className="text-gray-500">-</span>
             <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-lg py-2 px-2 text-xs focus:border-blue-500" />
          </div>
          <div className="md:col-span-3">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="ALL">Todos os Tipos</option>
              <option value={TransactionType.INCOME}>Entradas (Vendas)</option>
              <option value={TransactionType.EXPENSE}>Saídas (Despesas)</option>
            </select>
          </div>
          <div className="md:col-span-1 flex justify-center">
             <button onClick={() => { setSearchTerm(''); setFilterType('ALL'); setStartDate(''); setEndDate(''); setShowOnlyPending(false); }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full"><FilterX size={18} /></button>
          </div>
        </div>
      </div>

      <div className="overflow-auto flex-grow custom-scrollbar">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-950 sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-4 py-3 text-center w-12">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-800" checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length} onChange={handleSelectAll} />
              </th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Status de Revisão</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((t) => (
              <tr key={t.id} className={`border-b border-gray-700 transition-all duration-200 group ${selectedIds.has(t.id) ? 'bg-blue-900/20' : 'hover:bg-gray-700/50'} ${(t.type === TransactionType.EXPENSE && (!t.reviewed || t.category === 'Outros')) ? 'bg-orange-950/5' : ''}`}>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-800" checked={selectedIds.has(t.id)} onChange={() => handleSelectOne(t.id)} />
                </td>
                <td className="px-4 py-3 font-medium whitespace-nowrap text-white">{formatDate(t.date)}</td>
                <td className="px-4 py-3 truncate max-w-[200px]">{t.description}</td>
                <td className="px-4 py-3">
                  <select
                    value={t.category}
                    onChange={(e) => handleQuickCategoryChange(t, e.target.value)}
                    className={`bg-gray-900/50 border border-gray-700 text-gray-300 py-1 px-2 rounded text-xs focus:border-blue-500 outline-none w-full max-w-[150px] cursor-pointer transition-colors ${t.type === TransactionType.INCOME || (t.reviewed && t.category !== 'Outros') ? 'border-green-900/50 text-green-300' : 'border-orange-900/50 text-orange-300'}`}
                  >
                    {(t.type === TransactionType.INCOME ? incomeCategories : expenseCategories).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>
                <td className={`px-4 py-3 font-bold ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(t.amount)}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={t.status}
                    onChange={(e) => handleQuickStatusChange(t, e.target.value as PaymentStatus)}
                    className={`px-2 py-1 rounded text-[10px] font-bold uppercase border bg-transparent cursor-pointer ${t.status === PaymentStatus.PAID ? 'text-green-400 border-green-900/50' : 'text-red-400 border-red-900/50'}`}
                  >
                    <option value={PaymentStatus.PAID} className="bg-gray-900">PAGO</option>
                    <option value={PaymentStatus.PENDING} className="bg-gray-900">PENDENTE</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  {t.type === TransactionType.INCOME ? (
                    <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase text-green-500/60" title="Entradas de vendas são revisadas automaticamente">
                      <CheckCircle2 size={14} /> Confirmado
                    </div>
                  ) : (
                    <button 
                      onClick={() => toggleReviewStatus(t)}
                      className={`flex items-center gap-2 mx-auto px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm border ${t.reviewed && t.category !== 'Outros' ? 'bg-green-600/20 text-green-400 border-green-600/50 hover:bg-green-600/30' : 'bg-orange-600/20 text-orange-400 border-orange-600/50 hover:bg-orange-600/30'}`}
                      title={t.reviewed ? "Clique para marcar como Pendente" : "Clique para marcar como Revisado e ensinar a IA"}
                    >
                      {t.reviewed && t.category !== 'Outros' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                      {t.reviewed && t.category !== 'Outros' ? 'Revisado' : 'Pendente'}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => onDelete(t.id)} className="p-1.5 text-red-400 hover:bg-red-600 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-gray-950/50 border-t border-gray-700 flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-bold">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-purple-400" />
          <span>{showOnlyPending ? "Mostrando apenas despesas que precisam de revisão." : "As entradas de vendas são validadas automaticamente pelo sistema."}</span>
        </div>
        <span>Total exibido: {filteredTransactions.length} registros</span>
      </div>
    </div>
  );
};

export default TransactionTable;
