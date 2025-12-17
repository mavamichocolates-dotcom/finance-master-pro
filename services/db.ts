
import { supabase, isSupabaseConfigured } from '../src/supabase';
import { Transaction, User, UserRole, TransactionType, PaymentStatus } from '../types';
import { SINGLE_STORE_NAME } from '../constants';
import { generateId } from '../utils';

class DBService {
  
  async getTransactions(): Promise<Transaction[]> {
    if (!isSupabaseConfigured) {
      const data = localStorage.getItem('fm_local_transactions');
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
      createdAt: t.created_at
    }));
  }

  async addTransaction(t: Transaction): Promise<Transaction | null> {
    if (!isSupabaseConfigured) {
      const txs = JSON.parse(localStorage.getItem('fm_local_transactions') || '[]');
      const newTx = { ...t, id: generateId(), createdAt: new Date().toISOString() };
      txs.push(newTx);
      localStorage.setItem('fm_local_transactions', JSON.stringify(txs));
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
      reviewed: !!t.reviewed
    };

    const { data, error } = await supabase.from('transactions').insert(dbTx).select().single();
    if (error) throw error;
    return { ...t, id: data.id, createdAt: data.created_at };
  }

  async updateTransaction(t: Transaction): Promise<void> {
    if (!isSupabaseConfigured) {
      const txs = JSON.parse(localStorage.getItem('fm_local_transactions') || '[]');
      const index = txs.findIndex((x: any) => x.id === t.id);
      if (index !== -1) { txs[index] = t; localStorage.setItem('fm_local_transactions', JSON.stringify(txs)); }
      return;
    }

    const dbTx = {
      description: t.description, 
      amount: t.amount, 
      type: t.type, 
      category: t.category, 
      date: t.date, 
      status: t.status, 
      reviewed: !!t.reviewed
    };

    const { error } = await supabase.from('transactions').update(dbTx).eq('id', t.id);
    if (error) throw error;
  }

  async deleteTransaction(id: string): Promise<void> {
    if (!isSupabaseConfigured) {
      const txs = JSON.parse(localStorage.getItem('fm_local_transactions') || '[]');
      localStorage.setItem('fm_local_transactions', JSON.stringify(txs.filter((t: any) => t.id !== id)));
      return;
    }
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  }

  async getUsers(): Promise<User[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase.from('app_users').select('*');
    if (error) return [];
    return (data || []).map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role, allowedUnits: [], active: u.active, createdAt: u.created_at
    }));
  }

  async findUserByIdentifier(id: string): Promise<User | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.from('app_users').select('*').or(`email.eq.${id},name.eq.${id}`).single();
    if (error || !data) return null;
    return { id: data.id, name: data.name, email: data.email, role: data.role, allowedUnits: [], active: data.active, createdAt: data.created_at, passwordHash: data.password_hash };
  }

  async saveUser(u: User): Promise<void> {
    if (!isSupabaseConfigured) return;
    const dbUser = {
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      password_hash: u.passwordHash
    };
    if (u.id) {
      await supabase.from('app_users').update(dbUser).eq('id', u.id);
    } else {
      await supabase.from('app_users').insert(dbUser);
    }
  }

  async deleteUser(id: string): Promise<void> {
    if (!isSupabaseConfigured) return;
    await supabase.from('app_users').delete().eq('id', id);
  }

  async clearAllData(): Promise<void> {
    // 1. Limpar LocalStorage
    localStorage.removeItem('fm_local_transactions');
    localStorage.removeItem('fm_baseline_balance');
    localStorage.removeItem('finance_categories');
    localStorage.removeItem('fm_learned_patterns');

    // 2. Limpar Nuvem (Se configurado)
    if (isSupabaseConfigured) {
      // Deletar transações (CUIDADO: Isso limpa a tabela inteira)
      const { error: txError } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (txError) console.error("Erro ao limpar transações na nuvem", txError);
    }
  }

  async getUnits(): Promise<string[]> { return [SINGLE_STORE_NAME]; }
}

export const db = new DBService();
