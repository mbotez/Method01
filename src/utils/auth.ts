import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { supabase } from '../lib/supabase';

/**
 * Detect whether the app is running natively on mobile using Capacitor.
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Set the OAuth redirect URL dynamically:
 *    - For native mobile: "com.daybreak.canonic://auth-callback"
 *    - For web: `${window.location.origin}/auth/callback`
 */
export const getOAuthRedirectUrl = (): string => {
  if (isNativePlatform()) {
    return 'com.daybreak.canonic://auth-callback';
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/auth/callback`;
};

/**
 * Resolves the appropriate API endpoint URL depending on the platform (Web vs Capacitor native).
 */
export const getApiEndpoint = (endpointPath: string): string => {
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  
  const envBase = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) || '';
  if (envBase) {
    return `${envBase.replace(/\/+$/, '')}${cleanPath}`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (!origin.startsWith('capacitor://') && !origin.startsWith('ionic://')) {
      return cleanPath;
    }
  }

  const appUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_APP_URL) || '';
  if (appUrl) {
    return `${appUrl.replace(/\/+$/, '')}${cleanPath}`;
  }

  return cleanPath;
};

/**
 * Call supabase.auth.signInWithOAuth using provider 'google' and PKCE flow.
 */
export const signInWithGoogle = async () => {
  const redirectTo = getOAuthRedirectUrl();
  console.log('[Auth] Initiating Google sign in with redirectTo:', redirectTo);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    console.error("Supabase OAuth Error:", error);
    throw error;
  }

  return data;
};

/**
 * Set up deep link token handling for Capacitor (using App.addListener('appUrlOpen', ...))
 * for PKCE / OAuth redirect callbacks.
 */
export const setupCapacitorDeepLinkAuth = (
  onSuccess?: () => void,
  onError?: (errorMessage: string) => void
): (() => void) => {
  if (!isNativePlatform()) {
    return () => {};
  }

  const handleDeepLinkUrl = async (url: string) => {
    if (!url) return;
    const isAuthCallback =
      url.startsWith('com.daybreak.canonic://auth-callback') ||
      url.includes('auth-callback');

    if (isAuthCallback) {
      console.log('[Auth] Capacitor deep link auth callback received:', url);
      // With detectSessionInUrl: true, supabase client handles code exchange automatically.
      // We check session validity after a brief moment or trigger success callback.
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        onSuccess?.();
      } else {
        onError?.('Failed to establish session from deep link');
      }
    }
  };

  App.getLaunchUrl()
    .then((launchUrl) => {
      if (launchUrl?.url) {
        handleDeepLinkUrl(launchUrl.url);
      }
    })
    .catch(() => {});

  const listenerPromise = App.addListener('appUrlOpen', async (data: URLOpenListenerEvent) => {
    await handleDeepLinkUrl(data.url);
  });

  return () => {
    listenerPromise.then((listener) => listener.remove()).catch(() => {});
  };
};

/**
 * Handles web OAuth callback when landing on `/auth/callback`.
 * With detectSessionInUrl: true and PKCE enabled, Supabase client automatically
 * exchanges the code. We verify the session and clean up the URL history.
 */
export const handleWebAuthCallback = async (
  onSuccess?: () => void,
  onError?: (errorMessage: string) => void
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const currentUrl = window.location.href;
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  
  const errorDescription = urlParams.get('error_description') || hashParams.get('error_description') || urlParams.get('error') || hashParams.get('error');
  if (errorDescription) {
    const decodedError = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
    console.error('[Auth] OAuth error in URL:', decodedError);
    onError?.(decodedError);
    return false;
  }

  const hasAuthCallbackPath = window.location.pathname.includes('/auth/callback');
  const hasAuthParams = currentUrl.includes('code=') || currentUrl.includes('access_token=');

  if (hasAuthCallbackPath || hasAuthParams) {
    console.log('[Auth] Handling web auth callback/params via onAuthStateChange');
    
    return new Promise((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          console.log('[Auth] Web auth callback SIGNED_IN event received for:', session.user.email);
          subscription.unsubscribe();
          window.history.replaceState(null, '', '/dashboard');
          onSuccess?.();
          resolve(true);
        }
      });

      supabase.auth.getSession().then(({ data }) => {
        if (data?.session) {
          subscription.unsubscribe();
          window.history.replaceState(null, '', '/dashboard');
          onSuccess?.();
          resolve(true);
        }
      });
    });
  }

  return false;
};