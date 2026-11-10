import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MatchedProduct } from './photo_search';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Shield, ShoppingBag } from 'lucide-react';
import { computeProductKeyBenefits, computeProductPotentialIrritants, getMetricNamesForFlag } from './ProductCard';

interface ProductResultRowProps {
  product: MatchedProduct;
  user?: any;
}

export const ProductResultRow: React.FC<ProductResultRowProps> = ({ product, user }) => {
  const [description, setDescription] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string | null>(null);
  const [compatibility, setCompatibility] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showIngredients, setShowIngredients] = useState(false);
  const [culprits, setCulprits] = useState<any[]>([]);
  const [expandedBenefitFlag, setExpandedBenefitFlag] = useState<string | null>(null);
  const [expandedIrritantFlag, setExpandedIrritantFlag] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchDetailsAndCompatibility = async () => {
      setLoading(true);
      setExpandedBenefitFlag(null);
      setExpandedIrritantFlag(null);
      setCulprits([]);

      try {
        // 1. Fetch description & ingredients list
        const { data: descData } = await supabase
          .from('product_description')
          .select('description, ingredients_list')
          .eq('id', Number(product.id))
          .abortSignal(signal)
          .maybeSingle();

        if (isMounted && !signal.aborted && descData) {
          setDescription(descData.description);
          setIngredients(descData.ingredients_list);
        }

        // 2. Fetch culprits
        const numericId = Number(product.id);
        if (!isNaN(numericId) && isMounted && !signal.aborted) {
          const { data: cData } = await supabase
            .from('product_metric_culprits')
            .select('product_id, metric_name, ingredient_name, position, ingredient_id')
            .eq('product_id', numericId)
            .order('position', { ascending: true })
            .abortSignal(signal);

          if (isMounted && !signal.aborted && cData) {
            setCulprits(cData);
          }
        }

        // 3. Fetch compatibility and scores for both logged in and unauthenticated users
        if (product.id && !String(product.id).startsWith('custom-') && !String(product.id).startsWith('scanned-') && isMounted && !signal.aborted) {
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('evaluate_product_compatibility', {
              p_user_id: user?.id || '00000000-0000-0000-0000-000000000000',
              p_product_id: String(product.id)
            })
            .abortSignal(signal);

          if (isMounted && !signal.aborted && !rpcError && rpcData) {
            const s = rpcData.scores || {};
            const p = rpcData.product || product;
            const formulaBenefits = computeProductKeyBenefits(p, s, rpcData.compatibility?.benefits);
            const formulaConcerns = computeProductPotentialIrritants(s, rpcData.compatibility?.safetyConcerns);

            const effComp = {
              ...(rpcData.compatibility || {
                skinTypeFit: 'Compatible Formula',
                conflicts: []
              }),
              benefits: formulaBenefits,
              safetyConcerns: formulaConcerns,
              scores: s
            };

            setCompatibility(effComp);
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) return;
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetailsAndCompatibility();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [product.id, user?.id]);

  return (
    <div className="p-4 border-2 border-black/10 rounded-2xl hover:border-black/25 transition-all bg-white space-y-3">
      {(() => {
        const imgSrc = product.photo_url || product.image_url || product.image || product.photo;
        return (
          <div className="flex items-start gap-4">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 object-cover rounded-2xl flex-shrink-0 border border-black/5"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-0.5">
                {product.brand}
              </span>
              <h3 className="text-sm font-black text-black leading-tight truncate">
                {product.name}
              </h3>
              <span className="text-[10px] font-bold text-black/60 bg-gray-100 px-2 py-0.5 rounded-md inline-block mt-1">
                {product.type || 'Skincare'}
              </span>
            </div>
          </div>
        );
      })()}

      <p className="text-xs text-black/70 leading-relaxed break-words pt-1">
        {loading ? 'Loading...' : description || 'No description available.'}
      </p>

      {/* Key Benefits (Visible to all users) */}
      {compatibility?.benefits && compatibility.benefits.length > 0 && (() => {
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
              {compatibility.benefits.map((benefit: string, idx: number) => {
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

      {/* Potential Irritants (Visible to all users) */}
      {compatibility?.safetyConcerns && compatibility.safetyConcerns.length > 0 && (() => {
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
              {compatibility.safetyConcerns.map((concern: string, idx: number) => {
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


      {/* Formula Properties (Visible to all users) */}
      {compatibility?.scores && (
        <div className="pt-1 border-t border-black/5">
          <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block mb-1">Formula Properties</span>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
              <span className="text-gray-500">Oil-Free</span>
              <span className={`font-bold ${compatibility.scores.oil_free ? 'text-emerald-600' : 'text-gray-400'}`}>{compatibility.scores.oil_free ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
              <span className="text-gray-500">Sulfate-Free</span>
              <span className={`font-bold ${compatibility.scores.sulfate_free ? 'text-emerald-600' : 'text-gray-400'}`}>{compatibility.scores.sulfate_free ? 'Yes' : 'No'}</span>
            </div>
            <div 
              onClick={() => {
                const scores = compatibility?.scores || {};
                const isFragFree = !scores.contains_frag && !scores.has_fragrance_top50;
                if (!isFragFree) {
                  setExpandedIrritantFlag(expandedIrritantFlag === 'Contains Fragrance' ? null : 'Contains Fragrance');
                }
              }}
              className={`flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5 ${(!compatibility?.scores?.contains_frag && !compatibility?.scores?.has_fragrance_top50) ? '' : 'cursor-pointer hover:bg-amber-50/60 transition-colors'}`}
            >
              <span className="text-gray-500">Fragrance-Free</span>
              <span className={`font-bold ${(!compatibility?.scores?.contains_frag && !compatibility?.scores?.has_fragrance_top50) ? 'text-emerald-600' : 'text-amber-700 underline'}`}>
                {(!compatibility?.scores?.contains_frag && !compatibility?.scores?.has_fragrance_top50) ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
              <span className="text-gray-500">Malassezia Safe</span>
              <span className={`font-bold ${!compatibility.scores.has_yeast_trigger ? 'text-emerald-600' : 'text-gray-400'}`}>{!compatibility.scores.has_yeast_trigger ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Formula Compatibility Analysis / Analysis Section (Visible ONLY when user is logged in) */}
      {user && (
        loading ? (
          <div className="text-[10px] font-black uppercase tracking-wider text-black/40 animate-pulse pt-1">
            Analyzing product properties & compatibility...
          </div>
        ) : compatibility ? (
          <div className="bg-black/[0.03] border border-black/10 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Skin Compatibility</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                compatibility.skinTypeFit === 'Good Fit' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                compatibility.skinTypeFit === 'Bad Fit' ? 'bg-red-100 text-red-800 border-red-300' : 
                'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {compatibility.skinTypeFit || 'Compatible'}
              </span>
            </div>

            {compatibility.conflicts && compatibility.conflicts.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {compatibility.conflicts.map((conflict: string, idx: number) => (
                  <span key={idx} className="bg-red-50 text-red-900 border border-red-200/60 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-red-600" /> {conflict}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null
      )}

      {ingredients && (
        <div className="pt-1">
          <button
            onClick={() => setShowIngredients(!showIngredients)}
            className="flex items-center gap-1 text-[10px] font-black text-black uppercase underline cursor-pointer"
          >
            Ingredients {showIngredients ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showIngredients && (
            <p className="text-xs text-black/60 mt-1 bg-black/5 p-2 rounded-lg break-words">
              {ingredients}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
