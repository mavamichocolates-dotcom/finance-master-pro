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
import { TrendingUp, TrendingDown, DollarSign, Store, Filter, Trophy } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[]; // Receives ALL transactions to allow internal filtering
  units: string[];
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, units }) => {
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterUnit, setFilterUnit] = useState<string>('ALL');

  // 1. FILTER DATA (Year + Unit)
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date + 'T12:00:00');
      const matchYear = tDate.getFullYear() === filterYear;
      const matchUnit = filterUnit === 'ALL' || t.unit === filterUnit;
      return matchYear && matchUnit;
    });
  }, [transactions, filterYear, filterUnit]);

  // 2. CALCULATE TOTALS (Inputs, Outputs, Balance)
  const financials = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredData.forEach(t => {
      if (t.type === TransactionType.INCOME) income += t.amount;
      else expense += t.amount;
    });

    return { income, expense, balance: income - expense };
  }, [filteredData]);

  // 3. MONTHLY EVOLUTION + MAX REVENUE
  const { monthlyData, maxRevenueMonth } = useMemo(() => {
    const data = new Array(12).fill(0).map((_, i) => ({
      name: new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', ''),
      fullName: new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' }),
      income: 0,
      expense: 0,
    }));

    filteredData.forEach(t => {
      const month = new Date(t.date + 'T12:00:00').getMonth();
      if (t.type === TransactionType.INCOME) {
        data[month].income += t.amount;
      } else {
        data[month].expense += t.amount;
      }
    });

    // Find Max Revenue Month
    let maxMonth = { name: '-', value: 0 };
    data.forEach(m => {
      if (m.income > maxMonth.value) {
        maxMonth = { name: m.fullName, value: m.income };
      }
    });

    return { monthlyData: data, maxRevenueMonth: maxMonth };
  }, [filteredData]);

  // 4. EXPENSE DISTRIBUTION (Chart Data)
  const expenseChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    let totalExp = 0;

    filteredData.forEach(t => {
      if (t.type === TransactionType.EXPENSE) {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
        totalExp += t.amount;
      }
    });

    const data = Object.entries(catMap)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalExp > 0 ? (value / totalExp) * 100 : 0,
        label: `${name} (${((value / totalExp) * 100).toFixed(1)}%)`
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 categories to avoid clutter

    return { data, totalExp };
  }, [filteredData]);

  // Helper for axis formatting (Standard BRL without cents to save space)
  const axisFormatter = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom Tooltip for Expenses
  const CustomExpenseTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 p-3 rounded shadow-xl text-sm z-50">
          <p className="font-bold text-white mb-1">{data.name}</p>
          <p className="text-red-400">Valor: {formatCurrency(data.value)}</p>
          <p className="text-gray-400">Participação: {data.percentage.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Monthly Revenue
  const CustomMonthlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 p-3 rounded shadow-xl text-sm z-50">
          <p className="font-bold text-gray-300 mb-2 uppercase tracking-wide">{label}</p>
          <p className="text-green-400 flex justify-between gap-4">
            <span>Entradas:</span>
            <span className="font-bold">{formatCurrency(payload[0].value)}</span>
          </p>
          <p className="text-red-400 flex justify-between gap-4">
            <span>Saídas:</span>
            <span className="font-bold">{formatCurrency(payload[1].value)}</span>
          </p>
          <div className="border-t border-gray-700 mt-2 pt-2">
            <p className={`flex justify-between gap-4 font-bold ${payload[0].value - payload[1].value >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              <span>Saldo:</span>
              <span>{formatCurrency(payload[0].value - payload[1].value)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-10">
      {/* HEADER: Filters */}
      <div className="bg-gray-800 p-5 rounded-lg border border-gray-700 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Store className="text-blue-500" />
            Fluxo de Caixa
          </h2>
          <p className="text-gray-400 text-sm">Análise estratégica de performance</p>
        </div>

        <div className="flex flex-wrap gap-3 items-center bg-gray-900/50 p-2 rounded-lg border border-gray-700">
           <div className="flex items-center gap-2 px-2">
              <Filter size={16} className="text-gray-500" />
              <span className="text-xs text-gray-400 uppercase font-bold">Filtros:</span>
           </div>
           
           {/* Unit Selector */}
           <select 
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
           >
             <option value="ALL">Todas as Lojas</option>
             {units.map(u => <option key={u} value={u}>{u}</option>)}
           </select>

           {/* Year Selector */}
           <select 
            value={filterYear}
            onChange={(e) => setFilterYear(parseInt(e.target.value))}
            className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
           >
             {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
               <option key={y} value={y}>{y}</option>
             ))}
           </select>
        </div>
      </div>

      {/* KPI CARDS (Comparativo) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-green-500 shadow-lg relative overflow-hidden">
           <div className="absolute right-0 top-0 p-4 opacity-5">
              <TrendingUp size={80} className="text-green-500" />
           </div>
           <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Total Entradas</p>
           <h3 className="text-3xl font-bold text-white">{formatCurrency(financials.income)}</h3>
           <p className="text-green-400/60 text-xs mt-2 font-medium">{filterUnit === 'ALL' ? 'Consolidado Global' : filterUnit}</p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg border-l-4 border-red-500 shadow-lg relative overflow-hidden">
           <div className="absolute right-0 top-0 p-4 opacity-5">
              <TrendingDown size={80} className="text-red-500" />
           </div>
           <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Total Saídas</p>
           <h3 className="text-3xl font-bold text-white">{formatCurrency(financials.expense)}</h3>
           <p className="text-red-400/60 text-xs mt-2 font-medium">{filterUnit === 'ALL' ? 'Consolidado Global' : filterUnit}</p>
        </div>

        <div className={`bg-gray-800 p-6 rounded-lg border-l-4 shadow-lg relative overflow-hidden ${financials.balance >= 0 ? 'border-blue-500' : 'border-orange-500'}`}>
           <div className="absolute right-0 top-0 p-4 opacity-5">
              <DollarSign size={80} className={financials.balance >= 0 ? 'text-blue-500' : 'text-orange-500'} />
           </div>
           <p className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Saldo Líquido</p>
           <h3 className={`text-3xl font-bold ${financials.balance >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
             {formatCurrency(financials.balance)}
           </h3>
           <p className="text-gray-500 text-xs mt-2 font-medium">Resultado do Período</p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* MONTHLY REVENUE (Left - Larger) */}
        <div className="lg:col-span-7 bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex flex-col md:flex-row overflow-hidden">
            {/* Highlight Sidebar */}
            <div className="md:w-1/3 bg-gray-900/30 p-8 flex flex-col justify-center border-r border-gray-700 relative">
               <div className="absolute top-0 right-0 p-4 opacity-5">
                  <Trophy size={100} />
               </div>
               
               <div className="relative z-10">
                   <div className="flex items-center gap-2 mb-6 text-yellow-500">
                      <Trophy size={20} />
                      <span className="font-bold text-xs uppercase tracking-widest">Destaque</span>
                   </div>
                   
                   <div className="space-y-6">
                       <div>
                          <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Melhor Mês</p>
                          <p className="text-2xl font-bold text-white capitalize">{maxRevenueMonth.name !== '-' ? maxRevenueMonth.name : '---'}</p>
                       </div>
                       
                       <div>
                          <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Faturamento Recorde</p>
                          <p className="text-3xl font-bold text-green-400">{formatCurrency(maxRevenueMonth.value)}</p>
                       </div>
                   </div>

                   <div className="mt-8 pt-6 border-t border-gray-700/50">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Este gráfico compara o desempenho mês a mês. O mês destacado representa o pico de vendas no período selecionado.
                      </p>
                   </div>
               </div>
            </div>

            {/* The Chart */}
            <div className="md:w-2/3 p-6 flex flex-col justify-between">
              <div className="mb-4 flex items-center justify-between">
                 <h3 className="text-base font-bold text-white">Faturamento Mensal</h3>
                 <div className="flex items-center gap-4 text-xs font-medium text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div> 
                        Entradas
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-red-500"></div> 
                        Saídas
                    </div>
                 </div>
              </div>
              
              <div className="flex-grow min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.5} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#9CA3AF" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false} 
                        dy={10}
                    />
                    <YAxis 
                      stroke="#9CA3AF" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      width={85} 
                      tickFormatter={axisFormatter} 
                      dx={-10}
                    />
                    <ReTooltip content={<CustomMonthlyTooltip />} cursor={{ fill: '#1f2937', opacity: 0.4 }} />
                    <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
        </div>

        {/* EXPENSE DISTRIBUTION (Right) */}
        <div className="lg:col-span-5 bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6 flex flex-col">
            <div className="mb-6 border-b border-gray-700 pb-4">
               <h3 className="text-lg font-bold text-white">Distribuição de Gastos</h3>
               <p className="text-xs text-gray-400 mt-1">Top categorias por volume financeiro</p>
            </div>

            <div className="flex-grow min-h-[350px]">
               {expenseChartData.data.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-gray-500 text-sm italic">
                   Nenhuma despesa registrada no período.
                 </div>
               ) : (
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={expenseChartData.data} 
                      layout="vertical" 
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} opacity={0.3} />
                      <XAxis 
                        type="number" 
                        stroke="#9CA3AF" 
                        fontSize={10} 
                        tickFormatter={axisFormatter} 
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        stroke="#D1D5DB" 
                        fontSize={11} 
                        width={110} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <ReTooltip content={<CustomExpenseTooltip />} cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                        {expenseChartData.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#EF4444' : '#F87171'} />
                        ))}
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
               )}
            </div>
            <div className="mt-4 text-right pt-4 border-t border-gray-700">
               <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total Despesas:</span>
               <span className="text-lg font-bold text-red-400 ml-2">{formatCurrency(expenseChartData.totalExp)}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;