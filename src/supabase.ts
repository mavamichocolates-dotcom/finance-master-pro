import { createClient } from '@supabase/supabase-js';

// Access environment variables using Vite's standard import.meta.env
// We use optional chaining (?.) to prevent crashes if import.meta.env is undefined in certain environments
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// Warn if keys are missing (helpful for debugging deploy issues)
if (!supabaseUrl || !supabaseKey) {
  console.warn('FinanceMaster Pro: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Database connection will fail.');
}

// Create the client with fallback to prevent build crash
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder-key'
);