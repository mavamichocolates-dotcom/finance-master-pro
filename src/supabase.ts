import { createClient } from '@supabase/supabase-js';

// Função auxiliar para acessar variáveis de ambiente de forma segura
const getEnv = (key: string) => {
  if (key === 'VITE_SUPABASE_URL') {
    return (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
  }
  if (key === 'VITE_SUPABASE_ANON_KEY') {
    return (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Lógica rigorosa para definir se o Supabase está realmente configurado
const isUrlValid = (url: string) => {
  return url && 
         url !== 'undefined' && 
         !url.includes('placeholder') && 
         url.startsWith('http');
};

export const isSupabaseConfigured = isUrlValid(supabaseUrl) && !!supabaseKey;

// Log discreto apenas para dev
if (!isSupabaseConfigured) {
  console.log('FinanceMaster Pro: Modo Offline/Local Ativado (Supabase não configurado).');
}

// Cria o cliente. Se não estiver configurado, usamos null ou um cliente dummy
// para garantir que a exportação exista, mas o db.ts vai ignorá-la.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co', 
  isSupabaseConfigured ? supabaseKey : 'placeholder-key'
);