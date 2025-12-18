
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, PaymentStatus } from '../types';
import { generateId, getTodayString, formatCurrency, formatDate } from '../utils';
import { aiService, GroundingSource } from '../services/ai';
import { 
  Save, ShoppingCart, User, MapPin, Tag, Package, CreditCard, 
  Plus, Trash2, Search, TrendingUp, 
  Calendar, Settings2, X, BarChart3, ReceiptText, Printer, CheckCircle2,
  TrendingDown, Percent, MapPinned, Route, Map as MapIcon, Loader2, ExternalLink,
  ChevronRight, Info
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

  const pdvTransactions = useMemo(() => {
    return existingTransactions.filter(t => 
      t.type === TransactionType.INCOME || 
      t.pdvData || 
      t.description.startsWith('PDV:')
    );
  }, [existingTransactions]);

  const dailyReport = useMemo(() => {
    const dayTxs = pdvTransactions.filter(t => t.date.substring(0, 10) === date.substring(0, 10));
    
    const gross = dayTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const cost = dayTxs.reduce((s, t) => s + (Number(t.pdvData?.productCost) || 0), 0);
    
    // As entregas são baseadas na deliveryDate (Data de Entrega)
    const deliveriesForSelectedDate = pdvTransactions.filter(t => {
      const dDate = t.pdvData?.deliveryDate || t.date;
      const isCorrectDate = dDate.substring(0, 10) === date.substring(0, 10);
      const hasAddress = t.pdvData?.deliveryAddress || (t.pdvData?.region && t.pdvData?.region !== 'Loja / Balcão');
      return isCorrectDate && hasAddress;
    });

    return { 
        gross, cost, net: gross - cost, 
        count: dayTxs.length,
        deliveries: deliveriesForSelectedDate
    };
  }, [pdvTransactions, date]);

  const recentOrders = useMemo(() => {
    return [...pdvTransactions]
      .sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        const timeA = a.createdAt || '';
        const timeB = b.createdAt || '';
        return timeB.localeCompare(timeA);
      })
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
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2500);
    
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
      alert("Nenhuma entrega agendada para esta data de calendário.");
      return;
    }
    setRouteLoading(true);
    setIsRouteModalOpen(true);
    setRouteAnalysis("");
    setRouteSources([]);

    try {
      if (navigator.geolocation) {
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
      } else {
        const result = await aiService.optimizeDeliveryRoutes(dailyReport.deliveries);
        setRouteAnalysis(result.text);
        setRouteSources(result.sources);
        setRouteLoading(false);
      }
    } catch (e) {
      setRouteAnalysis("Erro ao analisar rotas. Tente novamente.");
      setRouteLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* DASHBOARD RÁPIDO */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1 bg-gradient-to-br from-indigo-700 to-blue-800 p-6 rounded-[2rem] shadow-2xl text-white relative overflow-hidden group border border-white/10">
           <Route size={120} className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform rotate-12" />
           <div className="relative z-10">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Logística do Dia</p>
             <h2 className="text-4xl font-black mb-1">{dailyReport.deliveries.length} Entregas</h2>
             <p className="text-xs font-medium text-white/50 mb-6">Agendadas para {formatDate(date)}</p>
             <button 
               onClick={handleOptimizeRoutes}
               disabled={dailyReport.deliveries.length === 0}
               className="w-full flex items-center justify-center gap-3 bg-white text-indigo-900 hover:bg-indigo-50 px-6 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <MapPinned size={20} /> Otimizar com IA
             </button>
           </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ReportCard label="Receita Bruta" value={dailyReport.gross} icon={<TrendingUp size={18} className="text-emerald-400" />} />
          <ReportCard label="Custo (CMV)" value={dailyReport.cost} icon={<TrendingDown size={18} className="text-rose-400" />} isNegative />
          <ReportCard label="Lucro Líquido" value={dailyReport.net} icon={<BarChart3 size={18} className="text-blue-400" />} highlight />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-gray-900/80 p-6 border-b border-gray-700 flex justify-between items-center backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30"><ShoppingCart className="text-blue-500" size={24} /></div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tighter">Terminal PDV</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Controle de Vendas e Produção</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center bg-gray-950 border border-gray-700 rounded-2xl px-4 py-2">
                <Calendar size={14} className="text-blue-500 mr-2" />
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-xs font-black text-white border-none outline-none" />
              </div>
              <button onClick={() => setIsCatalogModalOpen(true)} className="p-3 bg-gray-900 text-gray-400 hover:text-white rounded-2xl border border-gray-700 transition-all shadow-sm">
                <Settings2 size={20} />
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-12">
            {showSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-[1.5rem] flex items-center gap-4 text-emerald-400 animate-fade-in-up">
                <div className="bg-emerald-500/20 p-2 rounded-full"><CheckCircle2 size={24} /></div>
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-widest">Pedido Confirmado!</span>
                  <span className="text-[10px] opacity-70">A venda foi registrada e já consta na agenda de entregas.</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <InputGroup label="Data Venda" icon={<Calendar size={14} />}><input type="date" value={date} onChange={e => setDate(e.target.value)} className="custom-pdv-input" /></InputGroup>
              <InputGroup label="Data Entrega" icon={<Calendar size={14} />}><input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="custom-pdv-input font-bold text-blue-400" /></InputGroup>
              <InputGroup label="Cliente / Contato" icon={<User size={14} />} className="md:col-span-2"><input type="text" value={contact} onChange={e => setContact(e.target.value)} className="custom-pdv-input" placeholder="Celular ou Nome" /></InputGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <InputGroup label="COD" icon={<Tag size={14} />} className="md:col-span-2">
                <input type="text" value={productCode} onChange={e => handleCodeChange(e.target.value)} className="custom-pdv-input uppercase" placeholder="A01" />
              </InputGroup>
              <InputGroup label="Produto" icon={<Package size={14} />} className="md:col-span-5">
                <input type="text" required value={productName} onChange={e => setProductName(e.target.value)} className="custom-pdv-input font-bold" placeholder="Nome do Buquê..." />
              </InputGroup>
              <InputGroup label="Endereço de Entrega" icon={<MapPinned size={14} />} className="md:col-span-5">
                <input type="text" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="custom-pdv-input text-xs" placeholder="Rua, Número, Bairro, Cidade" />
              </InputGroup>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-gray-700/50">
              <PriceInput label="Valor Base" value={baseValue} onChange={setBaseValue} />
              <PriceInput label="Custo Unit." value={productCost} onChange={setProductCost} color="text-rose-400" />
              <div className="col-span-1 grid grid-cols-2 gap-3">
                <PriceInput label="Adicional" value={additional} onChange={setAdditional} compact />
                <PriceInput label="Frete" value={frete} onChange={setFrete} compact />
              </div>
              <PriceInput label="Desconto" value={discount} onChange={setDiscount} color="text-orange-400" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center bg-gray-900/60 p-8 rounded-[2rem] border border-gray-700 border-dashed gap-8">
              <div className="flex items-center gap-10">
                 <div className="w-56">
                   <label className="block text-[10px] font-black text-gray-500 uppercase mb-3 tracking-widest">Método Pagamento</label>
                   <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="custom-pdv-input h-14 font-black text-base">
                      <option value="">Selecione...</option>
                      <option value="PIX">⚡ PIX</option>
                      <option value="CRÉDITO">💳 CARTÃO CRÉDITO</option>
                      <option value="DÉBITO">💳 CARTÃO DÉBITO</option>
                      <option value="DINHEIRO">💵 DINHEIRO</option>
                   </select>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-2">Total Final</span>
                    <span className="text-5xl font-black text-white leading-none tracking-tighter">{formatCurrency(total)}</span>
                 </div>
              </div>
              <button type="submit" className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-black py-5 px-16 rounded-[1.5rem] shadow-2xl flex items-center justify-center gap-4 transition-all text-2xl uppercase tracking-tighter transform hover:scale-[1.02] active:scale-[0.98]"><Save size={28} /> Finalizar Venda</button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col h-full max-h-[800px]">
              <div className="bg-gray-950/80 p-6 border-b border-gray-700 flex justify-between items-center">
                 <div>
                   <h3 className="text-xs font-black text-gray-300 uppercase tracking-widest flex items-center gap-3">Histórico Recente</h3>
                   <p className="text-[9px] text-gray-600 uppercase font-bold mt-1">Últimas 50 operações</p>
                 </div>
                 <button onClick={() => window.print()} className="bg-gray-900 p-3 rounded-2xl text-gray-500 hover:text-white border border-gray-700 transition-colors"><Printer size={18} /></button>
              </div>
              <div className="flex-grow overflow-y-auto custom-scrollbar">
                  {recentOrders.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center gap-4 opacity-30">
                      <Info size={40} />
                      <p className="text-xs font-black uppercase tracking-widest">Nenhuma venda</p>
                    </div>
                  ) : (
                    recentOrders.map(t => (
                      <div key={t.id} className="p-5 border-b border-gray-700/30 flex justify-between items-center group hover:bg-gray-900/40 transition-all">
                          <div className="min-w-0">
                              <p className="font-black text-white text-sm truncate uppercase tracking-tight mb-1 group-hover:text-blue-400 transition-colors">{t.pdvData?.productName || t.description.replace('PDV: ', '')}</p>
                              <div className="flex items-center gap-2">
                                <MapPin size={10} className="text-gray-600" />
                                <span className="text-[10px] text-gray-500 truncate font-bold">{t.pdvData?.deliveryAddress || t.pdvData?.region || 'Balcão'}</span>
                              </div>
                          </div>
                          <div className="text-right ml-4">
                              <div className="font-black text-white text-base leading-none mb-1">{formatCurrency(t.amount)}</div>
                              <div className="text-[9px] text-gray-600 uppercase font-black tracking-widest">{formatDate(t.date)}</div>
                          </div>
                      </div>
                    ))
                  )}
              </div>
          </div>
        </div>
      </div>

      {/* MODAL DE ROTAS OTIMIZADAS */}
      {isRouteModalOpen && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center z-[200] p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-[2.5rem] w-full max-w-5xl shadow-3xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center p-8 border-b border-gray-800 bg-gray-950/50 backdrop-blur-md">
                    <div className="flex items-center gap-5">
                        <div className="bg-indigo-600/20 p-4 rounded-2xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                          <Route className="text-indigo-500" size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">Assistente de Logística IA</h3>
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Otimização Inteligente Google Maps Grounding</p>
                        </div>
                    </div>
                    <button onClick={() => setIsRouteModalOpen(false)} className="bg-gray-800 p-4 rounded-2xl text-gray-500 hover:text-white transition-all shadow-md"><X size={20} /></button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar flex-grow space-y-10">
                    {routeLoading ? (
                        <div className="h-96 flex flex-col items-center justify-center gap-8">
                            <div className="relative">
                              <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>
                              <Loader2 className="animate-spin text-indigo-500 relative z-10" size={64} />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-black text-xl uppercase tracking-tighter mb-2">Calculando melhores rotas...</p>
                                <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">Estamos cruzando as posições dos {dailyReport.deliveries.length} pedidos com dados de trânsito em tempo real.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            <div className="lg:col-span-8">
                                <div className="bg-gray-800/40 p-8 rounded-[2rem] border border-gray-700/50 backdrop-blur-sm relative">
                                    <div className="absolute -top-3 left-8 bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Sugestão da IA</div>
                                    <div className="prose prose-invert max-w-none prose-sm whitespace-pre-wrap leading-relaxed text-gray-200">
                                        {routeAnalysis}
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-4 flex flex-col gap-6">
                                <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-6">
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                        <MapIcon size={16} /> Acessar no Maps
                                    </h4>
                                    <div className="space-y-3">
                                        {routeSources.length > 0 ? routeSources.map((source, idx) => (
                                            <a 
                                                key={idx} 
                                                href={source.uri} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="group flex flex-col bg-gray-900 hover:bg-indigo-900/30 border border-gray-700 hover:border-indigo-500/50 p-5 rounded-2xl transition-all shadow-md"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-black text-white uppercase truncate pr-4">{source.title}</span>
                                                    <ExternalLink size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                                                </div>
                                                <p className="text-[9px] text-gray-600 group-hover:text-indigo-300 transition-colors uppercase font-bold">Clique para abrir o trajeto</p>
                                            </a>
                                        )) : (
                                            <div className="bg-gray-800/50 p-8 rounded-2xl border border-gray-700/50 text-center flex flex-col items-center gap-3">
                                                <MapPinned size={32} className="text-gray-700" />
                                                <p className="text-[10px] text-gray-500 font-bold uppercase leading-relaxed">Utilize os endereços sugeridos na análise para traçar sua rota manual.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="bg-gray-950 p-6 rounded-3xl border border-gray-800">
                                  <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Resumo da Frota</h4>
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-400 font-medium">Pedidos Totais</span>
                                      <span className="text-xs text-white font-black">{dailyReport.deliveries.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-400 font-medium">Data Alvo</span>
                                      <span className="text-xs text-white font-black">{formatDate(date)}</span>
                                    </div>
                                  </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-gray-950 border-t border-gray-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Análise baseada em dados de trânsito em tempo real.</p>
                    </div>
                    <button onClick={() => setIsRouteModalOpen(false)} className="bg-white text-gray-950 hover:bg-gray-100 font-black py-4 px-12 rounded-2xl text-[11px] uppercase tracking-widest transition-colors shadow-xl">Fechar Logística</button>
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
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{activeTab === 'PRODUCTS' ? 'Catálogo de Produtos' : 'Gerenciamento de Bairros'}</h3>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Configurações de apoio ao PDV</p>
                </div>
             </div>
             <button onClick={onClose} className="text-gray-500 bg-gray-800 p-4 rounded-2xl hover:text-white transition-all"><X size={20} /></button>
          </div>
          <div className="flex bg-gray-950 p-2 mx-8 mt-6 rounded-[1.25rem] border border-gray-800 shadow-inner">
              <button onClick={() => setActiveTab('PRODUCTS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PRODUCTS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Produtos & Preços</button>
              <button onClick={() => setActiveTab('REGIONS')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'REGIONS' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Bairros de Entrega</button>
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
