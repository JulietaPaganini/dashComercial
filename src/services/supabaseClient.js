import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client = null;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase URL or Anon Key is missing! Client will be null.');
} else {
    try {
        client = createClient(supabaseUrl, supabaseAnonKey);
    } catch (e) {
        console.error("Supabase client creation failed:", e);
    }
}

export const supabase = client;
