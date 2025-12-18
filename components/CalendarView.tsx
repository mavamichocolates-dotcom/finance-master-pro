
import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, User, Clock, MapPin, X, Info } from 'lucide-react';
import { MONTH_NAMES } from '../constants';

interface CalendarViewProps {
  transactions: Transaction[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ transactions }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  const daysInMonth = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    
    const calendarDays = [];
    
    // Dias do mês anterior para preencher o grid
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
    
    // Dias do próximo mês para completar a última semana
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
      // Prioriza a data de entrega se existir, senão usa a data do lançamento
      const deliveryDate = t.pdvData?.deliveryDate || t.date;
      if (!map[deliveryDate]) map[deliveryDate] = [];
      map[deliveryDate].push(t);
    });
    
    return map;
  }, [transactions]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getDayString = (day: number, m: number, y: number) => {
    const date = new Date(y, m, day);
    return date.toISOString().split('T')[0];
  };

  const selectedDayOrders = selectedDay ? ordersByDay[selectedDay] || [] : [];

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
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg border border-gray-700 uppercase">Hoje</button>
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
            const dayStr = getDayString(d.day, d.month, d.year);
            const dayOrders = ordersByDay[dayStr] || [];
            const isSelected = selectedDay === dayStr;
            const isToday = dayStr === new Date().toISOString().split('T')[0];

            return (
              <div 
                key={d.key} 
                onClick={() => setSelectedDay(dayStr)}
                className={`min-h-[100px] p-2 border-r border-b border-gray-700 transition-all cursor-pointer relative group ${
                  d.currentMonth ? 'bg-transparent' : 'bg-gray-900/30'
                } ${isSelected ? 'ring-2 ring-inset ring-blue-500 z-10 bg-blue-500/5' : 'hover:bg-gray-700/20'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs font-bold ${
                    d.currentMonth ? (isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-400') : 'text-gray-700'
                  }`}>
                    {d.day}
                  </span>
                  {dayOrders.length > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black px-1.5 rounded-md border border-emerald-500/30">
                      {dayOrders.length}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1 overflow-hidden">
                  {dayOrders.slice(0, 3).map((order) => (
                    <div key={order.id} className="text-[9px] bg-gray-900/80 border border-gray-700 rounded-md p-1 truncate text-gray-300 shadow-sm">
                      {order.pdvData?.productName || order.description.replace('PDV: ', '')}
                    </div>
                  ))}
                  {dayOrders.length > 3 && (
                    <div className="text-[8px] text-gray-500 font-bold pl-1">+{dayOrders.length - 3} mais...</div>
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
              <p className="text-[10px] text-gray-500 font-bold">Resumo do dia selecionado</p>
            </div>
            {selectedDay && (
              <div className="bg-blue-600/10 text-blue-400 text-[10px] font-black px-3 py-1 rounded-full border border-blue-500/30">
                {selectedDayOrders.length} PEDIDOS
              </div>
            )}
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
            {!selectedDay ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-sm gap-4 py-20">
                <Info size={40} className="opacity-20" />
                Clique em um dia para ver os detalhes
              </div>
            ) : selectedDayOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 italic text-sm py-20">
                Nenhum pedido para este dia.
              </div>
            ) : (
              selectedDayOrders.map((order) => (
                <div key={order.id} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4 hover:border-blue-500/50 transition-colors shadow-sm group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="bg-blue-600/10 p-2 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                      <Package size={16} />
                    </div>
                    <span className="font-black text-white text-sm">{formatCurrency(order.amount)}</span>
                  </div>
                  
                  <h4 className="text-xs font-black text-gray-200 uppercase mb-3 line-clamp-2 leading-tight">
                    {order.pdvData?.productName || order.description.replace('PDV: ', '')}
                  </h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <User size={12} className="text-gray-600" />
                      <span className="font-bold truncate">{order.pdvData?.contact || 'Cliente não informado'}</span>
                    </div>
                    {order.pdvData?.region && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <MapPin size={12} className="text-gray-600" />
                        <span className="font-bold">{order.pdvData.region}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Clock size={12} className="text-gray-600" />
                      <span className="font-bold">Agendado: {formatDate(order.pdvData?.deliveryDate || order.date)}</span>
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
          <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 p-6 rounded-2xl">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Meta Financeira do Dia</h4>
            <div className="text-2xl font-black text-white">
              {formatCurrency(selectedDayOrders.reduce((sum, o) => sum + o.amount, 0))}
            </div>
            <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase">Previsão de Recebimento</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarView;
