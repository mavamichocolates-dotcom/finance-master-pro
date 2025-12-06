import { createClient } from '@supabase/supabase-js';

// Access environment variables safely.
// We cast import.meta to any to avoid TypeScript errors if vite/client types are missing or not configured in tsconfig.
const env = (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase Environment Variables are missing. Check your .env file or Vercel settings.');
}

// Create client with fallback empty strings to prevent crash, though API calls will fail if keys are missing
export const supabase = createClient(supabaseUrl || '', supabaseKey || '');