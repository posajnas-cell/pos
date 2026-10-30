// Supabase client helper (optional)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const getSupabase = async () => {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    const { createClient } = await (Function('return import("@supabase/supabase-js")')() as Promise<any>);
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch {
    return null;
  }
};

