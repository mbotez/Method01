import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProductCard } from '../context/ProductCardContext';
import { evaluateProductCategory } from '../utils/productCategoryEvaluator';

export const ProductCardContent = ({ productId, onClose }: { productId: string, onClose: () => void }) => {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isIngredientsExpanded, setIsIngredientsExpanded] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      
      const [productRes, descriptionRes] = await Promise.all([
        supabase.from('products').select('name, brand, type').eq('id', productId).maybeSingle(),
        supabase.from('product_description').select('description, ingredients_list').eq('id', productId).maybeSingle()
      ]);
      
      console.log('Product fetch debug:', { productId, productRes, descriptionRes });

      if (productRes.data) {
        const ingredientsRaw = descriptionRes.data?.ingredients_list || [];
        const ingredientsList = Array.isArray(ingredientsRaw)
          ? ingredientsRaw
          : typeof ingredientsRaw === 'string'
          ? ingredientsRaw.split(',').map((i: string) => i.trim()).filter(Boolean)
          : [];

        setProduct({
          ...productRes.data,
          ingredients: ingredientsList,
          description: descriptionRes.data?.description || ''
        });

        // Run skin profile evaluation dynamically if user is logged in
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) {
            const result = await evaluateProductCategory(session.user.id, productId, ingredientsList);
            console.log('[ProductCardContent] dynamic evaluation:', result);
            setEvalResult(result);
          }
        } catch (e) {
          console.error('[ProductCardContent] Failed to run evaluateProductCategory:', e);
        }
      }
      setLoading(false);
    };

    if (productId) fetchProduct();
  }, [productId]);

  if (loading) return (
    <div className="bg-white/95 rounded-2xl p-12 shadow-2xl max-w-md w-full flex flex-col items-center justify-center gap-4 border-2 border-black/5 min-h-[250px]">
      <Loader2 className="w-10 h-10 animate-spin text-venus-accent" />
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-wider text-black">Evaluating Skin Fit...</p>
        <p className="text-[10px] text-black/50 mt-1 font-mono">Running category compatibility checks</p>
      </div>
    </div>
  );
  
  if (!product) return (
    <div className="p-6 relative">
      <button className="absolute top-4 right-4" onClick={onClose}><X className="w-5 h-5"/></button>
      Product not found.
    </div>
  );

  const ingredientsList = product.ingredients || [];
  const displayIngredients = isIngredientsExpanded ? ingredientsList : ingredientsList.slice(0, 5);

  return (
    <div className="bg-white/90 rounded-2xl p-6 shadow-2xl max-w-md w-full relative max-h-[90vh] overflow-y-auto">
      <button className="absolute top-4 right-4" onClick={onClose}><X className="w-5 h-5"/></button>
      <p className="text-[10px] font-black uppercase tracking-widest text-venus-accent mb-1">{product.brand || 'Unknown'}</p>
      <h2 className="text-xl font-black mb-2 text-black">{product.name || 'Unnamed'}</h2>
      {product.type && <p className="text-xs text-gray-500 mb-4 uppercase tracking-widest">{product.type}</p>}
      
      {product.description && (
        <p className="text-sm text-gray-600 mb-4">{product.description}</p>
      )}

      {/* Dynamic Compatibility Verdict Badge */}
      {evalResult && (
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-black/40 mb-1.5">Skin Compatibility</p>
          <div className="flex flex-wrap gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wide border ${
              evalResult.category === 'Avoid' ? 'bg-red-50 text-red-800 border-red-200' :
              evalResult.category === 'Caution' ? 'bg-amber-50 text-amber-800 border-amber-200' :
              evalResult.category === 'Recommended' ? 'bg-purple-50 text-purple-800 border-purple-200' :
              'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              Verdict: {evalResult.category}
            </span>
            
            {evalResult.potentialBreakoutRisk && (
              <span className="bg-amber-100 text-amber-950 border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wide">
                Potential Breakout Risk
              </span>
            )}
          </div>
        </div>
      )}

      {/* Detailed Breakout Risk Box */}
      {evalResult?.potentialBreakoutRisk && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-4 space-y-2">
          <p className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
            ⚠️ Potential Breakout Risk Details
          </p>
          
          {evalResult.potentialBreakoutIngredients && evalResult.potentialBreakoutIngredients.length > 0 && (
            <p className="text-xs text-amber-950/80 leading-relaxed">
              <strong className="text-amber-950">Trigger Ingredients:</strong> {evalResult.potentialBreakoutIngredients.join(', ')}
            </p>
          )}
          
          {evalResult.potentialBreakoutReasons && evalResult.potentialBreakoutReasons.length > 0 && (
            <div className="text-xs text-amber-950/85 space-y-1">
              <p className="font-semibold text-amber-950">Why this is a potential risk:</p>
              <ul className="list-disc list-inside pl-1 space-y-1 leading-relaxed">
                {evalResult.potentialBreakoutReasons.map((reason: string, i: number) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      <div className="border-t pt-4">
        <h3 className="font-black text-xs uppercase mb-2 tracking-widest text-blue-600">INGREDIENTS</h3>
        <ul className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg list-disc pl-5">
          {displayIngredients.map((ingredient: string, index: number) => (
            <li key={index}>{ingredient}</li>
          ))}
        </ul>
        {ingredientsList.length > 5 && (
          <button 
            className="mt-2 flex items-center text-xs font-bold text-venus-accent"
            onClick={() => setIsIngredientsExpanded(!isIngredientsExpanded)}
          >
            {isIngredientsExpanded ? <><ChevronUp className="w-3 h-3 mr-1" /> Show less</> : <><ChevronDown className="w-3 h-3 mr-1" /> Show more</>}
          </button>
        )}
      </div>
    </div>
  );
};

export const ProductCard = () => {
  const { isOpen, closeProductCard, productId } = useProductCard();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeProductCard();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeProductCard]);

  if (!isOpen || !productId) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
      onClick={closeProductCard}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <ProductCardContent productId={productId} onClose={closeProductCard} />
      </div>
    </div>
  );
};
