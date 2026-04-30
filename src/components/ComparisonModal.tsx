import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  product_name: string;
  personal_score: number;
}

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  newProduct: any;
  onComplete: (score: number, isBest: boolean) => void;
  userId: string;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose, newProduct, onComplete, userId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [low, setLow] = useState(0);
  const [high, setHigh] = useState(0);
  const [mid, setMid] = useState(0);
  const [loading, setLoading] = useState(true);
  const comparisonCountRef = useRef(0);

  useEffect(() => {
    if (isOpen && newProduct) {
      fetchProducts();
    }
  }, [isOpen, newProduct]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('upp')
      .select('id, product_name, personal_score, impression')
      .eq('user_id', userId)
      .eq('category', 'Used')
      .eq('impression', newProduct.impression) // Ensure newProduct exists
      .neq('id', newProduct.id) // Exclude the new product itself
      .order('personal_score', { ascending: true });
    
    if (data && data.length > 0) {
      setProducts(data);
      setLow(0);
      setHigh(data.length - 1);
      setMid(Math.floor((0 + data.length - 1) / 2));
      comparisonCountRef.current = 0;
    } else {
      // No products to compare against, assign default score
      onComplete(5.0);
    }
    setLoading(false);
  };

  const handleComparison = async (userChoosesNewProduct: boolean) => {
    comparisonCountRef.current += 1;
    const currentMidProduct = products[mid];

    let nextLow = low;
    let nextHigh = high;

    if (userChoosesNewProduct) {
      nextLow = mid + 1;
    } else {
      nextHigh = mid - 1;
    }

    if (nextLow > nextHigh) {
      let finalScore = 5.0;
      let isBest = false;
      
      const lowerProduct = nextHigh >= 0 ? products[nextHigh] : null;
      const upperProduct = nextLow < products.length ? products[nextLow] : null;
      const maxScore = products.length > 0 ? products[products.length - 1].personal_score : 0;

      // Req 1: If top
      if (nextLow >= products.length) {
        finalScore = maxScore + 0.3;
        isBest = true;
      }
      // Req 2: If compared only once (first comp) and chose old
      else if (comparisonCountRef.current === 1 && !userChoosesNewProduct) {
        finalScore = currentMidProduct.personal_score - 0.2;
        isBest = false;
      }
      // Req 3: Midpoint
      else {
        if (!lowerProduct && upperProduct) finalScore = upperProduct.personal_score - 1;
        else if (lowerProduct && !upperProduct) finalScore = lowerProduct.personal_score + 1;
        else if (lowerProduct && upperProduct) finalScore = (lowerProduct.personal_score + upperProduct.personal_score) / 2;
        else finalScore = 5.0;
        
        isBest = finalScore > maxScore;
      }

      onComplete(finalScore, isBest);
    } else {
      setLow(nextLow);
      setHigh(nextHigh);
      setMid(Math.floor((nextLow + nextHigh) / 2));
    }
  };

  if (!isOpen || loading) return null;

  const currentComparisonProduct = products[mid];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <motion.div className="bg-white p-8 rounded-3xl w-full max-w-sm space-y-6">
        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-black">Compare</h2>
        <p className="text-sm text-black/60">Which product do you prefer?</p>
        
        <div className="flex gap-4">
            <button 
              onClick={() => handleComparison(true)}
              className="flex-1 p-4 border rounded-2xl text-xs font-semibold"
            >
              {newProduct.product_name}
            </button>
            <button 
              onClick={() => handleComparison(false)}
              className="flex-1 p-4 border rounded-2xl text-xs font-semibold"
            >
              {currentComparisonProduct.product_name}
            </button>
        </div>

        <button onClick={onClose} className="w-full text-xs font-black uppercase tracking-widest hover:opacity-50">Skip</button>
      </motion.div>
    </div>
  );
};
