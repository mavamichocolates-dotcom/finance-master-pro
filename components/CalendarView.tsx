
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatDate, getTodayString } from '../utils';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, User, Clock, MapPin, X, Info, TrendingUp } from 'lucide-react';
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
    
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push({ day: prevMonthDays - i, month: month - 1, year, currentMonth: false, key: `prev-${prevMonthDays - i}` });
    }
    
    for (let i = 1; i <= days; i++) {
      calendarDays.push({ day: i, month, year, currentMonth: true, key: `current-${i}` });
    }
    
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({ day: i, month: month + 1, year, currentMonth: false, key: `next-${i}` });
    }
    
    return calendarDays;
  }, [month, year]);

  const ordersByDay = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    
    transactions.forEach(t => {
      // REGRA: Prioridade para data de entrega (deliveryDate), senão usa a data do lançamento (date)
      // Garantimos que pegamos apenas os 10 primeiros caracteres YYYY-MM-DD
      const rawDate = (t.pdvData?.deliveryDate || t.date || '').substring(0, 10);
      
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
  const selectedDayOrders = selectedDay ? ordersByDay[selectedDay] || [] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">
      <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gray-900/80 p-6 border-b border-gray-700 flex justify-between items-center backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
              <CalendarIcon className="text-blue-500" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white capitalize tracking-tighter">{MONTH_NAMES[month]} {year}</h2>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Agenda Mirella Doces</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="p-2.5 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all border border-gray-700 shadow-sm"><ChevronLeft size={20} /></button>
            <button onClick={() => { setCurrentDate(new Date()); setSelectedDay(todayStr); }} className="px-5 py-2.5 text-[10px] font-black text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl border border-gray-700 uppercase tracking-widest transition-all">Hoje</button>
            <button onClick={handleNextMonth} className="p-2.5 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all border border-gray-700 shadow-sm"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-700 bg-gray-950/30">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="py-4 text-center text-[10px] font-black uppercase text-gray-500 tracking-widest">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {daysInMonth.map((d) => {
            const dayStr = formatGridKey(d.year, d.month, d.day);
            const dayOrders = ordersByDay[dayStr] || [];
            const isSelected = selectedDay === dayStr;
            const isToday = dayStr === todayStr;

            return (
              <div 
                key={d.key} 
                onClick={() => setSelectedDay(dayStr)}
                className={`min-h-[120px] p-3 border-r border-b border-gray-700 transition-all cursor-pointer relative group ${
                  d.currentMonth ? 'bg-transparent' : 'bg-gray-950/20'
                } ${isSelected ? 'bg-blue-600/5 ring-2 ring-inset ring-blue-500 z-10' : 'hover:bg-gray-700/30'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-xs font-black ${
                    d.currentMonth ? (isToday ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-xl shadow-lg shadow-blue-500/20' : 'text-gray-300') : 'text-gray-600'
                  }`}>
                    {d.day}
                  </span>
                  {dayOrders.length > 0 && (
                    <span className="bg-emerald-500 text-gray-950 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                      {dayOrders.length}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1.5 overflow-hidden">
                  {dayOrders.slice(0, 3).map((order) => (
                    <div key={order.id} className="text-[9px] bg-gray-900 border border-gray-700 rounded-lg p-1.5 truncate text-gray-400 font-bold group-hover:border-gray-600 transition-all">
                      {order.pdvData?.productName || order.description.replace('PDV: ', '')}
                    </div>
                  ))}
                  {dayOrders.length > 3 && (
                    <div className="text-[8px] text-gray-500 font-black pl-1.5 uppercase">+{dayOrders.length - 3} mais...</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl flex flex-col h-full max-h-[750px] overflow-hidden">
          <div className="p-6 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tighter">
                {selectedDay ? formatDate(selectedDay) : 'Selecione'}
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Detalhamento</p>
            </div>
            {selectedDay && selectedDayOrders.length > 0 && (
              <div className="bg-blue-600/20 text-blue-400 text-[10px] font-black px-4 py-1.5 rounded-2xl border border-blue-500/30">
                {selectedDayOrders.length} PEDIDOS
              </div>
            )}
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar p-5 space-y-4">
            {!selectedDay || selectedDayOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-sm gap-6 py-24 opacity-40">
                <div className="bg-gray-900 p-6 rounded-full border border-gray-700"><Info size={48} /></div>
                <p className="text-center font-bold uppercase tracking-widest text-xs">Nenhum pedido ou entrega agendada para este dia</p>
              </div>
            ) : (
              selectedDayOrders.map((order) => (
                <div key={order.id} className="bg-gray-950/40 border border-gray-700 rounded-2xl p-5 hover:border-blue-500/50 transition-all shadow-md group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-600/10 p-2.5 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                      <Package size={20} />
                    </div>
                    <span className="font-black text-white text-lg tracking-tighter">{formatCurrency(order.amount)}</span>
                  </div>
                  
                  <h4 className="text-sm font-black text-gray-100 uppercase mb-4 leading-tight tracking-tight">
                    {order.pdvData?.productName || order.description.replace('PDV: ', '')}
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <User size={14} className="text-blue-500" />
                      <span className="font-bold truncate text-gray-300">{order.pdvData?.contact || 'Cliente Avulso'}</span>
                    </div>
                    {(order.pdvData?.deliveryAddress || order.pdvData?.region) && (
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <MapPin size={14} className="text-emerald-500" />
                        <span className="font-bold truncate text-gray-200">{order.pdvData?.deliveryAddress || order.pdvData?.region}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <Clock size={14} className="text-orange-500" />
                      <span className="font-bold">Entrega: {formatDate(order.pdvData?.deliveryDate || order.date)}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-700/50 flex justify-between items-center">
                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border shadow-sm ${
                      order.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {order.status === 'PAID' ? 'PAGO' : 'PENDENTE'}
                    </span>
                    {order.pdvData?.paymentMethod && (
                      <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest bg-gray-900 px-2 py-1 rounded-md">{order.pdvData.paymentMethod}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedDay && selectedDayOrders.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
            <TrendingUp size={120} className="absolute -right-8 -bottom-8 text-white/5 group-hover:scale-110 transition-transform" />
            <h4 className="text-[11px] font-black text-white/60 uppercase tracking-widest mb-1 relative z-10">Total do Dia Selecionado</h4>
            <div className="text-4xl font-black text-white relative z-10 tracking-tighter">
              {formatCurrency(selectedDayOrders.reduce((sum, o) => sum + o.amount, 0))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-white/80 font-black uppercase relative z-10">
               <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> {selectedDayOrders.length} encomendas confirmadas
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;
