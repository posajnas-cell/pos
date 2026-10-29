import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables",
  );
}

/**
 * Supabase server client (anon key).
 * For privileged operations, provide a service-role key as the second argument.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
