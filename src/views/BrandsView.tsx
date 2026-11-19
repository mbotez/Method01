import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, ChevronDown, ChevronRight, Loader2, ShoppingBag } from 'lucide-react';
import { AppState } from '../types';
import { supabase } from '../lib/supabase';
import { getScoreColorConfig } from '../utils/scoreColors';
import { MOBILE_ROW_LETTERS, MOBILE_DROPDOWN_LETTERS, WEB_ROW_1_LETTERS, WEB_ROW_2_LETTERS } from '../config/appConstants';

export function isProductCat3_11(prod: any): boolean {
  if (!prod) return false;
  const raw = prod.cat3 ??
    prod.product_scores?.cat3 ??
    (Array.isArray(prod.product_scores) ? prod.product_scores[0]?.cat3 : undefined);
  return Number(raw) === 11;
}

export function computeProductFormulaScore(scores: any, product?: any): number {
  if (isProductCat3_11(product)) {
    return 0;
  }
  const s = Array.isArray(scores) ? scores[0] : scores;
  if (!s) {
    return 70;
  }
  if (Number(s.cat3) === 11) {
    return 0;
  }
  let score = 70;
  const hasBarrier = Boolean(s.barrier_repair_dry_skin > 0 || s.barrier_repair_combi_skin > 0 || s.barrier_repair_oily_skin > 0);
  const hasHydration = Boolean(s.hydration_dry_skin > 0 || s.hydration_combi_skin > 0 || s.hydration_oily_skin > 0);
  const hasRedness = Boolean(s.calm_redness_dry_skin > 0 || s.calm_redness_combi_skin > 0 || s.has_vascular_calmer);
  const hasWrinkles = Boolean(s.reduce_wrinkles > 0);
  const hasClear = Boolean(s.clear_blackheads > 0 || s.clear_whiteheads > 0 || s.clear_surface_breakouts > 0 || s.soothe_deep_breakouts > 0);
  const hasBright = Boolean(s.has_brightening_ingredient || s.has_melanin_inhibitor || s.fade_pih > 0 || s.fade_pie > 0);

  if (hasBarrier) score += 8;
  if (hasHydration) score += 8;
  if (hasRedness) score += 6;
  if (hasWrinkles) score += 6;
  if (hasClear) score += 6;
  if (hasBright) score += 6;
  if (s.pregnancy_safe) score += 4;
  if (s.oil_free) score += 2;
  if (s.sulfate_free) score += 2;

  if (s.has_high_irritation) score -= 15;
  if (s.contains_frag || s.has_fragrance_top50) score -= 10;
  if (s.has_yeast_trigger) score -= 8;
  if (s.aggregated_clogging_risk != null && s.aggregated_clogging_risk < 0) {
    score += (s.aggregated_clogging_risk * 5);
  }

  return Math.max(15, Math.min(98, Math.round(score)));
}

export interface BrandsViewProps {
  setAppState: (state: AppState) => void;
  user: any;
  userProfile: any;
  selectedBrandItem: any | null;
  setSelectedBrandItem: React.Dispatch<React.SetStateAction<any | null>>;
  selectedBrandsLetter: string | null;
  setSelectedBrandsLetter: React.Dispatch<React.SetStateAction<string | null>>;
  onSelectProduct: (prod: any) => void;
}

interface ShopLogoItem {
  key: string;
  file: string;
  fallbacks?: string[];
  label: string;
}

const SHOP_LOGOS_CONFIG: ShopLogoItem[] = [
  { key: 'boots', file: 'boots_logo.png', fallbacks: ['boots_logo.jpg'], label: 'Boots' },
  { key: 'harrods', file: 'harrods_logo.png', fallbacks: ['harrods_logo.jpg'], label: 'Harrods' },
  { key: 'harvey', file: 'harveynichols_logo.png', fallbacks: ['harvey_logo.png', 'harveynichols_logo.jpg'], label: 'Harvey Nichols' },
  { key: 'liberty', file: 'liberty_logo.jpg', fallbacks: ['liberty_logo.png'], label: 'Liberty' },
  { key: 'selfridges', file: 'selfridge_logo.png', fallbacks: ['selfridge_london.png', 'selfridges_logo.png'], label: 'Selfridges' },
  { key: 'sephora', file: 'sephora_logo.png', fallbacks: ['sephora_logo.jpg'], label: 'Sephora' },
  { key: 'spacenk', file: 'spacenk_logo.png', fallbacks: ['spacenk_logo.jpg'], label: 'Space NK' },
];

