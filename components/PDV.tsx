
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { generateId, getTodayString, formatCurrency, formatDate } from '../utils';
// Fixed: Added 'Calendar' to the imports from lucide-react
import { Save, ShoppingCart, User, Phone, MapPin, Tag, Package, CreditCard, DollarSign, Plus, Calculator, Trash2, Search, ArrowRight, TrendingUp, Calendar } from 'lucide-react';

interface PDVProps {
  onAddTransaction: (transactions: Transaction[]) => void;
  existingTransactions: Transaction[];
}

const PDV: React.FC<PDVProps> = ({ onAddTransaction, existingTransactions }) => {
  // Estado do formulário
  const [date, setDate] = useState(getTodayString());
  const [deliveryDate, setDeliveryDate] = useState(getTodayString());
  const [contact, setContact] = useState('');
  const [cepCode, setCepCode] = useState('');
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [additional, setAdditional] = useState('');
  const [frete, setFrete] = useState('');
  const [discount, setDiscount] = useState('');

  // Cálculos em tempo real
  const total = useMemo(() => {
    const v = parseFloat(baseValue.replace(',', '.')) || 0;
    const a = parseFloat(additional.replace(',', '.')) || 0;
    const f = parseFloat(frete.replace(',', '.')) || 0;
    const d = parseFloat(discount.replace(',', '.')) || 0;
    return v + a + f - d;
  }, [baseValue, additional, frete, discount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || total <= 0) return;

    const newTransaction: Transaction = {
      id: generateId(),
      description: `PDV: ${productName}${productCode ? ` (${productCode})` : ''}`,
      amount: total,
      type: TransactionType.INCOME,
      category: 'Receita',
      date: date,
      status: PaymentStatus.PAID,
      reviewed: true,
      pdvData: {
        deliveryDate,
        contact,
        cepCode,
        productCode,
        productName,
        paymentMethod,
        baseValue: parseFloat(baseValue.replace(',', '.')),
        additional: parseFloat(additional.replace(',', '.')),
        frete: parseFloat(frete.replace(',', '.')),
        discount: parseFloat(discount.replace(',', '.')),
      }
    };

    onAddTransaction([newTransaction]);
    
    // Reset parcial
    setContact('');
    setCepCode('');
    setProductCode('');
    setProductName('');
    setBaseValue('');
    setAdditional('');
    setFrete('');
    setDiscount('');
  };

  const pdvTransactions = useMemo(() => {
    return existingTransactions
      .filter(t => t.pdvData)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  }, [existingTransactions]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* HEADER */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-500/20">
            <ShoppingCart size={32} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">PDV - Lançamento de Vendas</h2>
            <p className="text-gray-400 text-sm">Registro detalhado seguindo padrão da planilha</p>
          </div>
        </div>
        <div className="hidden md:flex bg-gray-900 border border-gray-700 p-3 rounded-lg items-center gap-4">
          <div className="text-right">
             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Total Hoje</p>
             <p className="text-xl font-bold text-green-400">{formatCurrency(pdvTransactions.filter(t => t.date === getTodayString()).reduce((s,t) => s + t.amount, 0))}</p>
          </div>
          <TrendingUp className="text-green-500" size={24} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORMULÁRIO */}
        <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          <div className="bg-blue-700/20 p-4 border-b border-gray-700">
            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
              <Plus size={16} /> Nova Venda
            </h3>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Calendar size={12}/> Dia</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Calendar size={12}/> Entrega</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><User size={12}/> Telefone | Email</label>
                <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Ex: 11987654321" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><MapPin size={12}/> CEP / ZONA</label>
                <input type="text" value={cepCode} onChange={e => setCepCode(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Ex: a16" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Tag size={12}/> COD</label>
                <input type="text" value={productCode} onChange={e => setProductCode(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Ex: p01" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Package size={12}/> Nome do Produto</label>
                <input type="text" required value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Ex: Buquê Conquista" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 pt-6 border-t border-gray-700/50">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Valor + Custo</label>
                <input type="text" value={baseValue} onChange={e => setBaseValue(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Adicional</label>
                <input type="text" value={additional} onChange={e => setAdditional(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Frete</label>
                <input type="text" value={frete} onChange={e => setFrete(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Desconto</label>
                <input type="text" value={discount} onChange={e => setDiscount(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500" placeholder="0,00" />
              </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-950/50 p-6 rounded-xl border border-gray-700 border-dashed">
              <div className="flex items-center gap-6 mb-4 md:mb-0 w-full md:w-auto">
                 <div className="w-full md:w-48">
                   <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><CreditCard size={12}/> F. Pagamento</label>
                   <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:border-blue-500">
                      <option value="">Selecione...</option>
                      <option value="PIX">PIX</option>
                      <option value="CARTÃO">CARTÃO</option>
                      <option value="DINHEIRO">DINHEIRO</option>
                   </select>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total da Venda</span>
                    <span className="text-3xl font-black text-white">{formatCurrency(total)}</span>
                 </div>
              </div>

              <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-xl shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all">
                <Save size={20} /> Salvar Venda
              </button>
            </div>
          </form>
        </div>

        {/* ÚLTIMOS LANÇAMENTOS (Mini Planilha) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden flex flex-col h-full max-h-[700px]">
            <div className="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
               <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest">Histórico Recente</h3>
               <ArrowRight size={16} className="text-gray-600" />
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-950 text-gray-500 uppercase sticky top-0">
                  <tr>
                    <th className="p-3">Data/Dia</th>
                    <th className="p-3">Produto</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {pdvTransactions.map(t => (
                    <tr key={t.id} className="hover:bg-gray-700/30 transition-colors group">
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-gray-300">{formatDate(t.date).split('/')[0]}</div>
                        <div className="text-[10px] text-gray-500">{t.pdvData?.paymentMethod || 'N/A'}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-white truncate max-w-[120px]">{t.pdvData?.productName}</div>
                        <div className="text-[10px] text-gray-500">{t.pdvData?.contact || '-'}</div>
                      </td>
                      <td className="p-3 text-right">
                         <div className="font-bold text-green-400">{formatCurrency(t.amount)}</div>
                      </td>
                    </tr>
                  ))}
                  {pdvTransactions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-gray-500 italic text-sm">Nenhuma venda via PDV encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-gray-900 border-t border-gray-700 text-center">
               <p className="text-[10px] text-gray-600 font-bold uppercase">Visualizando últimos {pdvTransactions.length} registros</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDV;
