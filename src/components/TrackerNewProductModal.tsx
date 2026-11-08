import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { X, Search, Camera, Loader2 } from 'lucide-react';
import { searchProductsFromPhoto, ProductConfirmationModal, MatchedProduct } from './photo_search';
import { searchProducts } from '../utils/TextSearch';

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
    const search = async () => {
      const products = await searchProducts(searchQuery);
      setProducts(products);
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
          console.log(`[TrackerNewProductModal] Evaluating product via new RPC for user: ${userId}, product: ${selectedProduct.id}`);
          
          const { data, error } = await supabase.rpc('evaluate_product_compatibility', {
            p_user_id: userId,
            p_product_id: selectedProduct.id.toString()
          });

          if (!error && data?.compatibility) {
            const comp = data.compatibility;
            hasBreakoutRisk = comp.safetyConcerns && comp.safetyConcerns.length > 0;
            
            if (hasBreakoutRisk) {
              breakoutReasons = comp.safetyConcerns;
            }
            productVerdict = comp.skinTypeFit === 'Bad Fit' ? 'Avoid' : comp.skinTypeFit === 'Good Fit' ? 'Recommended' : 'Caution';
            console.log(`[TrackerNewProductModal] RPC Evaluation successful. Verdict: ${productVerdict}, breakoutRisk: ${hasBreakoutRisk}`);
          }
        }
      } catch (err) {
        console.error('[TrackerNewProductModal] Exception during RPC evaluation flow:', err);
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
              ? `${formData.notes} [Potential Breakout Risk: ${breakoutReasons.join('; ')}]` 
              : `[Potential Breakout Risk: ${breakoutReasons.join('; ')}]`)
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
        className="bg-white p-6 sm:p-8 rounded-3xl w-full max-w-lg space-y-5 sm:space-y-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-black">New Product</h2>
            <button onClick={onClose}><X /></button>
        </div>
        
        <div className="space-y-4">
            {!selectedProduct && (
              <>
                <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-black/40" />
                    <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search product..."
                        className="w-full pl-10 pr-10 py-3 border-2 border-black/10 rounded-2xl text-sm focus:border-black outline-none transition-colors"
                        autoFocus
                    />
                    {searchQuery && (
                      <button 
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3.5 top-3.5 p-0.5 rounded-full hover:bg-black/5 text-black/40 hover:text-black transition-colors cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                </div>

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

                {scanError && (
                  <div id="scan-error-alert" className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border-2 border-red-500/15">
                    {scanError}
                  </div>
                )}
                
                {products.length > 0 && (
                    <div className="border border-black/10 rounded-2xl p-2 space-y-1 max-h-[300px] overflow-y-auto">
                        {products.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => setSelectedProduct(p)} 
                                className="w-full text-left p-3 hover:bg-black/5 rounded-xl flex items-start gap-3 transition-colors cursor-pointer group"
                                data-id={p.id}
                            >
                                {p.photo_url ? (
                                    <img 
                                        src={p.photo_url} 
                                        alt={p.name} 
                                        referrerPolicy="no-referrer"
                                        className="w-12 h-12 object-cover rounded-lg border border-black/10 flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform" 
                                    />
                                ) : (
                                    <div className="w-12 h-12 bg-black/5 rounded-lg border border-black/10 flex items-center justify-center flex-shrink-0 text-[10px] text-black/40 font-bold normal-case mt-0.5">
                                        No Image
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 pr-1">
                                    <div className="text-black font-black uppercase text-xs tracking-tight break-words [overflow-wrap:anywhere] group-hover:text-venus-accent transition-colors leading-tight">
                                        {p.brand}
                                    </div>
                                    <div className="text-xs text-black/70 font-semibold normal-case break-words [overflow-wrap:anywhere] leading-snug mt-0.5">
                                        {p.name}
                                    </div>
                                    {p.type && (
                                        <div className="text-[10px] text-black/40 font-bold uppercase tracking-wider mt-1">
                                            {p.type}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
              </>
            )}
            
            {selectedProduct && (
                <div className="p-4 bg-black/5 rounded-2xl border border-black/10">
                    <div className="flex items-start gap-3.5 sm:gap-4">
                        {selectedProduct.photo_url ? (
                            <img 
                                src={selectedProduct.photo_url} 
                                alt={selectedProduct.name} 
                                referrerPolicy="no-referrer"
                                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-black/10 flex-shrink-0 mt-0.5 shadow-2xs" 
                            />
                        ) : (
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/10 rounded-xl border border-black/10 flex items-center justify-center flex-shrink-0 text-[10px] text-black/40 font-bold mt-0.5 text-center p-1">
                                No Image
                            </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col items-start">
                            <div className="text-xs font-black uppercase tracking-wider text-venus-accent leading-tight">
                                {selectedProduct.brand}
                            </div>
                            <div className="text-sm sm:text-base font-bold text-black normal-case leading-snug mt-1 break-words">
                                {selectedProduct.name}
                            </div>
                            {selectedProduct.type && (
                                <div className="mt-1.5">
                                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-black/60 bg-white/90 border border-black/10 px-2.5 py-0.5 rounded-md shadow-2xs">
                                        {selectedProduct.type}
                                    </span>
                                </div>
                            )}
                            <button 
                                type="button" 
                                onClick={() => setSelectedProduct(null)} 
                                className="mt-2.5 text-[11px] font-black uppercase text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-3 py-1 rounded-lg border border-red-200/80 transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
                                title="Change selected product"
                            >
                                Change
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {selectedProduct && (
            <div className="space-y-4">
                <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-black uppercase cursor-pointer select-none text-black">
                        <input 
                            type="checkbox" 
                            checked={formData.routineAM} 
                            onChange={e => setFormData(f => ({...f, routineAM: e.target.checked}))} 
                            className="w-4 h-4 rounded border-2 border-black/20 text-black focus:ring-black accent-black cursor-pointer"
                        /> 
                        AM
                    </label>
                    <label className="flex items-center gap-2 text-xs font-black uppercase cursor-pointer select-none text-black">
                        <input 
                            type="checkbox" 
                            checked={formData.routinePM} 
                            onChange={e => setFormData(f => ({...f, routinePM: e.target.checked}))} 
                            className="w-4 h-4 rounded border-2 border-black/20 text-black focus:ring-black accent-black cursor-pointer"
                        /> 
                        PM
                    </label>
                </div>
                <input type="text" placeholder="Size" value={formData.size} onChange={e => setFormData(f => ({...f, size: e.target.value}))} className="w-full p-3 border-2 border-black/10 rounded-xl text-sm outline-none focus:border-black transition-colors" />
                <input type="text" placeholder="Notes" value={formData.notes} onChange={e => setFormData(f => ({...f, notes: e.target.value}))} className="w-full p-3 border-2 border-black/10 rounded-xl text-sm outline-none focus:border-black transition-colors" />
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
                    <label className="flex items-center gap-2 text-xs font-black uppercase cursor-pointer select-none text-black">
                        <input 
                            type="checkbox" 
                            checked={formData.inUse} 
                            onChange={e => setFormData(f => ({...f, inUse: e.target.checked}))} 
                            className="w-4 h-4 rounded border-2 border-black/20 text-black focus:ring-black accent-black cursor-pointer"
                        /> 
                        In use
                    </label>
                    <label className="flex items-center gap-2 text-xs font-black uppercase cursor-pointer select-none text-black">
                        <input 
                            type="checkbox" 
                            checked={formData.isLiked} 
                            onChange={e => setFormData(f => ({...f, isLiked: e.target.checked}))} 
                            className="w-4 h-4 rounded border-2 border-black/20 text-black focus:ring-black accent-black cursor-pointer"
                        /> 
                        Like?
                    </label>
                    <label className="flex items-center gap-2 text-xs font-black uppercase cursor-pointer select-none text-black">
                        <input 
                            type="checkbox" 
                            checked={formData.repurchase} 
                            onChange={e => setFormData(f => ({...f, repurchase: e.target.checked}))} 
                            className="w-4 h-4 rounded border-2 border-black/20 text-black focus:ring-black accent-black cursor-pointer"
                        /> 
                        Repurchase?
                    </label>
                </div>
                <div>
                    <label className="text-xs font-black uppercase text-black/50 block mb-1">Best by</label>
                    <input type="date" placeholder="Best by" value={formData.bestBy} onChange={e => setFormData(f => ({...f, bestBy: e.target.value}))} className="w-full p-3 border-2 border-black/10 rounded-xl text-sm outline-none focus:border-black transition-colors" />
                </div>
                <div>
                    <label className="text-xs font-black uppercase text-black/50 block mb-1">Open date</label>
                    <input type="date" placeholder="Open date" value={formData.openDate} onChange={e => setFormData(f => ({...f, openDate: e.target.value}))} className="w-full p-3 border-2 border-black/10 rounded-xl text-sm outline-none focus:border-black transition-colors" />
                </div>
                <input type="text" placeholder="POA" value={formData.poa} onChange={e => setFormData(f => ({...f, poa: e.target.value}))} className="w-full p-3 border-2 border-black/10 rounded-xl text-sm outline-none focus:border-black transition-colors" />
                <button 
                  onClick={handleSave} 
                  disabled={isEvaluating}
                  className="w-full bg-black text-white p-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black/90 flex items-center justify-center gap-2 cursor-pointer transition-colors"
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