const RetailerLogoBadge: React.FC<{ shop: ShopLogoItem; className?: string }> = ({ shop, className = '' }) => {
  const [hasError, setHasError] = useState(false);
  const [fallbackIndex, setFallbackIndex] = useState(0);

  const candidateFiles = useMemo(() => {
    return [shop.file, ...(shop.fallbacks || [])];
  }, [shop.file, shop.fallbacks]);

  const currentFile = candidateFiles[fallbackIndex];

  const publicUrl = useMemo(() => {
    if (!currentFile) return '';
    return supabase.storage.from('web_art').getPublicUrl(`shop_logos/${currentFile}`).data.publicUrl;
  }, [currentFile]);

  const handleImgError = () => {
    if (fallbackIndex + 1 < candidateFiles.length) {
      setFallbackIndex(prev => prev + 1);
    } else {
      setHasError(true);
    }
  };

  return (
    <div
      className={`bg-neutral-50 border border-black/5 rounded-lg sm:rounded-xl p-1.5 sm:p-2 flex items-center justify-center h-9 sm:h-10 px-2 sm:px-3 shadow-2xs w-full md:w-auto md:min-w-[60px] ${className}`}
      title={shop.label}
    >
      {!hasError && publicUrl ? (
        <img
          src={publicUrl}
          alt={shop.label}
          className="max-h-5 sm:max-h-6 max-w-[65px] sm:max-w-[75px] object-contain"
          referrerPolicy="no-referrer"
          onError={handleImgError}
        />
      ) : (
        <span className="text-[10px] sm:text-xs font-bold text-black/70 tracking-tight truncate text-center">{shop.label}</span>
      )}
    </div>
  );
};

