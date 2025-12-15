import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO SUPABASE ---
const PROJECT_URL = 'https://ifikpzvkauaxybtvnuaj.supabase.co';
const PROJECT_KEY = 'sb_publishable_uBw-iDD2WZX-bf1vSZ2Nyg_wtHWx6zP';

// Verifica se as credenciais parecem válidas
export const isSupabaseConfigured = !!PROJECT_URL && !!PROJECT_KEY;

if (isSupabaseConfigured) {
  console.log('FinanceMaster Pro: Conexão Supabase Iniciada.');
} else {
  console.warn('FinanceMaster Pro: Credenciais do Supabase ausentes.');
}

// Inicializa o cliente Supabase
export const supabase = createClient(
  PROJECT_URL || 'https://placeholder.supabase.co',
  PROJECT_KEY || 'placeholder'
);