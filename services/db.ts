import { supabase, isSupabaseConfigured } from '../src/supabase';
import { Transaction, User, UserRole, TransactionType, PaymentStatus } from '../types';
import { UNITS } from '../constants';
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
  installments_current: number | null;
  installments_total: number | null;
  created_at: string;
}

// --- LOCAL STORAGE HELPERS (Offline Mode) ---
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
  
  // --- USERS ---
  
  async getUsers(): Promise<User[]> {
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const localUsers = getLocal<User>(LOCAL_KEYS.USERS);
      return localUsers;
    }
    
    // SUPABASE
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('name');

    if (error) {
      // STRICT CHECK: If table doesn't exist, throw specific error to trigger Setup Screen
      if (error.code === '42P01') throw new Error("MISSING_TABLES");
      
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
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const users = getLocal<User>(LOCAL_KEYS.USERS);
      
      if (user.id && user.id.length > 5) {
        // Update
        const index = users.findIndex(u => u.id === user.id);
        if (index !== -1) {
          users[index] = { ...user };
          setLocal(LOCAL_KEYS.USERS, users);
          return user;
        }
      } 
      
      // Insert
      const newUser = { 
        ...user, 
        id: generateId(), 
        createdAt: new Date().toISOString() 
      };
      users.push(newUser);
      setLocal(LOCAL_KEYS.USERS, users);
      return newUser;
    }

    // SUPABASE
    
    // Logic: If ID exists and is long enough, it's an update. 
    // If not, generate a new ID for the insert.
    const isUpdate = user.id && user.id.length > 10;
    const finalId = isUpdate ? user.id : generateId();

    const dbUser: any = {
      name: user.name,
      email: user.email,
      password_hash: user.passwordHash,
      role: user.role,
      allowed_units: user.allowedUnits || [],
      active: user.active
    };

    if (isUpdate) { 
      const { data, error } = await supabase
        .from('app_users')
        .update(dbUser)
        .eq('id', user.id)
        .select()
        .single();
        
      if (error) throw error;
      return { ...user, id: data.id };
    } 
    else {
      // For Insert, we MUST include the ID
      dbUser.id = finalId;
      
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
    if (!isSupabaseConfigured) {
      const users = getLocal<User>(LOCAL_KEYS.USERS);
      const filtered = users.filter(u => u.id !== id);
      setLocal(LOCAL_KEYS.USERS, filtered);
      return;
    }

    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) throw error;
  }

  async findUserByIdentifier(identifier: string): Promise<User | null> {
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const users = getLocal<User>(LOCAL_KEYS.USERS);
      const found = users.find(u => u.email === identifier || u.name === identifier);
      return found || null;
    }

    // SUPABASE
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .or(`email.eq.${identifier},name.eq.${identifier}`)
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
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      return getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS).sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    // SUPABASE
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      // STRICT CHECK: If table doesn't exist, throw specific error to trigger Setup Screen
      if (error.code === '42P01') throw new Error("MISSING_TABLES");

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

  async addTransaction(t: Transaction): Promise<Transaction | null> {
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const txs = getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS);
      const newTx = { ...t, id: generateId(), createdAt: new Date().toISOString() };
      txs.push(newTx);
      setLocal(LOCAL_KEYS.TRANSACTIONS, txs);
      return newTx;
    }

    // SUPABASE
    const validUserId = t.userId === 'master-override' ? null : t.userId;
    const dbTx = {
      id: t.id, // CRITICAL FIX: Explicitly send the ID generated by the Form
      user_id: validUserId,
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

    if (error) throw error;
    
    return { ...t, id: data.id, createdAt: data.created_at };
  }

  async updateTransaction(t: Transaction): Promise<void> {
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const txs = getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS);
      const index = txs.findIndex(x => x.id === t.id);
      if (index !== -1) {
        txs[index] = t;
        setLocal(LOCAL_KEYS.TRANSACTIONS, txs);
      }
      return;
    }

    // SUPABASE
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
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const txs = getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS);
      const filtered = txs.filter(t => t.id !== id);
      setLocal(LOCAL_KEYS.TRANSACTIONS, filtered);
      return;
    }

    // SUPABASE
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  }

  async deleteTransactions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const txs = getLocal<Transaction>(LOCAL_KEYS.TRANSACTIONS);
      const filtered = txs.filter(t => !ids.includes(t.id));
      setLocal(LOCAL_KEYS.TRANSACTIONS, filtered);
      return;
    }

    // SUPABASE
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) throw error;
  }

  // --- STORES/UNITS ---

  async getUnits(): Promise<string[]> {
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const localStores = getLocal<{name: string}>(LOCAL_KEYS.STORES);
      if (localStores.length === 0) {
        // Init default stores in local storage
        const defaults = UNITS.map(u => ({ name: u }));
        setLocal(LOCAL_KEYS.STORES, defaults);
        return UNITS;
      }
      return localStores.map(s => s.name);
    }

    // SUPABASE
    try {
      const { data, error } = await supabase.from('stores').select('name');
      
      if (error) {
        // DETECT TABLE NOT FOUND ERROR (42P01)
        // This allows the App to show the Setup Screen
        if (error.code === '42P01') {
           throw new Error("MISSING_TABLES");
        }
        console.error("Erro ao buscar lojas (Supabase):", error);
        return UNITS; 
      }
      
      if (data && data.length === 0) {
        const { error: insertError } = await supabase
          .from('stores')
          .insert(UNITS.map(name => ({ name })));
        
        if (!insertError) return UNITS;
      }

      const storeNames = data.map((s: any) => s.name);
      return storeNames.length > 0 ? storeNames : UNITS;
    } catch (e: any) {
      if (e.message === "MISSING_TABLES") throw e; // Re-throw to be caught by App.tsx
      return UNITS;
    }
  }

  async addUnit(name: string): Promise<void> {
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const stores = getLocal<{name: string}>(LOCAL_KEYS.STORES);
      stores.push({ name });
      setLocal(LOCAL_KEYS.STORES, stores);
      return;
    }

    // SUPABASE
    const { error } = await supabase.from('stores').insert({ name });
    if (error) throw error;
  }

  async deleteUnit(name: string): Promise<void> {
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      const stores = getLocal<{name: string}>(LOCAL_KEYS.STORES);
      const filtered = stores.filter(s => s.name !== name);
      setLocal(LOCAL_KEYS.STORES, filtered);
      return;
    }

    // SUPABASE
    await supabase.from('stores').delete().eq('name', name);
  }

  // --- DANGER ZONE ---
  
  async clearAllData(): Promise<void> {
    // FALLBACK LOCAL
    if (!isSupabaseConfigured) {
      localStorage.removeItem(LOCAL_KEYS.TRANSACTIONS);
      localStorage.removeItem(LOCAL_KEYS.USERS);
      localStorage.removeItem(LOCAL_KEYS.STORES);
      return;
    }

    // SUPABASE
    if (!isSupabaseConfigured) throw new Error("Banco de dados não configurado.");

    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (txError) throw new Error(`Erro ao limpar transações: ${txError.message}`);

    const { error: uError } = await supabase
      .from('app_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (uError) throw new Error(`Erro ao limpar usuários: ${uError.message}`);

    const { error: sError } = await supabase
      .from('stores')
      .delete()
      .neq('name', 'PLACEHOLDER_IMPOSSIBLE_NAME');

    if (sError) throw new Error(`Erro ao limpar lojas: ${sError.message}`);
  }
}

export const db = new DBService();