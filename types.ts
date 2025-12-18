
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
  reviewed?: boolean;
  installments?: {
    current: number;
    total: number;
  };
  unit?: string;
  userId?: string;
  createdAt?: string;
  
  // Campos específicos para o PDV (Baseados no print da planilha)
  pdvData?: {
    deliveryDate?: string;
    contact?: string;
    cepCode?: string;
    productCode?: string;
    productName?: string;
    paymentMethod?: string;
    baseValue?: number;
    additional?: number;
    frete?: number;
    discount?: number;
  };
}

export interface CategoryStats {
  category: string;
  total: number;
  percentage: number;
  type: TransactionType;
}

export interface MonthlySummary {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'COLLABORATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allowedUnits: string[];
  passwordHash?: string;
  createdAt: string;
  active: boolean;
}
