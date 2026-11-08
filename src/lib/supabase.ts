/// <reference types="vite/client"/>
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 'placeholder-anon-key';

// Clean up any stale/orphaned auth tokens from localStorage to prevent invalid refresh token errors
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('sb-') && key.includes('-auth-token')) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors in restrictive environments
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  }
});
