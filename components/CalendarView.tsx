
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatDate } from '../utils';
// Added TrendingUp to the imports from lucide-react
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, User, Clock, MapPin, X, Info, TrendingUp } from 'lucide-react';
import { MONTH_NAMES } from '../constants';

interface CalendarViewProps {
  transactions: Transaction[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // Helper para formatar data local como YYYY-MM-DD sem problemas de fuso horário/UTC
  const formatLocalISO = (y: number, m: number, d: number) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    const calendarDays = [];
    
    // Dias do mês anterior
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push({
        day: prevMonthDays - i,
        month: month - 1,
        year,
        currentMonth: false,
        key: `prev-${prevMonthDays - i}`
      });
    }
    
    // Dias do mês atual
    for (let i = 1; i <= days; i++) {
      calendarDays.push({
        day: i,
        month,
        year,
        currentMonth: true,
        key: `current-${i}`
      });
    }
    
    // Dias do próximo mês
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({
        day: i,
        month: month + 1,
        year,
        currentMonth: false,
        key: `next-${i}`
      });
    }
    
    return calendarDays;
  }, [month, year]);

  const ordersByDay = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    
    transactions.forEach(t => {
      // Prioriza data de entrega, senão usa data de lançamento
      // Normalizamos para os primeiros 10 caracteres (YYYY-MM-DD)
      const rawDate = t.pdvData?.deliveryDate || t.date;
      const dateKey = rawDate.substring(0, 10);
      
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(t);
    });
    
    return map;
  }, [transactions]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const selectedDayOrders = selectedDay ? ordersByDay[selectedDay] || [] : [];
  const todayStr = new Date().toLocaleDateString('en-CA'); // Formato YYYY-MM-DD local

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in-up">
      {/* CALENDÁRIO */}
      <div className="lg:col-span-8 bg-gray-800 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gray-900 p-6 border-b border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30">
              <CalendarIcon className="text-blue-500" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white capitalize">{MONTH_NAMES[month]} {year}</h2>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Agenda de Entregas Mirella</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors border border-gray-700">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => { setCurrentDate(new Date()); setSelectedDay(todayStr); }} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg border border-gray-700 uppercase">Hoje</button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors border border-gray-700">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-700 bg-gray-950/50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="py-3 text-center text-[10px] font-black uppercase text-gray-500 tracking-tighter">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {daysInMonth.map((d) => {
            const dayStr = formatLocalISO(d.year, d.month, d.day);
            const dayOrders = ordersByDay[dayStr] || [];
            const isSelected = selectedDay === dayStr;
            const isToday = dayStr === todayStr;

            return (
              <div 
                key={d.key} 
                onClick={() => setSelectedDay(dayStr)}
                className={`min-h-[110px] p-2 border-r border-b border-gray-700 transition-all cursor-pointer relative group ${
                  d.currentMonth ? 'bg-transparent' : 'bg-gray-900/30'
                } ${isSelected ? 'ring-2 ring-inset ring-blue-500 z-10 bg-blue-500/10' : 'hover:bg-gray-700/20'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-xs font-black ${
                    d.currentMonth ? (isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-400') : 'text-gray-700'
                  }`}>
                    {d.day}
                  </span>
                  {dayOrders.length > 0 && (
                    <span className="bg-emerald-500 text-gray-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">
                      {dayOrders.length}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1 overflow-hidden">
                  {dayOrders.slice(0, 3).map((order) => (
                    <div key={order.id} className="text-[8px] bg-gray-900 border border-gray-700 rounded p-1 truncate text-gray-400 font-bold group-hover:text-gray-200 transition-colors">
                      {order.pdvData?.productName || order.description.replace('PDV: ', '')}
                    </div>
                  ))}
                  {dayOrders.length > 3 && (
                    <div className="text-[8px] text-gray-600 font-black pl-1">+{dayOrders.length - 3} mais...</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PAINEL LATERAL DE DETALHES */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl flex flex-col h-full max-h-[800px]">
          <div className="p-6 border-b border-gray-700 bg-gray-900 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                {selectedDay ? formatDate(selectedDay) : 'Selecione um dia'}
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pedidos Agendados</p>
            </div>
            {selectedDay && (
              <div className="bg-blue-600/10 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full border border-blue-500/30">
                {selectedDayOrders.length} LANÇAMENTOS
              </div>
            )}
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
            {!selectedDay ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-sm gap-4 py-20">
                <Info size={40} className="opacity-20" />
                Selecione uma data para detalhamento
              </div>
            ) : selectedDayOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-sm py-20">
                Nenhuma entrega ou venda para este dia.
              </div>
            ) : (
              selectedDayOrders.map((order) => (
                <div key={order.id} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 hover:border-blue-500/50 transition-colors shadow-sm group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="bg-blue-600/10 p-2 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                      <Package size={16} />
                    </div>
                    <span className="font-black text-white text-base">{formatCurrency(order.amount)}</span>
                  </div>
                  
                  <h4 className="text-xs font-black text-gray-200 uppercase mb-3 line-clamp-2 leading-tight tracking-tight">
                    {order.pdvData?.productName || order.description.replace('PDV: ', '')}
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <User size={12} className="text-gray-600" />
                      <span className="font-bold truncate text-gray-300">{order.pdvData?.contact || 'Cliente Avulso'}</span>
                    </div>
                    {(order.pdvData?.deliveryAddress || order.pdvData?.region) && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <MapPin size={12} className="text-gray-600" />
                        <span className="font-bold truncate text-gray-300">{order.pdvData?.deliveryAddress || order.pdvData?.region}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Clock size={12} className="text-gray-600" />
                      <span className="font-bold">Entrega: {formatDate(order.pdvData?.deliveryDate || order.date)}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-700 flex justify-between items-center">
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                      order.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {order.status === 'PAID' ? 'Pago' : 'Pendente'}
                    </span>
                    {order.pdvData?.paymentMethod && (
                      <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">{order.pdvData.paymentMethod}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedDay && selectedDayOrders.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl shadow-xl">
            <h4 className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1">Previsão Financeira</h4>
            <div className="text-3xl font-black text-white">
              {formatCurrency(selectedDayOrders.reduce((sum, o) => sum + o.amount, 0))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[9px] text-white/50 font-black uppercase">
               <TrendingUp size={12} /> {selectedDayOrders.length} vendas confirmadas
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;
