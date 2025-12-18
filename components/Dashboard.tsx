
import React, { useMemo, useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { formatCurrency } from '../utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReTooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Store, Filter, Trophy, MapPin } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  units: string[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, units }) => {
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterUnit, setFilterUnit] = useState<string>('ALL');

  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date + 'T12:00:00');
      const matchYear = tDate.getFullYear() === filterYear;
      const matchUnit = filterUnit === 'ALL' || t.unit === filterUnit;
      return matchYear && matchUnit;
    });
  }, [transactions, filterYear, filterUnit]);

  const financials = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredData.forEach(t => {
      if (t.type === TransactionType.INCOME) income += t.amount;
      else expense += t.amount;
    });
    return { income, expense, balance: income - expense };
  }, [filteredData]);

  const { monthlyData } = useMemo(() => {
    const data = new Array(12).fill(0).map((_, i) => ({
      name: new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', ''),
      fullName: new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' }),
      income: 0,
      expense: 0,
    }));
    filteredData.forEach(t => {
      const month = new Date(t.date + 'T12:00:00').getMonth();
      if (t.type === TransactionType.INCOME) data[month].income += t.amount;
      else data[month].expense += t.amount;
    });
    return { monthlyData: data };
  }, [filteredData]);

  const expenseChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    let totalExp = 0;
    filteredData.forEach(t => {
      if (t.type === TransactionType.EXPENSE) {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        totalExp += t.amount;
      }
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value, percentage: totalExp > 0 ? (value / totalExp) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredData]);

  const regionChartData = useMemo(() => {
    const regMap: Record<string, number> = {};
    filteredData.forEach(t => {
      if (t.pdvData?.region) {
        const r = t.pdvData.region.trim();
        if (r) {
          regMap[r] = (regMap[r] || 0) + 1;
        }
      }
    });
    return Object.entries(regMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredData]);

  const axisFormatter = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Store className="text-blue-500" /> Fluxo de Caixa</h2>
          <p className="text-gray-400 text-sm">Relatório analítico de desempenho geográfico e financeiro</p>
        </div>
        <div className="flex gap-3 items-center bg-gray-900/50 p-2 rounded-lg border border-gray-700">
           <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-1.5 text-sm">
             <option value="ALL">Todas as Lojas</option>
             {units.map(u => <option key={u} value={u}>{u}</option>)}
           </select>
           <select value={filterYear} onChange={(e) => setFilterYear(parseInt(e.target.value))} className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-1.5 text-sm">
             {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
               <option key={y} value={y}>{y}</option>
             ))}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Entradas" value={financials.income} icon={<TrendingUp size={30} />} color="text-green-400" borderColor="border-green-500" />
        <KpiCard title="Saídas" value={financials.expense} icon={<TrendingDown size={30} />} color="text-red-400" borderColor="border-red-500" />
        <KpiCard title="Saldo Líquido" value={financials.balance} icon={<DollarSign size={30} />} color={financials.balance >= 0 ? "text-blue-400" : "text-orange-400"} borderColor={financials.balance >= 0 ? "border-blue-500" : "border-orange-500"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
            <h3 className="text-base font-bold text-white mb-6">Faturamento vs Despesas Mensais</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.5} />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} tickFormatter={axisFormatter} width={90} />
                  <ReTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} formatter={(val: number) => formatCurrency(val)} />
                  <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
        </div>

        {/* GRÁFICO DE REGIÕES SOLICITADO */}
        <div className="lg:col-span-6 bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2"><MapPin size={18} className="text-indigo-500" /> Distribuição por Região / Bairro</h3>
            <div className="h-[350px]">
               {regionChartData.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm italic gap-4">
                   <div className="bg-gray-900 p-4 rounded-full"><MapPin size={32} /></div>
                   Nenhum pedido geolocalizado ainda.
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionChartData} layout="vertical" margin={{ left: 50, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} opacity={0.2} />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke="#D1D5DB" fontSize={11} width={120} tickLine={false} axisLine={false} />
                      <ReTooltip cursor={{ fill: '#ffffff10' }} />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24}>
                        {regionChartData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === 0 ? '#818cf8' : '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
               )}
            </div>
            <p className="mt-4 text-[10px] text-gray-500 uppercase font-black text-center tracking-widest">Baseado em volumes de vendas PDV</p>
        </div>

        <div className="lg:col-span-6 bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2"><TrendingDown size={18} className="text-red-500" /> Centro de Custos (Saídas)</h3>
            <div className="h-[350px]">
               {expenseChartData.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">Nenhuma despesa para exibir.</div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseChartData} layout="vertical" margin={{ left: 50, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} opacity={0.2} />
                      <XAxis type="number" stroke="#9CA3AF" fontSize={10} axisLine={false} tickLine={false} tickFormatter={axisFormatter} />
                      <YAxis dataKey="name" type="category" stroke="#D1D5DB" fontSize={11} width={120} tickLine={false} axisLine={false} />
                      <ReTooltip formatter={(v: any) => formatCurrency(v)} cursor={{ fill: '#ffffff10' }} />
                      <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                 </ResponsiveContainer>
               )}
            </div>
            <p className="mt-4 text-[10px] text-gray-500 uppercase font-black text-center tracking-widest">As 10 maiores categorias de gastos</p>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon, color, borderColor }: any) => (
  <div className={`bg-gray-800 p-6 rounded-lg border-l-4 shadow-lg relative overflow-hidden ${borderColor}`}>
     <div className="absolute right-0 top-0 p-4 opacity-5">{icon}</div>
     <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">{title}</p>
     <h3 className={`text-3xl font-bold ${color}`}>{formatCurrency(value)}</h3>
  </div>
);

export default Dashboard;
