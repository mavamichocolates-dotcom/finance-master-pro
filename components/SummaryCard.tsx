import React from 'react';

interface SummaryCardProps {
  title: string;
  value: string;
  colorClass: string; // Tailwind bg class
  icon?: React.ReactNode;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, colorClass, icon }) => {
  return (
    <div className={`p-4 rounded-lg shadow-lg text-white ${colorClass} flex flex-col items-center justify-center min-w-[200px]`}>
      <h3 className="text-sm font-semibold uppercase tracking-wider opacity-90 mb-1">{title}</h3>
      <div className="text-2xl font-bold flex items-center gap-2">
        {icon}
        {value}
      </div>
    </div>
  );
};

export default SummaryCard;
