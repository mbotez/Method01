import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MatchedProduct } from './photo_search';
import { ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

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

  useEffect(() => {
    const fetchDetailsAndCompatibility = async () => {
      setLoading(true);
      
      // 1. Fetch description & ingredients list
      const { data: descData } = await supabase
        .from('product_description')
        .select('description, ingredients_list')
        .eq('id', Number(product.id))
        .maybeSingle();

      if (descData) {
        setDescription(descData.description);
        setIngredients(descData.ingredients_list);
      }

      // 2. Fetch compatibility and scores for both logged in and unauthenticated users
      if (product.id && !String(product.id).startsWith('custom-') && !String(product.id).startsWith('scanned-')) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('evaluate_product_compatibility', {
            p_user_id: user?.id || '00000000-0000-0000-0000-000000000000',
            p_product_id: String(product.id)
          });
          if (!rpcError && rpcData) {
            let effComp = rpcData.compatibility;
            const s = rpcData.scores || {};
            if (!effComp) {
              const benefits: string[] = [];
              const safetyConcerns: string[] = [];
              if (s.calm_redness_dry_skin > 0 || s.calm_redness_oily_skin > 0 || s.calm_redness_combi_skin > 0) benefits.push('Calms facial redness');
              if (s.barrier_repair_dry_skin > 0 || s.barrier_repair_oily_skin > 0 || s.barrier_repair_combi_skin > 0) benefits.push('Repairs skin barrier');
              if (s.hydration_dry_skin > 0 || s.hydration_oily_skin > 0) benefits.push('Deep hydration');
              if (s.reduce_wrinkles > 0) benefits.push('Smooths fine lines & wrinkles');
              if (s.has_brightening_ingredient) benefits.push('Brightens skin tone');
              if (benefits.length === 0) benefits.push('Balances skin & maintains health');

              if (s.contains_frag || s.has_fragrance_top50) safetyConcerns.push('Contains Fragrance');
              if (s.has_fungal_trigger) safetyConcerns.push('Fungal Acne Trigger');
              if (s.has_high_irritation) safetyConcerns.push('High Irritation Risk');

              effComp = {
                skinTypeFit: 'Compatible Formula',
                conflicts: [],
                benefits,
                safetyConcerns
              };
            }
            setCompatibility({
              ...effComp,
              scores: s
            });
          }
        } catch (e) {
          console.warn('Error fetching compatibility in ProductResultRow:', e);
        }
      }

      setLoading(false);
    };

    fetchDetailsAndCompatibility();
  }, [product.id, user?.id]);

  return (
    <div className="p-4 border-2 border-black/10 rounded-2xl hover:border-black/25 transition-all bg-white space-y-3">
      <div className="flex items-start gap-4">
        {product.photo_url ? (
          <img
            src={product.photo_url}
            alt={product.name}
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
            {product.brand}
          </span>
          <span className="text-sm text-black font-black uppercase truncate">
            {product.name}
          </span>
          {product.type && (
            <span className="text-[10px] text-black/50 font-semibold uppercase">
              {product.type}
            </span>
          )}
        </div>
      </div>

      {/* Compatibility & Analysis Display (Shown for all users including unauthenticated) */}
      {loading ? (
        <div className="text-[10px] font-black uppercase tracking-wider text-black/40 animate-pulse pt-1">
          Analyzing product properties & compatibility...
        </div>
      ) : compatibility ? (
        <div className="bg-black/[0.03] border border-black/10 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Formula Compatibility Analysis</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
              compatibility.skinTypeFit === 'Good Fit' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              compatibility.skinTypeFit === 'Bad Fit' ? 'bg-red-100 text-red-800 border-red-300' : 
              'bg-amber-100 text-amber-800 border-amber-300'
            }`}>
              {compatibility.skinTypeFit || 'Compatible'}
            </span>
          </div>

          {compatibility.benefits && compatibility.benefits.length > 0 && (
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block mb-1">Targeted Functions Achieved</span>
              <div className="flex flex-wrap gap-1">
                {compatibility.benefits.map((benefit: string, idx: number) => (
                  <span key={idx} className="bg-purple-50 text-purple-900 border border-purple-200/60 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-purple-600" /> {benefit}
                  </span>
                ))}
              </div>
            </div>
          )}

          {compatibility.safetyConcerns && compatibility.safetyConcerns.length > 0 && (
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block mb-1">Triggers & Reactive Markers</span>
              <div className="flex flex-wrap gap-1">
                {compatibility.safetyConcerns.map((concern: string, idx: number) => (
                  <span key={idx} className="bg-amber-50 text-amber-900 border border-amber-200/60 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600" /> {concern}
                  </span>
                ))}
              </div>
            </div>
          )}

          {compatibility.scores && (
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
                <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
                  <span className="text-gray-500">Fragrance-Free</span>
                  <span className={`font-bold ${(!compatibility.scores.contains_frag && !compatibility.scores.has_fragrance_top50) ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {(!compatibility.scores.contains_frag && !compatibility.scores.has_fragrance_top50) ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white px-2 py-1 rounded border border-black/5">
                  <span className="text-gray-500">Fungal Acne Safe</span>
                  <span className={`font-bold ${!compatibility.scores.has_fungal_trigger ? 'text-emerald-600' : 'text-gray-400'}`}>{!compatibility.scores.has_fungal_trigger ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          )}

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
      ) : null}
      
      <p className="text-xs text-black/60 pt-1">
        {loading ? 'Loading...' : description || 'No description available.'}
      </p>

      {ingredients && (
        <div className="pt-1">
          <button
            onClick={() => setShowIngredients(!showIngredients)}
            className="flex items-center gap-1 text-[10px] font-black text-black uppercase underline cursor-pointer"
          >
            Ingredients {showIngredients ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showIngredients && (
            <p className="text-xs text-black/60 mt-1 bg-black/5 p-2 rounded-lg">
              {ingredients}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
