import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { X, Search, Camera, Loader2 } from 'lucide-react';
import { searchProductsFromPhoto, ProductConfirmationModal, MatchedProduct } from './photo_search';
import { evaluateProductCategory } from '../utils/productCategoryEvaluator';

interface TrackerNewProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSave?: () => void;
}

export const TrackerNewProductModal: React.FC<TrackerNewProductModalProps> = ({ isOpen, onClose, userId, onSave }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    routineAM: false,
    routinePM: false,
    size: '',
    notes: '',
    inUse: true,
    isLiked: false,
    repurchase: false,
    bestBy: '',
    openDate: '',
    poa: ''
  });

  // Scanner States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMatchedProducts, setScanMatchedProducts] = useState<MatchedProduct[]>([]);
  const [isConfirmScanOpen, setIsConfirmScanOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handlePhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const matches = await searchProductsFromPhoto(file);
      setScanMatchedProducts(matches);
      setIsConfirmScanOpen(true);
    } catch (err: any) {
      console.error("Photo scan error:", err);
      setScanError(err.message || "An error occurred during photo scan. Please try again.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmScan = (confirmed: MatchedProduct[]) => {
    setIsConfirmScanOpen(false);
    if (confirmed.length > 0) {
      const first = confirmed[0];
      setSelectedProduct({
        id: first.id,
        brand: first.brand,
        name: first.name,
        type: first.type,
        photo_url: first.photo_url || null
      });
      setSearchQuery('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setProducts([]);
      setSelectedProduct(null);
      setFormData({
        routineAM: false,
        routinePM: false,
        size: '',
        notes: '',
        inUse: true,
        isLiked: false,
        repurchase: false,
        bestBy: '',
        openDate: '',
        poa: ''
      });
      setIsScanning(false);
      setScanError(null);
      setScanMatchedProducts([]);
      setIsConfirmScanOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setProducts([]);
      return;
    }
    const search = async () => {
      const formattedQuery = searchQuery
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => `${word}:*`)
        .join(' & ');

      const { data } = await supabase
        .from('products')
        .select('id, brand, name, type, photo_url')
        .textSearch('fts_search', formattedQuery, { config: 'english' })
        .limit(10);
      
      if (data) setProducts(data);
    };
    search();
  }, [searchQuery]);

  const handleSave = async () => {
    if (!selectedProduct) return;
    setIsEvaluating(true);
    try {
      let productVerdict: string | null = null;
      let hasBreakoutRisk = false;
      let breakoutIngredients: string[] = [];
      let breakoutReasons: string[] = [];
      try {
        if (selectedProduct.id && userId) {
          console.log(`[TrackerNewProductModal] Evaluating product verdict for user: ${userId}, product: ${selectedProduct.id}`);
          
          // 1. Try fetching from product_ingredients first
          const { data: piData, error: piError } = await supabase
            .from('product_ingredients')
            .select('ingredient')
            .eq('product_id', selectedProduct.id);

          let ingredientsArr: string[] = [];

          if (piError) {
            console.error('[TrackerNewProductModal] Error fetching product_ingredients:', piError);
          } else if (piData && piData.length > 0) {
            ingredientsArr = piData
              .map(row => row.ingredient)
              .filter((i): i is string => typeof i === 'string' && i.trim().length > 0);
            console.log(`[TrackerNewProductModal] Retrieved ${ingredientsArr.length} ingredients from product_ingredients for product: ${selectedProduct.id}`);
          }

          // 2. Fall back to product_description.ingredients_list if product_ingredients was empty
          if (ingredientsArr.length === 0) {
            console.log('[TrackerNewProductModal] product_ingredients empty or failed, trying product_description fallback');
            const { data: descData, error: descError } = await supabase
              .from('product_description')
              .select('ingredients_list')
              .eq('id', selectedProduct.id)
              .maybeSingle();

            if (descError) {
              console.error('[TrackerNewProductModal] Error fetching fallback ingredients from product_description:', descError);
            } else if (descData?.ingredients_list) {
              const rawIngs = descData.ingredients_list;
              ingredientsArr = Array.isArray(rawIngs)
                ? rawIngs
                : typeof rawIngs === 'string'
                ? rawIngs.split(',').map((i: string) => i.trim()).filter((i: string) => i.length > 0)
                : [];
              console.log(`[TrackerNewProductModal] Retrieved ${ingredientsArr.length} fallback ingredients from product_description`);
            }
          }

          if (ingredientsArr.length > 0) {
            const evalResult = await evaluateProductCategory(userId, selectedProduct.id.toString(), ingredientsArr);
            if (evalResult && evalResult.category) {
              productVerdict = evalResult.category;
              hasBreakoutRisk = !!evalResult.potentialBreakoutRisk;
              breakoutIngredients = evalResult.potentialBreakoutIngredients || [];
              breakoutReasons = evalResult.potentialBreakoutReasons || [];
              console.log(`[TrackerNewProductModal] Evaluation successful. Category: ${productVerdict}, potentialBreakoutRisk: ${hasBreakoutRisk}`);
            }
          } else {
            console.warn('[TrackerNewProductModal] No ingredients found in either product_ingredients or product_description.');
          }
        }
      } catch (err) {
        console.error('[TrackerNewProductModal] Exception during evaluateProductCategory flow:', err);
      }

      const payload = {
        user_id: userId,
        brand: selectedProduct.brand,
        product_name: selectedProduct.name,
        product_type: selectedProduct.type,
        routine_time: formData.routineAM && formData.routinePM ? 'AM/PM' : formData.routineAM ? 'AM' : 'PM',
        size: formData.size,
        notes: hasBreakoutRisk
          ? (formData.notes 
              ? `${formData.notes} [Potential Breakout Risk: ${breakoutIngredients.join(', ')} | ${breakoutReasons.join('; ')}]` 
              : `[Potential Breakout Risk: ${breakoutIngredients.join(', ')} | ${breakoutReasons.join('; ')}]`)
          : formData.notes,
        in_use: formData.inUse,
        is_liked: formData.isLiked,
        repurchase: formData.repurchase,
        best_by_date: formData.bestBy || null,
        open_date: formData.openDate || null,
        poa: formData.poa,
        photo_url: selectedProduct.photo_url || null,
        product_id: selectedProduct.id || null,
        product_verdict: productVerdict || null
      };

      const { error } = await supabase.from('tracker').insert(payload);
      if (!error) {
          setSearchQuery('');
          setSelectedProduct(null);
          setFormData({
              routineAM: false,
              routinePM: false,
              size: '',
              notes: '',
              inUse: true,
              isLiked: false,
              repurchase: false,
              bestBy: '',
              openDate: '',
              poa: ''
          });
          onClose();
          if (onSave) onSave();
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white p-8 rounded-3xl w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-black">New Product</h2>
            <button onClick={onClose}><X /></button>
        </div>
        
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-3 text-black/30" />
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-black/10 rounded-2xl text-sm"
                />
            </div>

            {!selectedProduct && (
              <div className="flex flex-col gap-2">
                <button
                  id="scan-photo-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanning}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-venus-accent hover:bg-venus-accent/90 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50 border-2 border-black"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning Photo...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Scan Product Photo</span>
                    </>
                  )}
                </button>
                <input
                  id="tracker-scan-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handlePhotoScan}
                  className="hidden"
                />
              </div>
            )}

            {scanError && (
              <div id="scan-error-alert" className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border-2 border-red-500/15">
                {scanError}
              </div>
            )}
            
            {!selectedProduct && products.length > 0 && (
                <div className="border border-black/10 rounded-2xl p-2 space-y-1 max-h-[300px] overflow-y-auto">
                    {products.map(p => (
                        <button 
                            key={p.id} 
                            onClick={() => setSelectedProduct(p)} 
                            className="w-full text-left p-3 hover:bg-black/5 rounded-xl text-xs font-black uppercase flex items-center gap-3"
                            data-id={p.id}
                        >
                            {p.photo_url ? (
                                <img 
                                    src={p.photo_url} 
                                    alt={p.name} 
                                    referrerPolicy="no-referrer"
                                    className="w-12 h-12 object-cover rounded-lg border border-black/10 flex-shrink-0" 
                                />
                            ) : (
                                <div className="w-12 h-12 bg-black/5 rounded-lg border border-black/10 flex items-center justify-center flex-shrink-0 text-[10px] text-black/40 normal-case">
                                    No Image
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="truncate text-black font-black">{p.brand}</div>
                                <div className="truncate text-[10px] text-black/60 font-semibold normal-case">{p.name}</div>
                                <div className="text-[9px] text-black/40 normal-case font-mono mt-0.5">ID: {p.id}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
            
            {selectedProduct && (
                <div className="p-4 bg-black/5 rounded-xl flex items-center gap-4">
                    {selectedProduct.photo_url ? (
                        <img 
                            src={selectedProduct.photo_url} 
                            alt={selectedProduct.name} 
                            referrerPolicy="no-referrer"
                            className="w-14 h-14 object-cover rounded-xl border border-black/10 flex-shrink-0" 
                        />
                    ) : (
                        <div className="w-14 h-14 bg-black/5 rounded-xl border border-black/10 flex items-center justify-center flex-shrink-0 text-[10px] text-black/40">
                            No Image
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-black italic block truncate">{selectedProduct.brand}</span>
                        <span className="text-xs text-black/60 font-bold block truncate">{selectedProduct.name}</span>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="text-xs font-black uppercase text-red-500 flex-shrink-0">Change</button>
                </div>
            )}
        </div>

        {selectedProduct && (
            <div className="space-y-4">
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-black uppercase"><input type="checkbox" checked={formData.routineAM} onChange={e => setFormData(f => ({...f, routineAM: e.target.checked}))} /> AM</label>
                    <label className="flex items-center gap-2 text-xs font-black uppercase"><input type="checkbox" checked={formData.routinePM} onChange={e => setFormData(f => ({...f, routinePM: e.target.checked}))} /> PM</label>
                </div>
                <input type="text" placeholder="Size" value={formData.size} onChange={e => setFormData(f => ({...f, size: e.target.value}))} className="w-full p-3 border rounded-xl text-sm" />
                <input type="text" placeholder="Notes" value={formData.notes} onChange={e => setFormData(f => ({...f, notes: e.target.value}))} className="w-full p-3 border rounded-xl text-sm" />
                <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-xs font-black uppercase"><input type="checkbox" checked={formData.inUse} onChange={e => setFormData(f => ({...f, inUse: e.target.checked}))} /> In use</label>
                    <label className="flex items-center gap-2 text-xs font-black uppercase"><input type="checkbox" checked={formData.isLiked} onChange={e => setFormData(f => ({...f, isLiked: e.target.checked}))} /> Like?</label>
                    <label className="flex items-center gap-2 text-xs font-black uppercase"><input type="checkbox" checked={formData.repurchase} onChange={e => setFormData(f => ({...f, repurchase: e.target.checked}))} /> Repurchase?</label>
                </div>
                <label className="text-xs font-black uppercase text-black/50">Best by</label>
                <input type="date" placeholder="Best by" value={formData.bestBy} onChange={e => setFormData(f => ({...f, bestBy: e.target.value}))} className="w-full p-3 border rounded-xl text-sm" />
                <label className="text-xs font-black uppercase text-black/50">Open date</label>
                <input type="date" placeholder="Open date" value={formData.openDate} onChange={e => setFormData(f => ({...f, openDate: e.target.value}))} className="w-full p-3 border rounded-xl text-sm" />
                <input type="text" placeholder="POA" value={formData.poa} onChange={e => setFormData(f => ({...f, poa: e.target.value}))} className="w-full p-3 border rounded-xl text-sm" />
                <button 
                  onClick={handleSave} 
                  disabled={isEvaluating}
                  className="w-full bg-black text-white p-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black/90 flex items-center justify-center gap-2"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Evaluating Skin Fit...</span>
                    </>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
            </div>
        )}
      </motion.div>
      <ProductConfirmationModal
        isOpen={isConfirmScanOpen}
        products={scanMatchedProducts}
        onConfirm={handleConfirmScan}
        onCancel={() => setIsConfirmScanOpen(false)}
      />
    </div>
  );
};
