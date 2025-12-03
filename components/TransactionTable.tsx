import React, { useState } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { Trash2, Edit, Search } from 'lucide-react';

interface TransactionTableProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onUpdate: (updated: Transaction) => void;
  units: string[];
}

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, onDelete, onUpdate, units }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Edit State
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.unit || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'ALL' || t.type === filterType;
    return matchesSearch && matchesType;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Newest first

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
    <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 flex flex-col h-[600px]">
      {/* Header & Controls */}
      <div className="p-4 border-b border-gray-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-900 rounded-t-lg">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ListIcon className="text-blue-500" />
          Gerenciamento de Lançamentos
        </h2>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-gray-800 text-white border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 w-full"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="ALL">Todos</option>
            <option value={TransactionType.INCOME}>Entradas</option>
            <option value={TransactionType.EXPENSE}>Saídas</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-auto flex-grow custom-scrollbar">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-gray-950 sticky top-0 z-10">
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
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((t) => (
                <tr key={t.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                  {editingId === t.id ? (
                    // EDIT MODE
                    <>
                      <td className="px-4 py-3">
                         <input 
                           type="date" 
                           value={editForm.date} 
                           onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                           className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-28"
                         />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                           type="text" 
                           value={editForm.description} 
                           onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                           className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-full"
                         />
                      </td>
                      <td className="px-4 py-3">
                         <input 
                           type="text" 
                           value={editForm.category} 
                           onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                           className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-28"
                         />
                      </td>
                      <td className="px-4 py-3">
                         <select
                           value={editForm.unit}
                           onChange={(e) => setEditForm({...editForm, unit: e.target.value})}
                           className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-28"
                         >
                            {units.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                         </select>
                      </td>
                      <td className="px-4 py-3">
                         <input 
                           type="number" 
                           value={editForm.amount} 
                           onChange={(e) => setEditForm({...editForm, amount: parseFloat(e.target.value)})}
                           className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-24"
                         />
                      </td>
                      <td className="px-4 py-3">
                         <select
                           value={editForm.status}
                           onChange={(e) => setEditForm({...editForm, status: e.target.value as PaymentStatus})}
                           className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white w-24"
                         >
                            <option value={PaymentStatus.PAID}>PAGO</option>
                            <option value={PaymentStatus.PENDING}>PENDENTE</option>
                         </select>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {t.installments ? `${t.installments.current}/${t.installments.total}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center flex gap-2 justify-center">
                        <button type="button" onClick={saveEdit} className="text-green-400 hover:text-green-300 font-bold text-xs uppercase border border-green-500 px-2 py-1 rounded">Salvar</button>
                        <button type="button" onClick={cancelEditing} className="text-gray-400 hover:text-gray-300 font-bold text-xs uppercase border border-gray-500 px-2 py-1 rounded">Cancelar</button>
                      </td>
                    </>
                  ) : (
                    // VIEW MODE
                    <>
                      <td className="px-4 py-3 font-medium whitespace-nowrap text-white">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-4 py-3">
                        {t.description}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-700 text-gray-300 py-1 px-2 rounded text-xs">
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
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          t.status === PaymentStatus.PAID 
                            ? 'bg-green-900 text-green-300 border border-green-700' 
                            : 'bg-red-900 text-red-300 border border-red-700'
                        }`}>
                          {t.status === PaymentStatus.PAID ? 'PAGO' : 'PENDENTE'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {t.installments ? `${t.installments.current}/${t.installments.total}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            type="button"
                            onClick={() => startEditing(t)}
                            className="p-1.5 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50 transition-colors"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => onDelete(t.id)}
                            className="p-1.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
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