import { supabase } from '../lib/supabase';

// Helper to safely write to sessionStorage and handle QuotaExceededError or SecurityError
function safeSessionStorageSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch (e: any) {
    console.warn("[productSort Client] Failed to set sessionStorage due to quota limit or browser restriction. Attempting to clear existing productsort cache to free space...", e);
    // Try to free up space by clearing all other productsort items
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
      // Try setting the item again now that we freed some space
      sessionStorage.setItem(key, value);

    } catch (retryErr) {
      console.warn("[productSort Client] Could not save to sessionStorage even after clearing keys. Proceeding without caching.", retryErr);
    }
  }
}

// Helper to safely read from sessionStorage
function safeSessionStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    console.warn("[productSort Client] Failed to read from sessionStorage. Proceeding without cache.", e);
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


  // Create a unique key reflecting all user profile attributes that influence recommendation logic
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


  try {
    // Try calling the local Express backend API route first (faster and runs the latest bundled code)

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
      console.warn('[productSort Client] Local API failed with status:', response.status);
    }
  } catch (apiErr) {
    console.warn('[productSort Client] Local API request failed, falling back to Edge Function:', apiErr);
  }

  try {
    // Fallback: Supabase Edge Function

    const { data, error } = await supabase.functions.invoke('product-sort', {
      body: { userProfile, productType, page, cat3 }
    });

    if (!error && data) {

      safeSessionStorageSet(cacheKey, JSON.stringify(data));
      return data;
    }

    if (error) {
      console.warn('[productSort Client] Edge Function returned an error:', error);
    }
  } catch (err) {
    console.error('[productSort Client] Edge Function connection failed:', err);
  }

  // Final fallback
  console.error("%c[productSort Client] Critical failure: All endpoints failed. Serving empty state fallback.", "color: #ff0000; font-weight: bold;");
  return { route: 2, barrier_level: 'low', products: [], prescriptions: [], alerts: ['Error loading products'] };
}
