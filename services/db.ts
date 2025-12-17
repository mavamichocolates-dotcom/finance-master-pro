
import { supabase, isSupabaseConfigured } from '../src/supabase';
import { Transaction, User, UserRole, TransactionType, PaymentStatus } from '../types';
import { SINGLE_STORE_NAME } from '../constants';
import { generateId } from '../utils';

// --- TYPES MAPPING ---
interface DBUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  allowed_units: string[];
  active: boolean;
  created_at: string;
}

interface DBTransaction {
  id: string;
  user_id: string;
  store_name: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  status: PaymentStatus;
  reviewed: boolean;
  installments_current: number | null;
  installments_total: number | null;
  created_at: string;
}

const LOCAL_KEYS = {
  USERS: 'fm_local_users',
  TRANSACTIONS: 'fm_local_transactions',
  STORES: 'fm_local_stores'
};

const getLocal = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setLocal = (key: string, data: any[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

class DBService {
  
  async getUsers(): Promise<User[]> {
    if (!isSupabaseConfigured) return getLocal<User>(LOCAL_KEYS.USERS);
    const { data, error } = await supabase.from('app_users').select('*').order('name');
    if (error) {
      if (error.code === '42P01') throw new Error("MISSING_TABLES");
      console.error('Error fetching users:', error);
      return [];
    }
    return (data as DBUser[]).map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role, allowedUnits: [SINGLE_STORE_NAME], active: u.active, createdAt: u.created_at, passwordHash: u.password_hash
    }));
  }

  async saveUser(user: User): Promise<User | null> {
    if (!isSupabaseConfigured) {
      const users = getLocal<User>(LOCAL_KEYS.USERS);
      if (user.id && user.id.length > 5) {
        const index = users.findIndex(u => u.id === user.id);
        if (index !== -1) { users[index] = { ...user }; setLocal(LOCAL_KEYS.USERS, users); return user; }
      } 
      const newUser = { ...user, id: generateId(), createdAt: new Date().toISOString() };
      users.push(newUser);
      setLocal(LOCAL_KEYS.USERS, users);
      return newUser;
    }
    const isUpdate = user.id && user.id.length > 10;
    const dbUser: any = { name: user.name, email: user.email, password_hash: user.passwordHash, role: user.role, allowed_units: [SINGLE_STORE_NAME], active: user.active };
    if (isUpdate) { 
      const { data, error } = await supabase.from('app_users').update(dbUser).eq('id', user.id).select().single();
      if (error) throw error;
      return { ...user, id: data.id };
    } else {
      dbUser.id = generateId();
      const { data, error } = await supabase.from('app_users').insert(dbUser).select().single();
      if (error) throw error;
      return { ...user, id: data.id, createdAt: data.created_at };
    }
  }

  async deleteUser(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const users = getLocal<User>(LOCAL_KEYS.USERS);
      setLocal(LOCAL_KEYS.USERS, users.filter(u => u.id !== id));
      return;
    }
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) throw error;
  }

  async findUserByIdentifier(identifier: string): Promise<User | null> {
    if (!isSupabaseConfigured) return getLocal<User>(LOCAL_KEYS.USERS).find(u => u.email === identifier || u.name === identifier) || null;
    const { data, error } = await supabase.from('app_users').select('*').or(`email.eq.${identifier},name.eq.${identifier}`).single();
    if (error || !data) return null;
    const u = data as DBUser;
    return { id: u.id, name: u.name, email: u.email, role: u.role, allowedUnits: [SINGLE_STORE_NAME], active: u.active, createdAt: u.created_at, passwordHash: u.password_hash };
  }

  async getTransactions(): Promise<Transaction[]> {
    if (!isSupabaseConfigured) return getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (error) {
      if (error.code === '42P01') throw new Error("MISSING_TABLES");
      console.error('Error fetching transactions:', error);
      return [];
    }
    return (data as DBTransaction[]).map(t => ({
      id: t.id, description: t.description, amount: Number(t.amount), type: t.type, category: t.category, date: t.date, status: t.status, reviewed: !!t.reviewed, installments: (t.installments_current && t.installments_total) ? { current: t.installments_current, total: t.installments_total } : undefined, unit: t.store_name, userId: t.user_id, createdAt: t.created_at
    }));
  }

  async addTransaction(t: Transaction): Promise<Transaction | null> {
    const fixedTransaction = { ...t, unit: SINGLE_STORE_NAME };
    if (!isSupabaseConfigured) {
      const txs = getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS);
      const newTx = { ...fixedTransaction, id: generateId(), createdAt: new Date().toISOString() };
      txs.push(newTx);
      setLocal(LOCAL_KEYS.TRANSACTIONS, txs);
      return newTx;
    }
    const validUserId = fixedTransaction.userId === 'master-override' ? null : fixedTransaction.userId;
    const dbTx = {
      id: fixedTransaction.id, user_id: validUserId, store_name: SINGLE_STORE_NAME, description: fixedTransaction.description, amount: fixedTransaction.amount, type: fixedTransaction.type, category: fixedTransaction.category, date: fixedTransaction.date, status: fixedTransaction.status, reviewed: !!fixedTransaction.reviewed, installments_current: fixedTransaction.installments?.current || null, installments_total: fixedTransaction.installments?.total || null
    };
    const { data, error } = await supabase.from('transactions').insert(dbTx).select().single();
    if (error) throw error;
    return { ...fixedTransaction, id: data.id, createdAt: data.created_at };
  }

  async updateTransaction(t: Transaction): Promise<void> {
    if (!isSupabaseConfigured) {
      const txs = getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS);
      const index = txs.findIndex(x => x.id === t.id);
      if (index !== -1) { txs[index] = t; setLocal(LOCAL_KEYS.TRANSACTIONS, txs); }
      return;
    }
    const dbTx = {
      description: t.description, amount: t.amount, type: t.type, category: t.category, date: t.date, status: t.status, reviewed: !!t.reviewed
    };
    const { error } = await supabase.from('transactions').update(dbTx).eq('id', t.id);
    if (error) throw error;
  }

  async deleteTransaction(id: string): Promise<void> {
    if (!isSupabaseConfigured) { setLocal(LOCAL_KEYS.TRANSACTIONS, getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS).filter(t => t.id !== id)); return; }
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteTransactions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    if (!isSupabaseConfigured) { setLocal(LOCAL_KEYS.TRANSACTIONS, getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS).filter(t => !ids.includes(t.id))); return; }
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) throw error;
  }

  async getUnits(): Promise<string[]> { return [SINGLE_STORE_NAME]; }
  async addUnit(name: string): Promise<void> { return; }
  async deleteUnit(name: string): Promise<void> { return; }

  async clearAllData(): Promise<void> {
    if (!isSupabaseConfigured) { localStorage.removeItem(LOCAL_KEYS.TRANSACTIONS); localStorage.removeItem(LOCAL_KEYS.USERS); localStorage.removeItem(LOCAL_KEYS.STORES); return; }
    const { error: txError } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (txError) throw txError;
    const { error: uError } = await supabase.from('app_users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (uError) throw uError;
  }
}

export const db = new DBService();
