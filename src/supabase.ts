import { createClient } from '@supabase/supabase-js';

// Função auxiliar para acessar variáveis de ambiente de forma segura
// Isso evita o erro "Cannot read properties of undefined" se import.meta.env não estiver definido
const getEnv = (key: string) => {
  // Verificamos explicitamente se import.meta.env existe antes de tentar acessar propriedades.
  // Escrevemos o caminho completo (ex: import.meta.env.VITE_SUPABASE_URL) para que o Vite
  // consiga encontrar e substituir a string estaticamente durante o build.
  
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

// Aviso no console se as chaves estiverem faltando (útil para debug em deploy)
if (!supabaseUrl || !supabaseKey) {
  console.warn(
    'FinanceMaster Pro: Credenciais do Supabase não encontradas. ' +
    'Verifique se o arquivo .env existe ou se as variáveis de ambiente foram configuradas no painel de deploy.'
  );
}

// Cria o cliente com valores de fallback para evitar crash total da aplicação
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder-key'
);
