import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertTriangle, Heart, RefreshCw, Calendar, HelpCircle, Trash2, Shield, ShoppingBag, ArrowLeftRight, Search, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProductCard } from '../context/ProductCardContext';
import { Login } from './Login';
import { ProductComparisonTable } from './ProductComparisonTable';

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

  // Extract category 2 (cat2) from product or scores
  const rawCat2 = (
    p.cat2 ||
    s.cat2 ||
    p.product_scores?.cat2 ||
    (Array.isArray(p.product_scores) ? p.product_scores[0]?.cat2 : '') ||
    ''
  ).toString().trim().toLowerCase();

  const isTreatment = rawCat2 === 'treatment';

  // 1. Calms facial redness - Rule: No product of cat2 = Treatment can have the 'Calms facial redness' flag
  if (!isTreatment) {
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
      // Rule: no product of cat2 = Treatment can have the 'Calms facial redness' flag
      if (isTreatment && normalized.toLowerCase() === 'calms facial redness') {
        continue;
      }
      if (!benefits.includes(normalized)) {
        benefits.push(normalized);
      }
    }
  }

  // Final check: Filter out 'Calms facial redness' if treatment
  let finalBenefits = isTreatment
    ? benefits.filter(b => b.toLowerCase() !== 'calms facial redness')
    : benefits;

  if (finalBenefits.length === 0) {
    finalBenefits.push('Balances skin & maintains health');
  }

  return finalBenefits;
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



