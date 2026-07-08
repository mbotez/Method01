import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userProfile, productType, page = 1, cat3 = null } = await req.json();

    if (!userProfile) {
      throw new Error("Missing userProfile in request body");
    }

    // DERIVED VARIABLES FOR RESPONSE METADATA & DB PARAMS
    const barrier_risk_effective = userProfile.new_product_reaction === 3 ? 8 : (userProfile.barrier_risk || 0);
    const barrier_level = barrier_risk_effective <= 3 ? 'low' : barrier_risk_effective <= 6 ? 'medium' : 'high';
    const route = barrier_level === 'high' ? 1 : 2;
    
    const skin_type = userProfile.skin_type || 'normal';
    const main_concern = userProfile.main_concern || null;
    const secondary_concern = userProfile.scnd_concern || null;
    
    const breakout_type = Array.isArray(userProfile.breakout_type) ? userProfile.breakout_type : [];
    const scan_acne_type = Array.isArray(userProfile.scan_acne_type) ? userProfile.scan_acne_type : [];
    const pregnant = userProfile.pregnant === 'Yes' ? 'Yes' : 'No';
    
    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[product-sort API] --- STARTING RPC PRODUCT SORT ---');
    console.log('[product-sort API] Input Profile:', { skin_type, main_concern, secondary_concern, barrier_level, productType, cat3, page });

    // EXECUTE RPC CALL
    let rawProducts = null;
    let rpcError = null;
    try {
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
        p_limit: 30,
        p_offset: (page - 1) * 30,
        p_cat3: cat3
      });
      rawProducts = data;
      rpcError = error;
    } catch (e) {
      rpcError = e;
    }

    if (rpcError) {
      console.error("--- DETAILED RPC ERROR DIAGNOSTICS ---");
      console.error("Code:", rpcError.code);
      console.error("Message:", rpcError.message);
      console.error("Details:", rpcError.details);
      console.error("Hint:", rpcError.hint);
      console.error("Full Error Object:", JSON.stringify(rpcError, null, 2));

      console.error('Error fetching products:', rpcError);
      return new Response(
        JSON.stringify({ route, barrier_level, products: [], prescriptions: [], alerts: ['Error fetching products: ' + rpcError.message] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const filteredProducts = rawProducts || [];
    console.log(`[product-sort API] RPC returned ${filteredProducts.length} products.`);

    // PARSE INTO PRODUCTS & PRESCRIPTIONS
    const standardProducts = filteredProducts.filter((p: any) => !p.is_prescription);
    const prescriptionProducts = filteredProducts.filter((p: any) => p.is_prescription);

    // GENERATE ALERTS
    const alerts: string[] = [];
    if (barrier_level === 'high') {
      alerts.push('Your barrier needs recovery — actives paused for now');
    }

    return new Response(
      JSON.stringify({
        route,
        barrier_level,
        products: standardProducts.slice(0, 50),
        prescriptions: prescriptionProducts.slice(0, 10),
        alerts
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('product-sort EdgeFn error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
