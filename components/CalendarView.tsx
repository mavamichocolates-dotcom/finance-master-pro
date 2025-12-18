
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { formatCurrency, formatDate, getTodayString } from '../utils';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, User, Clock, MapPin, X, Info, TrendingUp, Sparkles } from 'lucide-react';
import { MONTH_NAMES } from '../constants';

interface CalendarViewProps {
  transactions: Transaction[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(getTodayString());

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Helper para formatar data do grid
  const formatGridKey = (y: number, m: number, d: number) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    const calendarDays = [];
    
    // Dias do mês anterior
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push({ day: prevMonthDays - i, month: month - 1, year, currentMonth: false, key: `prev-${prevMonthDays - i}` });
    }
    
    // Dias do mês atual
    for (let i = 1; i <= days; i++) {
      calendarDays.push({ day: i, month, year, currentMonth: true, key: `current-${i}` });
    }
    
    // Preencher até completar as 6 linhas do calendário (42 dias)
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({ day: i, month: month + 1, year, currentMonth: false, key: `next-${i}` });
    }
    
    return calendarDays;
  }, [month, year]);

  const ordersByDay = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    
    transactions.forEach(t => {
      // Prioriza a data de entrega (deliveryDate) vinda do PDV
      const deliveryDate = t.pdvData?.deliveryDate || t.date;
      const rawDate = deliveryDate.substring(0, 10);
      
      if (rawDate) {
        if (!map[rawDate]) map[rawDate] = [];
        map[rawDate].push(t);
      }
    });
    
    return map;
  }, [transactions]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const todayStr = getTodayString();
  const selectedDayOrders = selectedDay ? (ordersByDay[selectedDay] || []).sort((a,b) => {
      const timeA = new Date(a.createdAt || a.date).getTime();
      const timeB = new Date(b.createdAt || b.date).getTime();
      return timeB - timeA;
  }) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">
      {/* GRID DO CALENDÁRIO */}
      <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gray-900/80 p-6 border-b border-gray-700 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
              <CalendarIcon className="text-blue-500" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white capitalize tracking-tighter">{MONTH_NAMES[month]} {year}</h2>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Controle de Entregas Mirella Doces</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="p-2.5 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all border border-gray-700 shadow-sm"><ChevronLeft size={20} /></button>
            <button onClick={() => { setCurrentDate(new Date()); setSelectedDay(todayStr); }} className="px-5 py-2.5 text-[10px] font-black text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl border border-gray-700 uppercase tracking-widest transition-all">HOJE</button>
            <button onClick={handleNextMonth} className="p-2.5 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all border border-gray-700 shadow-sm"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-700 bg-gray-950/30">
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
            <div key={d} className="py-4 text-center text-[10px] font-black uppercase text-gray-500 tracking-widest">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 bg-gray-850/20">
          {daysInMonth.map((d) => {
            const dayStr = formatGridKey(d.year, d.month, d.day);
            const dayOrders = ordersByDay[dayStr] || [];
            const isSelected = selectedDay === dayStr;
            const isToday = dayStr === todayStr;

            return (
              <div 
                key={d.key} 
                onClick={() => setSelectedDay(dayStr)}
                className={`min-h-[130px] p-3 border-r border-b border-gray-700 transition-all cursor-pointer relative group ${
                  d.currentMonth ? 'bg-transparent' : 'bg-gray-900/40 opacity-50'
                } ${isSelected ? 'bg-blue-600/5 ring-2 ring-inset ring-blue-500 z-10' : 'hover:bg-gray-700/30'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-black transition-all ${
                    isToday ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-lg shadow-blue-500/30' : 
                    d.currentMonth ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {d.day}
                  </span>
                  {dayOrders.length > 0 && (
                    <div className="flex items-center gap-1">
                       <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-emerald-500/30 shadow-sm">
                        {dayOrders.length}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1 overflow-hidden">
                  {dayOrders.slice(0, 3).map((order) => (
                    <div key={order.id} className="text-[9px] bg-gray-900/80 border border-gray-700 rounded-lg p-1.5 truncate text-gray-400 font-bold group-hover:border-blue-500/30 transition-all flex items-center gap-1">
                      <div className={`w-1 h-1 rounded-full ${order.status === 'PAID' ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                      {order.pdvData?.productName || order.description.replace('PDV: ', '')}
                    </div>
                  ))}
                  {dayOrders.length > 3 && (
                    <div className="text-[8px] text-gray-600 font-black px-1 uppercase tracking-tighter">+{dayOrders.length - 3} itens extras</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PAINEL DE DETALHES DO DIA */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl flex flex-col h-full max-h-[850px] overflow-hidden">
          <div className="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                {selectedDay ? formatDate(selectedDay) : 'Data'}
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Agendamentos para Entrega</p>
            </div>
            {selectedDayOrders.length > 0 && (
              <div className="bg-blue-600/20 text-blue-400 text-[10px] font-black px-4 py-2 rounded-2xl border border-blue-500/30 animate-pulse">
                {selectedDayOrders.length} ORDENS
              </div>
            )}
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar p-5 space-y-4">
            {selectedDayOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-sm gap-6 py-32 opacity-30">
                <div className="bg-gray-900 p-8 rounded-full border border-gray-700 shadow-inner">
                  <Info size={56} />
                </div>
                <p className="text-center font-bold uppercase tracking-[0.2em] text-[10px]">Agenda vazia para este dia.</p>
              </div>
            ) : (
              selectedDayOrders.map((order) => (
                <div key={order.id} className="bg-gray-950/60 border border-gray-700 rounded-2xl p-6 hover:border-blue-500/50 transition-all shadow-md group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Sparkles size={40} className="text-blue-500" />
                  </div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-600/10 p-3 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform border border-blue-500/20">
                      <Package size={24} />
                    </div>
                    <div className="text-right">
                       <span className="font-black text-white text-xl tracking-tighter leading-none">{formatCurrency(order.amount)}</span>
                       <p className="text-[9px] text-gray-600 font-black uppercase mt-1 tracking-widest">{order.pdvData?.paymentMethod}</p>
                    </div>
                  </div>
                  
                  <h4 className="text-base font-black text-white uppercase mb-4 leading-tight tracking-tight group-hover:text-blue-400 transition-colors">
                    {order.pdvData?.productName || order.description.replace('PDV: ', '')}
                  </h4>
                  
                  <div className="space-y-3 bg-gray-900/40 p-4 rounded-xl border border-gray-700/50">
                    <div className="flex items-center gap-3 text-xs">
                      <User size={14} className="text-blue-500" />
                      <span className="font-bold truncate text-gray-300">{order.pdvData?.contact || 'Cliente Avulso'}</span>
                    </div>
                    {(order.pdvData?.deliveryAddress || order.pdvData?.region) && (
                      <div className="flex items-center gap-3 text-xs">
                        <MapPin size={14} className="text-emerald-500" />
                        <span className="font-bold truncate text-gray-200">{order.pdvData?.deliveryAddress || order.pdvData?.region}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs">
                      <Clock size={14} className="text-orange-500" />
                      <span className="font-bold text-gray-400 text-[10px] uppercase">Lanc. em {formatDate(order.date)}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-700/50 flex justify-between items-center">
                    <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-xl border shadow-sm ${
                      order.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {order.status === 'PAID' ? 'PAGO / CONCLUÍDO' : 'PENDENTE'}
                    </span>
                    <button className="text-gray-600 hover:text-white transition-colors">
                       <TrendingUp size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;