export const BrandsView: React.FC<BrandsViewProps> = ({
  setAppState,
  user,
  userProfile,
  selectedBrandItem,
  setSelectedBrandItem,
  selectedBrandsLetter,
  setSelectedBrandsLetter,
  onSelectProduct,
}) => {
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [brandProducts, setBrandProducts] = useState<any[]>([]);
  const [userScores, setUserScores] = useState<Record<string | number, number>>({});
  const [sortOption, setSortOption] = useState<'default' | 'highest_score' | 'name'>('default');
  const [loadingBrands, setLoadingBrands] = useState<boolean>(false);
  const [loadingBrandProducts, setLoadingBrandProducts] = useState<boolean>(false);
  const [isMobileBrandsDropdownOpen, setIsMobileBrandsDropdownOpen] = useState<boolean>(false);
  const mobileBrandsDropdownRef = useRef<HTMLDivElement>(null);
  const [isMobileShopsDropdownOpen, setIsMobileShopsDropdownOpen] = useState<boolean>(false);
  const mobileShopsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileBrandsDropdownRef.current && !mobileBrandsDropdownRef.current.contains(e.target as Node)) {
        setIsMobileBrandsDropdownOpen(false);
      }
      if (mobileShopsDropdownRef.current && !mobileShopsDropdownRef.current.contains(e.target as Node)) {
        setIsMobileShopsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobileShopsDropdownOpen(false);
  }, [selectedBrandItem]);

  useEffect(() => {
    const fetchBrands = async () => {
      setLoadingBrands(true);
      if (!selectedBrandsLetter) {
        const { data } = await supabase
          .from('brands')
          .select('*')
          .order('brand_name', { ascending: true });
        setBrandsList(data || []);
        setLoadingBrands(false);
        return;
      }

      let { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('letter', selectedBrandsLetter)
        .order('brand_name', { ascending: true });

      if (error || !data || data.length === 0) {
        const { data: allBrands } = await supabase.from('brands').select('*').order('brand_name', { ascending: true });
        if (allBrands) {
          data = allBrands.filter((b: any) => {
            const bLetter = b.letter || (b.brand_name ? b.brand_name.charAt(0).toUpperCase() : '');
            return bLetter === selectedBrandsLetter;
          });
        }
      }
      setBrandsList(data || []);
      setLoadingBrands(false);
    };
    fetchBrands();
  }, [selectedBrandsLetter]);

  useEffect(() => {
    if (selectedBrandItem) {
      const abortController = new AbortController();
      const signal = abortController.signal;

      const fetchBrandProducts = async () => {
        setLoadingBrandProducts(true);
        setUserScores({});

        let { data, error } = await supabase
          .from('products')
          .select('*, product_scores(*)')
          .eq('brand_id', selectedBrandItem.brand_id)
          .abortSignal(signal);

        if (error || !data || data.length === 0) {
          const { data: nameData } = await supabase
            .from('products')
            .select('*, product_scores(*)')
            .ilike('brand', selectedBrandItem.brand_name)
            .abortSignal(signal);
          if (nameData) {
            data = nameData;
          }
        }

        if (signal.aborted) return;

        const prods = data || [];
        setBrandProducts(prods);
        setLoadingBrandProducts(false);

        // If user is logged in, asynchronously evaluate personalized compatibility scores
        const targetUserId = user?.id;
        if (targetUserId && prods.length > 0) {
          const CHUNK_SIZE = 12;
          const prodsToEvaluate = prods.filter((p: any) => !isProductCat3_11(p)).slice(0, 60);
          for (let i = 0; i < prodsToEvaluate.length; i += CHUNK_SIZE) {
            if (signal.aborted) break;
            const chunk = prodsToEvaluate.slice(i, i + CHUNK_SIZE);
            try {
              const results = await Promise.all(
                chunk.map(async (p: any) => {
                  try {
                    return await supabase
                      .rpc('evaluate_product_compatibility', {
                        p_user_id: targetUserId,
                        p_product_id: String(p.id),
                      })
                      .abortSignal(signal);
                  } catch {
                    return { data: null };
                  }
                })
              );
              if (signal.aborted) break;
              const batchScores: Record<string | number, number> = {};
              results.forEach((res: any, idx: number) => {
                const compScore = res?.data?.compatibility?.compatibilityScore;
                if (typeof compScore === 'number') {
                  batchScores[chunk[idx].id] = compScore;
                }
              });
              if (Object.keys(batchScores).length > 0) {
                setUserScores((prev) => ({ ...prev, ...batchScores }));
              }
            } catch {
              if (signal.aborted) break;
            }
          }
        }
      };

      fetchBrandProducts();

      return () => {
        abortController.abort();
      };
    } else {
      setBrandProducts([]);
      setUserScores({});
    }
  }, [selectedBrandItem, user?.id]);

  const hasCompletedQuiz = useMemo(() => {
    return Boolean(userProfile?.skin_type && userProfile.skin_type.trim() !== '');
  }, [userProfile]);

  const getProductScore = (prod: any): number | null => {
    if (isProductCat3_11(prod)) {
      return null;
    }
    if (!hasCompletedQuiz) {
      return null;
    }
    if (userScores[prod.id] !== undefined) {
      return userScores[prod.id];
    }
    return computeProductFormulaScore(prod.product_scores, prod);
  };

  const sortedBrandProducts = useMemo(() => {
    if (brandProducts.length === 0) return [];
    const list = [...brandProducts];
    if (sortOption === 'highest_score') {
      return list.sort((a, b) => {
        const scoreA = getProductScore(a);
        const scoreB = getProductScore(b);
        if (scoreA === null && scoreB === null) return 0;
        if (scoreA === null) return 1;
        if (scoreB === null) return -1;
        return scoreB - scoreA;
      });
    }
    if (sortOption === 'name') {
      return list.sort((a, b) => (a.name || a.full_name || '').localeCompare(b.name || b.full_name || ''));
    }
    return list;
  }, [brandProducts, sortOption, userScores]);

  return (
    <motion.div 
      key="brands-page"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-3 md:space-y-4 max-w-6xl mx-auto w-full pb-16"
    >
      <div className="border-b border-black/5 pb-2.5 md:pb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {(selectedBrandItem || selectedBrandsLetter) && (
            <button 
              type="button"
              onClick={() => {
                if (selectedBrandItem) {
                  setSelectedBrandItem(null);
                } else {
                  setSelectedBrandsLetter(null);
                }
              }}
              className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black/70 hover:text-black transition-colors cursor-pointer shrink-0 -ml-1"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          )}
          <div>
            <h2 className="text-2xl md:text-3xl font-sans font-black text-black uppercase tracking-tight leading-tight">
              {selectedBrandItem ? selectedBrandItem.brand_name : 'Brands'}
            </h2>
            {selectedBrandItem && (
              <p className="text-xs font-bold text-black/50 mt-0.5">
                {loadingBrandProducts ? 'Loading...' : `${brandProducts.length} products in catalog`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Alphabet A to Z Bar */}
      <div className="bg-white border border-black/10 rounded-2xl p-2.5 md:p-3 shadow-sm">
        {/* Mobile View: A to G then little dropdown arrow for H-Z */}
        <div className="flex md:hidden items-center justify-center gap-1 sm:gap-1.5 w-full">
          {MOBILE_ROW_LETTERS.map((letter) => {
            const isSelected = selectedBrandsLetter === letter;
            return (
              <button
                key={letter}
                type="button"
                onClick={() => {
                  setSelectedBrandsLetter(isSelected ? null : letter);
                  setSelectedBrandItem(null);
                }}
                className={`w-8 h-8 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  isSelected 
                    ? 'bg-black text-white shadow-md scale-105' 
                    : 'bg-white text-black/80 border border-black/10 hover:bg-black/5 hover:border-black/30'
                }`}
              >
                {letter}
              </button>
            );
          })}

          {/* Little dropdown arrow for rest of letters (H to Z) */}
          <div className="relative shrink-0" ref={mobileBrandsDropdownRef}>
            <button
              type="button"
              onClick={() => setIsMobileBrandsDropdownOpen(!isMobileBrandsDropdownOpen)}
              className={`w-8 h-8 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                Boolean(selectedBrandsLetter && MOBILE_DROPDOWN_LETTERS.includes(selectedBrandsLetter))
                  ? 'bg-black text-white shadow-md scale-105'
                  : 'bg-white text-black/80 border border-black/10 hover:bg-black/5 hover:border-black/30'
              }`}
              aria-label="More letters"
              aria-expanded={isMobileBrandsDropdownOpen}
              title="More letters (H–Z)"
            >
              {selectedBrandsLetter && MOBILE_DROPDOWN_LETTERS.includes(selectedBrandsLetter) ? (
                <span className="flex items-center gap-0.5 text-[11px]">
                  {selectedBrandsLetter}
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isMobileBrandsDropdownOpen ? 'rotate-180' : ''}`} />
                </span>
              ) : (
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMobileBrandsDropdownOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {isMobileBrandsDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-black/10 rounded-2xl shadow-xl p-3 z-50 w-64 max-w-[90vw]">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    Letters (H–Z)
                  </span>
                  {selectedBrandsLetter && MOBILE_DROPDOWN_LETTERS.includes(selectedBrandsLetter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBrandsLetter(null);
                        setIsMobileBrandsDropdownOpen(false);
                      }}
                      className="text-[10px] font-bold text-black/50 hover:text-black underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {MOBILE_DROPDOWN_LETTERS.map((letter) => {
                    const isSelected = selectedBrandsLetter === letter;
                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => {
                          setSelectedBrandsLetter(isSelected ? null : letter);
                          setSelectedBrandItem(null);
                          setIsMobileBrandsDropdownOpen(false);
                        }}
                        className={`h-9 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'bg-black text-white shadow-sm'
                            : 'bg-black/5 text-black hover:bg-black/10'
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Web View: Two rows (A to M, and below that N to Z) */}
        <div className="hidden md:flex flex-col gap-2 items-center w-full">
          <div className="flex items-center justify-center gap-1.5 lg:gap-2">
            {WEB_ROW_1_LETTERS.map((letter) => {
              const isSelected = selectedBrandsLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => {
                    setSelectedBrandsLetter(isSelected ? null : letter);
                    setSelectedBrandItem(null);
                  }}
                  className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl font-black text-xs lg:text-sm transition-all cursor-pointer flex items-center justify-center ${
                    isSelected 
                      ? 'bg-black text-white shadow-md scale-105' 
                      : 'bg-white text-black/80 border border-black/10 hover:bg-black/5 hover:border-black/30'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-1.5 lg:gap-2">
            {WEB_ROW_2_LETTERS.map((letter) => {
              const isSelected = selectedBrandsLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => {
                    setSelectedBrandsLetter(isSelected ? null : letter);
                    setSelectedBrandItem(null);
                  }}
                  className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl font-black text-xs lg:text-sm transition-all cursor-pointer flex items-center justify-center ${
                    isSelected 
                      ? 'bg-black text-white shadow-md scale-105' 
                      : 'bg-white text-black/80 border border-black/10 hover:bg-black/5 hover:border-black/30'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content: Brands List or Brand Products */}
      {!selectedBrandItem ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {selectedBrandsLetter && (
                <button
                  type="button"
                  onClick={() => setSelectedBrandsLetter(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-black/60 hover:text-black transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-black/5 -ml-1"
                  aria-label="Back to all brands"
                  title="Back to all brands"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>All Brands</span>
                </button>
              )}
              {!selectedBrandsLetter && (
                <h3 className="text-lg font-black uppercase tracking-tight text-black">
                  All Brands
                </h3>
              )}
            </div>
            <span className="text-xs font-bold text-black/50">{brandsList.length} brands found</span>
          </div>

          {loadingBrands ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-black" />
            </div>
          ) : brandsList.length === 0 ? (
            <div className="bg-white border border-black/10 rounded-2xl p-12 text-center shadow-sm">
              <p className="text-sm font-bold text-black/60">No brands found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {brandsList.map((brand) => (
                <div
                  key={brand.brand_id || brand.brand_name}
                  onClick={() => setSelectedBrandItem(brand)}
                  className="bg-white border border-black/10 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-black/30 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-venus-accent block mb-1">Brand</span>
                    <h4 className="text-base font-bold text-black group-hover:underline">{brand.brand_name}</h4>
                    {brand.country && <p className="text-xs text-black/50 mt-1">{brand.country}</p>}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {selectedBrandItem && (() => {
            const activeShops = SHOP_LOGOS_CONFIG.filter(s => selectedBrandItem[s.key] === true);
            if (activeShops.length === 0) return null;
            return (
              <div className="bg-white border border-black/10 rounded-2xl p-3 sm:p-4 mb-3 sm:mb-4 shadow-sm relative">
                <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-black/50 mb-2 sm:mb-2.5">Available at</h3>

                {/* Mobile View: 4 per row, discrete dropdown button for the others if > 4 */}
                <div className="md:hidden">
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {activeShops.slice(0, 4).map(shop => (
                      <RetailerLogoBadge key={shop.key} shop={shop} />
                    ))}
                  </div>

                  {activeShops.length > 4 && (
                    <div className="relative mt-2 flex justify-center" ref={mobileShopsDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsMobileShopsDropdownOpen(prev => !prev)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 text-[10px] font-bold text-black/70 hover:text-black transition-colors cursor-pointer"
                        aria-expanded={isMobileShopsDropdownOpen}
                        title="More retailers"
                      >
                        <span>+{activeShops.length - 4} more</span>
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isMobileShopsDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isMobileShopsDropdownOpen && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 bg-white border border-black/10 rounded-2xl shadow-xl p-2.5 z-40 max-w-[95vw] w-max flex flex-col items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase tracking-wider text-black/40">Also available at</span>
                          <div className="flex items-center justify-center gap-1.5">
                            {activeShops.slice(4).map(shop => (
                              <div key={shop.key} className="w-[72px] sm:w-20">
                                <RetailerLogoBadge shop={shop} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Desktop View: smaller icons in horizontal flex row */}
                <div className="hidden md:flex flex-wrap items-center gap-2 lg:gap-2.5">
                  {activeShops.map(shop => (
                    <RetailerLogoBadge key={shop.key} shop={shop} />
                  ))}
                </div>
              </div>
            );
          })()}
          {loadingBrandProducts ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-black" />
            </div>
          ) : brandProducts.length === 0 ? (
            <div className="bg-white border border-black/10 rounded-2xl p-12 text-center shadow-sm">
              <p className="text-sm font-bold text-black/60">No products found for {selectedBrandItem.brand_name}.</p>
            </div>
          ) : (
            <div>
              {/* Product List Sub-header with Count & Sort Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-black/60">
                    Showing {sortedBrandProducts.length} {sortedBrandProducts.length === 1 ? 'product' : 'products'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-black/40">Sort:</span>
                  <div className="inline-flex p-0.5 bg-black/5 rounded-xl border border-black/5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setSortOption('default')}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sortOption === 'default'
                          ? 'bg-white text-black shadow-xs font-black'
                          : 'text-black/60 hover:text-black'
                      }`}
                    >
                      Default
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortOption('highest_score')}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sortOption === 'highest_score'
                          ? 'bg-white text-black shadow-xs font-black'
                          : 'text-black/60 hover:text-black'
                      }`}
                      title="Sort by best fit"
                    >
                      Best fit
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortOption('name')}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        sortOption === 'name'
                          ? 'bg-white text-black shadow-xs font-black'
                          : 'text-black/60 hover:text-black'
                      }`}
                    >
                      Name
                    </button>
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {sortedBrandProducts.map((prod) => {
                  const isCat3_11 = isProductCat3_11(prod);
                  const score = isCat3_11 ? null : getProductScore(prod);
                  const scoreConfig = score !== null && score !== undefined ? getScoreColorConfig(score) : null;

                  return (
                    <div 
                      key={prod.id}
                      onClick={() => onSelectProduct(prod)}
                      className="bg-white border border-black/10 rounded-2xl p-2.5 sm:p-4 shadow-sm hover:shadow-md hover:border-black/25 transition-all cursor-pointer flex flex-col justify-between group relative"
                    >
                      <div>
                        {/* Product Image Container */}
                        <div className="w-full h-32 sm:h-36 md:h-40 rounded-xl overflow-hidden mb-2 sm:mb-3 bg-neutral-50/80 border border-black/5 flex items-center justify-center p-2 sm:p-2.5">
                          {prod.photo_url ? (
                            <img 
                              src={prod.photo_url} 
                              alt={prod.name || prod.full_name || 'Product'} 
                              referrerPolicy="no-referrer" 
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200" 
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-black/25">
                              <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 mb-1 stroke-1" />
                              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">No Image</span>
                            </div>
                          )}
                        </div>

                        {/* Brand */}
                        <p className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-venus-accent mb-0.5 sm:mb-1 truncate">
                          {prod.brand || selectedBrandItem.brand_name}
                        </p>

                        {/* Product Name */}
                        <h4 className="text-xs sm:text-sm font-bold text-black line-clamp-2 mb-1.5 group-hover:underline leading-tight min-h-[2rem]">
                          {prod.name || prod.full_name}
                        </h4>

                        {/* Product Type & Score Pill Row */}
                        <div className="flex items-center justify-between gap-1.5 mb-2.5">
                          {prod.type ? (
                            <span className="inline-block px-1.5 py-0.5 bg-black/5 rounded text-[9px] sm:text-[10px] font-semibold text-black/70 truncate max-w-[48%]">
                              {prod.type}
                            </span>
                          ) : <span />}

                          {!isCat3_11 && (
                            hasCompletedQuiz ? (
                              score !== null && score !== undefined && scoreConfig ? (
                                <span 
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black border ${scoreConfig.pillClasses} shrink-0`}
                                  title={`Product Score: ${score}/100 (${scoreConfig.statusLabel})`}
                                >
                                  <span>{score}/100</span>
                                  <span className="text-[8px] font-bold uppercase opacity-80 hidden xs:inline sm:inline">· {scoreConfig.statusLabel}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-black/5 text-black/40">
                                  Score N/A
                                </span>
                              )
                            ) : (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.dispatchEvent(new CustomEvent('open-quiz-or-login'));
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black border bg-neutral-100 text-neutral-600 border-neutral-200 shrink-0 cursor-pointer hover:bg-neutral-200 transition-colors"
                                title="Take the skin quiz to find out if this product is a good fit!"
                              >
                                <span>?/100</span>
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-black/5 flex items-center justify-between text-[10px] sm:text-xs font-black uppercase text-black">
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
