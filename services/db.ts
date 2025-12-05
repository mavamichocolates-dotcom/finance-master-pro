import { supabase } from '../src/supabase';
import { Transaction, User, UserRole, TransactionType, PaymentStatus } from '../types';
import { UNITS } from '../constants';

// --- TYPES MAPPING ---
// Interfaces to match Supabase DB columns (snake_case)
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
  store_name: string; // mapped to 'unit' in app
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  status: PaymentStatus;
  installments_current: number | null;
  installments_total: number | null;
  created_at: string;
}

interface DBStore {
  id: string;
  name: string;
}

class DBService {
  // --- USERS ---
  
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    return (data as DBUser[]).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      allowedUnits: u.allowed_units || [],
      active: u.active,
      createdAt: u.created_at,
      passwordHash: u.password_hash
    }));
  }

  async saveUser(user: User): Promise<User | null> {
    const dbUser = {
      name: user.name,
      email: user.email,
      password_hash: user.passwordHash,
      role: user.role,
      allowed_units: user.allowedUnits,
      active: user.active
    };

    if (user.id && user.id.length > 10) { 
      // Update existing (UUID check roughly)
      const { data, error } = await supabase
        .from('app_users')
        .update(dbUser)
        .eq('id', user.id)
        .select()
        .single();
        
      if (error) throw error;
      return { ...user, id: data.id };
    } else {
      // Create new
      const { data, error } = await supabase
        .from('app_users')
        .insert(dbUser)
        .select()
        .single();

      if (error) throw error;
      return { ...user, id: data.id, createdAt: data.created_at };
    }
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) throw error;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;

    const u = data as DBUser;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      allowedUnits: u.allowed_units || [],
      active: u.active,
      createdAt: u.created_at,
      passwordHash: u.password_hash
    };
  }

  // --- TRANSACTIONS ---

  async getTransactions(): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return (data as DBTransaction[]).map(t => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      category: t.category,
      date: t.date,
      status: t.status,
      installments: (t.installments_current && t.installments_total) ? {
        current: t.installments_current,
        total: t.installments_total
      } : undefined,
      unit: t.store_name,
      userId: t.user_id,
      createdAt: t.created_at
    }));
  }

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    // This method is now mostly used for bulk inserts or updates
    // In the new App.tsx, we will likely insert one by one or batch insert new ones
    // For compatibility with the old code structure which passed the WHOLE array:
    // We should prefer specific methods: insertTransaction, updateTransaction, deleteTransaction
    // But to adapt the code provided:
    console.warn("Bulk saveTransactions is deprecated in Online Mode. Use specific methods.");
  }

  async addTransaction(t: Transaction): Promise<Transaction | null> {
    const dbTx = {
      user_id: t.userId,
      store_name: t.unit,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category,
      date: t.date,
      status: t.status,
      installments_current: t.installments?.current || null,
      installments_total: t.installments?.total || null
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert(dbTx)
      .select()
      .single();

    if (error) {
      console.error(error);
      throw error;
    }
    
    return { ...t, id: data.id, createdAt: data.created_at };
  }

  async updateTransaction(t: Transaction): Promise<void> {
    const dbTx = {
      store_name: t.unit,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category,
      date: t.date,
      status: t.status,
    };

    const { error } = await supabase
      .from('transactions')
      .update(dbTx)
      .eq('id', t.id);

    if (error) throw error;
  }

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  }

  // --- STORES/UNITS ---

  async getUnits(): Promise<string[]> {
    const { data, error } = await supabase.from('stores').select('name');
    if (error) {
      return UNITS; // Fallback
    }
    const storeNames = data.map((s: any) => s.name);
    return storeNames.length > 0 ? storeNames : UNITS;
  }

  async addUnit(name: string): Promise<void> {
    await supabase.from('stores').insert({ name });
  }

  async deleteUnit(name: string): Promise<void> {
    await supabase.from('stores').delete().eq('name', name);
  }
}

export const db = new DBService();