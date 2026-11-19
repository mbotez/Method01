/// <reference types="vite/client"/>
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);
const supabaseAnonKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable.');
}
if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable.');
}



/**
 * Custom fetch with a 25-second safeguard timeout to prevent hanging TCP sockets
 * when returning from background or device sleep.
 */
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.signal) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Supabase network request timed out. Please check your internet connection.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

// Singleton Supabase client instance with pass-through lock to completely eliminate navigator.locks deadlocks
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    fetch: customFetch,
    headers: {
      'x-client-info': 'canonic-app',
    },
  },
});

// Expose to window for easy debugging in the browser console
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
}

let isRecoveringSession = false;
let lastRecoveryTimestamp = 0;

/**
 * Actively checks and recovers the Supabase auth session, auto-refresh state,
 * and Realtime socket after app backgrounding, tab switching, or network changes.
 */
export async function recoverSupabaseSession(forceRefresh: boolean = false): Promise<boolean> {
  const now = Date.now();
  if (isRecoveringSession || (!forceRefresh && now - lastRecoveryTimestamp < 2000)) {
    return true;
  }

  isRecoveringSession = true;
  lastRecoveryTimestamp = now;


  try {
    try {
      supabase.auth.startAutoRefresh();
    } catch (e) {
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
    }

    const session = sessionData?.session;
    if (session) {
      const expiresAt = session.expires_at || 0;
      const nowSec = Math.floor(Date.now() / 1000);
      const isExpiredOrClose = expiresAt - nowSec < 180;

      if (isExpiredOrClose || forceRefresh) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          const msg = (refreshError.message || '').toLowerCase();
          if (msg.includes('refresh token') || msg.includes('invalid') || (refreshError as any).status === 400) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
          return false;
        }
      }
    }

    try {
      if (supabase.realtime) {
        const isConnected = (supabase.realtime as any).isConnected?.() ?? true;
        if (!isConnected) {
          supabase.realtime.connect();
        }
      }
    } catch (rtErr) {
    }

    return true;
  } catch (err: any) {
    return false;
  } finally {
    isRecoveringSession = false;
  }
}

let listenersInitialized = false;

export function setupVisibilityAndSessionRecovery(): () => void {
  if (listenersInitialized || typeof window === 'undefined') {
    return () => {};
  }
  listenersInitialized = true;

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      recoverSupabaseSession();
    } else if (document.visibilityState === 'hidden') {
      try {
        supabase.auth.stopAutoRefresh();
      } catch (e) {}
    }
  };

  const handleFocus = () => {
    if (document.visibilityState === 'visible') {
      recoverSupabaseSession();
    }
  };

  const handleOnline = () => {
    recoverSupabaseSession(true);
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('online', handleOnline);

  let removeCapacitorListener: (() => void) | null = null;
  if (Capacitor.isNativePlatform()) {
    App.addListener('appStateChange', (state) => {
      if (state.isActive) {
        recoverSupabaseSession();
      } else {
        try {
          supabase.auth.stopAutoRefresh();
        } catch (e) {}
      }
    }).then((listener) => {
      removeCapacitorListener = () => listener.remove();
    }).catch(() => {});
  }

  recoverSupabaseSession();

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('online', handleOnline);
    removeCapacitorListener?.();
    listenersInitialized = false;
  };
}

if (typeof window !== 'undefined') {
  setupVisibilityAndSessionRecovery();
}



