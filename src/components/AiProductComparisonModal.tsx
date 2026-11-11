import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, AlertCircle, Loader2, ArrowRight, Layers, ShieldAlert, CheckCircle2, Search, Sliders } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { searchProducts } from '../utils/TextSearch';

interface AiProductComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface ProductItem {
  id: number | string;
  brand: string;
  name: string;
  type?: string;
  photo_url?: string;
}

interface RankingItem {
  product_id: number | string;
  product_name: string;
  brand: string;
  rank: number;
  score_assessment: string;
  verdict: 'Best in category' | 'Good' | 'Suboptimal' | 'Not recommended';
}

interface GroupItem {
  category: string;
  rankings: RankingItem[];
}

interface SynergyData {
  pairing_advice: string;
  conflicts: string;
  recommended_order: string[];
}

interface AnalysisResult {
  groups: GroupItem[];
  routine_synergy: SynergyData;
  editor_summary: string;
}

export const AiProductComparisonModal: React.FC<AiProductComparisonModalProps> = ({ isOpen, onClose, userId }) => {
  const [step, setStep] = useState<'select' | 'analyzing' | 'results' | 'limit_reached'>('select');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<(number | string)[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [remainingComps, setRemainingComps] = useState<number>(3);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch products inventory or search via fts_search when modal opens or query changes
  useEffect(() => {
    if (isOpen && userId) {
      setStep('select');
      setSelectedProductIds([]);
      setAnalysis(null);
      setErrorMessage(null);
      performSearch('');
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setLoadingProducts(true);
    try {
      const results = await searchProducts(query, 'All');
      setProducts(results || []);
    } catch (err: any) {
      console.error('Error searching products for comparison:', err);
      setErrorMessage('Failed to search product database.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const toggleSelectProduct = (id: number | string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter(item => item !== id));
    } else {
      if (selectedProductIds.length >= 10) {
        setErrorMessage('You can select a maximum of 10 products to compare.');
        return;
      }
      setErrorMessage(null);
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  const handleRunComparison = async () => {
    if (selectedProductIds.length === 0) {
      setErrorMessage('Please select at least one product to compare.');
      return;
    }
    setStep('analyzing');
    setErrorMessage(null);

    try {
      const res = await fetch('/api/ai-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, productIds: selectedProductIds })
      });

      const data = await res.json();

      if (res.status === 429 || data.limitReached) {
        setStep('limit_reached');
        setRemainingComps(0);
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate comparison.');
      }

      setAnalysis(data.analysis);
      setRemainingComps(data.remaining ?? 2);
      setStep('results');
    } catch (err: any) {
      console.error('AI Comparison error:', err);
      setErrorMessage(err.message || 'An error occurred during comparison.');
      setStep('select');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-black/10"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-black/10 flex items-center justify-between bg-[#FAF9F6]">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-black">Compare products</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="ml-auto underline">Dismiss</button>
            </div>
          )}

          {/* STEP 1: SELECT PRODUCTS */}
          {step === 'select' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-black">Select Products to Compare ({selectedProductIds.length}/10)</h3>
                </div>
                <div className="relative">
                  <SearchInput 
                    value={searchQuery} 
                    onChange={setSearchQuery} 
                    placeholder="Search brand or product name (fts_search)..." 
                  />
                </div>
              </div>

              {loadingProducts ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-black" />
                  <p className="text-xs font-bold uppercase tracking-widest text-black/50">Searching product database...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="py-16 text-center text-black/50 text-xs">
                  No products found matching your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[450px] overflow-y-auto pr-2">
                  {products.map(p => {
                    const isSelected = selectedProductIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleSelectProduct(p.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                          isSelected 
                            ? 'border-black bg-black text-white shadow-lg' 
                            : 'border-black/10 bg-white hover:border-black/30 text-black'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 shrink-0 ${
                          isSelected ? 'border-white bg-white text-black' : 'border-black/20 bg-black/5'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[10px] font-bold uppercase tracking-widest truncate ${isSelected ? 'text-white/70' : 'text-black/50'}`}>
                            {p.brand}
                          </p>
                          <h4 className="text-xs font-bold leading-snug line-clamp-2 mt-0.5">{p.name}</h4>
                          {p.type && (
                            <span className={`inline-block mt-2 text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-black/5 text-black/70'
                            }`}>
                              {p.type}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Footer */}
              <div className="pt-4 border-t border-black/10 flex items-center justify-end">
                <button
                  disabled={selectedProductIds.length === 0}
                  onClick={handleRunComparison}
                  className="px-6 py-3 rounded-2xl bg-black text-white text-xs font-black uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                >
                  <span>Compare with AI ({selectedProductIds.length})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ANALYZING */}
          {step === 'analyzing' && (
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center animate-pulse">
                  <Sliders className="w-10 h-10 text-black" />
                </div>
                <Loader2 className="w-24 h-24 animate-spin text-black/40 absolute -inset-2" />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-black uppercase tracking-tight text-black">Analyzing Ingredients...</h3>
                <p className="text-xs text-black/60">
                  Cross-referencing your skin profile against ingredient compatibility, active concentrations, and category rankings.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: LIMIT REACHED */}
          {step === 'limit_reached' && (
            <div className="py-16 text-center space-y-6 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-inner">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tight text-black">Daily Limit Reached</h3>
                <p className="text-xs text-black/60 leading-relaxed">
                  You have reached your limit of 3 AI product comparisons for today. To ensure high-performance analysis for all skincare enthusiasts, comparison quotas reset at midnight.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-black text-white text-xs font-black uppercase tracking-widest hover:opacity-90 shadow-lg"
              >
                Got it
              </button>
            </div>
          )}

          {/* STEP 4: RESULTS */}
          {step === 'results' && analysis && (
            <div className="space-y-8 pb-4">
              {/* Editor Summary */}
              <div className="bg-[#FAF9F6] border border-black/10 rounded-3xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-3 py-1 rounded-full">
                    Editor's Verdict
                  </span>
                  <span className="text-xs font-bold text-black/60">
                    {remainingComps} comparisons remaining today
                  </span>
                </div>
                <p className="text-sm font-medium leading-relaxed text-black">
                  {analysis.editor_summary}
                </p>
              </div>

              {/* Grouped Rankings by Category */}
              <div className="space-y-6">
                <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Category Rankings & Compatibility
                </h3>

                {analysis.groups.map((group, idx) => (
                  <div key={idx} className="border border-black/10 rounded-3xl p-6 space-y-4 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-black/5 pb-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-black/50">Category: {group.category}</h4>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/5 text-black">
                        {group.rankings.length} products compared
                      </span>
                    </div>

                    <div className="space-y-3">
                      {group.rankings.map((prod) => (
                        <div key={prod.product_id} className="p-4 rounded-2xl bg-[#FAF9F6] border border-black/5 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-black text-white text-[11px] font-black flex items-center justify-center shrink-0">
                                  #{prod.rank}
                                </span>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">{prod.brand}</span>
                                  <h5 className="text-xs font-bold text-black">{prod.product_name}</h5>
                                </div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                              prod.verdict === 'Best in category' ? 'bg-black text-white' :
                              prod.verdict === 'Good' ? 'bg-emerald-100 text-emerald-800' :
                              prod.verdict === 'Suboptimal' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {prod.verdict}
                            </span>
                          </div>
                          <p className="text-xs text-black/70 leading-relaxed pl-8">
                            {prod.score_assessment}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Routine Synergy & Conflicts */}
              {analysis.routine_synergy && (
                <div className="border border-black/10 rounded-3xl p-6 space-y-4 bg-[#FAF9F6] shadow-sm">
                  <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Routine Synergy & Active Conflicts
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-black/5 space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-black/60">Pairing Advice</h4>
                      <p className="text-xs text-black/80 leading-relaxed">{analysis.routine_synergy.pairing_advice}</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-black/5 space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-red-600">Active Conflicts</h4>
                      <p className="text-xs text-black/80 leading-relaxed">{analysis.routine_synergy.conflicts}</p>
                    </div>
                  </div>

                  {analysis.routine_synergy.recommended_order && analysis.routine_synergy.recommended_order.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl border border-black/5 space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-black/60">Recommended Layering Order</h4>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {analysis.routine_synergy.recommended_order.map((stepName, i) => (
                          <div key={i} className="flex items-center gap-2 bg-black/5 px-3 py-1.5 rounded-xl text-xs font-semibold text-black">
                            <span className="w-4 h-4 rounded-full bg-black text-white text-[9px] font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span>{stepName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 py-3 rounded-2xl border border-black text-black text-xs font-black uppercase tracking-widest hover:bg-black/5 transition-colors"
                >
                  Compare Different Products
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl bg-black text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const SearchInput = ({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder: string }) => (
  <div className="relative">
    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="pl-10 pr-4 py-2.5 rounded-2xl bg-black/5 border border-black/10 text-xs font-medium text-black focus:outline-none focus:border-black w-72 md:w-80 transition-all"
    />
  </div>
);
