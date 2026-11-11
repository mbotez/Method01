/// <reference types="vite/client"/>
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  'https://stbperzlmmslrkdpqawt.supabase.co';

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YnBlcnpsbW1zbHJrZHBxYXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjk5ODMsImV4cCI6MjA5Mjk0NTk4M30.37UW8BgKqbuw8XfcfY3zWWxkVv44_A0nJng0yDsudx8';

// Non-blocking in-process lock function to eliminate navigator.locks deadlocks in mobile webviews and browsers
const nonBlockingLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn();
};

/**
 * Custom fetch with a 25-second safeguard timeout to prevent hanging TCP sockets
 * when returning from background or device sleep.
 */
const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  // Respect caller's abort signal if already provided
  if (init?.signal) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[Supabase Network] Request aborted due to 25s timeout:', input);
      throw new Error('Supabase network request timed out. Please check your internet connection.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
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
    fetch: customFetch,
    headers: {
      'x-client-info': 'canonic-app',
    },
  },
});

let isRecoveringSession = false;
let lastRecoveryTimestamp = 0;

/**
 * Actively checks and recovers the Supabase auth session, auto-refresh state,
 * and Realtime socket after app backgrounding, tab switching, or network changes.
 */
export async function recoverSupabaseSession(forceRefresh: boolean = false): Promise<boolean> {
  const now = Date.now();
  // Prevent hammering recovery if invoked multiple times in rapid succession (within 2 seconds)
  if (isRecoveringSession || (!forceRefresh && now - lastRecoveryTimestamp < 2000)) {
    return true;
  }

  isRecoveringSession = true;
  lastRecoveryTimestamp = now;

  console.log('[Supabase Session] Initiating session and socket health check...');

  try {
    // 1. Ensure auto-refresh timer loop is started
    try {
      supabase.auth.startAutoRefresh();
      console.log('[Supabase Session] Auto-refresh started.');
    } catch (e) {
      console.warn('[Supabase Session] Could not start auto refresh:', e);
    }

    // 2. Fetch current session with a 4-second timeout to prevent hanging on stale locks
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((_, reject) =>
      setTimeout(() => reject(new Error('getSession timed out')), 4000)
    );

    const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);

    if (error) {
      console.warn('[Supabase Session] getSession reported error:', error.message);
    }

    const session = data?.session;

    if (session) {
      const expiresAt = session.expires_at || 0;
      const nowSec = Math.floor(Date.now() / 1000);
      const isExpiredOrClose = expiresAt - nowSec < 180; // Expired or expiring within 3 minutes

      if (isExpiredOrClose || forceRefresh) {
        console.log(`[Supabase Session] Token is ${isExpiredOrClose ? 'stale/expiring' : 'force-refreshing'} (expires in ${expiresAt - nowSec}s). Refreshing now...`);
        const refreshPromise = supabase.auth.refreshSession();
        const refreshTimeout = new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('refreshSession timed out')), 6000)
        );

        const { data: refreshed, error: refreshError } = await Promise.race([refreshPromise, refreshTimeout]);

        if (refreshError) {
          console.error('[Supabase Session] Failed to refresh token:', refreshError.message);
          // If refresh token is explicitly invalid or rejected by Supabase, purge local stale session
          const msg = (refreshError.message || '').toLowerCase();
          if (msg.includes('refresh token') || msg.includes('invalid') || (refreshError as any).status === 400) {
            console.warn('[Supabase Session] Clearing invalid local session to prevent frozen state.');
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          }
          return false;
        }

        console.log('[Supabase Session] Token refreshed successfully. New expiry in:', (refreshed.session?.expires_at || 0) - nowSec, 's');
      } else {
        console.log('[Supabase Session] Active session is valid. Expires in:', expiresAt - nowSec, 's');
      }
    } else {
      console.log('[Supabase Session] No active session found.');
    }

    // 3. Health-check and reconnect Supabase Realtime socket if dropped
    try {
      if (supabase.realtime) {
        const isConnected = (supabase.realtime as any).isConnected?.() ?? true;
        if (!isConnected) {
          console.log('[Supabase Realtime] Realtime socket disconnected during backgrounding. Reconnecting...');
          supabase.realtime.connect();
        }
      }
    } catch (rtErr) {
      console.warn('[Supabase Realtime] Error checking or reconnecting realtime socket:', rtErr);
    }

    return true;
  } catch (err: any) {
    console.error('[Supabase Session] Exception during recoverSupabaseSession:', err.message || err);
    return false;
  } finally {
    isRecoveringSession = false;
  }
}

let listenersInitialized = false;

/**
 * Sets up visibilitychange (web) and appStateChange (Capacitor) listeners
 * so that backgrounding stops auto-refresh and foregrounding recovers auth and network immediately.
 */
export function setupVisibilityAndSessionRecovery(): () => void {
  if (listenersInitialized || typeof window === 'undefined') {
    return () => {};
  }
  listenersInitialized = true;

  console.log('[Supabase Lifecycle] Initializing visibility and appState listeners for session recovery.');

  // 1. Web visibilitychange listener
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('[Supabase Lifecycle] Tab visibility changed to visible. Resuming auth & recovering session...');
      recoverSupabaseSession();
    } else if (document.visibilityState === 'hidden') {
      console.log('[Supabase Lifecycle] Tab visibility changed to hidden. Pausing auto-refresh...');
      try {
        supabase.auth.stopAutoRefresh();
      } catch (e) {
        console.warn('[Supabase Lifecycle] Error stopping auto-refresh on hidden:', e);
      }
    }
  };

  // 2. Window focus & online listeners
  const handleFocus = () => {
    if (document.visibilityState === 'visible') {
      recoverSupabaseSession();
    }
  };

  const handleOnline = () => {
    console.log('[Supabase Lifecycle] Network connection restored (online). Re-establishing session...');
    recoverSupabaseSession(true);
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('online', handleOnline);

  // 3. Capacitor Native App state listener
  let removeCapacitorListener: (() => void) | null = null;
  if (Capacitor.isNativePlatform()) {
    console.log('[Supabase Lifecycle] Running on Native Capacitor platform. Registering App.addListener(appStateChange)...');
    App.addListener('appStateChange', (state) => {
      console.log('[Supabase Lifecycle] Capacitor appStateChange event:', state.isActive ? 'ACTIVE' : 'BACKGROUND');
      if (state.isActive) {
        recoverSupabaseSession();
      } else {
        try {
          supabase.auth.stopAutoRefresh();
        } catch (e) {
          console.warn('[Supabase Lifecycle] Error stopping auto-refresh on native background:', e);
        }
      }
    }).then((listener) => {
      removeCapacitorListener = () => listener.remove();
    }).catch((err) => {
      console.warn('[Supabase Lifecycle] Could not attach Capacitor appStateChange listener:', err);
    });
  }

  // Proactively run once on initial setup
  recoverSupabaseSession();

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('online', handleOnline);
    removeCapacitorListener?.();
    listenersInitialized = false;
  };
}

// Auto-run on module evaluation in browser environment
if (typeof window !== 'undefined') {
  setupVisibilityAndSessionRecovery();
}
