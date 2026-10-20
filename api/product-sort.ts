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
    const barrier_risk_effective = userProfile.new_product_reaction === 3 ? 8 : (userProfile.barrier_risk || 0);
    const barrier_level = barrier_risk_effective <= 3 ? 'low' : barrier_risk_effective <= 6 ? 'medium' : 'high';
    const route = barrier_level === 'high' ? 1 : 2;
    
    const skin_type = userProfile.skin_type || 'normal';
    const main_concern = userProfile.main_concern || null;
    const secondary_concern = userProfile.scnd_concern || null;
    
    const breakout_type = Array.isArray(userProfile.breakout_type) ? userProfile.breakout_type : [];
    const scan_acne_type = Array.isArray(userProfile.scan_acne_type) 
      ? userProfile.scan_acne_type 
      : (Array.isArray(userProfile.blemish_assessment) 
        ? userProfile.blemish_assessment 
        : (userProfile.blemish_assessment ? [userProfile.blemish_assessment] : (Array.isArray(userProfile.scan_acne_type) ? userProfile.scan_acne_type : [])));
    const pregnant = userProfile.pregnant === 'Yes' ? 'Yes' : 'No';
    
    // Initialize Supabase Client
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log('[product-sort API] --- STARTING RPC PRODUCT SORT ---');
    console.log('[product-sort API] Input Profile:', { skin_type, main_concern, secondary_concern, barrier_level, productType, cat3, page, offset });

    // EXECUTE RPC CALL
    let rawProducts: any[] | null = null;
    let rawLockedProducts: any[] | null = null;
    let rpcError: any = null;
    
    try {
      if (barrier_level === 'high') {
        const { data: safeData, error: safeError } = await supabase.rpc('get_meli_product_sort', {
          p_barrier_risk: userProfile.barrier_risk || 0,
          p_breakout_type: breakout_type,
          p_main_concern: main_concern,
          p_new_product_reaction: userProfile.new_product_reaction || 0,
          p_pregnant: pregnant,
          p_product_type: productType,
          p_scan_acne_type: scan_acne_type,
          p_scnd_concern: secondary_concern,
          p_skin_type: skin_type,
          p_limit: LIMIT_PER_PAGE, 
          p_offset: offset,
          p_cat3: cat3
        });
        if (safeError) throw safeError;
        rawProducts = safeData;

        const { data: lockedData, error: lockedError } = await supabase.rpc('get_meli_product_sort', {
          p_barrier_risk: 3,
          p_breakout_type: breakout_type,
          p_main_concern: main_concern,
          p_new_product_reaction: 0,
          p_pregnant: pregnant,
          p_product_type: productType,
          p_scan_acne_type: scan_acne_type,
          p_scnd_concern: secondary_concern,
          p_skin_type: skin_type,
          p_limit: LIMIT_PER_PAGE, 
          p_offset: offset,
          p_cat3: cat3
        });
        if (lockedError) throw lockedError;
        
        const safeIds = new Set((rawProducts || []).map((p: any) => p.product_id));
        rawLockedProducts = (lockedData || []).filter((p: any) => !safeIds.has(p.product_id));
      } else {
        const { data, error } = await supabase.rpc('get_meli_product_sort', {
          p_barrier_risk: userProfile.barrier_risk || 0,
          p_breakout_type: breakout_type,
          p_main_concern: main_concern,
          p_new_product_reaction: userProfile.new_product_reaction || 0,
          p_pregnant: pregnant,
          p_product_type: productType,
          p_scan_acne_type: scan_acne_type,
          p_scnd_concern: secondary_concern,
          p_skin_type: skin_type,
          p_limit: LIMIT_PER_PAGE, 
          p_offset: offset,
          p_cat3: cat3
        });
        if (error) throw error;
        rawProducts = data;
        rawLockedProducts = [];
      }
    } catch (e: any) {
      rpcError = e;
    }

    if (rpcError) {
      console.error("--- DETAILED RPC ERROR DIAGNOSTICS ---");
      console.error("Code:", rpcError.code);
      console.error("Message:", rpcError.message);
      console.error("Details:", (rpcError as any).details);
      console.error("Hint:", (rpcError as any).hint);
      console.error("Full Error Object:", JSON.stringify(rpcError, null, 2));
      
      return res.status(500).json({ 
        success: false, 
        error: rpcError.message || "Database RPC function failed",
        details: rpcError.details,
        hint: rpcError.hint,
        code: rpcError.code 
      });
    }

    const filteredProducts = rawProducts || [];
    const lockedProductsList = rawLockedProducts || [];
    console.log(`[product-sort API] RPC returned ${filteredProducts.length} products and ${lockedProductsList.length} locked products for page ${page}.`);

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
    console.error('product-sort handler error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error in product-sort",
      details: error.stack
    });
  }
}