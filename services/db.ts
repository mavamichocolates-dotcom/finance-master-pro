
import { supabase, isSupabaseConfigured } from '../src/supabase';
import { Transaction, User, UserRole, TransactionType, PaymentStatus } from '../types';
import { SINGLE_STORE_NAME } from '../constants';
import { generateId } from '../utils';

const USERS_STORAGE_KEY = 'fm_local_users';
const TRANSACTIONS_STORAGE_KEY = 'fm_local_transactions';

class DBService {
  
  async getTransactions(): Promise<Transaction[]> {
    if (!isSupabaseConfigured) {
      const data = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    }
    
    const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching transactions:', error);
      if (error.message?.includes('reviewed')) throw new Error('MISSING_COLUMN_REVIEWED');
      return [];
    }
    
    return (data || []).map(t => ({
      id: t.id, 
      description: t.description, 
      amount: Number(t.amount), 
      type: t.type, 
      category: t.category, 
      date: t.date, 
      status: t.status, 
      reviewed: !!t.reviewed,
      unit: t.store_name, 
      userId: t.user_id, 
      createdAt: t.created_at,
      pdvData: t.pdv_data
    }));
  }

  async addTransaction(t: Transaction): Promise<Transaction | null> {
    if (!isSupabaseConfigured) {
      const txs = JSON.parse(localStorage.getItem(TRANSACTIONS_STORAGE_KEY) || '[]');
      const newTx = { ...t, id: generateId(), createdAt: new Date().toISOString() };
      txs.push(newTx);
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(txs));
      return newTx;
    }

    const dbTx = {
      id: t.id || generateId(),
      user_id: t.userId || null,
      store_name: SINGLE_STORE_NAME,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category,
      date: t.date,
      status: t.status,
      reviewed: !!t.reviewed,
      pdv_data: t.pdvData
    };

    const { data, error } = await supabase.from('transactions').insert(dbTx).select().single();
    if (error) throw error;
    return { ...t, id: data.id, createdAt: data.created_at };
  }

  async updateTransaction(t: Transaction): Promise<void> {
    if (!isSupabaseConfigured) {
      const txs = JSON.parse(localStorage.getItem(TRANSACTIONS_STORAGE_KEY) || '[]');
      const index = txs.findIndex((x: any) => x.id === t.id);
      if (index !== -1) { txs[index] = t; localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(txs)); }
      return;
    }

    const dbTx = {
      description: t.description, 
      amount: t.amount, 
      type: t.type, 
      category: t.category, 
      date: t.date, 
      status: t.status, 
      reviewed: !!t.reviewed,
      pdv_data: t.pdvData
    };

    const { error } = await supabase.from('transactions').update(dbTx).eq('id', t.id);
    if (error) throw error;
  }

  async deleteTransaction(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const txs = JSON.parse(localStorage.getItem(TRANSACTIONS_STORAGE_KEY) || '[]');
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(txs.filter((t: any) => t.id !== id)));
      return;
    }
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  }

  async getUsers(): Promise<User[]> {
    if (!isSupabaseConfigured) {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    }
    const { data, error } = await supabase.from('app_users').select('*');
    if (error) return [];
    return (data || []).map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role, allowedUnits: u.allowed_units || [], active: u.active, createdAt: u.created_at
    }));
  }

  async findUserByIdentifier(id: string): Promise<User | null> {
    if (!isSupabaseConfigured) {
      const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      return users.find((u: User) => u.email === id || u.name === id) || null;
    }
    const { data, error } = await supabase.from('app_users').select('*').or(`email.eq.${id},name.eq.${id}`).single();
    if (error || !data) return null;
    return { id: data.id, name: data.name, email: data.email, role: data.role, allowedUnits: data.allowed_units || [], active: data.active, createdAt: data.created_at, passwordHash: data.password_hash };
  }

  async saveUser(u: User): Promise<void> {
    if (!isSupabaseConfigured) {
      const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      if (u.id) {
        const index = users.findIndex((x: any) => x.id === u.id);
        if (index !== -1) {
          // Se estiver editando localmente, preserva a senha antiga se a nova estiver vazia
          const oldPass = users[index].passwordHash;
          users[index] = { ...u, passwordHash: u.passwordHash || oldPass };
        }
      } else {
        const newUser = { ...u, id: generateId(), createdAt: new Date().toISOString() };
        users.push(newUser);
      }
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      return;
    }

    const dbUser: any = {
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      allowed_units: u.allowedUnits
    };

    // Apenas atualiza a senha se ela foi preenchida (evita sobrescrever com vazio)
    if (u.passwordHash) {
      dbUser.password_hash = u.passwordHash;
    }

    if (u.id) {
      const { error } = await supabase.from('app_users').update(dbUser).eq('id', u.id);
      if (error) throw error;
    } else {
      // Garante que novos usuários tenham um ID gerado se o banco não o fizer automaticamente
      dbUser.id = generateId();
      const { error } = await supabase.from('app_users').insert(dbUser);
      if (error) throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const users = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users.filter((u: any) => u.id !== id)));
      return;
    }
    await supabase.from('app_users').delete().eq('id', id);
  }

  async clearAllData(): Promise<void> {
    localStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
    localStorage.removeItem(USERS_STORAGE_KEY);
    localStorage.removeItem('fm_baseline_balance');
    localStorage.removeItem('finance_categories');
    localStorage.removeItem('fm_learned_patterns');

    if (isSupabaseConfigured) {
      await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('app_users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }
  }

  async getUnits(): Promise<string[]> { return [SINGLE_STORE_NAME]; }
}

export const db = new DBService();
