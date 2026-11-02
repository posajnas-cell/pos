import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || (import.meta.env as any).SUPABASE_URL || '') as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || (import.meta.env as any).SUPABASE_ANON_KEY || '') as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('BillFlow: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Operating in offline/API mode.');
}

/**
 * Supabase browser client.
 * Safe fallback: will instantiate if credentials are provided without crashing the app.
 */
export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
