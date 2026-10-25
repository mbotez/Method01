/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronLeft,
  ArrowRight, 
  CheckCircle2, 
  Sun, 
  Moon, 
  Plus, 
  History, 
  Heart,
  CheckSquare,
  User as UserIcon,
  LogOut,
  ShoppingBag,
  Award,
  Pencil,
  AlarmClock,
  Newspaper,
  FlaskConical,
  Trash2,
  Share2,
  X,
  Menu,
  Search,
  Home,
  MessageCircle,
  Camera,
  Loader2,
  ChevronDown,
  Droplet,
  Shield,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from './lib/supabase';
import { ProductCardProvider, useProductCard } from './context/ProductCardContext';
import { Login } from './components/Login';
import { ProductDetailModalNew } from './components/ProductDetailModalNew';
import { ProductCard, ProductCardContent } from './components/ProductCard';
import { ProductLink } from './components/ProductLink';
import { ComparisonModal } from './components/ComparisonModal';
import { TrackerNewProductModal } from './components/TrackerNewProductModal';
import { Social } from './components/Social';
import { ChatQuestionnaire } from './components/ChatQuestionnaire';
import { INVENTORY, Product } from './constants';
import { InlineTrackerControls } from './components/InlineTrackerControls';
import { searchProductsFromPhoto, ProductConfirmationModal, MatchedProduct } from './components/photo_search';
import { productSort } from './utils/productsort';
import { searchProducts } from "./utils/TextSearch";
import { TrackerSpreadsheetRow } from './components/TrackerSpreadsheetRow';
import { checkRoutine, RoutineCheckResult, UserProfile } from './utils/RoutineCheck';
import { BREAKOUT_PHOTO_OPTIONS, getBreakoutTitle, breakoutTypeStringToId } from './data/breakoutOptions';
import { setupCapacitorDeepLinkAuth, handleWebAuthCallback } from './utils/auth';

// --- Components ---

// ... (rest of imports)

const GlowingBackground = ({ appState }: { appState: AppState }) => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-[#85701d]">
    <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-venus-accent/[0.1] blur-[100px]" />
    <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] rounded-full bg-venus-accent/[0.15] blur-[80px]" />
  </div>
);

