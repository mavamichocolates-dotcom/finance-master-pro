
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { generateId, getTodayString, formatCurrency, formatDate } from '../utils';
import { aiService, GroundingSource } from '../services/ai';
import { 
  Save, ShoppingCart, User, MapPin, Tag, Package, CreditCard, 
  Plus, Trash2, Search, TrendingUp, 
  Calendar, Settings2, X, BarChart3, ReceiptText, Printer, CheckCircle2,
  TrendingDown, Percent, MapPinned, Route, Map as MapIcon, Loader2, ExternalLink
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

const INITIAL_REGIONS = ['Zona Leste', 'Zona Oeste', 'Zona Norte', 'Zona Sul', 'Centro', 'ABC Paulista', 'Guarulhos', 'Loja / Balcão'];

const PDV: React.FC<PDVProps> = ({ onAddTransaction, existingTransactions }) => {
  const [catalog, setCatalog] = useState<ProductInfo[]>(() => {
    const saved = localStorage.getItem('fm_pdv_catalog');
    return saved ? JSON.parse(saved) : [];
  });

  const [regions, setRegions] = useState<string[]>(() => {
    const saved = localStorage.getItem('fm_pdv_regions');
    return saved ? JSON.parse(saved) : INITIAL_REGIONS;
  });

  const [date, setDate] = useState(getTodayString());
  const [deliveryDate, setDeliveryDate] = useState(getTodayString());
  const [contact, setContact] = useState('');
  const [region, setRegion] = useState(''); 
  const [deliveryAddress, setDeliveryAddress] = useState('');
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
  
  // Estados de Rota
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeAnalysis, setRouteAnalysis] = useState('');
  const [routeSources, setRouteSources] = useState<GroundingSource[]>([]);

  const handleCodeChange = (code: string) => {
    setProductCode(code);
    const product = catalog.find(p => p.code.toLowerCase() === code.toLowerCase());
    if (product) {
      setProductName(product.name);
      setBaseValue(product.price.toString());
      setProductCost(product.cost.toString());
    }
  };

  const total = useMemo(() => {
    const v = parseFloat(baseValue.toString().replace(',', '.')) || 0;
    const a = parseFloat(additional.toString().replace(',', '.')) || 0;
    const f = parseFloat(frete.toString().replace(',', '.')) || 0;
    const d = parseFloat(discount.toString().replace(',', '.')) || 0;
    return v + a + f - d;
  }, [baseValue, additional, frete, discount]);

  // Filtro inteligente para transações do PDV (usa metadados ou prefixo de descrição)
  const pdvTransactions = useMemo(() => {
    return existingTransactions.filter(t => t.pdvData || t.description.startsWith('PDV:'));
  }, [existingTransactions]);

  const dailyReport = useMemo(() => {
    const dayTxs = pdvTransactions.filter(t => t.date === date);
    const gross = dayTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cost = dayTxs.reduce((s, t) => s + (t.pdvData?.productCost || 0), 0);
    
    return { 
        gross, cost, net: gross - cost, 
        count: dayTxs.length,
        deliveries: dayTxs.filter(t => {
            const data = t.pdvData;
            return data && (data.deliveryAddress || (data.region && data.region !== 'Loja / Balcão'));
        })
    };
  }, [pdvTransactions, date]);

  const recentOrders = useMemo(() => {
    return [...pdvTransactions]
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        // Se a data for igual, ordena pelo tempo de criação ou ID
        return (b.createdAt || b.id).localeCompare(a.createdAt || a.id);
      })
      .slice(0, 30);
  }, [pdvTransactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || total <= 0) return;

    const newTransaction: Transaction = {
      id: generateId(),
      description: `PDV: ${productName}${productCode ? ` [${productCode}]` : ''}`,
      amount: total,
      type: TransactionType.INCOME,
      category: 'Receita',
      date: date,
      status: PaymentStatus.PAID,
      reviewed: true,
      createdAt: new Date().toISOString(),
      pdvData: {
        deliveryDate, contact, region, deliveryAddress,
        productCode, productName, paymentMethod,
        baseValue: parseFloat(baseValue.toString().replace(',', '.')),
        productCost: parseFloat(productCost.toString().replace(',', '.')) || 0,
        additional: parseFloat(additional.toString().replace(',', '.')),
        frete: parseFloat(frete.toString().replace(',', '.')),
        discount: parseFloat(discount.toString().replace(',', '.')),
      }
    };

    onAddTransaction([newTransaction]);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
    
    // Limpar campos exceto as datas de hoje para agilizar próximos lançamentos
    setContact(''); 
    setRegion(''); 
    setDeliveryAddress(''); 
    setProductCode(''); 
    setProductName('');
    setBaseValue(''); 
    setProductCost(''); 
    setAdditional(''); 
    setFrete(''); 
    setDiscount('');
  };

  const handleOptimizeRoutes = async () => {
    if (dailyReport.deliveries.length === 0) {
      alert("Nenhuma entrega registrada para esta data.");
      return;
    }
    setRouteLoading(true);
    setIsRouteModalOpen(true);
    setRouteAnalysis("");
    setRouteSources([]);

    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const result = await aiService.optimizeDeliveryRoutes(dailyReport.deliveries, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setRouteAnalysis(result.text);
          setRouteSources(result.sources);
          setRouteLoading(false);
        },
        async () => {
          const result = await aiService.optimizeDeliveryRoutes(dailyReport.deliveries);
          setRouteAnalysis(result.text);
          setRouteSources(result.sources);
          setRouteLoading(false);
        }
      );
    } catch (e) {
      setRouteAnalysis("Erro ao analisar rotas. Tente novamente.");
      setRouteLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* DASHBOARD RÁPIDO */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl shadow-xl text-white relative overflow-hidden group">
           <ShoppingCart size={100} className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform" />
           <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Movimento do Dia</p>
           <h2 className="text-4xl font-black mb-4">{dailyReport.count} Vendas</h2>
           <button 
             onClick={handleOptimizeRoutes}
             className="flex items-center gap-2 bg-white/20 hover:bg-white/40 px-4 py-2.5 rounded-xl border border-white/20 backdrop-blur-md transition-all text-xs font-bold shadow-lg"
           >
             <Route size={16} /> Otimizar Logística
           </button>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ReportCard label="Receita Bruta" value={dailyReport.gross} icon={<TrendingUp size={18} className="text-emerald-400" />} />
          <ReportCard label="Custo (CMV)" value={dailyReport.cost} icon={<TrendingDown size={18} className="text-rose-400" />} isNegative />
          <ReportCard label="Lucro Líquido" value={dailyReport.net} icon={<BarChart3 size={18} className="text-blue-400" />} highlight />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gray-900/80 p-5 border-b border-gray-700 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30"><Plus className="text-blue-500" size={20} /></div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tighter">Novo Lançamento</h3>
                <p className="text-[10px] text-gray-500 font-bold">Registro de venda PDV Mirella</p>
              </div>
            </div>
            <button onClick={() => setIsCatalogModalOpen(true)} className="text-[10px] font-black bg-gray-900 text-gray-300 px-5 py-2.5 rounded-2xl hover:bg-gray-700 border border-gray-700 transition-all flex items-center gap-2 shadow-sm uppercase">
              <Settings2 size={14} /> Catálogo & Bairros
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-10">
            {showSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/40 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 animate-fade-in-up">
                <CheckCircle2 size={20} />
                <span className="text-sm font-black uppercase">Venda registrada com sucesso!</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <InputGroup label="Data Venda" icon={<Calendar size={14} />}><input type="date" value={date} onChange={e => setDate(e.target.value)} className="custom-pdv-input" /></InputGroup>
              <InputGroup label="Data Entrega" icon={<Calendar size={14} />}><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="custom-pdv-input" /></InputGroup>
              <InputGroup label="Cliente / Contato" icon={<User size={14} />} className="md:col-span-2"><input type="text" value={contact} onChange={e => setContact(e.target.value)} className="custom-pdv-input" placeholder="Celular ou Nome" /></InputGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <InputGroup label="COD" icon={<Tag size={14} />} className="md:col-span-2">
                <input type="text" value={productCode} onChange={e => handleCodeChange(e.target.value)} className="custom-pdv-input uppercase" placeholder="A01" />
              </InputGroup>
              <InputGroup label="Produto" icon={<Package size={14} />} className="md:col-span-5">
                <input type="text" required value={productName} onChange={e => setProductName(e.target.value)} className="custom-pdv-input font-bold" placeholder="Nome do Buquê..." />
              </InputGroup>
              <InputGroup label="Endereço Completo (Entregas)" icon={<MapPinned size={14} />} className="md:col-span-5">
                <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="custom-pdv-input text-xs" placeholder="Rua, Número, Bairro, Cidade" />
              </InputGroup>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-gray-700/50">
              <PriceInput label="Valor Base" value={baseValue} onChange={setBaseValue} />
              <PriceInput label="Custo Unit." value={productCost} onChange={setProductCost} color="text-rose-400" />
              <div className="col-span-1 grid grid-cols-2 gap-3"><PriceInput label="Adicional" value={additional} onChange={setAdditional} compact /><PriceInput label="Frete" value={frete} onChange={setFrete} compact /></div>
              <PriceInput label="Desconto" value={discount} onChange={setDiscount} color="text-orange-400" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900/60 p-8 rounded-3xl border border-gray-700 border-dashed gap-8">
              <div className="flex items-center gap-10">
                 <div className="w-56">
                   <label className="block text-[10px] font-black text-gray-500 uppercase mb-3">Método Pagamento</label>
                   <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="custom-pdv-input h-14 font-bold text-base">
                      <option value="">Selecione...</option>
                      <option value="PIX">⚡ PIX</option>
                      <option value="CRÉDITO">💳 CRÉDITO</option>
                      <option value="DINHEIRO">💵 DINHEIRO</option>
                   </select>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Total da Venda</span>
                    <span className="text-5xl font-black text-white leading-none">{formatCurrency(total)}</span>
                 </div>
              </div>
              <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-5 px-16 rounded-3xl shadow-2xl flex items-center justify-center gap-4 transition-all text-2xl uppercase tracking-tighter"><Save size={28} /> Gravar Venda</button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-4 bg-gray-800 border border-gray-700 rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[800px]">
            <div className="bg-gray-950/80 p-5 border-b border-gray-700 flex justify-between items-center">
               <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-3"><ReceiptText size={18} className="text-blue-500" /> Vendas Recentes</h3>
               <button onClick={() => window.print()} className="bg-gray-900 p-2.5 rounded-xl text-gray-500 hover:text-white border border-gray-700"><Printer size={18} /></button>
            </div>
            <div className="flex-grow overflow-y-auto custom-scrollbar">
                {recentOrders.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 italic text-sm">Nenhum pedido registrado hoje.</div>
                ) : (
                  recentOrders.map(t => (
                    <div key={t.id} className="p-4 border-b border-gray-700/30 flex justify-between items-center group hover:bg-gray-700/20 transition-colors">
                        <div className="min-w-0">
                            <p className="font-black text-white text-sm truncate uppercase tracking-tight mb-1">{t.pdvData?.productName || t.description.replace('PDV: ', '')}</p>
                            <p className="text-[10px] text-gray-500 truncate"><MapPin size={8} className="inline mr-1" /> {t.pdvData?.deliveryAddress || t.pdvData?.region || 'Balcão'}</p>
                        </div>
                        <div className="text-right ml-4">
                            <div className="font-black text-white text-base leading-none mb-1">{formatCurrency(t.amount)}</div>
                            <div className="text-[9px] text-gray-500 uppercase">{formatDate(t.date)}</div>
                        </div>
                    </div>
                  ))
                )}
            </div>
        </div>
      </div>

      {/* MODAL DE ROTAS OTIMIZADAS COM GROUNDING */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[200] p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-[2.5rem] w-full max-w-4xl shadow-3xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-8 border-b border-gray-800">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/30"><Route className="text-indigo-500" size={24} /></div>
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase">Logística de Entregas</h3>
                            <p className="text-xs text-gray-500 font-bold">Rotas otimizadas para {formatDate(date)}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsRouteModalOpen(false)} className="bg-gray-800 p-3 rounded-2xl text-gray-500 hover:text-white transition-all"><X size={20} /></button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar flex-grow space-y-8">
                    {routeLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-6">
                            <Loader2 className="animate-spin text-indigo-500" size={48} />
                            <div className="text-center">
                                <p className="text-white font-black uppercase tracking-widest mb-1">Mapeando Pedidos...</p>
                                <p className="text-xs text-gray-500">Aguarde enquanto a IA organiza as rotas no Google Maps.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-7 prose prose-invert max-w-none">
                                <div className="bg-gray-800/40 p-6 rounded-3xl border border-gray-700 whitespace-pre-wrap leading-relaxed text-sm text-gray-300">
                                    {routeAnalysis}
                                </div>
                            </div>
                            <div className="lg:col-span-5 space-y-4">
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <MapIcon size={14} /> Links Oficiais Google Maps
                                </h4>
                                <div className="space-y-3">
                                    {routeSources.length > 0 ? routeSources.map((source, idx) => (
                                        <a 
                                            key={idx} 
                                            href={source.uri} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="block bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-2xl transition-all group"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-black text-white uppercase truncate pr-4">{source.title}</span>
                                                <ExternalLink size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                                            </div>
                                        </a>
                                    )) : (
                                        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 text-center">
                                            <p className="text-xs text-gray-500 italic">Nenhum link gerado automaticamente. Verifique a descrição ao lado.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-gray-900 border-t border-gray-800 flex justify-between items-center">
                    <p className="text-[9px] text-gray-600 font-black uppercase max-w-xs">Análise baseada em geolocalização em tempo real (Grounding 2.5).</p>
                    <button onClick={() => setIsRouteModalOpen(false)} className="bg-gray-100 text-gray-950 font-black py-4 px-12 rounded-2xl text-[11px] uppercase tracking-widest">Entendido</button>
                </div>
            </div>
        </div>
      )}

      {isCatalogModalOpen && <CatalogManager items={catalog} regions={regions} onClose={() => setIsCatalogModalOpen(false)} onSaveItems={setCatalog} onSaveRegions={setRegions} />}

      <style>{`
        .custom-pdv-input { width: 100%; background: #030712; border: 1px solid #374151; border-radius: 1rem; padding: 0.75rem 1rem; color: white; font-size: 0.875rem; outline: none; transition: all 0.2s; }
        .custom-pdv-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
      `}</style>
    </div>
  );
};

