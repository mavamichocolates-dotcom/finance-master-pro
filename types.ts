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
  userId?: string; // ID of the user who created it
  createdAt?: string;
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

// --- Auth Types ---

export type UserRole = 'ADMIN' | 'MANAGER' | 'COLLABORATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  allowedUnits: string[]; // List of unit names this user can access
  passwordHash?: string; // In a real app, never store plain text. Here we simulate.
  createdAt: string;
  active: boolean;
}