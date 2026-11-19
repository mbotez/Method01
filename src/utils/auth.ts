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
  return window.location.origin + '/auth/callback';
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
let lastHandledUrl = '';

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

  const handleDeepLinkUrl = async (url: string) => {
    if (!url || url === lastHandledUrl) return;
    const isAuthCallback =
      url.startsWith('com.daybreak.canonic://auth-callback') ||
      url.includes('auth-callback');

    if (isAuthCallback) {
      lastHandledUrl = url;

      try {
        const parsedUrl = new URL(url);
        const searchParams = parsedUrl.searchParams;
        const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

        const errorDesc = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error');
        if (errorDesc) {
          const decoded = decodeURIComponent(errorDesc.replace(/\+/g, ' '));
          try { await Browser.close(); } catch {}
          onError?.(decoded);
          return;
        }

        const code = searchParams.get('code') || hashParams.get('code');
        if (code) {
          try { await Browser.close(); } catch {}
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            onError?.(error.message);
          } else if (data?.session) {
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
    console.error('OAuth Error:', decodedError);
    onError?.(decodedError);
    return false;
  }

  const hasAuthCallbackPath = window.location.pathname.includes('/auth/callback');
  const code = urlParams.get('code');
  const hasAuthParams = currentUrl.includes('code=') || currentUrl.includes('access_token=') || code;

  if (hasAuthCallbackPath || hasAuthParams) {
    try {
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('exchangeCodeForSession error:', { message: error.message, code: (error as any).code, details: (error as any).details });
          onError?.(error.message);
          return false;
        }
        if (data?.session) {
          window.history.replaceState(null, '', '/dashboard');
          onSuccess?.();
          return true;
        }
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('getSession error:', { message: sessionError.message, code: (sessionError as any).code, details: (sessionError as any).details });
      }
      if (sessionData?.session) {
        window.history.replaceState(null, '', '/dashboard');
        onSuccess?.();
        return true;
      }
    } catch (err: any) {
      console.error('Auth callback exception:', err);
      onError?.(err?.message || 'Authentication processing error');
      return false;
    }
  }

  return false;
};