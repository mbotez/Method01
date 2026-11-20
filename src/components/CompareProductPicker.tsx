import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Search, Check, Plus, ShoppingBag, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { searchProducts } from '../utils/TextSearch';

interface CompareProductPickerProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductId: string;
  trackerItems?: Record<string, any>;
  onStartCompare: (productIds: string[]) => void;
}

interface ProductItem {
  id: string | number;
  brand: string;
  name: string;
  type?: string;
  photo_url?: string;
}

export const CompareProductPicker: React.FC<CompareProductPickerProps> = ({
  isOpen,
  onClose,
  initialProductId,
  trackerItems,
  onStartCompare
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([String(initialProductId)]);

  // Load initial recently viewed / suggested products
  useEffect(() => {
    if (isOpen) {
      setSelectedIds([String(initialProductId)]);
      fetchInitialProducts();
    }
  }, [isOpen, initialProductId]);

  const fetchInitialProducts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('products')
        .select('id, brand, name, type, photo_url')
        .order('id', { ascending: false })
        .limit(15);
      
      if (data) {
        setProducts(data);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      if (!q) {
        fetchInitialProducts();
        return;
      }
      setLoading(true);
      try {
        const results = await searchProducts(q, 'All', 20);
        setProducts(results || []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const toggleSelect = (id: string | number) => {
    const stringId = String(id);
    if (selectedIds.includes(stringId)) {
      // Don't allow deselecting the initial product if it's the only one or keep at least 1? Wait, user can select/deselect. If deselecting initial product, let's allow or keep minimum 1.
      if (selectedIds.length === 1 && stringId === String(initialProductId)) return;
      setSelectedIds(selectedIds.filter(i => i !== stringId));
    } else {
      if (selectedIds.length >= 5) return;
      setSelectedIds([...selectedIds, stringId]);
    }
  };

  if (!isOpen) return null;

  const count = selectedIds.length;
  const isReady = count >= 2;

  return (
    <div 
      className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden my-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 bg-[#FAF9F6]">
        <h2 className="text-xl font-black uppercase tracking-tight text-black">Compare products</h2>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5 text-black" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-6 pb-3 border-b border-gray-100">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a product to compare"
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#F5F5F3] border border-black/10 text-xs font-medium text-black focus:outline-none focus:border-black transition-all"
          />
        </div>
      </div>

      {/* Recently Viewed / Products List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-black/50">Recently Viewed</span>
          <span className="text-[10px] font-bold text-black/60">{count}/5 selected</span>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-black" />
            <span className="text-xs font-bold uppercase tracking-widest text-black/50">Loading products...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-xs text-black/50">No products found.</div>
        ) : (
          <div className="space-y-2.5">
            {products.map(p => {
              const stringId = String(p.id);
              const isSelected = selectedIds.includes(stringId);
              const isDisabled = !isSelected && count >= 5;

              return (
                <div
                  key={p.id}
                  onClick={() => !isDisabled && toggleSelect(p.id)}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-black bg-black/5 shadow-xs'
                      : isDisabled
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-200/80 bg-white hover:border-black/30 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {p.photo_url ? (
                      <img
                        src={p.photo_url}
                        alt={p.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 object-cover rounded-xl border border-black/5 bg-gray-50 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 border border-black/5">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-black line-clamp-1">{p.name}</h4>
                      <p className="text-[10px] font-medium text-black/60 truncate mt-0.5">
                        {p.brand} {p.type ? `· ${p.type}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      !isDisabled && toggleSelect(p.id);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-black text-white'
                        : isDisabled
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 hover:bg-black hover:text-white text-black'
                    }`}
                  >
                    {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Button */}
      <div className="p-6 border-t border-gray-100 bg-[#FAF9F6]">
        <button
          type="button"
          disabled={!isReady}
          onClick={() => isReady && onStartCompare(selectedIds)}
          className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg cursor-pointer ${
            isReady
              ? 'bg-black text-white hover:opacity-90'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          {count < 2 ? 'Pick 2 products' : `Compare up to 5 products (${count})`}
        </button>
      </div>
    </div>
  );
};
