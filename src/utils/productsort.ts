import { supabase } from '../lib/supabase';

// Helper to safely write to sessionStorage and handle QuotaExceededError or SecurityError
function safeSessionStorageSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch (e: any) {
    console.warn("[productSort Client] Failed to set sessionStorage due to quota limit or browser restriction. Attempting to clear existing productsort cache to free space...", e);
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('productsort_') && k !== key) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => {
        try {
          sessionStorage.removeItem(k);
        } catch (err) {
          // ignore
        }
      });
      sessionStorage.setItem(key, value);
    } catch (retryErr) {
      console.warn("[productSort Client] Could not save to sessionStorage even after clearing keys.", retryErr);
    }
  }
}

// Helper to safely read from sessionStorage
function safeSessionStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    console.warn("[productSort Client] Failed to read from sessionStorage.", e);
    return null;
  }
}

// Helper to safely remove from sessionStorage
function safeSessionStorageRemove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch (e) {
    console.warn("[productSort Client] Failed to remove from sessionStorage.", e);
  }
}

export function clearProductSortCache() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('productsort_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
  } catch (e) {
    console.error("[productSort Client] Failed to clear productsort cache.", e);
  }
}

export async function productSort(userProfile: any, productType: string, page: number = 1, forceRefresh: boolean = false, cat3: number | null = null) {
  const skinType = userProfile?.skin_type || 'any';
  const barrierRisk = userProfile?.barrier_risk !== undefined && userProfile?.barrier_risk !== null 
    ? Number(userProfile.barrier_risk) 
    : 0;
  const pregnant = userProfile?.pregnant || 'No';
  const mainConcern = userProfile?.main_concern || '';
  const scndConcern = userProfile?.scnd_concern || '';
  const activesUsed = Array.isArray(userProfile?.actives_used) 
    ? [...userProfile.actives_used].sort().join(',') 
    : '';

  const cacheKey = `productsort_${productType}_pg-${page}_cat3-${cat3}_${userProfile?.id || 'anonymous'}_st-${skinType}_br-${barrierRisk}_pr-${pregnant}_mc-${mainConcern}_sc-${scndConcern}_act-${activesUsed}`;
  
  if (forceRefresh) {
    safeSessionStorageRemove(cacheKey);
  } else {
    const cached = safeSessionStorageGet(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed;
      } catch (e) {
        console.error("[productSort Client] Error parsing cached products JSON. Bypassing cache.", e);
        safeSessionStorageRemove(cacheKey);
      }
    }
  }

  let lastError: any = null;

  // 1. Try local Express backend API route
  try {
    const response = await fetch('/api/product-sort', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userProfile, productType, page, cat3 }),
    });

    if (response.ok) {
      const data = await response.json();
      safeSessionStorageSet(cacheKey, JSON.stringify(data));
      return data;
    } else {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Product sort API failed with status ${response.status}`);
    }
  } catch (apiErr: any) {
    console.warn('[productSort Client] Local API request failed, trying Edge Function:', apiErr);
    lastError = apiErr;
  }

  // 2. Fallback: Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('product-sort', {
      body: { userProfile, productType, page, cat3 }
    });

    if (!error && data) {
      safeSessionStorageSet(cacheKey, JSON.stringify(data));
      return data;
    }

    if (error) {
      throw new Error(error.message || "Supabase Edge Function error during product sort");
    }
  } catch (err: any) {
    console.error('[productSort Client] Edge Function connection failed:', err);
    lastError = err;
  }

  // No silent fallback / mock data — throw exact error so it bubbles up to global error modal
  throw new Error(lastError?.message || "Failed to retrieve sorted products from all available endpoints.");
}
