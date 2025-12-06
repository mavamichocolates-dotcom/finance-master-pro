import { createClient } from '@supabase/supabase-js';

// Safely access environment variables
// We use a safe access pattern because in some build environments
// import.meta.env might be undefined during initialization.
const env = (import.meta as any).env || {};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

// Logic to prevent "White Screen" crash if keys are missing.
// We export a client, but warnings will appear in console if config is wrong.
if (!supabaseUrl || !supabaseKey) {
  console.warn('CRITICAL: Supabase Environment Variables are missing. The app will not connect to the database.');
}

// Create the client. If URL is missing, we pass a dummy URL to prevent immediate crash,
// allowing the UI to render (and likely show a connection error later).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseKey || 'placeholder-key'
);