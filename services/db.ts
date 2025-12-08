import { supabase } from '../src/supabase';
import { Transaction, User, UserRole, TransactionType, PaymentStatus } from '../types';
import { UNITS } from '../constants';

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

class DBService {
  // --- USERS ---
  
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching users:', error);
      // Retorna vazio para não quebrar a UI se a tabela não existir
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
    const dbUser: any = {
      name: user.name,
      email: user.email,
      password_hash: user.passwordHash,
      role: user.role,
      allowed_units: user.allowedUnits || [],
      active: user.active
    };

    // UPDATE
    if (user.id && user.id.length > 10) { 
      const { data, error } = await supabase
        .from('app_users')
        .update(dbUser)
        .eq('id', user.id)
        .select()
        .single();
        
      if (error) {
        console.error("DB Update Error:", error);
        throw error;
      }
      return { ...user, id: data.id };
    } 
    // CREATE (Insert)
    else {
      // Nota: Não enviamos 'id' no dbUser, o Supabase gera o UUID automaticamente.
      const { data, error } = await supabase
        .from('app_users')
        .insert(dbUser)
        .select()
        .single();

      if (error) {
        console.error("DB Insert Error:", error);
        throw error;
      }
      return { ...user, id: data.id, createdAt: data.created_at };
    }
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await supabase.from('app_users').delete().eq('id', id);
    if (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  }

  // BUSCA POR NOME OU EMAIL (Para login flexível)
  async findUserByIdentifier(identifier: string): Promise<User | null> {
    // Tenta buscar por email OU nome
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

  async addTransaction(t: Transaction): Promise<Transaction | null> {
    // Se for o usuário mestre (id fake), não enviamos userId para o banco para não quebrar FK
    const validUserId = t.userId === 'master-override' ? null : t.userId;

    const dbTx = {
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

    if (error) {
      // Propaga o erro para o App.tsx tratar com mensagens amigáveis
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
    
    // CORREÇÃO CRÍTICA: Se a tabela estiver vazia (pós-reset), criar as lojas padrão
    // Isso evita o erro de Chave Estrangeira (Foreign Key) ao tentar salvar transações
    if (!error && data && data.length === 0) {
      console.log("Banco de lojas vazio detectado. Restaurando lojas padrão...");
      const { error: insertError } = await supabase
        .from('stores')
        .insert(UNITS.map(name => ({ name })));
      
      if (!insertError) {
        return UNITS;
      } else {
        console.error("Erro ao restaurar lojas padrão:", insertError);
      }
    }

    if (error) {
      console.error("Erro ao buscar lojas:", error);
      return UNITS; // Fallback visual
    }
    
    const storeNames = data.map((s: any) => s.name);
    return storeNames.length > 0 ? storeNames : UNITS;
  }

  async addUnit(name: string): Promise<void> {
    const { error } = await supabase.from('stores').insert({ name });
    if (error) throw error;
  }

  async deleteUnit(name: string): Promise<void> {
    await supabase.from('stores').delete().eq('name', name);
  }

  // --- DANGER ZONE ---
  
  async clearAllData(): Promise<void> {
    // Nota: O método .delete() do supabase exige um filtro para segurança.
    // Usamos neq('id', 0) para simular um "delete all" seguro.
    
    // 1. Limpar transações
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // UUID vazio padrão como filtro "tudo exceto isso"
    
    if (txError) throw new Error(`Erro ao limpar transações: ${txError.message}`);

    // 2. Limpar usuários
    const { error: uError } = await supabase
      .from('app_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (uError) throw new Error(`Erro ao limpar usuários: ${uError.message}`);

    // 3. Limpar Lojas
    const { error: sError } = await supabase
      .from('stores')
      .delete()
      .neq('name', 'PLACEHOLDER_IMPOSSIBLE_NAME'); // Filtro genérico para lojas

    if (sError) throw new Error(`Erro ao limpar lojas: ${sError.message}`);
  }
}

export const db = new DBService();