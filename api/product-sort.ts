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
    const rawBreakouts = Array.isArray(userProfile.breakout_type)
      ? userProfile.breakout_type
      : (userProfile.breakout_type ? [userProfile.breakout_type] : []);
    const breakout_type: number[] = rawBreakouts.map((b: any) => {
      if (typeof b === 'number') return b;
      const parsed = parseInt(String(b), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) return parsed;
      return breakoutTypeStringToId[String(b).toLowerCase().trim()] || 0;
    }).filter((n: number) => n >= 1 && n <= 8);
    const scan_breakout_type = Array.isArray(userProfile.scan_breakout_type) 
      ? userProfile.scan_breakout_type 
      : (Array.isArray(userProfile.blemish_assessment) 
        ? userProfile.blemish_assessment 
        : (userProfile.blemish_assessment ? [userProfile.blemish_assessment] : (userProfile.scan_breakout_type ? [userProfile.scan_breakout_type] : [])));
    const pregnant = userProfile.pregnant === 'Yes' ? 'Yes' : 'No';
    
    // Initialize Supabase Client
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // EXECUTE RPC CALL WITH DIRECT QUERY FALLBACK
    let rawProducts: any[] | null = null;
    let rawLockedProducts: any[] | null = null;
    let rpcError: any = null;
    
    const callRpcWithDualSchemas = async (barrierVal: number, reactionVal: number) => {
      // 1. Try with PostgreSQL native registered signature (p_barrier_risk, p_scan_acne_type)
      const res1 = await supabase.rpc('get_meli_product_sort', {
        p_barrier_risk: barrierVal,
        p_breakout_type: breakout_type,
        p_cat3: cat3,
        p_limit: LIMIT_PER_PAGE,
        p_main_concern: main_concern,
        p_new_product_reaction: reactionVal,
        p_offset: offset,
        p_pregnant: pregnant,
        p_product_type: productType,
        p_scan_acne_type: scan_breakout_type,
        p_scnd_concern: secondary_concern,
        p_skin_type: skin_type
      });
      if (!res1.error && res1.data) return res1.data;

      // 2. Try with alternative parameter names (p_barrier_status, p_scan_breakout_type)
      const res2 = await supabase.rpc('get_meli_product_sort', {
        p_barrier_status: barrierVal,
        p_breakout_type: breakout_type,
        p_cat3: cat3,
        p_limit: LIMIT_PER_PAGE,
        p_main_concern: main_concern,
        p_new_product_reaction: reactionVal,
        p_offset: offset,
        p_pregnant: pregnant,
        p_product_type: productType,
        p_scan_breakout_type: scan_breakout_type,
        p_scnd_concern: secondary_concern,
        p_skin_type: skin_type
      });
      if (!res2.error && res2.data) return res2.data;

      throw res1.error || res2.error;
    };

    try {
      if (barrier_level === 'high') {
        const safeData = await callRpcWithDualSchemas(userProfile.barrier_status || 0, userProfile.new_product_reaction || 0);
        rawProducts = safeData;

        const lockedData = await callRpcWithDualSchemas(3, 0);
        const safeIds = new Set((rawProducts || []).map((p: any) => p.product_id));
        rawLockedProducts = (lockedData || []).filter((p: any) => !safeIds.has(p.product_id));
      } else {
        const data = await callRpcWithDualSchemas(userProfile.barrier_status || 0, userProfile.new_product_reaction || 0);
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
        
        if (productType && productType !== 'all') {
          baseQuery = baseQuery.ilike('type', `%${productType}%`);
        }
        if (cat3 !== null && cat3 !== undefined) {
          baseQuery = baseQuery.eq('product_scores.cat3', cat3);
        }
        if (pregnant === 'Yes') {
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
      alerts.push('Your barrier needs recovery — actives paused for now');
    }

    return res.status(200).json({
      success: true,
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