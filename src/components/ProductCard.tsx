import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertTriangle, Heart, RefreshCw, Calendar, HelpCircle, Trash2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProductCard } from '../context/ProductCardContext';

// Concern ID mapping dictionary for displaying user-friendly text labels
const CONCERN_MAP: Record<number, string> = {
  1: 'Breakouts & Scars',
  2: 'Redness',
  3: 'Dark Spots',
  4: 'Dullness',
  5: 'Dryness',
  6: 'Oiliness',
  7: 'Wrinkles & Fine Lines',
  8: 'Pores & Texture',
  9: 'Sensitivity',
  10: 'Extremely dry & flaky Skin',
  11: 'Yeast-induced Breakouts',
  12: 'Not Sure'
};

export function computeProductKeyBenefits(product: any, scores: any, rpcBenefits?: string[]): string[] {
  const benefits: string[] = [];
  const s = scores || {};
  const p = product || {};
  const name = (p.name || p.product_name || p.Name || '').toLowerCase();
  const desc = (p.description || '').toLowerCase();

  // 1. Calms facial redness
  if (
    s.calm_redness_dry_skin > 0 ||
    s.calm_redness_oily_skin > 0 ||
    s.calm_redness_combi_skin > 0 ||
    s.has_vascular_calmer ||
    name.includes('redness') ||
    desc.includes('redness') ||
    name.includes('calming') ||
    desc.includes('calming') ||
    name.includes('soothing') ||
    desc.includes('soothing')
  ) {
    benefits.push('Calms facial redness');
  }

  // 2. Repairs skin barrier
  if (
    s.barrier_repair_dry_skin > 0 ||
    s.barrier_repair_oily_skin > 0 ||
    s.barrier_repair_combi_skin > 0 ||
    name.includes('barrier') ||
    desc.includes('barrier') ||
    name.includes('ceramide') ||
    desc.includes('ceramide')
  ) {
    benefits.push('Repairs skin barrier');
  }

  // 3. Deep hydration
  if (
    s.hydration_dry_skin > 0 ||
    s.hydration_oily_skin > 0 ||
    s.hydration_combi_skin > 0 ||
    name.includes('hydrat') ||
    desc.includes('hydrat') ||
    name.includes('hyaluronic') ||
    desc.includes('hyaluronic') ||
    name.includes('moistur') ||
    desc.includes('moistur')
  ) {
    benefits.push('Deep hydration');
  }

  // 4. Smooths fine lines & wrinkles
  if (
    s.reduce_wrinkles > 0 ||
    name.includes('wrinkle') ||
    desc.includes('wrinkle') ||
    name.includes('anti-aging') ||
    desc.includes('anti-aging') ||
    name.includes('anti-ageing') ||
    desc.includes('anti-ageing') ||
    name.includes('firming') ||
    desc.includes('firming')
  ) {
    benefits.push('Smooths fine lines & wrinkles');
  }

  // 5. Brightens skin tone & fades dark spots
  if (
    s.has_brightening_ingredient ||
    s.has_melanin_inhibitor ||
    s.fade_pie > 0 ||
    s.fade_pih > 0 ||
    name.includes('brighten') ||
    desc.includes('brighten') ||
    name.includes('dark spot') ||
    desc.includes('dark spot') ||
    name.includes('radiance') ||
    desc.includes('radiance') ||
    name.includes('vitamin c') ||
    desc.includes('vitamin c')
  ) {
    benefits.push('Brightens skin tone & fades dark spots');
  }

  // 6. Clears pores & blemishes
  if (
    s.clear_blackheads > 0 ||
    s.clear_whiteheads > 0 ||
    s.clear_surface_breakouts > 0 ||
    s.soothe_deep_breakouts > 0 ||
    s.has_bha_active ||
    s.has_purifying_active ||
    (s.synergy_breakout_response && s.synergy_breakout_response > 0) ||
    name.includes('blemish') ||
    desc.includes('blemish') ||
    name.includes('breakout') ||
    desc.includes('breakout') ||
    name.includes('acne') ||
    desc.includes('acne') ||
    name.includes('clarifying') ||
    desc.includes('clarifying')
  ) {
    benefits.push('Clears pores & blemishes');
  }

  // 7. Oil control
  if (
    s.oil_control > 0 ||
    s.has_5alpha_reductase_inhibitor ||
    name.includes('oil control') ||
    desc.includes('oil control') ||
    name.includes('mattify') ||
    desc.includes('mattify')
  ) {
    benefits.push('Oil control');
  }

  // 8. Refines skin texture
  if (
    s.has_aha_active ||
    s.has_cell_turnover_accelerator ||
    (s.synergy_deep_breakout_penetration && s.synergy_deep_breakout_penetration > 0) ||
    name.includes('exfoliat') ||
    desc.includes('exfoliat') ||
    name.includes('texture') ||
    desc.includes('texture')
  ) {
    benefits.push('Refines skin texture');
  }

  // Incorporate any distinct RPC benefits mapped cleanly
  if (Array.isArray(rpcBenefits)) {
    const RPC_BENEFIT_MAP: Record<string, string> = {
      'Boosts Deep Hydration': 'Deep hydration',
      'Repairs Skin Barrier': 'Repairs skin barrier',
      'Calms Redness': 'Calms facial redness',
      'Soothes Redness': 'Calms facial redness',
      'Targets Active Breakouts': 'Clears pores & blemishes',
      'Combats Clogged Pores': 'Clears pores & blemishes',
      'Targets Fine Lines': 'Smooths fine lines & wrinkles',
      'Smoothes Wrinkles & Fine Lines': 'Smooths fine lines & wrinkles',
      'Fades Dark Spots': 'Brightens skin tone & fades dark spots',
      'Brightens Dull Areas & Marks': 'Brightens skin tone & fades dark spots',
      'Improves Skin Texture': 'Refines skin texture',
      'Refines Pore Texture & Decongests': 'Refines skin texture'
    };

    for (const b of rpcBenefits) {
      const normalized = RPC_BENEFIT_MAP[b] || b;
      if (!benefits.includes(normalized)) {
        benefits.push(normalized);
      }
    }
  }

  if (benefits.length === 0) {
    benefits.push('Balances skin & maintains health');
  }

  return benefits;
}

