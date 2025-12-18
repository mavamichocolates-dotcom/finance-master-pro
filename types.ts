
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
  
  pdvData?: {
    deliveryDate?: string;
    contact?: string;
    region?: string;
    deliveryAddress?: string; // Novo campo para busca no Maps
    productCode?: string;
    productName?: string;
    paymentMethod?: string;
    baseValue?: number;
    productCost?: number;
    additional?: number;
    frete?: number;
    discount?: number;
  };
}

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

export type UserRole = 'ADMIN' | 'MANAGER' | 'COLLABORATOR';
