import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertTriangle, Heart, RefreshCw, Calendar, HelpCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProductCard } from '../context/ProductCardContext';

// Concern ID mapping dictionary for displaying user-friendly text labels
const CONCERN_MAP: Record<number, string> = {
  1: 'Acne & Scars',
  2: 'Redness',
  3: 'Dark Spots',
  4: 'Dullness',
  5: 'Dryness',
  6: 'Oiliness',
  7: 'Wrinkles & Fine Lines',
  8: 'Pores & Texture',
  9: 'Sensitivity',
  10: 'Eczema',
  11: 'Fungal Acne',
  12: 'Not Sure'
};

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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;
        
        setIsAuthenticated(!!session?.user?.id);

        // Always invoke database engine calculation via a clean RPC function call
        // For unauthenticated users, the RPC will safely return base product info
        const { data, error } = await supabase.rpc('evaluate_product_compatibility', {
          p_user_id: session?.user?.id || '00000000-0000-0000-0000-000000000000',
          p_product_id: productId
        });

        if (!active) return;

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
            setRpcErrorObj(data);
          } else {
            let effectiveComp = data.compatibility;
            if (!effectiveComp) {
              const s = data.scores || {};
              const p = data.product || {};
              const benefits: string[] = [];
              const safetyConcerns: string[] = [];

              if (s.calm_redness_dry_skin > 0 || s.calm_redness_oily_skin > 0 || s.calm_redness_combi_skin > 0 || p.name?.toLowerCase().includes('redness') || p.description?.toLowerCase().includes('redness')) {
                benefits.push('Calms facial redness');
              }
              if (s.barrier_repair_dry_skin > 0 || s.barrier_repair_oily_skin > 0 || s.barrier_repair_combi_skin > 0 || p.name?.toLowerCase().includes('barrier') || p.description?.toLowerCase().includes('barrier')) {
                benefits.push('Repairs skin barrier');
              }
              if (s.hydration_dry_skin > 0 || s.hydration_oily_skin > 0 || s.hydration_combi_skin > 0) {
                benefits.push('Deep hydration');
              }
              if (s.reduce_wrinkles > 0) {
                benefits.push('Smooths fine lines & wrinkles');
              }
              if (s.has_brightening_ingredient) {
                benefits.push('Brightens skin tone & fades dark spots');
              }
              if (s.clear_blackheads > 0 || s.clear_surface_acne > 0) {
                benefits.push('Clears pores & blemishes');
              }
              if (benefits.length === 0) {
                benefits.push('Balances skin & maintains health');
              }

              if (s.contains_frag || s.has_fragrance_top50) {
                safetyConcerns.push('Contains Fragrance');
              }
              if (s.has_fungal_trigger) {
                safetyConcerns.push('Fungal Acne Trigger');
              }
              if (s.has_high_irritation) {
                safetyConcerns.push('High Irritation Risk');
              }
              if (s.uv_sensitivity_required) {
                safetyConcerns.push('Requires UV Sunscreen Protection');
              }
              if (s.night) {
                safetyConcerns.push('Photosensitizing Active (Use PM Only)');
              }

              effectiveComp = {
                skinTypeFit: 'Compatible Formula',
                conflicts: [],
                benefits,
                safetyConcerns
              };
            } else {
              const s = data.scores || {};
              const concerns = [...(effectiveComp.safetyConcerns || [])];
              if ((s.contains_frag || s.has_fragrance_top50) && !concerns.some(c => c.toLowerCase().includes('fragrance'))) {
                concerns.push('Contains Fragrance');
              }
              if (s.has_fungal_trigger && !concerns.some(c => c.toLowerCase().includes('fungal'))) {
                concerns.push('Fungal Acne Trigger');
              }
              if (s.has_high_irritation && !concerns.some(c => c.toLowerCase().includes('irritation'))) {
                concerns.push('High Irritation Risk');
              }
              if (s.uv_sensitivity_required && !concerns.some(c => c.toLowerCase().includes('uv') || c.toLowerCase().includes('sunscreen'))) {
                concerns.push('Requires UV Sunscreen Protection');
              }
              if (s.night && !concerns.some(c => c.toLowerCase().includes('night') || c.toLowerCase().includes('photosensitizing'))) {
                concerns.push('Photosensitizing Active (Use PM Only)');
              }
              effectiveComp.safetyConcerns = concerns;
            }

            const effectiveScores = data.scores || {
              oil_free: true,
              sulfate_free: true,
              contains_frag: false,
              has_fragrance_top50: false,
              has_fungal_trigger: false,
              night: false
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
    <div className="bg-white rounded-2xl p-4 shadow-2xl max-w-md w-full relative max-h-[90vh] overflow-y-auto border border-gray-100">
      <button className="absolute top-4 right-4 text-gray-400 hover:text-black transition" onClick={onClose}>
        <X className="w-5 h-5"/>
      </button>
      
      {/* Product Metadata Header */}
      <p className="text-[10px] font-black uppercase tracking-widest text-purple-600 mb-1">{product.brand || 'Unknown Brand'}</p>
      <h2 className="text-xl font-black mb-1 text-black">{product.name || 'Unnamed Product'}</h2>
      {product.type && <p className="text-xs text-gray-400 mb-4 uppercase tracking-wider font-medium">{product.type}</p>}
      
      {product.description && (
        <p className="text-xs text-gray-600 mb-5 leading-relaxed">{product.description}</p>
      )}



      {comp && (
        <div className="space-y-4 border-t pt-4 mb-5">
          <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">Personal Compatibility Analysis</h3>
          {/* Skin Type Fit Badge */}
          <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-xs font-bold text-gray-700">Skin Type Fit {userProfile?.skin_type ? `(${userProfile.skin_type})` : ''}:</span>
            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide border ${
              comp.skinTypeFit === 'Good Fit' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              comp.skinTypeFit === 'Bad Fit' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'
            }`}>
              {comp.skinTypeFit || 'Compatible'}
            </span>
          </div>



          {/* Routine Layering Conflicts */}
          {comp.conflicts && comp.conflicts.length > 0 && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-xl space-y-1.5">
              <p className="text-[10px] font-black text-red-800 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> Layering & System Blockers
              </p>
              <ul className="text-[11px] text-red-950 font-medium list-disc list-inside space-y-1 leading-normal">
                {comp.conflicts.map((conflict: string, i: number) => <li key={i}>{conflict}</li>)}
              </ul>
            </div>
          )}

          {/* Targeted Skin Benefit System Tags */}
          {comp.benefits && comp.benefits.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Targeted Functions Achieved</p>
              <div className="flex flex-wrap gap-1.5">
                {comp.benefits.map((benefit: string, idx: number) => (
                  <span key={idx} className="bg-purple-50 text-purple-700 border border-purple-100 rounded-lg px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-purple-500" /> {benefit}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Explicit Safety Concerns warnings block */}
          {comp.safetyConcerns && comp.safetyConcerns.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1.5">Triggers & Reactive Markers</p>
              <div className="flex flex-wrap gap-1.5">
                {comp.safetyConcerns.map((concern: string, idx: number) => (
                  <span key={idx} className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> {concern}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- PERSONAL COMPATIBILITY SUITE VIEW (POPULATED VIA RPC) --- */}
      <div className="border-t pt-4 mb-5">
        <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-3">My Ratings</h3>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-1.5">
          {!isAuthenticated && (
            <div className="text-[10px] text-gray-500 italic mb-2 text-center">Log in to save your personal ratings.</div>
          )}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <RatingSlider 
              label="Does what it says?" 
              value={ratings.dwis} 
              onChange={(val) => handleUpdateRating('dwis', val)} 
              tooltipText="(Red: no / Yellow: it's ok / Green: amazing)"
              disabled={!isAuthenticated}
            />
            <RatingSlider 
              label="Price / Value" 
              value={ratings.price_value} 
              onChange={(val) => handleUpdateRating('price_value', val)} 
              tooltipText="(Red: Not worth it / Yellow: it's ok / Green: bargain)"
              disabled={!isAuthenticated}
            />
            <RatingSlider 
              label="Feel" 
              value={ratings.feel} 
              onChange={(val) => handleUpdateRating('feel', val)} 
              tooltipText="(Red: greasy / Yellow: matte / Green: dewy)"
              disabled={!isAuthenticated}
            />
            <RatingSlider 
              label="Layering" 
              value={ratings.layer} 
              onChange={(val) => handleUpdateRating('layer', val)} 
              tooltipText="(Red: piles / Yellow: ok / Green: seamless)"
              disabled={!isAuthenticated}
            />
          </div>
        </div>
      </div>

      
      {/* --- TRACKER CONTROLS --- */}
      {trackerItem && (
        <div className="border-t pt-4 mb-5 space-y-4">
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

      {/* --- FORMULA FREE-FROM CLAIMS "WHAT'S INSIDE" --- */}
      {scores && (
        <div className="border-t pt-4 mb-5">
          <h3 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-2">Formula Properties</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-500 font-medium">Oil-Free</span>
              <span className={`font-bold ${scores.oil_free ? 'text-emerald-600' : 'text-gray-400'}`}>{scores.oil_free ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center justify-between bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-500 font-medium">Sulfate-Free</span>
              <span className={`font-bold ${scores.sulfate_free ? 'text-emerald-600' : 'text-gray-400'}`}>{scores.sulfate_free ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center justify-between bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-500 font-medium">Fragrance-Free</span>
              <span className={`font-bold ${(!scores.contains_frag && !scores.has_fragrance_top50) ? 'text-emerald-600' : 'text-gray-400'}`}>
                {(!scores.contains_frag && !scores.has_fragrance_top50) ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-lg text-xs">
              <span className="text-gray-500 font-medium">Fungal Acne Safe</span>
              <span className={`font-bold ${!scores.has_fungal_trigger ? 'text-emerald-600' : 'text-gray-400'}`}>{!scores.has_fungal_trigger ? 'Yes' : 'No'}</span>
            </div>
          </div>
          {scores.night && (
            <div className="mt-2 text-[10px] bg-slate-900 text-slate-100 p-2 rounded-lg font-bold uppercase tracking-wider text-center">
              🌙 PM Routine Optimization Only (Contains Photosensitizing Actives)
            </div>
          )}
        </div>
      )}

      {/* --- INGREDIENTS ACCORDION --- */}
      <div className="border-t pt-4">
        <h3 className="font-black text-xs uppercase mb-2 tracking-widest text-gray-400">Ingredients ({product.ingredients?.length || 0})</h3>
        {product.ingredients && product.ingredients.length > 0 ? (
          <>
            <ul className="text-[11px] text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100 list-decimal pl-6">
              {displayIngredients.map((ingredient: string, index: number) => (
                <li key={index} className="pl-1">
                  <span className="font-medium text-gray-900">{ingredient}</span> 
                  {index < 5 && <span className="text-[9px] text-purple-500 font-mono ml-1 uppercase font-bold">[Base Compound]</span>}
                </li>
              ))}
            </ul>
            {product.ingredients.length > 5 && (
              <button
                className="mt-2.5 flex items-center text-xs font-black text-purple-600 transition hover:text-purple-800"
                onClick={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
              >
                {isIngredientsExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 mr-1" /> View complete breakdown ({product.ingredients.length - 5} more)
                  </>
                )}
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400 italic">Ingredient transparency listing unavailable.</p>
        )}
      </div>
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