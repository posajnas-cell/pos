import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file',
  );
}

/**
 * Supabase browser client.
 * Use this for auth, storage, realtime subscriptions and direct table access.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