export function computeProductPotentialIrritants(scores: any, rpcSafetyConcerns?: string[]): string[] {
  const s = scores || {};
  const concerns: string[] = [];

  if (s.has_yeast_trigger) {
    concerns.push('Yeast-induced Breakout Trigger');
  }
  if (s.has_high_irritation) {
    concerns.push('May Be Irritant');
  }
  if (s.uv_sensitivity_required) {
    concerns.push('Requires UV Sunscreen Protection');
  }
  if (s.night) {
    concerns.push('Photosensitizing Active (Use PM Only)');
  }
  if (Number(s.aggregated_clogging_risk) > 0) {
    concerns.push('May Cause Clogged Pores');
  }

  if (Array.isArray(rpcSafetyConcerns)) {
    for (const c of rpcSafetyConcerns) {
      const normalizedC = c === 'High Irritation Risk' ? 'May Be Irritant' : c;
      const isClogConcern = normalizedC.toLowerCase().includes('clog') || normalizedC.toLowerCase().includes('comedogenic');
      if (isClogConcern && Number(s.aggregated_clogging_risk) <= 0) {
        continue; // Skip clogging flag if aggregated_clogging_risk is <= 0
      }
      if (normalizedC !== 'Contains Fragrance' && !concerns.some(existing => existing.toLowerCase() === normalizedC.toLowerCase())) {
        concerns.push(normalizedC);
      }
    }
  }

  return concerns;
}

export function getMetricNamesForFlag(flagName: string): string[] {
  const normalized = (flagName || '').toLowerCase().trim();

  // clogging risk maps to aggregated_clogging_risk (must be checked before general pore/clear check)
  if (normalized.includes('clog') || normalized.includes('comedogenic') || normalized.includes('aggregated_clogging_risk')) {
    return ['aggregated_clogging_risk'];
  }
  // calms facial redness maps to calm_redness, fade_pie, fade_pih;
  if (normalized.includes('redness')) {
    return ['calm_redness', 'fade_pie', 'fade_pih'];
  }
  // repairs skin barrier maps to repair_barrier;
  if (normalized.includes('barrier')) {
    return ['repair_barrier'];
  }
  // deep hydration maps to deep_hydration;
  if (normalized.includes('hydration') || normalized.includes('hydrat')) {
    return ['deep_hydration'];
  }
  // Smooths fine lines maps to reduce_wrinkles, deep_hydration;
  if (normalized.includes('fine lines') || normalized.includes('wrinkles')) {
    return ['reduce_wrinkles'];
  }
  // brightens skin tone maps to has_brightening_ingredient, fade_pih;
  if (normalized.includes('brighten') || normalized.includes('dark spots')) {
    return ['has_brightening_ingredient', 'fade_pih'];
  }
  // clears pores maps to clear_blackheads, clear_surface_breakouts, clear_whiteheads;
  if (normalized.includes('clear') || normalized.includes('pore') || normalized.includes('blemish')) {
    return ['clear_blackheads', 'clear_surface_breakouts', 'clear_whiteheads'];
  }
  // oil control maps to has_5alpha_inh;
  if (normalized.includes('oil control')) {
    return ['has_5alpha_inh'];
  }
  // refines skin texture maps to has_cell_turnover_accelerator;
  if (normalized.includes('texture')) {
    return ['has_cell_turnover_accelerator'];
  }
  // contains fragrance / fragrance-free maps to has_fragrance_top50, contains_frag;
  if (normalized.includes('fragrance')) {
    return ['has_fragrance_top50', 'contains_frag'];
  }
  // yeast-induced breakout trigger maps to has_yeast_trigger;
  if (normalized.includes('yeast')) {
    return ['has_yeast_trigger'];
  }
  // high irritation risk / may be irritant maps to has_high_irritation;
  if (normalized.includes('irritation') || normalized.includes('may be irritant')) {
    return ['has_high_irritation'];
  }

  return [];
}



