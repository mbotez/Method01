import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

export const ProductDetailModalNew = ({ product, onClose }: { product: any, onClose: () => void }) => {
  console.log('Rendering ProductDetailModalNew for:', product);
  const [isIngredientsExpanded, setIsIngredientsExpanded] = useState(false);
  if (!product) return null;

  const ingredientsRaw = product.ingredients;
  const ingredientsList = Array.isArray(ingredientsRaw)
    ? ingredientsRaw
    : typeof ingredientsRaw === 'string'
    ? ingredientsRaw.split(', ')
    : [];
  const displayIngredients = isIngredientsExpanded ? ingredientsList : ingredientsList.slice(0, 5);

  const positiveMetrics = ['Barrier repair', 'Hydration', 'Soothing', 'Brightening', 'Firm & smooth', 'Sun protection'];
  const negativeMetrics = ['Breakouts', 'Irritation'];

  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center p-4">
      <div className="bg-white/90 rounded-2xl p-6 shadow-2xl max-w-md w-full relative max-h-[90vh] overflow-y-auto">
        <button className="absolute top-4 right-4" onClick={onClose}><X className="w-5 h-5"/></button>
        <p className="text-[10px] font-black uppercase tracking-widest text-venus-accent mb-1">{product.brand || product.Brand || 'Unknown'}</p>
        <h2 className="text-xl font-black mb-4 text-black">{product.name || product.product_name || product.Name || product.ProductName || product['Product Name'] || 'Unnamed'}</h2>

        <div className="mb-4">
          <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Benefits</p>
          <div className="flex flex-wrap gap-2">
            {positiveMetrics.map(label => (
              <span key={label} className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{label} 0/5</span>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Risks</p>
          <div className="flex flex-wrap gap-2">
            {negativeMetrics.map(label => (
              <span key={label} className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{label} 0/5</span>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 mt-6 pt-4 mb-6">
          <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Suitable for</p>
          <div className="text-xs text-gray-700 leading-relaxed space-y-1">
            <p><span className="font-semibold text-gray-900">Skin type:</span> Dry, Normal, Combination, All</p>
            <p><span className="font-semibold text-gray-900">Concerns:</span> Acne, Redness, Dry skin</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-black text-xs uppercase mb-2 tracking-widest text-blue-600">FORMULA BREAKDOWN</h3>
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
    </div>
  );
};
