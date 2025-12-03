export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum PaymentStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO Date string YYYY-MM-DD
  status: PaymentStatus;
  installments?: {
    current: number;
    total: number;
  };
  unit?: string; // e.g., "Loja Osasco"
}

export interface CategoryStats {
  category: string;
  total: number;
  percentage: number;
  type: TransactionType;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  balance: number;
}