const ReportCard = ({ label, value, icon, highlight, isNegative }: any) => (
  <div className={`p-6 rounded-3xl border shadow-xl flex flex-col justify-center transition-all hover:scale-[1.02] ${highlight ? 'bg-indigo-600/10 border-indigo-500/30' : 'bg-gray-800 border-gray-700'}`}>
    <div className="flex justify-between items-start mb-3">
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
      <div className="bg-gray-950 p-2.5 rounded-xl border border-white/5">{icon}</div>
    </div>
    <span className={`text-3xl font-black ${highlight ? 'text-white' : isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>{isNegative && value > 0 ? '-' : ''}{formatCurrency(value)}</span>
  </div>
);

const InputGroup = ({ label, icon, children, className }: any) => (
  <div className={className}>
    <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 flex items-center gap-2 tracking-widest">{icon} {label}</label>
    {children}
  </div>
);

const PriceInput = ({ label, value, onChange, color = "text-white", compact }: any) => (
  <div className={`bg-gray-950/40 p-4 rounded-2xl border border-gray-700 flex flex-col transition-all focus-within:border-blue-500/50`}>
    <label className="block text-[9px] font-black text-gray-600 uppercase mb-2">{label}</label>
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-700 font-black">R$</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className={`bg-transparent w-full outline-none font-black ${compact ? 'text-sm' : 'text-xl'} ${color}`} placeholder="0,00" />
    </div>
  </div>
);

const CatalogManager: React.FC<any> = ({ items, regions, onClose, onSaveItems, onSaveRegions }) => {
    const [activeTab, setActiveTab] = useState<'PRODUCTS' | 'REGIONS'>('PRODUCTS');
    const [localItems, setLocalItems] = useState(items);
    const [localRegions, setLocalRegions] = useState(regions);
    const [searchTerm, setSearchTerm] = useState('');
    const [newItem, setNewItem] = useState<ProductInfo>({ code: '', name: '', price: 0, cost: 0 });
    const [newRegion, setNewRegion] = useState('');
  
    const filteredItems = localItems.filter((i: any) => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredRegions = localRegions.filter((r: string) => r.toLowerCase().includes(searchTerm.toLowerCase()));
  
    const addItem = () => {
      if (!newItem.code || !newItem.name) return;
      const updated = [...localItems, newItem];
      setLocalItems(updated);
      onSaveItems(updated);
      setNewItem({ code: '', name: '', price: 0, cost: 0 });
    };
  
    const addRegion = () => {
      const trimmed = newRegion.trim();
      if (!trimmed || localRegions.includes(trimmed)) return;
      const updated = [...localRegions, trimmed];
      setLocalRegions(updated);
      onSaveRegions(updated);
      setNewRegion('');
    };
  
    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[200] p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-[2.5rem] w-full max-w-3xl shadow-3xl flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center p-8 border-b border-gray-800">
             <div className="flex items-center gap-4">
                <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/30">{activeTab === 'PRODUCTS' ? <Tag className="text-indigo-500" size={24} /> : <MapPinned className="text-indigo-500" size={24} />}</div>
                <h3 className="text-2xl font-black text-white uppercase">{activeTab === 'PRODUCTS' ? 'Itens' : 'Bairros'}</h3>
             </div>
             <button onClick={onClose} className="text-gray-500 bg-gray-800 p-3 rounded-2xl"><X size={20} /></button>
          </div>
          <div className="flex bg-gray-950 p-1 mx-8 mt-4 rounded-2xl border border-gray-800">
              <button onClick={() => setActiveTab('PRODUCTS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${activeTab === 'PRODUCTS' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Produtos</button>
              <button onClick={() => setActiveTab('REGIONS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${activeTab === 'REGIONS' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Bairros</button>
          </div>
          <div className="p-8 overflow-y-auto custom-scrollbar flex-grow space-y-8">
            {activeTab === 'PRODUCTS' ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><input type="text" placeholder="COD" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} className="custom-pdv-input text-xs uppercase" /><input type="text" placeholder="NOME" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="custom-pdv-input text-xs" /><input type="number" placeholder="VENDA" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} className="custom-pdv-input text-xs" /><input type="number" placeholder="CUSTO" value={newItem.cost || ''} onChange={e => setNewItem({...newItem, cost: parseFloat(e.target.value)})} className="custom-pdv-input text-xs" /><button onClick={addItem} className="col-span-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-widest">Salvar</button></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredItems.map((item: any) => (<div key={item.code} className="bg-gray-850/30 border border-gray-800 rounded-2xl p-4 flex justify-between items-center"><span className="text-sm font-black text-white">{item.code} - {item.name}</span><button onClick={() => onSaveItems(localItems.filter((i:any) => i.code !== item.code))} className="text-rose-500"><Trash2 size={16} /></button></div>))}</div>
                </>
            ) : (
                <>
                  <div className="flex gap-4"><input type="text" placeholder="NOVO BAIRRO" value={newRegion} onChange={e => setNewRegion(e.target.value)} className="custom-pdv-input text-xs font-bold uppercase" /><button onClick={addRegion} className="bg-indigo-600 text-white font-black py-4 px-8 rounded-2xl text-[11px] uppercase">Add</button></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{filteredRegions.map((reg: string) => (<div key={reg} className="bg-gray-850/30 border border-gray-800 rounded-xl p-4 flex justify-between items-center"><span className="text-xs font-black text-white uppercase truncate">{reg}</span><button onClick={() => onSaveRegions(localRegions.filter((r:string) => r !== reg))} className="text-rose-500"><Trash2 size={16} /></button></div>))}</div>
                </>
            )}
          </div>
          <div className="p-8 bg-gray-950 border-t border-gray-800"><button onClick={onClose} className="w-full bg-gray-100 text-gray-950 font-black py-4 rounded-2xl text-[11px] uppercase">Concluir</button></div>
        </div>
      </div>
    );
};

export default PDV;
