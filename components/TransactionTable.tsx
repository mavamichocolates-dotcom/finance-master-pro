import React, { useState } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Trash2, Edit, Search, Download, Calendar, FilterX } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (updated: Transaction) => void;
  units: string[];
}

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, onDelete, onUpdate, units }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');
  
  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  // --- FILTER LOGIC ---
  const filteredTransactions = transactions.filter((t) => {
    // 1. Text Search
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.unit || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // 2. Type Filter
    const matchesType = filterType === 'ALL' || t.type === filterType;

    // 3. Date Range Filter
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && t.date >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && t.date <= endDate;
    }

    return matchesSearch && matchesType && matchesDate;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- EXPORT LOGIC ---
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert("Não há dados para exportar com os filtros atuais.");
      return;
    }

    // Define Headers
    const headers = ["ID", "Data", "Tipo", "Categoria", "Descrição", "Valor", "Status", "Unidade", "Parcela"];
    
    // Map Data
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map(t => {
        return [
          t.id,
          t.date,
          t.type,
          `"${t.category}"`, // Quote strings to handle commas
          `"${t.description}"`,
          t.amount.toFixed(2),
          t.status,
          `"${t.unit || ''}"`,
          t.installments ? `${t.installments.current}/${t.installments.total}` : '1/1'
        ].join(",");
      })
    ].join("\n");

    // Create Download Link with BOM (\uFEFF) for Excel compatibility
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `lancamentos_financemaster_${new Date().toISOString().split('T')[0]}.csv`);
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

  // --- EDIT HANDLERS ---
  const startEditing = (t: Transaction) => {
    setEditingId(t.id);
    setEditForm({ ...t });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = () => {
    if (editForm.id && editForm.description && editForm.amount) {
      onUpdate(editForm as Transaction);
      setEditingId(null);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 flex flex-col h-[750px]">
      {/* Header & Controls */}
      <div className="p-4 border-b border-gray-700 flex flex-col gap-4 bg-gray-900 rounded-t-lg">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ListIcon className="text-blue-500" />
            Gerenciamento de Lançamentos
          </h2>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-lg"
            title="Baixar CSV para Excel"
          >
            <Download size={16} />
            Exportar CSV
          </button>
        </div>
        
        {/* Filters Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
          
          {/* Search */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Buscar descrição, categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-900 text-white border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 w-full text-sm"
            />
          </div>
          
          {/* Dates */}
          <div className="md:col-span-4 flex gap-2 items-center">
             <div className="relative w-full">
                <span className="absolute left-2 top-2 text-gray-500 pointer-events-none">
                  <Calendar size={14} />
                </span>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-lg py-2 pl-8 pr-2 text-xs focus:border-blue-500"
                  title="Data Inicial"
                />
             </div>
             <span className="text-gray-500">-</span>
             <div className="relative w-full">
                <span className="absolute left-2 top-2 text-gray-500 pointer-events-none">
                  <Calendar size={14} />
                </span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded-lg py-2 pl-8 pr-2 text-xs focus:border-blue-500"
                  title="Data Final"
                />
             </div>
          </div>

          {/* Type Selector */}
          <div className="md:col-span-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Todos os Tipos</option>
              <option value={TransactionType.INCOME}>Apenas Entradas</option>
              <option value={TransactionType.EXPENSE}>Apenas Saídas</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="md:col-span-1 flex justify-center">
             <button 
               onClick={clearFilters}
               className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
               title="Limpar Filtros"
             >
               <FilterX size={18} />
             </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-auto flex-grow custom-scrollbar">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-950 sticky top-0 z-10 shadow-md">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Parc.</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-500 flex flex-col items-center justify-center w-full absolute mt-10">
                  <Search size={48} className="mb-4 opacity-20" />
                  <p>Nenhum lançamento encontrado para os filtros selecionados.</p>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr key={t.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors group">
                  {editingId === t.id ? (
                    // EDIT MODE
                    <>
                      <td className="px-4 py-3 align-top">
                         <input 
                           type="date" 
                           value={editForm.date} 
                           onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                           className="bg-gray-900 border border-blue-500 rounded px-2 py-1 text-white w-28 text-xs"
                         />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input 
                           type="text" 
                           value={editForm.description} 
                           onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                           className="bg-gray-900 border border-blue-500 rounded px-2 py-1 text-white w-full text-xs"
                         />
                      </td>
                      <td className="px-4 py-3 align-top">
                         <input 
                           type="text" 
                           value={editForm.category} 
                           onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                           className="bg-gray-900 border border-blue-500 rounded px-2 py-1 text-white w-28 text-xs"
                         />
                      </td>
                      <td className="px-4 py-3 align-top">
                         <select
                           value={editForm.unit}
                           onChange={(e) => setEditForm({...editForm, unit: e.target.value})}
                           className="bg-gray-900 border border-blue-500 rounded px-2 py-1 text-white w-28 text-xs"
                         >
                            {units.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                         </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                         <input 
                           type="number" 
                           value={editForm.amount} 
                           onChange={(e) => setEditForm({...editForm, amount: parseFloat(e.target.value)})}
                           className="bg-gray-900 border border-blue-500 rounded px-2 py-1 text-white w-24 text-xs"
                         />
                      </td>
                      <td className="px-4 py-3 align-top">
                         <select
                           value={editForm.status}
                           onChange={(e) => setEditForm({...editForm, status: e.target.value as PaymentStatus})}
                           className="bg-gray-900 border border-blue-500 rounded px-2 py-1 text-white w-24 text-xs"
                         >
                            <option value={PaymentStatus.PAID}>PAGO</option>
                            <option value={PaymentStatus.PENDING}>PENDENTE</option>
                         </select>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-500 text-xs">
                        {t.installments ? `${t.installments.current}/${t.installments.total}` : '-'}
                      </td>
                      <td className="px-4 py-3 align-top text-center flex gap-2 justify-center">
                        <button type="button" onClick={saveEdit} className="text-green-400 hover:bg-green-900/30 p-1 rounded transition-colors" title="Salvar"><ListIcon className="w-4 h-4" /></button>
                        <button type="button" onClick={cancelEditing} className="text-red-400 hover:bg-red-900/30 p-1 rounded transition-colors" title="Cancelar"><ListIcon className="w-4 h-4 rotate-45" /></button>
                      </td>
                    </>
                  ) : (
                    // VIEW MODE
                    <>
                      <td className="px-4 py-3 font-medium whitespace-nowrap text-white">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.description}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-700/50 text-gray-300 py-0.5 px-2 rounded text-[10px] uppercase tracking-wide border border-gray-600">
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-400 text-xs italic">
                          {t.unit || '-'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-bold ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          t.status === PaymentStatus.PAID 
                            ? 'text-green-400 bg-green-900/20' 
                            : 'text-red-400 bg-red-900/20'
                        }`}>
                          {t.status === PaymentStatus.PAID ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {t.installments ? `${t.installments.current}/${t.installments.total}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            type="button"
                            onClick={() => startEditing(t)}
                            className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-600 rounded-md transition-all"
                            title="Editar"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => onDelete(t.id)}
                            className="p-1.5 text-red-400 hover:text-white hover:bg-red-600 rounded-md transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
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

const ListIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

export default TransactionTable;