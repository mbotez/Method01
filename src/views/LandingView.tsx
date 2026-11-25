import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, ChevronRight, ArrowRight, Trash2, Plus, Heart, Share2 } from 'lucide-react';
import { AppState } from '../types';
import { supabase } from '../lib/supabase';
import { DEFAULT_LANDING_ARTICLES } from '../config/appConstants';
import { INVENTORY } from '../constants';
import { searchProductsFromPhoto, ProductConfirmationModal, MatchedProduct } from '../components/photo_search';
import { checkPhotoRecognitionLimit, recordPhotoScanUsage } from '../utils/photoRecognitionLimit';

export interface LandingViewProps {
  setAppState: (state: AppState) => void;
  user: any;
  resetHeaderSearchState: () => void;
  setSocialActiveMainTab: (tab: string) => void;
  setIsFollowsOpen: (open: boolean) => void;
  primaryFilter: string;
  setPrimaryFilter: (filter: string) => void;
  subFilter: string;
  setSubFilter: (sub: string) => void;
  products: any[];
  userProducts: any[];
  handleDeleteUPP: (id: string) => void;
  setAuthPromptModalOpen: (open: boolean) => void;
  setSelectedProductForUPP: (prod: any) => void;
  openProductCard: (id: string) => void;
  triggerPhotoScan: (fileInputRef: React.RefObject<HTMLInputElement>) => void;
  isWeb: boolean;
  isNativePlatform: () => boolean;
  setSelectedArticle?: (article: any) => void;
  publicRoutines: any[];
  onVoteRoutine: (id: string) => void;
  setSelectedProductForDetail?: (p: any) => void;
  onShareRoutine?: (rt: any) => void;
  onOpenRoutine?: (rt: any) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  setAppState,
  user,
  resetHeaderSearchState,
  setSocialActiveMainTab,
  setIsFollowsOpen,
  primaryFilter,
  setPrimaryFilter,
  subFilter,
  setSubFilter,
  products,
  userProducts,
  handleDeleteUPP,
  setAuthPromptModalOpen,
  setSelectedProductForUPP,
  openProductCard,
  triggerPhotoScan,
  isWeb,
  isNativePlatform,
  setSelectedArticle,
  publicRoutines,
  onVoteRoutine,
  setSelectedProductForDetail,
  onShareRoutine,
  onOpenRoutine,
}) => {
  const [landingArticles, setLandingArticles] = useState<any[]>(DEFAULT_LANDING_ARTICLES);
  const landingFileInputRef = useRef<HTMLInputElement>(null);
  const [isLandingScanning, setIsLandingScanning] = useState(false);
  const [landingScanError, setLandingScanError] = useState<string | null>(null);
  const [landingScanMatched, setLandingScanMatched] = useState<MatchedProduct[]>([]);
  const [isLandingConfirmOpen, setIsLandingConfirmOpen] = useState(false);
  const [cachedLandingProducts, setCachedLandingProducts] = useState<MatchedProduct[]>([]);
  const [isLandingEvaluating, setIsLandingEvaluating] = useState(false);

  useEffect(() => {
    const fetchLandingArticles = async () => {
      try {
        const { data, error } = await supabase
          .from('articles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        if (!error && data && data.length > 0) {
          const mappedArticles = data.map((art: any, idx: number) => ({
            ...art,
            image_url: art.image_url && !art.image_url.includes('supabase') ? art.image_url : `/assets/g${(idx % 6) + 1}.jpg`
          }));
          setLandingArticles(mappedArticles);
        }
      } catch {
        // Fallback already set
      }
    };
    fetchLandingArticles();
  }, []);

  useEffect(() => {
    if (isLandingScanning || isLandingEvaluating) {
      const watchdog = setTimeout(() => {
        setIsLandingScanning(false);
        setIsLandingEvaluating(false);
        setLandingScanError('Photo scan timed out. Please try again.');
      }, 30000);
      return () => clearTimeout(watchdog);
    }
  }, [isLandingScanning, isLandingEvaluating]);

  const handleLandingPhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const limitCheck = checkPhotoRecognitionLimit(user);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'REQUIRE_AUTH') {
        setAuthPromptModalOpen(true);
      } else {
        setLandingScanError("Photo recognition limit reached. Please sign in.");
      }
      if (landingFileInputRef.current) {
        landingFileInputRef.current.value = '';
      }
      return;
    }

    setIsLandingScanning(true);
    setLandingScanError(null);

    try {
      const matches = await searchProductsFromPhoto(file);
      recordPhotoScanUsage(user);
      setLandingScanMatched(matches);
      setIsLandingConfirmOpen(true);
    } catch (err: any) {
      setLandingScanError(err.message || 'Photo scan failed. Please try again.');
    } finally {
      setIsLandingScanning(false);
      if (landingFileInputRef.current) {
        landingFileInputRef.current.value = '';
      }
    }
  };

  const handleLandingConfirmScan = async (confirmed: MatchedProduct[]) => {
    setIsLandingConfirmOpen(false);
    if (confirmed.length === 0) return;

    if (!user) {
        localStorage.setItem('cachedLandingProducts', JSON.stringify(confirmed));
        setCachedLandingProducts(confirmed);
        setAppState(AppState.ONBOARDING_DETAILS);
        return;
    }

    const payload = confirmed.map(prod => ({
      user_id: user?.id,
      brand: prod.brand,
      product_name: prod.name,
      product_type: prod.type,
      routine_time: 'AM/PM',
      in_use: true,
      photo_url: prod.photo_url || null,
      product_id: prod.id
    }));

    const { error: insertError } = await supabase.from('tracker').insert(payload);
    if (insertError) {
      setLandingScanError("Failed to save scanned products to tracker.");
    }
  };

  return (
    <>
      {/* MOBILE VIEW LANDING */}
      {!isWeb && (
        <motion.div 
          key="landing-mobile"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`text-center flex flex-col items-center justify-between overflow-hidden touch-none ${isNativePlatform() ? 'h-screen w-screen fixed inset-0 z-0 pt-16' : 'w-full h-[calc(100dvh-65px)] fixed inset-x-0 bottom-0 z-10 pt-8'} bg-[url('/assets/landing_banner.png')] bg-cover bg-center px-6 pb-12`}
        >
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <div className="flex flex-col items-center gap-1.5">
              <h1 className="text-5xl md:text-6xl font-cursive font-bold leading-[0.9] text-white tracking-normal drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                Canonic
              </h1>
              <p className="text-xl md:text-2xl font-cursive font-bold text-white tracking-normal drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                Beauty, Smarter
              </p>
            </div>
            <button 
              onClick={() => setAppState(AppState.ONBOARDING_DETAILS)}
              className="w-full flex items-center justify-center cursor-pointer mt-2"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center justify-center gap-2 bg-white/80 backdrop-blur-md border border-white/40 text-black text-lg md:text-xl font-bold px-6 py-3 rounded-full shadow-lg hover:bg-white transition-all w-full"
              >
                <span>Take skin quiz</span>
                <ChevronRight className="w-5 h-5" />
              </motion.div>
            </button>
          </div>
          <button 
            onClick={() => triggerPhotoScan(landingFileInputRef)}
            className="p-4 bg-white/80 backdrop-blur-md border border-black/10 text-black hover:bg-white active:scale-95 rounded-full font-black transition-all shadow-xl flex items-center justify-center mx-auto cursor-pointer mb-4"
            title="Scan product photo"
          >
            <Camera className="w-6 h-6 text-black" />
          </button>
          
          <ProductConfirmationModal
            isOpen={isLandingConfirmOpen}
            products={landingScanMatched}
            onConfirm={handleLandingConfirmScan}
            onCancel={() => setIsLandingConfirmOpen(false)}
            user={user}
            onLogin={(confirmed) => {
              localStorage.setItem('cachedLandingProducts', JSON.stringify(confirmed));
              setAppState(AppState.AUTH);
              setIsLandingConfirmOpen(false);
            }}
          />
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={landingFileInputRef}
            onChange={handleLandingPhotoScan}
            className="hidden"
          />
          {landingScanError && (
            <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-center space-y-2 max-w-sm mx-auto">
              <p className="text-xs font-bold">{landingScanError}</p>
              <button
                onClick={() => {
                  setLandingScanError(null);
                  triggerPhotoScan(landingFileInputRef);
                }}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all cursor-pointer"
              >
                Retry Scan
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* WEBSITE VIEW LANDING */}
      {isWeb && (
        <motion.div 
          key="landing-web"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full"
        >
          {/* Hero Banner (1/3 of screen height) */}
          <div 
            onClick={() => setAppState(AppState.RANK)}
            className="w-full h-[calc((100vh-65px)/3)] min-h-[200px] max-h-[320px] relative overflow-hidden bg-[#B0D8FA] cursor-pointer group flex items-center justify-center"
            title="Explore Products"
          >
            <img 
              src="/assets/b2.jpg" 
              alt="Canonic" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-[center_46%] transition-transform duration-700 ease-out group-hover:scale-[1.01]" 
            />
          </div>

          {/* Main Landing Sections */}
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-12 md:space-y-16 w-full">
            {/* SECTION 1: THE EDIT (FIRST 3 ARTICLES) */}
            <section className="space-y-6 w-full">
              <div className="flex items-center justify-between pb-3 border-b border-black/10">
                <div className="flex items-baseline gap-3">
                  <h2 
                    className="text-xl md:text-2xl font-black uppercase tracking-tight text-black cursor-pointer hover:text-venus-accent transition-colors" 
                    style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}
                    onClick={() => {
                      resetHeaderSearchState();
                      setAppState(AppState.SOCIAL);
                      setSocialActiveMainTab('articles');
                      setIsFollowsOpen(false);
                    }}
                  >
                    The Edit
                  </h2>
                  <span className="text-xs text-black/40 font-medium hidden sm:inline">Skincare guides & rituals</span>
                </div>
                <button 
                  onClick={() => {
                    resetHeaderSearchState();
                    setAppState(AppState.SOCIAL);
                    setSocialActiveMainTab('articles');
                    setIsFollowsOpen(false);
                  }}
                  className="group inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-black/70 hover:text-black transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-black/5"
                  title="View all articles in The Edit"
                  aria-label="View all articles in The Edit"
                >
                  <span>View All</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 text-black" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 w-full">
                {landingArticles.slice(0, 3).map((article, idx) => {
                  const validCollages = Array.isArray(article.collage_cards)
                    ? article.collage_cards.filter((c: any) => c && typeof c.image_url === 'string' && c.image_url.trim() !== '')
                    : [];
                  const articleImgUrl = validCollages[1]?.image_url || validCollages[0]?.image_url || article.image_url || `/assets/g${(idx % 6) + 1}.jpg`;

                  return (
                    <article 
                      key={article.id || article.article_id || idx}
                      onClick={() => {
                        resetHeaderSearchState();
                        setSelectedArticle?.(article);
                        setAppState(AppState.SOCIAL);
                        setSocialActiveMainTab('articles');
                        setIsFollowsOpen(false);
                      }}
                      className="clean-card bg-white border border-black/10 hover:border-black p-5 rounded-2xl transition-all duration-300 hover:shadow-lg cursor-pointer flex flex-col justify-between group h-full"
                    >
                      <div className="space-y-3">
                        <div className="rounded-xl overflow-hidden border border-black/5 bg-[#F5F4F0] aspect-[16/10] w-full relative">
                          <img 
                            src={articleImgUrl} 
                            alt={article.title} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.src = validCollages[0]?.image_url || `/assets/g${(idx % 6) + 1}.jpg`;
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-black/50">
                          <span className="font-black uppercase tracking-wider text-[10px] text-venus-accent">
                            {article.category || 'Editorial'}
                          </span>
                        </div>
                        <h3 className="text-sm md:text-base font-black uppercase tracking-tight text-black group-hover:text-venus-accent transition-colors line-clamp-2 leading-snug">
                          {article.title}
                        </h3>
                        <p className="text-xs text-black/70 font-medium leading-relaxed line-clamp-3">
                          {article.article_content || article.summary}
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-black/5 flex items-center justify-end text-xs font-black uppercase tracking-wider text-black">
                        <span className="group-hover:underline flex items-center gap-1.5">
                          Read
                          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </article>
                  );
                })}
            </div>
            </section>

            {/* SECTION: COMMUNITY ROUTINES */}
            <section className="space-y-4 w-full pt-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/10">
                <div className="flex items-baseline gap-3">
                  <h2 
                    className="text-xl md:text-2xl font-black uppercase tracking-tight text-black" 
                    style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}
                  >
                    Community Routines
                  </h2>
                  <span className="text-xs text-black/40 font-medium hidden sm:inline">Explore the latest routines shared by others like you</span>
                </div>
              </div>

              {!publicRoutines || publicRoutines.length === 0 ? (
                <div className="p-6 bg-white border border-black/10 rounded-2xl text-center text-xs text-black/50 font-medium uppercase tracking-wider">
                  No public routines shared yet. Create and set a routine to public to feature it here!
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...publicRoutines]
                    .sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime())
                    .slice(0, 3)
                    .map(rt => (
                      <div 
                        key={rt.id} 
                        onClick={() => onOpenRoutine?.(rt)}
                        className="clean-card bg-white border border-black/10 p-4 rounded-2xl space-y-3 flex flex-col justify-between cursor-pointer hover:border-black/30 transition-all"
                        title="Click to view routine details"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded bg-black/5 text-[10px] font-black uppercase tracking-wider text-venus-accent">
                              {rt.time || 'AM'} Routine
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={(e) => { e.stopPropagation(); onShareRoutine?.(rt); }}
                                className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 text-black transition-colors cursor-pointer"
                                title="Share routine"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); onVoteRoutine?.(rt.id); }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/5 hover:bg-black/10 text-black text-[11px] font-black transition-colors cursor-pointer"
                                title="Upvote routine"
                              >
                                <Heart className="w-3.5 h-3.5 text-venus-accent fill-venus-accent/20" />
                                <span>{rt.votes_count || 0}</span>
                              </button>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-black uppercase tracking-tight text-black">
                              {rt.routine_name || 'Community Routine'}
                            </h4>
                            <div className="text-[11px] font-semibold text-black/50 mt-0.5">
                              By @{rt.username || 'Anonymous'}
                            </div>
                          </div>
                          {rt.notes && (
                            <p className="text-xs text-black/60 font-medium line-clamp-2">
                              {rt.notes}
                            </p>
                          )}
                          <div className="space-y-1 pt-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-black/40">Products ({Array.isArray(rt.products) ? rt.products.length : 0})</div>
                            <div className="space-y-1">
                              {Array.isArray(rt.products) && rt.products.slice(0, 1).map((p: any, pIdx: number) => (
                                <div 
                                  key={pIdx} 
                                  onClick={(e) => { e.stopPropagation(); openProductCard(String(p.id || p.product_id)); }}
                                  className="text-xs font-semibold text-black/80 truncate flex items-center gap-1.5 hover:text-venus-accent transition-colors cursor-pointer"
                                  title="Click to view product"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-venus-accent shrink-0" />
                                  <span className="truncate underline">{p.brand} {p.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-black/5 flex items-center justify-between text-[11px] text-black/50">
                          <span>{Array.isArray(rt.days) && rt.days.length > 0 ? rt.days.join(', ') : 'Daily'}</span>
                          <span className="text-venus-accent font-black uppercase text-[10px]">View →</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>

            {/* SECTION 2: BROWSE PRODUCTS (ONE ROW) */}
            <section className="space-y-6 w-full">
              <div className="flex items-center justify-between pb-3 border-b border-black/10">
                <div className="flex items-baseline gap-3">
                  <h2 
                    className="text-xl md:text-2xl font-black uppercase tracking-tight text-black cursor-pointer hover:text-venus-accent transition-colors" 
                    style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}
                    onClick={() => {
                      resetHeaderSearchState();
                      setAppState(AppState.RANK);
                    }}
                  >
                    Browse Products
                  </h2>
                </div>
                <button 
                  onClick={() => {
                    resetHeaderSearchState();
                    setAppState(AppState.RANK);
                  }}
                  className="group inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-black/70 hover:text-black transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-black/5"
                  title="View all products on Products page"
                  aria-label="View all products on Products page"
                >
                  <span>View All</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 text-black" />
                </button>
              </div>

              {/* Primary Filter Bubbles */}
              <div className="flex flex-nowrap justify-start sm:justify-center md:justify-center gap-3 md:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 snap-x snap-mandatory w-full">
                {[
                  { name: 'Type', image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=300&q=80', filterKey: 'By Type' },
                  { name: 'Ingredient', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=300&q=80', filterKey: 'By Ingredient' },
                  { name: 'Concern', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=300&q=80', filterKey: 'By Concern' },
                  { name: 'Trending', image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80', filterKey: 'Trending' },
                  { name: 'Pregnancy-safe', image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=300&q=80', filterKey: 'Pregnancy-safe' }
                ].map(item => {
                  const isActive = (primaryFilter === 'By Type' && (subFilter === item.filterKey || (item.filterKey === 'By Type' && subFilter === 'All'))) || primaryFilter === item.filterKey;
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        if (item.filterKey === 'By Type') {
                          setPrimaryFilter('By Type');
                          setSubFilter('All');
                        } else {
                          setPrimaryFilter(item.filterKey);
                          setSubFilter('all');
                        }
                      }}
                      className="flex flex-col items-center gap-1.5 shrink-0 snap-start group cursor-pointer w-20 sm:w-24 md:w-28 text-center"
                    >
                      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 transition-all duration-300 shadow-md mx-auto ${
                        isActive ? 'border-black scale-105 shadow-lg ring-2 ring-black/20' : 'border-black/10 group-hover:border-black/40'
                      }`}>
                        <img src={item.image} alt={item.name} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      </div>
                      <span className={`text-[9px] md:text-xs font-black uppercase tracking-wider text-center w-full whitespace-normal leading-tight ${
                        isActive ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/70 group-hover:text-black'
                      }`}>
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sub-bar Filter */}
              {(primaryFilter === 'By Type' || primaryFilter === 'Pregnancy-safe') && (
                <div className="flex justify-start sm:justify-center md:justify-center gap-3 md:gap-5 overflow-x-auto no-scrollbar pb-1 pt-1 w-full flex-wrap">
                  {['All', 'Cleanser', 'SPF', 'Cream', 'Serum', 'Toner', 'Retinol', 'Moisturizer'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setSubFilter(type)}
                      className={`text-[10px] md:text-xs font-black uppercase transition-all whitespace-nowrap cursor-pointer ${subFilter.toLowerCase() === type.toLowerCase() ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/40 hover:text-black'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}

              {primaryFilter === 'By Ingredient' && (
                <div className="flex justify-start sm:justify-center md:justify-center gap-3 md:gap-5 overflow-x-auto no-scrollbar pb-1 pt-1 w-full flex-wrap">
                  {['all', 'Retinols', 'Hyaluronic Acid', 'PDRN', 'Collagen', 'Niacinamide', 'Salicylic Acid', 'Vitamin C', 'Vitamin E', 'Glycolic Acid', 'Peptides', 'Ceramides', 'AHA/BHA'].map((ing) => (
                    <button
                      key={ing}
                      onClick={() => setSubFilter(ing)}
                      className={`text-[10px] md:text-xs font-black uppercase transition-all whitespace-nowrap cursor-pointer ${subFilter.toLowerCase() === ing.toLowerCase() ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/40 hover:text-black'}`}
                    >
                      {ing}
                    </button>
                  ))}
                </div>
              )}

              {primaryFilter === 'By Concern' && (
                <div className="flex justify-start sm:justify-center md:justify-center gap-3 md:gap-5 overflow-x-auto no-scrollbar pb-1 pt-1 w-full flex-wrap">
                  {['all', 'Blemish-prone skin', 'Redness', 'Dry Skin', 'Aging skin'].map((concern) => (
                    <button
                      key={concern}
                      onClick={() => setSubFilter(concern)}
                      className={`text-[10px] md:text-xs font-black uppercase transition-all whitespace-nowrap cursor-pointer ${subFilter.toLowerCase() === concern.toLowerCase() ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/40 hover:text-black'}`}
                    >
                      {concern}
                    </button>
                  ))}
                </div>
              )}

              {primaryFilter === 'Trending' && (
                <div className="flex justify-start sm:justify-center md:justify-center gap-3 md:gap-5 overflow-x-auto no-scrollbar pb-1 pt-1 w-full flex-wrap">
                  {['all', 'K-Beauty', 'J-Beauty', 'Glass Skin', 'PDRN', 'Natural', 'Winter Care'].map((trend) => (
                    <button
                      key={trend}
                      onClick={() => setSubFilter(trend)}
                      className={`text-[10px] md:text-xs font-black uppercase transition-all whitespace-nowrap cursor-pointer ${subFilter.toLowerCase() === trend.toLowerCase() ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/40 hover:text-black'}`}
                    >
                      {trend}
                    </button>
                  ))}
                </div>
              )}

              {/* Exactly ONE row of products (4 products on desktop, 2x2 on mobile) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3 md:gap-4 w-full">
                {(() => {
                  const baseList = products && products.length > 0 ? products : INVENTORY;
                  const filtered = baseList.filter(p => {
                    const pType = (p.type || p.Type || '').toLowerCase();
                    const pName = (p.name || p.Name || p.ProductName || p['Product Name'] || '').toLowerCase();
                    const pBrand = (p.brand || p.Brand || '').toLowerCase();
                    const pDesc = (p.description || '').toLowerCase();
                    const pIngs = Array.isArray(p.ingredients) ? p.ingredients.map((i: string) => i.toLowerCase()) : [];

                    const cat2 = (p.product_scores?.cat2 || '').toLowerCase();
                    const pf = (Array.isArray(p.products_filter) ? p.products_filter[0] : p.products_filter) || {};
                    const pregSafe = pf.preg_safe === true;

                    if (primaryFilter === 'By Type') {
                      if (subFilter === 'All' || subFilter === 'all') return true;
                      const sub = subFilter.toLowerCase();
                      if (sub === 'cleanser') return pType.includes('clean') || cat2.includes('clean');
                      if (sub === 'spf') return pType.includes('spf') || pType.includes('sun') || cat2.includes('spf');
                      if (sub === 'cream') return pType.includes('cream') || cat2.includes('cream');
                      if (sub === 'serum') return pType.includes('serum') || cat2.includes('serum');
                      if (sub === 'toner') return pType.includes('toner') || cat2.includes('toner');
                      if (sub === 'retinol') return pf.c_retinol === true || pType.includes('retinol') || pName.includes('retinol') || pIngs.some(i => i.includes('retinol'));
                      if (sub === 'moisturizer') return pType.includes('moist') || cat2.includes('moist');
                      return pType.includes(sub) || cat2.includes(sub);
                    }
                    if (primaryFilter === 'Pregnancy-safe') {
                      if (!pregSafe && !pDesc.includes('pregnancy-safe')) return false;
                      if (subFilter === 'All' || subFilter === 'all') return true;
                      const sub = subFilter.toLowerCase();
                      return pType.includes(sub) || cat2.includes(sub);
                    }
                    if (primaryFilter === 'By Ingredient') {
                      if (subFilter === 'all' || subFilter === 'All') return true;
                      const target = subFilter.toLowerCase();
                      if (target === 'retinols' || target === 'retinol') {
                        if (pf.c_retinol === true) return true;
                      } else if (target === 'hyaluronic acid' || target === 'ha') {
                        if (pf.c_ha === true) return true;
                      } else if (target === 'pdrn') {
                        if (pf.c_pdrn === true || pf.pdrn === true) return true;
                      } else if (target === 'collagen') {
                        if (pf.c_collagen === true) return true;
                      } else if (target === 'niacinamide') {
                        if (pf.c_niac === true) return true;
                      } else if (target === 'salicylic acid' || target === 'salicylic') {
                        if (pf.c_salicylic === true) return true;
                      } else if (target === 'vitamin c' || target === 'vit c' || target === 'vitc') {
                        if (pf.c_vitc === true) return true;
                      } else if (target === 'vitamin e' || target === 'vit e' || target === 'vite') {
                        if (pf.c_vite === true) return true;
                      } else if (target === 'glycolic acid' || target === 'glycolic') {
                        if (pf.c_glycolic === true) return true;
                      } else if (target === 'peptides' || target === 'peptide') {
                        if (pf.c_peptides === true) return true;
                      } else if (target === 'ceramides' || target === 'ceramide') {
                        if (pf.c_ceramide === true) return true;
                      } else if (target === 'aha/bha') {
                        if (pf.c_ahabha === true) return true;
                      }
                      const cleanTarget = target.replace(/s$/, '');
                      return pIngs.some((i: string) => i.includes(target) || (cleanTarget.length > 2 && i.includes(cleanTarget))) ||
                             pDesc.includes(target) || (cleanTarget.length > 2 && pDesc.includes(target)) ||
                             pName.includes(target) || (cleanTarget.length > 2 && pName.includes(target));
                    }
                    if (primaryFilter === 'By Concern') {
                      if (subFilter === 'all' || subFilter === 'All') return true;
                      const target = subFilter.toLowerCase();
                      if (target === 'blemish-prone skin') return pf.blem_prone === true;
                      if (target === 'redness') return pf.red === true;
                      if (target === 'dry skin') return pf.dry === true;
                      if (target === 'aging skin') return pf.aging === true;
                      return pDesc.includes(target) || pName.includes(target);
                    }
                    if (primaryFilter === 'Trending') {
                      if (subFilter === 'all' || subFilter === 'All') return true;
                      const target = subFilter.toLowerCase();
                      if (target === 'k-beauty') return pf.k_beauty === true;
                      if (target === 'j-beauty') return pf.j_beauty === true;
                      if (target === 'glass skin') return pf.glass === true;
                      if (target === 'pdrn') return pf.c_pdrn === true || pf.pdrn === true;
                      if (target === 'natural') return pf.natural === true;
                      return pDesc.includes(target) || pName.includes(target) || pBrand.includes(target) || pIngs.some((i: string) => i.includes(target));
                    }
                    return true;
                  });

                  const displayList = (filtered.length > 0 ? filtered : baseList).slice(0, 4);

                  return displayList.map((p: any) => {
                    const userProd = userProducts.find(up => (up?.product_name === (p.name || p.Name || p.ProductName || p['Product Name'])));
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => openProductCard(String(p.id))} 
                        className="cursor-pointer clean-card p-3 border-2 bg-white border-black/5 hover:border-black transition-all flex flex-col items-center text-center justify-between gap-2 relative group w-full"
                        data-product-id={p.id}
                      >
                        {p.photo_url ? (
                          <img 
                            src={p.photo_url} 
                            alt={p.name || p.Name || p.ProductName || p['Product Name'] || 'Product'} 
                            referrerPolicy="no-referrer"
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-black/10 flex-shrink-0 group-hover:scale-105 transition-transform mx-auto" 
                          />
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/5 rounded-xl border border-black/10 flex items-center justify-center flex-shrink-0 text-[8px] text-black/40 mx-auto">
                            No Image
                          </div>
                        )}
                        <div className="w-full min-w-0 text-center">
                          <div className="text-[9px] font-black uppercase tracking-widest text-venus-accent mb-0.5 whitespace-normal break-words text-center">
                            {p.brand || p.Brand || 'Unknown'}
                          </div>
                          <h3 className="text-[10px] md:text-xs font-black text-black uppercase leading-tight whitespace-normal break-words text-center line-clamp-2">
                            {p.name || p.Name || p.ProductName || p['Product Name'] || 'Unnamed'}
                          </h3>
                        </div>
                        <div className="absolute top-2 right-2">
                          {userProd ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteUPP(userProd.id); }} 
                              className="p-1 hover:bg-black/10 rounded-full shrink-0"
                              title="Remove from routine"
                            >
                              <Trash2 className="w-3 h-3 text-black/70"/>
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                if (!user) {
                                  setAuthPromptModalOpen(true);
                                  return;
                                }
                                setSelectedProductForUPP(p); 
                              }} 
                              className="p-1 hover:bg-black/5 rounded-full shrink-0"
                              title="Add to routine"
                            >
                              <Plus className="w-3 h-3 text-black/50"/>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>
          </div>
        </motion.div>
      )}
    </>
  );
};