export const RatingSlider = ({ 
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

export const ProductCardContent = ({ 
  productId, 
  trackerItem, 
  onClose,
  isCompared = false,
  comparedSide,
  onCompareWith
}: { 
  productId: string;
  trackerItem?: any;
  onClose: () => void;
  isCompared?: boolean;
  comparedSide?: 'left' | 'right';
  onCompareWith?: (newCompareId: string) => void;
}) => {
  const { openComparison } = useProductCard();
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
  const [globalRatingsSummary, setGlobalRatingsSummary] = useState({
    avg: 0,
    dwis: 0,
    price_value: 0,
    feel: 0,
    layer: 0,
    count: 0
  });
  const [isRatingsDropdownOpen, setIsRatingsDropdownOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const [imageError, setImageError] = useState(false);

  // Comparison popup states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthModalSignUp, setIsAuthModalSignUp] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [initialSuggestions, setInitialSuggestions] = useState<any[]>([]);

  const loadInitialSuggestions = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, brand, name, type, photo_url')
        .order('id', { ascending: false })
        .limit(10);
      const filtered = (data || []).filter(item => String(item.id) !== String(productId));
      setInitialSuggestions(filtered);
      if (!searchQuery.trim()) {
        setSearchResults(filtered);
      }
    } catch {
      // silent
    }
  };

  const handleCompareClick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const authed = !!session?.user?.id;
    setIsAuthenticated(authed);
    if (!authed) {
      setShowAuthModal(true);
    } else {
      setShowSearchModal(true);
      loadInitialSuggestions();
    }
  };

  const performSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) {
      setSearchResults(initialSuggestions);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const words = q
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length > 0)
        .map(w => `${w}:*`);

      const formattedQuery = words.length > 0 ? words.join(' & ') : '';
      let results: any[] = [];

      if (formattedQuery) {
        const { data, error } = await supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', formattedQuery, { config: 'english' })
          .limit(15);
        if (!error && data && data.length > 0) {
          results = data;
        }
      }

      if (results.length === 0) {
        const { data: webData } = await supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', q, { config: 'english', type: 'websearch' })
          .limit(15);
        if (webData && webData.length > 0) {
          results = webData;
        } else {
          const { data: ilikeData } = await supabase
            .from('products')
            .select('id, brand, name, type, photo_url')
            .or(`brand.ilike.%${q}%,name.ilike.%${q}%`)
            .limit(15);
          results = ilikeData || [];
        }
      }

      const filtered = (results || []).filter(item => String(item.id) !== String(productId));
      setSearchResults(filtered);
    } catch (err) {
      console.error('Comparison search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!showSearchModal) return;
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearchModal]);

  const handleSelectCompareProduct = (selectedId: string | number) => {
    setShowSearchModal(false);
    if (onCompareWith) {
      onCompareWith(String(selectedId));
    } else {
      openComparison(String(productId), String(selectedId));
    }
  };

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
      } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateRating = async (field: string, value: number) => {
    const newRatings = {
      dwis: field === 'dwis' ? value : ratings.dwis || 0,
      price_value: field === 'price_value' ? value : ratings.price_value || 0,
      feel: field === 'feel' ? value : ratings.feel || 0,
      layer: field === 'layer' ? value : ratings.layer || 0
    };
    const validScores = [newRatings.dwis, newRatings.price_value, newRatings.feel, newRatings.layer].filter(v => v > 0);
    const avgScore = validScores.length > 0 ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)) : null;

    setRatings(prev => ({ ...prev, [field]: value }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return;
    }
    
    try {
      await supabase
        .from('product_user_ratings')
        .upsert({
          product_id: productId,
          user_id: session.user.id,
          dwis: newRatings.dwis || null,
          price_value: newRatings.price_value || null,
          feel: newRatings.feel || null,
          layer: newRatings.layer || null,
          avg: avgScore,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'product_id, user_id'
        });
    } catch (err) {
      console.error('Error updating rating:', err);
    }
  };

  const handleSaveComment = async () => {
    if (!newCommentText.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      console.warn('[Comments] No active session found, showing auth modal');
      setShowAuthModal(true);
      return;
    }

    setIsSubmittingComment(true);
    try {
      console.log('[Comments] Saving comment for product:', productId, 'user:', session.user.id);
      const { data, error } = await supabase
        .from('product_comments')
        .insert({
          product_id: productId,
          user_id: session.user.id,
          comment: newCommentText.trim(),
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('[Comments] Supabase insert error:', error);
        alert(`Failed to save comment: ${error.message}`);
      } else if (data) {
        console.log('[Comments] Successfully saved comment:', data[0]);
        setComments(prev => [data[0], ...prev]);
        setNewCommentText('');
      }
    } catch (err) {
      console.error('[Comments] Exception saving comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteTracker = async () => {
    if (!trackerItem?.id) return;
    setIsUpdating(true);
    try {
      await supabase.from('tracker').delete().eq('id', trackerItem.id);
      onClose();
    } catch (err) {
      setIsUpdating(false);
    }
  };


  useEffect(() => {
    let active = true;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchEcosystemViaRPC = async () => {
      if (!productId) {
        if (active) setLoading(false);
        return;
      }
      setLoading(true);
      setRpcErrorObj(null);
      setImageError(false);
      setExpandedBenefitFlag(null);
      setExpandedIrritantFlag(null);
      setCulprits([]);

      try {
        const sessionRes = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        const session = sessionRes?.data?.session;
        if (!active || signal.aborted) return;
        
        const isAuthed = !!session?.user?.id;
        setIsAuthenticated(isAuthed);

        const targetUserId = session?.user?.id || '00000000-0000-0000-0000-000000000000';

        const numericId = Number(productId);
        const isValidNumeric = !isNaN(numericId) && numericId > 0;
        const targetProductId = isValidNumeric
          ? numericId
          : (trackerItem?.product_id && !isNaN(Number(trackerItem.product_id)) ? Number(trackerItem.product_id) : null);

        const culpritsPromise = targetProductId != null
          ? (async () => {
              try {
                return await supabase
                  .from('product_metric_culprits')
                  .select('product_id, metric_name, ingredient_name, position, ingredient_id')
                  .eq('product_id', targetProductId)
                  .order('position', { ascending: true })
                  .abortSignal(signal);
              } catch (err: any) {
                return { data: [], error: err?.name === 'AbortError' ? null : err };
              }
            })()
          : Promise.resolve({ data: [], error: null });

        // Query product row from products table directly so photo_url and metadata are guaranteed
        const productTablePromise = targetProductId != null
          ? (async () => {
              try {
                return await supabase
                  .from('products')
                  .select('*')
                  .eq('id', targetProductId)
                  .abortSignal(signal)
                  .maybeSingle();
              } catch (err: any) {
                return { data: null, error: err?.name === 'AbortError' ? null : err };
              }
            })()
          : Promise.resolve({ data: null, error: null });

        // Query product_scores to guarantee cat2 category for the Calms facial redness exclusion rule
        const scoreTablePromise = targetProductId != null
          ? (async () => {
              try {
                return await supabase
                  .from('product_scores')
                  .select('cat2, cat3')
                  .eq('product_id', targetProductId)
                  .abortSignal(signal)
                  .maybeSingle();
              } catch (err: any) {
                return { data: null, error: err?.name === 'AbortError' ? null : err };
              }
            })()
          : Promise.resolve({ data: null, error: null });

        // Always invoke database engine calculation via RPC for both auth and unauth users
        const rpcPromise = (async () => {
          try {
            return await supabase
              .rpc('evaluate_product_compatibility', {
                p_user_id: targetUserId,
                p_product_id: productId
              })
              .abortSignal(signal);
          } catch (err: any) {
            return { data: { error: err?.message || 'RPC Error' }, error: err };
          }
        })();

        const [rpcResult, culpritsResult, productTableResult, scoreTableResult] = await Promise.all([
          rpcPromise,
          culpritsPromise,
          productTablePromise,
          scoreTablePromise
        ]);
        if (!active || signal.aborted) return;

        if (culpritsResult?.data) {
          setCulprits(culpritsResult.data);
        }

        const tableProd = productTableResult?.data || null;
        const fetchedCat2 = scoreTableResult?.data?.cat2 || tableProd?.cat2 || trackerItem?.cat2 || '';
        if (tableProd) {
          tableProd.cat2 = fetchedCat2;
        }

        const { data, error } = rpcResult;

        if (error) {
          // If the RPC failed but direct product row exists, gracefully display the product
          if (tableProd) {
            const formulaBenefits = computeProductKeyBenefits(tableProd, null);
            setProduct({
              ...tableProd,
              cat2: fetchedCat2,
              photo_url: tableProd.photo_url || trackerItem?.photo_url || null,
            });
            setComp({
              skinTypeFit: 'General Fit',
              conflicts: [],
              benefits: formulaBenefits,
              safetyConcerns: []
            });
            setScores(null);
            setRpcErrorObj(null);
          } else if (trackerItem) {
            setProduct({
              id: targetProductId || productId,
              name: trackerItem.product_name || 'Product',
              brand: trackerItem.brand || '',
              type: trackerItem.product_type || 'Skincare',
              photo_url: trackerItem.photo_url || null
            });
            setComp({ skinTypeFit: 'General Fit', conflicts: [], benefits: [], safetyConcerns: [] });
          } else {
            setRpcErrorObj({
              error: error.message,
              code: error.code,
              stuck_at_step: 'Postgres Driver / RPC Invocation'
            });
          }
        }

        if (data) {
          if (data.error) {
            // Attempt to gracefully load product info from products table directly so UI isn't blocked
            const directProductRes = isValidNumeric ? await (async () => {
              try {
                return await supabase
                  .from('products')
                  .select('*')
                  .eq('id', numericId)
                  .abortSignal(signal)
                  .maybeSingle();
              } catch {
                return { data: null };
              }
            })() : { data: null };
            if (!active || signal.aborted) return;
            const directProduct = tableProd || directProductRes.data;

            if (directProduct) {
              directProduct.cat2 = fetchedCat2;
              setProduct({
                ...directProduct,
                cat2: fetchedCat2,
                photo_url: directProduct.photo_url || trackerItem?.photo_url || null,
              });
              setComp({
                skinTypeFit: 'General Fit',
                conflicts: [],
                benefits: computeProductKeyBenefits(directProduct, null),
                safetyConcerns: []
              });
              setRpcErrorObj(null);
            } else if (trackerItem) {
              setProduct({
                id: targetProductId || productId,
                name: trackerItem.product_name || 'Product',
                brand: trackerItem.brand || '',
                type: trackerItem.product_type || 'Skincare',
                photo_url: trackerItem.photo_url || null
              });
              setComp({ skinTypeFit: 'General Fit', conflicts: [], benefits: [], safetyConcerns: [] });
            } else {
              setRpcErrorObj(data);
            }
          } else {
            const finalCat2 = fetchedCat2 || data?.scores?.cat2 || data?.product?.cat2 || '';
            const effectiveScores = data.scores || {
              oil_free: true,
              sulfate_free: true,
              contains_frag: false,
              has_fragrance_top50: false,
              has_yeast_trigger: false,
              night: false
            };
            effectiveScores.cat2 = finalCat2;

            const p = data.product || {};
            p.cat2 = finalCat2;

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

            // Merge table product with RPC product
            const mergedProduct = {
              ...(tableProd || {}),
              ...p,
              cat2: finalCat2,
              photo_url: p.photo_url || tableProd?.photo_url || trackerItem?.photo_url || null,
              ingredients: p.ingredients || tableProd?.ingredients || [],
              name: p.name || tableProd?.name || trackerItem?.product_name || 'Product Name',
              brand: p.brand || tableProd?.brand || trackerItem?.brand || 'Brand',
              type: p.type || tableProd?.type || trackerItem?.product_type || 'Skincare',
              description: p.description || tableProd?.description || ''
            };

            setProduct(mergedProduct);
            setScores(effectiveScores);
            setUserProfile(data.user_meta);
            setComp(effectiveComp);
            setRpcErrorObj(null);
          }
        }

        if (session?.user?.id) {
          const ratingRes = await (async () => {
            try {
              return await supabase
                .from('product_user_ratings')
                .select('*')
                .eq('product_id', productId)
                .eq('user_id', session.user.id)
                .abortSignal(signal)
                .maybeSingle();
            } catch {
              return { data: null };
            }
          })();
            
          if (!active || signal.aborted) return;
          const ratingData = ratingRes?.data;

          if (ratingData) {
            setRatings({
              dwis: ratingData.dwis || 0,
              price_value: ratingData.price_value || 0,
              feel: ratingData.feel || 0,
              layer: ratingData.layer || 0
            });
          } else {
            setRatings({ dwis: 0, price_value: 0, feel: 0, layer: 0 });
          }
        } else {
          setRatings({ dwis: 0, price_value: 0, feel: 0, layer: 0 });
        }

        // Fetch all ratings for product across all users to compute community average & breakdown
        const allRatingsRes = await (async () => {
          try {
            return await supabase
              .from('product_user_ratings')
              .select('dwis, price_value, feel, layer, avg')
              .eq('product_id', productId)
              .abortSignal(signal);
          } catch {
            return { data: [] };
          }
        })();

        if (!active || signal.aborted) return;
        const allRatingsData = allRatingsRes?.data;
        if (allRatingsData && allRatingsData.length > 0) {
          let sumAvg = 0, countAvg = 0;
          let sumDw = 0, countDw = 0;
          let sumPrice = 0, countPrice = 0;
          let sumFeel = 0, countFeel = 0;
          let sumLayer = 0, countLayer = 0;

          allRatingsData.forEach((r: any) => {
            if (r.avg != null) { sumAvg += Number(r.avg); countAvg++; }
            if (r.dwis != null && r.dwis > 0) { sumDw += Number(r.dwis); countDw++; }
            if (r.price_value != null && r.price_value > 0) { sumPrice += Number(r.price_value); countPrice++; }
            if (r.feel != null && r.feel > 0) { sumFeel += Number(r.feel); countFeel++; }
            if (r.layer != null && r.layer > 0) { sumLayer += Number(r.layer); countLayer++; }
          });

          setGlobalRatingsSummary({
            avg: countAvg > 0 ? Number((sumAvg / countAvg).toFixed(1)) : 0,
            dwis: countDw > 0 ? Number((sumDw / countDw).toFixed(1)) : 0,
            price_value: countPrice > 0 ? Number((sumPrice / countPrice).toFixed(1)) : 0,
            feel: countFeel > 0 ? Number((sumFeel / countFeel).toFixed(1)) : 0,
            layer: countLayer > 0 ? Number((sumLayer / countLayer).toFixed(1)) : 0,
            count: allRatingsData.length
          });
        } else {
          setGlobalRatingsSummary({ avg: 0, dwis: 0, price_value: 0, feel: 0, layer: 0, count: 0 });
        }

        // Fetch comments for product
        const commentsRes = await (async () => {
          try {
            return await supabase
              .from('product_comments')
              .select('*')
              .eq('product_id', productId)
              .order('created_at', { ascending: false })
              .abortSignal(signal);
          } catch {
            return { data: [] };
          }
        })();

        if (!active || signal.aborted) return;
        if (commentsRes?.data) {
          setComments(commentsRes.data);
        } else {
          setComments([]);
        }
      } catch (error: any) {
        if (error?.name === 'AbortError' || signal.aborted) return;
        if (trackerItem) {
          setProduct({
            id: productId,
            name: trackerItem.product_name || 'Product',
            brand: trackerItem.brand || '',
            type: trackerItem.product_type || 'Skincare',
            photo_url: trackerItem.photo_url || null
          });
          setComp({ skinTypeFit: 'General Fit', conflicts: [], benefits: [], safetyConcerns: [] });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchEcosystemViaRPC();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [productId]);

  if (loading) return (
    <div className="bg-white/95 rounded-3xl p-12 shadow-2xl max-w-md w-full relative flex flex-col items-center justify-center gap-4 border border-black/5 min-h-[350px]">
      <button 
        type="button" 
        aria-label="Close" 
        className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer" 
        onClick={onClose}
      >
        <X className="w-4 h-4"/>
      </button>
      <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-wider text-black">Analyzing Ingredients...</p>
        <p className="text-[10px] text-black/50 mt-1 font-mono">Running database skin engine compatibility checks</p>
      </div>
    </div>
  );

  if (rpcErrorObj) return (
    <div className="bg-white/95 rounded-3xl p-6 shadow-2xl max-w-md w-full relative border border-red-500/10">
      <button 
        type="button" 
        aria-label="Close" 
        className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer" 
        onClick={onClose}
      >
        <X className="w-4 h-4"/>
      </button>
      <div className="flex flex-col gap-3 text-left pr-8">
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
    <div className="bg-white rounded-3xl p-8 relative text-center font-bold max-w-md w-full shadow-2xl border border-gray-100">
      <button 
        type="button" 
        aria-label="Close" 
        className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer" 
        onClick={onClose}
      >
        <X className="w-4 h-4"/>
      </button>
      Product not found.
    </div>
  );

  const displayIngredients = isIngredientsExpanded ? (product.ingredients || []) : (product.ingredients || []).slice(0, 5);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full relative max-h-[90vh] overflow-y-auto border border-gray-100 space-y-3">
      {/* Dedicated close button with circular touch target and high z-index */}
      <button 
        type="button"
        aria-label="Close modal"
        className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer shadow-2xs" 
        onClick={onClose}
      >
        <X className="w-4 h-4"/>
      </button>
      
      {/* Unauthenticated banner prompt - fits neatly on top with clear spacing so it is not obstructed by the close button */}
      {!isAuthenticated && (
        <div className="pb-4 border-b border-gray-100 text-center space-y-2.5 mb-2 pt-1 px-4 sm:px-6">
          <p className="text-sm font-bold text-black leading-snug max-w-[270px] mx-auto">
            Take skin quiz or log in to find out if these products fit your skin
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('open-quiz-or-login'));
            }}
            className="w-full bg-black text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black/80 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-xs"
          >
            Take skin quiz
          </button>
          <div className="text-center pt-0.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('open-login-modal'));
              }}
              className="text-xs font-bold text-black underline hover:text-venus-accent cursor-pointer bg-transparent border-none p-0 inline-block"
            >
              Log in
            </button>
          </div>
        </div>
      )}

      {/* Product Header (Image left, Brand/Name/Type right) with right padding to clear the close button */}
      {(() => {
        const imgSrc = !imageError && (product.photo_url || trackerItem?.photo_url || product.image_url || product.image || product.photo);
        return (
          <div className="flex items-start gap-4 pr-10 pt-1">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={product.name || trackerItem?.product_name || 'Product'}
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
                className="w-16 h-16 object-cover rounded-2xl flex-shrink-0 border border-black/5 bg-gray-50 shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 border border-black/5">
                <ShoppingBag className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-0.5">
                {product.brand || trackerItem?.brand || 'Brand'}
              </span>
              <h3 className="text-sm font-black text-black leading-tight break-words">
                {product.name || trackerItem?.product_name || 'Product Name'}
              </h3>
              <span className="text-[10px] font-bold text-black/60 bg-gray-100 px-2 py-0.5 rounded-md inline-block mt-1">
                {product.type || trackerItem?.product_type || 'Skincare'}
              </span>
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

      {/* Community Average Score (Across all users) */}
      <div className="bg-purple-50/80 border border-purple-100 rounded-xl p-2.5 space-y-1.5 mt-2">
        <button
          type="button"
          onClick={() => setIsRatingsDropdownOpen(!isRatingsDropdownOpen)}
          className="w-full flex items-center justify-between text-xs font-black text-purple-950 uppercase tracking-wider cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-purple-600 text-purple-600" />
            <span>Community Rating: {globalRatingsSummary.avg > 0 ? `${globalRatingsSummary.avg} / 5` : 'No ratings yet'}</span>
            <span className="text-[10px] text-black/40 font-normal lowercase font-mono">({globalRatingsSummary.count} reviews)</span>
          </div>
          {isRatingsDropdownOpen ? <ChevronUp className="w-4 h-4 text-purple-700" /> : <ChevronDown className="w-4 h-4 text-purple-700" />}
        </button>

        {isRatingsDropdownOpen && globalRatingsSummary.count > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-200/60 text-[11px]">
            <div className="flex justify-between bg-white px-2 py-1 rounded-lg border border-purple-100">
              <span className="text-black/60 font-bold">Does What It Says:</span>
              <span className="font-mono font-black text-purple-900">{globalRatingsSummary.dwis} / 5</span>
            </div>
            <div className="flex justify-between bg-white px-2 py-1 rounded-lg border border-purple-100">
              <span className="text-black/60 font-bold">Price & Value:</span>
              <span className="font-mono font-black text-purple-900">{globalRatingsSummary.price_value} / 5</span>
            </div>
            <div className="flex justify-between bg-white px-2 py-1 rounded-lg border border-purple-100">
              <span className="text-black/60 font-bold">Texture & Feel:</span>
              <span className="font-mono font-black text-purple-900">{globalRatingsSummary.feel} / 5</span>
            </div>
            <div className="flex justify-between bg-white px-2 py-1 rounded-lg border border-purple-100">
              <span className="text-black/60 font-bold">Layerability:</span>
              <span className="font-mono font-black text-purple-900">{globalRatingsSummary.layer} / 5</span>
            </div>
          </div>
        )}
      </div>

      {/* Discrete Compare Button */}
      <div className="pt-0.5 flex items-center justify-between">
        <button
          type="button"
          onClick={handleCompareClick}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-black rounded-lg transition-colors border border-gray-200/80 cursor-pointer shadow-2xs group"
          title="Compare this product side-by-side with another"
        >
          <ArrowLeftRight className="w-3 h-3 text-gray-500 group-hover:text-black transition-colors" />
          <span>Compare</span>
        </button>
        {isCompared && (
          <span className="text-[9px] font-mono uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200/70 px-2 py-0.5 rounded-md font-bold">
            {comparedSide === 'left' ? 'Product A' : 'Product B'}
          </span>
        )}
      </div>

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
                      if (isClickable) {
                        setExpandedBenefitFlag(isExpanded ? null : benefit);
                      } else {
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
                      if (isClickable) {
                        setExpandedIrritantFlag(isExpanded ? null : concern);
                      } else {
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

      {/* User Ratings Section */}
      <div className="border-t pt-4 mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-xs uppercase tracking-widest text-black/60">My Product Ratings</h3>
          {!isAuthenticated && (
            <span className="text-[9px] text-black/40 font-bold italic">Log in to save ratings</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
          {[
            { key: 'dwis', label: 'Does What It Says' },
            { key: 'price_value', label: 'Price & Value' },
            { key: 'feel', label: 'Texture & Feel' },
            { key: 'layer', label: 'Layerability' },
          ].map(criterion => (
            <div key={criterion.key} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-black/70">{criterion.label}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => {
                  const currentVal = ratings[criterion.key as keyof typeof ratings] || 0;
                  const isFilled = star <= currentVal;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleUpdateRating(criterion.key, star)}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                        isFilled 
                          ? 'bg-black text-white shadow-xs' 
                          : 'bg-white text-black/40 border border-gray-200 hover:border-black/40 hover:text-black'
                      }`}
                    >
                      {star}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comments Section */}
      <div className="border-t pt-4 mt-4 space-y-3">
        <h3 className="font-black text-xs uppercase tracking-widest text-black/60">Comments</h3>
        
        {/* Comment Input */}
        <div className="space-y-2">
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder={isAuthenticated ? "Share your thoughts or experience with this product..." : "Log in to leave a comment..."}
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-medium focus:ring-black focus:border-black outline-none resize-none placeholder:text-gray-400 text-black"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveComment}
              disabled={isSubmittingComment || !newCommentText.trim()}
              className="py-1.5 px-4 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-venus-accent transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmittingComment ? 'Saving...' : 'Save Comment'}
            </button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {comments && comments.length > 0 ? (
            comments.map((comm: any, idx: number) => (
              <div key={comm.id || idx} className="p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-black/40 font-mono">
                  <span>User {comm.user_id ? `${comm.user_id.slice(0, 6)}...` : 'Anonymous'}</span>
                  <span>{comm.created_at ? new Date(comm.created_at).toLocaleDateString() : 'Just now'}</span>
                </div>
                <p className="text-black/80 font-medium whitespace-pre-line break-words">
                  {comm.comment}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-black/40 italic text-center py-2">No comments yet. Be the first to share your review!</p>
          )}
        </div>
      </div>

      {/* Unauthenticated Compare Auth Popup */}
      {showAuthModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[250] flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            e.stopPropagation();
            setShowAuthModal(false);
          }}
        >
          <div 
            className="relative w-full max-w-md my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 bg-black text-white py-2 px-4 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                <span>Sign in or Sign Up to compare products</span>
              </div>
              <button 
                type="button" 
                aria-label="Close" 
                onClick={() => setShowAuthModal(false)}
                className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative">
              <button 
                type="button" 
                aria-label="Close" 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <Login
                isSignUp={isAuthModalSignUp}
                setIsSignUp={setIsAuthModalSignUp}
                onSuccess={() => {
                  setShowAuthModal(false);
                  setIsAuthenticated(true);
                  setShowSearchModal(true);
                  loadInitialSuggestions();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Authenticated Compare Search Bar Popup (using fts_search) */}
      {showSearchModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[250] flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowSearchModal(false);
          }}
        >
          <div 
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full relative max-h-[85vh] flex flex-col border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              type="button" 
              aria-label="Close search" 
              onClick={() => setShowSearchModal(false)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-8 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-black">
                  Compare Products
                </h3>
              </div>
              <p className="text-xs text-black/60">
                Search our product catalog to compare side-by-side with <span className="font-bold text-black">{product?.name || 'this product'}</span>
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-black/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by brand or product name (fts_search)..."
                className="w-full bg-black/5 border-2 border-transparent focus:border-black rounded-2xl pl-10 pr-9 py-2.5 text-xs font-semibold outline-none transition-all placeholder:text-black/40 text-black"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Search Results using fts_search */}
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[160px] max-h-[45vh] pr-1">
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-black/40">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">Searching database...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectCompareProduct(item.id)}
                    className="w-full p-2.5 bg-gray-50 hover:bg-purple-50/70 border border-gray-100 hover:border-purple-200 rounded-2xl flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 object-cover rounded-xl border border-black/5 flex-shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white border border-black/5 flex items-center justify-center flex-shrink-0 text-gray-400">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block truncate">
                        {item.brand || 'Brand'}
                      </span>
                      <h4 className="text-xs font-bold text-black truncate group-hover:text-purple-700 transition-colors">
                        {item.name}
                      </h4>
                      {item.type && (
                        <span className="text-[8px] font-bold text-black/60 bg-white border border-black/5 px-1.5 py-0.2 rounded-md inline-block mt-0.5">
                          {item.type}
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 group-hover:bg-purple-200 px-2.5 py-1 rounded-xl transition-colors">
                        Compare
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-10 text-center text-black/40 text-xs font-medium">
                  {searchQuery ? (
                    <>No products found matching "{searchQuery}". Try searching for another brand or product name.</>
                  ) : (
                    <>Type a brand or product name to search...</>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ProductCard = () => {
  const { 
    isOpen, 
    closeProductCard, 
    productId, 
    compareProductId, 
    trackerItem,
    closeComparison,
    openProductCard,
    openComparison
  } = useProductCard();

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
      className={`fixed inset-0 bg-black/50 backdrop-blur-xs z-[200] flex items-center justify-center ${
        compareProductId ? 'p-1 sm:p-4' : 'p-3 sm:p-4'
      } overflow-y-auto`}
      onClick={closeProductCard}
    >
      {compareProductId ? (
        <ProductComparisonTable
          productId1={String(productId)}
          productId2={String(compareProductId)}
          trackerItem1={trackerItem}
          onClose={closeProductCard}
          onCloseProduct1={() => openProductCard(String(compareProductId))}
          onCloseProduct2={closeComparison}
          onSwapProduct={(targetSlot, newId) => {
            if (targetSlot === 'product1') {
              openComparison(newId, String(compareProductId));
            } else {
              openComparison(String(productId), newId);
            }
          }}
        />
      ) : (
        <div className="w-full max-w-md flex justify-center" onClick={(e) => e.stopPropagation()}>
          <ProductCardContent productId={String(productId)} trackerItem={trackerItem} onClose={closeProductCard} />
        </div>
      )}
    </div>
  );
};