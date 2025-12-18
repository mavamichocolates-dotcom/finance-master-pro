
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { generateId, getTodayString, formatCurrency, formatDate } from '../utils';
import { aiService, GroundingSource } from '../services/ai';
import { 
  Save, ShoppingCart, User, MapPin, Tag, Package, CreditCard, 
  Plus, Trash2, Search, TrendingUp, 
  Calendar, Settings2, X, BarChart3, ReceiptText, Printer, CheckCircle2,
  TrendingDown, Percent, MapPinned, Route, Map as MapIcon, Loader2, ExternalLink,
  ChevronRight, Info, Sparkles, Clock
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
  const [lastSavedDate, setLastSavedDate] = useState('');
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  
  // Estados de Logística IA
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

  const pdvTransactions = useMemo(() => {
    return existingTransactions.filter(t => 
      t.type === TransactionType.INCOME && (t.pdvData || t.description.startsWith('PDV:'))
    );
  }, [existingTransactions]);

  const dailyReport = useMemo(() => {
    // Vendas feitas NESTA DATA (Lançamentos)
    const daySales = pdvTransactions.filter(t => t.date.substring(0, 10) === date.substring(0, 10));
    
    const gross = daySales.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cost = daySales.reduce((s, t) => s + (Number(t.pdvData?.productCost) || 0), 0);
    
    // Entregas agendadas PARA ESTA DATA (Logística)
    const deliveriesScheduledForToday = pdvTransactions.filter(t => {
      const dDate = t.pdvData?.deliveryDate || t.date;
      return dDate.substring(0, 10) === date.substring(0, 10);
    });

    return { 
        gross, cost, net: gross - cost, 
        salesCount: daySales.length,
        deliveries: deliveriesScheduledForToday
    };
  }, [pdvTransactions, date]);

  const handleOptimizeRoutes = async () => {
    const externalDeliveries = dailyReport.deliveries.filter(t => t.pdvData?.deliveryAddress || (t.pdvData?.region && t.pdvData?.region !== 'Loja / Balcão'));
    
    if (externalDeliveries.length === 0) {
      alert("Nenhuma entrega externa (com endereço) agendada para este dia.");
      return;
    }
    
    setRouteLoading(true);
    setIsRouteModalOpen(true);
    setRouteAnalysis("");
    setRouteSources([]);

    try {
      const result = await aiService.optimizeDeliveryRoutes(externalDeliveries);
      setRouteAnalysis(result.text);
      setRouteSources(result.sources);
    } catch (e) {
      setRouteAnalysis("Erro ao analisar rotas. Verifique sua conexão.");
    } finally {
      setRouteLoading(false);
    }
  };

  const recentOrders = useMemo(() => {
    return [...pdvTransactions]
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
      .slice(0, 50);
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
    setLastSavedDate(deliveryDate);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    
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

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* HEADER DE INDICADORES LOGÍSTICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-gradient-to-br from-indigo-700 to-blue-900 p-6 rounded-[2rem] shadow-2xl text-white relative overflow-hidden group border border-indigo-400/30">
           <Route size={140} className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform rotate-12" />
           <div className="relative z-10">
             <div className="flex items-center gap-2 mb-2 opacity-70">
                <Calendar size={14} />
                <p className="text-[10px] font-black uppercase tracking-widest">Para: {formatDate(date)}</p>
             </div>
             <h2 className="text-4xl font-black mb-1">{dailyReport.deliveries.length}</h2>
             <p className="text-xs font-medium text-indigo-200 mb-6">Entregas/Encomendas Agendadas</p>
             <button 
               onClick={handleOptimizeRoutes}
               disabled={dailyReport.deliveries.length === 0}
               className="w-full flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md px-6 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest border border-white/20 disabled:opacity-20"
             >
               <MapPinned size={18} /> Ver Logística do Dia
             </button>
           </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ReportCard label="Vendas Hoje" value={dailyReport.gross} icon={<TrendingUp size={18} className="text-emerald-400" />} />
          <ReportCard label="Custo Previsto" value={dailyReport.cost} icon={<TrendingDown size={18} className="text-rose-400" />} isNegative />
          <ReportCard label="Líquido do Dia" value={dailyReport.net} icon={<BarChart3 size={18} className="text-blue-400" />} highlight />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORMULÁRIO PDV */}
        <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gray-900/80 p-6 border-b border-gray-700 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
                <ShoppingCart className="text-blue-500" size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tighter">Novo Pedido</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Preencha para agendar na agenda</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center bg-gray-950 border border-gray-700 rounded-2xl px-4 py-2">
                <span className="text-[10px] font-black text-gray-600 mr-2 uppercase">Data Venda</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-xs font-black text-white border-none outline-none" />
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-12">
            {showSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-[1.5rem] flex items-center gap-4 text-emerald-400 animate-fade-in-up">
                <div className="bg-emerald-500/20 p-2 rounded-full"><CheckCircle2 size={24} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-widest">Pedido Confirmado!</span>
                  <span className="text-[10px] opacity-70">Agendado com sucesso para o dia {formatDate(lastSavedDate)}. Confira na aba "Agenda".</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <InputGroup label="Data para Entrega" icon={<Clock size={14} />}>
                <input type="date" required value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="custom-pdv-input font-black text-blue-400 text-lg" />
              </InputGroup>
              <InputGroup label="Cliente / Contato" icon={<User size={14} />} className="md:col-span-3">
                <input type="text" value={contact} onChange={e => setContact(e.target.value)} className="custom-pdv-input" placeholder="Nome do cliente ou celular" />
              </InputGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <InputGroup label="Código" icon={<Tag size={14} />} className="md:col-span-2">
                <input type="text" value={productCode} onChange={e => handleCodeChange(e.target.value)} className="custom-pdv-input uppercase" placeholder="EX: B01" />
              </InputGroup>
              <InputGroup label="Descrição do Produto" icon={<Package size={14} />} className="md:col-span-10">
                <input type="text" required value={productName} onChange={e => setProductName(e.target.value)} className="custom-pdv-input font-bold" placeholder="Ex: Buquê de Morangos Médio" />
              </InputGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <InputGroup label="Endereço de Entrega (Opcional)" icon={<MapPin size={14} />} className="md:col-span-12">
                <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="custom-pdv-input text-xs" placeholder="Rua, Número, Bairro, Cidade (Para usar a Roteirização por IA)" />
              </InputGroup>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-gray-700/50">
              <PriceInput label="Valor Base" value={baseValue} onChange={setBaseValue} />
              <PriceInput label="Custo (CMV)" value={productCost} onChange={setProductCost} color="text-rose-400" />
              <div className="col-span-1 grid grid-cols-2 gap-3">
                <PriceInput label="Adicional" value={additional} onChange={setAdditional} compact />
                <PriceInput label="Frete" value={frete} onChange={setFrete} compact />
              </div>
              <PriceInput label="Desconto" value={discount} onChange={setDiscount} color="text-orange-400" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900/60 p-8 rounded-[2rem] border border-gray-700 border-dashed gap-8">
              <div className="flex items-center gap-10">
                 <div className="w-56">
                   <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Forma de Pagto</label>
                   <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="custom-pdv-input h-14 font-black text-base">
                      <option value="PIX">⚡ PIX</option>
                      <option value="CARTÃO">💳 CARTÃO</option>
                      <option value="DINHEIRO">💵 DINHEIRO</option>
                   </select>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2">Total Final</span>
                    <span className="text-5xl font-black text-white leading-none tracking-tighter">{formatCurrency(total)}</span>
                 </div>
              </div>
              <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-5 px-16 rounded-[1.5rem] shadow-2xl flex items-center justify-center gap-4 transition-all text-2xl uppercase tracking-tighter transform hover:scale-[1.02] active:scale-[0.98]">
                <Save size={28} /> Finalizar e Agendar
              </button>
            </div>
          </form>
        </div>

        {/* HISTÓRICO RECENTE */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col h-full max-h-[850px]">
              <div className="bg-gray-950/80 p-6 border-b border-gray-700 flex justify-between items-center">
                 <div>
                   <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest">Lançamentos Recentes</h3>
                   <p className="text-[9px] text-gray-600 uppercase font-bold mt-1">Conferência de Agenda</p>
                 </div>
                 <button onClick={() => window.print()} className="bg-gray-900 p-3 rounded-2xl text-gray-500 hover:text-white border border-gray-700 transition-colors"><Printer size={18} /></button>
              </div>
              <div className="flex-grow overflow-y-auto custom-scrollbar">
                  {recentOrders.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center gap-4 opacity-20">
                      <Info size={40} />
                      <p className="text-xs font-black uppercase tracking-widest">Nenhum pedido hoje</p>
                    </div>
                  ) : (
                    recentOrders.map(t => (
                      <div key={t.id} className="p-5 border-b border-gray-700/30 flex flex-col gap-3 group hover:bg-gray-900/40 transition-all">
                          <div className="flex justify-between items-start">
                              <div className="min-w-0 flex-grow">
                                  <p className="font-black text-white text-sm truncate uppercase tracking-tight group-hover:text-blue-400 transition-colors">{t.pdvData?.productName || t.description.replace('PDV: ', '')}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <User size={10} className="text-gray-600" />
                                    <span className="text-[10px] text-gray-500 truncate font-bold">{t.pdvData?.contact || 'Cliente Avulso'}</span>
                                  </div>
                              </div>
                              <div className="text-right ml-4">
                                  <div className="font-black text-white text-base leading-none mb-1">{formatCurrency(t.amount)}</div>
                                  <div className="text-[9px] text-gray-600 uppercase font-black tracking-widest">{formatDate(t.date)}</div>
                              </div>
                          </div>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                                <Clock size={10} className="text-blue-400" />
                                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Entrega: {formatDate(t.pdvData?.deliveryDate || t.date)}</span>
                             </div>
                             <span className="text-[9px] text-gray-700 font-bold uppercase">{t.pdvData?.paymentMethod}</span>
                          </div>
                      </div>
                    ))
                  )}
              </div>
          </div>
        </div>
      </div>

      {/* MODAL DE LOGÍSTICA IA */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[200] p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-[2.5rem] w-full max-w-5xl shadow-3xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center p-8 border-b border-gray-800 bg-gray-950/50 backdrop-blur-md">
                    <div className="flex items-center gap-5">
                        <div className="bg-indigo-600/20 p-4 rounded-2xl border border-indigo-500/30">
                          <Route className="text-indigo-400" size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">Roteirização Inteligente</h3>
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Otimização de rotas para {dailyReport.deliveries.length} pedidos</p>
                        </div>
                    </div>
                    <button onClick={() => setIsRouteModalOpen(false)} className="bg-gray-800 p-4 rounded-2xl text-gray-500 hover:text-white transition-all"><X size={20} /></button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar flex-grow">
                    {routeLoading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-8">
                            <Loader2 className="animate-spin text-indigo-500" size={64} />
                            <p className="text-white font-black text-xl uppercase tracking-tighter">Calculando Melhor Trajeto...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            <div className="lg:col-span-7">
                                <div className="bg-gray-800/40 p-8 rounded-[2rem] border border-gray-700/50 backdrop-blur-sm">
                                    <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap leading-relaxed text-gray-300">
                                        {routeAnalysis}
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-5 flex flex-col gap-6">
                                <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-3xl p-6">
                                    <h4 className="text-[11px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2 mb-6">
                                        <MapIcon size={18} /> Rotas no Google Maps
                                    </h4>
                                    <div className="space-y-4">
                                        {routeSources.map((source, idx) => (
                                            <a 
                                                key={idx} 
                                                href={source.uri} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="group flex items-center justify-between bg-gray-950 hover:bg-indigo-900/40 border border-gray-800 hover:border-indigo-500/50 p-5 rounded-2xl transition-all shadow-md"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-white uppercase truncate mb-1">{source.title}</span>
                                                    <span className="text-[10px] text-gray-600 font-bold">Abrir Navegação</span>
                                                </div>
                                                <ExternalLink size={20} className="text-indigo-400" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {isCatalogModalOpen && <CatalogManager items={catalog} regions={regions} onClose={() => setIsCatalogModalOpen(false)} onSaveItems={setCatalog} onSaveRegions={setRegions} />}

      <style>{`
        .custom-pdv-input { width: 100%; background: #030712; border: 1px solid #374151; border-radius: 1.25rem; padding: 0.875rem 1.25rem; color: white; font-size: 0.875rem; outline: none; transition: all 0.2s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3); }
        .custom-pdv-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1), inset 0 2px 4px rgba(0,0,0,0.3); }
      `}</style>
    </div>
  );
};

const ReportCard = ({ label, value, icon, highlight, isNegative }: any) => (
  <div className={`p-6 rounded-[2rem] border shadow-2xl flex flex-col justify-center transition-all hover:scale-[1.02] ${highlight ? 'bg-indigo-600/10 border-indigo-500/30 ring-1 ring-indigo-500/20' : 'bg-gray-800 border-gray-700'}`}>
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{label}</span>
      <div className="bg-gray-950 p-3 rounded-2xl border border-white/5 shadow-inner">{icon}</div>
    </div>
    <span className={`text-3xl font-black tracking-tighter ${highlight ? 'text-white' : isNegative ? 'text-rose-400' : 'text-emerald-400'}`}>{isNegative && value > 0 ? '-' : ''}{formatCurrency(value)}</span>
  </div>
);

const InputGroup = ({ label, icon, children, className }: any) => (
  <div className={className}>
    <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 flex items-center gap-3 tracking-widest">
      <span className="text-blue-500 opacity-50">{icon}</span> {label}
    </label>
    {children}
  </div>
);

const PriceInput = ({ label, value, onChange, color = "text-white", compact }: any) => (
  <div className={`bg-gray-950/50 p-5 rounded-[1.5rem] border border-gray-700/50 flex flex-col transition-all focus-within:border-blue-500/50 shadow-inner`}>
    <label className="block text-[9px] font-black text-gray-600 uppercase mb-3 tracking-widest">{label}</label>
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-gray-700 font-black">R$</span>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className={`bg-transparent w-full outline-none font-black tracking-tight ${compact ? 'text-sm' : 'text-2xl'} ${color}`} placeholder="0,00" />
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
        <div className="bg-gray-900 border border-gray-700 rounded-[2.5rem] w-full max-w-3xl shadow-3xl flex flex-col max-h-[90vh] overflow-hidden">
          <div className="flex justify-between items-center p-8 border-b border-gray-800 bg-gray-950/50">
             <div className="flex items-center gap-5">
                <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                  {activeTab === 'PRODUCTS' ? <Tag className="text-indigo-500" size={28} /> : <MapPinned className="text-indigo-500" size={28} />}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{activeTab === 'PRODUCTS' ? 'Catálogo de Produtos' : 'Bairros de Entrega'}</h3>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Configuração de Apoio Operacional</p>
                </div>
             </div>
             <button onClick={onClose} className="text-gray-500 bg-gray-800 p-4 rounded-2xl hover:text-white transition-all"><X size={20} /></button>
          </div>
          <div className="flex bg-gray-950 p-2 mx-8 mt-6 rounded-[1.25rem] border border-gray-800 shadow-inner">
              <button onClick={() => setActiveTab('PRODUCTS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PRODUCTS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Produtos</button>
              <button onClick={() => setActiveTab('REGIONS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'REGIONS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Bairros</button>
          </div>
          <div className="p-8 overflow-y-auto custom-scrollbar flex-grow space-y-8">
            {activeTab === 'PRODUCTS' ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-950/50 p-6 rounded-[1.5rem] border border-gray-800">
                    <input type="text" placeholder="CÓDIGO" value={newItem.code} onChange={e => setNewItem({...newItem, code: e.target.value})} className="custom-pdv-input text-xs uppercase" />
                    <input type="text" placeholder="NOME DO PRODUTO" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="custom-pdv-input text-xs" />
                    <input type="number" placeholder="PREÇO VENDA" value={newItem.price || ''} onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value)})} className="custom-pdv-input text-xs" />
                    <input type="number" placeholder="CUSTO UNIT." value={newItem.cost || ''} onChange={e => setNewItem({...newItem, cost: parseFloat(e.target.value)})} className="custom-pdv-input text-xs" />
                    <button onClick={addItem} className="col-span-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all">Adicionar ao Catálogo</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {localItems.map((item: any) => (
                      <div key={item.code} className="bg-gray-850/20 border border-gray-800 rounded-2xl p-5 flex justify-between items-center group hover:border-gray-700 transition-all">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-white uppercase tracking-tight">{item.code} - {item.name}</span>
                          <span className="text-[10px] text-emerald-500 font-bold mt-1">Venda: {formatCurrency(item.price)} <span className="text-gray-600 mx-1">|</span> Custo: {formatCurrency(item.cost)}</span>
                        </div>
                        <button onClick={() => {
                          const updated = localItems.filter((i:any) => i.code !== item.code);
                          setLocalItems(updated);
                          onSaveItems(updated);
                          localStorage.setItem('fm_pdv_catalog', JSON.stringify(updated));
                        }} className="p-2 text-gray-700 hover:text-rose-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
            ) : (
                <>
                  <div className="flex gap-4 bg-gray-950/50 p-6 rounded-[1.5rem] border border-gray-800">
                    <input type="text" placeholder="NOME DO NOVO BAIRRO OU REGIÃO" value={newRegion} onChange={e => setNewRegion(e.target.value)} className="custom-pdv-input text-xs font-black uppercase tracking-widest" />
                    <button onClick={addRegion} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-10 rounded-2xl text-[11px] uppercase tracking-widest shadow-xl transition-all">Adicionar</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {localRegions.map((reg: string) => (
                      <div key={reg} className="bg-gray-850/20 border border-gray-800 rounded-2xl p-5 flex justify-between items-center hover:border-gray-700 transition-all">
                        <span className="text-[10px] font-black text-gray-400 uppercase truncate tracking-widest">{reg}</span>
                        <button onClick={() => {
                          const updated = localRegions.filter((r:string) => r !== reg);
                          setLocalRegions(updated);
                          onSaveRegions(updated);
                          localStorage.setItem('fm_pdv_regions', JSON.stringify(updated));
                        }} className="text-gray-700 hover:text-rose-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
            )}
          </div>
          <div className="p-8 bg-gray-950 border-t border-gray-800">
            <button onClick={onClose} className="w-full bg-white text-gray-950 font-black py-5 rounded-3xl text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all hover:bg-gray-100">Salvar e Fechar</button>
          </div>
        </div>
      </div>
    );
};

export default PDV;
