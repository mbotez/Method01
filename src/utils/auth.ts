import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { supabase } from '../lib/supabase';

/**
 * 1. Detect whether the app is running natively on mobile using Capacitor.
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * 2. Set the OAuth redirect URL dynamically:
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
 * 3. Call supabase.auth.signInWithOAuth using provider 'google' and the correct dynamic redirectTo option.
 */
export const signInWithGoogle = async () => {
  const redirectTo = getOAuthRedirectUrl();
  console.log('[Auth] Initiating Google OAuth with redirectTo:', redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  });

  if (error) {
    console.error('[Auth] signInWithOAuth error:', error);
    throw error;
  }

  return data;
};

export interface AuthTokens {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  error?: string;
  error_description?: string;
}

/**
 * Parses the access_token and refresh_token from the URL hash fragment (and query parameters fallback).
 */
export const parseAuthTokensFromUrl = (url: string): AuthTokens => {
  if (!url) return {};

  try {
    // 1. Hash fragment (standard for OAuth token response / Supabase implicit flow)
    let hashString = '';
    if (url.includes('#')) {
      hashString = url.split('#')[1] || '';
    }
    const hashParams = new URLSearchParams(hashString);

    // 2. Query string fallback (for PKCE code or query params)
    let queryString = '';
    if (url.includes('?')) {
      queryString = url.split('?')[1].split('#')[0] || '';
    }
    const queryParams = new URLSearchParams(queryString);

    const access_token = hashParams.get('access_token') || queryParams.get('access_token') || undefined;
    const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token') || undefined;
    const code = queryParams.get('code') || hashParams.get('code') || undefined;
    const error = hashParams.get('error') || queryParams.get('error') || undefined;
    const error_description = hashParams.get('error_description') || queryParams.get('error_description') || undefined;

    return { access_token, refresh_token, code, error, error_description };
  } catch (err) {
    console.error('[Auth] Error parsing tokens from URL:', err);
    return {};
  }
};

/**
 * Sets session from parsed tokens or authorization code.
 */
export const setSessionFromUrl = async (
  url: string,
  onSuccess?: () => void,
  onError?: (errorMessage: string) => void
): Promise<boolean> => {
  const { access_token, refresh_token, code, error, error_description } = parseAuthTokensFromUrl(url);

  if (error || error_description) {
    const errorMsg = error_description || error || 'OAuth authentication failed';
    console.error('[Auth] OAuth error received in URL:', errorMsg);
    onError?.(errorMsg);
    return false;
  }

  // 1. Token session from hash fragment (access_token & refresh_token)
  if (access_token && refresh_token) {
    try {
      console.log('[Auth] Setting Supabase session from hash tokens...');
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        if (sessionError.message?.includes('Refresh Token')) {
          console.warn('[Auth] Stale refresh token encountered, clearing local session');
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        } else {
          console.error('[Auth] Failed to setSession:', sessionError);
        }
        onError?.(sessionError.message);
        return false;
      }

      console.log('[Auth] Session successfully established:', data.session?.user?.id);
      onSuccess?.();
      return true;
    } catch (err: any) {
      console.warn('[Auth] Exception while setting session:', err);
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      onError?.(err.message || 'Failed to set session from tokens');
      return false;
    }
  }

  // 2. Authorization code exchange fallback (PKCE flow)
  if (code) {
    try {
      console.log('[Auth] Exchanging auth code for session...');
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[Auth] Failed to exchange code for session:', exchangeError);
        onError?.(exchangeError.message);
        return false;
      }

      console.log('[Auth] Code exchanged successfully for session:', data.session?.user?.id);
      onSuccess?.();
      return true;
    } catch (err: any) {
      console.error('[Auth] Exception exchanging auth code:', err);
      onError?.(err.message || 'Failed to exchange auth code');
      return false;
    }
  }

  return false;
};

/**
 * 4. Set up deep link token handling for Capacitor (using App.addListener('appUrlOpen', ...))
 *    so that when the app opens via the custom deep link scheme ("com.daybreak.canonic://auth-callback"),
 *    it parses the access_token and refresh_token from the URL hash fragment, calls
 *    supabase.auth.setSession({ access_token, refresh_token }), and navigates the user to the dashboard.
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
      console.log('[Auth] Deep link received matching auth-callback:', url);
      await setSessionFromUrl(url, onSuccess, onError);
    }
  };

  // Check if the app was cold-started from a deep link
  App.getLaunchUrl()
    .then((launchUrl) => {
      if (launchUrl?.url) {
        handleDeepLinkUrl(launchUrl.url);
      }
    })
    .catch((err) => {
      console.error('[Auth] Error getting launch URL:', err);
    });

  // Listen for deep link events while the app is active or in background
  const listenerPromise = App.addListener('appUrlOpen', async (data: URLOpenListenerEvent) => {
    console.log('[Auth] App URL opened event:', data.url);
    await handleDeepLinkUrl(data.url);
  });

  return () => {
    listenerPromise.then((listener) => listener.remove()).catch(console.error);
  };
};

/**
 * Handles web OAuth callback when landing on `/auth/callback` or with hash tokens.
 */
export const handleWebAuthCallback = async (
  onSuccess?: () => void,
  onError?: (errorMessage: string) => void
): Promise<boolean> => {
  if (typeof window === 'undefined') return false;

  const currentUrl = window.location.href;
  const hasAuthCallbackPath = window.location.pathname.includes('/auth/callback');
  const hasHashTokens = currentUrl.includes('access_token=') || currentUrl.includes('code=');

  if (hasAuthCallbackPath || hasHashTokens) {
    const success = await setSessionFromUrl(currentUrl, onSuccess, onError);
    if (success) {
      // Clean up the URL callback path and hash without reloading page
      const cleanPath = window.location.pathname.replace(/\/auth\/callback\/?$/, '') || '/';
      window.history.replaceState(null, '', cleanPath);
    }
    return success;
  }

  return false;
};
