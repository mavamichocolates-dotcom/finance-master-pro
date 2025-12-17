import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Trash2, Edit, Search, Download, Calendar, FilterX, List as ListIcon } from 'lucide-react';

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
  
  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, filterType, startDate, endDate]);

  // --- FILTER LOGIC ---
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'ALL' || t.type === filterType;

    let matchesDate = true;
    if (startDate) matchesDate = matchesDate && t.date >= startDate;
    if (endDate) matchesDate = matchesDate && t.date <= endDate;

    return matchesSearch && matchesType && matchesDate;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- SELECTION LOGIC ---
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredTransactions.map(t => t.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const isAllSelected = filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredTransactions.length;

  const handleBulkDelete = () => {
    if (selectedIds.size > 0) {
      onDeleteMany(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // --- QUICK UPDATE HANDLERS ---
  const handleQuickCategoryChange = (t: Transaction, newCategory: string) => {
    onUpdate({ ...t, category: newCategory });
  };

  const handleQuickStatusChange = (t: Transaction, newStatus: PaymentStatus) => {
    onUpdate({ ...t, status: newStatus });
  };

  // --- EXPORT LOGIC ---
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ["ID", "Data", "Tipo", "Categoria", "Descrição", "Valor", "Status", "Unidade"];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map(t => [
        t.id, t.date, t.type, `"${t.category}"`, `"${t.description}"`, t.amount.toFixed(2), t.status, `"${t.unit || ''}"`
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

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('ALL');
    setStartDate('');
    setEndDate('');
  };

  const startEditing = (t: Transaction) => {
    setEditingId(t.id);
    setEditForm({ ...t });
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 flex flex-col h-[750px]">
      {/* Header & Controls */}
      <div className="p-4 border-b border-gray-700 flex flex-col gap-4 bg-gray-900 rounded-t-lg">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ListIcon className="text-blue-500" size={24} />
            Gerenciamento de Lançamentos
          </h2>
          
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-lg">
                <Trash2 size={16} /> Excluir ({selectedIds.size})
              </button>
            )}
            <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-lg">
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </div>
        
        {/* Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Buscar descrição ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-900 text-white border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 w-full text-sm"
            />
          </div>
          
          <div className="md:col-span-4 flex gap-2 items-center">
             <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-lg py-2 px-2 text-xs focus:border-blue-500" />
             <span className="text-gray-500">-</span>
             <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-lg py-2 px-2 text-xs focus:border-blue-500" />
          </div>

          <div className="md:col-span-3">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="ALL">Todos os Tipos</option>
              <option value={TransactionType.INCOME}>Entradas</option>
              <option value={TransactionType.EXPENSE}>Saídas</option>
            </select>
          </div>

          <div className="md:col-span-1 flex justify-center">
             <button onClick={clearFilters} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full" title="Limpar Filtros"><FilterX size={18} /></button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-auto flex-grow custom-scrollbar">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-950 sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-4 py-3 text-center w-12">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-800" checked={isAllSelected} onChange={handleSelectAll} />
              </th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">Nenhum lançamento encontrado.</td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr key={t.id} className={`border-b border-gray-700 transition-colors group ${selectedIds.has(t.id) ? 'bg-blue-900/20' : 'hover:bg-gray-700/50'}`}>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-blue-600 bg-gray-800" checked={selectedIds.has(t.id)} onChange={() => handleSelectOne(t.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap text-white">{formatDate(t.date)}</td>
                  <td className="px-4 py-3 truncate max-w-[200px]" title={t.description}>{t.description}</td>
                  
                  {/* CATEGORY SELECTOR COLUMN */}
                  <td className="px-4 py-3">
                    <select
                      value={t.category}
                      onChange={(e) => handleQuickCategoryChange(t, e.target.value)}
                      className="bg-gray-900/50 border border-gray-700 text-gray-300 py-1 px-2 rounded text-xs focus:border-blue-500 outline-none w-full max-w-[150px] cursor-pointer hover:bg-gray-900 transition-colors"
                    >
                      {(t.type === TransactionType.INCOME ? incomeCategories : expenseCategories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>

                  <td className={`px-4 py-3 font-bold ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                  
                  {/* STATUS SELECTOR COLUMN */}
                  <td className="px-4 py-3">
                    <select
                      value={t.status}
                      onChange={(e) => handleQuickStatusChange(t, e.target.value as PaymentStatus)}
                      className={`px-2 py-1 rounded text-[10px] font-bold uppercase border bg-transparent cursor-pointer transition-colors ${
                        t.status === PaymentStatus.PAID 
                          ? 'text-green-400 border-green-900/50 hover:bg-green-900/10' 
                          : 'text-red-400 border-red-900/50 hover:bg-red-900/10'
                      }`}
                    >
                      <option value={PaymentStatus.PAID} className="bg-gray-900">PAGO</option>
                      <option value={PaymentStatus.PENDING} className="bg-gray-900">PENDENTE</option>
                    </select>
                  </td>

                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEditing(t)} className="p-1.5 text-blue-400 hover:bg-blue-600 hover:text-white rounded transition-all" title="Editar Completo"><Edit size={14} /></button>
                      <button onClick={() => onDelete(t.id)} className="p-1.5 text-red-400 hover:bg-red-600 hover:text-white rounded transition-all" title="Excluir"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-2 bg-gray-900 text-center text-xs text-gray-500 rounded-b-lg border-t border-gray-700">
         Mostrando {filteredTransactions.length} registros
      </div>
    </div>
  );
};

export default TransactionTable;