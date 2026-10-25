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
        
        const isAuthed = !!session?.user?.id;
        setIsAuthenticated(isAuthed);

        const targetUserId = session?.user?.id || '00000000-0000-0000-0000-000000000000';

        // Always invoke database engine calculation via RPC for both auth and unauth users
        const { data, error } = await supabase.rpc('evaluate_product_compatibility', {
          p_user_id: targetUserId,
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
                benefits: ['Balances skin & maintains health'],
                safetyConcerns: []
              });
              setRpcErrorObj(null);
            } else {
              setRpcErrorObj(data);
            }
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
              if (s.clear_blackheads > 0 || s.clear_surface_breakouts > 0) {
                benefits.push('Clears pores & blemishes');
              }
              if (benefits.length === 0) {
                benefits.push('Balances skin & maintains health');
              }

              if (s.contains_frag || s.has_fragrance_top50) {
                safetyConcerns.push('Contains Fragrance');
              }
              if (s.has_yeast_trigger) {
                safetyConcerns.push('Yeast-induced Breakout Trigger');
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
                skinTypeFit: 'General Catalog Formula',
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
              if (s.has_yeast_trigger && !concerns.some(c => c.toLowerCase().includes('yeast'))) {
                concerns.push('Yeast-induced Breakout Trigger');
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
              has_yeast_trigger: false,
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
      <div className="flex items-start gap-4">
        {(product.photo_url || trackerItem?.photo_url) ? (
          <img
            src={product.photo_url || trackerItem?.photo_url}
            alt={product.name || 'Product'}
            referrerPolicy="no-referrer"
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

      {/* Product Description */}
      {product.description && (
        <p className="text-xs text-black/70 leading-relaxed break-words pt-1">
          {product.description}
        </p>
      )}

      {/* Key Benefits */}
      {comp?.benefits && comp.benefits.length > 0 && (
        <div className="pt-1">
          <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block mb-1">Key Benefits</span>
          <div className="flex flex-wrap gap-1">
            {comp.benefits.map((benefit: string, idx: number) => (
              <span key={idx} className="bg-purple-50 text-purple-900 border border-purple-200/60 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5 text-purple-600" /> {benefit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Potential Irritants */}
      {comp?.safetyConcerns && comp.safetyConcerns.length > 0 && (
        <div className="pt-1">
          <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block mb-1">Potential Irritants</span>
          <div className="flex flex-wrap gap-1">
            {comp.safetyConcerns.map((concern: string, idx: number) => (
              <span key={idx} className="bg-amber-50 text-amber-900 border border-amber-200/60 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600" /> {concern}
              </span>
            ))}
          </div>
        </div>
      )}

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
            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
              <span className="text-gray-500">Fragrance-Free</span>
              <span className={`font-bold ${(!scores.contains_frag && !scores.has_fragrance_top50) ? 'text-emerald-600' : 'text-gray-400'}`}>
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