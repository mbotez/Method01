import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from '../lib/supabase';

/**
 * Detect whether the app is running natively on mobile using Capacitor.
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * API base constant: Vercel URL when Capacitor.isNativePlatform(), otherwise an empty string.
 */
export const API_BASE = isNativePlatform() ? 'https://www.canonic.co.uk' : '';

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
  return `${API_BASE}${cleanPath}`;
};

/**
 * Call supabase.auth.signInWithOAuth using provider 'google' and PKCE flow.
 * For Capacitor native, uses skipBrowserRedirect: true and opens Browser.open(data.url).
 */
export const signInWithGoogle = async () => {
  const redirectTo = getOAuthRedirectUrl();
  console.log('[Auth] Initiating Google sign in with redirectTo:', redirectTo);
  
  const options: any = {
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  };

  if (isNativePlatform()) {
    options.options.skipBrowserRedirect = true;
  }

  const { data, error } = await supabase.auth.signInWithOAuth(options);

  if (error) {
    console.error("Supabase OAuth Error:", error);
    throw error;
  }

  if (isNativePlatform() && data?.url) {
    await Browser.open({ url: data.url });
  }

  return data;
};

/**
 * Set up deep link token handling for Capacitor (using App.addListener('appUrlOpen', ...))
 * for PKCE / OAuth redirect callbacks. Parses code, handles error_description, closes Browser,
 * calls supabase.auth.exchangeCodeForSession(code), and guards against handling the same URL twice.
 */
export const setupCapacitorDeepLinkAuth = (
  onSuccess?: () => void,
  onError?: (errorMessage: string) => void
): (() => void) => {
  if (!isNativePlatform()) {
    return () => {};
  }

  let lastHandledUrl = '';

  const handleDeepLinkUrl = async (url: string) => {
    if (!url || url === lastHandledUrl) return;
    const isAuthCallback =
      url.startsWith('com.daybreak.canonic://auth-callback') ||
      url.includes('auth-callback');

    if (isAuthCallback) {
      lastHandledUrl = url;
      console.log('[Auth] Capacitor deep link auth callback received:', url);

      try {
        const parsedUrl = new URL(url);
        const searchParams = parsedUrl.searchParams;
        const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

        const errorDesc = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error');
        if (errorDesc) {
          const decoded = decodeURIComponent(errorDesc.replace(/\+/g, ' '));
          console.error('[Auth] OAuth error in deep link:', decoded);
          try { await Browser.close(); } catch {}
          onError?.(decoded);
          return;
        }

        const code = searchParams.get('code') || hashParams.get('code');
        if (code) {
          try { await Browser.close(); } catch {}
          console.log('[Auth] Exchanging code for session...');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[Auth] exchangeCodeForSession error:', error);
            onError?.(error.message);
          } else if (data?.session) {
            console.log('[Auth] Session established successfully via code exchange for:', data.session.user.email);
            onSuccess?.();
          } else {
            onError?.('Failed to establish session from code');
          }
        } else {
          try { await Browser.close(); } catch {}
          const { data } = await supabase.auth.getSession();
          if (data?.session) {
            onSuccess?.();
          } else {
            onError?.('No authorization code found in redirect URL');
          }
        }
      } catch (err: any) {
        try { await Browser.close(); } catch {}
        console.error('[Auth] Error handling deep link:', err);
        onError?.(err?.message || 'Authentication error');
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
    lastHandledUrl = '';
    listenerPromise.then((listener) => listener.remove()).catch(() => {});
  };
};

/**
 * Handles web OAuth callback when landing on `/auth/callback`.
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