
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { generateId, getTodayString, formatCurrency, formatDate } from '../utils';
import { 
  Save, ShoppingCart, User, MapPin, Tag, Package, CreditCard, 
  Plus, Trash2, Search, TrendingUp, 
  Calendar, Settings2, X, BarChart3, ReceiptText, Printer, CheckCircle2,
  TrendingDown, Percent, MapPinned
} from 'lucide-react';

interface PDVProps {
  onAddTransaction: (transactions: Transaction[]) => void;
  existingTransactions: Transaction[];
}

interface ProductInfo {
  code: string;
  name: string;
  price: number;
  cost: number;
}

const INITIAL_REGIONS = [
  'Zona Leste',
  'Zona Oeste',
  'Zona Norte',
  'Zona Sul',
  'Centro',
  'ABC Paulista',
  'Guarulhos',
  'Osasco',
  'Barueri',
  'Interior',
  'Loja / Balcão'
];

const PDV: React.FC<PDVProps> = ({ onAddTransaction, existingTransactions }) => {
  // Catálogo persistente em localStorage
  const [catalog, setCatalog] = useState<ProductInfo[]>(() => {
    const saved = localStorage.getItem('fm_pdv_catalog');
    if (saved) return JSON.parse(saved);
    return [];
  });

  // Regiões/Bairros persistentes em localStorage
  const [regions, setRegions] = useState<string[]>(() => {
    const saved = localStorage.getItem('fm_pdv_regions');
    if (saved) return JSON.parse(saved);
    return INITIAL_REGIONS;
  });

  useEffect(() => {
    localStorage.setItem('fm_pdv_catalog', JSON.stringify(catalog));
  }, [catalog]);

  useEffect(() => {
    localStorage.setItem('fm_pdv_regions', JSON.stringify(regions));
  }, [regions]);

  // Estados do Form
  const [date, setDate] = useState(getTodayString());
  const [deliveryDate, setDeliveryDate] = useState(getTodayString());
  const [contact, setContact] = useState('');
  const [region, setRegion] = useState(''); 
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [productCost, setProductCost] = useState('');
  const [additional, setAdditional] = useState('');
  const [frete, setFrete] = useState('');
  const [discount, setDiscount] = useState('');
  
  const [showSuccess, setShowSuccess] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  // Busca Inteligente no Catálogo
  const handleCodeChange = (code: string) => {
    setProductCode(code);
    const product = catalog.find(p => p.code.toLowerCase() === code.toLowerCase());
    if (product) {
      setProductName(product.name);
      setBaseValue(product.price.toString());
      setProductCost(product.cost.toString());
    }
  };

  // Cálculo Dinâmico de Total
  const total = useMemo(() => {
    const v = parseFloat(baseValue.replace(',', '.')) || 0;
    const a = parseFloat(additional.replace(',', '.')) || 0;
    const f = parseFloat(frete.replace(',', '.')) || 0;
    const d = parseFloat(discount.replace(',', '.')) || 0;
    return v + a + f - d;
  }, [baseValue, additional, frete, discount]);

  // Relatório DRE Diário
  const dailyReport = useMemo(() => {
    const dayTxs = existingTransactions.filter(t => t.date === date && t.pdvData);
    const gross = dayTxs.reduce((s, t) => s + t.amount, 0);
    const cost = dayTxs.reduce((s, t) => s + (t.pdvData?.productCost || 0), 0);
    const discounts = dayTxs.reduce((s, t) => s + (t.pdvData?.discount || 0), 0);
    const fretes = dayTxs.reduce((s, t) => s + (t.pdvData?.frete || 0), 0);
    const count = dayTxs.length;
    return { gross, cost, net: gross - cost, count, discounts, fretes };
  }, [existingTransactions, date]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || total <= 0) {
      alert("⚠️ Digite o produto e um valor válido.");
      return;
    }

    const newTransaction: Transaction = {
      id: generateId(),
      description: `PDV: ${productName}${productCode ? ` [${productCode}]` : ''}`,
      amount: total,
      type: TransactionType.INCOME,
      category: 'Receita',
      date: date,
      status: PaymentStatus.PAID,
      reviewed: true,
      pdvData: {
        deliveryDate,
        contact,
        region: region.trim() || 'Loja / Balcão',
        productCode,
        productName,
        paymentMethod,
        baseValue: parseFloat(baseValue.replace(',', '.')),
        productCost: parseFloat(productCost.replace(',', '.')) || 0,
        additional: parseFloat(additional.replace(',', '.')),
        frete: parseFloat(frete.replace(',', '.')),
        discount: parseFloat(discount.replace(',', '.')),
      }
    };

    onAddTransaction([newTransaction]);
    
    // Se a região for nova, adiciona automaticamente (opcional, mas prático)
    const trimmedRegion = region.trim();
    if (trimmedRegion && !regions.includes(trimmedRegion)) {
        setRegions(prev => [...prev, trimmedRegion]);
    }

    // Feedback visual e Reset seletivo
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
    setContact('');
    setRegion(''); 
    setProductCode('');
    setProductName('');
    setBaseValue('');
    setProductCost('');
    setAdditional('');
    setFrete('');
    setDiscount('');
  };

  const pdvTransactions = useMemo(() => {
    return existingTransactions
      .filter(t => t.pdvData)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 30);
  }, [existingTransactions]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* DASHBOARD RÁPIDO */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group">
           <ShoppingCart size={100} className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform" />
           <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Movimento do Dia</p>
           <h2 className="text-4xl font-black mb-4">{dailyReport.count} Vendas</h2>
           <div className="flex items-center gap-2 bg-white/10 w-fit px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-md">
             <Calendar size={14} />
             <span className="text-xs font-bold">{formatDate(date)}</span>
           </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ReportCard 
            label="Receita Bruta" 
            value={dailyReport.gross} 
            icon={<TrendingUp size={18} className="text-emerald-400" />}
            subtext={`Inclui ${formatCurrency(dailyReport.fretes)} de frete`}
          />
          <ReportCard 
            label="CMV (Custo)" 
            value={dailyReport.cost} 
            icon={<TrendingDown size={18} className="text-rose-400" />}
            subtext={`Descontos: ${formatCurrency(dailyReport.discounts)}`}
            isNegative
          />
          <ReportCard 
            label="Lucro Líquido" 
            value={dailyReport.net} 
            icon={<BarChart3 size={18} className="text-blue-400" />}
            subtext={`${dailyReport.gross > 0 ? ((dailyReport.net / dailyReport.gross) * 100).toFixed(1) : 0}% Margem Líquida`}
            highlight
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORMULÁRIO OPERACIONAL */}
        <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gray-900/80 p-5 border-b border-gray-700 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30">
                <Plus className="text-blue-500" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter">Novo Lançamento</h3>
                <p className="text-[10px] text-gray-500 font-bold">Registro de venda PDV Mirella</p>
              </div>
            </div>
            <button 
              onClick={() => setIsCatalogModalOpen(true)}
              className="text-[10px] font-black bg-gray-900 text-gray-300 px-5 py-2.5 rounded-2xl hover:bg-gray-700 border border-gray-700 transition-all flex items-center gap-2 shadow-sm uppercase"
            >
              <Settings2 size={14} /> Catálogo & Bairros
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-10">
            {showSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 animate-fade-in-up">
                <div className="bg-emerald-500/20 p-1.5 rounded-lg"><CheckCircle2 size={20} /></div>
                <span className="text-sm font-black uppercase tracking-tight">Venda registrada com sucesso!</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <InputGroup label="Data Venda" icon={<Calendar size={14} />}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="custom-pdv-input" />
              </InputGroup>
              <InputGroup label="Data Entrega" icon={<Calendar size={14} />}>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="custom-pdv-input" />
              </InputGroup>
              <InputGroup label="Cliente / Contato" icon={<User size={14} />} className="md:col-span-2">
                <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="custom-pdv-input" placeholder="Celular ou Nome" />
              </InputGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <InputGroup label="COD" icon={<Tag size={14} />} className="md:col-span-2">
                <input 
                  type="text" 
                  value={productCode} 
                  onChange={e => handleCodeChange(e.target.value)} 
                  className="custom-pdv-input border-indigo-500/40 text-indigo-400 font-black uppercase" 
                  placeholder="Ex: A01" 
                />
              </InputGroup>
              <InputGroup label="Nome do Produto" icon={<Package size={14} />} className="md:col-span-6">
                <input type="text" required value={productName} onChange={e => setProductName(e.target.value)} className="custom-pdv-input font-bold" placeholder="Digite o nome do produto..." />
              </InputGroup>
              <InputGroup label="Bairro / Cidade / Região" icon={<MapPin size={14} />} className="md:col-span-4">
                <input 
                  list="regions-list-pdv"
                  type="text" 
                  value={region} 
                  onChange={e => setRegion(e.target.value)} 
                  className="custom-pdv-input font-bold"
                  placeholder="Ex: Zona Leste, Itaquera..."
                />
                <datalist id="regions-list-pdv">
                  {regions.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </datalist>
              </InputGroup>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-gray-700/50">
              <PriceInput label="Valor Base" value={baseValue} onChange={setBaseValue} color="text-white" />
              <PriceInput label="Custo Unit." value={productCost} onChange={setProductCost} color="text-rose-400" />
              <div className="col-span-1 grid grid-cols-2 gap-3">
                 <PriceInput label="Adicional" value={additional} onChange={setAdditional} compact />
                 <PriceInput label="Frete" value={frete} onChange={setFrete} compact />
              </div>
              <PriceInput label="Desconto" value={discount} onChange={setDiscount} color="text-orange-400" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900/60 p-8 rounded-3xl border border-gray-700 border-dashed gap-8">
              <div className="w-full md:w-auto flex items-center gap-10">
                 <div className="w-56">
                   <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Método Pagamento</label>
                   <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="custom-pdv-input h-14 font-bold text-base">
                      <option value="">Selecione...</option>
                      <option value="PIX">⚡ PIX</option>
                      <option value="CARTÃO CRÉDITO">💳 CRÉDITO</option>
                      <option value="CARTÃO DÉBITO">💳 DÉBITO</option>
                      <option value="DINHEIRO">💵 DINHEIRO</option>
                      <option value="LINK PAGAMENTO">🔗 LINK</option>
                   </select>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Total da Venda</span>
                    <span className="text-5xl font-black text-white leading-none">{formatCurrency(total)}</span>
                 </div>
              </div>

              <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-5 px-16 rounded-3xl shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-4 transform active:scale-95 transition-all text-2xl uppercase tracking-tighter">
                <Save size={28} /> Gravar Venda
              </button>
            </div>
          </form>
        </div>

        {/* HISTÓRICO LATERAL */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-3xl shadow-xl overflow-hidden flex flex-col flex-grow max-h-[800px]">
            <div className="bg-gray-950/80 p-5 border-b border-gray-700 flex justify-between items-center backdrop-blur-md">
               <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-3">
                 <ReceiptText size={18} className="text-blue-500" /> Vendas Recentes
               </h3>
               <button onClick={() => window.print()} className="bg-gray-900 p-2.5 rounded-xl text-gray-500 hover:text-white border border-gray-700 hover:border-blue-500 transition-all">
                 <Printer size={18} />
               </button>
            </div>
            
            <div className="flex-grow overflow-y-auto custom-scrollbar bg-gray-900/10">
              <div className="divide-y divide-gray-700/30">
                {pdvTransactions.map(t => {
                  const lucro = t.amount - (t.pdvData?.productCost || 0);
                  return (
                    <div key={t.id} className="p-5 hover:bg-gray-700/20 transition-all flex justify-between items-center group">
                      <div className="flex gap-4 min-w-0">
                        <div className="flex flex-col items-center justify-center bg-gray-800 rounded-2xl px-3 py-2 h-fit border border-gray-700 shadow-inner">
                          <span className="text-[11px] font-black text-white">{formatDate(t.date).split('/')[0]}</span>
                          <span className="text-[9px] font-bold text-gray-500 uppercase">{formatDate(t.date).split('/')[1]}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-white text-sm truncate uppercase tracking-tight mb-1">{t.pdvData?.productName || t.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                            <span className="bg-indigo-600/10 px-2 py-0.5 rounded text-indigo-400 border border-indigo-500/20">{t.pdvData?.productCode || '---'}</span>
                            <span className="flex items-center gap-1 max-w-[120px] truncate"><MapPin size={10} /> {t.pdvData?.region || '-'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                         <div className="font-black text-white text-base leading-none mb-1">{formatCurrency(t.amount)}</div>
                         <div className={`text-[10px] font-black uppercase flex items-center justify-end gap-1 ${lucro >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                           <Percent size={10} /> {formatCurrency(lucro)}
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isCatalogModalOpen && (
        <CatalogManager 
            items={catalog} 
            regions={regions} 
            onClose={() => setIsCatalogModalOpen(false)} 
            onSaveItems={setCatalog} 
            onSaveRegions={setRegions} 
        />
      )}

      <style>{`
        .custom-pdv-input {
          width: 100%;
          background-color: #030712;
          border: 1px solid #374151;
          border-radius: 1rem;
          padding: 0.75rem 1rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .custom-pdv-input:focus {
          border-color: #3b82f6;
          background-color: #030712;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }
      `}</style>
    </div>
  );
};

// Componentes Auxiliares
const ReportCard = ({ label, value, icon, subtext, highlight, isNegative }: any) => (
  <div className={`p-6 rounded-3xl border shadow-xl flex flex-col justify-center relative overflow-hidden transition-all hover:scale-[1.02] cursor-default ${highlight ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-gray-800 border-gray-700'}`}>
    <div className="flex justify-between items-start mb-3">
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
      <div className={`${highlight ? 'bg-indigo-600/30' : 'bg-gray-950'} p-2.5 rounded-xl border border-white/5`}>{icon}</div>
    </div>
    <span className={`text-3xl font-black ${highlight ? 'text-white' : isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>
      {isNegative && value > 0 ? '-' : ''}{formatCurrency(value)}
    </span>
    {subtext && <span className="text-[10px] font-black text-gray-500 uppercase mt-2 tracking-tighter opacity-80">{subtext}</span>}
  </div>
);

const InputGroup = ({ label, icon, children, className }: any) => (
  <div className={className}>
    <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 flex items-center gap-2 tracking-widest">
      {icon} {label}
    </label>
    {children}
  </div>
);

const PriceInput = ({ label, value, onChange, color = "text-white", compact }: any) => (
  <div className={`bg-gray-950/40 p-4 rounded-2xl border border-gray-700 flex flex-col transition-all focus-within:border-blue-500/50 hover:border-gray-600`}>
    <label className="block text-[9px] font-black text-gray-600 uppercase mb-2 tracking-widest">{label}</label>
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-700 font-black">R$</span>
      <input 
        type="text" 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        className={`bg-transparent w-full outline-none font-black ${compact ? 'text-sm' : 'text-xl'} ${color}`} 
        placeholder="0,00" 
      />
    </div>
  </div>
);

const CatalogManager: React.FC<any> = ({ items, regions, onClose, onSaveItems, onSaveRegions }) => {
  const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'REGIONS'>('PRODUCTS');
  const [localItems, setLocalItems] = useState(items);
  const [localRegions, setLocalRegions] = useState(regions);
  const [searchTerm, setSearchTerm] = useState('');
  
  // States para novo produto
  const [newItem, setNewItem] = useState<ProductInfo>({ code: '', name: '', price: 0, cost: 0 });
  
  // State para novo bairro
  const [newRegion, setNewRegion] = useState('');

  const filteredItems = localItems.filter((i: any) => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRegions = localRegions.filter((r: string) => 
    r.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addItem = () => {
    if (!newItem.code || !newItem.name) return;
    const updated = [...localItems, newItem];
    setLocalItems(updated);
    onSaveItems(updated);
    setNewItem({ code: '', name: '', price: 0, cost: 0 });
  };

  const removeItem = (code: string) => {
    const updated = localItems.filter((i: any) => i.code !== code);
    setLocalItems(updated);
    onSaveItems(updated);
  };

  const addRegion = () => {
    const trimmed = newRegion.trim();
    if (!trimmed || localRegions.includes(trimmed)) return;
    const updated = [...localRegions, trimmed];
    setLocalRegions(updated);
    onSaveRegions(updated);
    setNewRegion('');
  };

  const removeRegion = (reg: string) => {
    const updated = localRegions.filter((r: string) => r !== reg);
    setLocalRegions(updated);
    onSaveRegions(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[200] p-4 sm:p-8">
      <div className="bg-gray-900 border border-gray-700 rounded-[2.5rem] w-full max-w-3xl shadow-3xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-8 border-b border-gray-800 bg-gray-900/50">
           <div className="flex items-center gap-4">
              <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/30">
                {activeTab === 'PRODUCTS' ? <Tag className="text-indigo-500" size={24} /> : <MapPinned className="text-indigo-500" size={24} />}
              </div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase">{activeTab === 'PRODUCTS' ? 'Gestão de Itens' : 'Gestão de Bairros'}</h3>
                <p className="text-xs text-gray-500 font-bold">Configure opções automáticas do PDV</p>
              </div>
           </div>
           <button onClick={onClose} className="text-gray-500 hover:text-white transition-all bg-gray-800 p-3 rounded-2xl border border-gray-700">
             <X size={20} />
           </button>
        </div>

        {/* NAVEGAÇÃO INTERNA */}
        <div className="flex bg-gray-950 p-1 mx-8 mt-4 rounded-2xl border border-gray-800">
            <button 
                onClick={() => setActiveTab('PRODUCTS')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PRODUCTS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
            >
                Produtos
            </button>
            <button 
                onClick={() => setActiveTab('REGIONS')}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'REGIONS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
            >
                Bairros / Regiões
            </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-grow space-y-10">
          
          {/* SEÇÃO PRODUTOS */}
          {activeTab === 'PRODUCTS' && (
              <>
                <div className="bg-indigo-600/5 p-8 rounded-[2rem] border border-indigo-500/20">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-6 tracking-[0.2em] flex items-center gap-2">
                    <Plus size={14} /> Novo Produto no Catálogo
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <input type="text" placeholder="CÓDIGO" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} className="custom-pdv-input text-xs uppercase font-black" />
                    <input type="text" placeholder="NOME BUQUÊ" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="custom-pdv-input text-xs font-bold" />
                    <input type="number" placeholder="VENDA" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} className="custom-pdv-input text-xs" />
                    <input type="number" placeholder="CUSTO" value={newItem.cost || ''} onChange={e => setNewItem({...newItem, cost: parseFloat(e.target.value)})} className="custom-pdv-input text-xs" />
                    <button onClick={addItem} className="col-span-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-[0.1em] hover:bg-indigo-500 transition-all">Salvar no Catálogo</button>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="flex justify-between items-center px-2">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Cadastrados ({localItems.length})</h4>
                    <input type="text" placeholder="BUSCAR..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-2xl px-6 py-2 text-[10px] font-bold outline-none" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredItems.map((item: any) => (
                        <div key={item.code} className="bg-gray-850/30 border border-gray-800 rounded-[1.5rem] p-5 flex justify-between items-center hover:bg-gray-800/50 transition-all">
                        <div>
                            <span className="text-[11px] font-black text-indigo-400 bg-indigo-900/30 px-3 py-1 rounded-lg mr-3">{item.code}</span>
                            <span className="text-sm font-black text-white uppercase">{item.name}</span>
                        </div>
                        <button onClick={() => removeItem(item.code)} className="text-gray-700 hover:text-rose-500"><Trash2 size={18} /></button>
                        </div>
                    ))}
                    </div>
                </div>
              </>
          )}

          {/* SEÇÃO REGIÕES */}
          {activeTab === 'REGIONS' && (
              <>
                <div className="bg-indigo-600/5 p-8 rounded-[2rem] border border-indigo-500/20">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-6 tracking-[0.2em] flex items-center gap-2">
                    <Plus size={14} /> Adicionar Novo Bairro / Região
                    </h4>
                    <div className="flex gap-4">
                        <input 
                            type="text" 
                            placeholder="NOME DO BAIRRO EX: ITAQUERA" 
                            value={newRegion} 
                            onChange={e => setNewRegion(e.target.value)} 
                            className="custom-pdv-input text-xs font-bold uppercase" 
                        />
                        <button onClick={addRegion} className="bg-indigo-600 text-white font-black py-4 px-8 rounded-2xl text-[11px] uppercase tracking-[0.1em] hover:bg-indigo-500 transition-all whitespace-nowrap">
                            Adicionar
                        </button>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="flex justify-between items-center px-2">
                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Bairros Salvos ({localRegions.length})</h4>
                    <input type="text" placeholder="BUSCAR..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-2xl px-6 py-2 text-[10px] font-bold outline-none" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredRegions.map((reg: string) => (
                        <div key={reg} className="bg-gray-850/30 border border-gray-800 rounded-[1.2rem] p-4 flex justify-between items-center hover:bg-gray-800/50 transition-all">
                            <span className="text-xs font-black text-white uppercase truncate">{reg}</span>
                            <button onClick={() => removeRegion(reg)} className="text-gray-700 hover:text-rose-500 ml-2"><Trash2 size={16} /></button>
                        </div>
                    ))}
                    </div>
                </div>
              </>
          )}

        </div>
        <div className="p-8 bg-gray-950/50 border-t border-gray-800 text-center">
           <button onClick={onClose} className="bg-gray-100 text-gray-950 font-black py-4 px-16 rounded-2xl text-[11px] uppercase tracking-[0.2em]">Concluir Edição</button>
        </div>
      </div>
    </div>
  );
};

export default PDV;
