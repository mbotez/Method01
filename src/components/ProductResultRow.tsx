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

      // 2. If user is logged in and product.id is numeric (not custom-...), fetch personal compatibility via RPC
      if (user?.id && product.id && !String(product.id).startsWith('custom-')) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('evaluate_product_compatibility', {
            p_user_id: user.id,
            p_product_id: String(product.id)
          });
          if (!rpcError && rpcData && rpcData.compatibility) {
            setCompatibility(rpcData.compatibility);
          }
        } catch (e) {
          console.warn('Error fetching personal compatibility in ProductResultRow:', e);
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

      {/* Personal Compatibility Display */}
      {user ? (
        loading ? (
          <div className="text-[10px] font-black uppercase tracking-wider text-black/40 animate-pulse pt-1">
            Analyzing personal compatibility...
          </div>
        ) : compatibility ? (
          <div className="bg-black/[0.03] border border-black/10 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-black/60">Personal Compatibility</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                compatibility.skinTypeFit === 'Good Fit' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                compatibility.skinTypeFit === 'Bad Fit' ? 'bg-red-100 text-red-800 border-red-300' : 
                'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {compatibility.skinTypeFit || 'Compatible'}
              </span>
            </div>

            {compatibility.benefits && compatibility.benefits.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {compatibility.benefits.map((benefit: string, idx: number) => (
                  <span key={idx} className="bg-emerald-50 text-emerald-900 border border-emerald-200/60 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> {benefit}
                  </span>
                ))}
              </div>
            )}

            {compatibility.safetyConcerns && compatibility.safetyConcerns.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {compatibility.safetyConcerns.map((concern: string, idx: number) => (
                  <span key={idx} className="bg-amber-50 text-amber-900 border border-amber-200/60 rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600" /> {concern}
                  </span>
                ))}
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
        ) : (
          <div className="text-[10px] font-medium text-black/50 italic">
            Compatibility details will appear once your skin profile is complete.
          </div>
        )
      ) : (
        <div className="bg-venus-accent/10 border border-venus-accent/20 rounded-xl p-2.5 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-black">
            Log in or take skin quiz to see personal compatibility
          </p>
        </div>
      )}
      
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
