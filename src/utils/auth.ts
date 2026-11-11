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

export interface AuthTokens {
  code?: string;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Parses the authorization code (PKCE) or tokens from the URL query and hash parameters.
 */
export const parseAuthTokensFromUrl = (url: string): AuthTokens => {
  if (!url) return {};

  try {
    let hashString = '';
    if (url.includes('#')) {
      hashString = url.split('#')[1] || '';
    }
    const hashParams = new URLSearchParams(hashString);

    let queryString = '';
    if (url.includes('?')) {
      queryString = url.split('?')[1].split('#')[0] || '';
    }
    const queryParams = new URLSearchParams(queryString);

    const code = queryParams.get('code') || hashParams.get('code') || undefined;
    const access_token = hashParams.get('access_token') || queryParams.get('access_token') || undefined;
    const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token') || undefined;
    const error = hashParams.get('error') || queryParams.get('error') || undefined;
    const error_description = hashParams.get('error_description') || queryParams.get('error_description') || undefined;

    return { code, access_token, refresh_token, error, error_description };
  } catch (err) {
    return {};
  }
};

/**
 * Sets session from authorization code (PKCE) or tokens.
 */
export const setSessionFromUrl = async (
  url: string,
  onSuccess?: () => void,
  onError?: (errorMessage: string) => void
): Promise<boolean> => {
  const { code, access_token, refresh_token, error, error_description } = parseAuthTokensFromUrl(url);

  if (error || error_description) {
    const errorMsg = error_description || error || 'OAuth authentication failed';
    onError?.(errorMsg);
    return false;
  }

  // 1. Authorization code exchange (PKCE flow)
  if (code) {
    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        onError?.(exchangeError.message);
        return false;
      }

      onSuccess?.();
      return true;
    } catch (err: any) {
      onError?.(err.message || 'Failed to exchange auth code');
      return false;
    }
  }

  // 2. Token session from hash fragment (fallback)
  if (access_token && refresh_token) {
    try {
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        if (sessionError.message?.includes('Refresh Token')) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
        onError?.(sessionError.message);
        return false;
      }

      onSuccess?.();
      return true;
    } catch (err: any) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      onError?.(err.message || 'Failed to set session from tokens');
      return false;
    }
  }

  return false;
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
      await setSessionFromUrl(url, onSuccess, onError);
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
 * Handles web OAuth callback when landing on `/auth/callback` or with code/token parameters.
 */
export const handleWebAuthCallback = async (
  onSuccess?: () => void,
  onError?: (errorMessage: string) => void
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const currentUrl = window.location.href;
  const hasAuthCallbackPath = window.location.pathname.includes('/auth/callback');
  const hasAuthParams = currentUrl.includes('code=') || currentUrl.includes('access_token=');

  if (hasAuthCallbackPath || hasAuthParams) {
    const success = await setSessionFromUrl(currentUrl, onSuccess, onError);
    if (success) {
      const cleanPath = window.location.pathname.replace(/\/auth\/callback\/?$/, '') || '/';
      window.history.replaceState(null, '', cleanPath);
    }
    return success;
  }

  return false;
};