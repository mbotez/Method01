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
      console.log("[productSort Client] Successfully saved to sessionStorage after freeing space.");
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
  console.log("%c[productSort Client] Clearing all cached recommendations from sessionStorage...", "color: #ff3b30; font-weight: bold;");
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('productsort_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    console.log(`[productSort Client] Removed ${keysToRemove.length} cache items.`);
  } catch (e) {
    console.error("[productSort Client] Failed to clear productsort cache.", e);
  }
}

export async function productSort(userProfile: any, productType: string, page: number = 1, forceRefresh: boolean = false, cat3: number | null = null) {
  console.log(`%c[productSort Client] Called for productType: "${productType}" (page: ${page}, forceRefresh: ${forceRefresh}, cat3: ${cat3})`, "color: #ff007f; font-weight: bold;");
  console.log("[productSort Client] Active User Profile context:", userProfile);

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
    console.log(`%c[productSort Client] Force refresh requested. Invalidating and removing cache key "${cacheKey}"...`, "color: #ffcc00; font-weight: bold;");
    safeSessionStorageRemove(cacheKey);
  } else {
    const cached = safeSessionStorageGet(cacheKey);
    if (cached) {
      console.log(`%c[productSort Client] CACHE HIT! Loaded cached results from sessionStorage for "${productType}".`, "color: #00aa55; font-weight: bold;");
      console.log("[productSort Client] Tip: Click the 'Force Refresh' button in the UI or call clearProductSortCache() to bypass this cache.");
      try {
        const parsed = JSON.parse(cached);
        console.log("[productSort Client] Cached products summary:", parsed.products?.map((p: any) => `${p.brand} - ${p.name} (ID: ${p.product_id})`));
        return parsed;
      } catch (e) {
        console.error("[productSort Client] Error parsing cached products JSON. Bypassing cache.", e);
        safeSessionStorageRemove(cacheKey);
      }
    }
  }

  console.log(`%c[productSort Client] CACHE MISS. Fetching fresh recommendation data from backend...`, "color: #ffa500;");

  try {
    // Try calling the local Express backend API route first (faster and runs the latest bundled code)
    console.log("[productSort Client] Pass 1: Requesting local Express endpoint '/api/product-sort'...");
    const response = await fetch('/api/product-sort', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userProfile, productType, page, cat3 }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("%c[productSort Client] Local API route responded successfully!", "color: #00aa55; font-weight: bold;");
      console.log("[productSort Client] Returned payload:", data);
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
    console.log("[productSort Client] Pass 2: Invoking Supabase Edge Function 'product-sort'...");
    const { data, error } = await supabase.functions.invoke('product-sort', {
      body: { userProfile, productType, page, cat3 }
    });

    if (!error && data) {
      console.log("%c[productSort Client] Supabase Edge Function responded successfully!", "color: #00aa55; font-weight: bold;");
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
