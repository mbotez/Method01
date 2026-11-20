import { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { handleCors } from "./_utils.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // 1. EXTRACT 'page' AND OPTIONAL 'cat3' FROM REQUEST BODY
    const { userProfile, productType, page = 1, cat3 = null } = req.body;
    if (!userProfile) {
      return res.status(400).json({ success: false, error: "Missing userProfile in request body" });
    }

    // 2. DEFINE PAGINATION BOUNDARIES
    const LIMIT_PER_PAGE = 30;
    const offset = (page - 1) * LIMIT_PER_PAGE;

    // DERIVED VARIABLES FOR RESPONSE METADATA & DB PARAMS
    const barrier_status_effective = userProfile.new_product_reaction === 3 ? 8 : (userProfile.barrier_status || 0);
    const barrier_level = barrier_status_effective <= 3 ? 'low' : barrier_status_effective <= 6 ? 'medium' : 'high';
    const route = barrier_level === 'high' ? 1 : 2;
    
    const skin_type = userProfile.skin_type || 'normal';
    const main_concern = userProfile.main_concern || null;
    const secondary_concern = userProfile.scnd_concern || null;
    
    const breakoutTypeStringToId: Record<string, number> = {
      // Option 1: Surface Whiteheads
      'whiteheads': 1,
      'surface whiteheads': 1,
      'closed surface pores': 1,
      'closed pores': 1,
      
      // Option 2: Surface Blackheads
      'blackheads': 2,
      'surface blackheads': 2,
      'open surface pores': 2,
      'open pores': 2,
      
      // Option 3: Post-Blemish Red Marks
      'pie': 3,
      'post-blemish red marks': 3,
      'red marks': 3,
      
      // Option 4: Post-Blemish Dark Spots
      'pih': 4,
      'post-blemish dark spots': 4,
      'dark spots': 4,
      
      // Option 5: Surface Bumps
      'surface bumps': 5,
      'surface breakouts': 5,
      
      // Option 6: General Congestion
      'congestion': 6,
      'general congestion': 6,
      'deep breakouts': 6,
      
      // Option 7: Surface Blemishes
      'surface blemishes': 7,
      'blemishes': 7,
      
      // Option 8: Deep & Tender Bumps
      'deep & tender bumps': 8,
      'deep and tender bumps': 8
    };
    const toBreakoutIds = (raw: any): number[] => {
      if (raw == null) return [];
      const items = Array.isArray(raw) ? raw : [raw];
      return items
        .map((b: any) => {
          if (typeof b === 'number' && !isNaN(b)) return b;
          const parsed = parseInt(String(b), 10);
          if (!isNaN(parsed)) return parsed;
          return breakoutTypeStringToId[String(b).toLowerCase().trim()] || 0;
        })
        .filter((n: number) => typeof n === 'number' && !isNaN(n) && n >= 1 && n <= 8);
    };

    const breakout_type = toBreakoutIds(userProfile.breakout_type);
    const rawScanBreakouts = Array.isArray(userProfile.scan_breakout_type) 
      ? userProfile.scan_breakout_type 
      : (Array.isArray(userProfile.blemish_assessment) 
        ? userProfile.blemish_assessment 
        : (userProfile.blemish_assessment ? [userProfile.blemish_assessment] : (userProfile.scan_breakout_type ? [userProfile.scan_breakout_type] : [])));
    const scan_breakout_type = toBreakoutIds(rawScanBreakouts);
    const pregnant = userProfile.pregnant === 'Yes' || userProfile.pregnant === true;
    const rawPastProblems = userProfile.past_problems;
    const past_problems: number[] = Array.isArray(rawPastProblems)
      ? rawPastProblems
          .map((id: any) => (typeof id === 'number' ? id : parseInt(String(id), 10)))
          .filter((n: number) => !isNaN(n))
      : (typeof rawPastProblems === 'string'
          ? (() => {
              try {
                const parsed = JSON.parse(rawPastProblems);
                return Array.isArray(parsed)
                  ? parsed
                      .map((id: any) => (typeof id === 'number' ? id : parseInt(String(id), 10)))
                      .filter((n: number) => !isNaN(n))
                  : [];
              } catch {
                return [];
              }
            })()
          : []);
    
    // Initialize Supabase Client
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://stbperzlmmslrkdpqawt.supabase.co';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0YnBlcnpsbW1zbHJrZHBxYXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjk5ODMsImV4cCI6MjA5Mjk0NTk4M30.37UW8BgKqbuw8XfcfY3zWWxkVv44_A0nJng0yDsudx8';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const ptLower = (productType || '').toLowerCase();
    const mappedProductType = (() => {
      if (!productType || productType === 'all') return null;
      if (ptLower.includes('glass') || ptLower.includes('sensitive') || ptLower.includes('soothe') || ptLower.includes('barrier') || ptLower.includes('aging')) {
        return null;
      }
      if (ptLower.includes('spf') || ptLower.includes('sun')) return 'SPF';
      if (ptLower.includes('moistur')) return 'Moisturiser';
      if (ptLower.includes('treatment') || ptLower.includes('serum')) return 'Treatment';
      if (ptLower.includes('clean')) return 'Cleanser';
      return productType;
    })();

    // EXECUTE RPC CALL WITH DIRECT QUERY FALLBACK
    let rawProducts: any[] | null = null;
    let rawLockedProducts: any[] | null = null;
    let rpcError: any = null;
    
    const callRpc = async (barrierVal: number, reactionVal: number) => {
      const { data, error } = await supabase.rpc('get_meli_product_sort', {
        p_skin_type: skin_type ?? null,
        p_main_concern: main_concern ?? null,
        p_scnd_concern: secondary_concern ?? null,
        p_barrier_risk: Number(barrierVal) || 0,
        p_new_product_reaction: Number(reactionVal) || 0,
        p_product_type: mappedProductType ?? null,
        p_cat3: cat3 != null ? String(cat3) : null,
        p_breakout_type: (breakout_type || []).map(String),
        p_scan_acne_type: (scan_breakout_type || []).map(String),
        p_pregnant: pregnant,
        p_limit: LIMIT_PER_PAGE,
        p_offset: offset,
        p_past_problems: past_problems,
      });

      if (error) {
        throw error;
      }

      return data;
    };

    try {
      if (barrier_level === 'high') {
        const safeData = await callRpc(userProfile.barrier_status || 0, userProfile.new_product_reaction || 0);
        rawProducts = safeData;

        const lockedData = await callRpc(3, 0);
        const safeIds = new Set((rawProducts || []).map((p: any) => p.product_id));
        rawLockedProducts = (lockedData || []).filter((p: any) => !safeIds.has(p.product_id));
      } else {
        const data = await callRpc(userProfile.barrier_status || 0, userProfile.new_product_reaction || 0);
        rawProducts = data;
        rawLockedProducts = [];
      }
    } catch (e: any) {
      rpcError = e;
    }

    // Direct table query fallback if the RPC function fails or has unmigrated definitions
    if (rpcError) {
      try {
        let baseQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, product_scores!inner(*)');
        
        if (ptLower.includes('glass')) {
          baseQuery = baseQuery.or('product_scores.cat2.ilike.%glass%,name.ilike.%glass%');
        } else if (ptLower.includes('sensitive') || ptLower.includes('soothe')) {
          baseQuery = baseQuery.not('product_scores.has_high_irritation', 'eq', true);
        } else if (ptLower.includes('barrier')) {
          baseQuery = baseQuery.or('product_scores.cat2.ilike.%barrier%,product_scores.cat2.ilike.%moisturiser%,type.ilike.%cream%,type.ilike.%moist%');
        } else if (ptLower.includes('aging')) {
          baseQuery = baseQuery.or('product_scores.cat2.ilike.%anti-aging%,name.ilike.%retinol%,name.ilike.%peptide%');
        } else if (mappedProductType) {
          baseQuery = baseQuery.ilike('type', `%${mappedProductType}%`);
        }
        if (cat3 !== null && cat3 !== undefined) {
          baseQuery = baseQuery.eq('product_scores.cat3', cat3);
        }
        if (pregnant) {
          baseQuery = baseQuery.eq('product_scores.pregnancy_safe', true);
        }

        const { data: dbData, error: dbError } = await baseQuery.range(offset, offset + LIMIT_PER_PAGE - 1);
        if (dbError) throw dbError;

        const formatted = (dbData || []).map((p: any) => {
          const s = p.product_scores || {};
          return {
            product_id: p.id,
            name: p.name,
            product_name: p.name,
            brand: p.brand,
            type: p.type,
            photo_url: p.photo_url,
            cat2: s.cat2,
            cat3: s.cat3,
            scores: s,
            clear_surface_breakouts: s.clear_surface_breakouts || 0,
            soothe_deep_breakouts: s.soothe_deep_breakouts || 0,
            synergy_breakout_response: s.synergy_breakout_response || 0,
            synergy_deep_breakout_penetration: s.synergy_deep_breakout_penetration || 0,
            has_purifying_active: s.has_purifying_active || false,
            is_prescription: false
          };
        });

        if (barrier_level === 'high') {
          // In high barrier level, prioritize barrier repair/hydration formulas
          rawProducts = formatted.filter((p: any) => !p.scores?.has_high_irritation);
          rawLockedProducts = formatted.filter((p: any) => p.scores?.has_high_irritation);
        } else {
          rawProducts = formatted;
          rawLockedProducts = [];
        }
      } catch (fallbackErr: any) {
        return res.status(500).json({
          success: false,
          error: fallbackErr.message || "Failed to query products from database"
        });
      }
    }

    const filteredProducts = rawProducts || [];
    const lockedProductsList = rawLockedProducts || [];
    // PARSE INTO PRODUCTS & PRESCRIPTIONS
    const standardProducts = filteredProducts.filter((p: any) => !p.is_prescription);
    const prescriptionProducts = filteredProducts.filter((p: any) => p.is_prescription);

    // GENERATE ALERTS
    const alerts: string[] = [];
    if (barrier_level === 'high') {
      alerts.push('Your barrier needs recovery — any actives are excluded for now');
    }

    return res.status(200).json({
      success: true,
      rpc_failed: !!rpcError,
      route,
      barrier_level,
      products: standardProducts, 
      locked_products: lockedProductsList,
      prescriptions: prescriptionProducts,
      alerts,
      meta: {
        currentPage: page,
        itemsReturned: filteredProducts.length
      }
    });
  } catch (error: any) {
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error in product-sort",
      details: error.stack
    });
  }
}