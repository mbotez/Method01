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
  Star,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  computeProductKeyBenefits, 
  computeProductPotentialIrritants, 
  getMetricNamesForFlag 
} from './ProductCard';
import { Login } from './Login';
import { getScoreColorConfig } from '../utils/scoreColors';

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
  const [globalRatingsSummary, setGlobalRatingsSummary] = useState({ avg: 0, dwis: 0, price_value: 0, feel: 0, layer: 0, count: 0 });
  const [isRatingsDropdownOpen, setIsRatingsDropdownOpen] = useState(false);
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
      // silent
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateRating = async (field: string, value: number) => {
    const newRatings = {
      dwis: field === 'dwis' ? value : ratings.dwis || 0,
      price_value: field === 'price_value' ? value : ratings.price_value || 0,
      feel: field === 'feel' ? value : ratings.feel || 0,
      layer: field === 'layer' ? value : ratings.layer || 0
    };
    const validScores = [newRatings.dwis, newRatings.price_value, newRatings.feel, newRatings.layer].filter(v => v > 0);
    const avgScore = validScores.length > 0 ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(2)) : null;

    setRatings(prev => ({ ...prev, [field]: value }));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id || !productId) return;

    const numericId = Number(productId);
    const isValidNumeric = !isNaN(numericId) && numericId > 0;
    const targetProductId = isValidNumeric
      ? numericId
      : (trackerItem?.product_id && !isNaN(Number(trackerItem.product_id)) ? Number(trackerItem.product_id) : null);
    const effectiveProductId = targetProductId != null ? targetProductId : productId;

    try {
      await supabase
        .from('product_user_ratings')
        .upsert({
          product_id: effectiveProductId,
          user_id: session.user.id,
          dwis: newRatings.dwis || null,
          price_value: newRatings.price_value || null,
          feel: newRatings.feel || null,
          layer: newRatings.layer || null,
          avg: avgScore,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'product_id, user_id'
        });

      // Refresh global ratings summary immediately
      const { data: allRatingsData } = await supabase
        .from('product_user_ratings')
        .select('dwis, price_value, feel, layer, avg')
        .eq('product_id', effectiveProductId);

      if (allRatingsData && allRatingsData.length > 0) {
        let sumAvg = 0, countAvg = 0;
        let sumDw = 0, countDw = 0;
        let sumPrice = 0, countPrice = 0;
        let sumFeel = 0, countFeel = 0;
        let sumLayer = 0, countLayer = 0;

        allRatingsData.forEach((r: any) => {
          const metrics = [r.dwis, r.price_value, r.feel, r.layer].filter(v => v != null && Number(v) > 0);
          const rowAvg = r.avg != null && Number(r.avg) > 0 ? Number(r.avg) : (metrics.length > 0 ? metrics.reduce((a, b) => a + Number(b), 0) / metrics.length : 0);
          if (rowAvg > 0) {
            sumAvg += rowAvg;
            countAvg++;
          }
          if (r.dwis != null && Number(r.dwis) > 0) { sumDw += Number(r.dwis); countDw++; }
          if (r.price_value != null && Number(r.price_value) > 0) { sumPrice += Number(r.price_value); countPrice++; }
          if (r.feel != null && Number(r.feel) > 0) { sumFeel += Number(r.feel); countFeel++; }
          if (r.layer != null && Number(r.layer) > 0) { sumLayer += Number(r.layer); countLayer++; }
        });

        setGlobalRatingsSummary({
          avg: countAvg > 0 ? Number((sumAvg / countAvg).toFixed(1)) : 0,
          dwis: countDw > 0 ? Number((sumDw / countDw).toFixed(1)) : 0,
          price_value: countPrice > 0 ? Number((sumPrice / countPrice).toFixed(1)) : 0,
          feel: countFeel > 0 ? Number((sumFeel / countFeel).toFixed(1)) : 0,
          layer: countLayer > 0 ? Number((sumLayer / countLayer).toFixed(1)) : 0,
          count: allRatingsData.length
        });
      }
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
        const effectiveProductId = targetProductId != null ? targetProductId : productId;

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
                p_product_id: effectiveProductId
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
        const fetchedCat3 = scoreTableResult?.data?.cat3 ??
          tableProd?.cat3 ??
          tableProd?.product_scores?.cat3 ??
          (Array.isArray(tableProd?.product_scores) ? tableProd.product_scores[0]?.cat3 : undefined) ??
          trackerItem?.cat3 ??
          trackerItem?.product_scores?.cat3 ??
          (Array.isArray(trackerItem?.product_scores) ? trackerItem.product_scores[0]?.cat3 : undefined) ??
          null;
        if (tableProd) {
          tableProd.cat2 = fetchedCat2;
          tableProd.cat3 = fetchedCat3;
        }

        const { data, error } = rpcResult;

        if (error) {
          if (tableProd) {
            const formulaBenefits = computeProductKeyBenefits(tableProd, null);
            setProduct({
              ...tableProd,
              cat2: fetchedCat2,
              cat3: fetchedCat3,
              photo_url: tableProd.photo_url || trackerItem?.photo_url || null,
            });
            setComp({
              scoreDisplay: 'Score could not be calculated',
              compatibilityScore: null,
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
            setComp({ scoreDisplay: 'Score could not be calculated', compatibilityScore: null, conflicts: [], benefits: [], safetyConcerns: [] });
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
                scoreDisplay: 'Score could not be calculated',
                compatibilityScore: null,
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
              setComp({ scoreDisplay: 'Score could not be calculated', compatibilityScore: null, conflicts: [], benefits: [], safetyConcerns: [] });
            } else {
              setRpcErrorObj(data);
            }
          } else {
            const finalCat2 = fetchedCat2 || data?.scores?.cat2 || data?.product?.cat2 || '';
            const finalCat3 = fetchedCat3 ?? data?.scores?.cat3 ?? data?.product?.cat3 ?? null;
            const effectiveScores = data.scores || {
              oil_free: true,
              sulfate_free: true,
              contains_frag: false,
              has_fragrance_top50: false,
              has_yeast_trigger: false,
              night: false
            };
            effectiveScores.cat2 = finalCat2;
            effectiveScores.cat3 = finalCat3;

            const p = data.product || {};
            p.cat2 = finalCat2;
            p.cat3 = finalCat3;

            const formulaBenefits = computeProductKeyBenefits(p, effectiveScores, data.compatibility?.benefits);
            const formulaConcerns = computeProductPotentialIrritants(effectiveScores, data.compatibility?.safetyConcerns, p);

            const effectiveComp = {
              ...(data.compatibility || {
                scoreDisplay: 'Score could not be calculated',
                compatibilityScore: null,
                conflicts: []
              }),
              benefits: formulaBenefits,
              safetyConcerns: formulaConcerns
            };

            const mergedProduct = {
              ...(tableProd || {}),
              ...p,
              cat2: finalCat2,
              cat3: finalCat3,
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
                .eq('product_id', effectiveProductId)
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

        // Fetch all ratings for product across all users to compute community average & breakdown
        const allRatingsRes = await (async () => {
          try {
            return await supabase
              .from('product_user_ratings')
              .select('dwis, price_value, feel, layer, avg')
              .eq('product_id', effectiveProductId)
              .abortSignal(signal);
          } catch {
            return { data: [] };
          }
        })();

        if (!active || signal.aborted) return;
        const allRatingsData = allRatingsRes?.data;
        if (allRatingsData && allRatingsData.length > 0) {
          let sumAvg = 0, countAvg = 0;
          let sumDw = 0, countDw = 0;
          let sumPrice = 0, countPrice = 0;
          let sumFeel = 0, countFeel = 0;
          let sumLayer = 0, countLayer = 0;

          allRatingsData.forEach((r: any) => {
            const metrics = [r.dwis, r.price_value, r.feel, r.layer].filter(v => v != null && Number(v) > 0);
            const rowAvg = r.avg != null && Number(r.avg) > 0 ? Number(r.avg) : (metrics.length > 0 ? metrics.reduce((a, b) => a + Number(b), 0) / metrics.length : 0);
            if (rowAvg > 0) {
              sumAvg += rowAvg;
              countAvg++;
            }
            if (r.dwis != null && Number(r.dwis) > 0) { sumDw += Number(r.dwis); countDw++; }
            if (r.price_value != null && Number(r.price_value) > 0) { sumPrice += Number(r.price_value); countPrice++; }
            if (r.feel != null && Number(r.feel) > 0) { sumFeel += Number(r.feel); countFeel++; }
            if (r.layer != null && Number(r.layer) > 0) { sumLayer += Number(r.layer); countLayer++; }
          });

          setGlobalRatingsSummary({
            avg: countAvg > 0 ? Number((sumAvg / countAvg).toFixed(1)) : 0,
            dwis: countDw > 0 ? Number((sumDw / countDw).toFixed(1)) : 0,
            price_value: countPrice > 0 ? Number((sumPrice / countPrice).toFixed(1)) : 0,
            feel: countFeel > 0 ? Number((sumFeel / countFeel).toFixed(1)) : 0,
            layer: countLayer > 0 ? Number((sumLayer / countLayer).toFixed(1)) : 0,
            count: allRatingsData.length
          });
        } else {
          setGlobalRatingsSummary({ avg: 0, dwis: 0, price_value: 0, feel: 0, layer: 0, count: 0 });
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
    globalRatingsSummary,
    isRatingsDropdownOpen,
    setIsRatingsDropdownOpen,
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
  productIds: string[];
  trackerItems?: Record<string, any>;
  onClose: () => void;
  onRemoveProduct: (productId: string) => void;
  onUpdateProduct: (index: number, newProductId: string) => void;
  onAddProduct: (newProductId: string) => void;
}

const PRODUCT_LETTERS = ['A', 'B', 'C', 'D', 'E'];

export const ProductComparisonTable: React.FC<ProductComparisonTableProps> = ({
  productIds,
  trackerItems,
  onClose,
  onRemoveProduct,
  onUpdateProduct,
  onAddProduct
}) => {
  const p1 = useProductDetail(productIds[0] || null, trackerItems?.[productIds[0]]);
  const p2 = useProductDetail(productIds[1] || null, trackerItems?.[productIds[1]]);
  const p3 = useProductDetail(productIds[2] || null, trackerItems?.[productIds[2]]);
  const p4 = useProductDetail(productIds[3] || null, trackerItems?.[productIds[3]]);
  const p5 = useProductDetail(productIds[4] || null, trackerItems?.[productIds[4]]);

  const allDetails = [p1, p2, p3, p4, p5];
  const activeDetails = allDetails.slice(0, productIds.length);

  const [expandedBenefits, setExpandedBenefits] = useState<Record<number, string | null>>({});
  const [expandedIrritants, setExpandedIrritants] = useState<Record<number, string | null>>({});
  const [expandIngredientsMap, setExpandIngredientsMap] = useState<Record<number, boolean>>({});

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);

  const scrollToProduct = (index: number) => {
    setActiveMobileIndex(index);
    if (!tableContainerRef.current) return;
    const container = tableContainerRef.current;
    if (index === 0) {
      container.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      const targetScroll = Math.max((container.clientWidth - 70) * index, 250 * index);
      container.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const itemWidth = 280;
    const calculatedIndex = Math.min(Math.max(Math.round(scrollLeft / itemWidth), 0), productIds.length - 1);
    if (calculatedIndex !== activeMobileIndex) {
      setActiveMobileIndex(calculatedIndex);
    }
  };

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchTargetIndex, setSearchTargetIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [initialSuggestions, setInitialSuggestions] = useState<any[]>([]);

  const loadInitialSuggestions = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select('id, brand, name, type, photo_url')
        .order('id', { ascending: false })
        .limit(15);
      const excludedIds = productIds.map(String);
      const filtered = (data || []).filter(item => !excludedIds.includes(String(item.id)));
      setInitialSuggestions(filtered);
      if (!searchQuery.trim()) {
        setSearchResults(filtered);
      }
    } catch {
      // silent
    }
  };

  const handleCompareClick = async (targetIndex: number) => {
    setSearchTargetIndex(targetIndex);
    const { data: { session } } = await supabase.auth.getSession();
    const authed = !!session?.user?.id;
    if (!authed) {
      setShowAuthModal(true);
    } else {
      setShowSearchModal(true);
      loadInitialSuggestions();
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

      const excludedIds = productIds.map(String);
      if (searchTargetIndex < productIds.length) {
        const currentAtTarget = String(productIds[searchTargetIndex]);
        const filtered = (results || []).filter(item => !excludedIds.includes(String(item.id)) || String(item.id) === currentAtTarget);
        setSearchResults(filtered);
      } else {
        const filtered = (results || []).filter(item => !excludedIds.includes(String(item.id)));
        setSearchResults(filtered);
      }
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
    if (searchTargetIndex < productIds.length) {
      onUpdateProduct(searchTargetIndex, String(chosenId));
    } else {
      onAddProduct(String(chosenId));
    }
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

  const isAnyUnauthed = activeDetails.some(d => !d.isAuthenticated);

  return (
    <div 
      className="w-full max-w-6xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[94vh] sm:max-h-[92vh] overflow-hidden my-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-[#B0D8FA] text-black px-3 sm:px-5 py-2.5 sm:py-3 border-b border-black/10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-black/10 text-black flex items-center justify-center shrink-0">
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-black">
              Product Comparison ({productIds.length}/5)
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {productIds.length < 5 && (
            <button
              type="button"
              onClick={() => handleCompareClick(productIds.length)}
              className="px-2.5 py-1 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black/80 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          )}
          <button
            type="button"
            aria-label="Close comparison modal"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-black transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Product Quick Tab Bar */}
      <div className="sm:hidden flex items-center justify-between bg-gray-100/90 border-b border-gray-200 px-2.5 py-1.5 flex-shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {productIds.map((id, index) => {
            const detail = activeDetails[index];
            const letter = PRODUCT_LETTERS[index] || String(index + 1);
            return (
              <button
                type="button"
                key={id}
                onClick={() => scrollToProduct(index)}
                className={`py-1 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate shrink-0 ${
                  activeMobileIndex === index
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white text-black/60 hover:text-black border border-gray-200/80'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                <span className="truncate">{detail?.product?.name ? `${letter} (${detail.product.name})` : letter}</span>
              </button>
            );
          })}
          {productIds.length < 5 && (
            <button
              type="button"
              onClick={() => handleCompareClick(productIds.length)}
              className="py-1 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-purple-600" />
              <span>Add</span>
            </button>
          )}
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
        className="overflow-y-auto overflow-x-auto sm:overflow-x-visible flex-1 snap-x snap-mandatory sm:snap-none scroll-smooth"
      >
        <table className="w-full border-collapse text-left table-fixed">
          <colgroup>
            <col className="w-[60px] sm:w-20 md:w-24" />
            {productIds.map((_, i) => (
              <col key={i} className={`w-[calc(100vw-70px)] sm:w-[calc((100%-6rem)/${productIds.length})] max-w-[280px]`} />
            ))}
            {productIds.length < 5 && <col className="w-[120px] sm:w-36" />}
          </colgroup>
          <tbody>
            {/* ROW 1: PRODUCT HEADER & SUMMARY */}
            <tr className="border-b border-gray-200/80 bg-gray-50/40">
              <td className="px-1.5 py-2.5 sm:px-2.5 sm:py-3 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1">
                  <div className="w-4 h-4 rounded-md bg-black/5 flex items-center justify-center text-black/60 sm:hidden">
                    <ShoppingBag className="w-2 h-2" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[9.5px] uppercase tracking-tight text-black/60 leading-tight">
                    Product
                  </span>
                </div>
              </td>

              {productIds.map((id, index) => {
                const detail = activeDetails[index];
                const letter = PRODUCT_LETTERS[index];
                return (
                  <td key={id} className="p-2 sm:p-2.5 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200/80 px-1.5 py-0.5 rounded-md">
                        Product {letter}
                      </span>
                      {productIds.length > 2 && (
                        <button
                          type="button"
                          aria-label={`Remove Product ${letter}`}
                          onClick={() => onRemoveProduct(id)}
                          className="w-5 h-5 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-gray-400 transition-colors cursor-pointer"
                          title={`Remove Product ${letter}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {detail.loading ? (
                      <div className="flex items-center gap-2 py-4 text-gray-400 text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                        <span className="text-[10px]">Loading...</span>
                      </div>
                    ) : detail.product ? (
                      <div className="flex items-start gap-2">
                        {detail.product.photo_url && !detail.imageError ? (
                          <img
                            src={detail.product.photo_url}
                            alt={detail.product.name}
                            referrerPolicy="no-referrer"
                            onError={() => detail.setImageError(true)}
                            className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-xl flex-shrink-0 border border-black/5 bg-gray-50 shadow-xs"
                          />
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 border border-black/5">
                            <ShoppingBag className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-[8.5px] sm:text-[9px] font-black uppercase tracking-widest text-black/40 block truncate">
                            {detail.product.brand || 'Brand'}
                          </span>
                          <h3 className="text-[11px] sm:text-xs font-black text-black leading-snug break-words line-clamp-2">
                            {detail.product.name}
                          </h3>
                          {detail.product.type && (
                            <span className="text-[8px] font-bold text-black/60 bg-gray-100 px-1.5 py-0.5 rounded-md inline-block mt-0.5 truncate max-w-full">
                              {detail.product.type}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-red-500 font-bold">Failed to load product.</div>
                    )}
                  </td>
                );
              })}

              {productIds.length < 5 && (
                <td className="p-3 align-middle bg-gray-50/50 text-center">
                  <button
                    type="button"
                    onClick={() => handleCompareClick(productIds.length)}
                    className="w-full h-full min-h-[100px] border-2 border-dashed border-gray-300 hover:border-purple-500 hover:bg-purple-50/30 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-gray-500 hover:text-purple-700 transition-all cursor-pointer group"
                  >
                    <div className="w-6 h-6 rounded-full bg-white shadow-xs border border-gray-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider">Add Product</span>
                    <span className="text-[8.5px] text-gray-400 font-medium">Up to 5</span>
                  </button>
                </td>
              )}
            </tr>

            {/* ROW 2: DESCRIPTION + CHANGE BUTTON */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-2.5 sm:px-2.5 sm:py-3 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1">
                  <div className="w-4 h-4 rounded-md bg-black/5 flex items-center justify-center text-black/60 sm:hidden">
                    <FileText className="w-2 h-2" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[9.5px] uppercase tracking-tight text-black/60 leading-tight">
                    Description
                  </span>
                </div>
              </td>

              {productIds.map((id, index) => {
                const detail = activeDetails[index];
                const letter = PRODUCT_LETTERS[index];
                return (
                  <td key={id} className="p-2 sm:p-2.5 align-top border-r border-gray-100 bg-white snap-start relative space-y-1.5 min-w-0">
                    <p className="text-[10px] sm:text-[11px] text-black/70 leading-relaxed break-words line-clamp-3">
                      {detail.product?.description || <span className="text-black/30 italic">No description</span>}
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleCompareClick(index)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[9.5px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 hover:text-black rounded-lg transition-colors border border-gray-200/80 cursor-pointer group"
                        title={`Change Product ${letter}`}
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5 text-gray-500 group-hover:text-black transition-colors" />
                        <span>Change</span>
                      </button>
                    </div>
                  </td>
                );
              })}

              {productIds.length < 5 && <td className="bg-gray-50/30"></td>}
            </tr>

            {/* ROW 3: SKIN COMPATIBILITY */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-2.5 sm:px-2.5 sm:py-3 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1">
                  <div className="w-4 h-4 rounded-md bg-purple-50 flex items-center justify-center text-purple-600 sm:hidden">
                    <Shield className="w-2 h-2" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[9.5px] uppercase tracking-tight text-black/60 leading-tight">
                    Skin Fit
                  </span>
                </div>
              </td>

              {productIds.map((id, index) => {
                const detail = activeDetails[index];
                return (
                  <td key={id} className="p-2 sm:p-2.5 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                    {Number(detail.product?.cat3) === 11 || Number(detail.scores?.cat3) === 11 ? (
                      <span className="text-[10px] text-black/40 italic">N/A (Lipcare)</span>
                    ) : detail.isAuthenticated && detail.comp ? (() => {
                      const scoreConfig = getScoreColorConfig(detail.comp.compatibilityScore);
                      return (
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide border transition-colors ${
                            detail.comp.compatibilityScore != null ? scoreConfig.pillClasses : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}>
                            {detail.comp.scoreDisplay || (detail.comp.compatibilityScore !== undefined && detail.comp.compatibilityScore !== null ? `${detail.comp.compatibilityScore} / 100` : 'N/A')}
                          </span>
                          {detail.comp.conflicts && detail.comp.conflicts.length > 0 ? (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {detail.comp.conflicts.map((conflict: string, idx: number) => (
                                <span key={idx} className="bg-red-50 text-red-900 border border-red-200/60 rounded-md px-1.5 py-0.5 text-[8px] font-bold flex items-center gap-1">
                                  <Shield className="w-2.5 h-2.5 text-red-600 flex-shrink-0" /> <span className="break-words">{conflict}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[9px] text-emerald-700 font-semibold pt-0.5">No conflicts detected</p>
                          )}
                        </div>
                      );
                    })() : (
                      <span className="text-[9.5px] text-black/40 italic">Log in to view fit</span>
                    )}
                  </td>
                );
              })}

              {productIds.length < 5 && <td className="bg-gray-50/30"></td>}
            </tr>

            {/* ROW 4: KEY BENEFITS */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-2.5 sm:px-2.5 sm:py-3 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1">
                  <div className="w-4 h-4 rounded-md bg-purple-50 flex items-center justify-center text-purple-600 sm:hidden">
                    <CheckCircle2 className="w-2 h-2" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[9.5px] uppercase tracking-tight text-black/60 leading-tight">
                    Benefits
                  </span>
                </div>
              </td>

              {productIds.map((id, index) => {
                const detail = activeDetails[index];
                const currentExpandedBenefit = expandedBenefits[index] || null;
                return (
                  <td key={id} className="p-2 sm:p-2.5 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                    {detail.comp?.benefits && detail.comp.benefits.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {detail.comp.benefits.map((benefit: string, idx: number) => {
                            const matched = getIngredientsForFlag(benefit, detail.culprits);
                            const isClickable = matched.length > 0;
                            const isExpanded = currentExpandedBenefit === benefit;

                            return (
                              <button
                                type="button"
                                key={idx}
                                onClick={() => isClickable && setExpandedBenefits(prev => ({ ...prev, [index]: isExpanded ? null : benefit }))}
                                className={`border rounded-md px-1.5 py-0.5 text-[8px] sm:text-[8.5px] font-bold flex items-center gap-1 transition-all text-left ${
                                  isExpanded
                                    ? 'bg-purple-100 text-purple-950 border-purple-400 shadow-xs'
                                    : 'bg-purple-50 text-purple-900 border-purple-200/60'
                                } ${isClickable ? 'cursor-pointer hover:bg-purple-100' : 'cursor-default'}`}
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-purple-600 flex-shrink-0" />
                                <span>{benefit}</span>
                                {isClickable && (
                                  <span className="flex items-center gap-0.5 ml-0.5 text-[7.5px] text-purple-700 bg-purple-200/70 px-1 py-0.1 rounded font-mono font-bold">
                                    {matched.length}
                                    {isExpanded ? <ChevronUp className="w-2 h-2" /> : <ChevronDown className="w-2 h-2" />}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {currentExpandedBenefit && (() => {
                          const ings = getIngredientsForFlag(currentExpandedBenefit, detail.culprits);
                          if (ings.length === 0) return null;
                          return (
                            <div className="p-2 bg-purple-50/80 border border-purple-200/80 rounded-xl space-y-1">
                              <div className="text-[9px] font-black uppercase text-purple-900">
                                {currentExpandedBenefit} ({ings.length})
                              </div>
                              <div className="space-y-1">
                                {ings.map((item: any, iIdx: number) => (
                                  <div key={iIdx} className="text-[8.5px] text-black/80 bg-white/90 border border-purple-100 px-1.5 py-0.5 rounded-lg">
                                    <span className="font-bold text-black">{item.ingredient_name}</span>
                                    {item.position && (
                                      <span className="text-[7.5px] text-black/50 ml-1">#{item.position}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-[9.5px] text-black/40 italic">None listed</span>
                    )}
                  </td>
                );
              })}

              {productIds.length < 5 && <td className="bg-gray-50/30"></td>}
            </tr>

            {/* ROW 5: POTENTIAL IRRITANTS */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-2.5 sm:px-2.5 sm:py-3 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1">
                  <div className="w-4 h-4 rounded-md bg-amber-50 flex items-center justify-center text-amber-600 sm:hidden">
                    <AlertTriangle className="w-2 h-2" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[9.5px] uppercase tracking-tight text-black/60 leading-tight">
                    Irritants
                  </span>
                </div>
              </td>

              {productIds.map((id, index) => {
                const detail = activeDetails[index];
                const currentExpandedIrritant = expandedIrritants[index] || null;
                return (
                  <td key={id} className="p-2 sm:p-2.5 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                    {detail.comp?.safetyConcerns && detail.comp.safetyConcerns.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {detail.comp.safetyConcerns.map((concern: string, idx: number) => {
                            const matched = getIngredientsForFlag(concern, detail.culprits);
                            const isClickable = matched.length > 0;
                            const isExpanded = currentExpandedIrritant === concern;

                            return (
                              <button
                                type="button"
                                key={idx}
                                onClick={() => isClickable && setExpandedIrritants(prev => ({ ...prev, [index]: isExpanded ? null : concern }))}
                                className={`border rounded-md px-1.5 py-0.5 text-[8px] sm:text-[8.5px] font-bold flex items-center gap-1 transition-all text-left ${
                                  isExpanded
                                    ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-xs'
                                    : 'bg-amber-50 text-amber-900 border-amber-200/60'
                                } ${isClickable ? 'cursor-pointer hover:bg-amber-100' : 'cursor-default'}`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 flex-shrink-0" />
                                <span>{concern}</span>
                                {isClickable && (
                                  <span className="flex items-center gap-0.5 ml-0.5 text-[7.5px] text-amber-700 bg-amber-200/70 px-1 py-0.1 rounded font-mono font-bold">
                                    {matched.length}
                                    {isExpanded ? <ChevronUp className="w-2 h-2" /> : <ChevronDown className="w-2 h-2" />}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {currentExpandedIrritant && (() => {
                          const ings = getIngredientsForFlag(currentExpandedIrritant, detail.culprits);
                          if (ings.length === 0) return null;
                          return (
                            <div className="p-2 bg-amber-50/80 border border-amber-200/80 rounded-xl space-y-1">
                              <div className="text-[9px] font-black uppercase text-amber-900">
                                {currentExpandedIrritant} ({ings.length})
                              </div>
                              <div className="space-y-1">
                                {ings.map((item: any, iIdx: number) => (
                                  <div key={iIdx} className="text-[8.5px] text-black/80 bg-white/90 border border-amber-100 px-1.5 py-0.5 rounded-lg">
                                    <span className="font-bold text-black">{item.ingredient_name}</span>
                                    {item.position && (
                                      <span className="text-[7.5px] text-black/50 ml-1">#{item.position}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-[9.5px] text-emerald-700 font-semibold">None detected</span>
                    )}
                  </td>
                );
              })}

              {productIds.length < 5 && <td className="bg-gray-50/30"></td>}
            </tr>

            {/* ROW 6: INGREDIENTS LIST */}
            <tr className="border-b border-gray-100 hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-2.5 sm:px-2.5 sm:py-3 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1">
                  <div className="w-4 h-4 rounded-md bg-black/5 flex items-center justify-center text-black/60 sm:hidden">
                    <FlaskConical className="w-2 h-2" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[9.5px] uppercase tracking-tight text-black/60 leading-tight">
                    Ingredients
                  </span>
                </div>
              </td>

              {productIds.map((id, index) => {
                const detail = activeDetails[index];
                const isExpanded = !!expandIngredientsMap[index];
                const ings = detail.product?.ingredients || [];
                const ingsListText = Array.isArray(ings) ? ings.join(', ') : (typeof ings === 'string' ? ings : '');

                return (
                  <td key={id} className="p-2 sm:p-2.5 align-top border-r border-gray-100 bg-white snap-start relative min-w-0 space-y-1.5">
                    {ingsListText ? (
                      <div>
                        <p className={`text-[10px] sm:text-[10.5px] text-black/70 leading-relaxed break-words ${isExpanded ? '' : 'line-clamp-3'}`}>
                          {ingsListText}
                        </p>
                        <button
                          type="button"
                          onClick={() => setExpandIngredientsMap(prev => ({ ...prev, [index]: !isExpanded }))}
                          className="mt-1 text-[9px] font-black uppercase tracking-wider text-purple-700 hover:text-purple-900 inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Less' : 'Full list'}</span>
                          {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[9.5px] text-black/40 italic">Not available</span>
                    )}
                  </td>
                );
              })}

              {productIds.length < 5 && <td className="bg-gray-50/30"></td>}
            </tr>

            {/* ROW 7: RATINGS (SUPABASE AVERAGE + DROPDOWN / "YOUR RATING" 1-5 SCALE) */}
            <tr className="hover:bg-gray-50/30 transition-colors">
              <td className="px-1.5 py-2.5 sm:px-2.5 sm:py-3 align-top border-r border-gray-200/70 bg-gray-50/95 sticky left-0 z-20 backdrop-blur-md shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                <div className="flex flex-col items-center justify-center text-center gap-1 sm:items-start sm:text-left sm:gap-1">
                  <div className="w-4 h-4 rounded-md bg-amber-50 flex items-center justify-center text-amber-600 sm:hidden">
                    <Star className="w-2 h-2" />
                  </div>
                  <span className="font-black text-[8px] sm:text-[9.5px] uppercase tracking-tight text-black/60 leading-tight">
                    Ratings
                  </span>
                </div>
              </td>

              {productIds.map((id, index) => {
                const detail = activeDetails[index];
                return (
                  <td key={id} className="p-2 sm:p-2.5 align-top border-r border-gray-100 bg-white snap-start relative min-w-0">
                    <div className="bg-purple-50/80 border border-purple-100 rounded-xl p-2 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => detail.setIsRatingsDropdownOpen(!detail.isRatingsDropdownOpen)}
                        className="w-full flex items-center justify-between text-[11px] font-black text-purple-950 uppercase tracking-wider cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <Star className="w-3.5 h-3.5 fill-purple-600 text-purple-600 flex-shrink-0" />
                          {detail.globalRatingsSummary.avg > 0 || detail.globalRatingsSummary.count > 0 ? (
                            <span className="truncate">Ratings: {detail.globalRatingsSummary.avg > 0 ? detail.globalRatingsSummary.avg : '3.0'} / 5</span>
                          ) : (
                            <span className="block text-center w-full font-black text-purple-950 uppercase tracking-wider text-[10px] leading-tight">
                              Ratings: None yet<br />
                              <span className="text-[9px] font-bold text-purple-900 normal-case">Be the first!</span>
                            </span>
                          )}
                          {(detail.globalRatingsSummary.avg > 0 || detail.globalRatingsSummary.count > 0) && (
                            <span className="text-[9px] text-black/40 font-normal lowercase font-mono flex-shrink-0">({detail.globalRatingsSummary.count})</span>
                          )}
                        </div>
                        {detail.isRatingsDropdownOpen ? <ChevronUp className="w-3.5 h-3.5 text-purple-700 flex-shrink-0 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 text-purple-700 flex-shrink-0 ml-1" />}
                      </button>

                      {detail.isRatingsDropdownOpen && (
                        <div className="space-y-2.5 pt-2 border-t border-purple-200/60">
                          {detail.globalRatingsSummary.count > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[10px]">
                              <div className="flex justify-between bg-white px-2 py-1 rounded-lg border border-purple-100">
                                <span className="text-black/60 font-bold truncate">Does What It Says:</span>
                                <span className="font-mono font-black text-purple-900">{detail.globalRatingsSummary.dwis} / 5</span>
                              </div>
                              <div className="flex justify-between bg-white px-2 py-1 rounded-lg border border-purple-100">
                                <span className="text-black/60 font-bold truncate">Price & Value:</span>
                                <span className="font-mono font-black text-purple-900">{detail.globalRatingsSummary.price_value} / 5</span>
                              </div>
                              <div className="flex justify-between bg-white px-2 py-1 rounded-lg border border-purple-100">
                                <span className="text-black/60 font-bold truncate">Texture & Feel:</span>
                                <span className="font-mono font-black text-purple-900">{detail.globalRatingsSummary.feel} / 5</span>
                              </div>
                              <div className="flex justify-between bg-white px-2 py-1 rounded-lg border border-purple-100">
                                <span className="text-black/60 font-bold truncate">Layerability:</span>
                                <span className="font-mono font-black text-purple-900">{detail.globalRatingsSummary.layer} / 5</span>
                              </div>
                            </div>
                          )}

                          {/* Your rating Section */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-black text-[9px] uppercase tracking-widest text-black/75">Your rating</h4>
                              {!detail.isAuthenticated && (
                                <span className="text-[8.5px] text-black/40 font-bold italic">Log in to save</span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-1.5 bg-white p-2 rounded-xl border border-purple-100">
                              {[
                                { key: 'dwis', label: 'Does What It Says' },
                                { key: 'price_value', label: 'Price & Value' },
                                { key: 'feel', label: 'Texture & Feel' },
                                { key: 'layer', label: 'Layerability' },
                              ].map(criterion => (
                                <div key={criterion.key} className="flex flex-col gap-0.5">
                                  <span className="text-[8.5px] font-bold text-black/70">{criterion.label}</span>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map(star => {
                                      const currentVal = detail.ratings[criterion.key as keyof typeof detail.ratings] || 0;
                                      const isFilled = star <= currentVal;
                                      return (
                                        <button
                                          key={star}
                                          type="button"
                                          onClick={() => detail.handleUpdateRating(criterion.key, star)}
                                          className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold transition-all cursor-pointer ${
                                            isFilled 
                                              ? 'bg-black text-white shadow-xs' 
                                              : 'bg-gray-50 text-black/40 border border-gray-200 hover:border-black/40 hover:text-black'
                                          }`}
                                        >
                                          {star}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}

              {productIds.length < 5 && <td className="bg-gray-50/30"></td>}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Unauthenticated Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-black"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black uppercase tracking-tight text-black">Sign in or Sign Up</h3>
              <p className="text-xs text-black/60">Log in to search and compare products side by side</p>
            </div>
            <Login onSuccess={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}

      {/* Search Product Catalog Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 z-[250] flex items-center justify-center p-4" onClick={() => setShowSearchModal(false)}>
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-black">
                  {searchTargetIndex < productIds.length ? 'Change Product' : 'Add Product to Compare'}
                </h3>
                <p className="text-[11px] text-black/60">Search our skincare catalog</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
              <input
                type="text"
                placeholder="Search brand, product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-black focus:outline-none focus:border-purple-600 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[50vh]">
              {isSearching ? (
                <div className="flex items-center justify-center py-10 text-gray-400 gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  <span>Searching products...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => handleSelectProduct(item.id)}
                    className="w-full text-left p-2.5 sm:p-3 rounded-2xl hover:bg-purple-50/60 border border-gray-100 hover:border-purple-200 transition-all flex items-center gap-3 cursor-pointer group"
                  >
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={item.name} className="w-10 h-10 object-cover rounded-xl border border-black/5 bg-gray-50 shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-widest text-black/40 block truncate">{item.brand}</span>
                      <h4 className="text-xs font-bold text-black truncate group-hover:text-purple-900">{item.name}</h4>
                    </div>
                    <span className="px-2.5 py-1 bg-gray-100 group-hover:bg-purple-600 group-hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shrink-0">
                      Select
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center py-10 text-xs text-black/40">No products found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
