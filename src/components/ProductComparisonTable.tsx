import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Heart, 
  RefreshCw, 
  Shield, 
  ShoppingBag, 
  ArrowLeftRight, 
  Search,
  FileText,
  FlaskConical,
  List,
  Star
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  computeProductKeyBenefits, 
  computeProductPotentialIrritants, 
  getMetricNamesForFlag, 
  RatingSlider 
} from './ProductCard';
import { Login } from './Login';

export function useProductDetail(productId: string | null, trackerItem?: any) {
  const [product, setProduct] = useState<any>(null);
  const [scores, setScores] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [comp, setComp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rpcErrorObj, setRpcErrorObj] = useState<any>(null);
  const [culprits, setCulprits] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [ratings, setRatings] = useState({ dwis: 0, price_value: 0, feel: 0, layer: 0 });
  const [imageError, setImageError] = useState(false);
  const [localSize, setLocalSize] = useState(trackerItem?.size || '');
  const [localNotes, setLocalNotes] = useState(trackerItem?.notes || '');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (trackerItem) {
      setLocalSize(trackerItem.size || '');
      setLocalNotes(trackerItem.notes || '');
    }
  }, [trackerItem]);

  const handleUpdateTracker = async (field: string, value: any) => {
    if (!trackerItem?.id) return;
    setIsUpdating(true);
    try {
      await supabase.from('tracker').update({ [field]: value }).eq('id', trackerItem.id);
    } catch {
      // silent error catch
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateRating = async (field: string, value: number) => {
    setRatings(prev => ({ ...prev, [field]: value }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id || !productId) return;

    try {
      await supabase
        .from('product_user_ratings')
        .upsert({
          product_id: String(productId),
          user_id: session.user.id,
          dwis: field === 'dwis' ? value : ratings.dwis || null,
          price_value: field === 'price_value' ? value : ratings.price_value || null,
          feel: field === 'feel' ? value : ratings.feel || null,
          layer: field === 'layer' ? value : ratings.layer || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'product_id, user_id'
        });
    } catch {
      // silent
    }
  };

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchProduct = async () => {
      if (!productId) {
        if (active) setLoading(false);
        return;
      }
      setLoading(true);
      setRpcErrorObj(null);
      setImageError(false);
      setCulprits([]);

      try {
        const sessionRes = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        const session = sessionRes?.data?.session;
        if (!active || signal.aborted) return;

        const isAuthed = !!session?.user?.id;
        setIsAuthenticated(isAuthed);

        const targetUserId = session?.user?.id || '00000000-0000-0000-0000-000000000000';

        const numericId = Number(productId);
        const isValidNumeric = !isNaN(numericId) && numericId > 0;
        const targetProductId = isValidNumeric
          ? numericId
          : (trackerItem?.product_id && !isNaN(Number(trackerItem.product_id)) ? Number(trackerItem.product_id) : null);

        const culpritsPromise = targetProductId != null
          ? (async () => {
              try {
                return await supabase
                  .from('product_metric_culprits')
                  .select('product_id, metric_name, ingredient_name, position, ingredient_id')
                  .eq('product_id', targetProductId)
                  .order('position', { ascending: true })
                  .abortSignal(signal);
              } catch (err: any) {
                return { data: [], error: err?.name === 'AbortError' ? null : err };
              }
            })()
          : Promise.resolve({ data: [], error: null });

        const productTablePromise = targetProductId != null
          ? (async () => {
              try {
                return await supabase
                  .from('products')
                  .select('*')
                  .eq('id', targetProductId)
                  .abortSignal(signal)
                  .maybeSingle();
              } catch (err: any) {
                return { data: null, error: err?.name === 'AbortError' ? null : err };
              }
            })()
          : Promise.resolve({ data: null, error: null });

        const scoreTablePromise = targetProductId != null
          ? (async () => {
              try {
                return await supabase
                  .from('product_scores')
                  .select('cat2, cat3')
                  .eq('product_id', targetProductId)
                  .abortSignal(signal)
                  .maybeSingle();
              } catch (err: any) {
                return { data: null, error: err?.name === 'AbortError' ? null : err };
              }
            })()
          : Promise.resolve({ data: null, error: null });

        const rpcPromise = (async () => {
          try {
            return await supabase
              .rpc('evaluate_product_compatibility', {
                p_user_id: targetUserId,
                p_product_id: String(productId)
              })
              .abortSignal(signal);
          } catch (err: any) {
            return { data: { error: err?.message || 'RPC Error' }, error: err };
          }
        })();

        const [rpcResult, culpritsResult, productTableResult, scoreTableResult] = await Promise.all([
          rpcPromise,
          culpritsPromise,
          productTablePromise,
          scoreTablePromise
        ]);
        if (!active || signal.aborted) return;

        if (culpritsResult?.data) {
          setCulprits(culpritsResult.data);
        }

        const tableProd = productTableResult?.data || null;
        const fetchedCat2 = scoreTableResult?.data?.cat2 || tableProd?.cat2 || trackerItem?.cat2 || '';
        if (tableProd) {
          tableProd.cat2 = fetchedCat2;
        }

        const { data, error } = rpcResult;

        if (error) {
          if (tableProd) {
            const formulaBenefits = computeProductKeyBenefits(tableProd, null);
            setProduct({
              ...tableProd,
              cat2: fetchedCat2,
              photo_url: tableProd.photo_url || trackerItem?.photo_url || null,
            });
            setComp({
              skinTypeFit: 'General Fit',
              conflicts: [],
              benefits: formulaBenefits,
              safetyConcerns: []
            });
            setScores(null);
            setRpcErrorObj(null);
          } else if (trackerItem) {
            setProduct({
              id: targetProductId || productId,
              name: trackerItem.product_name || 'Product',
              brand: trackerItem.brand || '',
              type: trackerItem.product_type || 'Skincare',
              photo_url: trackerItem.photo_url || null
            });
            setComp({ skinTypeFit: 'General Fit', conflicts: [], benefits: [], safetyConcerns: [] });
          } else {
            setRpcErrorObj({
              error: error.message,
              code: error.code,
              stuck_at_step: 'Postgres Driver / RPC Invocation'
            });
          }
        }

        if (data) {
          if (data.error) {
            const directProductRes = isValidNumeric ? await (async () => {
              try {
                return await supabase
                  .from('products')
                  .select('*')
                  .eq('id', numericId)
                  .abortSignal(signal)
                  .maybeSingle();
              } catch {
                return { data: null };
              }
            })() : { data: null };
            if (!active || signal.aborted) return;
            const directProduct = tableProd || directProductRes.data;

            if (directProduct) {
              directProduct.cat2 = fetchedCat2;
              setProduct({
                ...directProduct,
                cat2: fetchedCat2,
                photo_url: directProduct.photo_url || trackerItem?.photo_url || null,
              });
              setComp({
                skinTypeFit: 'General Fit',
                conflicts: [],
                benefits: computeProductKeyBenefits(directProduct, null),
                safetyConcerns: []
              });
              setRpcErrorObj(null);
            } else if (trackerItem) {
              setProduct({
                id: targetProductId || productId,
                name: trackerItem.product_name || 'Product',
                brand: trackerItem.brand || '',
                type: trackerItem.product_type || 'Skincare',
                photo_url: trackerItem.photo_url || null
              });
              setComp({ skinTypeFit: 'General Fit', conflicts: [], benefits: [], safetyConcerns: [] });
            } else {
              setRpcErrorObj(data);
            }
          } else {
            const finalCat2 = fetchedCat2 || data?.scores?.cat2 || data?.product?.cat2 || '';
            const effectiveScores = data.scores || {
              oil_free: true,
              sulfate_free: true,
              contains_frag: false,
              has_fragrance_top50: false,
              has_yeast_trigger: false,
              night: false
            };
            effectiveScores.cat2 = finalCat2;

            const p = data.product || {};
            p.cat2 = finalCat2;

            const formulaBenefits = computeProductKeyBenefits(p, effectiveScores, data.compatibility?.benefits);
            const formulaConcerns = computeProductPotentialIrritants(effectiveScores, data.compatibility?.safetyConcerns);

            const effectiveComp = {
              ...(data.compatibility || {
                skinTypeFit: 'General Catalog Formula',
                conflicts: []
              }),
              benefits: formulaBenefits,
              safetyConcerns: formulaConcerns
            };

            const mergedProduct = {
              ...(tableProd || {}),
              ...p,
              cat2: finalCat2,
              photo_url: p.photo_url || tableProd?.photo_url || trackerItem?.photo_url || null,
              ingredients: p.ingredients || tableProd?.ingredients || [],
              name: p.name || tableProd?.name || trackerItem?.product_name || 'Product Name',
              brand: p.brand || tableProd?.brand || trackerItem?.brand || 'Brand',
              type: p.type || tableProd?.type || trackerItem?.product_type || 'Skincare',
              description: p.description || tableProd?.description || ''
            };

            setProduct(mergedProduct);
            setScores(effectiveScores);
            setUserProfile(data.user_meta);
            setComp(effectiveComp);
            setRpcErrorObj(null);
          }
        }

        if (session?.user?.id) {
          const ratingRes = await (async () => {
            try {
              return await supabase
                .from('product_user_ratings')
                .select('*')
                .eq('product_id', String(productId))
                .eq('user_id', session.user.id)
                .abortSignal(signal)
                .maybeSingle();
            } catch {
              return { data: null };
            }
          })();

          if (!active || signal.aborted) return;
          const ratingData = ratingRes?.data;
          if (ratingData) {
            setRatings({
              dwis: ratingData.dwis || 0,
              price_value: ratingData.price_value || 0,
              feel: ratingData.feel || 0,
              layer: ratingData.layer || 0
            });
          } else {
            setRatings({ dwis: 0, price_value: 0, feel: 0, layer: 0 });
          }
        } else {
          setRatings({ dwis: 0, price_value: 0, feel: 0, layer: 0 });
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) return;
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProduct();
    return () => {
      active = false;
      abortController.abort();
    };
  }, [productId]);

  return {
    product,
    scores,
    userProfile,
    comp,
    loading,
    rpcErrorObj,
    culprits,
    ratings,
    handleUpdateRating,
    isAuthenticated,
    setIsAuthenticated,
    imageError,
    setImageError,
    localSize,
    setLocalSize,
    localNotes,
    setLocalNotes,
    isUpdating,
    handleUpdateTracker
  };
}

interface ProductComparisonTableProps {
  productId1: string;
  productId2: string;
  trackerItem1?: any;
  trackerItem2?: any;
  onClose: () => void;
  onCloseProduct1: () => void;
  onCloseProduct2: () => void;
  onSwapProduct: (targetSlot: 'product1' | 'product2', newProductId: string) => void;
}

export const ProductComparisonTable: React.FC<ProductComparisonTableProps> = ({
  productId1,
  productId2,
  trackerItem1,
  trackerItem2,
  onClose,
  onCloseProduct1,
  onCloseProduct2,
  onSwapProduct
}) => {
  const p1 = useProductDetail(productId1, trackerItem1);
  const p2 = useProductDetail(productId2, trackerItem2);

  // Expanded culprits flags
  const [expandedBenefit1, setExpandedBenefit1] = useState<string | null>(null);
  const [expandedBenefit2, setExpandedBenefit2] = useState<string | null>(null);
  const [expandedIrritant1, setExpandedIrritant1] = useState<string | null>(null);
  const [expandedIrritant2, setExpandedIrritant2] = useState<string | null>(null);

  // Ingredients expansion
  const [expandIngredients1, setExpandIngredients1] = useState(false);
  const [expandIngredients2, setExpandIngredients2] = useState(false);

  // Mobile scroll & active tab state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeMobileProduct, setActiveMobileProduct] = useState<'product1' | 'product2'>('product1');

  const scrollToProduct = (slot: 'product1' | 'product2') => {
    setActiveMobileProduct(slot);
    if (!tableContainerRef.current) return;
    if (slot === 'product1') {
      tableContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const container = tableContainerRef.current;
      const targetScroll = Math.max(container.clientWidth - 65, 250);
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    if (scrollLeft > 60) {
      if (activeMobileProduct !== 'product2') setActiveMobileProduct('product2');
    } else {
      if (activeMobileProduct !== 'product1') setActiveMobileProduct('product1');
    }
  };

  // Comparison popup controls
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthModalSignUp, setIsAuthModalSignUp] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTargetSlot, setSearchTargetSlot] = useState<'product1' | 'product2'>('product2');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [initialSuggestions, setInitialSuggestions] = useState<any[]>([]);

  const loadInitialSuggestions = async (excludeId: string) => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, brand, name, type, photo_url')
        .order('id', { ascending: false })
        .limit(10);
      const filtered = (data || []).filter(item => String(item.id) !== String(excludeId));
      setInitialSuggestions(filtered);
      if (!searchQuery.trim()) {
        setSearchResults(filtered);
      }
    } catch {
      // silent
    }
  };

  const handleCompareClick = async (targetSlot: 'product1' | 'product2') => {
    setSearchTargetSlot(targetSlot);
    const { data: { session } } = await supabase.auth.getSession();
    const authed = !!session?.user?.id;
    if (!authed) {
      setShowAuthModal(true);
    } else {
      setShowSearchModal(true);
      const currentIdToExclude = targetSlot === 'product1' ? productId1 : productId2;
      loadInitialSuggestions(currentIdToExclude);
    }
  };

  const performSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) {
      setSearchResults(initialSuggestions);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const words = q
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length > 0)
        .map(w => `${w}:*`);

      const formattedQuery = words.length > 0 ? words.join(' & ') : '';
      let results: any[] = [];

      if (formattedQuery) {
        const { data, error } = await supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', formattedQuery, { config: 'english' })
          .limit(15);
        if (!error && data && data.length > 0) {
          results = data;
        }
      }

      if (results.length === 0) {
        const { data: webData } = await supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', q, { config: 'english', type: 'websearch' })
          .limit(15);
        if (webData && webData.length > 0) {
          results = webData;
        } else {
          const { data: ilikeData } = await supabase
            .from('products')
            .select('id, brand, name, type, photo_url')
            .or(`brand.ilike.%${q}%,name.ilike.%${q}%`)
            .limit(15);
          results = ilikeData || [];
        }
      }

      const otherProductId = searchTargetSlot === 'product1' ? productId2 : productId1;
      const filtered = (results || []).filter(item => String(item.id) !== String(otherProductId));
      setSearchResults(filtered);
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!showSearchModal) return;
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, showSearchModal]);

  const handleSelectProduct = (chosenId: string | number) => {
    setShowSearchModal(false);
    onSwapProduct(searchTargetSlot, String(chosenId));
  };

  const getIngredientsForFlag = (flagName: string, culprits: any[]) => {
    const metrics = getMetricNamesForFlag(flagName);
    if (!metrics || metrics.length === 0) return [];
    const rawIngs = (culprits || []).filter((c: any) => c.metric_name && metrics.includes(c.metric_name));
    const seen = new Set<string>();
    return rawIngs.filter((item: any) => {
      const name = (item.ingredient_name || '').trim().toLowerCase();
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  };

  const isAnyUnauthed = !p1.isAuthenticated || !p2.isAuthenticated;

  return (
    <div 
      className="w-full max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[94vh] sm:max-h-[92vh] overflow-hidden my-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-black text-white px-3 sm:px-5 py-2.5 sm:py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-white">Side-by-Side Comparison</h2>
            <p className="text-[10px] text-white/50 hidden sm:block">Rows display respective formula sections for direct side-by-side analysis</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onCloseProduct2}
            className="text-[10px] sm:text-[11px] font-bold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
            title="Keep Product A only"
          >
            Exit Comparison
          </button>
          <button
            type="button"
            aria-label="Close comparison modal"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Product Quick Tab Bar */}
      <div className="sm:hidden flex items-center justify-between bg-gray-100/90 border-b border-gray-200 px-2.5 py-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => scrollToProduct('product1')}
            className={`flex-1 py-1 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              activeMobileProduct === 'product1'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-black/60 hover:text-black border border-gray-200/80'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
            <span className="truncate">{p1.product?.name ? `Product A (${p1.product.name})` : 'Product A'}</span>
          </button>
          <button
            type="button"
            onClick={() => scrollToProduct('product2')}
            className={`flex-1 py-1 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              activeMobileProduct === 'product2'
                ? 'bg-black text-white shadow-xs'
                : 'bg-white text-black/60 hover:text-black border border-gray-200/80'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
            <span className="truncate">{p2.product?.name ? `Product B (${p2.product.name})` : 'Product B'}</span>
          </button>
        </div>
        <div className="pl-2 text-[9px] text-black/40 font-bold uppercase tracking-wider flex items-center gap-0.5 select-none shrink-0">
          <ArrowLeftRight className="w-2.5 h-2.5 text-purple-600" />
          <span>Swipe</span>
        </div>
      </div>

      {/* Unauthenticated Alert Banner */}
      {isAnyUnauthed && (
        <div className="bg-amber-50 border-b border-amber-200/80 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs flex-shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 text-amber-900 font-bold text-[11px] sm:text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span>Take quiz or log in to check skin compatibility fit</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('open-quiz-or-login'));
              }}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-black text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-black/80 transition-colors cursor-pointer"
            >
              Quiz
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('open-login-modal'));
              }}
              className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-black underline hover:text-venus-accent cursor-pointer"
            >
              Log In
            </button>
          </div>
        </div>
      )}

      {/* Synchronized Table View */}
      <div 
        ref={tableContainerRef}
        onScroll={handleTableScroll}
        className="overflow-y-auto overflow-x-auto flex-1 snap-x snap-mandatory sm:snap-none scroll-smooth scroll-pl-[70px] sm:scroll-pl-24 md:scroll-pl-32"
      >
        <table className="w-max sm:w-full border-collapse text-left table-fixed">
          <colgroup>
            <col className="w-[70px] sm:w-24 md:w-32" />
            <col className="w-[calc(100vw-86px)] max-w-[340px] sm:w-[calc(50%-3rem)] md:w-[calc(50%-4rem)]" />
            <col className="w-[calc(100vw-86px)] max-w-[340px] sm:w-[calc(50%-3rem)] md:w-[calc(50%-4rem)]" />
          </colgroup>
          <tbody>
            {/* ROW 1: PRODUCT HEADER & SUMMARY */}
            <tr className="border-b border-gray-200/80 bg-gray-50/40">
              <td className="px-1.5 py-3 sm:px-3 sm:py-4 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-black/5 flex items-center justify-center text-black/60 sm:hidden">
                    <ShoppingBag className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-tight text-black/60 leading-tight">
                    Product
                  </span>
                </div>
              </td>
              {/* Product 1 Header */}
              <td className="p-2.5 sm:p-4 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md">
                    Product A
                  </span>
                  <button
                    type="button"
                    aria-label="Remove Product A"
                    onClick={onCloseProduct1}
                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-gray-400 transition-colors cursor-pointer"
                    title="Remove and keep Product B"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {p1.loading ? (
                  <div className="flex items-center gap-2 py-6 text-gray-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span>Loading Product A...</span>
                  </div>
                ) : p1.product ? (
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    {p1.product.photo_url && !p1.imageError ? (
                      <img
                        src={p1.product.photo_url}
                        alt={p1.product.name}
                        referrerPolicy="no-referrer"
                        onError={() => p1.setImageError(true)}
                        className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-xl sm:rounded-2xl flex-shrink-0 border border-black/5 bg-gray-50 shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 border border-black/5">
                        <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/40 block truncate">
                        {p1.product.brand || 'Brand'}
                      </span>
                      <h3 className="text-xs sm:text-sm font-black text-black leading-snug break-words line-clamp-2">
                        {p1.product.name}
                      </h3>
                      {p1.product.type && (
                        <span className="text-[8px] sm:text-[9px] font-bold text-black/60 bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded-md inline-block mt-1 truncate max-w-full">
                          {p1.product.type}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-red-500 font-bold">Failed to load product.</div>
                )}
              </td>

              {/* Product 2 Header */}
              <td className="p-2.5 sm:p-4 align-top bg-white snap-start relative min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md">
                    Product B
                  </span>
                  <button
                    type="button"
                    aria-label="Remove Product B"
                    onClick={onCloseProduct2}
                    className="w-6 h-6 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-gray-400 transition-colors cursor-pointer"
                    title="Remove and keep Product A"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {p2.loading ? (
                  <div className="flex items-center gap-2 py-6 text-gray-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span>Loading Product B...</span>
                  </div>
                ) : p2.product ? (
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    {p2.product.photo_url && !p2.imageError ? (
                      <img
                        src={p2.product.photo_url}
                        alt={p2.product.name}
                        referrerPolicy="no-referrer"
                        onError={() => p2.setImageError(true)}
                        className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-xl sm:rounded-2xl flex-shrink-0 border border-black/5 bg-gray-50 shadow-xs"
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 border border-black/5">
                        <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/40 block truncate">
                        {p2.product.brand || 'Brand'}
                      </span>
                      <h3 className="text-xs sm:text-sm font-black text-black leading-snug break-words line-clamp-2">
                        {p2.product.name}
                      </h3>
                      {p2.product.type && (
                        <span className="text-[8px] sm:text-[9px] font-bold text-black/60 bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded-md inline-block mt-1 truncate max-w-full">
                          {p2.product.type}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-red-500 font-bold">Failed to load product.</div>
                )}
              </td>
            </tr>

            {/* ROW 2: DESCRIPTION + DISCRETE COMPARE BUTTON */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-3 sm:px-3 sm:py-4 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-black/5 flex items-center justify-center text-black/60 sm:hidden">
                    <FileText className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-tight text-black/60 leading-tight">
                    <span className="sm:hidden">Details</span>
                    <span className="hidden sm:inline">Description</span>
                  </span>
                </div>
              </td>
              {/* Product 1 Description */}
              <td className="p-2.5 sm:p-4 align-top border-r border-gray-100 bg-white snap-start relative space-y-2 min-w-0">
                <p className="text-[11px] sm:text-xs text-black/70 leading-relaxed break-words min-h-[32px]">
                  {p1.product?.description || <span className="text-black/30 italic">No description provided</span>}
                </p>
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleCompareClick('product1')}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-black rounded-lg transition-colors border border-gray-200/80 cursor-pointer shadow-2xs group"
                    title="Change or compare Product A with another product"
                  >
                    <ArrowLeftRight className="w-3 h-3 text-gray-500 group-hover:text-black transition-colors" />
                    <span>Compare</span>
                  </button>
                </div>
              </td>
              {/* Product 2 Description */}
              <td className="p-2.5 sm:p-4 align-top bg-white snap-start relative space-y-2 min-w-0">
                <p className="text-[11px] sm:text-xs text-black/70 leading-relaxed break-words min-h-[32px]">
                  {p2.product?.description || <span className="text-black/30 italic">No description provided</span>}
                </p>
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleCompareClick('product2')}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-black rounded-lg transition-colors border border-gray-200/80 cursor-pointer shadow-2xs group"
                    title="Change or compare Product B with another product"
                  >
                    <ArrowLeftRight className="w-3 h-3 text-gray-500 group-hover:text-black transition-colors" />
                    <span>Compare</span>
                  </button>
                </div>
              </td>
            </tr>

            {/* ROW 3: SKIN COMPATIBILITY */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-3 sm:px-3 sm:py-4 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-purple-50 flex items-center justify-center text-purple-600 sm:hidden">
                    <Shield className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-tight text-black/60 leading-tight">
                    Skin Fit
                  </span>
                </div>
              </td>
              {/* Product 1 Compatibility */}
              <td className="p-2.5 sm:p-4 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                {p1.isAuthenticated && p1.comp ? (
                  <div className="space-y-1.5">
                    <span className={`inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wide border ${
                      p1.comp.skinTypeFit === 'Good Fit' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      p1.comp.skinTypeFit === 'Bad Fit' ? 'bg-red-100 text-red-800 border-red-300' : 
                      'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {p1.comp.skinTypeFit || 'Compatible'}
                    </span>
                    {p1.comp.conflicts && p1.comp.conflicts.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {p1.comp.conflicts.map((conflict: string, idx: number) => (
                          <span key={idx} className="bg-red-50 text-red-900 border border-red-200/60 rounded-md px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-bold flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5 text-red-600 flex-shrink-0" /> <span className="break-words">{conflict}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9.5px] sm:text-[10px] text-emerald-700 font-semibold pt-0.5">No ingredient conflicts detected</p>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-black/40 italic">Log in to view compatibility</span>
                )}
              </td>
              {/* Product 2 Compatibility */}
              <td className="p-2.5 sm:p-4 align-top bg-white snap-start relative min-w-0">
                {p2.isAuthenticated && p2.comp ? (
                  <div className="space-y-1.5">
                    <span className={`inline-block px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wide border ${
                      p2.comp.skinTypeFit === 'Good Fit' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      p2.comp.skinTypeFit === 'Bad Fit' ? 'bg-red-100 text-red-800 border-red-300' : 
                      'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {p2.comp.skinTypeFit || 'Compatible'}
                    </span>
                    {p2.comp.conflicts && p2.comp.conflicts.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {p2.comp.conflicts.map((conflict: string, idx: number) => (
                          <span key={idx} className="bg-red-50 text-red-900 border border-red-200/60 rounded-md px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-bold flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5 text-red-600 flex-shrink-0" /> <span className="break-words">{conflict}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[9.5px] sm:text-[10px] text-emerald-700 font-semibold pt-0.5">No ingredient conflicts detected</p>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-black/40 italic">Log in to view compatibility</span>
                )}
              </td>
            </tr>

            {/* ROW 4: KEY BENEFITS */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-3 sm:px-3 sm:py-4 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-purple-50 flex items-center justify-center text-purple-600 sm:hidden">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-tight text-black/60 leading-tight">
                    <span className="sm:hidden">Benefits</span>
                    <span className="hidden sm:inline">Key Benefits</span>
                  </span>
                </div>
              </td>
              {/* Product 1 Key Benefits */}
              <td className="p-2.5 sm:p-4 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                {p1.comp?.benefits && p1.comp.benefits.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {p1.comp.benefits.map((benefit: string, idx: number) => {
                        const matched = getIngredientsForFlag(benefit, p1.culprits);
                        const isClickable = matched.length > 0;
                        const isExpanded = expandedBenefit1 === benefit;

                        return (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => isClickable && setExpandedBenefit1(isExpanded ? null : benefit)}
                            className={`border rounded-md px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-bold flex items-center gap-1 transition-all text-left ${
                              isExpanded
                                ? 'bg-purple-100 text-purple-950 border-purple-400 shadow-xs'
                                : 'bg-purple-50 text-purple-900 border-purple-200/60'
                            } ${isClickable ? 'cursor-pointer hover:bg-purple-100' : 'cursor-default'}`}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                            <span>{benefit}</span>
                            {isClickable && (
                              <span className="flex items-center gap-0.5 ml-0.5 text-[8px] text-purple-700 bg-purple-200/70 px-1 py-0.1 rounded font-mono font-bold">
                                {matched.length}
                                {isExpanded ? <ChevronUp className="w-2 h-2" /> : <ChevronDown className="w-2 h-2" />}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Drawer for Benefit 1 */}
                    {expandedBenefit1 && (() => {
                      const ings = getIngredientsForFlag(expandedBenefit1, p1.culprits);
                      if (ings.length === 0) return null;
                      return (
                        <div className="p-2 bg-purple-50/80 border border-purple-200/80 rounded-xl space-y-1">
                          <div className="text-[9px] font-black uppercase text-purple-900">
                            {expandedBenefit1} ({ings.length} Active Ingredients)
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                            {ings.map((item: any, iIdx: number) => (
                              <div key={iIdx} className="bg-white px-2 py-1 rounded text-[10px] font-semibold text-gray-800 flex justify-between shadow-2xs">
                                <span className="truncate">{item.ingredient_name}</span>
                                {item.position != null && <span className="text-[8px] font-mono text-purple-700 font-bold">#{item.position}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-black/40 italic">No specific benefits flagged</span>
                )}
              </td>

              {/* Product 2 Key Benefits */}
              <td className="p-2.5 sm:p-4 align-top bg-white snap-start relative min-w-0">
                {p2.comp?.benefits && p2.comp.benefits.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {p2.comp.benefits.map((benefit: string, idx: number) => {
                        const matched = getIngredientsForFlag(benefit, p2.culprits);
                        const isClickable = matched.length > 0;
                        const isExpanded = expandedBenefit2 === benefit;

                        return (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => isClickable && setExpandedBenefit2(isExpanded ? null : benefit)}
                            className={`border rounded-md px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-bold flex items-center gap-1 transition-all text-left ${
                              isExpanded
                                ? 'bg-purple-100 text-purple-950 border-purple-400 shadow-xs'
                                : 'bg-purple-50 text-purple-900 border-purple-200/60'
                            } ${isClickable ? 'cursor-pointer hover:bg-purple-100' : 'cursor-default'}`}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                            <span>{benefit}</span>
                            {isClickable && (
                              <span className="flex items-center gap-0.5 ml-0.5 text-[8px] text-purple-700 bg-purple-200/70 px-1 py-0.1 rounded font-mono font-bold">
                                {matched.length}
                                {isExpanded ? <ChevronUp className="w-2 h-2" /> : <ChevronDown className="w-2 h-2" />}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Drawer for Benefit 2 */}
                    {expandedBenefit2 && (() => {
                      const ings = getIngredientsForFlag(expandedBenefit2, p2.culprits);
                      if (ings.length === 0) return null;
                      return (
                        <div className="p-2 bg-purple-50/80 border border-purple-200/80 rounded-xl space-y-1">
                          <div className="text-[9px] font-black uppercase text-purple-900">
                            {expandedBenefit2} ({ings.length} Active Ingredients)
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                            {ings.map((item: any, iIdx: number) => (
                              <div key={iIdx} className="bg-white px-2 py-1 rounded text-[10px] font-semibold text-gray-800 flex justify-between shadow-2xs">
                                <span className="truncate">{item.ingredient_name}</span>
                                {item.position != null && <span className="text-[8px] font-mono text-purple-700 font-bold">#{item.position}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-black/40 italic">No specific benefits flagged</span>
                )}
              </td>
            </tr>

            {/* ROW 5: POTENTIAL IRRITANTS */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-3 sm:px-3 sm:py-4 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center text-amber-600 sm:hidden">
                    <AlertTriangle className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-tight text-black/60 leading-tight">
                    <span className="sm:hidden">Irritants</span>
                    <span className="hidden sm:inline">Potential Irritants</span>
                  </span>
                </div>
              </td>
              {/* Product 1 Irritants */}
              <td className="p-2.5 sm:p-4 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                {p1.comp?.safetyConcerns && p1.comp.safetyConcerns.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {p1.comp.safetyConcerns.map((concern: string, idx: number) => {
                        const matched = getIngredientsForFlag(concern, p1.culprits);
                        const isClickable = matched.length > 0;
                        const isExpanded = expandedIrritant1 === concern;

                        return (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => isClickable && setExpandedIrritant1(isExpanded ? null : concern)}
                            className={`border rounded-md px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-bold flex items-center gap-1 transition-all text-left ${
                              isExpanded
                                ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs'
                                : 'bg-amber-50 text-amber-900 border-amber-200/60'
                            } ${isClickable ? 'cursor-pointer hover:bg-amber-100' : 'cursor-default'}`}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                            <span>{concern}</span>
                            {isClickable && (
                              <span className="flex items-center gap-0.5 ml-0.5 text-[8px] text-amber-800 bg-amber-200/70 px-1 py-0.1 rounded font-mono font-bold">
                                {matched.length}
                                {isExpanded ? <ChevronUp className="w-2 h-2" /> : <ChevronDown className="w-2 h-2" />}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Drawer for Irritant 1 */}
                    {expandedIrritant1 && (() => {
                      const ings = getIngredientsForFlag(expandedIrritant1, p1.culprits);
                      if (ings.length === 0) return null;
                      return (
                        <div className="p-2 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-1">
                          <div className="text-[9px] font-black uppercase text-amber-900">
                            {expandedIrritant1} ({ings.length} Trigger Ingredients)
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                            {ings.map((item: any, iIdx: number) => (
                              <div key={iIdx} className="bg-white px-2 py-1 rounded text-[10px] font-semibold text-gray-800 flex justify-between shadow-2xs">
                                <span className="truncate">{item.ingredient_name}</span>
                                {item.position != null && <span className="text-[8px] font-mono text-amber-800 font-bold">#{item.position}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> None detected
                  </span>
                )}
              </td>

              {/* Product 2 Irritants */}
              <td className="p-2.5 sm:p-4 align-top bg-white snap-start relative min-w-0">
                {p2.comp?.safetyConcerns && p2.comp.safetyConcerns.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {p2.comp.safetyConcerns.map((concern: string, idx: number) => {
                        const matched = getIngredientsForFlag(concern, p2.culprits);
                        const isClickable = matched.length > 0;
                        const isExpanded = expandedIrritant2 === concern;

                        return (
                          <button
                            type="button"
                            key={idx}
                            onClick={() => isClickable && setExpandedIrritant2(isExpanded ? null : concern)}
                            className={`border rounded-md px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-bold flex items-center gap-1 transition-all text-left ${
                              isExpanded
                                ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs'
                                : 'bg-amber-50 text-amber-900 border-amber-200/60'
                            } ${isClickable ? 'cursor-pointer hover:bg-amber-100' : 'cursor-default'}`}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                            <span>{concern}</span>
                            {isClickable && (
                              <span className="flex items-center gap-0.5 ml-0.5 text-[8px] text-amber-800 bg-amber-200/70 px-1 py-0.1 rounded font-mono font-bold">
                                {matched.length}
                                {isExpanded ? <ChevronUp className="w-2 h-2" /> : <ChevronDown className="w-2 h-2" />}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {/* Drawer for Irritant 2 */}
                    {expandedIrritant2 && (() => {
                      const ings = getIngredientsForFlag(expandedIrritant2, p2.culprits);
                      if (ings.length === 0) return null;
                      return (
                        <div className="p-2 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-1">
                          <div className="text-[9px] font-black uppercase text-amber-900">
                            {expandedIrritant2} ({ings.length} Trigger Ingredients)
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                            {ings.map((item: any, iIdx: number) => (
                              <div key={iIdx} className="bg-white px-2 py-1 rounded text-[10px] font-semibold text-gray-800 flex justify-between shadow-2xs">
                                <span className="truncate">{item.ingredient_name}</span>
                                {item.position != null && <span className="text-[8px] font-mono text-amber-800 font-bold">#{item.position}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> None detected
                  </span>
                )}
              </td>
            </tr>

            {/* ROW 6: FORMULA PROPERTIES */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-3 sm:px-3 sm:py-4 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-black/5 flex items-center justify-center text-black/60 sm:hidden">
                    <FlaskConical className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-tight text-black/60 leading-tight">
                    <span className="sm:hidden">Formula</span>
                    <span className="hidden sm:inline">Formula Properties</span>
                  </span>
                </div>
              </td>
              {/* Product 1 Properties */}
              <td className="p-2.5 sm:p-4 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                {p1.scores ? (
                  <div className="grid grid-cols-2 gap-1 sm:gap-1.5 text-[9px] sm:text-[10px]">
                    <div className="flex items-center justify-between bg-gray-50 px-1.5 sm:px-2 py-1 rounded border border-black/5 min-w-0">
                      <span className="text-gray-500 truncate mr-1">Oil-Free</span>
                      <span className={`font-bold shrink-0 ${p1.scores.oil_free ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {p1.scores.oil_free ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 px-1.5 sm:px-2 py-1 rounded border border-black/5 min-w-0">
                      <span className="text-gray-500 truncate mr-1">Sulfate-Free</span>
                      <span className={`font-bold shrink-0 ${p1.scores.sulfate_free ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {p1.scores.sulfate_free ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 px-1.5 sm:px-2 py-1 rounded border border-black/5 min-w-0">
                      <span className="text-gray-500 truncate mr-1">Fragrance-Free</span>
                      <span className={`font-bold shrink-0 ${(!p1.scores.contains_frag && !p1.scores.has_fragrance_top50) ? 'text-emerald-600' : 'text-amber-700'}`}>
                        {(!p1.scores.contains_frag && !p1.scores.has_fragrance_top50) ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 px-1.5 sm:px-2 py-1 rounded border border-black/5 min-w-0">
                      <span className="text-gray-500 truncate mr-1">Malassezia Safe</span>
                      <span className={`font-bold shrink-0 ${!p1.scores.has_yeast_trigger ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {!p1.scores.has_yeast_trigger ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-black/40 italic">Properties loading...</span>
                )}
              </td>

              {/* Product 2 Properties */}
              <td className="p-2.5 sm:p-4 align-top bg-white snap-start relative min-w-0">
                {p2.scores ? (
                  <div className="grid grid-cols-2 gap-1 sm:gap-1.5 text-[9px] sm:text-[10px]">
                    <div className="flex items-center justify-between bg-gray-50 px-1.5 sm:px-2 py-1 rounded border border-black/5 min-w-0">
                      <span className="text-gray-500 truncate mr-1">Oil-Free</span>
                      <span className={`font-bold shrink-0 ${p2.scores.oil_free ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {p2.scores.oil_free ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 px-1.5 sm:px-2 py-1 rounded border border-black/5 min-w-0">
                      <span className="text-gray-500 truncate mr-1">Sulfate-Free</span>
                      <span className={`font-bold shrink-0 ${p2.scores.sulfate_free ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {p2.scores.sulfate_free ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 px-1.5 sm:px-2 py-1 rounded border border-black/5 min-w-0">
                      <span className="text-gray-500 truncate mr-1">Fragrance-Free</span>
                      <span className={`font-bold shrink-0 ${(!p2.scores.contains_frag && !p2.scores.has_fragrance_top50) ? 'text-emerald-600' : 'text-amber-700'}`}>
                        {(!p2.scores.contains_frag && !p2.scores.has_fragrance_top50) ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 px-1.5 sm:px-2 py-1 rounded border border-black/5 min-w-0">
                      <span className="text-gray-500 truncate mr-1">Malassezia Safe</span>
                      <span className={`font-bold shrink-0 ${!p2.scores.has_yeast_trigger ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {!p2.scores.has_yeast_trigger ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-black/40 italic">Properties loading...</span>
                )}
              </td>
            </tr>

            {/* ROW 7: INGREDIENTS LIST */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-3 sm:px-3 sm:py-4 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-black/5 flex items-center justify-center text-black/60 sm:hidden">
                    <List className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-tight text-black/60 leading-tight">
                    Ingredients
                  </span>
                </div>
              </td>
              {/* Product 1 Ingredients */}
              <td className="p-2.5 sm:p-4 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                {p1.product?.ingredients && p1.product.ingredients.length > 0 ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandIngredients1(!expandIngredients1)}
                      className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-black text-black uppercase underline cursor-pointer mb-1"
                    >
                      {expandIngredients1 ? 'Hide ingredients' : `View all ingredients (${p1.product.ingredients.length})`}
                      {expandIngredients1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {expandIngredients1 ? (
                      <p className="text-[10.5px] sm:text-xs text-black/70 bg-black/5 p-2 rounded-xl break-words leading-relaxed max-h-48 overflow-y-auto font-mono">
                        {Array.isArray(p1.product.ingredients) ? p1.product.ingredients.join(', ') : p1.product.ingredients}
                      </p>
                    ) : (
                      <p className="text-[10.5px] sm:text-xs text-black/60 truncate font-mono">
                        {Array.isArray(p1.product.ingredients) ? p1.product.ingredients.slice(0, 4).join(', ') + '...' : p1.product.ingredients}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-black/40 italic">No ingredient list available</span>
                )}
              </td>

              {/* Product 2 Ingredients */}
              <td className="p-2.5 sm:p-4 align-top bg-white snap-start relative min-w-0">
                {p2.product?.ingredients && p2.product.ingredients.length > 0 ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandIngredients2(!expandIngredients2)}
                      className="flex items-center gap-1 text-[9.5px] sm:text-[10px] font-black text-black uppercase underline cursor-pointer mb-1"
                    >
                      {expandIngredients2 ? 'Hide ingredients' : `View all ingredients (${p2.product.ingredients.length})`}
                      {expandIngredients2 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {expandIngredients2 ? (
                      <p className="text-[10.5px] sm:text-xs text-black/70 bg-black/5 p-2 rounded-xl break-words leading-relaxed max-h-48 overflow-y-auto font-mono">
                        {Array.isArray(p2.product.ingredients) ? p2.product.ingredients.join(', ') : p2.product.ingredients}
                      </p>
                    ) : (
                      <p className="text-[10.5px] sm:text-xs text-black/60 truncate font-mono">
                        {Array.isArray(p2.product.ingredients) ? p2.product.ingredients.slice(0, 4).join(', ') + '...' : p2.product.ingredients}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-black/40 italic">No ingredient list available</span>
                )}
              </td>
            </tr>

            {/* ROW 8: RATINGS & TRACKER */}
            <tr className="hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-3 sm:px-3 sm:py-4 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center text-amber-600 sm:hidden">
                    <Star className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[10px] uppercase tracking-tight text-black/60 leading-tight">
                    <span className="sm:hidden">Ratings</span>
                    <span className="hidden sm:inline">User Ratings</span>
                  </span>
                </div>
              </td>
              {/* Product 1 Ratings */}
              <td className="p-2.5 sm:p-4 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                <div className="space-y-1">
                  <RatingSlider 
                    label="Does what it says" 
                    value={p1.ratings.dwis} 
                    onChange={(v) => p1.handleUpdateRating('dwis', v)} 
                    tooltipText="Rate how well the product lives up to its formula claims"
                    disabled={!p1.isAuthenticated}
                  />
                  <RatingSlider 
                    label="Price / Value" 
                    value={p1.ratings.price_value} 
                    onChange={(v) => p1.handleUpdateRating('price_value', v)} 
                    tooltipText="Rate formula value for its cost"
                    disabled={!p1.isAuthenticated}
                  />
                  <RatingSlider 
                    label="Sensory Feel" 
                    value={p1.ratings.feel} 
                    onChange={(v) => p1.handleUpdateRating('feel', v)} 
                    tooltipText="Rate skin texture, absorption, and finish"
                    disabled={!p1.isAuthenticated}
                  />
                  <RatingSlider 
                    label="Layers Well" 
                    value={p1.ratings.layer} 
                    onChange={(v) => p1.handleUpdateRating('layer', v)} 
                    tooltipText="Rate whether it pills or layers well with other products"
                    disabled={!p1.isAuthenticated}
                  />
                </div>
                {trackerItem1 && (
                  <div className="mt-2 pt-2 border-t border-black/5 flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase flex-wrap">
                    {trackerItem1.in_use && <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> In Use</span>}
                    {trackerItem1.is_liked && <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 fill-red-500" /> Liked</span>}
                    {trackerItem1.repurchase && <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><RefreshCw className="w-2.5 h-2.5" /> Buy Again</span>}
                  </div>
                )}
              </td>

              {/* Product 2 Ratings */}
              <td className="p-2.5 sm:p-4 align-top bg-white snap-start relative min-w-0">
                <div className="space-y-1">
                  <RatingSlider 
                    label="Does what it says" 
                    value={p2.ratings.dwis} 
                    onChange={(v) => p2.handleUpdateRating('dwis', v)} 
                    tooltipText="Rate how well the product lives up to its formula claims"
                    disabled={!p2.isAuthenticated}
                  />
                  <RatingSlider 
                    label="Price / Value" 
                    value={p2.ratings.price_value} 
                    onChange={(v) => p2.handleUpdateRating('price_value', v)} 
                    tooltipText="Rate formula value for its cost"
                    disabled={!p2.isAuthenticated}
                  />
                  <RatingSlider 
                    label="Sensory Feel" 
                    value={p2.ratings.feel} 
                    onChange={(v) => p2.handleUpdateRating('feel', v)} 
                    tooltipText="Rate skin texture, absorption, and finish"
                    disabled={!p2.isAuthenticated}
                  />
                  <RatingSlider 
                    label="Layers Well" 
                    value={p2.ratings.layer} 
                    onChange={(v) => p2.handleUpdateRating('layer', v)} 
                    tooltipText="Rate whether it pills or layers well with other products"
                    disabled={!p2.isAuthenticated}
                  />
                </div>
                {trackerItem2 && (
                  <div className="mt-2 pt-2 border-t border-black/5 flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase flex-wrap">
                    {trackerItem2.in_use && <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" /> In Use</span>}
                    {trackerItem2.is_liked && <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 fill-red-500" /> Liked</span>}
                    {trackerItem2.repurchase && <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded flex items-center gap-0.5"><RefreshCw className="w-2.5 h-2.5" /> Buy Again</span>}
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Unauthenticated Compare Auth Popup */}
      {showAuthModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[250] flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            e.stopPropagation();
            setShowAuthModal(false);
          }}
        >
          <div 
            className="relative w-full max-w-md my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 bg-black text-white py-2 px-4 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                <span>Sign in or Sign Up to compare products</span>
              </div>
              <button 
                type="button" 
                aria-label="Close" 
                onClick={() => setShowAuthModal(false)}
                className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative">
              <button 
                type="button" 
                aria-label="Close" 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <Login
                isSignUp={isAuthModalSignUp}
                setIsSignUp={setIsAuthModalSignUp}
                onSuccess={() => {
                  setShowAuthModal(false);
                  setShowSearchModal(true);
                  const currentIdToExclude = searchTargetSlot === 'product1' ? productId1 : productId2;
                  loadInitialSuggestions(currentIdToExclude);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Authenticated Compare Search Bar Popup (using fts_search) */}
      {showSearchModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[250] flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowSearchModal(false);
          }}
        >
          <div 
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full relative max-h-[85vh] flex flex-col border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              type="button" 
              aria-label="Close search" 
              onClick={() => setShowSearchModal(false)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-8 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-black">
                  Compare Products
                </h3>
              </div>
              <p className="text-xs text-black/60">
                Search our product catalog to compare side-by-side with{' '}
                <span className="font-bold text-black">
                  {searchTargetSlot === 'product1' ? (p2.product?.name || 'Product B') : (p1.product?.name || 'Product A')}
                </span>
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-black/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by brand or product name (fts_search)..."
                className="w-full bg-black/5 border-2 border-transparent focus:border-black rounded-2xl pl-10 pr-9 py-2.5 text-xs font-semibold outline-none transition-all placeholder:text-black/40 text-black"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Search Results using fts_search */}
            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[160px] max-h-[45vh] pr-1">
              {isSearching ? (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-black/40">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">Searching database...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectProduct(item.id)}
                    className="w-full p-2.5 bg-gray-50 hover:bg-purple-50/70 border border-gray-100 hover:border-purple-200 rounded-2xl flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 object-cover rounded-xl border border-black/5 flex-shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white border border-black/5 flex items-center justify-center flex-shrink-0 text-gray-400">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block truncate">
                        {item.brand || 'Brand'}
                      </span>
                      <h4 className="text-xs font-bold text-black truncate group-hover:text-purple-700 transition-colors">
                        {item.name}
                      </h4>
                      {item.type && (
                        <span className="text-[8px] font-bold text-black/60 bg-white border border-black/5 px-1.5 py-0.2 rounded-md inline-block mt-0.5">
                          {item.type}
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 group-hover:bg-purple-200 px-2.5 py-1 rounded-xl transition-colors">
                        Select
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-10 text-center text-black/40 text-xs font-medium">
                  {searchQuery ? (
                    <>No products found matching "{searchQuery}". Try searching for another brand or product name.</>
                  ) : (
                    <>Type a brand or product name to search...</>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