const RatingSlider = ({ 
  label, 
  value, 
  onChange, 
  tooltipText,
  disabled 
}: { 
  label: string; 
  value: number; 
  onChange: (val: number) => void; 
  tooltipText: string;
  disabled: boolean;
}) => {
  return (
    <div className="flex flex-col gap-0.5 w-full mb-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 group relative">
          <span className="text-[9px] font-black uppercase tracking-wider text-gray-500">{label}</span>
          <div className="cursor-help text-gray-300 hover:text-gray-500 transition-colors">
            <HelpCircle className="w-2.5 h-2.5" />
          </div>
          <div className="pointer-events-none absolute left-0 bottom-full mb-1 w-max max-w-[180px] opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] px-2 py-1 rounded shadow-lg z-10 whitespace-normal text-center">
            {tooltipText}
            <div className="absolute top-full left-4 -ml-1 border-4 border-transparent border-t-slate-800"></div>
          </div>
        </div>
        <span className="text-[9px] font-bold text-gray-400">{value > 0 ? value : '-'} / 5</span>
      </div>
      <div className="relative pt-0.5 pb-1">
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={value || 3}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-purple-500 
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
          style={{
            background: `linear-gradient(to right, #ef4444 0%, #f59e0b 50%, #10b981 100%)`
          }}
        />
        <div className="flex justify-between px-0.5 mt-0.5">
          <span className="text-[7px] text-red-500 font-bold uppercase">1</span>
          <span className="text-[7px] text-amber-500 font-bold uppercase">3</span>
          <span className="text-[7px] text-emerald-500 font-bold uppercase">5</span>
        </div>
      </div>
    </div>
  );
};

