import { createClient } from '@supabase/supabase-js';

// Função auxiliar para acessar variáveis de ambiente de forma segura
// Agora suporta tanto VITE_ quanto NEXT_PUBLIC_ para facilitar a configuração
const getEnv = (key: string, fallbackKey?: string) => {
  const viteVar = import.meta.env && import.meta.env[key];
  if (viteVar) return viteVar;
  
  if (fallbackKey) {
    const nextVar = import.meta.env && import.meta.env[fallbackKey];
    if (nextVar) return nextVar;
  }
  
  return '';
};

// --- DADOS DE INTEGRAÇÃO FORNECIDOS ---
const PROJECT_URL = 'https://ifikpzvkauaxybtvnuaj.supabase.co';
const PROJECT_KEY = 'sb_publishable_uBw-iDD2WZX-bf1vSZ2Nyg_wtHWx6zP';

// Tenta buscar VITE_, se não achar, usa os dados hardcoded do projeto
const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL') || PROJECT_URL;
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY') || PROJECT_KEY;

// Lógica rigorosa para definir se o Supabase está realmente configurado
const isUrlValid = (url: string) => {
  return url && 
         url !== 'undefined' && 
         !url.includes('placeholder') && 
         url.startsWith('http');
};

// Verifica se a chave parece correta
const isKeyValid = (key: string) => {
  if (!key || key === 'undefined' || key.includes('placeholder')) return false;
  
  // Aviso amigável para o desenvolvedor no console (silenciado para a chave do projeto atual)
  if (key.startsWith('sb_publishable') && key !== PROJECT_KEY) {
    console.warn('⚠️ ALERTA FINANCE MASTER: A chave informada parece ser uma "Publishable Key" genérica e não a "Anon Key". Se a conexão falhar, verifique em Project Settings > API e use a chave "anon" que começa com "ey..."');
  }
  return true;
};

export const isSupabaseConfigured = isUrlValid(supabaseUrl) && isKeyValid(supabaseKey);

// Log discreto apenas para dev
if (!isSupabaseConfigured) {
  console.log('FinanceMaster Pro: Modo Offline/Local Ativado (Supabase não configurado corretamente).');
  console.log('Status URL:', isUrlValid(supabaseUrl) ? 'OK' : 'Inválida');
  console.log('Status Key:', isKeyValid(supabaseKey) ? 'OK' : 'Inválida/Ausente');
} else {
  console.log('FinanceMaster Pro: Conectado à nuvem.');
}

// Cria o cliente. Se não estiver configurado, usamos null ou um cliente dummy
// para garantir que a exportação exista, mas o db.ts vai ignorá-la.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co', 
  isSupabaseConfigured ? supabaseKey : 'placeholder-key'
);