const ErrorModal = ({ error, onClose }: { error: string, onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full">
      <h2 className="text-xl font-bold mb-4 text-red-600">Database Error</h2>
      <p className="text-sm text-gray-700 mb-6 bg-red-50 p-4 rounded-lg">{error}</p>
      <button className="w-full bg-black text-white p-3 rounded-lg uppercase tracking-widest text-xs font-black" onClick={onClose}>Close</button>
    </div>
  </div>
);

// --- Main App Logic ---

enum AppState {
  LANDING,
  AUTH,
  ONBOARDING_DETAILS,
  CURATED_SELECTION,
  DASHBOARD,
  RANK,
  TRACKER,
  SOCIAL,
  PROFILE,
  PROGRESS,
  PRODUCT_PAGE
}

const CAT3_MAPPING: Record<string, { id: number, name: string }[]> = {
  "Cleanser": [
    { id: 1, name: "Facewash" },
    { id: 2, name: "Makeup Remover" },
    { id: 3, name: "Exfoliator" },
    { id: 7, name: "Oil" },
    { id: 14, name: "Pad" },
    { id: 15, name: "Scrub" }
  ],
  "Moisturiser": [
    { id: 6, name: "Cream" },
    { id: 7, name: "Oil" },
    { id: 10, name: "Eyecare" },
    { id: 11, name: "Lipcare" },
    { id: 16, name: "Mask" }
  ],
  "Treatment": [
    { id: 3, name: "Exfoliator" },
    { id: 4, name: "Serum" },
    { id: 5, name: "Toner" },
    { id: 7, name: "Oil" },
    { id: 12, name: "Spot Treatment" },
    { id: 14, name: "Pad" },
    { id: 15, name: "Scrub" },
    { id: 16, name: "Mask" }
  ],
  "Targeted": [
    { id: 4, name: "Serum" },
    { id: 5, name: "Toner" },
    { id: 6, name: "Cream" },
    { id: 10, name: "Eyecare" },
    { id: 11, name: "Lipcare" },
    { id: 12, name: "Spot Treatment" },
    { id: 13, name: "Patch" },
    { id: 14, name: "Pad" },
    { id: 16, name: "Mask" }
  ],
  "SPF": [
    { id: 8, name: "Mineral SPF" },
    { id: 9, name: "Chemical SPF" },
    { id: 11, name: "Lipcare" }
  ]
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    const isWeb = typeof window !== 'undefined' && window.innerWidth >= 640;
    return isWeb ? AppState.SOCIAL : AppState.LANDING;
  });
  const { openProductCard } = useProductCard();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [skinType, setSkinType] = useState('normal');
  const [concern, setConcern] = useState('Other');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [trackerData, setTrackerData] = useState<any[]>([]);
  const [progressPhotos, setProgressPhotos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [selectedProductForPage, setSelectedProductForPage] = useState<any | null>(null);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<any | null>(null);
  const [selectedProductForUPP, setSelectedProductForUPP] = useState<any | null>(null);
  const [uppCategories, setUppCategories] = useState<string[]>([]);
  const [uppImpression, setUppImpression] = useState<'Loved it' | 'Was OK' | 'Not for me'>('Loved it');
  const [uppNotes, setUppNotes] = useState('');
  const [uppLength, setUppLength] = useState('');
  const [uppFrequency, setUppFrequency] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [primaryFilter, setPrimaryFilter] = useState<string>('By Type');
  const [subFilter, setSubFilter] = useState<string>('All');
  const [trackerFilter, setTrackerFilter] = useState<{ category: string; subOption?: string }>({ category: 'All' });
  const [isTrackerFilterOpen, setIsTrackerFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const [headerSearchResults, setHeaderSearchResults] = useState<any[]>([]);
  const [isHeaderSearching, setIsHeaderSearching] = useState(false);
  const [isHeaderSearchDropdownOpen, setIsHeaderSearchDropdownOpen] = useState(false);
  const headerSearchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerSearchQuery.trim()) {
      setHeaderSearchResults([]);
      setIsHeaderSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsHeaderSearching(true);
      const query = headerSearchQuery.trim();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`name.ilike.%${query}%,brand.ilike.%${query}%,type.ilike.%${query}%`)
        .limit(10);
      if (!error && data) {
        setHeaderSearchResults(data);
      } else {
        setHeaderSearchResults([]);
      }
      setIsHeaderSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [headerSearchQuery]);

  const resetHeaderSearchState = () => {
    setHeaderSearchQuery('');
    setHeaderSearchResults([]);
    setIsHeaderSearchDropdownOpen(false);
  };
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [expandedRoutines, setExpandedRoutines] = useState<number[]>([]);
  const [routineChecks, setRoutineChecks] = useState<Record<string, RoutineCheckResult>>({});
  const [routineProductScores, setRoutineProductScores] = useState<Record<string, any>>({});

  const getBenefitsForProduct = (p: any, s: any) => {
    const benefits: string[] = [];
    const name = (p.name || p.product_name || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    if (s?.calm_redness_dry_skin > 0 || s?.calm_redness_oily_skin > 0 || s?.calm_redness_combi_skin > 0 || name.includes('redness') || desc.includes('redness')) {
      benefits.push('Calms facial redness');
    }
    if (s?.barrier_repair_dry_skin > 0 || s?.barrier_repair_oily_skin > 0 || s?.barrier_repair_combi_skin > 0 || name.includes('barrier') || desc.includes('barrier')) {
      benefits.push('Repairs skin barrier');
    }
    if (s?.hydration_dry_skin > 0 || s?.hydration_oily_skin > 0 || s?.hydration_combi_skin > 0) {
      benefits.push('Deep hydration');
    }
    if (s?.reduce_wrinkles > 0) {
      benefits.push('Smooths fine lines & wrinkles');
    }
    if (s?.has_brightening_ingredient || s?.fade_pie > 0 || s?.fade_pih > 0 || s?.dark_spots > 0) {
      benefits.push('Brightens skin tone & fades dark spots');
    }
    if (s?.clear_blackheads > 0 || s?.clear_surface_breakouts > 0 || s?.clear_whiteheads > 0 || s?.soothe_deep_breakouts > 0) {
      benefits.push('Clears pores & blemishes');
    }
    if (s?.oil_control > 0) {
      benefits.push('Oil control');
    }
    if (benefits.length === 0) {
      benefits.push('Balances skin & maintains health');
    }
    return benefits;
  };

  const getActiveRoutineProducts = (products: any[], routineTime: string) => {
    // If trackerData is not loaded yet but we have products, fallback to the raw list to avoid flashing empty lists
    if (trackerData.length === 0 && loading) {
      return products || [];
    }
    return (products || []).filter((p: any) => {
      const trackerItem = trackerData.find((item: any) => {
        const matchesId = p.id && item.product_id && String(item.product_id) === String(p.id);
        const matchesName = !matchesId && 
          item.brand?.toLowerCase() === p.brand?.toLowerCase() && 
          item.product_name?.toLowerCase() === p.name?.toLowerCase();
        return (matchesId || matchesName) && 
               (item.routine_time === routineTime || item.routine_time === 'AM/PM');
      });
      return trackerItem ? !!trackerItem.in_use : false;
    });
  };

  const toggleRoutineExpansion = (idx: number) => {
    setExpandedRoutines(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const [expandedTrackerIds, setExpandedTrackerIds] = useState<string[]>([]);

  const toggleTrackerItemExpanded = (id: string) => {
    setExpandedTrackerIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const [collapsedTrackerSections, setCollapsedTrackerSections] = useState<string[]>([]);

  const toggleTrackerSection = (sectionName: string) => {
    setCollapsedTrackerSections(prev =>
      prev.includes(sectionName)
        ? prev.filter(s => s !== sectionName)
        : [...prev, sectionName]
    );
  };
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [ratingNote, setRatingNote] = useState("");
  const [isRatingExpanded, setIsRatingExpanded] = useState(false);
  const [routineSearchResults, setRoutineSearchResults] = useState<any[]>([]);
  const [isSearchingRoutine, setIsSearchingRoutine] = useState(false);
  const [productFilter, setProductFilter] = useState('All');
  const [leaderboardFilter, setLeaderboardFilter] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [pendingQuestionnaireAnswers, setPendingQuestionnaireAnswers] = useState<any>(null); // NEW
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [authPromptModalOpen, setAuthPromptModalOpen] = useState(false);
  const [isSharingOpen, setIsSharingOpen] = useState(false);
  const [shareRoutine, setShareRoutine] = useState<any>(null);
  const [usernameSearch, setUsernameSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [newProductForComparison, setNewProductForComparison] = useState<any | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [isFollowsOpen, setIsFollowsOpen] = useState(false);
  const [socialTab, setSocialTab] = useState<'Messages' | 'Friends'>('Friends');
  const [socialActiveMainTab, setSocialActiveMainTab] = useState<'videos' | 'articles' | 'community'>('videos');
  const [latestVideos, setLatestVideos] = useState<any[]>([]);
  const [lastPost, setLastPost] = useState<any>(null);
  const [loadingLatestVideos, setLoadingLatestVideos] = useState(true);
  const [loadingLastPost, setLoadingLastPost] = useState(true);

  // Dashboard Product Scan States
  const dashboardFileInputRef = useRef<HTMLInputElement>(null);
  const [isDashboardScanning, setIsDashboardScanning] = useState(false);
  const [dashboardScanError, setDashboardScanError] = useState<string | null>(null);
  const [dashboardScanMatched, setDashboardScanMatched] = useState<MatchedProduct[]>([]);
  const [isDashboardConfirmOpen, setIsDashboardConfirmOpen] = useState(false);

  // Bottom Nav Product Scan States
  const navFileInputRef = useRef<HTMLInputElement>(null);
  const [isNavScanning, setIsNavScanning] = useState(false);
  const [navScanError, setNavScanError] = useState<string | null>(null);
  const [navScanMatched, setNavScanMatched] = useState<MatchedProduct[]>([]);
  const [isNavConfirmOpen, setIsNavConfirmOpen] = useState(false);

  // Landing Page Product Scan States
  const landingFileInputRef = useRef<HTMLInputElement>(null);
  const [isLandingScanning, setIsLandingScanning] = useState(false);
  const [landingScanError, setLandingScanError] = useState<string | null>(null);
  const [landingScanMatched, setLandingScanMatched] = useState<MatchedProduct[]>([]);
  const [isLandingConfirmOpen, setIsLandingConfirmOpen] = useState(false);
  const [cachedLandingProducts, setCachedLandingProducts] = useState<MatchedProduct[]>([]);
  const [isLandingEvaluating, setIsLandingEvaluating] = useState(false);

  // Inspiration Sorting States
  const [selectedInspirationCategory, setSelectedInspirationCategory] = useState<string | null>(null);
  const [selectedCat3, setSelectedCat3] = useState<number | null>(null);
  const [isSortingProducts, setIsSortingProducts] = useState(false);
  const [isLoadingMoreProducts, setIsLoadingMoreProducts] = useState(false);
  const [sortedProductsResult, setSortedProductsResult] = useState<any>(null);
  const [sortingError, setSortingError] = useState<string | null>(null);

  const handleSelectInspiration = async (category: string, forceRefresh: boolean = false, page: number = 1, cat3Override: number | null | undefined = undefined) => {
    const activeCat3 = cat3Override !== undefined ? cat3Override : selectedCat3;
    if (page === 1) {
      setSelectedInspirationCategory(category);
      setIsSortingProducts(true);
      setSortingError(null);
      setSortedProductsResult(null);
    } else {
      setIsLoadingMoreProducts(true);
      setSortingError(null);
    }

    try {
      const activeProfile = userProfile || {
        skin_type: profile?.skin_type || 'normal',
        age: '25',
        skin_tone: 1,
        burn_risk: 'medium',
        skin_characteristics: 0,
        new_product_reaction: 0,
        barrier_status: 0,
        sensitivity: [],
        main_concern: 12, // general/not sure fallback
        scnd_concern: null,
        breakout_type: [],
        pregnant: 'No',
        scan_breakout_type: []
      };

      const result = await productSort(activeProfile, category, page, forceRefresh, activeCat3);
      
      if (page === 1) {
        setSortedProductsResult(result);
      } else {
        setSortedProductsResult((prev: any) => ({
          ...result,
          products: [...(prev?.products || []), ...(result.products || [])],
          locked_products: [...(prev?.locked_products || []), ...(result.locked_products || [])],
          prescriptions: [...(prev?.prescriptions || []), ...(result.prescriptions || [])],
        }));
      }
    } catch (err: any) {
      console.error("Error running productSort:", err);
      setSortingError(err.message || "Could not sort products. Please ensure your profile is fully set up in the Profile tab.");
    } finally {
      if (page === 1) {
        setIsSortingProducts(false);
      } else {
        setIsLoadingMoreProducts(false);
      }
    }
  };

  const handleAddProductToTracker = async (p: any) => {
    if (!user) {
      setAuthPromptModalOpen(true);
      return;
    }
    try {
      const { error: trackerError } = await supabase.from('tracker').insert({
          user_id: user.id,
          brand: p.brand || p.Brand || '',
          product_name: p.name || p.ProductName || p.Name || '',
          product_type: p.type || p.Type || 'Custom',
          routine_time: 'AM/PM',
          in_use: true,
          photo_url: p.photo_url || null,
          product_id: p.id || p.product_id || null
      });
      if (trackerError) throw trackerError;
      fetchTrackerData();
    } catch (err: any) {
      console.error("Error adding product to tracker:", err);
      setError(`Failed to add product to tracker: ${err.message}`);
    }
  };

  const handleDashboardPhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDashboardScanning(true);
    setDashboardScanError(null);

    try {
      const matches = await searchProductsFromPhoto(file);
      setDashboardScanMatched(matches);
      setIsDashboardConfirmOpen(true);
    } catch (err: any) {
      console.error("Dashboard scan error:", err);
      setDashboardScanError(err.message || "An error occurred during photo scan. Please try again.");
    } finally {
      setIsDashboardScanning(false);
      if (dashboardFileInputRef.current) {
        dashboardFileInputRef.current.value = '';
      }
    }
  };

  const handleNavPhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsNavScanning(true);
    setNavScanError(null);

    try {
      const matches = await searchProductsFromPhoto(file);
      setNavScanMatched(matches);
      setIsNavConfirmOpen(true);
    } catch (err: any) {
      console.error("Nav scan error:", err);
      setNavScanError(err.message || "An error occurred during photo scan. Please try again.");
    } finally {
      setIsNavScanning(false);
      if (navFileInputRef.current) {
        navFileInputRef.current.value = '';
      }
    }
  };

  const handleLandingPhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLandingScanning(true);
    setLandingScanError(null);

    try {
      const matches = await searchProductsFromPhoto(file);
      setLandingScanMatched(matches);
      setIsLandingConfirmOpen(true);
    } catch (err: any) {
      console.error("Landing scan error:", err);
      setLandingScanError(err.message || "An error occurred during photo scan. Please try again.");
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
        // Cache those products provisorily
        localStorage.setItem('cachedLandingProducts', JSON.stringify(confirmed));
        setCachedLandingProducts(confirmed);
        // Start the questionnaire
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
      console.error("Error saving scanned products to tracker:", insertError);
      setLandingScanError("Failed to save scanned products to tracker.");
    }
  };

  const handleNavConfirmScan = async (confirmed: MatchedProduct[]) => {
    setIsNavConfirmOpen(false);
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
      console.error("Error saving scanned products to tracker:", insertError);
      setNavScanError("Failed to save scanned products to tracker.");
    }
  };

  const handleDashboardConfirmScan = async (confirmed: MatchedProduct[]) => {
    setIsDashboardConfirmOpen(false);
    if (confirmed.length === 0) return;

    if (!user) {
        localStorage.setItem('cachedLandingProducts', JSON.stringify(confirmed));
        setCachedLandingProducts(confirmed);
        setAppState(AppState.ONBOARDING_DETAILS);
        return;
    }

    // For every confirmed product, automatically insert it into the tracker table in Supabase
    const payload = confirmed.map(prod => ({
      user_id: user?.id,
      brand: prod.brand,
      product_name: prod.name,
      product_type: prod.type,
      routine_time: 'AM/PM', // default
      in_use: true,
      photo_url: prod.photo_url || null,
      product_id: prod.id
    }));

    const { error: insertError } = await supabase.from('tracker').insert(payload);
    if (insertError) {
      console.error("Error saving scanned products to tracker:", insertError);
      setDashboardScanError("Failed to save scanned products to tracker.");
    }
  };

  useEffect(() => {
    // Check for pending answers on load/reload
    const stored = localStorage.getItem('pendingQuestionnaireAnswers');
    if (stored) {
        setPendingQuestionnaireAnswers(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    const fetchLastVideoAndPost = async () => {
      try {
        const { data: videoData, error: videoError } = await supabase
          .from('blog_videos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        if (videoError) {
          console.error("Error fetching latest videos:", videoError);
        } else if (videoData) {
          setLatestVideos(videoData);
        }
      } catch (err) {
        console.error("Exception fetching latest videos:", err);
      } finally {
        setLoadingLatestVideos(false);
      }

      try {
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select(`
            *,
            users (
              username
            )
          `)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (postError) {
          console.error("Error fetching last post:", postError);
        } else if (postData) {
          setLastPost(postData);
        }
      } catch (err) {
        console.error("Exception fetching last post:", err);
      } finally {
        setLoadingLastPost(false);
      }
    };

    fetchLastVideoAndPost();

    // Setup realtime subscription
    const videosChannel = supabase.channel('blog-videos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blog_videos' }, async () => {
        const { data } = await supabase
          .from('blog_videos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        if (data) setLatestVideos(data);
      })
      .subscribe();

    const postsChannel = supabase.channel('posts-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, async () => {
        const { data } = await supabase
          .from('posts')
          .select(`
            *,
            users (
              username
            )
          `)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setLastPost(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(postsChannel);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [appState]);

  useEffect(() => {
    if (!usernameSearch.trim()) {
      setUserResults([]);
      return;
    }
    const search = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, username')
        .ilike('username', `%${usernameSearch}%`)
        .limit(5);
      
      if (data) setUserResults(data);
    };
    search();
  }, [usernameSearch]);

  const formatSupabaseError = (e: any) => {
      let msg = e.message || String(e);
      if (e.details) msg += `, Details: ${e.details}`;
      if (e.hint) msg += `, Hint: ${e.hint}`;
      return msg;
  };

  const handleShareRoutine = async (targetUserId: string) => {
    if (!shareRoutine || !user?.id) {
        console.error('Missing data for share:', { shareRoutine: !!shareRoutine, userId: user?.id });
        return;
    }
    
    
    // 1. Send automated message
    const { error: msgError } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: targetUserId,
        message: `${user.username || 'Someone'} has sent you their routine! It's now available in your routines table.`,
        timestamp: new Date().toISOString()
    });
    if (msgError) console.error('Error sending message:', msgError);

    // 2. Duplicate routine
    const { error } = await supabase
        .from('routines')
        .insert({
            user_id: targetUserId,
            routine_name: shareRoutine.routine_name,
            time: shareRoutine.time,
            products: shareRoutine.products,
            notes: shareRoutine.notes
        });
    
    if (error) {
        console.error('Error duplicating routine:', error);
    } else {
        setIsSharingOpen(false);
        setShareRoutine(null);
        setUsernameSearch('');
    }
  };

  const saveQuestionnaireToProfile = async (answers: any, userId: string) => {
        const feelMap: Record<string, string> = {
            'Dry and tight': 'dry',
            'Oily all over': 'oily',
            'Comfortable': 'normal',
            'Oily forehead and nose, but dry cheeks': 'combination'
        };
        const sunMap: Record<string, string> = {
            'I burn like a lobster': 'high',
            'Burn then tan': 'medium',
            'Got no problems tanning': 'low'
        };
        const reactionMap: Record<string, number> = {
            'Very good, no problems': 0,
            'Sometimes sensitive': 1,
            'Often get redness, bumps, or burning': 2,
            'Almost everything irritates my skin': 3
        };
        const concernMap: Record<string, number> = {
            'Breakouts & post-breakout marks': 1,
            'Blemishes & post-blemish marks': 1,
            'Breakouts and scars': 1,
            'Breakouts & scars': 1,
            'Redness': 2,
            'Dark Spots': 3,
            'Dullness': 4,
            'Dryness': 5,
            'Oily skin': 6,
            'Wrinkles & fine lines': 7,
            'Large pores & texture': 8,
            'Sensitivity': 9,
            'Extremely dry flaky skin': 10,
            'Yeast-reactive skin': 11,
            'Not sure': 12
        };
        const activesMap: Record<string, number> = {
            'Prescription retinoids (tretinoin, adapalene etc)': 1,
            'Over-the-counter retinols': 2,
            'Exfoliating acids (salicylic, glycolic etc)': 3,
            "None/ I'm not sure": 4
        };

        const symptomsScore = (answers.sensitivity || []).length;
        const reactionScore = reactionMap[answers.reaction] || 0;

        // Calculate redness score from answers
        let rednessScore = 0;
        const sensitivityList = answers.sensitivity || [];
        if (sensitivityList.includes('Redness')) {
            rednessScore += 45;
        }
        
        const mainConcern = answers.mainConcern;
        const scndConcern = answers.scndConcern;
        
        const hasCalmRedness = mainConcern === 'Redness' || scndConcern === 'Redness';
        if (hasCalmRedness) {
            rednessScore += 20;
        }

        if (answers.reaction === 'Often get redness, bumps, or burning') {
            rednessScore += 25;
        } else if (answers.reaction === 'Almost everything irritates my skin') {
            rednessScore += 35;
        }

        const profilePayload: any = {
            id: userId,
            skin_type: String(feelMap[answers.feel] || 'normal'),
            age: answers.age ? String(answers.age) : '0',
            burn_risk: String(sunMap[answers.sun] || 'medium'),
            skin_characteristics: symptomsScore,
            new_product_reaction: reactionScore,
            barrier_status: symptomsScore + reactionScore,
            sensitivity: answers.sensitivity || [],
            main_concern: concernMap[mainConcern] || null,
            scnd_concern: concernMap[scndConcern] || null,
            breakout_type: (() => {
              const raw = answers.breakoutType;
              const list = Array.isArray(raw) ? raw : (raw !== undefined && raw !== null ? [raw] : []);
              return list.map((b: any) => {
                if (typeof b === 'number') return b;
                const parsed = parseInt(String(b), 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) return parsed;
                return breakoutTypeStringToId[String(b).toLowerCase().trim()] || 0;
              }).filter((n: number) => n >= 1 && n <= 8);
            })(),
            breakout_where: answers.breakoutWhere || null,
            env: answers.env || null,
            sunscreen: answers.sunscreen || null,
            makeup: answers.makeup || null,
            makeup_remove: answers.makeupRemove || null,
            current_products: answers.currentProducts || [],
            past_problems: Array.isArray(answers.pastProblems) ? answers.pastProblems.join(', ') : (answers.pastProblems || null),
            redness: rednessScore,
            redness_score: answers.redness_score !== undefined ? Number(answers.redness_score) : null,
            wrinkles_score: answers.wrinkles_score !== undefined ? Number(answers.wrinkles_score) : null,
            redness_main_area: answers.redness_main_area || null,
            wrinkels_main_area: answers.wrinkels_main_area || null,
            scan_breakout_type: answers.scan_breakout_type || answers.blemish_assessment || null,
            sex: answers.sex || null,
            pregnant: answers.pregnant || null,
            actives_used: (answers.activesUsed || []).map((a: string) => activesMap[a] || 0)
        };

        let { error: profileError } = await supabase
            .from('user_profile')
            .upsert(profilePayload);
        
        // Graceful retry fallback if the new face scan columns or sex/pregnant/actives_used columns do not exist in the backend database yet
        if (profileError && (profileError.message.toLowerCase().includes('column') || profileError.code === '42703')) {
            console.warn('Supabase profile table structure does not match, removing extended columns and retrying...');
            const { 
              redness, redness_score, wrinkles_score, redness_main_area, wrinkels_main_area, scan_breakout_type,
              sex, pregnant, actives_used,
              ...fallbackPayload 
            } = profilePayload;
            const { error: retryError } = await supabase
                .from('user_profile')
                .upsert(fallbackPayload);
            profileError = retryError;
        }
        
        if (profileError) {
            console.error('Error saving user profile to Supabase:', {
                error: profileError,
                payload: profilePayload,
                message: profileError.message,
                details: profileError.details,
                hint: profileError.hint,
                code: profileError.code
            });
            throw profileError;
        }

        // Save selected current products to the 'tracker' table as well
        if (answers.currentProducts && answers.currentProducts.length > 0) {
            for (const p of answers.currentProducts) {
                const productData = {
                  brand: p.brand || p.Brand || '',
                  name: p.name || p.ProductName || p.Name || '',
                  type: p.type || p.Type || 'Custom'
                };
                if (!productData.brand && !productData.name) continue;

                // Check if already in the tracker
                const { data: existing } = await supabase
                  .from('tracker')
                  .select('id')
                  .eq('user_id', userId)
                  .eq('brand', productData.brand)
                  .eq('product_name', productData.name)
                  .maybeSingle();

                if (!existing) {
                    const { error: trackerError } = await supabase.from('tracker').insert({
                        user_id: userId,
                        brand: productData.brand,
                        product_name: productData.name,
                        product_type: productData.type,
                        routine_time: 'AM/PM',
                        in_use: true
                    });
                    if (trackerError) {
                        console.error('Error inserting questionnaire product into tracker:', trackerError);
                    }
                }
            }
        }

        return true;
  };

  const resolveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // If it's just a path, resolve it from progress_pics bucket
    const { data } = supabase.storage.from('progress_pics').getPublicUrl(url);
    return data.publicUrl;
  };

  const [isAddingRoutine, setIsAddingRoutine] = useState(false);
  const [modalMode, setModalMode] = useState<'new'|'edit'|'reminder'>('new');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  const [routineTime, setRoutineTime] = useState<'AM'|'PM'>('AM');
  const [routineDays, setRoutineDays] = useState<string[]>([]);
  const [routineSelectedProducts, setRoutineSelectedProducts] = useState<any[]>([]);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ brand: '', name: '', type: '' });
  const [routineName, setRoutineName] = useState('');
  const [routineNotes, setRoutineNotes] = useState('');
  
  const [editingRoutine, setEditingRoutine] = useState<any>(null);
  const [reminderRoutine, setReminderRoutine] = useState<any>(null);
  const [reminderTime, setReminderTime] = useState('');
  const [routineToDelete, setRoutineToDelete] = useState<any>(null);

  const [isSavingRoutineForm, setIsSavingRoutineForm] = useState(false);
  const [routineFormError, setRoutineFormError] = useState<string | null>(null);

  // Search Hooks & Functions
  function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
  }

  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const debouncedRoutineSearchQuery = useDebounce(routineSearchQuery, 400);

  const searchIdRef = useRef(0);
  const routineSearchIdRef = useRef(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const resetSearchState = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchDropdownOpen(false);
    setIsSearching(false);
  }, []);

  // Listen for open-quiz-or-login event from product card unauthenticated banner
  useEffect(() => {
    const handleOpenQuizOrLogin = () => {
      setAppState(AppState.ONBOARDING_DETAILS);
    };
    window.addEventListener('open-quiz-or-login', handleOpenQuizOrLogin);
    return () => window.removeEventListener('open-quiz-or-login', handleOpenQuizOrLogin);
  }, []);

  // Listen for browser navigation changes (popstate / hashchange)
  useEffect(() => {
    const handleLocationChange = () => {
      resetSearchState();
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [resetSearchState]);

  // Reset search state on sign in / sign out / auth state changes
  useEffect(() => {
    resetSearchState();
  }, [user, resetSearchState]);

  // Click outside listener for search bar container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const performSearch = useCallback(async (query: string, filter: string) => {
    const currentId = ++searchIdRef.current;
    if (!query || !query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const data = await searchProducts(query, filter);
      if (currentId === searchIdRef.current) {
        setSearchResults(data);
      }
    } catch (err) {
      if (currentId === searchIdRef.current) {
        console.error('Search error:', err);
      }
    } finally {
      if (currentId === searchIdRef.current) {
        setIsSearching(false);
      }
    }
  }, []);

  const performRoutineSearch = async (query: string) => {
    const currentId = ++routineSearchIdRef.current;
    if (!query.trim()) {
      setRoutineSearchResults([]);
      setIsSearchingRoutine(false);
      return;
    }
    setIsSearchingRoutine(true);
    try {
      const formattedQuery = query
        .trim()
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => `${word}:*`)
        .join(' & ');

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .textSearch('fts_search', formattedQuery, {
          config: 'english'
        })
        .limit(10);
      
      if (error) throw error;
      if (currentId === routineSearchIdRef.current) {
        setRoutineSearchResults(data || []);
      }
    } catch (err) {
      if (currentId === routineSearchIdRef.current) {
        console.error('Routine search error:', err);
      }
    } finally {
      if (currentId === routineSearchIdRef.current) {
        setIsSearchingRoutine(false);
      }
    }
  };

  useEffect(() => {
    performSearch(debouncedSearchQuery, productFilter);
  }, [debouncedSearchQuery, productFilter, performSearch]);

  useEffect(() => {
    performRoutineSearch(debouncedRoutineSearchQuery);
  }, [debouncedRoutineSearchQuery]);

  // Handlers
  const handleDeleteRoutine = async () => {
    if (!routineToDelete) {
      console.warn("handleDeleteRoutine: routineToDelete is null");
      return;
    }
    try {
      const { data, error, status } = await supabase
        .from('routines')
        .delete()
        .eq('id', routineToDelete.id)
        .select();

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn("Delete executed but zero rows were deleted. This usually means the row ID was not found, or it was silently blocked by a Supabase Row Level Security (RLS) policy.");
        throw new Error("Zero rows deleted or matches not found. If this is in your database, please check if your Supabase 'routines' table has a Row Level Security (RLS) policy enabling DELETE permissions for authenticated users.");
      }

      setRoutines(prev => prev.filter(rt => rt.id !== routineToDelete.id));
      setRoutineToDelete(null);
    } catch (e: any) {
      console.error("Error deleting routine:", e);
      setError(`Error deleting routine: ${formatSupabaseError(e)}`);
      setRoutineToDelete(null);
    }
  };

  const handleAddRoutine = () => {
    setRoutineName('');
    setRoutineNotes('');
    setRoutineTime('AM');
    setRoutineDays([]);
    setRoutineSelectedProducts([]);
    setModalMode('new');
    setRoutineFormError(null);
    setIsSavingRoutineForm(false);
    setIsAddingRoutine(true);
  };
  
  const handleEditRoutine = (rt: any) => {
    setEditingRoutine(rt);
    setRoutineName(rt.routine_name || '');
    setRoutineNotes(rt.notes || '');
    setRoutineTime(rt.time);
    setRoutineDays(rt.days || []);
    setRoutineSelectedProducts(rt.products || []);
    setModalMode('edit');
    setRoutineFormError(null);
    setIsSavingRoutineForm(false);
    setIsAddingRoutine(true);
  };

  const handleSetReminder = (rt: any) => {
    setReminderRoutine(rt);
    setReminderTime(rt.reminder || '');
    setModalMode('reminder');
    setRoutineFormError(null);
    setIsSavingRoutineForm(false);
    setIsAddingRoutine(true);
  };

  const handleUpdateTracker = async (item: any, field: string, value: any) => {
    if (!user) return;
    
    // Update local state for immediate UI feedback
    setTrackerData(prev => prev.map(t => {
      if (t.id === item.id) {
        return { ...t, [field]: value };
      }
      return t;
    }));
    
    // Find matching record in trackerData to keep UI snappy if needed, but realtime takes care of it
    const payload = {
      user_id: user.id,
      brand: item.brand,
      product_name: item.product_name,
      product_type: item.product_type,
      routine_time: item.routine_time,
      ingredients: item.ingredients,
      [field]: value,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('tracker')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) console.error('Error updating tracker:', error);
  };

  const handleTrackerProductClick = async (item: any, withTrackerItem: boolean = true) => {
    let productId = item.product_id;
    if (!productId) {
      // Try to find it
      const { data } = await supabase
        .from('products')
        .select('id')
        .eq('brand', item.brand)
        .eq('name', item.product_name)
        .maybeSingle();
      if (data) productId = data.id;
    }
    if (productId) {
      openProductCard(productId, withTrackerItem ? item : undefined);
    }
  };

  const progressInputRef = useRef<HTMLInputElement>(null);

  // Supabase error handler
  const handleSupabaseError = (err: any, operation: string, path: string) => {
    const errInfo = {
      error: err.message || String(err),
      operationType: operation,
      path,
      authInfo: {
        userId: user?.id,
        email: user?.email,
      }
    };
    console.error('Supabase Error:', JSON.stringify(errInfo));
    setError("Database Protocol Error: " + (err.message || "Unknown error"));
  };

  // Capacitor Deep Link & Web OAuth Callback Handler
  useEffect(() => {
    // 4. Set up deep link token handling for Capacitor (using App.addListener('appUrlOpen', ...))
    // so that when the app opens via the custom deep link scheme ("com.daybreak.canonic://auth-callback"),
    // it parses the access_token and refresh_token from the URL hash fragment, calls supabase.auth.setSession({ access_token, refresh_token }),
    // and navigates the user to the dashboard.
    const cleanupDeepLink = setupCapacitorDeepLinkAuth(
      () => {
        setAppState(AppState.DASHBOARD);
      },
      (errorMessage) => {
        setError(`Authentication error: ${errorMessage}`);
      }
    );

    // Also handle web OAuth callback if redirected to /auth/callback or hash tokens
    handleWebAuthCallback(
      () => {
        setAppState(AppState.DASHBOARD);
      },
      (errorMessage) => {
        setError(`Authentication error: ${errorMessage}`);
      }
    );

    return () => {
      cleanupDeepLink();
    };
  }, []);

  // Auth Listener
  useEffect(() => {
    let mounted = true;
    
    // Quick initialize check
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        }
        if (!data?.session && mounted) {
          setLoading(false);
        }
      })
      .catch(() => {
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        if (mounted) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      if (mounted) setUser(currentUser);
      
      if (currentUser) {
        // Save pending questionnaire answers if they exist
        const pending = localStorage.getItem('pendingQuestionnaireAnswers');
        if (pending) {
            try {
                const parsed = JSON.parse(pending);
                await saveQuestionnaireToProfile(parsed, currentUser.id);
                localStorage.removeItem('pendingQuestionnaireAnswers');
                setPendingQuestionnaireAnswers(null);
                await fetchTrackerData(currentUser.id);
            } catch (e: any) {
                console.error("Error saving pending profile:", e);
                setError(`Error saving profile info: ${e.message}`);
            }
        }

        // Save cached landing products if they exist (after signup or login)
        const cachedLanding = localStorage.getItem('cachedLandingProducts');
        if (cachedLanding) {
            if (mounted) setIsLandingEvaluating(true);
            try {
                const productsToEvaluate = JSON.parse(cachedLanding);
                await fetchTrackerData(currentUser.id);

                const payload = productsToEvaluate.map((prod: any) => ({
                  user_id: currentUser.id,
                  brand: prod.brand,
                  product_name: prod.name,
                  product_type: prod.type || 'Treatment',
                  routine_time: 'AM/PM',
                  in_use: true,
                  photo_url: prod.photo_url || null,
                  product_id: prod.id
                }));

                const { data: insertedTrackerItems, error: insertError } = await supabase
                  .from('tracker')
                  .insert(payload)
                  .select();

                if (insertError) {
                  console.error("Error saving scanned products to tracker:", insertError);
                }

                await fetchTrackerData(currentUser.id);

                // Open the product card for the first scanned product using openProductCard so it displays the exact ProductCard / ProductCardContent
                if (productsToEvaluate.length > 0) {
                   const firstProd = productsToEvaluate[0];
                   const trackerMatch = insertedTrackerItems?.find(item => String(item.product_id) === String(firstProd.id) || (item.brand === firstProd.brand && item.product_name === firstProd.name));
                   openProductCard(firstProd.id, trackerMatch);
                }

                // Clear the cached products
                localStorage.removeItem('cachedLandingProducts');
            } catch (cacheErr) {
                console.error("Error processing cached landing products:", cacheErr);
            } finally {
                if (mounted) setIsLandingEvaluating(false);
            }
        }

        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .single();

          if (error) { console.error('FAILED CALL:', { table: 'users', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }

          if (data && mounted) {
            setProfile(data);
            if (data.skin_type) setSkinType(data.skin_type);
            if (data.primary_issue) setConcern(data.primary_issue);
          }

          // Fetch user_profile as well
          const { data: uProfile, error: uProfileError } = await supabase
            .from('user_profile')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (uProfileError) {
            console.error('FAILED CALL:', { table: 'user_profile', action: 'SELECT', errorCode: uProfileError.code, message: uProfileError.message });
          } else if (uProfile && mounted) {
            setUserProfile(uProfile);
          }
        } catch (e) {
          console.error("Auth profile error:", e);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) {
            setProfile(null);
            setUserProfile(null);
            setLoading(false);
        }
      }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  // Navigation Logic
  useEffect(() => {
    if (loading) return;

    const isWeb = typeof window !== 'undefined' && window.innerWidth >= 640;

    if (user) {
      // If we are on landing/auth but logged in, move directly to blog (on web) or dashboard (on mobile)
      if (appState === AppState.LANDING || appState === AppState.AUTH) {
        setAppState(isWeb ? AppState.SOCIAL : AppState.DASHBOARD);
      }
    } else {
      // If logged out on web and currently on landing, redirect to blog (social)
      if (isWeb && appState === AppState.LANDING) {
        setAppState(AppState.SOCIAL);
        return;
      }
      // If logged out, only allow entry points and social (blog) page
      const allowedStates = [AppState.LANDING, AppState.AUTH, AppState.ONBOARDING_DETAILS, AppState.RANK, AppState.TRACKER, AppState.SOCIAL];
      if (!allowedStates.includes(appState)) {
        setAppState(isWeb ? AppState.SOCIAL : AppState.LANDING);
      }
    }
  }, [user, profile, appState, loading]);

  useEffect(() => {
    if (!userProfile?.id) return;
    ['Cleanser', 'Treatment', 'Moisturiser', 'SPF'].forEach(type => {
      productSort(userProfile, type); // fires and caches silently
    });
  }, [userProfile?.id]);

  useEffect(() => {
    const buildProductQuery = () => {
      if (primaryFilter === 'Pregnancy-safe') {
        let q = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(preg_safe), product_scores(cat2, cat3)')
          .eq('products_filter.preg_safe', true)
          .limit(100);

        if (subFilter && subFilter !== 'All' && subFilter !== 'all') {
          q = q.ilike('type', `%${subFilter}%`);
        }
        return q;
      } else if (primaryFilter === 'Trending') {
        const sub = (subFilter || '').toLowerCase();
        if (sub === 'k-beauty') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(k_beauty), product_scores(cat2, cat3)')
            .eq('products_filter.k_beauty', true)
            .limit(100);
        } else if (sub === 'j-beauty') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(j_beauty), product_scores(cat2, cat3)')
            .eq('products_filter.j_beauty', true)
            .limit(100);
        } else if (sub === 'glass skin') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(glass), product_scores(cat2, cat3)')
            .eq('products_filter.glass', true)
            .limit(100);
        } else if (sub === 'pdrn') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(c_pdrn), product_scores(cat2, cat3)')
            .eq('products_filter.c_pdrn', true)
            .limit(100);
        } else if (sub === 'natural') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(natural), product_scores(cat2, cat3)')
            .eq('products_filter.natural', true)
            .limit(100);
        } else {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter(preg_safe, k_beauty, j_beauty, glass, c_pdrn, natural, red, dry, aging, blem_prone), product_scores(cat2, cat3)')
            .limit(500);
        }
      } else if (primaryFilter === 'By Concern') {
        const sub = (subFilter || '').toLowerCase();
        if (sub === 'redness') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(red), product_scores(cat2, cat3)')
            .eq('products_filter.red', true)
            .limit(100);
        } else if (sub === 'dry skin') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(dry), product_scores(cat2, cat3)')
            .eq('products_filter.dry', true)
            .limit(100);
        } else if (sub === 'aging skin') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(aging), product_scores(cat2, cat3)')
            .eq('products_filter.aging', true)
            .limit(100);
        } else if (sub === 'blemish-prone skin') {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter!inner(blem_prone), product_scores(cat2, cat3)')
            .eq('products_filter.blem_prone', true)
            .limit(100);
        } else {
          return supabase
            .from('products')
            .select('id, brand, name, type, photo_url, products_filter(red, dry, aging, blem_prone), product_scores(cat2, cat3)')
            .limit(500);
        }
      } else {
        return supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter(preg_safe, k_beauty, j_beauty, glass, c_pdrn, natural, red, dry, aging, blem_prone), product_scores(cat2, cat3)')
          .limit(500);
      }
    };

    const fetchFilteredProducts = async () => {
      const query = buildProductQuery();
      const { data, error } = await query;
      if (error) { console.error('FAILED CALL:', { table: 'products', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
      if (data) setProducts(data);
    };

    fetchFilteredProducts();

    const productsChannel = supabase.channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const query = buildProductQuery();
        const { data, error } = await query;
        if (error) { console.error('FAILED CALL:', { table: 'products', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
        if (data) setProducts(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
    };
  }, [primaryFilter, subFilter]);

  const fetchTrackerData = useCallback(async (customUserId?: string) => {
    const uid = customUserId || user?.id;
    if (!uid) return;
    const { data, error } = await supabase
      .from('tracker')
      .select('*')
      .eq('user_id', uid);
    if (error) console.error('Tracker fetch error:', error);
    if (data) setTrackerData(data);
  }, [user]);

  // Routine compatibility checks using RoutineCheck.ts
  useEffect(() => {
    let active = true;

    const runChecks = async () => {
      // Create a clean mapped user profile from the database profile or fallback
      const rawProfile = userProfile || {
        skin_type: profile?.skin_type || 'combination',
        barrier_status: 0,
        burn_risk: 'medium',
        new_product_reaction: 0,
        main_concern: 12,
        scnd_concern: 12,
        breakout_type: [],
        pregnant: 'No',
        age: 25,
        actives_used: 4,
        env: 1,
        redness_score: 0,
        wrinkles_score: 0,
        scan_breakout_type: []
      };

      const mappedProfile: UserProfile = {
        skin_type: (rawProfile.skin_type === 'dry' || rawProfile.skin_type === 'oily' || rawProfile.skin_type === 'combination')
          ? rawProfile.skin_type
          : 'combination',
        barrier_status: typeof rawProfile.barrier_status === 'number' ? rawProfile.barrier_status : 0,
        burn_risk: (rawProfile.burn_risk === 'low' || rawProfile.burn_risk === 'medium' || rawProfile.burn_risk === 'high')
          ? rawProfile.burn_risk
          : 'medium',
        new_product_reaction: typeof rawProfile.new_product_reaction === 'number' ? rawProfile.new_product_reaction : 0,
        main_concern: typeof rawProfile.main_concern === 'number' ? rawProfile.main_concern : 12,
        scnd_concern: typeof rawProfile.scnd_concern === 'number' ? rawProfile.scnd_concern : 12,
        breakout_type: Array.isArray(rawProfile.breakout_type)
          ? rawProfile.breakout_type.map((b: any) => {
              if (typeof b === 'number') return b;
              const p = parseInt(String(b), 10);
              return !isNaN(p) && p >= 1 && p <= 8 ? p : b;
            })
          : null,
        pregnant: (rawProfile.pregnant === 'Yes' || rawProfile.pregnant === 'No') ? rawProfile.pregnant : 'No',
        age: typeof rawProfile.age === 'number' ? rawProfile.age : (typeof rawProfile.age === 'string' ? parseInt(rawProfile.age) || 25 : 25),
        actives_used: typeof rawProfile.actives_used === 'number' ? rawProfile.actives_used : 4,
        env: typeof rawProfile.env === 'number' ? rawProfile.env : 1,
        redness_score: typeof rawProfile.redness_score === 'number' ? rawProfile.redness_score : 0,
        wrinkles_score: typeof rawProfile.wrinkles_score === 'number' ? rawProfile.wrinkles_score : 0,
        scan_breakout_type: Array.isArray(rawProfile.scan_breakout_type) ? rawProfile.scan_breakout_type : []
      };

      const newChecks: Record<string, RoutineCheckResult> = {};

      for (let rIdx = 0; rIdx < routines.length; rIdx++) {
        const rt = routines[rIdx];
        const key = rt.id || String(rIdx);
        const activeProducts = getActiveRoutineProducts(rt.products, rt.time);
        const prodIds = activeProducts.map((p: any) => String(p.id)).filter(Boolean);
        const timing: Record<string, 'AM' | 'PM' | 'both'> = {};
        activeProducts.forEach((p: any) => {
          if (p.id) {
            timing[String(p.id)] = rt.time === 'AM' || rt.time === 'PM' ? rt.time : 'both';
          }
        });

        try {
          const checkResult = await checkRoutine(mappedProfile, prodIds, timing);
          
          // Fetch names and brands for recommended additions if they exist
          if (checkResult.recommended_additions && checkResult.recommended_additions.length > 0) {
            const recPids = checkResult.recommended_additions.map(ra => Number(ra.product_id)).filter(id => !isNaN(id));
            if (recPids.length > 0) {
              const { data: recProds } = await supabase
                .from('products')
                .select('id, brand, name, type')
                .in('id', recPids);
              if (recProds) {
                (checkResult as any).resolved_additions = checkResult.recommended_additions.map(ra => {
                  const found = recProds.find(rp => Number(rp.id) === Number(ra.product_id));
                  return {
                    ...ra,
                    brand: found?.brand || 'Recommended',
                    name: found?.name || 'Targeted Product',
                    type: found?.type || 'Treatment'
                  };
                });
              }
            }
          }

          newChecks[key] = checkResult;
        } catch (e) {
          console.error(`Error running checkRoutine for key ${key}:`, e);
        }
      }

      if (active) {
        setRoutineChecks(newChecks);
      }
    };

    if (routines && routines.length > 0) {
      runChecks();
    } else {
      setRoutineChecks({});
    }

    return () => {
      active = false;
    };
  }, [routines, trackerData, loading, userProfile, profile]);

  useEffect(() => {
    const fetchScoresForRoutines = async () => {
      const allProductIds = new Set<string>();
      routines.forEach((rt: any) => {
        const activeProds = getActiveRoutineProducts(rt.products, rt.time);
        activeProds.forEach((p: any) => {
          if (p.id) allProductIds.add(String(p.id));
        });
      });

      const ids = Array.from(allProductIds);
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from('product_scores')
        .select('*')
        .in('product_id', ids);

      if (error) {
        console.error("Error fetching routine product scores:", error);
      } else if (data) {
        const map: Record<string, any> = {};
        data.forEach((row: any) => {
          map[String(row.product_id)] = row;
        });
        setRoutineProductScores(map);
      }
    };

    if (routines.length > 0) {
      fetchScoresForRoutines();
    }
  }, [routines, trackerData]);

  // Supabase listeners
  useEffect(() => {
    if (!user) return;

    const fetchInitialData = async () => {
      // Routines
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: true });
      if (routinesError) { console.error('FAILED ROUTINES CALL:', routinesError); }
      else { setRoutines(routinesData || []); }

      // Progress
      const { data: progressData, error: progressError } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });
      if (progressError) { console.error('FAILED PROGRESS CALL:', progressError); }
      else { setProgressPhotos(progressData || []); }

      // Upp
      const { data: uppData, error: uppError } = await supabase
        .from('upp')
        .select('*')
        .eq('user_id', user.id);
      if (uppError) { console.error('FAILED UPP CALL:', uppError); }
      else { if (uppData) setUserProducts(uppData); }

      // User Profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError) { console.error('FAILED USER_PROFILE CALL:', profileError); }
      else { setUserProfile(profileData || null); }

      // Tracker
      fetchTrackerData();
    };

    fetchInitialData();

    // Set up real-time subscriptions
    const routineChannel = supabase.channel('routine-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routines', filter: `user_id=eq.${user.id}` }, async () => {
        const { data, error } = await supabase.from('routines').select('*').eq('user_id', user.id).order('updated_at', { ascending: true });
        if (error) { console.error('FAILED CALL:', { table: 'routines', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
        if (data) setRoutines(data);
      })
      .subscribe();

    const trackerChannel = supabase.channel('tracker-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker', filter: `user_id=eq.${user.id}` }, async () => {
        const { data, error } = await supabase.from('tracker').select('*').eq('user_id', user.id);
        if (error) console.error('Tracker realtime error:', error);
        if (data) setTrackerData(data);
      })
      .subscribe();

    const progressChannel = supabase.channel('progress-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progress', filter: `user_id=eq.${user.id}` }, async () => {
        const { data, error } = await supabase
          .from('progress')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false });
        if (error) { console.error('FAILED CALL:', { table: 'progress', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
        if (data) setProgressPhotos(data);
      })
      .subscribe();

    const uppChannel = supabase.channel('upp-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upp', filter: `user_id=eq.${user.id}` }, async (payload) => {
        const { data, error } = await supabase.from('upp').select('*').eq('user_id', user.id);
        if (error) { console.error('FAILED CALL:', { table: 'upp', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
        if (data) {
          setUserProducts(data);
        }
      })
      .subscribe();

    const userProfileChannel = supabase.channel('user_profile-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profile', filter: `id=eq.${user.id}` }, async () => {
        const { data, error } = await supabase.from('user_profile').select('*').eq('id', user.id).maybeSingle();
        if (error) { console.error('FAILED CALL:', { table: 'user_profile', action: 'SELECT', errorCode: error.code, message: error.message }); }
        if (data) setUserProfile(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(routineChannel);
      supabase.removeChannel(trackerChannel);
      supabase.removeChannel(progressChannel);
      supabase.removeChannel(uppChannel);
      supabase.removeChannel(userProfileChannel);
    };
  }, [user]);

  const handleDeleteUPP = async (userProductId: string) => {
    try {
      const { error } = await supabase.from('upp').delete().eq('id', userProductId);
      if (error) throw error;
    } catch (e) {
      console.error(e);
      setError("Error deleting product");
    }
  };

  const handleSignOut = async () => {
    resetSearchState();
    try {
      await supabase.auth.signOut().catch(async () => {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      });
      setUser(null);
      setAppState(AppState.AUTH);
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setUser(null);
      setAppState(AppState.AUTH);
    }
  };

  const handleSaveRating = async () => {
    if (!selectedRating || !user) return;
    
    const { error } = await supabase
      .from('progress')
      .insert([
        { 
          user_id: user.id, 
          rating: selectedRating, 
          notes: ratingNote,
          created_at: new Date().toISOString()
        }
      ]);
    
    if (error) {
      console.error('Error saving rating:', error);
      return;
    }
    
    setSelectedRating(null);
    setRatingNote("");
    setIsRatingExpanded(false);
  };

  const handleProgressUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      try {
        // Options for compression
        const options = {
          maxSizeMB: 0.1, // ~100kb
          maxWidthOrHeight: 1200,
          useWebWorker: false,
          fileType: 'image/webp'
        };

        const compressedFile = await imageCompression(file, options);

        // Define unique path
        const fileExt = 'webp';
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Upload to 'progress_pics' bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('progress_pics')
          .upload(filePath, compressedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('CRITICAL: Storage Upload Error:', uploadError);
          // Check if bucket exists error
          if (uploadError.message.includes('bucket not found') || uploadError.message.includes('does not exist')) {
            throw new Error("Storage bucket 'progress_pics' not found. Please create it in Supabase dashboard.");
          }
          throw uploadError;
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('progress_pics')
          .getPublicUrl(filePath);

        // Insert into progress table
        const payload = {
          user_id: user.id,
          image_url: publicUrl,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString() // Keep timestamp for existing UI compatibility
        };

        const { data: insertedData, error: insertError } = await supabase
          .from('progress')
          .insert(payload)
          .select()
          .single();

        if (insertError) {
          console.error('Database Insert Error:', insertError);
          throw insertError;
        }

        // Refresh UI
        if (insertedData) {
          setProgressPhotos(prev => [insertedData, ...prev]);
        }
        
      } catch (err: any) {
        console.error("Progress upload process failed:", err);
        setError("Failed to process entry: " + (err.message || 'Unknown error'));
      }
      
      if (progressInputRef.current) {
        progressInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (photo: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!user) {
      console.error("Delete failed: No user found");
      return;
    }

    try {
      // 1. Extract path from URL - more robust extraction
      let filePath = photo.image_url;
      
      // If it's a full Supabase storage URL, we need the part after the bucket name
      const bucketName = 'progress_pics';
      if (filePath.includes(`/${bucketName}/`)) {
        filePath = filePath.split(`/${bucketName}/`).pop()?.split('?')[0] || filePath;
      }

      // 2. Delete from Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) {
        console.warn("Storage deletion warning (might already be gone):", storageError);
      }

      // 3. Delete from Database
      const { error: dbError } = await supabase
        .from('progress')
        .delete()
        .eq('id', photo.id);

      if (dbError) {
        console.error("Database deletion error:", dbError);
        throw dbError;
      }

      // Update local state
      setProgressPhotos(prev => prev.filter(p => p.id !== photo.id));
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto(null);
      }
    } catch (err: any) {
      console.error("Error deleting photo:", err);
      setError("Failed to delete photo: " + (err.message || 'Unknown error'));
    }
  };

  const defaultRitualSteps = [
    { type: 'Cleanser', benefits: 'Purifies and prepares skin' },
    { type: 'Serum', benefits: 'Targeted active formulation' },
    { type: 'Moisturizer', benefits: 'Barrier protection and hydration' },
    { type: 'Sunscreen', benefits: 'UV and environmental defense' }
  ];

  const handleQuestionnaireComplete = async (answers: any) => {
    if (user) {
        try {
            await saveQuestionnaireToProfile(answers, user.id);
            await fetchTrackerData();
            generateCuratedSelection();
        } catch (e: any) {
            console.error("Error saving questionnaire:", e);
            setError(`Error saving profile info: ${formatSupabaseError(e)}`);
        }
    } else {
        localStorage.setItem('pendingQuestionnaireAnswers', JSON.stringify(answers));
        setPendingQuestionnaireAnswers(answers);
        setIsSignUp(true);
        setAppState(AppState.AUTH);
    }
  };

  const generateCuratedSelection = async () => {
    if (!user) {
      setError("Session not initialized. Please refresh.");
      return;
    }
    
    setError(null);
    setAppState(AppState.CURATED_SELECTION);
    
    try {
      // Save initial profile info
      const payload: any = {
        id: user.id,
        onboarding_complete: true,
        created_at: new Date().toISOString()
      };

      const { error: profileError } = await supabase
        .from('users')
        .upsert(payload);
      
      if (profileError) {
         console.error('FAILED CALL:', { table: 'users', action: 'UPSERT', errorCode: profileError.code, message: profileError.message, details: profileError.details, hint: profileError.hint }); 
         throw profileError;
      }

    } catch (e: any) {
      console.error("Update profile failed:", e);
      setError(e.message || "Something went wrong.");
      setAppState(AppState.ONBOARDING_DETAILS);
    }
  };

  const finalizeSelection = async () => {
    if (!user) return;
    try {
      const routinePayload = {
        user_id: user.id,
        time: 'AM',
        days: ['All'],
        products: selectedProducts.map(p => ({
          type: p.type,
          brand: p.brand,
          name: p.name,
          id: p.id,
          photo_url: p.photo_url || null
        }))
      };

      const { error: routineError } = await supabase
        .from('routines')
        .insert(routinePayload);

      if (routineError) {
        console.error('FAILED CALL:', { table: 'routines', action: 'INSERT', errorCode: routineError.code, message: routineError.message, details: routineError.details, hint: routineError.hint }); 
        throw routineError;
      }

      // Refresh routines immediately
      const { data: updatedRoutines } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: true });
      if (updatedRoutines) setRoutines(updatedRoutines);

      const userPayload = { onboarding_complete: true };
      const { error: userError } = await supabase
        .from('users')
        .update(userPayload)
        .eq('id', user.id);
      
      if (userError) {
        console.error('FAILED CALL:', { table: 'users', action: 'UPDATE', errorCode: userError.code, message: userError.message, details: userError.details, hint: userError.hint }); 
        throw userError;
      }

      setAppState(AppState.DASHBOARD);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveRoutine = async () => {
    setRoutineFormError(null);
    setIsSavingRoutineForm(true);
    if (!user) {
      console.error('No user found');
      setRoutineFormError('No user found');
      setIsSavingRoutineForm(false);
      return;
    }
    
    try {
      let processedProducts: any[] = [];
      if (modalMode === 'reminder') {
          const { error } = await supabase.from('routines').update({ reminder: reminderTime }).eq('id', reminderRoutine.id);
          if (error) throw error;
      } else {
          processedProducts = await Promise.all(routineSelectedProducts.map(async p => {
            let productData: any = {
              id: p.id,
              brand: p.brand || p.Brand,
              name: p.name || p.ProductName || p.Name,
              type: p.type || p.Type || 'Custom',
              photo_url: p.photo_url || p.PhotoUrl || p.photoUrl || null
            };

            // Fix category mapping based on product_scores.cat2 and cat3
            const { data: scoreData } = await supabase
              .from('product_scores')
              .select('cat2, cat3')
              .eq('product_id', p.id)
              .maybeSingle();

            if (scoreData) {
              if (scoreData.cat2) {
                productData.cat2 = scoreData.cat2;
              }
              if (scoreData.cat3) {
                const foundMapping = Object.values(CAT3_MAPPING)
                  .flat()
                  .find(item => item.id === scoreData.cat3);
                if (foundMapping) {
                  productData.type = foundMapping.name;
                }
              }
            }

            if (p.tempId) {
              const { data, error } = await supabase
                .from('products')
                .insert({
                  brand: p.brand,
                  name: p.name,
                  type: p.type,
                  user_add: true,
                  user_id: user.id
                })
                .select()
                .single();
              if (error) throw error;
              productData.id = data.id;
              productData.brand = data.brand;
              productData.name = data.name;
              productData.type = data.type;
              productData.photo_url = data.photo_url || null;
            }

            // Ensure routine product exists in tracker
            const { data: existing } = await supabase
              .from('tracker')
              .select('id')
              .eq('user_id', user.id)
              .eq('brand', productData.brand || '')
              .eq('product_name', productData.name || '')
              .eq('routine_time', routineTime)
              .maybeSingle();

            if (!existing) {
                await supabase.from('tracker').insert({
                    user_id: user.id,
                    brand: productData.brand,
                    product_name: productData.name,
                    product_type: productData.type,
                    routine_time: routineTime,
                    in_use: true,
                    photo_url: productData.photo_url || null,
                    product_id: productData.id || null
                });
            }

            return productData;
          }));

          const payload = {
            user_id: user.id,
            time: routineTime,
            days: routineDays,
            routine_name: routineName,
            notes: routineNotes,
            products: processedProducts
          };
          if (modalMode === 'edit') {
            const { error } = await supabase.from('routines').update(payload).eq('id', editingRoutine.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('routines').insert(payload);
            if (error) throw error;
          }
      }
      // ... continue with success logic

      // Refresh routines immediately
      const { data: updatedRoutines } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: true });
      if (updatedRoutines) setRoutines(updatedRoutines);

      // Check products against UPP table
      for (const product of processedProducts) {
        const { data: existingUpp } = await supabase
          .from('upp')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_brand', product.brand)
          .eq('product_name', product.name)
          .single();

        if (!existingUpp) {
          // Trigger product comparison flow - DISABLED as requested
          // setSelectedProductForUPP(product);
          // setIsComparisonModalOpen(true);
        }
      }

      
      fetchTrackerData();
      setIsAddingRoutine(false);
      setRoutineTime('AM');
      setRoutineDays([]);
      setRoutineSelectedProducts([]);
      setRoutineName('');
      setRoutineNotes('');
      setEditingRoutine(null);
      setReminderRoutine(null);
      setReminderTime('');
      setModalMode('new');
      setRoutineFormError(null);
      setIsSavingRoutineForm(false);
    } catch (e) {
      console.error("error saving routine", e);
      setRoutineFormError(`Error saving routine: ${formatSupabaseError(e)}`);
      setIsSavingRoutineForm(false);
    }
  };

  const handleToggleTrackerRoutine = async (products: any[], routineTime: string, checked: boolean) => {
    if (!user) return;
    
    if (checked) {
        await handleAddToTracker(products, routineTime);
    } else {
        for (const p of products) {
            const name = p.name || p.ProductName || p.Name;
            const brand = p.brand || p.Brand;
            
            await supabase
                .from('tracker')
                .delete()
                .eq('user_id', user.id)
                .eq('routine_time', routineTime)
                .eq('brand', brand)
                .eq('product_name', name);
        }
        fetchTrackerData();
    }
  };

  const handleAddToTracker = async (products: any[], routineTime: string) => {
    if (!user) return;
    
    for (const p of products) {
        const productData = {
          brand: p.brand || p.Brand,
          name: p.name || p.ProductName || p.Name,
          type: p.type || p.Type || 'Custom',
          id: p.id || p.product_id || p.productId || null,
          photo_url: p.photo_url || p.PhotoUrl || p.photoUrl || null
        };

        const { data: existing } = await supabase
          .from('tracker')
          .select('id')
          .eq('user_id', user.id)
          .eq('brand', productData.brand || '')
          .eq('product_name', productData.name || '')
          .eq('routine_time', routineTime)
          .maybeSingle();

        if (!existing) {
            await supabase.from('tracker').insert({
                user_id: user.id,
                brand: productData.brand,
                product_name: productData.name,
                product_type: productData.type,
                routine_time: routineTime,
                in_use: true,
                photo_url: productData.photo_url || null,
                product_id: productData.id || null
            });
        }
    }
    fetchTrackerData();
  };

  const handleDeleteFromTracker = async (id: string) => {
    if (!user) return;
    await supabase.from('tracker').delete().eq('id', id);
    fetchTrackerData();
  };

  const toggleProduct = (p: any) => {
    setSelectedProducts(prev => {
      const sameType = prev.find(item => item.type === p.type);
      if (sameType) {
        return prev.map(item => item.type === p.type ? p : item);
      }
      return [...prev, p];
    });
  };

  const handleSaveUPP = async () => {
    if (!user || !selectedProductForUPP) {
       return;
    }

    try {
      // 1. Always insert the product
      let initialScore = 5.0; // Default: 'Was OK'
      if (uppImpression === 'Loved it') initialScore = 8.0;
      else if (uppImpression === 'Not for me') initialScore = 2.0;

       const { data: newProductEntry, error: insertError } = await supabase.from('upp').insert({
        user_id: user.id,
        product_name: selectedProductForUPP.name || selectedProductForUPP.Name || selectedProductForUPP.ProductName || selectedProductForUPP['Product Name'],
        product_brand: selectedProductForUPP.brand || selectedProductForUPP.Brand,
        type: selectedProductForUPP.type || selectedProductForUPP.Type || selectedProductForUPP['Product Type'] || 'Custom',
        category: uppCategories.join(', '),
        impression: uppCategories.some(cat => cat.includes('Used')) ? uppImpression : null,
        personal_score: uppCategories.some(cat => cat.includes('Used')) ? initialScore : null,
        notes: uppNotes,
        length: uppLength,
        frequency: uppFrequency
      }).select().single();

      if (insertError) throw insertError;

      // 2. Refresh userProducts immediately to ensure the latest Supabase calculations are reflected
      const { data: updatedProducts, error: refreshError } = await supabase.from('upp').select('*').eq('user_id', user.id);
      
      if (updatedProducts) setUserProducts(updatedProducts);

      // 3. Check if user already has other 'Used' products
      const { data: existingProducts, error: checkError } = await supabase
        .from('upp')
        .select('id, type')
        .eq('user_id', user.id)
        .eq('category', 'Used')
        .neq('id', newProductEntry.id);
      
      if (checkError) throw checkError;

      if (existingProducts && existingProducts.some(p => p.type === newProductEntry.type)) {
        // Trigger Comparison Flow, passing the new product
        setNewProductForComparison(newProductEntry);
        setIsComparisonModalOpen(true);
      }

      setSelectedProductForUPP(null);
      setUppNotes('');
      setUppLength('');
      setUppFrequency('');
      setUppCategories([]);
      setUppImpression('Loved it');
    } catch (e) {
      console.error('Error in handleSaveUPP:', e);
      setError(`Error saving product to UPP: ${formatSupabaseError(e)}`);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-[#FAF9F6] to-[#F3F2EE] space-y-4">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-venus-accent border-t-transparent rounded-full" />
      <button onClick={() => setLoading(false)} className="text-xs font-black uppercase tracking-widest hover:opacity-50">Skip Loading</button>
    </div>
  );

  return (
    <>
      <ProductCard />
      <div className="min-h-screen font-sans text-venus-warm relative overflow-x-hidden bg-[#FFFFFF]">
        <GlowingBackground appState={appState} />
        {/* Product Detail Modal */}
        {selectedProductForDetail && (
          <ProductDetailModalNew
            product={selectedProductForDetail} 
            onClose={() => setSelectedProductForDetail(null)} 
          />
        )}
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="fixed inset-y-0 left-0 w-64 bg-white z-[60] shadow-2xl p-6 flex flex-col gap-6"
          >
            <div className="flex justify-between items-center">
                <span className="font-bubble text-3xl text-black font-medium cursor-pointer" onClick={() => { setAppState(AppState.LANDING); setIsMobileNavOpen(false); }}>Canonic</span>
                <button onClick={() => setIsMobileNavOpen(false)}><X /></button>
            </div>
            {/* Navigation items moved from footer */}
            <div className="flex flex-col gap-4">
              <button onClick={() => { setAppState(AppState.DASHBOARD); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.DASHBOARD ? 'text-black font-black' : 'text-black/60'}`}>
                <FlaskConical className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Home</span>
              </button>
              {user && (
                <button onClick={() => { setAppState(AppState.PROGRESS); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.PROGRESS ? 'text-black font-black' : 'text-black/60'}`}>
                  <Newspaper className="w-6 h-6" />
                  <span className="text-sm uppercase tracking-widest font-black">Progress</span>
                </button>
              )}
              {user && (
                <button onClick={() => { setAppState(AppState.TRACKER); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.TRACKER ? 'text-black font-black' : 'text-black/60'}`}>
                  <CheckSquare className="w-6 h-6" />
                  <span className="text-sm uppercase tracking-widest font-black">Tracker</span>
                </button>
              )}
              <button onClick={() => { setAppState(AppState.RANK); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.RANK ? 'text-black font-black' : 'text-black/60'}`}>
                <ShoppingBag className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Products</span>
              </button>

              <button onClick={() => { setAppState(AppState.SOCIAL); setIsFollowsOpen(false); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.SOCIAL && !isFollowsOpen ? 'text-black font-black' : 'text-black/60'}`}>
                <Heart className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Blog</span>
              </button>
              {user && (
                <button onClick={() => { setAppState(AppState.SOCIAL); setIsFollowsOpen(true); setSocialTab('Messages'); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.SOCIAL && isFollowsOpen ? 'text-black font-black' : 'text-black/60'}`}>
                  <MessageCircle className="w-6 h-6" />
                  <span className="text-sm uppercase tracking-widest font-black">Messages</span>
                </button>
              )}
              {user && (
                <button onClick={() => { setAppState(AppState.PROFILE); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.PROFILE ? 'text-black font-black' : 'text-black/60'}`}>
                  <UserIcon className="w-6 h-6" />
                  <span className="text-sm uppercase tracking-widest font-black">Profile</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-black/5 relative">
        <div className="flex justify-between items-center px-4 py-1.5 md:py-3 gap-3 md:gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="p-1 cursor-pointer">
              <Menu className="w-5 h-5 text-black" />
            </button>
          </div>

          <div ref={headerSearchContainerRef} className="flex-1 max-w-md mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-black/40 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Search products..."
                className="w-full bg-white border border-black/10 py-1.5 px-3 pl-8 pr-8 md:py-2 md:pl-10 md:pr-8 rounded-lg text-[10px] md:text-xs font-black uppercase text-black placeholder:text-black/40 outline-none focus:border-black/30 transition-colors"
                value={headerSearchQuery}
                onChange={(e) => {
                  setHeaderSearchQuery(e.target.value);
                  if (!isHeaderSearchDropdownOpen) setIsHeaderSearchDropdownOpen(true);
                }}
                onFocus={() => setIsHeaderSearchDropdownOpen(true)}
              />
              {headerSearchQuery && (
                <button 
                  onClick={() => resetHeaderSearchState()}
                  className="absolute right-2.5 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full hover:bg-black/5 text-black/40 hover:text-black transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!user ? (
              <>
                <button 
                  onClick={() => { resetHeaderSearchState(); setIsSignUp(false); setAppState(AppState.AUTH); }}
                  className="text-xs md:text-sm font-black uppercase tracking-widest text-black/60 hover:text-black transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { resetHeaderSearchState(); setIsSignUp(true); setAppState(AppState.AUTH); }}
                  className="bg-black text-white text-xs md:text-sm font-black uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-venus-accent transition-colors cursor-pointer"
                >
                  Join
                </button>
              </>
            ) : (
               null
            )}
          </div>
        </div>

        {/* Full-width Search Results Dropdown */}
        {isHeaderSearchDropdownOpen && headerSearchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 w-full bg-white/95 backdrop-blur-md border-b border-black/10 shadow-2xl overflow-hidden z-[100] max-h-[70vh] overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-3">
              {isHeaderSearching ? (
                <div className="p-6 text-center text-xs text-black/50 uppercase tracking-widest font-black flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-venus-accent" />
                  <span>Searching products...</span>
                </div>
              ) : headerSearchResults.length > 0 ? (
                <div className="flex flex-col divide-y divide-black/5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-black/40 px-3 py-1.5 flex justify-between items-center">
                    <span>Search Results ({headerSearchResults.length})</span>
                    <button 
                      onClick={() => resetHeaderSearchState()}
                      className="hover:text-black transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  {headerSearchResults.map(product => (
                     <button 
                       key={product.id}
                       onClick={() => {
                         const prodId = String(product.id);
                         openProductCard(prodId);
                         setTimeout(() => {
                           resetHeaderSearchState();
                         }, 50);
                       }}
                       className="flex items-center p-3.5 hover:bg-black/5 transition-colors text-left gap-4 group cursor-pointer w-full"
                     >
                       {product.photo_url ? (
                         <img src={product.photo_url} alt={product.name} referrerPolicy="no-referrer" className="w-12 h-12 object-cover rounded-xl shrink-0 border border-black/5 group-hover:scale-105 transition-transform" />
                       ) : (
                         <div className="w-12 h-12 bg-black/5 rounded-xl flex items-center justify-center shrink-0 border border-black/5">
                           <ShoppingBag className="w-5 h-5 text-black/20" />
                         </div>
                       )}
                       <div className="flex-1 min-w-0 pr-2">
                         <div className="text-[10px] md:text-xs font-black uppercase tracking-wider text-venus-accent whitespace-normal break-words">
                           {product.brand}
                         </div>
                         <div className="text-xs md:text-sm font-bold text-black leading-snug whitespace-normal break-words mt-0.5">
                           {product.name}
                         </div>
                         {product.type && (
                           <div className="text-[10px] text-black/40 font-semibold uppercase tracking-wider mt-1">
                             {product.type}
                           </div>
                         )}
                       </div>
                       <ChevronRight className="w-4 h-4 text-black/30 group-hover:text-black group-hover:translate-x-0.5 transition-all shrink-0" />
                     </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-black/50 uppercase tracking-widest font-black">
                  No matching products found for "{headerSearchQuery}"
                </div>
              )}
            </div>
          </div>
        )}
      </header>
      
      <main className={`pt-4 md:pt-6 ${appState === AppState.ONBOARDING_DETAILS ? 'pb-4 h-[calc(100dvh-5rem)] md:h-auto bg-transparent' : 'pb-24'} px-4 md:px-6 mx-auto ${(appState === AppState.TRACKER || appState === AppState.SOCIAL) ? 'max-w-none' : 'max-w-4xl'}`}>
        <AnimatePresence mode="wait">
          
          {appState === AppState.AUTH && (
            <Login 
              isSignUp={isSignUp}
              setIsSignUp={setIsSignUp}
              onSuccess={() => setAppState(AppState.DASHBOARD)}
              onError={(err) => setError(err)}
            />
          )}

          {appState === AppState.SOCIAL && (
            <motion.div 
              key="social"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full"
            >
              <Social 
                isFollowsOpen={isFollowsOpen}
                setIsFollowsOpen={setIsFollowsOpen}
                socialTab={socialTab}
                setSocialTab={setSocialTab}
                activeMainTab={socialActiveMainTab}
                setActiveMainTab={setSocialActiveMainTab}
              />
            </motion.div>
          )}

          {appState === AppState.PRODUCT_PAGE && selectedProductForPage && (
            <motion.div 
              key="product_page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center"
            >
              <ProductCardContent 
                productId={String(selectedProductForPage.id)}
                onClose={() => setAppState(AppState.DASHBOARD)} 
              />
            </motion.div>
          )}

          {/* LANDING */}
          {appState === AppState.LANDING && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50 }}
              // className="text-center flex flex-col items-center justify-center h-screen w-screen fixed inset-0 z-0 bg-[url('https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Screenshot%202026-06-22%20131144.png')] bg-cover bg-center px-6"
              className="text-center flex flex-col items-center justify-center h-screen w-screen fixed inset-0 z-0 bg-[url('https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Screenshot%202026-06-22%20131144.png')] bg-cover bg-center md:bg-top md:bg-white/40 md:bg-blend-overlay px-6"
            >
              <div className="flex flex-col items-center gap-2 mb-2 relative -top-32 md:-top-24">
                <h1 className="text-6xl md:text-8xl font-cursive font-bold leading-[0.8] text-venus-pink tracking-normal">
                  Canonic
                </h1>
                <p className="text-2xl md:text-3xl font-cursive font-bold text-venus-pink tracking-normal">
                  Beauty, Smarter
                </p>
              </div>
              <button 
                onClick={() => setAppState(AppState.ONBOARDING_DETAILS)}
                className="mb-12 max-w-xl mx-auto relative -top-28 md:-top-24 flex items-center justify-center"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="flex items-center gap-2 text-black text-2xl font-medium opacity-70"
                >
                  Take skin quiz
                  <ChevronRight className="w-6 h-6" />
                </motion.div>
              </button>
              <button 
                onClick={() => landingFileInputRef.current?.click()}
                className="p-5 bg-white/60 backdrop-blur-md border border-black/10 text-black hover:bg-white/90 active:scale-95 rounded-full font-black transition-all shadow-xl flex items-center justify-center mx-auto relative top-48 md:-top-24"
              >
                <Camera className="w-7 h-7 text-black" />
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

            </motion.div>
          )}

          {/* ONBOARDING: DETAILS */}
          {appState === AppState.ONBOARDING_DETAILS && (
            <ChatQuestionnaire onComplete={handleQuestionnaireComplete} />
          )}

          {/* CURATED SELECTION */}
          {appState === AppState.CURATED_SELECTION && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-12 pb-12"
            >
              <header className="text-center space-y-4">
                <h2 className="text-5xl font-sans font-black text-black uppercase tracking-tighter">Curated Selection</h2>
                <div className="bg-black inline-block px-6 py-2 rounded-lg">
                  <span className="text-white text-xs font-black uppercase tracking-widest">Ritual 01-A</span>
                </div>
              </header>

              <div className="space-y-10">
                <h3 className="text-3xl font-sans font-black text-center text-black uppercase tracking-tight underline decoration-venus-accent decoration-4">Your Daily Ritual</h3>
                {defaultRitualSteps.map((rec, idx) => {
                  const options = INVENTORY.filter(p => p.type.toLowerCase() === rec.type.toLowerCase() || rec.type.toLowerCase().includes(p.type.toLowerCase()));
                  const selection = selectedProducts.find(p => p.type.toLowerCase() === rec.type.toLowerCase() || rec.type.toLowerCase().includes(p.type.toLowerCase()));
                  
                  return (
                    <div key={idx} className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-black text-xl">
                          0{idx + 1}
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-black uppercase tracking-tight">{rec.type}</h4>
                          <p className="text-sm font-medium text-black/50 italic">{rec.benefits}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {options.map(opt => (
                          <button 
                            key={opt.id}
                            onClick={() => toggleProduct(opt)}
                            className={`p-6 clean-card text-left transition-all relative border-2 ${selection?.id === opt.id ? 'border-black bg-black/5' : 'border-black/5 hover:border-black/20'}`}
                          >
                            {selection?.id === opt.id && <CheckCircle2 className="absolute top-4 right-4 text-black" />}
                            <p className="text-[10px] uppercase tracking-widest text-venus-accent mb-1 font-black">{opt.brand}</p>
                            <h5 className="text-lg font-black mb-2 text-black leading-tight">{opt.name}</h5>
                            <p className="text-sm font-medium text-black/60 mb-4 line-clamp-2">{opt.description}</p>
                            <div className="flex justify-between items-center">
                              <span className="font-black text-black">${opt.price}</span>
                              <div className="flex gap-1">
                                {opt.ingredients.slice(0, 1).map(i => (
                                  <span key={i} className="text-[9px] bg-black text-white px-2 py-1 rounded font-black uppercase tracking-tighter">{i}</span>
                                ))}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedProducts.length >= 2 && (
                <div className="flex justify-center pt-8">
                  <button 
                    onClick={finalizeSelection}
                    className="btn-primary flex items-center gap-2 group"
                  >
                    Confirm Routine
                    <ShoppingBag className="w-5 h-5 transition-transform group-hover:scale-110" />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* DASHBOARD */}
          {appState === AppState.DASHBOARD && (
            selectedInspirationCategory ? (
              <motion.div
                key="inspiration-results"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 pb-12 text-[80%]"
              >
                {/* Back button and title */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black">
                      {selectedInspirationCategory === 'Moisturiser' ? 'Moisturisers' : 
                                   selectedInspirationCategory === 'Treatment' ? 'Serums' : 
                                   selectedInspirationCategory === 'Cleanser' ? 'Cleansers' : 'Sunscreens'}
                    </h2>
                    <button
                      onClick={() => setSelectedInspirationCategory(null)}
                      className="p-1.5 rounded-full hover:bg-black/5 text-black/40 hover:text-black transition-all flex items-center justify-center cursor-pointer"
                      title="Go back"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (selectedInspirationCategory) {
                        handleSelectInspiration(selectedInspirationCategory, true);
                      }
                    }}
                    disabled={isSortingProducts}
                    className="px-3 py-1.5 border border-black/15 hover:border-black hover:bg-black hover:text-white disabled:opacity-50 transition-all rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Force a fresh re-calculation by clearing current sessionStorage cache"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSortingProducts ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] md:text-xs text-black/40 font-bold uppercase tracking-wider">
                    Suggestions made based on your declared skin type & needs ⭐ Not medical advice.
                  </p>
                </div>

                {/* Subcategory (Cat3) Filters */}
                {selectedInspirationCategory && CAT3_MAPPING[selectedInspirationCategory] && (
                  <div className="flex flex-wrap gap-2 pb-2">
                    {CAT3_MAPPING[selectedInspirationCategory].map(cat => {
                      const isActive = selectedCat3 === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            const newCat3 = isActive ? null : cat.id;
                            setSelectedCat3(newCat3);
                            handleSelectInspiration(selectedInspirationCategory, false, 1, newCat3);
                          }}
                          className={`px-4 py-2 rounded-full border text-xs font-bold whitespace-nowrap transition-all ${
                            isActive
                              ? 'bg-black text-white border-black shadow-md'
                              : 'bg-white text-black border-black/10 hover:border-black/30'
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                )}


                {/* Alerts/Warnings generated by productSort */}
                {sortedProductsResult?.alerts && sortedProductsResult.alerts.filter((alert: string) => 
                  !alert.includes('night due to UV sensitivity') && 
                  !alert.includes('trigger yeast sensitivity')
                ).length > 0 && (
                  <div className="space-y-2">
                    {sortedProductsResult.alerts
                      .filter((alert: string) => 
                        !alert.includes('night due to UV sensitivity') && 
                        !alert.includes('trigger yeast sensitivity')
                      )
                      .map((alert: string, idx: number) => (
                        <div key={idx} className="p-3 bg-rose-50 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-wider border border-rose-100 flex items-center gap-2 animate-pulse text-left">
                          <Sparkles className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{alert}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Loading / Error / Results */}
                {isSortingProducts ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 bg-white/50 rounded-2xl border-2 border-black/5">
                    <Loader2 className="w-8 h-8 animate-spin text-venus-accent" />
                    <div className="text-center">
                      <p className="text-xs font-black uppercase tracking-wider text-black">Running productSort Algorithm...</p>
                      <p className="text-[9px] text-black/50 mt-1 font-mono">Analyzing database and skin compatibility</p>
                    </div>
                  </div>
                ) : sortingError ? (
                  <div className="py-10 px-5 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-center space-y-3">
                    <p className="text-xs font-bold">{sortingError}</p>
                    <button
                      onClick={() => handleSelectInspiration(selectedInspirationCategory)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all cursor-pointer"
                    >
                      Retry Sorting
                    </button>
                  </div>
                ) : (!sortedProductsResult?.products?.length && !sortedProductsResult?.locked_products?.length && !sortedProductsResult?.prescriptions?.length) ? (
                  <div className="py-12 text-center bg-white/50 rounded-2xl border border-black/5 flex flex-col items-center justify-center gap-3">
                    <ShoppingBag className="w-10 h-10 text-black/10" />
                    <p className="text-black/40 text-xs font-black uppercase tracking-widest">No compatible products found in this category.</p>
                  </div>
                ) : (
                  (() => {
                    const regularProducts = sortedProductsResult.products || [];
                    const prescriptionProducts = sortedProductsResult.prescriptions || [];

                    return (
                      <div className="space-y-8">
                        {/* SECTION 1 — regular products */}
                        {regularProducts.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {regularProducts.map((p: any) => {
                              const product = p;
                              return (
                                <div
                                  key={product.product_id}
                                  onClick={() => openProductCard(String(product.product_id))}
                                  className="cursor-pointer clean-card p-2 border border-black/5 bg-white hover:border-black transition-all flex flex-col items-center gap-1 shadow-sm group text-center"
                                >
                                  {product.photo_url ? (
                                    <img
                                      src={product.photo_url}
                                      alt={product.name}
                                      referrerPolicy="no-referrer"
                                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-black/5 flex-shrink-0 group-hover:scale-105 transition-transform duration-300"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/5 rounded-lg border border-black/5 flex items-center justify-center flex-shrink-0 text-[8px] text-black/40 text-center font-mono leading-tight">
                                      No Image
                                    </div>
                                  )}
                                  <div className="min-w-0 w-full">
                                    <span className="text-[8px] uppercase font-black tracking-widest text-venus-accent block mb-0.5">
                                      {product.brand || 'Unknown'}
                                    </span>
                                    <h4 className="text-[10px] md:text-xs font-bold text-black uppercase leading-tight line-clamp-2">
                                      {product.name || 'Unnamed'}
                                    </h4>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* SECTION 2 — locked products */}
                        {sortedProductsResult.locked_products && sortedProductsResult.locked_products.length > 0 && (
                          <div className="space-y-6">
                            <div className="mt-8 pt-6 border-t border-black/5 text-left">
                              <h3 className="text-xs font-black uppercase tracking-tight text-black italic">
                                Unlocked Once Barrier Recovers
                              </h3>
                              <p className="text-[10px] text-black/50 font-medium mt-1">
                                These target your concerns but contain actives paused while your skin barrier heals.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {sortedProductsResult.locked_products.map((p: any) => {
                                const product = p;
                                return (
                                  <div
                                    key={product.product_id}
                                    onClick={() => openProductCard(String(product.product_id))}
                                    className="relative cursor-pointer clean-card p-2 border border-black/5 bg-white hover:border-black transition-all flex flex-col items-center gap-1 shadow-sm group text-center opacity-70 hover:opacity-100 grayscale hover:grayscale-0"
                                  >
                                    <span className="absolute top-1 left-1 text-[8px] font-black bg-gray-200 text-gray-700 px-1 py-0.5 rounded uppercase tracking-wider z-10 flex items-center gap-0.5">
                                      <Shield className="w-2.5 h-2.5" /> Locked
                                    </span>
                                    {product.photo_url ? (
                                      <img
                                        src={product.photo_url}
                                        alt={product.name}
                                        referrerPolicy="no-referrer"
                                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-black/5 flex-shrink-0 group-hover:scale-105 transition-transform duration-300"
                                      />
                                    ) : (
                                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/5 rounded-lg border border-black/5 flex items-center justify-center flex-shrink-0 text-[8px] text-black/40 text-center font-mono leading-tight">
                                        No Image
                                      </div>
                                    )}
                                    <div className="min-w-0 w-full">
                                      <span className="text-[8px] uppercase font-black tracking-widest text-venus-accent block mb-0.5">
                                        {product.brand || 'Unknown'}
                                      </span>
                                      <h4 className="text-[10px] md:text-xs font-bold text-black uppercase leading-tight line-clamp-2">
                                        {product.name || 'Unnamed'}
                                      </h4>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* SECTION 2 — prescription products */}
                        {prescriptionProducts.length > 0 && (
                          <div className="space-y-6">
                            <div className="mt-8 pt-6 border-t border-black/5 text-left">
                              <h3 className="text-xs font-black uppercase tracking-tight text-black italic">
                                Prescription Only
                              </h3>
                              <p className="text-[10px] text-black/50 font-medium mt-1">
                                These products require a prescription. Consult a dermatologist.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {prescriptionProducts.map((p: any) => {
                                const product = p;
                                return (
                                  <div
                                    key={product.product_id}
                                    onClick={() => openProductCard(String(product.product_id))}
                                    className="relative cursor-pointer clean-card p-2 border border-black/5 bg-white hover:border-black transition-all flex flex-col items-center gap-1 shadow-sm group text-center"
                                  >
                                    <span className="absolute top-1 right-1 text-[8px] font-black bg-rose-100 text-rose-700 px-1 py-0.5 rounded uppercase tracking-wider z-10">
                                      Rx
                                    </span>
                                    {product.photo_url ? (
                                      <img
                                        src={product.photo_url}
                                        alt={product.name}
                                        referrerPolicy="no-referrer"
                                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-black/5 flex-shrink-0 group-hover:scale-105 transition-transform duration-300"
                                      />
                                    ) : (
                                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/5 rounded-lg border border-black/5 flex items-center justify-center flex-shrink-0 text-[8px] text-black/40 text-center font-mono leading-tight">
                                        No Image
                                      </div>
                                    )}
                                    <div className="min-w-0 w-full">
                                      <span className="text-[8px] uppercase font-black tracking-widest text-venus-accent block mb-0.5">
                                        {product.brand || 'Unknown'}
                                      </span>
                                      <h4 className="text-[10px] md:text-xs font-bold text-black uppercase leading-tight line-clamp-2">
                                        {product.name || 'Unnamed'}
                                      </h4>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* LOAD MORE BUTTON */}
                        {sortedProductsResult?.meta?.itemsReturned === 30 && (
                          <div className="flex justify-center mt-8">
                            <button
                              onClick={() => handleSelectInspiration(selectedInspirationCategory!, false, (sortedProductsResult.meta.currentPage || 1) + 1)}
                              disabled={isLoadingMoreProducts}
                              className="px-6 py-3 bg-black text-white hover:bg-venus-accent transition-all rounded-lg text-[10px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                              {isLoadingMoreProducts ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Loading...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Load More
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2 text-[80%]"
              >
              
                {/* For you Section */}
                <div className="space-y-4 text-left mb-10 mt-2">
                  <div>
                    <h3 className="text-xl md:text-2xl uppercase tracking-tight text-black" style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}>
                      For you
                    </h3>
                    <p className="text-xs text-black/50 font-medium mt-1">
                      Explore products chosen for your skin type and goals
                    </p>
                  </div>
                  
                  <div className="flex flex-nowrap gap-4 overflow-x-auto pb-4 pt-1 no-scrollbar scroll-smooth snap-x snap-mandatory">
                    {[
                      { key: 'Moisturiser', title: 'Moisturisers', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/moisturiser.jpg' },
                      { key: 'Treatment', title: 'Serums', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/serum.jpg' },
                      { key: 'Cleanser', title: 'Cleansers', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/cleanse.jpg' },
                      { key: 'SPF', title: 'Sunscreen', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/sunscreen.jpg' },
                      { key: 'Glass skin essentials', title: 'Glass skin', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/glass.jpg' },
                      { key: 'Soothe sensitive skin', title: 'Sensitivity', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/sensitive.jpg' },
                      { key: 'Barrier repair', title: 'Barrier repair', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/barrier.jpg' },
                      { key: 'Anti-aging', title: 'Anti-aging', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/age.jpg' },
                    ].map((cat, idx) => (
                      <motion.div
                        key={idx}
                        whileHover={{ y: -2, scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleSelectInspiration(cat.key)}
                        className="snap-start shrink-0 flex flex-col items-center cursor-pointer group w-24 sm:w-28 md:w-32"
                      >
                        <div 
                          className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full bg-cover bg-center border-2 border-black/10 group-hover:border-black transition-all shadow-sm overflow-hidden"
                          style={{ backgroundImage: `url('${cat.img}')` }}
                        />
                        <span className="text-[10px] md:text-xs font-black text-black uppercase tracking-tight mt-2 text-center whitespace-normal leading-tight px-0.5 w-full">
                          {cat.title}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Routine Card */}
                <div className="space-y-4 md:space-y-6">
                  <div className="flex items-center justify-between md:border-0 md:pb-0">
                    <div className="flex items-center gap-2 text-black">
                      <h3 className="text-lg md:text-xl uppercase tracking-tight text-black" style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}>My routines</h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={handleAddRoutine}
                        className="text-xs uppercase tracking-widest text-black font-black hover:opacity-70 transition-opacity flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden md:inline">New Routine</span>
                      </button>
                      <button 
                        onClick={() => dashboardFileInputRef.current?.click()}
                        disabled={isDashboardScanning}
                        className="text-xs uppercase tracking-widest text-black font-black hover:opacity-70 transition-opacity flex items-center gap-2"
                      >
                        {isDashboardScanning ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Camera className="w-4 h-4" />
                        )}
                        <span className="hidden md:inline">Scan Product</span>
                      </button>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={dashboardFileInputRef}
                      onChange={handleDashboardPhotoScan}
                      className="hidden"
                    />
                  </div>
                  
                  {dashboardScanError && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border-2 border-red-500/15">
                      {dashboardScanError}
                    </div>
                  )}
                  <div className="space-y-8">
                    {routines.length === 0 ? (
                      <div className="py-12 clean-card flex flex-col items-center justify-center border-dashed border-2 border-black/5 bg-white/50">
                        <p className="text-black/50 text-sm font-black uppercase tracking-widest">No routine added yet</p>
                      </div>
                    ) : (
                      routines.map((rt: any, rIdx: number) => (
                        <div key={rIdx} className="clean-card p-4 border-2 border-black/5 bg-venus-accent/[0.06] relative group flex flex-col gap-2">
                          {/* Header row: Number, Routine Name + Actions - Clickable to toggle */}
                          <div className="flex items-start gap-4 cursor-pointer" onClick={() => {
                              toggleRoutineExpansion(rIdx);
                            }}>
                              {/* Routine Name and Metadata */}
                              <div className="flex-1 min-w-0">
                                  {rt.routine_name && (
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black bg-venus-accent/20 text-venus-accent px-1.5 py-0.5 rounded uppercase">{rt.time || 'AM'}</span>
                                        <h4 className="font-black text-black uppercase text-sm md:text-base tracking-tight pt-1 truncate">
                                          {rt.routine_name}
                                        </h4>
                                      </div>
                                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${
                                        (() => {
                                          const score = routineChecks[rt.id || String(rIdx)]?.routine_score;
                                          if (score === undefined) return 'bg-black/5 text-black/50 animate-pulse';
                                          if (score >= 80) return 'bg-green-100 text-green-800 border border-green-200';
                                          if (score >= 50) return 'bg-amber-100 text-amber-800 border border-amber-200';
                                          return 'bg-red-100 text-red-800 border border-red-200';
                                        })()
                                      }`}>
                                        {routineChecks[rt.id || String(rIdx)] !== undefined 
                                          ? `${routineChecks[rt.id || String(rIdx)].routine_score}/100` 
                                          : '...'}
                                      </span>
                                    </div>
                                  )}
                                  {/* Day */}
                                  <div className="mt-0.5">
                                     <span className="text-[9px] uppercase font-bold tracking-widest text-black/40 truncate">{(rt.days || []).join(', ')}</span>
                                  </div>
                              </div>
                          </div>

                          {/* Products - Routine Items */}
                          {expandedRoutines.includes(rIdx) && (
                            <div className="space-y-2 pt-2 border-t border-black/5">
                                {getActiveRoutineProducts(rt.products, rt.time).map((p: any, i: number) => (
                                    <div key={i} className="flex flex-col gap-0.5 text-xs border-b border-black/5 pb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="uppercase font-black tracking-widest text-venus-accent">{p.type}</span>
                                            <span className="font-bold text-black/80">{p.brand}</span>
                                        </div>
                                        <ProductLink 
                                             productId={p.id} 
                                             productName={p.name} 
                                             className="text-black/60 hover:text-venus-accent transition-colors text-left" 
                                         />
                                    </div>
                                ))}

                                {/* Routine Check Analysis Section */}
                                {(() => {
                                  const check = routineChecks[rt.id || String(rIdx)];
                                  if (!check) {
                                    return (
                                      <div className="mt-4 p-4 rounded-2xl bg-black/[0.01] border border-dashed border-black/5 flex items-center justify-center text-xs text-black/40 font-bold uppercase tracking-wider animate-pulse">
                                        Calculating compatibility metrics...
                                      </div>
                                    );
                                  }

                                  const amSequence = check.recommendations?.find(r => r.startsWith("Recommended AM Layering Sequence:"));
                                  const pmSequence = check.recommendations?.find(r => r.startsWith("Recommended PM Layering Sequence:"));
                                  const otherRecommendations = (check.recommendations || []).filter(r => 
                                    !r.startsWith("Recommended AM Layering Sequence:") && 
                                    !r.startsWith("Recommended PM Layering Sequence:")
                                  );

                                  return (
                                    <div className="mt-4 p-4 rounded-2xl bg-black/[0.02] border border-black/5 space-y-4">
                                      {/* Title / Header */}
                                      <div className="flex items-center justify-between border-b border-black/5 pb-2">
                                        <div className="flex items-center gap-2">
                                          
                                          <span className="text-xs font-black uppercase tracking-wider text-black">Routine Analysis</span>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                                          check.routine_score >= 80 ? 'bg-green-100 text-green-800 border-green-200' :
                                          check.routine_score >= 50 ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                          'bg-red-100 text-red-800 border-red-200'
                                        }`}>
                                          Score: {check.routine_score}/100
                                        </span>
                                      </div>

                                      {/* Mini Dashboard */}
                                      {check.debug && (
                                        <div className="grid grid-cols-2 gap-3 bg-white border border-black/5 p-3 rounded-xl shadow-sm">
                                          <div className="space-y-0.5 text-left">
                                            <span className="text-[9px] font-black uppercase text-black/30 block tracking-wider">Skin Barrier Risk</span>
                                            <span className={`text-xs font-black uppercase ${
                                              check.debug.user_irritation_threshold === 'high' ? 'text-red-600' :
                                              check.debug.user_irritation_threshold === 'medium' ? 'text-amber-600' : 'text-green-600'
                                            }`}>
                                              {check.debug.user_irritation_threshold} Risk
                                            </span>
                                          </div>
                                          <div className="space-y-0.5 text-left">
                                            <span className="text-[9px] font-black uppercase text-black/30 block tracking-wider">Actives Budget</span>
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-black text-black">
                                                {check.debug.active_count} / {check.debug.active_budget} limit
                                              </span>
                                            </div>
                                            <div className="w-full bg-black/5 h-1.5 rounded-full overflow-hidden mt-1">
                                              <div 
                                                className={`h-full rounded-full transition-all duration-500 ${check.debug.active_count > check.debug.active_budget ? 'bg-red-500 animate-pulse' : 'bg-venus-accent'}`}
                                                style={{ width: `${Math.min(100, (check.debug.active_count / (check.debug.active_budget || 1)) * 100)}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* TIMELINE / LAYERING FLOW */}
                                      {amSequence && (
                                        <div className="bg-white border border-black/5 rounded-xl p-3 shadow-sm space-y-2 text-left">
                                          <div className="flex items-center gap-1.5 text-black">
                                            <Sun className="w-3.5 h-3.5 text-amber-500" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Recommended AM Layering</span>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            {amSequence.replace("Recommended AM Layering Sequence:", "").trim().split(" → ").map((step, sIdx) => (
                                              <React.Fragment key={sIdx}>
                                                {sIdx > 0 && <span className="text-black/30 text-xs">→</span>}
                                                <span className="bg-amber-50 text-[10px] font-bold text-amber-900 border border-amber-200/50 rounded-lg px-2 py-1 shadow-sm flex items-center gap-1">
                                                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-[8px]">{sIdx + 1}</span>
                                                  {step}
                                                </span>
                                              </React.Fragment>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {pmSequence && (
                                        <div className="bg-white border border-black/5 rounded-xl p-3 shadow-sm space-y-2 text-left">
                                          <div className="flex items-center gap-1.5 text-black">
                                            <Moon className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Recommended PM Layering</span>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            {pmSequence.replace("Recommended PM Layering Sequence:", "").trim().split(" → ").map((step, sIdx) => (
                                              <React.Fragment key={sIdx}>
                                                {sIdx > 0 && <span className="text-black/30 text-xs">→</span>}
                                                <span className="bg-indigo-50 text-[10px] font-bold text-indigo-900 border border-indigo-200/50 rounded-lg px-2 py-1 shadow-sm flex items-center gap-1">
                                                  <span className="w-3.5 h-3.5 rounded-full bg-indigo-500 text-white flex items-center justify-center font-black text-[8px]">{sIdx + 1}</span>
                                                  {step}
                                                </span>
                                              </React.Fragment>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* INSIGHTS & WARNINGS */}
                                      {otherRecommendations.length > 0 && (
                                        <div className="space-y-1.5 text-left">
                                          <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block px-1">Insights & Warnings</span>
                                          <div className="space-y-1">
                                            {otherRecommendations.map((rec, rIdx) => {
                                              const isWarning = rec.toLowerCase().includes("warning") || 
                                                                rec.toLowerCase().includes("alert") || 
                                                                rec.toLowerCase().includes("gap") || 
                                                                rec.toLowerCase().includes("shortfall") ||
                                                                rec.toLowerCase().includes("danger") ||
                                                                rec.toLowerCase().includes("risk");
                                              return (
                                                <div 
                                                  key={rIdx} 
                                                  className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs shadow-sm ${
                                                    isWarning 
                                                      ? 'bg-red-50/50 border-red-500/15 text-red-900' 
                                                      : 'bg-white border-black/5 text-black/80'
                                                  }`}
                                                >
                                                  {isWarning ? (
                                                    <Shield className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                  ) : (
                                                    <CheckCircle2 className="w-4 h-4 text-venus-accent shrink-0 mt-0.5" />
                                                  )}
                                                  <span className="font-medium leading-relaxed whitespace-pre-wrap">{rec}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}

                                      {/* RECOMMENDED ADDITIONS */}
                                      {false && check.resolved_additions && check.resolved_additions.length > 0 && (
                                        <div className="space-y-2 text-left">
                                          <span className="text-[9px] font-black uppercase tracking-wider text-black/40 block px-1">Recommended Additions</span>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                            {check.resolved_additions.map((item: any, itemIdx: number) => (
                                              <div key={itemIdx} className="bg-white border-2 border-dashed border-black/5 p-3 rounded-xl flex items-start justify-between gap-3 shadow-sm hover:border-venus-accent/20 transition-colors">
                                                <div className="space-y-1 min-w-0 flex-1">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="bg-venus-accent/10 text-venus-accent text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{item.type || 'Treatment'}</span>
                                                    <span className="font-bold text-black/80 text-xs truncate">{item.brand}</span>
                                                  </div>
                                                  <ProductLink 
                                                    productId={String(item.product_id)} 
                                                    productName={item.name} 
                                                    className="text-black/60 hover:text-venus-accent transition-colors text-[11px] block truncate font-black" 
                                                  />
                                                  <p className="text-[10px] text-black/50 leading-relaxed font-medium">{item.reason}</p>
                                                </div>
                                                <button 
                                                  onClick={() => openProductCard(Number(item.product_id))}
                                                  className="text-[9px] font-black uppercase tracking-widest bg-black text-white px-2.5 py-1.5 rounded-lg hover:bg-black/80 transition-all shrink-0 shadow-sm"
                                                >
                                                  Add
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                            </div>
                          )}
                          
                          {/* Actions */}
                          {expandedRoutines.includes(rIdx) && (
                            <div className="flex items-center gap-1 shrink-0 pt-2 border-t border-black/5 mt-1 justify-end">
                                <label className="flex items-center gap-1 p-2 hover:bg-black/5 rounded-full transition-colors cursor-pointer text-black/40 hover:text-black text-xs mr-auto">
                                    <input type="checkbox" onChange={(e) => handleToggleTrackerRoutine(rt.products, rt.time, e.target.checked)} className="form-checkbox" />
                                    <span>Add to tracker</span>
                                </label>
                                <button onClick={() => { setShareRoutine(rt); setIsSharingOpen(true); }} className='p-2 hover:bg-black/5 rounded-full transition-colors' title="Share">
                                    <Share2 className="w-4 h-4 text-black/40 hover:text-black" />
                                </button>
                                <button onClick={() => handleEditRoutine(rt)} className='p-2 hover:bg-black/5 rounded-full transition-colors' title="Edit">
                                    <Pencil className="w-4 h-4 text-black/40 hover:text-black" />
                                </button>
                                <button onClick={() => handleSetReminder(rt)} className='p-2 hover:bg-black/5 rounded-full transition-colors' title="Reminder">
                                    <AlarmClock className="w-4 h-4 text-black/40 hover:text-black" />
                                </button>
                                <button onClick={() => setRoutineToDelete(rt)} className='p-2 hover:bg-black/5 rounded-full transition-colors text-red-500/40 hover:text-red-500' title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Trending Section */}
                <div className="space-y-4 mt-12 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg md:text-xl uppercase tracking-tight text-black" style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}>
                      Trending
                    </h3>
                    <button
                      onClick={() => {
                        setSocialActiveMainTab('videos');
                        setAppState(AppState.SOCIAL);
                      }}
                      className="text-xs uppercase tracking-widest text-black font-black hover:opacity-70 transition-opacity flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>See more</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {loadingLatestVideos ? (
                    <div className="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto no-scrollbar pb-4">
                      <div className="shrink-0 w-[300px] md:w-auto h-48 bg-black/5 rounded-2xl animate-pulse" />
                      <div className="shrink-0 w-[300px] md:w-auto h-48 bg-black/5 rounded-2xl animate-pulse" />
                      <div className="shrink-0 w-[300px] md:w-auto h-48 bg-black/5 rounded-2xl animate-pulse" />
                    </div>
                  ) : latestVideos && latestVideos.length > 0 ? (
                    <div className="flex md:grid md:grid-cols-3 gap-2 w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-4">
                      {latestVideos.map((video: any) => {
                        const isYoutube = video.type === 'youtube' || video.video_url?.includes('youtube.com') || video.video_url?.includes('youtu.be');
                        return (
                          <div 
                            key={video.id} 
                            className={`snap-start shrink-0 md:w-auto clean-card p-2 border-2 border-black/5 bg-white space-y-2 flex flex-col justify-center ${
                              isYoutube ? 'w-[300px]' : 'w-[200px]'
                            }`}
                          >
                            <div className="space-y-2">
                              {isYoutube && video.title && (
                                <h4 className="text-xs font-black uppercase tracking-tight text-black leading-tight line-clamp-2">
                                  {video.title}
                                </h4>
                              )}
                              {isYoutube ? (
                                <div className="w-full h-[195px] aspect-video relative rounded-xl overflow-hidden border border-black/5 bg-black/5 shadow-inner mx-auto">
                                  <iframe
                                    src={video.video_url}
                                    className="absolute inset-0 w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              ) : (
                                <div className="flex justify-center w-full">
                                  <div className="w-full max-w-[150px] aspect-[9/16] relative rounded-xl overflow-hidden shadow-lg bg-black">
                                    <iframe
                                      src={video.video_url}
                                      className="absolute inset-0 w-full h-full"
                                      allow="fullscreen"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 clean-card flex flex-col items-center justify-center border-dashed border-2 border-black/5 bg-white/50">
                      <p className="text-black/50 text-[10px] font-black uppercase tracking-widest">No updates available</p>
                    </div>
                  )}
                </div>

                {/* Chatter Section */}
                <div className="space-y-4 mt-12 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg md:text-xl uppercase tracking-tight text-black" style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}>
                      Chatter
                    </h3>
                    <button
                      onClick={() => {
                        setSocialActiveMainTab('community');
                        setAppState(AppState.SOCIAL);
                      }}
                      className="text-xs uppercase tracking-widest text-black font-black hover:opacity-70 transition-opacity flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>See more</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {loadingLastPost ? (
                    <div className="h-32 bg-black/5 rounded-2xl animate-pulse" />
                  ) : lastPost ? (
                    <div className="clean-card p-4 border-2 border-black/5 bg-white hover:border-black/10 transition-all max-w-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-venus-accent/20 border border-black flex items-center justify-center text-[9px] font-black">
                            {lastPost.users?.username?.[0] || 'U'}
                          </div>
                          <div>
                            <h4 className="text-[9px] font-black uppercase tracking-tight leading-none">{lastPost.users?.username || 'Anonymous'}</h4>
                            <p className="text-[7px] text-black/40 font-bold">@{lastPost.users?.skin_type || 'member'} • {new Date(lastPost.timestamp).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        {lastPost.title && (
                          <h4 className="text-[10px] font-black uppercase tracking-tight mb-1 text-venus-accent">{lastPost.title}</h4>
                        )}
                        <p className="text-xs font-medium leading-normal text-black/80">{lastPost.content}</p>
                      </div>
                      
                      {lastPost.post_media && (
                        <div className="rounded-lg overflow-hidden border border-black/5 max-h-40">
                          <img src={lastPost.post_media} className="w-full h-full object-cover" alt="Post media" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 clean-card flex flex-col items-center justify-center border-dashed border-2 border-black/5 bg-white/50">
                      <p className="text-black/50 text-[10px] font-black uppercase tracking-widest">No chatter posts available</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-center pt-8">
                  <div className="clean-card px-8 py-8 text-center space-y-4 max-w-sm bg-venus-accent/5">
                     <Heart className="w-8 h-8 text-venus-accent mx-auto fill-venus-accent/20" />
                     <p className="text-sm leading-relaxed opacity-80">"Routine is the foundation of change. Stick to the steps and the results will follow."</p>
                  </div>
                </div>
              </motion.div>
            )
          )}


          {/* PROGRESS */}
          {appState === AppState.PROGRESS && (
            <motion.div 
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >

              {/* Progress Tracker increased spacing */}
              <div className="space-y-6 mt-12">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-black">
                    <h3 className="font-sans font-black text-lg md:text-xl uppercase tracking-tight">Progress</h3>
                  </div>
                  <button 
                    onClick={() => progressInputRef.current?.click()}
                    className="text-xs uppercase tracking-widest text-black font-black hover:opacity-70 transition-opacity flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden md:inline">New Entry</span>
                  </button>
                    
                  <input 
                    type="file" 
                    style={{ display: 'none' }}
                    accept="image/*" 
                    ref={progressInputRef} 
                    onChange={handleProgressUpload} 
                  />
                </div>

                {/* Skin Rating Section */}
                <div className="pt-4 border-t border-black/5">
                  <h4 className="font-black text-black uppercase text-sm tracking-tight mb-3">Rate your skin today</h4>
                  {!isRatingExpanded ? (
                    <div className="flex justify-center gap-4 text-3xl">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button 
                          key={rating}
                          onClick={() => { setSelectedRating(rating); setIsRatingExpanded(true); }}
                          className="hover:scale-125 transition-transform"
                        >
                          {['😡', '😢', '😐', '🙂', '🤩'][rating - 1]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-center font-bold text-sm">
                        {['Urghhhh', 'Kinda poopy day', 'Meh, could be better', 'Feeling myself!', 'Everything is awesome!'][selectedRating! - 1]}
                      </p>
                      <p className="font-black text-black uppercase text-xs tracking-tight">Any notes?</p>
                      <textarea 
                        value={ratingNote} 
                        onChange={(e) => setRatingNote(e.target.value)}
                        className="w-full border p-2 text-sm"
                        placeholder="Add your notes..."
                      />
                      <button 
                        onClick={handleSaveRating} 
                        className="w-full bg-black text-white p-2 text-sm uppercase font-bold tracking-widest hover:bg-black/90"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1">
                  {progressPhotos.length === 0 ? (
                    <div className="py-12 clean-card flex flex-col items-center justify-center border-dashed border-2 border-black/5 bg-white/50 w-full">
                      <p className="text-black/50 text-sm font-black uppercase tracking-widest">No picture added yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3">
                      {progressPhotos.map((photo: any) => (
                        <div key={photo.id} className="space-y-1.5">
                          <div 
                            onClick={() => setSelectedPhoto(photo)}
                            className="aspect-[3/4] clean-card relative group overflow-hidden border border-black/5 bg-black/[0.02] cursor-pointer"
                          >
                            <img 
                              src={resolveImageUrl(photo.image_url)} 
                              alt="Progress" 
                              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/600x600/white/black?text=Image+Not+Found';
                              }}
                            />
                            {/* Delete Button */}
                            <button 
                              type="button"
                              onClick={(e) => {
                                handleDeletePhoto(photo, e);
                              }}
                              className="absolute top-1 right-1 z-[60] w-6 h-6 flex items-center justify-center bg-black/5 hover:bg-black/20 backdrop-blur-md rounded-full text-black opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all border border-black/5 cursor-pointer"
                              aria-label="Delete photo"
                            >
                              <X className="w-3.5 h-3.5 pointer-events-none" />
                            </button>
                          </div>
                          <p className="text-[9px] md:text-[10px] uppercase font-black tracking-widest text-black/60 text-center">
                            {new Date(photo.timestamp || photo.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          )}

          {appState === AppState.RANK && (
            <motion.div 
              key="rank"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-1 md:pt-2 max-w-4xl mx-auto space-y-3"
            >
              {/* Products column */}
              <div className="space-y-4 md:pl-2">
                <div className="flex flex-col gap-3 border-b-2 border-black pb-3">
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black" style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}>
                    Browse Products
                  </h2>
                  
                                     {/* Primary Filter Bubbles (Circular Photo Bubbles like reference image) */}
                   <div className="flex flex-nowrap gap-3 md:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1 snap-x snap-mandatory">
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
                           className="flex flex-col items-center gap-1.5 shrink-0 snap-start group cursor-pointer w-20 sm:w-24 md:w-28"
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

                  {/* Sub-bar Filter based on Primary Filter */}
                  {(primaryFilter === 'By Type' || primaryFilter === 'Pregnancy-safe') && (
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 pt-1">
                      {['All', 'Cleanser', 'SPF', 'Cream', 'Serum', 'Toner', 'Retinol', 'Moisturizer'].map((type) => (
                        <button
                          key={type}
                          onClick={() => setSubFilter(type)}
                          className={`text-[10px] font-black uppercase transition-all whitespace-nowrap ${subFilter.toLowerCase() === type.toLowerCase() ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/40 hover:text-black'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  )}

                  {primaryFilter === 'By Ingredient' && (
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 pt-1">
                      {['all', 'Retinols', 'Hyaluronic Acid', 'PDRN', 'Collagen', 'Niacinamide', 'Salicylic Acid', 'Vitamin C', 'Vitamin E', 'Glycolic Acid', 'Peptides', 'Ceramides', 'AHA/BHA'].map((ing) => (
                        <button
                          key={ing}
                          onClick={() => setSubFilter(ing)}
                          className={`text-[10px] font-black uppercase transition-all whitespace-nowrap ${subFilter.toLowerCase() === ing.toLowerCase() ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/40 hover:text-black'}`}
                        >
                          {ing}
                        </button>
                      ))}
                    </div>
                  )}

                  {primaryFilter === 'By Concern' && (
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 pt-1">
                      {['all', 'Blemish-prone skin', 'Redness', 'Dry Skin', 'Aging skin'].map((concern) => (
                        <button
                          key={concern}
                          onClick={() => setSubFilter(concern)}
                          className={`text-[10px] font-black uppercase transition-all whitespace-nowrap ${subFilter.toLowerCase() === concern.toLowerCase() ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/40 hover:text-black'}`}
                        >
                          {concern}
                        </button>
                      ))}
                    </div>
                  )}

                  {primaryFilter === 'Trending' && (
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1 pt-1">
                      {['all', 'K-Beauty', 'J-Beauty', 'Glass Skin', 'PDRN', 'Natural', 'Winter Care'].map((trend) => (
                        <button
                          key={trend}
                          onClick={() => setSubFilter(trend)}
                          className={`text-[10px] font-black uppercase transition-all whitespace-nowrap ${subFilter.toLowerCase() === trend.toLowerCase() ? 'text-black underline decoration-venus-accent decoration-2' : 'text-black/40 hover:text-black'}`}
                        >
                          {trend}
                        </button>
                      ))}
                    </div>
                  )}

                  <input 
                     type="text"
                     placeholder="Search by brand or name..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     style={{ display: "none" }}
                     className="w-full bg-transparent border-t border-black/10 pt-3 text-xs font-black uppercase text-black placeholder:text-black/40 outline-none hidden"
                   />
                  {isSearching && <div className="text-[9px] font-black uppercase text-venus-accent animate-pulse">Searching...</div>}
                </div>

                {products.length === 0 ? (
                  <div className="text-center py-20 clean-card border-dashed border-2 border-black/5 bg-white/50">
                    <ShoppingBag className="w-12 h-12 text-black/10 mx-auto mb-4" />
                    <p className="text-black/30 text-sm font-black uppercase tracking-widest mb-6">Database currently indexing...</p>
                    {user?.email === 'mv.botez@gmail.com' && (
                      <button 
                        onClick={async (e) => {
                          const btn = e.currentTarget;
                          btn.disabled = true;
                          btn.innerText = "Syncing Protocol...";
                          try {
                            const data = await import('./data/products.json');
                            const payload = data.default;
                            const { error } = await supabase
                              .from('products')
                              .insert(payload);
                            
                            if (error) {
                               console.error('FAILED CALL:', { table: 'products', action: 'INSERT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint });
                               throw error;
                            }
                          } catch (err: any) {
                            console.error(err);
                            btn.innerText = "Sync Failed - Retry";
                            btn.disabled = false;
                          }
                        }}
                        className="text-[10px] font-black uppercase tracking-widest px-6 py-3 bg-black text-white hover:bg-venus-accent transition-all rounded-xl disabled:opacity-50"
                      >
                        Sync Production Catalog
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {(() => {
                      const baseList = searchQuery ? searchResults : products;
                      const filtered = baseList.filter(p => {
                        const pType = (p.type || p.Type || '').toLowerCase();
                        const pName = (p.name || p.Name || p.ProductName || p['Product Name'] || '').toLowerCase();
                        const pBrand = (p.brand || p.Brand || '').toLowerCase();
                        const pDesc = (p.description || '').toLowerCase();
                        const pIngs = Array.isArray(p.ingredients) ? p.ingredients.map((i: string) => i.toLowerCase()) : [];

                        const cat2 = (p.product_scores?.cat2 || '').toLowerCase();
                        const isMen = p.products_filter?.men === true;
                        const pregSafe = p.products_filter?.preg_safe === true;

                        if (primaryFilter === 'By Type') {
                          if (subFilter === 'All' || subFilter === 'all') return true;
                          return cat2 === subFilter.toLowerCase() || pType.includes(subFilter.toLowerCase()) || pName.includes(subFilter.toLowerCase());
                        }
                        
                        if (primaryFilter === 'Pregnancy-safe') {
                          if (!pregSafe) return false;
                          if (subFilter === 'All' || subFilter === 'all') return true;
                          return cat2 === subFilter.toLowerCase() || pType.includes(subFilter.toLowerCase()) || pName.includes(subFilter.toLowerCase());
                        }
                        if (primaryFilter === 'By Ingredient') {
                          if (subFilter === 'all' || subFilter === 'All') return true;
                          const target = subFilter.toLowerCase();
                          return pIngs.some(i => i.includes(target)) || pDesc.includes(target) || pName.includes(target);
                        }
                        if (primaryFilter === 'By Concern') {
                          if (subFilter === 'all' || subFilter === 'All') return true;
                          const target = subFilter.toLowerCase();
                          if (target === 'blemish-prone skin') return p.products_filter?.blem_prone === true;
                          if (target === 'redness') return p.products_filter?.red === true;
                          if (target === 'dry skin') return p.products_filter?.dry === true;
                          if (target === 'aging skin') return p.products_filter?.aging === true;
                          return pDesc.includes(target) || pName.includes(target);
                        }
                        if (primaryFilter === 'Trending') {
                          if (subFilter === 'all' || subFilter === 'All') return true;
                          const target = subFilter.toLowerCase();
                          if (target === 'k-beauty') return p.products_filter?.k_beauty === true;
                          if (target === 'j-beauty') return p.products_filter?.j_beauty === true;
                          if (target === 'glass skin') return p.products_filter?.glass === true;
                          if (target === 'pdrn') return p.products_filter?.c_pdrn === true;
                          if (target === 'natural') return p.products_filter?.natural === true;
                          return pDesc.includes(target) || pName.includes(target) || pBrand.includes(target) || pIngs.some(i => i.includes(target));
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="col-span-2 py-12 text-center text-black/40 text-xs uppercase font-black tracking-widest clean-card bg-white/50">
                            No products match this filter.
                          </div>
                        );
                      }

                      return filtered.map((p: any) => {
                        const userProd = userProducts.find(up => (up?.product_name === (p.name || p.Name || p.ProductName || p['Product Name'])));
                        return (
                          <div 
                            key={p.id} 
                            onClick={() => openProductCard(String(p.id))} 
                            className="cursor-pointer clean-card p-3 border-2 bg-white border-black/5 hover:border-black transition-all flex flex-col items-center text-center gap-2 relative group"
                            data-product-id={p.id}
                          >
                            {p.photo_url ? (
                              <img 
                                src={p.photo_url} 
                                alt={p.name || p.Name || p.ProductName || p['Product Name'] || 'Product'} 
                                referrerPolicy="no-referrer"
                                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-black/10 flex-shrink-0 group-hover:scale-105 transition-transform" 
                              />
                            ) : (
                              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black/5 rounded-xl border border-black/10 flex items-center justify-center flex-shrink-0 text-[8px] text-black/40">
                                No Image
                              </div>
                            )}
                            <div className="w-full min-w-0">
                              <div className="text-[9px] font-black uppercase tracking-widest text-venus-accent mb-0.5 whitespace-normal break-words">
                                {p.brand || p.Brand || 'Unknown'}
                              </div>
                              <h3 className="text-[10px] md:text-xs font-black text-black uppercase leading-tight whitespace-normal break-words">
                                {p.name || p.Name || p.ProductName || p['Product Name'] || 'Unnamed'}
                              </h3>
                            </div>
                            <div className="absolute top-2 right-2">
                              {userProd ? (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteUPP(userProd.id); }} className="p-1 hover:bg-black/10 rounded-full shrink-0">
                                  <Trash2 className="w-3 h-3 text-black/70"/>
                                </button>
                              ) : (
                                <button onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (!user) {
                                    setAuthPromptModalOpen(true);
                                    return;
                                  }
                                  setSelectedProductForUPP(p); 
                                }} className="p-1 hover:bg-black/5 rounded-full shrink-0">
                                  <Plus className="w-3 h-3 text-black/50"/>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TRACKER */}
          {appState === AppState.TRACKER && (() => {
            // Apply filtering logic
            const filteredTrackerData = trackerData.filter(item => {
              if (trackerFilter.category === 'All') return true;
              
              const itemType = (item.product_type || '').toLowerCase().trim();
              
              if (trackerFilter.category === 'Skin care') {
                if (trackerFilter.subOption) {
                  const sub = trackerFilter.subOption.toLowerCase();
                  if (sub === 'moisturiser') {
                    return itemType === 'moisturiser' || itemType === 'moisturizer';
                  }
                  return itemType === sub;
                }
                const skinCareSubs = ['moisturiser', 'moisturizer', 'cleanser', 'eye cream', 'mask', 'mists', 'lips', 'serum', 'toner', 'exfoliator', 'essence', 'peel', 'pads', 'lotion', 'spot treatment', 'oil', 'skin care'];
                return skinCareSubs.includes(itemType);
              }
              
              if (trackerFilter.category === 'Makeup') {
                if (trackerFilter.subOption) {
                  return itemType === trackerFilter.subOption.toLowerCase();
                }
                const makeupSubs = ['makeup', 'foundation', 'eyebrow', 'eyelash', 'bronzer', 'primer', 'lip gloss', 'eyeliner', 'fragrance', 'mascara', 'nails', 'highlighter', 'eyeshadow', 'blush'];
                return makeupSubs.includes(itemType);
              }
              
              if (trackerFilter.category === 'SPF') {
                return itemType === 'spf';
              }
              
              if (trackerFilter.category === 'Hair') {
                return itemType === 'hair';
              }
              
              if (trackerFilter.category === 'Body') {
                return itemType === 'body';
              }
              
              return false;
            });

            // Group filtered items by product_type (e.g. Cleanser, Moisturiser)
            const groupedTracker: Record<string, typeof trackerData> = {};
            filteredTrackerData.forEach(item => {
              const typeRaw = item.product_type || 'Custom';
              // Normalize casing for consistent section headers
              let type = typeRaw.trim();
              if (type.toLowerCase() === 'spf') {
                type = 'SPF';
              } else if (type.length > 0) {
                type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
              }
              if (!groupedTracker[type]) {
                groupedTracker[type] = [];
              }
              groupedTracker[type].push(item);
            });

            const customOrder = [
              'Cleanser', 'Spot treatment', 'Serum', 'Oil', 'Toner', 'Moisturiser', 'Eye cream', 'SPF', 'Lotion', 'Exfoliator', 'Essence', 'Peel', 'Pads', 'Mask', 'Mists', 'Lips', 'Body', 'Hair',
              'Makeup', 'Foundation', 'Eyebrow', 'Eyelash', 'Bronzer', 'Primer', 'Lip gloss', 'Eyeliner', 'Fragrance', 'Mascara', 'Nails', 'Highlighter', 'Eyeshadow', 'Blush'
            ];

            const sortedGroupKeys = Object.keys(groupedTracker).sort((a, b) => {
              const idxA = customOrder.indexOf(a);
              const idxB = customOrder.indexOf(b);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return a.localeCompare(b);
            });

            return (
              <motion.div 
                key="tracker"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-0 space-y-8 w-full max-w-none px-0"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-4 px-4 gap-4">
                  <div>
                    <h2 className="text-lg md:text-xl text-black uppercase tracking-tight" style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}>Tracker</h2>
                    <p className="text-venus-accent font-black text-[8px] md:text-[10px] uppercase tracking-widest mt-1">Keep track of your products and set alerts.</p>
                  </div>

                  {/* Actions: Filter & Add Product */}
                  <div className="flex items-center gap-2 self-end sm:self-auto relative">
                    {/* Filter Toggle Button */}
                    <div className="relative">
                      <button 
                        onClick={() => setIsTrackerFilterOpen(!isTrackerFilterOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-gray-50 border border-black text-black rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        <span>Filter: {trackerFilter.subOption || trackerFilter.category}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${isTrackerFilterOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Filter Dropdown Menu */}
                      {isTrackerFilterOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white border-2 border-black rounded-2xl shadow-xl z-50 max-h-[400px] overflow-y-auto no-scrollbar">
                          <div className="p-2 space-y-1">
                            {/* All Button */}
                            <button 
                              onClick={() => { setTrackerFilter({ category: 'All' }); setIsTrackerFilterOpen(false); }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/5 ${trackerFilter.category === 'All' ? 'bg-black text-white hover:bg-black' : 'text-black'}`}
                            >
                              All Products
                            </button>
                            
                            <div className="border-t border-black/10 my-1"></div>
                            
                            {/* Skin care Section */}
                            <div>
                              <button 
                                onClick={() => { setTrackerFilter({ category: 'Skin care' }); setIsTrackerFilterOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/5 flex justify-between items-center ${trackerFilter.category === 'Skin care' && !trackerFilter.subOption ? 'bg-black text-white' : 'text-black'}`}
                              >
                                <span>Skin care</span>
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-venus-accent/15 text-venus-accent font-black uppercase">All</span>
                              </button>
                              <div className="pl-3 pr-1 py-1 grid grid-cols-2 gap-1 border-l-2 border-black/10 ml-3 mt-1">
                                {['Moisturiser', 'Cleanser', 'Eye cream', 'Mask', 'Mists', 'Lips', 'Serum', 'Toner', 'Exfoliator', 'Essence', 'Peel', 'Pads', 'Lotion', 'Spot treatment', 'Oil'].map(sub => (
                                  <button
                                    key={sub}
                                    onClick={() => { setTrackerFilter({ category: 'Skin care', subOption: sub }); setIsTrackerFilterOpen(false); }}
                                    className={`text-left px-2 py-1 rounded-lg text-[9px] font-bold uppercase truncate hover:bg-black/5 ${trackerFilter.category === 'Skin care' && trackerFilter.subOption === sub ? 'bg-black text-white' : 'text-black/70'}`}
                                  >
                                    {sub}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            <div className="border-t border-black/10 my-1"></div>
                            
                            {/* SPF */}
                            <button 
                              onClick={() => { setTrackerFilter({ category: 'SPF' }); setIsTrackerFilterOpen(false); }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/5 ${trackerFilter.category === 'SPF' ? 'bg-black text-white hover:bg-black' : 'text-black'}`}
                            >
                              SPF (Sunscreen)
                            </button>
                            
                            {/* Hair */}
                            <button 
                              onClick={() => { setTrackerFilter({ category: 'Hair' }); setIsTrackerFilterOpen(false); }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/5 ${trackerFilter.category === 'Hair' ? 'bg-black text-white hover:bg-black' : 'text-black'}`}
                            >
                              Hair
                            </button>
                            
                            {/* Body */}
                            <button 
                              onClick={() => { setTrackerFilter({ category: 'Body' }); setIsTrackerFilterOpen(false); }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/5 ${trackerFilter.category === 'Body' ? 'bg-black text-white hover:bg-black' : 'text-black'}`}
                            >
                              Body
                            </button>
                            
                            <div className="border-t border-black/10 my-1"></div>
                            
                            {/* Makeup Section */}
                            <div>
                              <button 
                                onClick={() => { setTrackerFilter({ category: 'Makeup' }); setIsTrackerFilterOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/5 flex justify-between items-center ${trackerFilter.category === 'Makeup' && !trackerFilter.subOption ? 'bg-black text-white' : 'text-black'}`}
                              >
                                <span>Makeup</span>
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-venus-accent/15 text-venus-accent font-black uppercase">All</span>
                              </button>
                              <div className="pl-3 pr-1 py-1 grid grid-cols-2 gap-1 border-l-2 border-black/10 ml-3 mt-1">
                                {['Makeup', 'Foundation', 'Eyebrow', 'Eyelash', 'Bronzer', 'Primer', 'Lip gloss', 'Eyeliner', 'Fragrance', 'Mascara', 'Nails', 'Highlighter', 'Eyeshadow', 'Blush'].map(sub => (
                                  <button
                                    key={sub}
                                    onClick={() => { setTrackerFilter({ category: 'Makeup', subOption: sub }); setIsTrackerFilterOpen(false); }}
                                    className={`text-left px-2 py-1 rounded-lg text-[9px] font-bold uppercase truncate hover:bg-black/5 ${trackerFilter.category === 'Makeup' && trackerFilter.subOption === sub ? 'bg-black text-white' : 'text-black/70'}`}
                                  >
                                    {sub}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Add Product Button */}
                    <button 
                      onClick={() => setIsTrackerModalOpen(true)} 
                      className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-50 border border-black text-black rounded-full text-[10px] font-black uppercase tracking-wider transition-all"
                    >
                      <span>+ Add</span>
                    </button>
                  </div>
                </div>

                {/* Grid Content */}
                <div className="px-0 w-full max-w-none">
                  {filteredTrackerData.length === 0 ? (
                    <div className="clean-card bg-white rounded-3xl border-2 border-black/10 p-12 text-center text-black/30 font-black uppercase italic text-xs">
                      No tracked products found matching the selected filter.
                    </div>
                  ) : (
                    <div className="space-y-10">
                      {/* Mobile View: Grid of compact Product Cards grouped by type */}
                      <div className="space-y-10 md:hidden">
                        {sortedGroupKeys.map(groupKey => (
                          <div key={groupKey} className="space-y-4">
                            {/* Section Header */}
                            <div className="flex items-center gap-3 border-b-2 border-black/15 pb-2">
                              <h3 className="text-xs font-black uppercase tracking-widest text-black bg-black/5 px-3 py-1 rounded-lg">
                                {groupKey}
                              </h3>
                              <span className="text-[10px] font-mono text-black/40 font-bold">
                                ({groupedTracker[groupKey].length} {groupedTracker[groupKey].length === 1 ? 'product' : 'products'})
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-4">
                              {groupedTracker[groupKey].map((item, idx) => {
                                const isExpanded = expandedTrackerIds.includes(item.id);
                                return (
                                  <div
                                    key={`${item.id}-${idx}`}
                                    className="bg-white rounded-2xl border-2 border-black/10 shadow-sm transition-all flex flex-col p-3 relative"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <div
                                        onClick={() => handleTrackerProductClick(item, false)}
                                        className="flex items-center gap-3 min-w-0 flex-1 group cursor-pointer"
                                      >
                                        {item.photo_url ? (
                                          <img 
                                            src={item.photo_url} 
                                            alt={item.product_name} 
                                            referrerPolicy="no-referrer"
                                            className="w-12 h-12 object-cover rounded-xl border border-black/10 flex-shrink-0 group-hover:scale-105 transition-transform"
                                          />
                                        ) : (
                                          <div className="w-12 h-12 bg-black/5 rounded-xl border border-black/10 flex items-center justify-center flex-shrink-0 text-[10px] text-black/40 font-bold">
                                            N/A
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <h4 className="text-sm font-black uppercase tracking-tight break-words group-hover:text-venus-accent transition-colors">
                                            {item.brand || '-'}
                                          </h4>
                                          <p className="text-xs text-black/60 font-semibold normal-case break-words mt-0.5">
                                            {item.product_name || '-'}
                                          </p>
                                          {/* Simplified Badge */}
                                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            <span className="bg-gray-50 text-gray-800 border border-gray-200/50 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase flex items-center gap-1">
                                              {item.routine_time || 'AM/PM'} Routine
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Down Arrow / Chevron Toggle */}
                                      <button
                                        onClick={() => toggleTrackerItemExpanded(item.id)}
                                        className="p-1 text-black/50 hover:text-black hover:bg-black/5 rounded-lg transition-colors flex-shrink-0 mt-0.5"
                                        aria-label="Toggle tracker details"
                                      >
                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                      </button>
                                    </div>

                                    {/* Inline Tracker Controls displayed below */}
                                    {isExpanded && (
                                      <div className="mt-3 border-t border-black/5 pt-3">
                                        <InlineTrackerControls 
                                          item={item} 
                                          onRefresh={fetchTrackerData} 
                                          onDelete={() => handleDeleteFromTracker(item.id)} 
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop/Website View: Spreadsheet layout with all fields in ONE table */}
                      <div className="hidden md:block overflow-x-auto border-2 border-black/10 rounded-2xl bg-white shadow-sm">
                        <table className="w-full min-w-[1050px] border-collapse text-left">
                          <thead>
                            <tr className="bg-black/5 border-b border-black/10">
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60">Product</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 w-32">Routine</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 text-center w-20">In Use</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 text-center w-20">Liked</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 text-center w-24">Buy Again</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 w-28">Size</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 min-w-[200px]">Notes</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 w-36">Open Date</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 w-36">Best By</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 w-24">POA</th>
                              <th className="p-3 text-[10px] font-black uppercase tracking-wider text-black/60 text-center w-16">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/5">
                            {sortedGroupKeys.map(groupKey => {
                              const isSectionCollapsed = collapsedTrackerSections.includes(groupKey);
                              return (
                                <React.Fragment key={groupKey}>
                                  {/* Section Header Row */}
                                  <tr 
                                    className="bg-black/[0.03] border-y border-black/10 cursor-pointer select-none hover:bg-black/[0.06] transition-colors"
                                    onClick={() => toggleTrackerSection(groupKey)}
                                  >
                                    <td colSpan={11} className="p-3 font-black text-xs uppercase tracking-wider text-black">
                                      <div className="flex items-center gap-2">
                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSectionCollapsed ? '-rotate-90' : ''}`} />
                                        <span>{groupKey}</span>
                                        <span className="text-[10px] font-mono text-black/40 font-bold ml-1">
                                          ({groupedTracker[groupKey].length} {groupedTracker[groupKey].length === 1 ? 'product' : 'products'})
                                        </span>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Product Rows */}
                                  {!isSectionCollapsed && groupedTracker[groupKey].map((item) => (
                                    <TrackerSpreadsheetRow
                                      key={item.id}
                                      item={item}
                                      onUpdate={handleUpdateTracker}
                                      onDelete={handleDeleteFromTracker}
                                      onClickProduct={handleTrackerProductClick}
                                    />
                                  ))}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          {/* PROFILE PAGE */}
          {appState === AppState.PROFILE && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 max-w-2xl mx-auto pb-12 w-full"
            >
              <header className="text-center space-y-3">
                <div className="inline-flex p-3 bg-black/5 rounded-full mb-2">
                  <UserIcon className="w-8 h-8 text-black" />
                </div>
                <h2 className="text-4xl md:text-5xl font-sans font-black text-black uppercase tracking-tighter">
                  My Skin Profile
                </h2>
                <p className="text-sm font-medium text-black/50 italic max-w-md mx-auto">
                  Your customized skin identity based on your dermatological diagnostic details and daily tracking.
                </p>
              </header>

              {!userProfile ? (
                <div className="clean-card bg-white border border-black/10 rounded-3xl p-8 shadow-sm text-center space-y-6">
                  <div className="max-w-sm mx-auto space-y-2">
                    <h3 className="text-xl font-black text-black uppercase tracking-tight">No Skin Profile Found</h3>
                    <p className="text-xs text-black/60 font-medium">
                      You haven't completed the skin quiz yet. Take the quick diagnostic quiz to unlock your detailed skin profile report!
                    </p>
                  </div>
                  <button
                    onClick={() => setAppState(AppState.ONBOARDING_DETAILS)}
                    className="bg-black text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-wider hover:bg-venus-accent transition-colors shadow-md inline-flex items-center gap-2"
                  >
                    Take Skin Quiz
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Skin Type & Burn Risk (Grid) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Skin Type Card */}
                    <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-venus-accent/[0.03] rounded-full -mr-6 -mt-6" />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <FlaskConical className="w-5 h-5 text-venus-accent" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-black/50 block">Skin Type</span>
                        </div>
                        <h3 className="text-2xl font-black text-black uppercase tracking-tight capitalize">
                          {userProfile.skin_type || 'Unknown'}
                        </h3>
                      </div>
                      <p className="text-[11px] text-black/60 font-medium mt-3">
                        {userProfile.skin_type === 'dry' && 'Your skin produces less sebum than normal, which can lead to tightness, flaking, or a dull complexion.'}
                        {userProfile.skin_type === 'oily' && 'Your skin has overactive sebaceous glands, producing excess sebum, which can result in shine and breakouts.'}
                        {userProfile.skin_type === 'combination' && 'Your skin has an oily T-zone (forehead, nose, chin) but is normal or dry on the cheeks.'}
                        {userProfile.skin_type === 'normal' && 'Your skin is well-balanced, with just the right amount of moisture and sebum, and is less prone to sensitivities.'}
                        {!['dry', 'oily', 'combination', 'normal'].includes(userProfile.skin_type?.toLowerCase()) && 'Your primary skin barrier classification.'}
                      </p>
                    </div>

                    {/* Burn Risk Card */}
                    <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/[0.03] rounded-full -mr-6 -mt-6" />
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Sun className="w-5 h-5 text-yellow-500" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-black/50 block">UV Burn Risk</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-black text-black uppercase tracking-tight capitalize">
                            {userProfile.burn_risk || 'Medium'}
                          </h3>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            userProfile.burn_risk?.toLowerCase() === 'high' ? 'bg-red-100 text-red-700' :
                            userProfile.burn_risk?.toLowerCase() === 'low' ? 'bg-green-100 text-green-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {userProfile.burn_risk?.toLowerCase() === 'high' ? 'High Risk' :
                             userProfile.burn_risk?.toLowerCase() === 'low' ? 'Minimal' : 'Moderate'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-black/60 font-medium mt-3">
                        {userProfile.burn_risk?.toLowerCase() === 'high' && 'Highly sensitive to UV. Burns easily, tans minimally. Essential to use daily SPF 50+ and limit direct sun.'}
                        {userProfile.burn_risk?.toLowerCase() === 'medium' && 'Moderately sensitive to UV. May burn initially, then tan. Daily SPF 30+ recommended.'}
                        {userProfile.burn_risk?.toLowerCase() === 'low' && 'High melanin resilience. Burns rarely, tans easily. Standard daily SPF 30 is recommended for protection.'}
                        {!['high', 'medium', 'low'].includes(userProfile.burn_risk?.toLowerCase()) && 'Your skin reactivity to solar radiation.'}
                      </p>
                    </div>
                  </div>

                  {/* Barrier Risk Card */}
                  <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-black/50 block mb-1">Skin Barrier Status Score</span>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-black text-black">
                            {userProfile.barrier_status !== null && userProfile.barrier_status !== undefined ? userProfile.barrier_status : '0'}
                          </span>
                          <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              Number(userProfile.barrier_status) >= 6 ? 'text-red-600' :
                              Number(userProfile.barrier_status) >= 3 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {Number(userProfile.barrier_status) >= 6 ? 'Compromised / High Sensitivity' :
                               Number(userProfile.barrier_status) >= 3 ? 'Moderate Sensitivity Risk' :
                               'Strong Barrier / Healthy'}
                            </span>
                            <span className="text-[9px] text-black/40">Computed from self-reported skin characteristics & reactivity</span>
                          </div>
                        </div>
                      </div>
                      <Award className="w-8 h-8 text-black/10" />
                    </div>

                    {/* Progress Bar representation */}
                    <div className="w-full bg-black/5 h-2 rounded-full overflow-hidden mb-4">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          Number(userProfile.barrier_status) >= 6 ? 'bg-red-500' :
                          Number(userProfile.barrier_status) >= 3 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, (Number(userProfile.barrier_status) || 0) * 10))}%` }}
                      />
                    </div>
                    
                    <p className="text-[11px] text-black/60 font-medium">
                      A higher score indicates a highly reactive skin barrier. Avoid introducing multiple new active serums concurrently, and prioritize barrier support ingredients like ceramides, hyaluronic acid, and niacinamide.
                    </p>
                  </div>

                  {/* Skin Goals Card */}
                  <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
                    <h4 className="text-xs font-black uppercase tracking-wider text-black/50 mb-4 flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-venus-accent" />
                      Target Skin Goals
                    </h4>
                    {Array.isArray(userProfile.goals) && userProfile.goals.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {userProfile.goals.map((g: string, idx: number) => (
                          <span 
                            key={g + idx} 
                            className="text-xs bg-black text-white px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-venus-pink" />
                            {g}
                          </span>
                        ))}
                      </div>
                    ) : typeof userProfile.goals === 'string' && userProfile.goals.trim() !== '' ? (
                      <span className="text-xs bg-black text-white px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm inline-block">
                        <CheckCircle2 className="w-3.5 h-3.5 text-venus-pink" />
                        {userProfile.goals}
                      </span>
                    ) : (
                      <p className="text-xs text-black/40 italic">No specific skincare goals configured.</p>
                    )}
                  </div>

                  {/* Breakout Types Card */}
                  <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
                    <h4 className="text-xs font-black uppercase tracking-wider text-black/50 mb-4 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      Breakout Characteristics
                    </h4>
                    {Array.isArray(userProfile.breakout_type) && userProfile.breakout_type.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {userProfile.breakout_type.map((b: any, idx: number) => (
                          <span 
                            key={String(b) + idx} 
                            className="text-xs bg-purple-50 text-purple-900 border border-purple-200/50 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            {getBreakoutTitle(b)}
                          </span>
                        ))}
                      </div>
                    ) : typeof userProfile.breakout_type === 'number' || (typeof userProfile.breakout_type === 'string' && userProfile.breakout_type.trim() !== '') ? (
                      <span className="text-xs bg-purple-50 text-purple-900 border border-purple-200/50 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm inline-block">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        {getBreakoutTitle(userProfile.breakout_type)}
                      </span>
                    ) : (
                      <p className="text-xs text-black/40 italic">No specific breakout characteristics specified.</p>
                    )}
                  </div>

                  <div className="pt-6 text-center">
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors bg-red-50 px-6 py-3 rounded-xl border border-red-200/50 cursor-pointer shadow-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}


        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedPhoto && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPhoto(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            
            {/* Navigation Arrows */}
            <button 
              onClick={() => {
                const idx = progressPhotos.findIndex(p => p.id === selectedPhoto.id);
                const nextIdx = (idx - 1 + progressPhotos.length) % progressPhotos.length;
                setSelectedPhoto(progressPhotos[nextIdx]);
              }}
              className="absolute left-4 z-10 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>

            <button 
              onClick={() => {
                const idx = progressPhotos.findIndex(p => p.id === selectedPhoto.id);
                const nextIdx = (idx + 1) % progressPhotos.length;
                setSelectedPhoto(progressPhotos[nextIdx]);
              }}
              className="absolute right-4 z-10 w-12 h-12 flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
              <ChevronRight className="w-10 h-10" />
            </button>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-2xl flex items-center justify-center bg-black shadow-2xl"
            >
              <img 
                src={resolveImageUrl(selectedPhoto.image_url)} 
                alt="Progress Full" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/600x600/white/black?text=Image+Not+Found';
                }}
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePhoto(selectedPhoto, e);
                  }}
                  className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500 text-white transition-all flex items-center justify-center backdrop-blur-md border border-white/10"
                  title="Delete Photo"
                >
                  <X className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setSelectedPhoto(null)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all flex items-center justify-center backdrop-blur-md border border-white/10"
                  title="Close"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full border-2 border-black/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-black">
                  {new Date(selectedPhoto.timestamp || selectedPhoto.created_at).toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {routineToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRoutineToDelete(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center space-y-6"
            >
              <Trash2 className="w-12 h-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight text-black">Delete Routine?</h3>
                <p className="text-sm text-black/60 mt-2 font-medium">Do you want to delete this routine?</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setRoutineToDelete(null)}
                  className="flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs border-2 border-black/5 hover:bg-black/5 transition-all"
                >
                  No
                </button>
                <button 
                  onClick={handleDeleteRoutine}
                  className="flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-xs bg-red-500 text-white shadow-lg hover:bg-red-600 transition-all"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddingRoutine && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingRoutine(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 md:p-10 space-y-6 overflow-y-auto flex-1 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-xl font-black uppercase tracking-tight">
                     {modalMode === 'edit' ? 'Edit routine' : modalMode === 'reminder' ? 'Set yourself a reminder' : 'New routine'}
                   </h2>
                   <button 
                     onClick={() => setIsAddingRoutine(false)}
                     className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center hover:bg-black hover:text-white transition-all text-black/40"
                   >
                     <Plus className="w-6 h-6 rotate-45" />
                   </button>
                </div>

                {modalMode === 'reminder' ? (
                    <div className="mb-6">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Time</h3>
                       <input 
                         type="time" 
                         className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black transition-all"
                         value={reminderTime}
                         onChange={e => setReminderTime(e.target.value)}
                       />
                    </div>
                ) : (
                  <>
                    {/* Routine Name */}
                    <div className="mb-6">
                       <h3 className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-3">Routine Name</h3>
                       <input 
                         type="text" 
                         placeholder="e.g. Morning Glow" 
                         className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black transition-all"
                         value={routineName}
                         onChange={e => setRoutineName(e.target.value)}
                       />
                    </div>
                    
                    {/* Time */}
                    <div className="mb-6">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Time</h3>
                       <div className="flex gap-6">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex items-center justify-center">
                              <input type="radio" name="time" value="AM" checked={routineTime === 'AM'} onChange={() => setRoutineTime('AM')} className="peer sr-only" />
                              <div className="w-5 h-5 rounded-full border-2 border-black/20 peer-checked:border-black transition-colors"></div>
                              <div className="absolute w-2.5 h-2.5 rounded-full bg-black scale-0 peer-checked:scale-100 transition-transform"></div>
                            </div>
                            <span className="font-bold text-xs uppercase tracking-widest group-hover:text-venus-accent transition-colors">AM</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex items-center justify-center">
                              <input type="radio" name="time" value="PM" checked={routineTime === 'PM'} onChange={() => setRoutineTime('PM')} className="peer sr-only" />
                              <div className="w-5 h-5 rounded-full border-2 border-black/20 peer-checked:border-black transition-colors"></div>
                              <div className="absolute w-2.5 h-2.5 rounded-full bg-black scale-0 peer-checked:scale-100 transition-transform"></div>
                            </div>
                            <span className="font-bold text-xs uppercase tracking-widest group-hover:text-venus-accent transition-colors">PM</span>
                          </label>
                       </div>
                    </div>

                    {/* Days */}
                    <div className="mb-6">
                       <h3 className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-3">Days of the week</h3>
                       <div className="flex flex-wrap gap-3">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'All'].map(day => (
                            <label key={day} className="flex items-center gap-2 cursor-pointer group">
                              <div className="relative flex items-center justify-center">
                                <input 
                                  type="checkbox" 
                                  checked={routineDays.includes(day)}
                                  onChange={(e) => {
                                    if (day === 'All') {
                                      if (e.target.checked) setRoutineDays(['All']);
                                      else setRoutineDays([]);
                                    } else {
                                      let newDays = routineDays.filter(d => d !== 'All');
                                      if (e.target.checked) newDays.push(day);
                                      else newDays = newDays.filter(d => d !== day);
                                      setRoutineDays(newDays);
                                    }
                                  }} 
                                  className="peer sr-only" 
                                />
                                <div className="w-4 h-4 rounded border-2 border-black/20 peer-checked:border-black peer-checked:bg-black transition-colors flex items-center justify-center">
                                  <CheckCircle2 className="w-3 h-3 text-white scale-0 peer-checked:scale-100 transition-transform stroke-[4]" />
                                </div>
                              </div>
                              <span className="text-xs font-medium group-hover:text-venus-accent transition-colors">{day}</span>
                            </label>
                          ))}
                       </div>
                    </div>

                    {/* Product Search */}
                    <div className="mb-6">
                       <h3 className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-3">Add Products</h3>
                       <input 
                         type="text" 
                         placeholder="Search catalog..." 
                         className="w-full clean-card p-4 text-sm focus:border-black outline-none mb-2 bg-white"
                         value={routineSearchQuery}
                         onChange={e => setRoutineSearchQuery(e.target.value)}
                       />

                       <button 
                         onClick={() => setIsAddingNewProduct(!isAddingNewProduct)}
                         className="text-[10px] font-black uppercase tracking-widest text-black/60 hover:text-black mb-4 flex items-center gap-1"
                       >
                         <Plus className="w-3 h-3" />
                         {isAddingNewProduct ? 'Cancel' : 'Add new'}
                       </button>

                       {isAddingNewProduct && (
                         <div className="bg-black/5 p-4 rounded-xl space-y-3 mb-4 animate-in fade-in slide-in-from-top-2">
                           <input 
                             placeholder="Brand"
                             className="w-full p-3 rounded-lg text-sm bg-white"
                             value={newProduct.brand}
                             onChange={e => setNewProduct({...newProduct, brand: e.target.value})}
                           />
                           <input 
                             placeholder="Product name"
                             className="w-full p-3 rounded-lg text-sm bg-white"
                             value={newProduct.name}
                             onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                           />
                           <select 
                            className="w-full p-3 rounded-lg text-sm bg-white" 
                            value={newProduct.type} 
                            onChange={e => setNewProduct({...newProduct, type: e.target.value})}
                           >
                            <option value="">Product type</option>
                            {['Cleanser', 'Serum', 'Toner', 'Moisturizer', 'Treatment', 'Mask', 'Eye care', 'Lip care', 'Sunscreen (SPF)', 'Exfoliator', 'Oil'].map(type => <option key={type} value={type}>{type}</option>)}
                           </select>
                           <button 
                             onClick={() => {
                               setRoutineSelectedProducts([...routineSelectedProducts, { ...newProduct, tempId: Date.now() }]);
                               setNewProduct({ brand: '', name: '', type: '' });
                               setIsAddingNewProduct(false);
                            }}
                             className="w-full py-2 bg-black text-white rounded-lg font-black text-xs uppercase hover:bg-venus-accent transition-colors"
                           >
                             Add to routine
                           </button>
                         </div>
                       )}

                       {isSearchingRoutine && <div className="text-[10px] font-black uppercase tracking-widest text-venus-accent animate-pulse mb-2">Searching...</div>}
                       
                       {routineSearchResults.length > 0 && (
                         <div className="max-h-60 overflow-y-auto touch-pan-y clean-card mb-4 bg-white p-2 border-2 border-black/5">
                           {routineSearchResults
                             .map(p => (
                               <div key={p.id} className="p-3 hover:bg-black/5 rounded-lg flex justify-between items-center cursor-pointer transition-colors" onClick={() => {
                                 if (!routineSelectedProducts.find(sp => sp.id === p.id)) {
                                   setRoutineSelectedProducts([...routineSelectedProducts, p]);
                                 }
                                 setRoutineSearchQuery('');
                                 setRoutineSearchResults([]);
                               }}>
                                 <div>
                                   <span className="text-[10px] uppercase font-black tracking-widest text-venus-accent">{p.brand || p.Brand}</span>
                                   <span className="text-sm font-bold block">{p.name || p.ProductName || p.Name}</span>
                                 </div>
                                 <Plus className="w-4 h-4 text-black/40"/>
                               </div>
                           ))}
                         </div>
                       )}
                       
                       {/* Selected Products */}
                       <div className="space-y-3 mt-4">
                          {routineSelectedProducts.map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-black/5 p-4 rounded-xl border border-black/5">
                              <div>
                                 <span className="text-[10px] uppercase font-black tracking-widest text-venus-accent">{p.brand || p.Brand}</span>
                                 <span className="text-sm font-bold block">{p.name || p.ProductName || p.Name}</span>
                              </div>
                              <button onClick={() => setRoutineSelectedProducts(routineSelectedProducts.filter((_, i) => i !== idx))} className="hover:text-red-500 transition-colors p-2 text-black/40">
                                 <Plus className="w-5 h-5 rotate-45"/>
                              </button>
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* Notes */}
                    <div className="mb-6">
                       <h3 className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-3">Notes</h3>
                       <textarea 
                         placeholder="Add any instructions or notes for this routine..." 
                         className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black transition-all resize-none h-24"
                         value={routineNotes}
                         onChange={e => setRoutineNotes(e.target.value)}
                       />
                    </div>
                  </>
                )}

                {routineFormError && (
                  <div className="mb-6 text-center p-4 bg-amber-100 text-amber-800 rounded-2xl text-sm font-medium">
                    {routineFormError}
                  </div>
                )}

                <button 
                  className="btn-primary w-full shadow-xl text-xs flex items-center justify-center gap-2" 
                  onClick={handleSaveRoutine}
                  disabled={isSavingRoutineForm}
                >
                  {isSavingRoutineForm ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {modalMode === 'reminder' ? 'Saving Reminder...' : 'Saving Routine...'}
                    </>
                  ) : (
                    modalMode === 'reminder' ? 'Save Reminder' : 'Save Routine'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      
      {/* UPP Modal */}
      {selectedProductForUPP && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-6 rounded-3xl w-full max-w-sm clean-card">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-1">{selectedProductForUPP.name || selectedProductForUPP.Name}</h3>
            <p className="text-[10px] font-black uppercase text-venus-accent mb-6">{selectedProductForUPP.brand || selectedProductForUPP.Brand}</p>
            
            <div className="flex gap-2 mb-4">
                      {(['Used', 'Wishlist', 'Avoid'] as const).map(c => (
                <button key={c} onClick={() => setUppCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg ${uppCategories.includes(c) ? 'bg-black text-white' : 'bg-black/5'}`}>
                  {c}
                </button>
              ))}
            </div>

            {uppCategories.includes('Used') && (
              <>
                <div className="flex gap-2 mb-4">
                  {(['Loved it', 'Was OK', 'Not for me'] as const).map(i => (
                    <button key={i} onClick={() => setUppImpression(i)} className={`flex-1 py-1 text-[9px] font-black uppercase rounded-lg ${uppImpression === i ? 'bg-venus-accent text-white' : 'bg-black/5'}`}>
                      {i}
                    </button>
                  ))}
                </div>
                <div className="mb-4">
                  <span className="text-[10px] font-black uppercase text-black/50">How long did you use it for?</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={uppLength} onChange={(e) => setUppLength(e.target.value)} className="w-16 text-xs p-2 bg-black/5 rounded-xl" />
                    <span className="text-xs font-black uppercase">months</span>
                  </div>
                  <p className="text-[9px] text-black/40 mt-1">Leave blank if less than 1mth</p>
                </div>
                <div className="mb-4">
                  <span className="text-[10px] font-black uppercase text-black/50">Frequency</span>
                  <select value={uppFrequency} onChange={(e) => setUppFrequency(e.target.value)} className="w-full text-xs p-2 bg-black/5 rounded-xl">
                    <option value="">Less than once a week</option>
                    <option value="Daily">Daily</option>
                    <option value="3-4x a week">3-4x a week</option>
                    <option value="1-2x a week">1-2x a week</option>
                  </select>
                </div>
              </>
            )}

            <textarea placeholder="Notes" value={uppNotes} onChange={(e) => setUppNotes(e.target.value)} className="w-full text-xs p-3 bg-black/5 rounded-xl mb-4" />
            
            <button onClick={handleSaveUPP} className="w-full py-3 bg-black text-white font-black uppercase text-xs rounded-xl">Save</button>
            <button onClick={() => setSelectedProductForUPP(null)} className="w-full py-2 text-[10px] font-black uppercase text-black/50 mt-2">Cancel</button>
          </motion.div>
        </div>
      )}

      {/* Bottom Nav Hint */}
      {(appState === AppState.PROGRESS || appState === AppState.DASHBOARD || appState === AppState.RANK || appState === AppState.TRACKER || appState === AppState.SOCIAL) && (
        <div className="fixed bottom-0 left-0 right-0 flex justify-center bg-gradient-to-t from-white to-transparent z-40">
          <div className="clean-card py-3 px-6 flex justify-between md:justify-center gap-6 md:gap-8 items-center w-full md:w-auto bg-white border-t-2 md:border-2 border-black/5 shadow-2xl md:rounded-3xl">
            <Home className={`w-6 h-6 text-black cursor-pointer ${appState === AppState.DASHBOARD ? '' : 'opacity-30'}`} onClick={() => setAppState(AppState.DASHBOARD)} />
            <div className="w-px h-4 bg-black/10 hidden md:block" />
            <button
              onClick={() => navFileInputRef.current?.click()}
              disabled={isNavScanning}
              className="cursor-pointer"
            >
              {isNavScanning ? (
                <Loader2 className="w-6 h-6 animate-spin text-black" />
              ) : (
                <Camera className="w-6 h-6 opacity-30 hover:opacity-100 text-black" />
              )}
            </button>
            <div className="w-px h-4 bg-black/10 hidden md:block" />
            <CheckSquare className={`w-6 h-6 hover:opacity-100 cursor-pointer text-black ${appState === AppState.TRACKER ? '' : 'opacity-30'}`} onClick={() => setAppState(AppState.TRACKER)} />
            <div className="w-px h-4 bg-black/10 hidden md:block" />
            <Heart className={`w-6 h-6 hover:opacity-100 cursor-pointer text-black ${appState === AppState.SOCIAL ? '' : 'opacity-30'}`} onClick={() => { setAppState(AppState.SOCIAL); setIsFollowsOpen(false); }} />
          </div>
        </div>
      )}

      <ComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        newProduct={newProductForComparison}
        userId={user?.id}
        onComplete={async (score, isBest) => {
          setIsComparisonModalOpen(false);
          if (newProductForComparison) {
            // 1. Update the new product's score
            const { error } = await supabase
              .from('upp')
              .update({ personal_score: score })
              .eq('id', newProductForComparison.id);
            
            if (error) {
              console.error('Error updating score:', error);
              setError('Failed to update product ranking.');
            } else if (isBest) {
              // 2. Relative drifting: nudge lower items down
              const { error: nudgeError } = await supabase
                .rpc('nudge_lower_scores', { 
                  p_user_id: user?.id, 
                  p_category: 'Used', 
                  p_impression: newProductForComparison.impression,
                  p_exclude_id: newProductForComparison.id,
                  p_type: newProductForComparison.type
                });
              if (nudgeError) console.error('Nudge error:', nudgeError);
            }
            // 3. Forced refresh after ranking update
            const { data: refreshedProducts } = await supabase.from('upp').select('*').eq('user_id', user?.id);
            if (refreshedProducts) {
                setUserProducts(refreshedProducts);
            }
          }
          setNewProductForComparison(null);
        }}
      />
      <TrackerNewProductModal
        isOpen={isTrackerModalOpen}
        onClose={() => setIsTrackerModalOpen(false)}
        userId={user?.id}
        onSave={fetchTrackerData}
      />
      {isSharingOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-6 rounded-3xl w-full max-w-sm">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-4">Share Routine</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Search usernames..." 
                value={usernameSearch} 
                onChange={(e) => setUsernameSearch(e.target.value)}
                className="w-full text-xs p-3 bg-black/5 rounded-xl"
              />
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {userResults.map(u => (
                  <button key={u.id} onClick={() => handleShareRoutine(u.id)} className="w-full text-left p-3 hover:bg-black/5 rounded-xl text-xs font-black uppercase">
                    {u.username}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => { setIsSharingOpen(false); setUsernameSearch(''); }} className="w-full py-2 text-[10px] font-black uppercase text-black/50 mt-4">Cancel</button>
          </motion.div>
        </div>
      )}
      {error && <ErrorModal error={error} onClose={() => setError(null)} />}
      {authPromptModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full relative space-y-4 text-center">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-black transition" onClick={() => setAuthPromptModalOpen(false)}>
              <X className="w-5 h-5"/>
            </button>
            <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto text-black">
              <UserIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-black">
              Log In or Sign Up to add this to your tracker
            </h3>
            <p className="text-xs text-black/60">
              Create an account or log in to track your skincare routine, products, and skin progress.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setAuthPromptModalOpen(false);
                  setIsSignUp(false);
                  setAppState(AppState.AUTH);
                }}
                className="flex-1 bg-black text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-venus-accent transition-all cursor-pointer"
              >
                Log In
              </button>
              <button
                onClick={() => {
                  setAuthPromptModalOpen(false);
                  setIsSignUp(true);
                  setAppState(AppState.AUTH);
                }}
                className="flex-1 bg-black/10 text-black py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black/20 transition-all cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      )}
      <ProductConfirmationModal
        isOpen={isDashboardConfirmOpen}
        products={dashboardScanMatched}
        onConfirm={handleDashboardConfirmScan}
        onCancel={() => setIsDashboardConfirmOpen(false)}
        user={user}
        onLogin={(confirmed) => {
          localStorage.setItem('cachedLandingProducts', JSON.stringify(confirmed));
          setAppState(AppState.AUTH);
          setIsDashboardConfirmOpen(false);
        }}
      />
      <ProductConfirmationModal
        isOpen={isNavConfirmOpen}
        products={navScanMatched}
        onConfirm={handleNavConfirmScan}
        onCancel={() => setIsNavConfirmOpen(false)}
        user={user}
        onLogin={(confirmed) => {
          localStorage.setItem('cachedLandingProducts', JSON.stringify(confirmed));
          setAppState(AppState.AUTH);
          setIsNavConfirmOpen(false);
        }}
      />

      {/* Global Analysis/Scanning Backdrop Loader */}
      {(isLandingScanning || isNavScanning || isDashboardScanning || isLandingEvaluating) && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/65 backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl max-w-xs text-center border-2 border-black/5">
            <Loader2 className="w-10 h-10 animate-spin text-venus-accent" />
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-black">
                {isLandingEvaluating ? "Evaluating Skin Fit..." : "Analyzing Photo..."}
              </p>
              {isLandingEvaluating && (
                <p className="text-xs text-black/50 mt-1 font-mono">
                  Running compatibility checks
                </p>
              )}
            </div>
          </div>
        </div>
      )}



      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={navFileInputRef}
        onChange={handleNavPhotoScan}
        className="hidden"
      />
    </div>
  </>
);
}