export const ProductCardContent = ({ productId, trackerItem, onClose }: { productId: string, trackerItem?: any, onClose: () => void }) => {
  const [product, setProduct] = useState<any>(null);
  const [scores, setScores] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [comp, setComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isIngredientsExpanded, setIsIngredientsExpanded] = useState(false);
  const [rpcErrorObj, setRpcErrorObj] = useState<any>(null);

  const [culprits, setCulprits] = useState<any[]>([]);
  const [expandedBenefitFlag, setExpandedBenefitFlag] = useState<string | null>(null);
  const [expandedIrritantFlag, setExpandedIrritantFlag] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [localSize, setLocalSize] = useState(trackerItem?.size || '');
  const [localNotes, setLocalNotes] = useState(trackerItem?.notes || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [ratings, setRatings] = useState({ dwis: 0, price_value: 0, feel: 0, layer: 0 });

  useEffect(() => {
    if (trackerItem) {
      setLocalSize(trackerItem.size || '');
      setLocalNotes(trackerItem.notes || '');
    }
  }, [trackerItem]);

  const handleUpdateTracker = async (field: string, value: any) => {
    if (!trackerItem?.id) return;
    setIsUpdating(true);
    try {
      await supabase.from('tracker').update({ [field]: value }).eq('id', trackerItem.id);
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateRating = async (field: string, value: number) => {
    console.log(`[ProductCard] Updating rating for ${field} to ${value}`);
    setRatings(prev => ({ ...prev, [field]: value }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      console.log('[ProductCard] No user session found. Cannot save rating.');
      return;
    }
    
    try {
      console.log(`[ProductCard] Upserting rating to Supabase...`, {
        product_id: productId,
        user_id: session.user.id,
        dwis: field === 'dwis' ? value : ratings.dwis || null,
        price_value: field === 'price_value' ? value : ratings.price_value || null,
        feel: field === 'feel' ? value : ratings.feel || null,
        layer: field === 'layer' ? value : ratings.layer || null
      });

      const { data, error } = await supabase
        .from('product_user_ratings')
        .upsert({
          product_id: productId,
          user_id: session.user.id,
          dwis: field === 'dwis' ? value : ratings.dwis || null,
          price_value: field === 'price_value' ? value : ratings.price_value || null,
          feel: field === 'feel' ? value : ratings.feel || null,
          layer: field === 'layer' ? value : ratings.layer || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'product_id, user_id'
        })
        .select();
        
      if (error) {
        console.error('[ProductCard] Supabase rating update error:', error);
      } else {
        console.log('[ProductCard] Supabase rating updated successfully:', data);
      }
    } catch (err) {
      console.error('[ProductCard] Rating update failed with exception:', err);
    }
  };

  const handleDeleteTracker = async () => {
    if (!trackerItem?.id) return;
    setIsUpdating(true);
    try {
      await supabase.from('tracker').delete().eq('id', trackerItem.id);
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
      setIsUpdating(false);
    }
  };


  useEffect(() => {
    let active = true;

    const fetchEcosystemViaRPC = async () => {
      if (!productId) {
        if (active) setLoading(false);
        return;
      }
      setLoading(true);
      setRpcErrorObj(null);
      setExpandedBenefitFlag(null);
      setExpandedIrritantFlag(null);
      setCulprits([]);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        
        const isAuthed = !!session?.user?.id;
        setIsAuthenticated(isAuthed);

        const targetUserId = session?.user?.id || '00000000-0000-0000-0000-000000000000';

        const numericId = Number(productId);
        const culpritsPromise = !isNaN(numericId)
          ? supabase
              .from('product_metric_culprits')
              .select('product_id, metric_name, ingredient_name, position, ingredient_id')
              .eq('product_id', numericId)
              .order('position', { ascending: true })
          : Promise.resolve({ data: [], error: null });

        // Always invoke database engine calculation via RPC for both auth and unauth users
        const rpcPromise = supabase.rpc('evaluate_product_compatibility', {
          p_user_id: targetUserId,
          p_product_id: productId
        });

        const [rpcResult, culpritsResult] = await Promise.all([rpcPromise, culpritsPromise]);
        if (!active) return;

        if (culpritsResult?.error) {
          console.error('[ProductCard] Error querying product_metric_culprits from Supabase:', culpritsResult.error);
        } else {
          console.log(`[ProductCard] product_metric_culprits query for product #${numericId} returned ${culpritsResult?.data?.length || 0} rows:`, culpritsResult?.data);
          if ((culpritsResult?.data?.length || 0) === 0) {
            console.warn(`[ProductCard] product_metric_culprits returned 0 rows for product #${numericId}. If data was inserted, check if RLS (Row Level Security) is blocking read access for anon/authenticated roles.`);
          }
        }

        if (culpritsResult?.data) {
          setCulprits(culpritsResult.data);
        }

        const { data, error } = rpcResult;

        if (error) {
          console.error('[ProductCard] Supabase RPC failed with error:', error);
          setRpcErrorObj({
            error: error.message,
            code: error.code,
            stuck_at_step: 'Postgres Driver / RPC Invocation'
          });
          return;
        }

        if (data) {
          if (data.error) {
            console.error('[ProductCard] Database engine returned diagnostic error:', data);
            // Attempt to gracefully load product info from products table directly so UI isn't blocked
            const { data: directProduct } = await supabase
              .from('products')
              .select('*')
              .eq('id', productId)
              .maybeSingle();

            if (directProduct) {
              setProduct(directProduct);
              setComp({
                skinTypeFit: 'General Fit',
                conflicts: [],
                benefits: computeProductKeyBenefits(directProduct, null),
                safetyConcerns: []
              });
              setRpcErrorObj(null);
            } else {
              setRpcErrorObj(data);
            }
          } else {
            const effectiveScores = data.scores || {
              oil_free: true,
              sulfate_free: true,
              contains_frag: false,
              has_fragrance_top50: false,
              has_yeast_trigger: false,
              night: false
            };

            const p = data.product || {};

            // Inherent key benefits computed from formula properties regardless of user profile
            const formulaBenefits = computeProductKeyBenefits(p, effectiveScores, data.compatibility?.benefits);
            const formulaConcerns = computeProductPotentialIrritants(effectiveScores, data.compatibility?.safetyConcerns);

            const effectiveComp = {
              ...(data.compatibility || {
                skinTypeFit: 'General Catalog Formula',
                conflicts: []
              }),
              benefits: formulaBenefits,
              safetyConcerns: formulaConcerns
            };

            setProduct(data.product);
            setScores(effectiveScores);
            setUserProfile(data.user_meta);
            setComp(effectiveComp);
            setRpcErrorObj(null);
          }
        }

        if (session?.user?.id) {
          const { data: ratingData } = await supabase
            .from('product_user_ratings')
            .select('*')
            .eq('product_id', productId)
            .eq('user_id', session.user.id)
            .maybeSingle();
            
          if (!active) return;

          if (ratingData) {
            setRatings({
              dwis: ratingData.dwis || 0,
              price_value: ratingData.price_value || 0,
              feel: ratingData.feel || 0,
              layer: ratingData.layer || 0
            });
          } else {
            // Reset ratings for new product
            setRatings({ dwis: 0, price_value: 0, feel: 0, layer: 0 });
          }
        } else {
          // Reset ratings for unauthenticated view
          setRatings({ dwis: 0, price_value: 0, feel: 0, layer: 0 });
        }
      } catch (error) {
        console.error('Ecosystem RPC execution failed:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchEcosystemViaRPC();

    return () => {
      active = false;
    };
  }, [productId]);

  if (loading) return (
    <div className="bg-white/95 rounded-2xl p-12 shadow-2xl max-w-md w-full flex flex-col items-center justify-center gap-4 border border-black/5 min-h-[350px]">
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-wider text-black">Analyzing Ingredients...</p>
        <p className="text-[10px] text-black/50 mt-1 font-mono">Running database skin engine compatibility checks</p>
      </div>
    </div>
  );

  if (rpcErrorObj) return (
    <div className="bg-white/95 rounded-2xl p-4 shadow-2xl max-w-md w-full relative border border-red-500/10">
      <button className="absolute top-4 right-4 text-gray-400 hover:text-black transition" onClick={onClose}>
        <X className="w-5 h-5"/>
      </button>
      <div className="flex flex-col gap-3 text-left">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-sans font-black text-sm uppercase tracking-wider">Database Engine Error</h3>
        </div>
        <div className="p-3 bg-red-50 rounded-xl font-mono text-xs text-red-800 space-y-1 select-text">
          <div><span className="font-bold">Error:</span> {rpcErrorObj.error}</div>
          <div><span className="font-bold">Code:</span> {rpcErrorObj.code}</div>
          <div><span className="font-bold">Last Step:</span> {rpcErrorObj.stuck_at_step}</div>
        </div>
        <p className="text-[10px] text-black/50">
          The Supabase RPC function failed during ingredient calculation. Use the details above to troubleshoot your SQL script.
        </p>
      </div>
    </div>
  );

  if (!product) return (
    <div className="p-6 relative text-center font-bold">
      <button className="absolute top-4 right-4 text-gray-400 hover:text-black transition" onClick={onClose}>
        <X className="w-5 h-5"/>
      </button>
      Product not found.
    </div>
  );

  const displayIngredients = isIngredientsExpanded ? (product.ingredients || []) : (product.ingredients || []).slice(0, 5);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full relative max-h-[90vh] overflow-y-auto border border-gray-100 space-y-3">
      <button className="absolute top-4 right-4 text-gray-400 hover:text-black transition" onClick={onClose}>
        <X className="w-5 h-5"/>
      </button>
      
      {/* Unauthenticated banner prompt matching photo search card */}
      {!isAuthenticated && (
        <div className="pb-4 border-b border-gray-200 text-center space-y-2 mb-2">
          <p className="text-sm font-bold text-black">
            Take skin quiz or log in to find out if these products fit your skin
          </p>
          <button
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('open-quiz-or-login'));
            }}
            className="w-full bg-black text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black/80 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            Take skin quiz
          </button>
          <div className="text-center pt-1">
            <span
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('open-login-modal'));
              }}
              className="text-xs font-bold text-black underline hover:text-venus-accent cursor-pointer"
            >
              Log in
            </span>
          </div>
        </div>
      )}

      {/* Product Header (Image left, Brand/Name/Type right) */}
      {(() => {
        const imgSrc = product.photo_url || trackerItem?.photo_url || product.image_url || product.image || product.photo;
        console.log('[ProductCard] Opening product card / modal for product:', product?.name || productId, 'image URL source:', imgSrc, product);
        return (
          <div className="flex items-start gap-4">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={product.name || 'Product'}
                referrerPolicy="no-referrer"
                onLoad={() => console.log('[ProductCard] Image loaded successfully:', imgSrc)}
                onError={(e) => console.error('[ProductCard] Image failed to load:', imgSrc, e)}
                className="w-16 h-16 object-cover rounded-xl border-2 border-black/15 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 bg-black/5 rounded-xl border-2 border-black/15 flex items-center justify-center flex-shrink-0 text-[10px] text-black/40 font-bold">
                No Image
              </div>
            )}

        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-venus-accent">
            {product.brand || product.Brand || 'Unknown Brand'}
          </span>
          <span className="text-sm text-black font-black uppercase break-words">
            {product.name || product.product_name || product.Name || product.ProductName || product['Product Name'] || 'Unnamed'}
          </span>
          {(product.type || product.Type) && (
            <span className="text-[10px] text-black/50 font-semibold uppercase">
              {product.type || product.Type}
            </span>
          )}
        </div>
      </div>
        );
      })()}

      {/* Product Description */}
      {product.description && (
        <p className="text-xs text-black/70 leading-relaxed break-words pt-1">
          {product.description}
        </p>
      )}

      {/* Key Benefits */}
      {comp?.benefits && comp.benefits.length > 0 && (() => {
        const getIngredientsForFlag = (flagName: string) => {
          const metrics = getMetricNamesForFlag(flagName);
          if (!metrics || metrics.length === 0) return [];
          const rawIngs = culprits.filter((c: any) => c.metric_name && metrics.includes(c.metric_name));
          const seen = new Set<string>();
          return rawIngs.filter((item: any) => {
            const name = (item.ingredient_name || '').trim().toLowerCase();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });
        };

        return (
          <div className="pt-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block mb-1">Key Benefits</span>
            <div className="flex flex-wrap gap-1">
              {comp.benefits.map((benefit: string, idx: number) => {
                const matchedIngs = getIngredientsForFlag(benefit);
                const isClickable = matchedIngs.length > 0;
                const isExpanded = expandedBenefitFlag === benefit;

                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      console.log(`[ProductCard] Clicked on Key Benefit: "${benefit}"`);
                      console.log(`[ProductCard] Mapped metrics for "${benefit}":`, getMetricNamesForFlag(benefit));
                      console.log(`[ProductCard] Total culprits loaded for product #${productId}:`, culprits.length, culprits);
                      console.log(`[ProductCard] Matched unique ingredients (${matchedIngs.length}):`, matchedIngs);

                      if (isClickable) {
                        setExpandedBenefitFlag(isExpanded ? null : benefit);
                      } else {
                        console.warn(`[ProductCard] Flag "${benefit}" has 0 matching ingredients in product_metric_culprits.`);
                      }
                    }}
                    className={`border rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1 transition-all text-left ${
                      isExpanded
                        ? 'bg-purple-100 text-purple-950 border-purple-400 shadow-xs ring-1 ring-purple-300'
                        : 'bg-purple-50 text-purple-900 border-purple-200/60'
                    } ${
                      isClickable
                        ? 'cursor-pointer hover:bg-purple-100 hover:border-purple-300 active:scale-[0.98]'
                        : 'cursor-pointer hover:bg-purple-100/50 opacity-90'
                    }`}
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                    <span>{benefit}</span>
                    {isClickable && (
                      <span className="flex items-center gap-0.5 ml-0.5 text-[8px] text-purple-700 bg-purple-200/70 px-1 py-0.1 rounded font-mono font-bold">
                        {matchedIngs.length}
                        {isExpanded ? (
                          <ChevronUp className="w-2 h-2 text-purple-800" />
                        ) : (
                          <ChevronDown className="w-2 h-2 text-purple-600" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Expanded Ingredients Drawer for Clicked Benefit */}
            {expandedBenefitFlag && (() => {
              const ings = getIngredientsForFlag(expandedBenefitFlag);
              if (ings.length === 0) return null;
              return (
                <div className="mt-2 p-2.5 bg-purple-50/70 border border-purple-200/80 rounded-xl space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-purple-900 border-b border-purple-200/60 pb-1">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-purple-600" />
                      {expandedBenefitFlag}
                    </span>
                    <span className="text-[9px] font-mono text-purple-700 bg-purple-200/60 px-1.5 py-0.5 rounded font-bold">
                      {ings.length} Ingr
                    </span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {ings.map((item: any, iIdx: number) => (
                      <div key={iIdx} className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-purple-100 text-[11px] shadow-2xs">
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0"></span>
                          <span className="font-bold text-gray-900 truncate">
                            {item.ingredient_name || 'Unknown Ingredient'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-[9px] font-mono">
                          {item.position != null && (
                            <span className="bg-purple-100/70 text-purple-900 px-1.5 py-0.5 rounded font-bold">
                              #{item.position}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Potential Irritants */}
      {comp?.safetyConcerns && comp.safetyConcerns.length > 0 && (() => {
        const getIngredientsForFlag = (flagName: string) => {
          const metrics = getMetricNamesForFlag(flagName);
          if (!metrics || metrics.length === 0) return [];
          const rawIngs = culprits.filter((c: any) => c.metric_name && metrics.includes(c.metric_name));
          const seen = new Set<string>();
          return rawIngs.filter((item: any) => {
            const name = (item.ingredient_name || '').trim().toLowerCase();
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });
        };

        return (
          <div className="pt-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block mb-1">Potential Irritants</span>
            <div className="flex flex-wrap gap-1">
              {comp.safetyConcerns.map((concern: string, idx: number) => {
                const matchedIngs = getIngredientsForFlag(concern);
                const isClickable = matchedIngs.length > 0;
                const isExpanded = expandedIrritantFlag === concern;

                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => {
                      console.log(`[ProductCard] Clicked on Potential Irritant: "${concern}"`);
                      console.log(`[ProductCard] Mapped metrics for "${concern}":`, getMetricNamesForFlag(concern));
                      console.log(`[ProductCard] Total culprits loaded for product #${productId}:`, culprits.length, culprits);
                      console.log(`[ProductCard] Matched unique ingredients (${matchedIngs.length}):`, matchedIngs);

                      if (isClickable) {
                        setExpandedIrritantFlag(isExpanded ? null : concern);
                      } else {
                        console.warn(`[ProductCard] Flag "${concern}" has 0 matching ingredients in product_metric_culprits.`);
                      }
                    }}
                    className={`border rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1 transition-all text-left ${
                      isExpanded
                        ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs ring-1 ring-amber-300'
                        : 'bg-amber-50 text-amber-900 border-amber-200/60'
                    } ${
                      isClickable
                        ? 'cursor-pointer hover:bg-amber-100 hover:border-amber-300 active:scale-[0.98]'
                        : 'cursor-pointer hover:bg-amber-100/50 opacity-90'
                    }`}
                  >
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                    <span>{concern}</span>
                    {isClickable && (
                      <span className="flex items-center gap-0.5 ml-0.5 text-[8px] text-amber-800 bg-amber-200/70 px-1 py-0.1 rounded font-mono font-bold">
                        {matchedIngs.length}
                        {isExpanded ? (
                          <ChevronUp className="w-2 h-2 text-amber-800" />
                        ) : (
                          <ChevronDown className="w-2 h-2 text-amber-600" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Expanded Culprits Drawer for Clicked Irritant */}
            {expandedIrritantFlag && (() => {
              const ings = getIngredientsForFlag(expandedIrritantFlag);
              if (ings.length === 0) return null;
              return (
                <div className="mt-2 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-amber-900 border-b border-amber-200/60 pb-1">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      {expandedIrritantFlag}
                    </span>
                    <span className="text-[9px] font-mono text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded font-bold">
                      {ings.length} Ingr
                    </span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                    {ings.map((item: any, iIdx: number) => (
                      <div key={iIdx} className="flex items-center justify-between bg-white px-2 py-1.5 rounded-lg border border-amber-100 text-[11px] shadow-2xs">
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                          <span className="font-bold text-gray-900 truncate">
                            {item.ingredient_name || 'Unknown Ingredient'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 text-[9px] font-mono">
                          {item.position != null && (
                            <span className="bg-amber-100/70 text-amber-900 px-1.5 py-0.5 rounded font-bold">
                              #{item.position}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}


      {/* Formula Properties */}
      {scores && (
        <div className="pt-1 border-t border-black/5">
          <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block mb-1">Formula Properties</span>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
              <span className="text-gray-500">Oil-Free</span>
              <span className={`font-bold ${scores.oil_free ? 'text-emerald-600' : 'text-gray-400'}`}>{scores.oil_free ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
              <span className="text-gray-500">Sulfate-Free</span>
              <span className={`font-bold ${scores.sulfate_free ? 'text-emerald-600' : 'text-gray-400'}`}>{scores.sulfate_free ? 'Yes' : 'No'}</span>
            </div>
            <div 
              onClick={() => {
                const isFragFree = !scores.contains_frag && !scores.has_fragrance_top50;
                if (!isFragFree) {
                  setExpandedIrritantFlag(expandedIrritantFlag === 'Contains Fragrance' ? null : 'Contains Fragrance');
                }
              }}
              className={`flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5 ${(!scores.contains_frag && !scores.has_fragrance_top50) ? '' : 'cursor-pointer hover:bg-amber-50/60 transition-colors'}`}
            >
              <span className="text-gray-500">Fragrance-Free</span>
              <span className={`font-bold ${(!scores.contains_frag && !scores.has_fragrance_top50) ? 'text-emerald-600' : 'text-amber-700 underline'}`}>
                {(!scores.contains_frag && !scores.has_fragrance_top50) ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
              <span className="text-gray-500">Malassezia Safe</span>
              <span className={`font-bold ${!scores.has_yeast_trigger ? 'text-emerald-600' : 'text-gray-400'}`}>{!scores.has_yeast_trigger ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Formula Compatibility Analysis (When authenticated) */}
      {isAuthenticated && comp && (
        <div className="bg-black/[0.03] border border-black/10 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Skin Compatibility</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
              comp.skinTypeFit === 'Good Fit' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              comp.skinTypeFit === 'Bad Fit' ? 'bg-red-100 text-red-800 border-red-300' : 
              'bg-amber-100 text-amber-800 border-amber-300'
            }`}>
              {comp.skinTypeFit || 'Compatible'}
            </span>
          </div>

          {comp.conflicts && comp.conflicts.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {comp.conflicts.map((conflict: string, idx: number) => (
                <span key={idx} className="bg-red-50 text-red-900 border border-red-200/60 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-red-600" /> {conflict}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ingredients */}
      {product.ingredients && product.ingredients.length > 0 ? (
        <div className="pt-1">
          <button
            onClick={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
            className="flex items-center gap-1 text-[10px] font-black text-black uppercase underline cursor-pointer"
          >
            Ingredients {isIngredientsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {isIngredientsExpanded && (
            <p className="text-xs text-black/60 mt-1 bg-black/5 p-2 rounded-lg break-words">
              {Array.isArray(product.ingredients) ? product.ingredients.join(', ') : product.ingredients}
            </p>
          )}
        </div>
      ) : null}

      {/* Tracker Controls (If trackerItem present) */}
      {trackerItem && (
        <div className="border-t pt-4 mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">My Tracker</h3>
            <button 
              onClick={handleDeleteTracker}
              disabled={isUpdating}
              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all cursor-pointer shadow-sm select-none">
              <input 
                type="checkbox" 
                className="rounded border-gray-300 text-black focus:ring-black mb-1 w-4 h-4"
                checked={!!trackerItem.in_use}
                onChange={(e) => handleUpdateTracker('in_use', e.target.checked)}
                disabled={isUpdating}
              />
              <span className="text-[9px] font-black uppercase text-gray-600 flex items-center gap-0.5">
                <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                In Use
              </span>
            </label>

            <label className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all cursor-pointer shadow-sm select-none">
              <input 
                type="checkbox" 
                className="rounded border-gray-300 text-black focus:ring-black mb-1 w-4 h-4"
                checked={!!trackerItem.is_liked}
                onChange={(e) => handleUpdateTracker('is_liked', e.target.checked)}
                disabled={isUpdating}
              />
              <span className="text-[9px] font-black uppercase text-gray-600 flex items-center gap-0.5">
                <Heart className={`w-2.5 h-2.5 text-red-500 ${trackerItem.is_liked ? 'fill-red-500' : ''}`} />
                Liked
              </span>
            </label>

            <label className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all cursor-pointer shadow-sm select-none">
              <input 
                type="checkbox" 
                className="rounded border-gray-300 text-black focus:ring-black mb-1 w-4 h-4"
                checked={!!trackerItem.repurchase}
                onChange={(e) => handleUpdateTracker('repurchase', e.target.checked)}
                disabled={isUpdating}
              />
              <span className="text-[9px] font-black uppercase text-gray-600 flex items-center gap-0.5">
                <RefreshCw className="w-2.5 h-2.5 text-blue-500" />
                Buy again
              </span>
            </label>
          </div>

          <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
            {/* Notes */}
            <div className="flex flex-col gap-1 border-b border-gray-200 pb-2 mb-2">
              <span className="text-[9px] font-black uppercase text-gray-400">Notes</span>
              <input 
                type="text" 
                placeholder="Add tracking notes..." 
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={() => handleUpdateTracker('notes', localNotes)}
                disabled={isUpdating}
                className="bg-transparent border-none p-0 text-xs text-gray-700 italic focus:ring-0 w-full placeholder:text-gray-300"
              />
            </div>
            {/* Size */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-2">
              <span className="text-[9px] font-black uppercase text-gray-400">Size</span>
              <input 
                type="text" 
                placeholder="e.g. 50ml" 
                value={localSize}
                onChange={(e) => setLocalSize(e.target.value)}
                onBlur={() => handleUpdateTracker('size', localSize)}
                disabled={isUpdating}
                className="bg-transparent border border-gray-200 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-gray-700 focus:ring-black max-w-[120px] h-7 text-right"
              />
            </div>
            {/* Dates */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-2">
              <span className="text-[9px] font-black uppercase text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> Best By</span>
              <input 
                type="date" 
                value={trackerItem.best_by_date && !trackerItem.best_by_date.includes('0001') ? trackerItem.best_by_date : ''}
                onChange={(e) => handleUpdateTracker('best_by_date', e.target.value)}
                disabled={isUpdating}
                className="bg-transparent border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-mono text-gray-700 focus:ring-black max-w-[120px] h-7"
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-2">
              <span className="text-[9px] font-black uppercase text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> Open Date</span>
              <input 
                type="date" 
                value={trackerItem.open_date || ''}
                onChange={(e) => handleUpdateTracker('open_date', e.target.value)}
                disabled={isUpdating}
                className="bg-transparent border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-mono text-gray-700 focus:ring-black max-w-[120px] h-7"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase text-gray-400 flex items-center gap-1"><HelpCircle className="w-3 h-3"/> POA</span>
              <input 
                type="text" 
                placeholder="e.g. 12M"
                value={trackerItem.poa || ''}
                onChange={(e) => handleUpdateTracker('poa', e.target.value)}
                disabled={isUpdating}
                className="bg-transparent border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-mono text-gray-700 focus:ring-black max-w-[120px] h-7 uppercase text-right"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ProductCard = () => {
  const { isOpen, closeProductCard, productId, trackerItem } = useProductCard();

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeProductCard();
    };
    if (isOpen) document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, closeProductCard]);

  if (!isOpen || !productId) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[200] flex items-center justify-center p-4"
      onClick={closeProductCard}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <ProductCardContent productId={productId} trackerItem={trackerItem} onClose={closeProductCard} />
      </div>
    </div>
  );
};