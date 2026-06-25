import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MatchedProduct } from './photo_search';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ProductResultRowProps {
  product: MatchedProduct;
}

export const ProductResultRow: React.FC<ProductResultRowProps> = ({ product }) => {
  const [description, setDescription] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIngredients, setShowIngredients] = useState(false);

  useEffect(() => {
    console.log('ProductResultRow product.id:', product.id);
    const fetchDetails = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_description')
        .select('description, ingredients_list')
        .eq('id', Number(product.id))
        .maybeSingle();

      if (error) {
        console.error('Error fetching product details:', error);
        setDescription('Description unavailable.');
      } else if (data) {
        setDescription(data.description);
        setIngredients(data.ingredients_list);
      }
      setLoading(false);
    };

    fetchDetails();
  }, [product.id]);

  return (
    <div className="p-4 border-2 border-black/10 rounded-2xl hover:border-black/25 transition-all bg-white space-y-2">
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

        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-black uppercase text-black">
            {product.brand}
          </span>
          <span className="text-sm text-black/70 font-semibold">
            {product.name}
          </span>
        </div>
      </div>
      
      <p className="text-xs text-black/60 pt-2">
        {loading ? 'Loading...' : description || 'No description available.'}
      </p>

      {ingredients && (
        <div className="pt-2">
          <button
            onClick={() => setShowIngredients(!showIngredients)}
            className="flex items-center gap-1 text-xs font-bold text-black uppercase underline"
          >
            Ingredients {showIngredients ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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
