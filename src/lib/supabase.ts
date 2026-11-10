/// <reference types="vite/client"/>
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://stbperzlmmslrkdpqawt.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YnBlcnpsbW1zbHJrZHBxYXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjk5ODMsImV4cCI6MjA5Mjk0NTk4M30.37UW8BgKqbuw8XfcfY3zWWxkVv44_A0nJng0yDsudx8';

// Non-blocking in-process lock function to eliminate navigator.locks deadlocks in mobile webviews and browsers
const nonBlockingLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn();
};

// Singleton Supabase client instance used throughout the entire app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: nonBlockingLock,
  },
  global: {
    headers: {
      'x-client-info': 'canonic-app',
    },
  },
});

