/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
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
  ExternalLink,
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
  Users,
  Camera,
  Loader2,
  ChevronDown,
  Droplet,
  Shield,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Sliders,
  Check,
  MessageSquare,
  HelpCircle
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase, recoverSupabaseSession } from './lib/supabase';
import { ProductCardProvider, useProductCard } from './context/ProductCardContext';
import { Login } from './components/Login';
import { ProductDetailModalNew } from './components/ProductDetailModalNew';
import { ProductCard, ProductCardContent, computeProductKeyBenefits } from './components/ProductCard';
import { ProductLink } from './components/ProductLink';
import { ComparisonModal } from './components/ComparisonModal';
import { AiProductComparisonModal } from './components/AiProductComparisonModal';
import { ProductComparisonTable } from './components/ProductComparisonTable';
import { TrackerNewProductModal } from './components/TrackerNewProductModal';
import { Social, SKINCARE_GUIDES } from './components/Social';
import { TikTokPlayer } from './components/TikTokPlayer';
import { ChatQuestionnaire } from './components/ChatQuestionnaire';
import { INVENTORY, Product } from './constants';
import { InlineTrackerControls } from './components/InlineTrackerControls';
import { searchProductsFromPhoto, ProductConfirmationModal, MatchedProduct } from './components/photo_search';
import { productSort } from './utils/productsort';
import { searchProducts } from "./utils/TextSearch";
import { TrackerSpreadsheetRow } from './components/TrackerSpreadsheetRow';
import { checkRoutine, RoutineCheckResult, UserProfile, getActivesBudgetExplanation } from './utils/RoutineCheck';
import { getScoreColorConfig } from './utils/scoreColors';
import { fetchRoutinesWithLiveProducts, hydrateRoutineProducts } from './utils/routineFetcher';
import { BREAKOUT_PHOTO_OPTIONS, getBreakoutTitle, breakoutTypeStringToId } from './data/breakoutOptions';
import { setupCapacitorDeepLinkAuth, handleWebAuthCallback, isNativePlatform } from './utils/auth';
import { Browser } from '@capacitor/browser';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { LandingView } from './views/LandingView';
import { FeatureUnavailableModal } from './components/FeatureUnavailableModal';
import { checkPhotoRecognitionLimit, recordPhotoScanUsage } from './utils/photoRecognitionLimit';
import { generateUniqueUsername } from './utils/usernameGenerator';
import { AppState, AvoidedIngredient } from './types';
import { SKIN_CONCERN_OPTIONS, CAT3_MAPPING, ACTIVES_TEXT_MAP, ACTIVE_SKINCARE_OPTIONS, DEFAULT_LANDING_ARTICLES, MOBILE_ROW_LETTERS, MOBILE_DROPDOWN_LETTERS, WEB_ROW_1_LETTERS, WEB_ROW_2_LETTERS } from './config/appConstants';
import { getSkinConcernLabel, getActivesSelectedIds, extractAvoidedIngredientIds, parseAvoidedIngredients } from './utils/profileHelpers';
import { BrandsView } from './views/BrandsView';
import { FeedbackView } from './views/FeedbackView';
import { DeleteAccountView } from './views/DeleteAccountView';
import { ProfileView } from './views/ProfileView';
import { CommunityView } from './views/CommunityView';
import { trackPageView } from './utils/analytics';

function getYouTubeEmbedUrl(url: string): string {
  if (!url) return '';
  if (url.includes('/embed/')) return url;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return url;
}

// --- Components ---

// ... (rest of imports)

const GlowingBackground = ({ appState }: { appState: AppState }) => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-[#FAF9F6]">
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

export default function App() {
  const [isAuthLoading, setIsAuthLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname.startsWith('/auth/callback') || window.location.search.includes('code=') || window.location.hash.includes('code=');
    }
    return false;
  });
  const [isWeb, setIsWeb] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 640);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [appState, setAppState] = useState<AppState>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hasHash = window.location.hash.includes('access_token=') || window.location.hash.includes('code=');
      if (path.startsWith('/privacy')) return AppState.PRIVACY_POLICY;
      if (path.startsWith('/delete-account')) return AppState.DELETE_ACCOUNT;
      if (path.startsWith('/feedback')) return AppState.FEEDBACK;
      if (path.startsWith('/comparison')) return AppState.COMPARISON;
      if (path.startsWith('/community')) return AppState.COMMUNITY;
      if (path.startsWith('/dashboard') || path.startsWith('/auth/callback') || hasHash) return AppState.DASHBOARD;
      if (path.startsWith('/products') || path.startsWith('/rank')) return AppState.RANK;
      if (path.startsWith('/tracker')) return AppState.TRACKER;
      if (path.startsWith('/social')) return AppState.SOCIAL;
      if (path.startsWith('/profile')) return AppState.PROFILE;
      if (path.startsWith('/routines')) return AppState.ROUTINES;
      if (path.startsWith('/onboarding')) return AppState.ONBOARDING_DETAILS;
      if (path.startsWith('/auth')) return AppState.AUTH;
    }
    return AppState.LANDING;
  });

  useEffect(() => {
    let screenName = 'Landing';
    switch (appState) {
      case AppState.LANDING: screenName = 'Landing'; break;
      case AppState.AUTH: screenName = 'Auth'; break;
      case AppState.ONBOARDING_DETAILS: screenName = 'Onboarding'; break;
      case AppState.DASHBOARD: screenName = 'Dashboard'; break;
      case AppState.RANK: screenName = 'Products'; break;
      case AppState.TRACKER: screenName = 'Tracker'; break;
      case AppState.SOCIAL: screenName = 'Social'; break;
      case AppState.PROFILE: screenName = 'Profile'; break;
      case AppState.ROUTINES: screenName = 'Routines'; break;
      case AppState.PRIVACY_POLICY: screenName = 'Privacy Policy'; break;
      case AppState.DELETE_ACCOUNT: screenName = 'Delete Account'; break;
      case AppState.FEEDBACK: screenName = 'Feedback'; break;
      case AppState.COMPARISON: screenName = 'Comparison'; break;
      case AppState.COMMUNITY: screenName = 'Community'; break;
      default: screenName = 'Landing'; break;
    }
    trackPageView(screenName);
  }, [appState]);

  useEffect(() => {
    if (appState === AppState.COMMUNITY && profile !== null && Number(profile?.type) !== 1) {
      setAppState(user ? AppState.DASHBOARD : AppState.LANDING);
    }
  }, [appState, profile, user]);

  const [comparisonProductIds, setComparisonProductIds] = useState<string[]>(['1', '2']);

  useEffect(() => {
    const handleNavigateComparison = (e: any) => {
      if (e.detail?.productIds) {
        setComparisonProductIds(e.detail.productIds);
        setAppState(AppState.COMPARISON);
        window.history.pushState(null, '', '/comparison');
      }
    };
    window.addEventListener('navigate-to-comparison', handleNavigateComparison as EventListener);
    return () => window.removeEventListener('navigate-to-comparison', handleNavigateComparison as EventListener);
  }, []);

  const navigateTo = useCallback((newState: AppState, path?: string) => {
    setAppState(newState);
    if (typeof window !== 'undefined') {
      let urlPath = '/';
      switch (newState) {
        case AppState.LANDING: urlPath = '/'; break;
        case AppState.AUTH: urlPath = '/auth'; break;
        case AppState.ONBOARDING_DETAILS: urlPath = '/onboarding'; break;
        case AppState.DASHBOARD: urlPath = '/dashboard'; break;
        case AppState.RANK: urlPath = '/products'; break;
        case AppState.TRACKER: urlPath = '/tracker'; break;
        case AppState.SOCIAL: urlPath = '/social'; break;
        case AppState.PROFILE: urlPath = '/profile'; break;
        case AppState.ROUTINES: urlPath = '/routines'; break;
        case AppState.PRIVACY_POLICY: urlPath = '/privacy'; break;
        case AppState.DELETE_ACCOUNT: urlPath = '/delete-account'; break;
        case AppState.FEEDBACK: urlPath = '/feedback'; break;
        case AppState.COMPARISON: urlPath = '/comparison'; break;
        case AppState.COMMUNITY: urlPath = '/community'; break;
      }
      if (path) urlPath = path;
      window.history.pushState(null, '', urlPath);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/privacy')) {
          setAppState(AppState.PRIVACY_POLICY);
        } else if (path.startsWith('/delete-account')) {
          setAppState(AppState.DELETE_ACCOUNT);
        } else if (path.startsWith('/feedback')) {
          setAppState(AppState.FEEDBACK);
        } else if (path.startsWith('/comparison')) {
          setAppState(AppState.COMPARISON);
        } else if (path.startsWith('/community')) {
          setAppState(AppState.COMMUNITY);
        } else if (path.startsWith('/dashboard') || path.startsWith('/auth/callback')) {
          setAppState(AppState.DASHBOARD);
        } else if (path.startsWith('/products') || path.startsWith('/rank')) {
          setAppState(AppState.RANK);
        } else if (path.startsWith('/tracker')) {
          setAppState(AppState.TRACKER);
        } else if (path.startsWith('/social')) {
          setAppState(AppState.SOCIAL);
        } else if (path.startsWith('/profile')) {
          setAppState(AppState.PROFILE);
        } else if (path.startsWith('/routines')) {
          setAppState(AppState.ROUTINES);
        } else if (path.startsWith('/onboarding')) {
          setAppState(AppState.ONBOARDING_DETAILS);
        } else if (path.startsWith('/auth')) {
          setAppState(AppState.AUTH);
        } else {
          setAppState(user ? AppState.DASHBOARD : AppState.LANDING);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  const [landingGuide, setLandingGuide] = useState<any>(SKINCARE_GUIDES[0]);

  useEffect(() => {
    const fetchLandingGuide = async () => {
      try {
        const { data, error } = await supabase
          .from('guides')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) {
          console.error('Guides query error:', { message: error.message, code: error.code, details: error.details });
        } else if (data && data.length > 0) {
          const g = data[0];
          setLandingGuide({
            id: g.id,
            category: g.category,
            title: g.title,
            readTime: g.read_time || '4 min read',
            subtitle: g.subtitle,
            summary: g.description,
            type: g.type || 'A',
            typeBContent: g.type === 'B' ? (g.roadmap || {}) : undefined,
            keyRule: g.rule,
            steps: g.type === 'B' ? [] : (g.roadmap || []),
            dos: g.dos || [],
            donts: g.donts || [],
            recommendedActives: g.recommended_formulations || [],
            imageUrl: g.guide_url || g.image_url || '/assets/g1.jpg'
          });
        }
      } catch (err: any) {
        console.error('Guides query exception:', { message: err?.message || err, code: err?.code, details: err?.details });
      }
    };
    fetchLandingGuide();
  }, []);



  useEffect(() => {
    const handleResize = () => {
      setIsWeb(typeof window !== 'undefined' && window.innerWidth >= 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { openProductCard } = useProductCard();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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
  const [selectedCommunityRoutine, setSelectedCommunityRoutine] = useState<any | null>(null);
  const [isModalTikTokActive, setIsModalTikTokActive] = useState(false);
  const handleOpenCommunityRoutine = (rt: any) => {
    setIsModalTikTokActive(false);
    setSelectedCommunityRoutine(rt);
  };
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
  const headerSearchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerSearchQuery.trim()) {
      setHeaderSearchResults([]);
      setIsHeaderSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsHeaderSearching(true);
      const query = headerSearchQuery.trim();

      try {
        const data = await searchProducts(query, 'All', 15);
        setHeaderSearchResults(data || []);
      } catch (err) {
        setHeaderSearchResults([]);
      } finally {
        setIsHeaderSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [headerSearchQuery]);

  const resetHeaderSearchState = () => {
    setHeaderSearchQuery('');
    setHeaderSearchResults([]);
    setIsHeaderSearchDropdownOpen(false);
  };

  // Close header search dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        headerSearchContainerRef.current &&
        !headerSearchContainerRef.current.contains(event.target as Node) &&
        headerSearchDropdownRef.current &&
        !headerSearchDropdownRef.current.contains(event.target as Node)
      ) {
        setIsHeaderSearchDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHeaderSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [expandedRoutines, setExpandedRoutines] = useState<number[]>([]);
  const [routineChecks, setRoutineChecks] = useState<Record<string, RoutineCheckResult>>({});
  const [routineProductScores, setRoutineProductScores] = useState<Record<string, any>>({});
  const [routinesVersion, setRoutinesVersion] = useState(0);
  const [isRefreshingRoutines, setIsRefreshingRoutines] = useState(false);

  const getBenefitsForProduct = (p: any, s: any) => {
    return computeProductKeyBenefits(p, s);
  };

  const getActiveRoutineProducts = (products: any[], routineTime: string) => {
    return products || [];
  };

  const refreshRoutines = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;
    setIsRefreshingRoutines(true);
    try {
      const liveRoutines = await fetchRoutinesWithLiveProducts(user.id, signal);
      setRoutines(liveRoutines);
      setRoutinesVersion(v => v + 1);
    } catch (err) {
    } finally {
      setIsRefreshingRoutines(false);
    }
  }, [user]);

  const toggleRoutineExpansion = (idx: number) => {
    setExpandedRoutines(prev => {
      const willExpand = !prev.includes(idx);
      if (willExpand) {
        refreshRoutines();
      }
      return willExpand ? [...prev, idx] : prev.filter(i => i !== idx);
    });
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isSignUp, setIsSignUp] = useState(false);
  const [pendingQuestionnaireAnswers, setPendingQuestionnaireAnswers] = useState<any>(null); // NEW
  const [isQuizBannerDismissed, setIsQuizBannerDismissed] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [isAiCompareModalOpen, setIsAiCompareModalOpen] = useState(false);
  const [isTrackerModalOpen, setIsTrackerModalOpen] = useState(false);
  const [authPromptModalOpen, setAuthPromptModalOpen] = useState(false);
  const [isSharingOpen, setIsSharingOpen] = useState(false);
  const [shareRoutine, setShareRoutine] = useState<any>(null);
  const [usernameSearch, setUsernameSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [newProductForComparison, setNewProductForComparison] = useState<any | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [isFollowsOpen, setIsFollowsOpen] = useState(false);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [editMainConcern, setEditMainConcern] = useState<number>(12);
  const [editScndConcern, setEditScndConcern] = useState<number>(12);
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [goalsSaveError, setGoalsSaveError] = useState<string | null>(null);

  // Profile editing states for skin type, barrier status, and breakout types
  const [isEditingSkinType, setIsEditingSkinType] = useState(false);
  const [editSkinTypeVal, setEditSkinTypeVal] = useState('normal');
  const [isSavingSkinType, setIsSavingSkinType] = useState(false);
  const [skinTypeSaveError, setSkinTypeSaveError] = useState<string | null>(null);

  const [isEditingBarrier, setIsEditingBarrier] = useState(false);
  const [editSensitivity, setEditSensitivity] = useState<string[]>([]);
  const [editReaction, setEditReaction] = useState('Very good, no problems');
  const [isSavingBarrier, setIsSavingBarrier] = useState(false);
  const [barrierSaveError, setBarrierSaveError] = useState<string | null>(null);

  const [isEditingBreakout, setIsEditingBreakout] = useState(false);
  const [editBreakoutTypes, setEditBreakoutTypes] = useState<number[]>([]);
  const [isSavingBreakout, setIsSavingBreakout] = useState(false);
  const [breakoutSaveError, setBreakoutSaveError] = useState<string | null>(null);

  const [isEditingPregnant, setIsEditingPregnant] = useState(false);
  const [editPregnantVal, setEditPregnantVal] = useState('No');
  const [isSavingPregnant, setIsSavingPregnant] = useState(false);
  const [pregnantSaveError, setPregnantSaveError] = useState<string | null>(null);

  const [isEditingActives, setIsEditingActives] = useState(false);
  const [editActivesVal, setEditActivesVal] = useState<number[]>([]);
  const [isSavingActives, setIsSavingActives] = useState(false);
  const [activesSaveError, setActivesSaveError] = useState<string | null>(null);

  const [isEditingPastProblems, setIsEditingPastProblems] = useState(false);
  const [editPastProblemsVal, setEditPastProblemsVal] = useState<AvoidedIngredient[]>([]);
  const [newProblemInput, setNewProblemInput] = useState('');
  const [ingredientSuggestions, setIngredientSuggestions] = useState<AvoidedIngredient[]>([]);
  const [isIngredientSuggestionsOpen, setIsIngredientSuggestionsOpen] = useState(false);
  const [isSavingPastProblems, setIsSavingPastProblems] = useState(false);
  const [pastProblemsSaveError, setPastProblemsSaveError] = useState<string | null>(null);
  const [avoidedIngredientNames, setAvoidedIngredientNames] = useState<Record<number, string>>({});

  useEffect(() => {
    const ids = extractAvoidedIngredientIds(userProfile?.past_problems);
    if (ids.length === 0) return;

    const needed = ids.filter(id => !avoidedIngredientNames[id]);
    if (needed.length === 0) return;

    let isMounted = true;
    supabase
      .from('ingredient_scores')
      .select('id, ingredient')
      .in('id', needed)
      .then(({ data, error }) => {
        if (!error && data && isMounted) {
          setAvoidedIngredientNames(prev => {
            const next = { ...prev };
            data.forEach((d: any) => {
              if (d.id && d.ingredient) {
                next[d.id] = d.ingredient;
              }
            });
            return next;
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userProfile?.past_problems]);

  useEffect(() => {
    const q = newProblemInput.trim();
    if (!isEditingPastProblems || q.length < 2) {
      setIngredientSuggestions([]);
      setIsIngredientSuggestionsOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('ingredient_scores')
          .select('id, ingredient')
          .ilike('ingredient', `%${q}%`)
          .limit(10);
        if (!error && data) {
          const map = new Map<string, AvoidedIngredient>();
          data.forEach((d: any) => {
            if (d.ingredient && !map.has(d.ingredient.toLowerCase())) {
              map.set(d.ingredient.toLowerCase(), {
                id: d.id,
                name: d.ingredient
              });
            }
          });
          const unique = Array.from(map.values());
          setIngredientSuggestions(unique);
          setIsIngredientSuggestionsOpen(unique.length > 0);
        }
      } catch {
        // silent
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [newProblemInput, isEditingPastProblems]);

  const handleAddProblemIngredient = async () => {
    const trimmed = newProblemInput.trim();
    if (!trimmed) return;

    if (editPastProblemsVal.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewProblemInput('');
      setIsIngredientSuggestionsOpen(false);
      return;
    }

    const matchedSug = ingredientSuggestions.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
    if (matchedSug && matchedSug.id !== null) {
      setEditPastProblemsVal(prev => [...prev, matchedSug]);
      setAvoidedIngredientNames(prev => ({ ...prev, [matchedSug.id!]: matchedSug.name }));
      setNewProblemInput('');
      setIsIngredientSuggestionsOpen(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('ingredient_scores')
        .select('id, ingredient')
        .ilike('ingredient', trimmed)
        .limit(1);
      if (data && data.length > 0) {
        const item: AvoidedIngredient = { id: data[0].id, name: data[0].ingredient };
        setEditPastProblemsVal(prev => [...prev, item]);
        setAvoidedIngredientNames(prev => ({ ...prev, [item.id!]: item.name }));
      } else {
        const { data: partial } = await supabase
          .from('ingredient_scores')
          .select('id, ingredient')
          .ilike('ingredient', `%${trimmed}%`)
          .limit(1);
        if (partial && partial.length > 0) {
          const item: AvoidedIngredient = { id: partial[0].id, name: partial[0].ingredient };
          setEditPastProblemsVal(prev => [...prev, item]);
          setAvoidedIngredientNames(prev => ({ ...prev, [item.id!]: item.name }));
        } else {
          setPastProblemsSaveError(`Could not find "${trimmed}" in the ingredient database. Please select an ingredient from the list.`);
          return;
        }
      }
    } catch {
      setPastProblemsSaveError('Error searching ingredient database');
      return;
    }

    setNewProblemInput('');
    setIngredientSuggestions([]);
    setIsIngredientSuggestionsOpen(false);
  };

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUsernameVal, setEditUsernameVal] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameSaveError, setUsernameSaveError] = useState<string | null>(null);

  const handleSaveUsername = async () => {
    if (!user?.id) return;
    setIsSavingUsername(true);
    setUsernameSaveError(null);
    const trimmedUsername = editUsernameVal.trim();
    if (!trimmedUsername) {
      setUsernameSaveError('Username cannot be empty');
      setIsSavingUsername(false);
      return;
    }

    // Check if username is already taken by another user
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('username', trimmedUsername)
      .neq('id', user.id);

    if (existing && existing.length > 0) {
      setUsernameSaveError('username already taken');
      setIsSavingUsername(false);
      return;
    }

    const username = trimmedUsername;
    try {
      const { data, error } = await supabase
        .from('users')
        .upsert({ id: user.id, username }, { onConflict: 'id' })
        .select();
      if (error) throw error;
      setProfile((prev: any) => prev ? { ...prev, username } : { username });
      setIsEditingUsername(false);
    } catch (err: any) {
      setUsernameSaveError(err?.message || 'Failed to update username');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleSaveSkinType = async () => {
    if (!user?.id) return;
    setIsSavingSkinType(true);
    setSkinTypeSaveError(null);
    try {
      const feelMap: Record<string, string> = {
        'Dry and tight': 'dry',
        'Oily all over': 'oily',
        'Comfortable': 'normal',
        'Oily forehead and nose, but dry cheeks': 'combination',
        'dry': 'dry',
        'oily': 'oily',
        'combination': 'combination',
        'normal': 'normal'
      };
      const resolvedType = feelMap[editSkinTypeVal] || editSkinTypeVal;
      const { error } = await supabase
        .from('user_profile')
        .upsert({ id: user.id, skin_type: resolvedType });
      if (error) throw error;
      setUserProfile((prev: any) => prev ? { ...prev, skin_type: resolvedType } : { skin_type: resolvedType });
      setIsEditingSkinType(false);
    } catch (err: any) {
      setSkinTypeSaveError(err?.message || 'Failed to update skin type');
    } finally {
      setIsSavingSkinType(false);
    }
  };

  const handleSaveBarrier = async () => {
    if (!user?.id) return;
    setIsSavingBarrier(true);
    setBarrierSaveError(null);
    try {
      const reactionMap: Record<string, number> = {
        'Very good, no problems': 0,
        'Sometimes sensitive': 1,
        'Often get redness, bumps, or burning': 2,
        'Almost everything irritates my skin': 3
      };
      const symptomsScore = editSensitivity.length;
      const reactionScore = reactionMap[editReaction] || 0;
      const barrierScore = symptomsScore + reactionScore;

      const { error } = await supabase
        .from('user_profile')
        .upsert({
          id: user.id,
          barrier_status: barrierScore,
          sensitivity: editSensitivity,
          skin_characteristics: symptomsScore,
          new_product_reaction: reactionScore
        });
      if (error) throw error;
      setUserProfile((prev: any) => prev ? {
        ...prev,
        barrier_status: barrierScore,
        sensitivity: editSensitivity,
        skin_characteristics: symptomsScore,
        new_product_reaction: reactionScore
      } : {
        barrier_status: barrierScore,
        sensitivity: editSensitivity,
        skin_characteristics: symptomsScore,
        new_product_reaction: reactionScore
      });
      setIsEditingBarrier(false);
    } catch (err: any) {
      setBarrierSaveError(err?.message || 'Failed to update skin barrier status');
    } finally {
      setIsSavingBarrier(false);
    }
  };

  const handleSaveBreakout = async () => {
    if (!user?.id) return;
    setIsSavingBreakout(true);
    setBreakoutSaveError(null);
    try {
      const isBreakoutActive = Boolean(
        userProfile?.main_concern === 1 ||
        userProfile?.scnd_concern === 1 ||
        editMainConcern === 1 ||
        editScndConcern === 1
      );
      const breakoutPayload = isBreakoutActive ? editBreakoutTypes.slice(0, 1) : editBreakoutTypes;
      const { error } = await supabase
        .from('user_profile')
        .upsert({ id: user.id, breakout_type: breakoutPayload });
      if (error) throw error;
      setUserProfile((prev: any) => prev ? { ...prev, breakout_type: breakoutPayload } : { breakout_type: breakoutPayload });
      setIsEditingBreakout(false);
    } catch (err: any) {
      setBreakoutSaveError(err?.message || 'Failed to update breakout types');
    } finally {
      setIsSavingBreakout(false);
    }
  };

  const handleSavePregnant = async () => {
    if (!user?.id) return;
    setIsSavingPregnant(true);
    setPregnantSaveError(null);
    try {
      const { error } = await supabase
        .from('user_profile')
        .upsert({ id: user.id, pregnant: editPregnantVal });
      if (error) throw error;
      setUserProfile((prev: any) => prev ? { ...prev, pregnant: editPregnantVal } : { pregnant: editPregnantVal });
      setIsEditingPregnant(false);
    } catch (err: any) {
      setPregnantSaveError(err?.message || 'Failed to update pregnancy status');
    } finally {
      setIsSavingPregnant(false);
    }
  };

  const handleSaveActives = async () => {
    if (!user?.id) return;
    setIsSavingActives(true);
    setActivesSaveError(null);
    try {
      const { error } = await supabase
        .from('user_profile')
        .upsert({ id: user.id, actives_used: editActivesVal });
      if (error) {
        const { error: retryErr } = await supabase
          .from('user_profile')
          .upsert({ id: user.id, actives_used: editActivesVal.map(String) });
        if (retryErr) throw retryErr;
      }
      setUserProfile((prev: any) => prev ? { ...prev, actives_used: editActivesVal } : { actives_used: editActivesVal });
      setIsEditingActives(false);
    } catch (err: any) {
      setActivesSaveError(err?.message || 'Failed to update actives used');
    } finally {
      setIsSavingActives(false);
    }
  };

  const handleSavePastProblems = async () => {
    if (!user?.id) return;
    setIsSavingPastProblems(true);
    setPastProblemsSaveError(null);
    try {
      const rawIds: number[] = [];
      for (const item of editPastProblemsVal) {
        if (typeof item.id === 'number' && !isNaN(item.id) && item.id > 0) {
          rawIds.push(item.id);
        } else if (item.id) {
          const parsed = parseInt(String(item.id), 10);
          if (!isNaN(parsed) && parsed > 0) rawIds.push(parsed);
        } else if (item.name) {
          const match = item.name.match(/^Ingredient\s*#(\d+)$/i);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (!isNaN(parsed) && parsed > 0) rawIds.push(parsed);
          }
        }
      }
      const uniqueIds = Array.from(new Set(rawIds));

      const { error } = await supabase
        .from('user_profile')
        .upsert({ id: user.id, past_problems: uniqueIds });

      if (error) {
        if (error.message?.toLowerCase().includes('text') || error.code === '42804') {
          const { error: stringifyErr } = await supabase
            .from('user_profile')
            .upsert({ id: user.id, past_problems: JSON.stringify(uniqueIds) });
          if (stringifyErr) throw stringifyErr;
        } else {
          throw error;
        }
      }

      setUserProfile((prev: any) => prev ? { ...prev, past_problems: uniqueIds } : { past_problems: uniqueIds });
      setIsEditingPastProblems(false);
    } catch (err: any) {
      setPastProblemsSaveError(err?.message || 'Failed to update ingredients to avoid');
    } finally {
      setIsSavingPastProblems(false);
    }
  };

  const handleSaveGoals = async () => {
    if (!user?.id) return;
    setIsSavingGoals(true);
    setGoalsSaveError(null);
    try {
      const hadBreakoutGoal = Number(userProfile?.main_concern) === 1 || Number(userProfile?.scnd_concern) === 1;
      const willHaveBreakoutGoal = editMainConcern === 1 || editScndConcern === 1;

      const hasBreakoutCharacteristics = Boolean(
        (Array.isArray(userProfile?.breakout_type) && userProfile.breakout_type.length > 0) ||
        (typeof userProfile?.breakout_type === 'number' && !isNaN(userProfile.breakout_type)) ||
        (typeof userProfile?.breakout_type === 'string' && userProfile.breakout_type.trim() !== '')
      );

      const shouldRemoveBreakouts = !willHaveBreakoutGoal && (hadBreakoutGoal || hasBreakoutCharacteristics);

      const updatePayload: any = {
        id: user.id,
        main_concern: editMainConcern,
        scnd_concern: editScndConcern,
      };

      if (shouldRemoveBreakouts) {
        updatePayload.breakout_type = null;
      }

      const { error: updateError } = await supabase
        .from('user_profile')
        .upsert(updatePayload);

      if (updateError) {
        throw updateError;
      }

      setUserProfile((prev: any) => prev ? {
        ...prev,
        main_concern: editMainConcern,
        scnd_concern: editScndConcern,
        ...(shouldRemoveBreakouts ? { breakout_type: null } : {})
      } : {
        main_concern: editMainConcern,
        scnd_concern: editScndConcern,
        ...(shouldRemoveBreakouts ? { breakout_type: null } : {})
      });

      if (shouldRemoveBreakouts) {
        setEditBreakoutTypes([]);
        setIsEditingBreakout(false);
      }

      setIsEditingGoals(false);

      // If user edits target skin goals to choose 'Breakouts & post-breakout marks' (id 1), open up breakout type choices restricted to 1
      if (willHaveBreakoutGoal) {
        const currentBreakout = Array.isArray(userProfile?.breakout_type) 
          ? userProfile.breakout_type 
          : (userProfile?.breakout_type ? [userProfile.breakout_type] : []);
        const normalized = currentBreakout
          .map((b: any) => typeof b === 'number' ? b : parseInt(String(b), 10))
          .filter((n: number) => !isNaN(n));
        setEditBreakoutTypes(normalized.slice(0, 1));
        setIsEditingBreakout(true);
      }
    } catch (err: any) {
      setGoalsSaveError(err?.message || 'Failed to update skin goals');
    } finally {
      setIsSavingGoals(false);
    }
  };
  const [socialActiveMainTab, setSocialActiveMainTab] = useState<'videos' | 'articles' | 'guides' | 'community'>('videos');
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [latestVideos, setLatestVideos] = useState<any[]>([]);
  const [activeAppTikTokId, setActiveAppTikTokId] = useState<string | null>(null);
  const [lastPost, setLastPost] = useState<any>(null);
  const [loadingLatestVideos, setLoadingLatestVideos] = useState(true);
  const [loadingLastPost, setLoadingLastPost] = useState(true);



  // Brands page states
  const [selectedBrandsLetter, setSelectedBrandsLetter] = useState<string | null>(null);
  const [selectedBrandItem, setSelectedBrandItem] = useState<any | null>(null);

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


  const [showFeatureUnavailable, setShowFeatureUnavailable] = useState(false);
  const [authPromptConfig, setAuthPromptConfig] = useState<{
    title: string;
    description: string;
  } | null>(null);

  const openAuthPromptModal = (title?: string, description?: string) => {
    if (title || description) {
      setAuthPromptConfig({
        title: title || "Log In or Sign Up",
        description: description || "Create an account or log in to continue.",
      });
    } else {
      setAuthPromptConfig({
        title: "Log In or Sign Up to use this feature",
        description: "Create an account or log in to check ingredients, compare skincare products and track your routine.",
      });
    }
    setAuthPromptModalOpen(true);
  };

  const triggerPhotoScan = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    const limitCheck = checkPhotoRecognitionLimit(user);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'REQUIRE_AUTH') {
        openAuthPromptModal(
          "Sign in or sign up",
          "You've used your 1 free photo recognition scan. Please sign in or create an account to continue."
        );
      } else {
        setShowFeatureUnavailable(true);
      }
      return;
    }
    inputRef.current?.click();
  };

  const fetchTrackerData = useCallback(async (customUserId?: string) => {
    const uid = customUserId || user?.id;
    if (!uid) return;
    try {
      const { data, error } = await supabase
        .from('tracker')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) {
        return;
      }
      if (data) {
        setTrackerData(data);
      }
    } catch (err) {
    }
  }, [user]);

  const handleTrackerProductAdded = useCallback((newProduct?: any) => {
    if (newProduct) {
      setTrackerData(prev => {
        const exists = prev.some(item => 
          (newProduct.id && item.id === newProduct.id) ||
          (item.brand === newProduct.brand && item.product_name === newProduct.product_name && item.routine_time === newProduct.routine_time)
        );
        if (exists) {
          return prev.map(item => 
            ((newProduct.id && item.id === newProduct.id) || 
             (item.brand === newProduct.brand && item.product_name === newProduct.product_name && item.routine_time === newProduct.routine_time))
              ? { ...item, ...newProduct }
              : item
          );
        }
        return [newProduct, ...prev];
      });
    }
    fetchTrackerData();
  }, [fetchTrackerData]);

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
      fetchTrackerData(user?.id);
    } catch (err: any) {
      setError(`Failed to add product to tracker: ${err.message}`);
    }
  };

  const handleDashboardPhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const limitCheck = checkPhotoRecognitionLimit(user);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'REQUIRE_AUTH') {
        openAuthPromptModal(
          "Sign in or sign up",
          "You've used your 1 free photo recognition scan. Please sign in or create an account to continue."
        );
      } else {
        setShowFeatureUnavailable(true);
      }
      if (dashboardFileInputRef.current) {
        dashboardFileInputRef.current.value = '';
      }
      return;
    }

    setIsDashboardScanning(true);
    setDashboardScanError(null);

    try {
      const matches = await searchProductsFromPhoto(file);
      recordPhotoScanUsage(user);
      setDashboardScanMatched(matches);
      setIsDashboardConfirmOpen(true);
    } catch (err: any) {
      setDashboardScanError(err.message || 'Photo scan failed. Please try again.');
    } finally {
      setIsDashboardScanning(false);
      if (dashboardFileInputRef.current) {
        dashboardFileInputRef.current.value = '';
      }
    }
  };

  const handleNavPhotoScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const limitCheck = checkPhotoRecognitionLimit(user);
    if (!limitCheck.allowed) {
      if (limitCheck.reason === 'REQUIRE_AUTH') {
        openAuthPromptModal(
          "Sign in or sign up",
          "You've used your 1 free photo recognition scan. Please sign in or create an account to continue."
        );
      } else {
        setNavScanError("Photo recognition limit reached. Please sign in.");
      }
      if (navFileInputRef.current) {
        navFileInputRef.current.value = '';
      }
      return;
    }

    setIsNavScanning(true);
    setNavScanError(null);

    try {
      const matches = await searchProductsFromPhoto(file);
      recordPhotoScanUsage(user);
      setNavScanMatched(matches);
      setIsNavConfirmOpen(true);
    } catch (err: any) {
      setNavScanError(err.message || 'Photo scan failed. Please try again.');
    } finally {
      setIsNavScanning(false);
      if (navFileInputRef.current) {
        navFileInputRef.current.value = '';
      }
    }
  };

  // Failsafe watchdog timer: ensure photo scanning / evaluation loader can never hang indefinitely
  useEffect(() => {
    if (isNavScanning || isDashboardScanning) {
      const watchdog = setTimeout(() => {
        setIsNavScanning(false);
        setIsDashboardScanning(false);
        setNavScanError('Photo scan timed out. Please try again.');
        setDashboardScanError('Photo scan timed out. Please try again.');
      }, 30000);
      return () => clearTimeout(watchdog);
    }
  }, [isNavScanning, isDashboardScanning]);

  const handleNavConfirmScan = async (confirmed: MatchedProduct[]) => {
    setIsNavConfirmOpen(false);
    if (confirmed.length === 0) return;

    if (!user) {
        localStorage.setItem('cachedLandingProducts', JSON.stringify(confirmed));
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
      setNavScanError("Failed to save scanned products to tracker.");
    }
  };

  const handleDashboardConfirmScan = async (confirmed: MatchedProduct[]) => {
    setIsDashboardConfirmOpen(false);
    if (confirmed.length === 0) return;

    if (!user) {
        localStorage.setItem('cachedLandingProducts', JSON.stringify(confirmed));
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
    let isMounted = true;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchLastVideoAndPost = async () => {
      try {
        const { data: videoData } = await supabase
          .from('blog_videos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3)
          .abortSignal(signal);

        if (videoData && isMounted && !signal.aborted) {
          setLatestVideos(videoData);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) return;
      } finally {
        if (isMounted) setLoadingLatestVideos(false);
      }

      try {
        const { data: postData } = await supabase
          .from('posts')
          .select(`
            *,
            users (
              username
            )
          `)
          .order('timestamp', { ascending: false })
          .limit(1)
          .abortSignal(signal)
          .maybeSingle();

        if (postData && isMounted && !signal.aborted) {
          setLastPost(postData);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) return;
      } finally {
        if (isMounted) setLoadingLastPost(false);
      }
    };

    fetchLastVideoAndPost();

    // Setup single consolidated realtime subscription for blog/community content
    const blogSyncChannel = supabase.channel('blog-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blog_videos' }, async () => {
        const { data } = await supabase
          .from('blog_videos')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        if (data && isMounted) setLatestVideos(data);
      })
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
        if (data && isMounted) setLastPost(data);
      })
      .subscribe();

    return () => {
      isMounted = false;
      abortController.abort();
      supabase.removeChannel(blogSyncChannel);
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
        return;
    }
    
    const { error } = await supabase
        .from('routines')
        .insert({
            user_id: targetUserId,
            routine_name: shareRoutine.routine_name,
            time: shareRoutine.time,
            products: shareRoutine.products,
            notes: shareRoutine.notes
        });
    
    if (error) {} else {
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
            past_problems: extractAvoidedIngredientIds(answers.pastProblems),
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
        
        // Graceful retry fallback if past_problems is still a text column
        if (profileError && (profileError.message?.toLowerCase().includes('text') || profileError.code === '42804')) {
            const retryWithTextPastProblems = {
              ...profilePayload,
              past_problems: JSON.stringify(profilePayload.past_problems)
            };
            const { error: retryError } = await supabase
              .from('user_profile')
              .upsert(retryWithTextPastProblems);
            profileError = retryError;
        }

        // Graceful retry fallback if the new face scan columns or sex/pregnant/actives_used columns do not exist in the backend database yet
        if (profileError && (profileError.message.toLowerCase().includes('column') || profileError.code === '42703')) {
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileNavOpen) {
        setIsMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavOpen]);
  
  const [routineTime, setRoutineTime] = useState<'AM'|'PM'>('AM');
  const [routineDays, setRoutineDays] = useState<string[]>([]);
  const [routineSelectedProducts, setRoutineSelectedProducts] = useState<any[]>([]);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ brand: '', name: '', type: '' });
  const [routineName, setRoutineName] = useState('');
  const [routineNotes, setRoutineNotes] = useState('');
  const [routinePublic, setRoutinePublic] = useState(false);
  const [routineUrl, setRoutineUrl] = useState('');
  const [publicRoutines, setPublicRoutines] = useState<any[]>([]);

  const fetchPublicRoutines = async () => {
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('public', true)
        .order('votes_count', { ascending: false });
      if (!error && data) {
        const hydrated = await hydrateRoutineProducts(data);
        setPublicRoutines(hydrated);
      }
    } catch (e) {
      console.error('Error fetching public routines:', e);
    }
  };

  useEffect(() => {
    fetchPublicRoutines();
  }, []);

  const handleVoteRoutine = async (routineId: string) => {
    try {
      const target = publicRoutines.find(r => r.id === routineId);
      if (!target) return;
      const newVotes = (target.votes_count || 0) + 1;
      const { error } = await supabase
        .from('routines')
        .update({ votes_count: newVotes })
        .eq('id', routineId);
      if (!error) {
        fetchPublicRoutines();
      }
    } catch (e) {
      console.error('Error voting routine:', e);
    }
  };
  
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
    const handleOpenLoginModal = () => {
      setIsSignUp(false);
      setAppState(AppState.AUTH);
    };
    const handleOpenAuthPrompt = (e: any) => {
      const detail = e.detail || {};
      openAuthPromptModal(detail.title, detail.description);
    };
    const handleShowUnavailable = () => {
      setShowFeatureUnavailable(true);
    };
    window.addEventListener('open-quiz-or-login', handleOpenQuizOrLogin);
    window.addEventListener('open-login-modal', handleOpenLoginModal);
    window.addEventListener('open-auth-prompt', handleOpenAuthPrompt);
    window.addEventListener('show-feature-unavailable', handleShowUnavailable);
    return () => {
      window.removeEventListener('open-quiz-or-login', handleOpenQuizOrLogin);
      window.removeEventListener('open-login-modal', handleOpenLoginModal);
      window.removeEventListener('open-auth-prompt', handleOpenAuthPrompt);
      window.removeEventListener('show-feature-unavailable', handleShowUnavailable);
    };
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
      const data = await searchProducts(query, 'All');
      if (currentId === routineSearchIdRef.current) {
        setRoutineSearchResults(data || []);
      }
    } catch (err) {
      if (currentId === routineSearchIdRef.current) {
        setRoutineSearchResults([]);
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
        throw new Error("Zero rows deleted or matches not found. If this is in your database, please check if your Supabase 'routines' table has a Row Level Security (RLS) policy enabling DELETE permissions for authenticated users.");
      }

      setRoutines(prev => prev.filter(rt => rt.id !== routineToDelete.id));
      setRoutinesVersion(v => v + 1);
      setRoutineToDelete(null);
    } catch (e: any) {
      setError(`Error deleting routine: ${formatSupabaseError(e)}`);
      setRoutineToDelete(null);
    }
  };

  const handleAddRoutine = () => {
    setRoutineName('');
    setRoutineNotes('');
    setRoutineUrl('');
    setRoutineTime('AM');
    setRoutineDays([]);
    setRoutineSelectedProducts([]);
    setRoutinePublic(false);
    setModalMode('new');
    setRoutineFormError(null);
    setIsSavingRoutineForm(false);
    setIsAddingRoutine(true);
  };
  
  const handleEditRoutine = (rt: any) => {
    setEditingRoutine(rt);
    setRoutineName(rt.routine_name || '');
    setRoutineNotes(rt.notes || '');
    setRoutineUrl(rt.url || '');
    setRoutineTime(rt.time);
    setRoutineDays(rt.days || []);
    setRoutineSelectedProducts(rt.products || []);
    setRoutinePublic(Boolean(rt.public));
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

    if (error) {}
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
    setError("Database Error: " + (err.message || "Unknown error"));
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
        setIsAuthLoading(false);
        setAppState(AppState.DASHBOARD);
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', '/dashboard');
        }
      },
      (errorMessage) => {
        setIsAuthLoading(false);
        setError(`Authentication error: ${errorMessage}`);
        setAppState(AppState.AUTH);
      }
    );

    return () => {
      cleanupDeepLink();
    };
  }, []);

  // Auth Listener & Single Authoritative Session Management
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      if (mounted) setUser(currentUser);

      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        setAppState(AppState.DASHBOARD);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }

      if (currentUser && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        setTimeout(async () => {

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
            }
        }

        // Save cached landing products if they exist (after signup or login)
        const cachedLanding = localStorage.getItem('cachedLandingProducts');
        if (cachedLanding) {
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
                }

                await fetchTrackerData(currentUser.id);

                if (productsToEvaluate.length > 0) {
                   const firstProd = productsToEvaluate[0];
                   const trackerMatch = insertedTrackerItems?.find(item => String(item.product_id) === String(firstProd.id) || (item.brand === firstProd.brand && item.product_name === firstProd.name));
                   openProductCard(firstProd.id, trackerMatch);
                }

                localStorage.removeItem('cachedLandingProducts');
            } catch (cacheErr) {
            } finally {
            }
        }

        try {
          let data: any = null;
          let fetchError: any = null;

          // Retry reading user row from public.users up to 5 times with a 400ms delay (trigger may take a moment)
          for (let attempt = 0; attempt < 5; attempt++) {
            const res = await supabase
              .from('users')
              .select('*')
              .eq('id', currentUser.id)
              .maybeSingle();

            data = res.data;
            fetchError = res.error;

            if (data && data.id) {
              break;
            }
            if (attempt < 4) {
              await new Promise(resolve => setTimeout(resolve, 400));
            }
          }

          if (fetchError && !data) {
            console.warn('Could not fetch user row from public.users after retries:', fetchError);
          }

          // Fallback: call generateUniqueUsername() ONLY if the row exists but username is null or empty, using UPDATE (never insert)
          if (data && (!data.username || data.username.trim() === '')) {
            const generated = await generateUniqueUsername(supabase);
            const { data: updatedData, error: updateError } = await supabase
              .from('users')
              .update({ username: generated })
              .eq('id', currentUser.id)
              .select()
              .single();

            if (!updateError && updatedData) {
              data = updatedData;
            } else {
              data.username = generated;
            }
          } else if (!data) {
            data = { id: currentUser.id, username: null };
          }

          if (data && mounted) {
            setProfile(data);
            if (data.skin_type) setSkinType(data.skin_type);
            if (data.primary_issue) setConcern(data.primary_issue);
          }

          const { data: uProfile, error: uProfileError } = await supabase
            .from('user_profile')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (!uProfileError && uProfile && mounted) {
            setUserProfile(uProfile);
          }
        } catch (e) {
        } finally {
          if (mounted) setLoading(false);
        }
      }, 0);
      } else if (event === 'SIGNED_OUT' || !currentUser) {
        if (mounted) {
            setUser(null);
            setProfile(null);
            setUserProfile(null);
            setLoading(false);
        }
      }
    });

    return () => {
        mounted = false;
        subscription?.unsubscribe();
    };
  }, []);



  // Navigation Logic
  useEffect(() => {
    if (loading) return;

    if (user) {
      // If we are on auth but logged in, move directly to dashboard
      if (appState === AppState.AUTH) {
        setAppState(AppState.DASHBOARD);
      }
    } else {
      // If logged out on any screen and on dashboard (Home), redirect to landing
      if (appState === AppState.DASHBOARD) {
        setAppState(AppState.LANDING);
        return;
      }
      // If logged out, allow landing, entry points, products, tracker, and social page
      const allowedStates = [
        AppState.LANDING,
        AppState.AUTH,
        AppState.ONBOARDING_DETAILS,
        AppState.RANK,
        AppState.TRACKER,
        AppState.SOCIAL,
        AppState.PRODUCT_PAGE,
        AppState.DELETE_ACCOUNT,
        AppState.PRIVACY_POLICY
      ];
      if (!allowedStates.includes(appState)) {
        setAppState(AppState.LANDING);
      }
    }
  }, [user, profile, appState, loading, isWeb]);

  useEffect(() => {
    if (appState === AppState.PROGRESS) {
      setAppState(AppState.PROFILE);
    }
  }, [appState]);

  useEffect(() => {
    if (!userProfile?.id) return;
    ['Cleanser', 'Treatment', 'Moisturiser', 'SPF'].forEach(type => {
      productSort(userProfile, type); // fires and caches silently
    });
  }, [userProfile?.id]);

  const [totalProductCount, setTotalProductCount] = useState<number>(0);
  const [productOffset, setProductOffset] = useState<number>(0);
  const productPageSize = 24;
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const buildProductQuery = (offsetNum: number = 0, limitNum: number = 24) => {
    const rangeEnd = offsetNum + limitNum - 1;
    let query;
    if (primaryFilter === 'By Type') {
      const sub = (subFilter || '').toLowerCase();
      if (sub === 'retinol') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(c_retinol), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.c_retinol', true);
      } else {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter(preg_safe, k_beauty, j_beauty, glass, c_pdrn, pdrn, natural, red, dry, aging, blem_prone, men, winter, c_retinol, c_ha, c_collagen, c_vitc, c_vite, c_salicylic, c_niac, c_glycolic, c_ceramide, c_peptides, c_ahabha), product_scores(cat2, cat3)', { count: 'exact' });
      }
    } else if (primaryFilter === 'Pregnancy-safe') {
      let q = supabase
        .from('products')
        .select('id, brand, name, type, photo_url, products_filter!inner(preg_safe), product_scores(cat2, cat3)', { count: 'exact' })
        .eq('products_filter.preg_safe', true);

      if (subFilter && subFilter !== 'All' && subFilter !== 'all') {
        q = q.ilike('type', `%${subFilter}%`);
      }
      query = q;
    } else if (primaryFilter === 'Trending') {
      const sub = (subFilter || '').toLowerCase();
      if (sub === 'k-beauty') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(k_beauty), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.k_beauty', true);
      } else if (sub === 'j-beauty') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(j_beauty), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.j_beauty', true);
      } else if (sub === 'glass skin') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(glass), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.glass', true);
      } else if (sub === 'pdrn') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(c_pdrn), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.c_pdrn', true);
      } else if (sub === 'natural') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(natural), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.natural', true);
      } else {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter(preg_safe, k_beauty, j_beauty, glass, c_pdrn, pdrn, natural, red, dry, aging, blem_prone, men, winter, c_retinol, c_ha, c_collagen, c_vitc, c_vite, c_salicylic, c_niac, c_glycolic, c_ceramide, c_peptides, c_ahabha), product_scores(cat2, cat3)', { count: 'exact' });
      }
    } else if (primaryFilter === 'By Concern') {
      const sub = (subFilter || '').toLowerCase();
      if (sub === 'redness') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(red), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.red', true);
      } else if (sub === 'dry skin') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(dry), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.dry', true);
      } else if (sub === 'aging skin') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(aging), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.aging', true);
      } else if (sub === 'blemish-prone skin') {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter!inner(blem_prone), product_scores(cat2, cat3)', { count: 'exact' })
          .eq('products_filter.blem_prone', true);
      } else {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter(preg_safe, k_beauty, j_beauty, glass, c_pdrn, pdrn, natural, red, dry, aging, blem_prone, men, winter, c_retinol, c_ha, c_collagen, c_vitc, c_vite, c_salicylic, c_niac, c_glycolic, c_ceramide, c_peptides, c_ahabha), product_scores(cat2, cat3)', { count: 'exact' });
      }
    } else if (primaryFilter === 'By Ingredient') {
      const sub = (subFilter || '').toLowerCase();
      const ingredientColumnMap: Record<string, string> = {
        'retinols': 'c_retinol',
        'retinol': 'c_retinol',
        'hyaluronic acid': 'c_ha',
        'ha': 'c_ha',
        'pdrn': 'c_pdrn',
        'collagen': 'c_collagen',
        'niacinamide': 'c_niac',
        'salicylic acid': 'c_salicylic',
        'salicylic': 'c_salicylic',
        'vitamin c': 'c_vitc',
        'vit c': 'c_vitc',
        'vitamin e': 'c_vite',
        'vit e': 'c_vite',
        'glycolic acid': 'c_glycolic',
        'glycolic': 'c_glycolic',
        'peptides': 'c_peptides',
        'peptide': 'c_peptides',
        'ceramides': 'c_ceramide',
        'ceramide': 'c_ceramide',
        'aha/bha': 'c_ahabha',
      };
      const col = ingredientColumnMap[sub];
      if (col) {
        query = supabase
          .from('products')
          .select(`id, brand, name, type, photo_url, products_filter!inner(${col}), product_scores(cat2, cat3)`, { count: 'exact' })
          .eq(`products_filter.${col}`, true);
      } else {
        query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, products_filter(preg_safe, k_beauty, j_beauty, glass, c_pdrn, pdrn, natural, red, dry, aging, blem_prone, men, winter, c_retinol, c_ha, c_collagen, c_vitc, c_vite, c_salicylic, c_niac, c_glycolic, c_ceramide, c_peptides, c_ahabha), product_scores(cat2, cat3)', { count: 'exact' });
      }
    } else {
      query = supabase
        .from('products')
        .select('id, brand, name, type, photo_url, products_filter(preg_safe, k_beauty, j_beauty, glass, c_pdrn, pdrn, natural, red, dry, aging, blem_prone, men, winter, c_retinol, c_ha, c_collagen, c_vitc, c_vite, c_salicylic, c_niac, c_glycolic, c_ceramide, c_peptides, c_ahabha), product_scores(cat2, cat3)', { count: 'exact' });
    }

    return query.order('id', { ascending: true }).range(offsetNum, rangeEnd);
  };

  const handleLoadMoreProducts = async () => {
    if (isLoadingMore) return;
    const nextOffset = productOffset + productPageSize;
    if (nextOffset >= totalProductCount) return;

    setIsLoadingMore(true);
    try {
      const query = buildProductQuery(nextOffset, productPageSize);
      const { data, error } = await query;
      if (error) {}
      if (data && data.length > 0) {
        setProducts(prev => [...prev, ...data]);
        setProductOffset(nextOffset);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchInitialProducts = async () => {
      setProductOffset(0);
      try {
        const query = buildProductQuery(0, productPageSize);
        const { data, count, error } = await query.abortSignal(abortController.signal);
        if (error) { }
        if (data && isMounted && !abortController.signal.aborted) {
          setProducts(data);
          setTotalProductCount(count ?? data.length);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || abortController.signal.aborted) return;
      }
    };

    fetchInitialProducts();

    const channelId = `products-sync-${Date.now()}`;
    const productsChannel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        try {
          const query = buildProductQuery(0, productPageSize);
          const { data, count } = await query;
          if (data && isMounted) {
            setProducts(data);
            setTotalProductCount(count ?? data.length);
            setProductOffset(0);
          }
        } catch {}
      })
      .subscribe();

    return () => {
      isMounted = false;
      abortController.abort();
      supabase.removeChannel(productsChannel);
    };
  }, [primaryFilter, subFilter]);



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
        if (!active) break;
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
          const checkResult = await checkRoutine(mappedProfile, prodIds, timing, rt.time);
          if (active) {
            newChecks[key] = checkResult;
          }
        } catch (e) {
          // Routine check error handled silently
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
  }, [routines, trackerData, loading, userProfile, profile, routinesVersion]);

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
  }, [routines, trackerData, routinesVersion]);

  // Supabase listeners & live cache synchronization
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchInitialData = async () => {
      try {
        // Routines - performed with live join to products, product_scores, and products_filter
        const liveRoutines = await fetchRoutinesWithLiveProducts(user.id, signal);
        if (isMounted) {
          setRoutines(liveRoutines);
          setRoutinesVersion(v => v + 1);
        }

        // Progress
        const { data: progressData, error: progressError } = await supabase
          .from('progress')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .abortSignal(signal);
        if (!progressError && progressData && isMounted) {
          setProgressPhotos(progressData);
        }

        // Upp
        const { data: uppData, error: uppError } = await supabase
          .from('upp')
          .select('*')
          .eq('user_id', user.id)
          .abortSignal(signal);
        if (!uppError && uppData && isMounted) {
          setUserProducts(uppData);
        }

        // User Profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profile')
          .select('*')
          .eq('id', user.id)
          .abortSignal(signal)
          .maybeSingle();
        if (!profileError && isMounted) {
          setUserProfile(profileData || null);
        }

        // Tracker
        if (isMounted) {
          fetchTrackerData();
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) return;
      }
    };

    fetchInitialData();

    // Set up consolidated real-time subscription for user tables AND product tables
    // so any database attribute update instantly reflects in the routine checker UI.
    const userSyncChannel = supabase.channel(`user-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routines', filter: `user_id=eq.${user.id}` }, async () => {
        const live = await fetchRoutinesWithLiveProducts(user.id);
        if (live && isMounted) {
          setRoutines(live);
          setRoutinesVersion(v => v + 1);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const live = await fetchRoutinesWithLiveProducts(user.id);
        if (live && isMounted) {
          setRoutines(live);
          setRoutinesVersion(v => v + 1);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_scores' }, async () => {
        const live = await fetchRoutinesWithLiveProducts(user.id);
        if (live && isMounted) {
          setRoutines(live);
          setRoutinesVersion(v => v + 1);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products_filter' }, async () => {
        const live = await fetchRoutinesWithLiveProducts(user.id);
        if (live && isMounted) {
          setRoutines(live);
          setRoutinesVersion(v => v + 1);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_metric_culprits' }, async () => {
        const live = await fetchRoutinesWithLiveProducts(user.id);
        if (live && isMounted) {
          setRoutines(live);
          setRoutinesVersion(v => v + 1);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker', filter: `user_id=eq.${user.id}` }, async () => {
        const { data } = await supabase.from('tracker').select('*').eq('user_id', user.id);
        if (data && isMounted) setTrackerData(data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progress', filter: `user_id=eq.${user.id}` }, async () => {
        const { data } = await supabase
          .from('progress')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false });
        if (data && isMounted) setProgressPhotos(data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'upp', filter: `user_id=eq.${user.id}` }, async () => {
        const { data } = await supabase.from('upp').select('*').eq('user_id', user.id);
        if (data && isMounted) setUserProducts(data);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profile', filter: `id=eq.${user.id}` }, async () => {
        const { data } = await supabase.from('user_profile').select('*').eq('id', user.id).maybeSingle();
        if (data && isMounted) setUserProfile(data);
      })
      .subscribe();

    return () => {
      isMounted = false;
      abortController.abort();
      supabase.removeChannel(userSyncChannel);
    };
  }, [user]);

  // Invalidate cache and fetch fresh product data when navigating to Routines or Dashboard
  useEffect(() => {
    if (user && (appState === AppState.ROUTINES || appState === AppState.DASHBOARD)) {
      refreshRoutines();
    }
  }, [appState, user, refreshRoutines]);

  // Window focus listener: Invalidate cache when user switches tabs (e.g. from Supabase dashboard back to app)
  useEffect(() => {
    const handleFocus = () => {
      if (user && document.visibilityState === 'visible') {
        refreshRoutines();
      }
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user, refreshRoutines]);

  const handleDeleteUPP = async (userProductId: string) => {
    try {
      const { error } = await supabase.from('upp').delete().eq('id', userProductId);
      if (error) throw error;
    } catch (e) {
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
      setUserProfile(null);
      setProfile(null);
      setAppState(AppState.AUTH);
      window.location.replace('/auth');
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setUser(null);
      setUserProfile(null);
      setProfile(null);
      setAppState(AppState.AUTH);
      window.location.replace('/auth');
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
          throw insertError;
        }

        // Refresh UI
        if (insertedData) {
          setProgressPhotos(prev => [insertedData, ...prev]);
        }
        
      } catch (err: any) {
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
        }

      // 3. Delete from Database
      const { error: dbError } = await supabase
        .from('progress')
        .delete()
        .eq('id', photo.id);

      if (dbError) {
        throw dbError;
      }

      // Update local state
      setProgressPhotos(prev => prev.filter(p => p.id !== photo.id));
      if (selectedPhoto?.id === photo.id) {
        setSelectedPhoto(null);
      }
    } catch (err: any) {
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

            await supabase
              .from('users')
              .upsert({ id: user.id, onboarding_complete: true });

            const { data: uProfile } = await supabase
              .from('user_profile')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();
            if (uProfile) setUserProfile(uProfile);

            const { data: uData } = await supabase
              .from('users')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();
            if (uData) setProfile(uData);

            setAppState(AppState.RANK);
        } catch (e: any) {
            setError(`Error saving profile info: ${formatSupabaseError(e)}`);
        }
    } else {
        localStorage.setItem('pendingQuestionnaireAnswers', JSON.stringify(answers));
        setPendingQuestionnaireAnswers(answers);
        setIsSignUp(true);
        setAppState(AppState.AUTH);
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
        throw routineError;
      }

      // Refresh routines immediately with live product join
      const updatedRoutines = await fetchRoutinesWithLiveProducts(user.id);
      if (updatedRoutines) {
        setRoutines(updatedRoutines);
        setRoutinesVersion(v => v + 1);
      }

      const userPayload = { onboarding_complete: true };
      const { error: userError } = await supabase
        .from('users')
        .update(userPayload)
        .eq('id', user.id);
      
      if (userError) {
        throw userError;
      }

      setAppState(AppState.DASHBOARD);
    } catch (e) {
      }
  };

  const handleSaveRoutine = async () => {
    setRoutineFormError(null);
    setIsSavingRoutineForm(true);
    if (!user) {
      setRoutineFormError('No user found');
      setIsSavingRoutineForm(false);
      return;
    }

    const trimmedUrl = routineUrl.trim();
    if (modalMode !== 'reminder' && trimmedUrl) {
      const lower = trimmedUrl.toLowerCase();
      const isTikTok = lower.includes('tiktok.com');
      const isInstagram = lower.includes('instagram.com') || lower.includes('instagr.am');
      const isYouTube = lower.includes('youtube.com') || lower.includes('youtu.be');
      if (!isTikTok && !isInstagram && !isYouTube) {
        setRoutineFormError('Please enter a valid TikTok, Instagram, or YouTube link.');
        setIsSavingRoutineForm(false);
        return;
      }
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

          const currentUsername = profile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'Anonymous';
          const payload = {
            user_id: user.id,
            time: routineTime,
            days: routineDays,
            routine_name: routineName,
            notes: routineNotes,
            url: trimmedUrl || null,
            products: processedProducts,
            public: routinePublic,
            username: currentUsername,
            votes_count: modalMode === 'edit' && editingRoutine ? (editingRoutine.votes_count || 0) : 0
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

      // Refresh routines immediately with live product join
      const updatedRoutines = await fetchRoutinesWithLiveProducts(user.id);
      if (updatedRoutines) {
        setRoutines(updatedRoutines);
        setRoutinesVersion(v => v + 1);
      }
      fetchPublicRoutines();

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
    setTrackerData(prev => prev.filter(t => t.id !== id));
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
      setError(`Error saving product to UPP: ${formatSupabaseError(e)}`);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const renderMyRoutinesSection = (hideHeaderActions: boolean = false) => (
    <div className="space-y-3">
      {!hideHeaderActions && (
        <div className="flex items-center justify-between pb-2">
          <h3 className="font-sans font-bold uppercase tracking-[0.14em] text-[#171717] text-sm md:text-base">
            My routines
          </h3>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleAddRoutine}
              className="text-[11px] tracking-[0.1em] uppercase text-[#73716C] hover:text-[#171717] transition-colors flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg border border-[#EAE9E5] bg-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden md:inline">+ New Routine</span>
            </button>
            <button 
              onClick={() => triggerPhotoScan(dashboardFileInputRef)}
              disabled={isDashboardScanning}
              className="text-[11px] tracking-[0.1em] uppercase text-[#73716C] hover:text-[#171717] transition-colors flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg border border-[#EAE9E5] bg-white"
            >
              {isDashboardScanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">Scan Product</span>
            </button>
          </div>
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={dashboardFileInputRef}
        onChange={handleDashboardPhotoScan}
        className="hidden"
      />
      {dashboardScanError && (
        <div className="p-3 mb-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-center space-y-2">
          <p className="text-xs font-bold">{dashboardScanError}</p>
          <button
            onClick={() => {
              setDashboardScanError(null);
              triggerPhotoScan(dashboardFileInputRef);
            }}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all cursor-pointer"
          >
            Retry Scan
          </button>
        </div>
      )}
      <div className="space-y-3">
        {routines.length === 0 ? (
          <div className="py-10 px-5 rounded-xl bg-white border border-[#EAE9E5] text-center space-y-3">
            <Sun className="w-7 h-7 text-[#73716C] mx-auto opacity-40" />
            <p className="text-xs font-semibold text-[#171717] uppercase tracking-wider">No routine added yet</p>
            <p className="text-[11px] text-[#73716C]">Create your first morning or evening skincare ritual.</p>
            <button
              onClick={handleAddRoutine}
              className="px-4 py-2 bg-[#171717] text-white text-[11px] font-medium uppercase tracking-wider rounded-lg hover:bg-[#73716C] transition-colors cursor-pointer"
            >
              + Create Routine
            </button>
          </div>
        ) : (
          routines.map((rt: any, rIdx: number) => {
            const check = routineChecks[rt.id || String(rIdx)];
            const score = check?.routine_score;
            const scoreConfig = getScoreColorConfig(score);
            const isExpanded = expandedRoutines.includes(rIdx);

            return (
              <div 
                key={rIdx} 
                className="rounded-xl bg-white border border-[#EAE9E5] hover:border-[#CFCBC2] transition-all px-5 py-3.5 flex flex-col gap-2 shadow-none"
              >
                <div 
                  className="flex items-center justify-between cursor-pointer gap-4" 
                  onClick={() => toggleRoutineExpansion(rIdx)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="bg-[#FAF7F0] border border-[#D6C7A9] text-[#7A6332] text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-md uppercase shrink-0">
                      {rt.time || 'AM'}
                    </span>
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <h4 className="font-sans font-semibold text-[#171717] uppercase text-xs md:text-sm tracking-tight truncate">
                        {rt.routine_name || 'Routine'}
                      </h4>
                      {rt.days && rt.days.length > 0 && (
                        <span className="text-[10px] text-[#73716C] uppercase tracking-wider font-medium">
                          • {(rt.days || []).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-[#EAE9E5] rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${scoreConfig.barBg} rounded-full transition-all duration-300`} 
                          style={{ width: `${score !== undefined ? Math.min(Math.max(score, 5), 100) : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider border transition-colors ${
                      score === undefined ? 'bg-[#FAF7F0] text-[#73716C] animate-pulse border-[#EAE9E5]' :
                      scoreConfig.badgeBg
                    }`}>
                      {score !== undefined ? `${score}/100` : '...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#73716C] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-3 pt-3 border-t border-[#EAE9E5] mt-1">
                    <div className="space-y-2">
                      {getActiveRoutineProducts(rt.products, rt.time).map((p: any, i: number) => (
                        <div key={i} className="flex flex-col gap-0.5 text-xs pb-1.5 border-b border-[#EAE9E5]/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-semibold tracking-wider text-[#73716C]">{p.type}</span>
                            <span className="font-medium text-[#171717]">{p.brand}</span>
                          </div>
                          <ProductLink 
                            productId={p.id} 
                            productName={p.name} 
                            className="text-[#73716C] hover:text-[#171717] transition-colors text-left font-normal" 
                          />
                        </div>
                      ))}
                    </div>

                    {check && (
                      <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#EAE9E5] space-y-3 text-left">

                        {check.debug && (
                          <div className="grid grid-cols-2 gap-3 bg-white border border-[#EAE9E5] p-2.5 rounded-lg">
                            <div>
                              <span className="text-[9px] font-semibold uppercase text-[#73716C] block tracking-wider">Skin Barrier Risk</span>
                              <span className="text-[11px] font-semibold uppercase text-[#171717]">
                                {check.debug.user_irritation_threshold} Risk
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] font-semibold uppercase text-[#73716C] block tracking-wider">Actives Budget</span>
                              <span className="text-[11px] font-semibold uppercase text-[#171717]">
                                {check.debug.active_count} / {check.debug.active_budget} Active
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Recommendations & Warnings Synthesis */}
                        {check.recommendations && check.recommendations.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#73716C] block">Analysis & Insights</span>
                            {check.recommendations.map((rec: string, rIndex: number) => {
                              const lines = rec.split('\n').map(l => l.trimEnd()).filter(Boolean);
                              const header = lines[0];
                              const items = lines.slice(1);

                              return (
                                <div key={rIndex} className="text-xs text-[#171717] bg-white border border-[#EAE9E5] p-2.5 rounded-lg leading-relaxed space-y-1.5">
                                  <div className="font-semibold text-black">{header}</div>
                                  {items.length > 0 && (
                                    <div className="space-y-1">
                                      {items.map((item, iIdx) => {
                                        const isSub = item.startsWith('    ') || item.startsWith('  ');
                                        const cleaned = item.replace(/^[•\s]+/, '');
                                        if (isSub) {
                                          return (
                                            <div key={iIdx} className="pl-5 text-black/70 flex items-start gap-1.5 font-medium">
                                              <span className="text-venus-accent font-bold select-none">◦</span>
                                              <span>{cleaned}</span>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div key={iIdx} className="flex items-start gap-1.5 text-black/90">
                                            <span className="text-black font-bold select-none">•</span>
                                            <span>{cleaned}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Detrimental Warnings Fallback */}
                        {(!check.recommendations || check.recommendations.length === 0) && check.detrimental && check.detrimental.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block">Warnings</span>
                            {check.detrimental.map((det: any, dIndex: number) => (
                              <div key={dIndex} className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg">
                                • {det.reason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1 shrink-0 pt-2 border-t border-[#EAE9E5] mt-1 justify-end">
                      <label className="flex items-center gap-1 p-2 hover:bg-[#F4F3F0] rounded-full transition-colors cursor-pointer text-[#73716C] hover:text-[#171717] text-xs mr-auto">
                        <input type="checkbox" onChange={(e) => handleToggleTrackerRoutine(rt.products, rt.time, e.target.checked)} className="form-checkbox" />
                        <span>Add to tracker</span>
                      </label>
                      <button onClick={() => { setShareRoutine(rt); setIsSharingOpen(true); }} className='p-2 hover:bg-[#F4F3F0] rounded-full transition-colors cursor-pointer' title="Share">
                        <Share2 className="w-4 h-4 text-[#73716C] hover:text-[#171717]" />
                      </button>
                      <button onClick={() => handleEditRoutine(rt)} className='p-2 hover:bg-[#F4F3F0] rounded-full transition-colors cursor-pointer' title="Edit">
                        <Pencil className="w-4 h-4 text-[#73716C] hover:text-[#171717]" />
                      </button>
                      <button onClick={() => handleSetReminder(rt)} className='p-2 hover:bg-[#F4F3F0] rounded-full transition-colors cursor-pointer' title="Reminder">
                        <AlarmClock className="w-4 h-4 text-[#73716C] hover:text-[#171717]" />
                      </button>
                      <button onClick={() => setRoutineToDelete(rt)} className='p-2 hover:bg-[#F4F3F0] rounded-full transition-colors text-red-500/60 hover:text-red-600 cursor-pointer' title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Inspo Section below My Routines */}
      <div className="mt-12 pt-8 border-t border-black/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black uppercase tracking-tight text-black">
              Inspo — Community Routines
            </h3>
            <p className="text-xs text-black/50 font-medium">
              Explore the latest routines shared by others like you.
            </p>
          </div>
        </div>

        {publicRoutines.length === 0 ? (
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
                  onClick={() => handleOpenCommunityRoutine(rt)}
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
                          onClick={(e) => { e.stopPropagation(); setShareRoutine(rt); setIsSharingOpen(true); }}
                          className="p-1.5 rounded-full bg-black/5 hover:bg-black/10 text-black transition-colors cursor-pointer"
                          title="Share routine"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleVoteRoutine(rt.id); }}
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
      </div>
    </div>
  );

  if (isAuthLoading) return (
    <div className="fixed inset-0 bg-[#FAF9F6] z-[99999] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 border-4 border-black/10 border-t-black rounded-full animate-spin mb-6" />
      <h2 className="text-xl font-black text-gray-900 tracking-tight mb-2">Signing you in…</h2>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Please wait while we set up your session</p>
    </div>
  );

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

        {/* Community Routine Detail Modal */}
        {selectedCommunityRoutine && (
          <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative border border-black/10">
              <button 
                onClick={() => setSelectedCommunityRoutine(null)}
                className="absolute top-5 right-5 p-2 rounded-full bg-black/5 hover:bg-black/10 text-black transition-colors cursor-pointer"
              >
                ✕
              </button>

              <div className="space-y-2">
                {selectedCommunityRoutine.url && (
                  <div className="w-full flex justify-center mb-4">
                    {selectedCommunityRoutine.url.includes('youtube.com') || selectedCommunityRoutine.url.includes('youtu.be') ? (
                      <div className="w-full aspect-video rounded-2xl overflow-hidden border border-[#E5E4E0] bg-[#F4F3F0]">
                        <iframe
                          src={getYouTubeEmbedUrl(selectedCommunityRoutine.url)}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : selectedCommunityRoutine.url.includes('tiktok.com') ? (
                      <div className="w-full max-w-[240px] aspect-[9/16] rounded-2xl overflow-hidden bg-[#F4F3F0] border border-[#E5E4E0] relative shadow-md">
                        <TikTokPlayer
                          videoId=""
                          videoUrl={selectedCommunityRoutine.url}
                          title={selectedCommunityRoutine.routine_name}
                          isActive={isModalTikTokActive}
                          onPlay={() => setIsModalTikTokActive(true)}
                          containerClassName="w-full h-full relative overflow-hidden bg-black"
                        />
                      </div>
                    ) : (
                      <div className="w-full p-4 rounded-xl bg-black/5 text-center">
                        <a href={selectedCommunityRoutine.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold underline">View Video Link</a>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-black/5 text-[10px] font-black uppercase tracking-wider text-venus-accent">
                    {selectedCommunityRoutine.time || 'AM'} Routine
                  </span>
                  <span className="text-xs text-black/50 font-semibold">
                    Posted by @{selectedCommunityRoutine.username || 'Anonymous'}
                  </span>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-black">
                  {selectedCommunityRoutine.routine_name || 'Community Routine'}
                </h3>
                {selectedCommunityRoutine.notes && (
                  <p className="text-xs text-black/70 font-medium bg-[#FAF9F6] p-3 rounded-xl border border-black/5">
                    {selectedCommunityRoutine.notes}
                  </p>
                )}
               </div>

               <div className="space-y-3">
                 <h4 className="text-xs font-black uppercase tracking-widest text-black/40">
                   Routine Products ({Array.isArray(selectedCommunityRoutine.products) ? selectedCommunityRoutine.products.length : 0})
                 </h4>
                 <div className="space-y-2">
                   {Array.isArray(selectedCommunityRoutine.products) && selectedCommunityRoutine.products.map((p: any, idx: number) => (
                     <div 
                       key={idx}
                       onClick={() => openProductCard(String(p.id || p.product_id))}
                       className="p-3 bg-[#FAF9F6] border border-black/5 rounded-2xl flex items-center justify-between hover:border-black/25 transition-all cursor-pointer group"
                       title="Click to view product details"
                     >
                       <div className="flex items-center gap-3">
                         {p.photo_url ? (
                           <img src={p.photo_url} alt={p.name} className="w-10 h-10 object-cover rounded-xl bg-white border border-black/5" />
                         ) : (
                           <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-xs font-black">
                             {p.brand?.[0] || 'P'}
                           </div>
                         )}
                         <div>
                           <div className="text-[10px] font-black uppercase tracking-wider text-black/40">{p.brand}</div>
                           <div className="text-xs font-bold text-black group-hover:text-venus-accent transition-colors">{p.name}</div>
                           <div className="text-[10px] text-black/50 font-medium">{p.cat2 || p.type || 'Product'}</div>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>

              <div className="pt-4 border-t border-black/10 flex items-center justify-between text-xs text-black/60 font-semibold">
                <span>Schedule: {Array.isArray(selectedCommunityRoutine.days) && selectedCommunityRoutine.days.length > 0 ? selectedCommunityRoutine.days.join(', ') : 'Daily'}</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setShareRoutine(selectedCommunityRoutine); setIsSharingOpen(true); }}
                    className="px-4 py-2 rounded-xl bg-black/5 hover:bg-black/10 text-black font-black text-xs uppercase tracking-wider transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                  <button 
                    onClick={() => setSelectedCommunityRoutine(null)}
                    className="px-5 py-2 rounded-xl bg-black text-white font-black text-xs uppercase tracking-wider hover:bg-black/80 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      {/* Left Side Panel */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              key="nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileNavOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[55] cursor-pointer"
            />
            <motion.div 
              key="nav-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-64 bg-white z-[60] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto"
            >
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center pb-2 border-b border-black/5">
                  <div className="flex flex-col">
                    <span 
                      className="font-bubble text-3xl text-black font-medium cursor-pointer" 
                      onClick={() => { 
                        if (user) {
                          setAppState(AppState.DASHBOARD);
                        } else {
                          setAppState(AppState.LANDING);
                        }
                        setIsMobileNavOpen(false); 
                      }}
                    >
                      Canonic
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-venus-accent">Beauty, Smarter</span>
                  </div>
                  <button 
                    onClick={() => setIsMobileNavOpen(false)}
                    className="p-1.5 rounded-full transition-colors cursor-pointer text-black/60 hover:text-black outline-none focus:outline-none focus:bg-transparent active:bg-transparent"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* List of Pages */}
                <div className="flex flex-col gap-2">
                  {user && (
                    <button 
                      onClick={() => { resetHeaderSearchState(); setAppState(AppState.DASHBOARD); setIsMobileNavOpen(false); }} 
                      className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.DASHBOARD ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                    >
                      <FlaskConical className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.DASHBOARD ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                      <span className="text-xs uppercase tracking-widest font-black">Home</span>
                    </button>
                  )}
                  {user ? (
                    <button 
                      onClick={() => { resetHeaderSearchState(); setAppState(AppState.ROUTINES); setIsMobileNavOpen(false); }} 
                      className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.ROUTINES ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                    >
                      <Sun className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.ROUTINES ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                      <span className="text-xs uppercase tracking-widest font-black">My Routines</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => { setAuthPromptModalOpen(true); setIsMobileNavOpen(false); }} 
                      className="flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent text-black/60 hover:text-black font-semibold group"
                    >
                      <Sun className="w-5 h-5 shrink-0 text-black/40 group-hover:text-black" />
                      <span className="text-xs uppercase tracking-widest font-black">My Routines</span>
                    </button>
                  )}
                  {user && (
                    <button 
                      onClick={() => { resetHeaderSearchState(); setAppState(AppState.TRACKER); setIsMobileNavOpen(false); }} 
                      className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.TRACKER ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                    >
                      <CheckSquare className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.TRACKER ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                      <span className="text-xs uppercase tracking-widest font-black">Tracker</span>
                    </button>
                  )}
                  <button 
                    onClick={() => { resetHeaderSearchState(); setAppState(AppState.RANK); setIsMobileNavOpen(false); }} 
                    className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.RANK ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                  >
                    <ShoppingBag className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.RANK ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                    <span className="text-xs uppercase tracking-widest font-black">Products</span>
                  </button>

                  <button 
                    onClick={() => { resetHeaderSearchState(); setAppState(AppState.BRANDS); setSelectedBrandItem(null); setSelectedBrandsLetter(null); setIsMobileNavOpen(false); }} 
                    className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.BRANDS ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                  >
                    <Award className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.BRANDS ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                    <span className="text-xs uppercase tracking-widest font-black">Brands</span>
                  </button>

                  {Number(profile?.type) === 1 && (
                    <button 
                      onClick={() => { 
                        if (!user) {
                          setAuthPromptModalOpen(true);
                        } else {
                          setIsAiCompareModalOpen(true);
                        }
                        setIsMobileNavOpen(false); 
                      }} 
                      className="flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent text-black/60 hover:text-black font-semibold group"
                    >
                      <Sliders className="w-5 h-5 shrink-0 text-black/40 group-hover:text-black" />
                      <span className="text-xs uppercase tracking-widest font-black">AI Compare</span>
                    </button>
                  )}

                  {Number(profile?.type) === 1 && (
                    <button 
                      onClick={() => { resetHeaderSearchState(); setAppState(AppState.COMMUNITY); setIsMobileNavOpen(false); }} 
                      className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.COMMUNITY ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                    >
                      <Users className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.COMMUNITY ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                      <span className="text-xs uppercase tracking-widest font-black">Community</span>
                    </button>
                  )}

                  <button 
                    onClick={() => { resetHeaderSearchState(); setAppState(AppState.SOCIAL); setIsFollowsOpen(false); setSocialActiveMainTab('articles'); setIsMobileNavOpen(false); }} 
                    className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.SOCIAL ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                  >
                    <Heart className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.SOCIAL ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                    <span className="text-xs uppercase tracking-widest font-black">The Edit</span>
                  </button>
                  {user && (
                    <>
                      <button 
                        onClick={() => { resetHeaderSearchState(); setAppState(AppState.PROFILE); setIsMobileNavOpen(false); }} 
                        className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.PROFILE ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                      >
                        <UserIcon className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.PROFILE ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                        <span className="text-xs uppercase tracking-widest font-black">Profile</span>
                      </button>
                      <button 
                        onClick={() => { resetHeaderSearchState(); setAppState(AppState.FEEDBACK); setIsMobileNavOpen(false); }} 
                        className={`flex items-center gap-4 px-3 py-2.5 rounded-xl transition-colors cursor-pointer select-none outline-none focus:outline-none focus:bg-transparent active:bg-transparent group ${appState === AppState.FEEDBACK ? 'text-black font-black' : 'text-black/60 hover:text-black font-semibold'}`}
                      >
                        <MessageSquare className={`w-5 h-5 shrink-0 transition-colors ${appState === AppState.FEEDBACK ? 'text-venus-accent' : 'text-black/40 group-hover:text-black'}`} />
                        <span className="text-xs uppercase tracking-widest font-black">Feedback</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom: User Info, Log Out & Privacy Policy */}
              <div className="pt-4 border-t border-black/10 mt-6 flex flex-col gap-3">
                {user && (
                  <>
                    <div className="flex items-center gap-3 px-2 py-1 text-xs text-black/60">
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center font-black uppercase text-black text-xs shrink-0">
                        {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-black truncate">{profile?.username || user.email?.split('@')[0] || 'User'}</p>
                        <p className="text-[10px] text-black/40 truncate">{user.email}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { handleSignOut(); setIsMobileNavOpen(false); }}
                      className="flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-xs font-black uppercase tracking-wider"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Log Out</span>
                    </button>
                  </>
                )}
                <div className="pt-2 px-1 flex items-center justify-between text-[11px] text-black/50">
                  <a 
                    href="https://www.canonic.co.uk/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (isNativePlatform()) {
                        e.preventDefault();
                        Browser.open({ url: 'https://www.canonic.co.uk/privacy' });
                        setIsMobileNavOpen(false);
                      } else {
                        setIsMobileNavOpen(false);
                      }
                    }}
                    className="hover:text-black underline cursor-pointer transition-colors font-semibold"
                  >
                    Privacy Policy
                  </a>
                  <span>© Canonic</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EAE9E5]">
        <div className="flex justify-between items-center px-3 sm:px-4 md:px-6 h-14 sm:h-16 gap-1.5 sm:gap-4 max-w-7xl mx-auto">
          {/* Top Left: Canonic brand and Nav Links */}
          <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6 shrink-0">
            <button 
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} 
              className={`p-1.5 -ml-1 text-[#171717] hover:bg-[#F4F3F0] rounded-lg cursor-pointer transition-colors shrink-0 whitespace-nowrap ${user ? 'block' : 'block md:hidden'}`}
              aria-label="Toggle navigation menu"
              title="Navigation menu"
            >
              <Menu className="w-5 h-5 text-[#171717]" />
            </button>
            <button 
              onClick={() => { resetHeaderSearchState(); setAppState(user ? AppState.DASHBOARD : AppState.LANDING); }} 
              className="font-bubble text-xl sm:text-2xl md:text-3xl text-[#171717] cursor-pointer tracking-tight hover:opacity-80 transition-opacity whitespace-nowrap shrink-0"
            >
              Canonic
            </button>
            <nav className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => { resetHeaderSearchState(); setAppState(AppState.RANK); }}
                className={`text-xs font-semibold uppercase tracking-[0.14em] cursor-pointer transition-colors whitespace-nowrap ${appState === AppState.RANK ? 'text-[#171717] underline underline-offset-8 decoration-2 decoration-[#171717]' : 'text-[#73716C] hover:text-[#171717]'}`}
              >
                Products
              </button>
              <button 
                onClick={() => { resetHeaderSearchState(); setAppState(AppState.SOCIAL); setSocialActiveMainTab('articles'); setIsFollowsOpen(false); }}
                className={`text-xs font-semibold uppercase tracking-[0.14em] cursor-pointer transition-colors whitespace-nowrap ${appState === AppState.SOCIAL && socialActiveMainTab === 'articles' ? 'text-[#171717] underline underline-offset-8 decoration-2 decoration-[#171717]' : 'text-[#73716C] hover:text-[#171717]'}`}
              >
                The Edit
              </button>
            </nav>
          </div>

          {/* Header search bar (pill) */}
          <div ref={headerSearchContainerRef} className="flex-1 min-w-0 max-w-md mx-1 sm:mx-4">
            <div className="flex items-center w-full bg-[#F4F3F0] border border-[#E5E4E0] px-2.5 sm:px-3.5 py-1.5 sm:py-2 gap-1.5 rounded-full transition-colors focus-within:border-[#CFCBC2]">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#73716C] shrink-0 pointer-events-none" />
              <input 
                type="text" 
                placeholder="SEARCH"
                className="w-full min-w-0 bg-transparent border-none p-0 text-[11px] sm:text-xs font-medium uppercase tracking-wide sm:tracking-wider text-[#171717] placeholder:text-[#73716C] outline-none"
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
                  className="shrink-0 p-0.5 rounded-full hover:bg-[#E5E4E0] text-[#73716C] hover:text-[#171717] transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 shrink-0">
            {!user ? (
              <>
                <button 
                  onClick={() => { resetHeaderSearchState(); setIsSignUp(false); setAppState(AppState.AUTH); }}
                  className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide sm:tracking-[0.14em] text-[#73716C] hover:text-[#171717] transition-colors cursor-pointer whitespace-nowrap px-1 sm:px-0 shrink-0"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { resetHeaderSearchState(); setIsSignUp(true); setAppState(AppState.AUTH); }}
                  className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide sm:tracking-[0.14em] text-[#171717] hover:text-[#171717] transition-colors cursor-pointer whitespace-nowrap bg-[#F4F3F0] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-[#E5E4E0] shrink-0"
                >
                  Join
                </button>
              </>
            ) : (
              <button 
                onClick={() => { resetHeaderSearchState(); setAppState(AppState.PROFILE); }}
                className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wide sm:tracking-[0.14em] text-[#171717] hover:text-[#73716C] transition-colors cursor-pointer whitespace-nowrap bg-[#F4F3F0] p-1.5 sm:px-3.5 sm:py-1.5 rounded-full border border-[#E5E4E0] shrink-0"
              >
                <UserIcon className="w-3.5 h-3.5 text-[#171717] shrink-0" />
                <span className="hidden sm:inline">{user?.username || 'Profile'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Full-width Search Results Dropdown */}
        {isHeaderSearchDropdownOpen && headerSearchQuery.trim() && (
          <div ref={headerSearchDropdownRef} className="absolute top-full left-0 right-0 w-full bg-white/95 backdrop-blur-md border-b border-black/10 shadow-2xl overflow-hidden z-[100] max-h-[70vh] overflow-y-auto">
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
      
      {(() => {
        const hasCompletedQuiz = Boolean(userProfile?.skin_type && userProfile.skin_type.trim() !== '');
        const showQuizBanner = user && !hasCompletedQuiz && !isQuizBannerDismissed && appState !== AppState.ONBOARDING_DETAILS;
        if (!showQuizBanner) return null;
        return (
          <div className="bg-white border-b border-black/10 shadow-xs py-3 px-4 md:px-6 relative z-40">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <button
                onClick={() => {
                  resetHeaderSearchState();
                  setAppState(AppState.ONBOARDING_DETAILS);
                }}
                className="flex-1 text-left text-xs md:text-sm font-black uppercase tracking-wider text-black hover:text-venus-accent transition-colors cursor-pointer"
              >
                <span>Complete the skin quiz for better matches</span>
              </button>
              <button
                onClick={() => setIsQuizBannerDismissed(true)}
                className="p-1 text-black/50 hover:text-black rounded-lg hover:bg-black/5 transition-colors cursor-pointer shrink-0"
                title="Dismiss"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}
      
      <main className={
        appState === AppState.LANDING 
          ? 'p-0 m-0 w-full min-h-screen' 
          : `pt-4 md:pt-6 ${appState === AppState.ONBOARDING_DETAILS ? 'pb-4 h-[calc(100dvh-5rem)] md:h-auto bg-transparent' : 'pb-24'} px-4 md:px-6 mx-auto ${(appState === AppState.TRACKER || appState === AppState.SOCIAL) ? 'max-w-none' : (appState === AppState.RANK ? 'max-w-6xl' : 'max-w-4xl')}`
      }>
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-2xl mb-4 text-xs font-bold flex items-center justify-between shadow-sm">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-green-800 hover:text-green-950 font-black cursor-pointer">×</button>
          </div>
        )}
        <AnimatePresence mode="wait">
          
          {appState === AppState.AUTH && (
            <Login 
              isSignUp={isSignUp}
              setIsSignUp={setIsSignUp}
              onSuccess={() => setAppState(AppState.DASHBOARD)}
              onError={(err) => setError(err)}
            />
          )}

          {appState === AppState.PRIVACY_POLICY && (
            <motion.div
              key="privacy-policy"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <PrivacyPolicy onBack={() => {
                navigateTo(user ? AppState.DASHBOARD : AppState.LANDING);
              }} />
            </motion.div>
          )}

          {appState === AppState.DELETE_ACCOUNT && (
            <DeleteAccountView
              user={user}
              setUser={setUser}
              setProfile={setProfile}
              setUserProfile={setUserProfile}
              error={error}
              setError={setError}
              setSuccessMessage={setSuccessMessage}
              setIsSignUp={setIsSignUp}
              setAppState={setAppState}
              navigateTo={navigateTo}
            />
          )}

          {appState === AppState.COMPARISON && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full max-w-7xl mx-auto py-4 px-2 sm:px-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-black">Product Comparison</h1>
                  <p className="text-xs text-black/60">Compare ingredients, skin fit, and community ratings side-by-side</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppState(AppState.RANK);
                    window.history.pushState(null, '', '/products');
                  }}
                  className="px-4 py-2 bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors cursor-pointer"
                >
                  Back to Products
                </button>
              </div>
              <ProductComparisonTable
                productIds={comparisonProductIds.length > 0 ? comparisonProductIds : ['1', '2']}
                onClose={() => {
                  setAppState(AppState.RANK);
                  window.history.pushState(null, '', '/products');
                }}
                onRemoveProduct={(idToRemove) => {
                  setComparisonProductIds(prev => prev.filter(id => String(id) !== String(idToRemove)));
                }}
                onUpdateProduct={(index, newId) => {
                  setComparisonProductIds(prev => {
                    const next = [...prev];
                    next[index] = newId;
                    return next;
                  });
                }}
                onAddProduct={(newId) => {
                  if (comparisonProductIds.length < 5 && !comparisonProductIds.includes(String(newId))) {
                    setComparisonProductIds(prev => [...prev, String(newId)]);
                  }
                }}
              />
            </motion.div>
          )}

          {appState === AppState.FEEDBACK && (
            <FeedbackView
              user={user}
              setIsSignUp={setIsSignUp}
              setAppState={setAppState}
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
                activeMainTab={socialActiveMainTab}
                setActiveMainTab={setSocialActiveMainTab}
                initialSelectedArticle={selectedArticle}
              />
            </motion.div>
          )}

          {appState === AppState.COMMUNITY && Number(profile?.type) === 1 && (
            <CommunityView
              publicRoutines={publicRoutines}
              onVoteRoutine={handleVoteRoutine}
              onShareRoutine={(rt) => { setShareRoutine(rt); setIsSharingOpen(true); }}
              openProductCard={openProductCard}
              setAppState={setAppState}
              user={user}
              profile={profile}
            />
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
                trackerItem={selectedProductForPage}
                onClose={() => setAppState(selectedBrandItem ? AppState.BRANDS : (user ? AppState.DASHBOARD : AppState.RANK))} 
              />
            </motion.div>
          )}

          {/* LANDING */}
          {appState === AppState.LANDING && (
            <LandingView
              setAppState={setAppState}
              user={user}
              resetHeaderSearchState={resetHeaderSearchState}
              setSocialActiveMainTab={setSocialActiveMainTab}
              setIsFollowsOpen={setIsFollowsOpen}
              primaryFilter={primaryFilter}
              setPrimaryFilter={setPrimaryFilter}
              subFilter={subFilter}
              setSubFilter={setSubFilter}
              products={products}
              userProducts={userProducts}
              handleDeleteUPP={handleDeleteUPP}
              setAuthPromptModalOpen={setAuthPromptModalOpen}
              setSelectedProductForUPP={setSelectedProductForUPP}
              openProductCard={openProductCard}
              triggerPhotoScan={triggerPhotoScan}
              isWeb={isWeb}
              isNativePlatform={isNativePlatform}
              setSelectedArticle={setSelectedArticle}
              publicRoutines={publicRoutines}
              onVoteRoutine={handleVoteRoutine}
              setSelectedProductForDetail={setSelectedProductForDetail}
              onShareRoutine={(rt) => { setShareRoutine(rt); setIsSharingOpen(true); }}
            />
          )}

          {/* ONBOARDING: DETAILS */}
          {appState === AppState.ONBOARDING_DETAILS && (
            <ChatQuestionnaire onComplete={handleQuestionnaireComplete} />
          )}

          {/* Curated selection removed */}

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
                                   selectedInspirationCategory === 'Cleanser' ? 'Cleansers' : 
                                   selectedInspirationCategory === 'SPF' ? 'Sunscreens' :
                                   selectedInspirationCategory === 'Glass skin essentials' ? 'Glass Skin' :
                                   selectedInspirationCategory === 'Soothe sensitive skin' ? 'Sensitivity' :
                                   selectedInspirationCategory === 'Barrier repair' ? 'Barrier Repair' :
                                   selectedInspirationCategory === 'Anti-aging' ? 'Anti-Aging' :
                                   selectedInspirationCategory}
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
                          <Shield className="w-3.5 h-3.5 text-rose-600 shrink-0" />
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
                      <p className="text-xs font-black uppercase tracking-wider text-black">Loading..</p>
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
                    <h3 className="font-sans font-bold uppercase tracking-[0.14em] text-[#171717] text-sm md:text-base">
                      For you
                    </h3>
                    <p className="text-xs text-[#73716C] font-medium mt-1">
                      Explore products chosen for your skin type and goals
                    </p>
                  </div>
                  
                  <div className="flex flex-nowrap gap-4 overflow-x-auto pb-4 pt-1 no-scrollbar scroll-smooth snap-x snap-mandatory">
                    {[
                      { key: 'Moisturiser', title: 'Moisturisers', img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/web_art/moisturiser2.jpg' },
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
                        <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full p-0.5 border border-[#E5E4E0] group-hover:border-[#171717] transition-all bg-[#F4F3F0]">
                          {cat.img ? (
                            <img 
                              src={cat.img} 
                              alt={cat.title} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover rounded-full" 
                            />
                          ) : (
                            <div className="w-full h-full bg-[#F4F3F0] rounded-full flex items-center justify-center text-[10px] text-[#73716C] font-semibold">
                              Skin
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-[#262626] uppercase tracking-[0.12em] mt-2 text-center whitespace-normal leading-tight px-0.5 w-full">
                          {cat.title}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Routine Card */}
                {renderMyRoutinesSection(false)}

                {/* Trending Section */}
                <div className="space-y-4 mt-12 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-bold uppercase tracking-[0.14em] text-[#171717] text-sm md:text-base">
                      Trending
                    </h3>
                    <button
                      onClick={() => {
                        setSocialActiveMainTab('videos');
                        setAppState(AppState.SOCIAL);
                      }}
                      className="text-xs uppercase tracking-[0.14em] text-[#171717] font-semibold hover:opacity-70 transition-opacity flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>See more</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {loadingLatestVideos ? (
                    <div className="flex md:grid md:grid-cols-3 gap-3 overflow-x-auto no-scrollbar pb-4">
                      <div className="shrink-0 w-[300px] md:w-auto h-48 bg-[#F4F3F0] rounded-2xl animate-pulse" />
                      <div className="shrink-0 w-[300px] md:w-auto h-48 bg-[#F4F3F0] rounded-2xl animate-pulse" />
                      <div className="shrink-0 w-[300px] md:w-auto h-48 bg-[#F4F3F0] rounded-2xl animate-pulse" />
                    </div>
                  ) : latestVideos && latestVideos.length > 0 ? (
                    <div className="flex md:grid md:grid-cols-3 gap-3 w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-4">
                      {latestVideos.map((video: any) => {
                        const isYoutube = video.type === 'youtube' || video.video_url?.includes('youtube.com') || video.video_url?.includes('youtu.be');
                        return (
                          <div 
                            key={video.id} 
                            className={`snap-start shrink-0 md:w-auto rounded-2xl bg-white border border-[#EAE9E5] p-3 space-y-3 flex flex-col justify-between shadow-none ${
                              isYoutube ? 'w-[300px]' : 'w-[220px]'
                            }`}
                          >
                            <div className="space-y-2">
                              {isYoutube ? (
                                <div className="w-full aspect-video relative rounded-xl overflow-hidden border border-[#E5E4E0] bg-[#F4F3F0]">
                                  <iframe
                                    src={getYouTubeEmbedUrl(video.video_url)}
                                    className="absolute inset-0 w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              ) : (
                                <div className="flex justify-center w-full">
                                  <div className="w-full max-w-[180px] aspect-[9/16] relative rounded-xl overflow-hidden bg-[#F4F3F0] border border-[#E5E4E0]">
                                    <TikTokPlayer
                                      videoId={video.video_id}
                                      videoUrl={video.video_url}
                                      title={video.title}
                                      isActive={activeAppTikTokId === video.id}
                                      onPlay={() => setActiveAppTikTokId(video.id)}
                                      containerClassName="w-full h-full relative overflow-hidden bg-black"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div>
                              {video.title && (
                                <h4 className="text-xs font-medium text-[#171717] line-clamp-1 leading-snug">
                                  {video.title}
                                </h4>
                              )}
                              <span className="text-[10px] text-[#73716C] uppercase tracking-wider block mt-1">
                                {isYoutube ? 'YouTube Expert Review' : 'TikTok Routine'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-8 rounded-2xl border border-dashed border-[#E5E4E0] bg-[#FAFAFA] flex flex-col items-center justify-center">
                      <p className="text-[#73716C] text-[11px] font-medium uppercase tracking-widest">No updates available</p>
                    </div>
                  )}
                </div>

                {/* Guides Section */}
                <div className="space-y-4 mt-12 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans font-bold uppercase tracking-[0.14em] text-[#171717] text-sm md:text-base">
                      Guides
                    </h3>
                    <button
                      onClick={() => {
                        setSocialActiveMainTab('guides');
                        setAppState(AppState.SOCIAL);
                      }}
                      className="text-xs uppercase tracking-[0.14em] text-[#171717] font-semibold hover:opacity-70 transition-opacity flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>See more</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {landingGuide && (
                    <div className="space-y-4">
                      {/* Featured Guide Card (Horizontal Split) */}
                      <div 
                        onClick={() => {
                          setSocialActiveMainTab('guides');
                          setAppState(AppState.SOCIAL);
                        }}
                        className="rounded-2xl bg-white border border-[#EAE9E5] hover:border-[#CFCBC2] transition-all overflow-hidden cursor-pointer group flex flex-col md:flex-row shadow-none"
                      >
                        {landingGuide.imageUrl && (
                          <div className="w-full md:w-1/2 aspect-[16/9] md:aspect-auto md:h-full bg-[#F4F3F0] relative overflow-hidden">
                            <img 
                              src={landingGuide.imageUrl} 
                              alt={landingGuide.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                            />
                            <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-[#171717] text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded-md border border-[#EAE9E5]">
                              Featured
                            </span>
                          </div>
                        )}
                        <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-between space-y-4">
                          <div className="space-y-3">
                            <div>
                              <span className="bg-[#FAF7F0] border border-[#D6C7A9] text-[#7A6332] text-[10px] font-semibold tracking-wider px-2.5 py-1 rounded-md uppercase inline-block">
                                {landingGuide.category}
                              </span>
                              <span className="text-[10px] text-[#73716C] uppercase tracking-wider ml-2">
                                • {landingGuide.readTime || '4 min read'}
                              </span>
                            </div>
                            <h4 className="font-sans font-semibold text-[#171717] text-base md:text-lg uppercase tracking-tight group-hover:text-[#7A6332] transition-colors">
                              {landingGuide.title}
                            </h4>
                            <p className="text-xs md:text-sm text-[#73716C] leading-relaxed font-normal line-clamp-2">
                              {landingGuide.summary}
                            </p>
                          </div>
                          <div className="pt-4 border-t border-[#EAE9E5] flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#171717]">
                            <span>Explore full guide</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>

                      {/* 2-Column Secondary Guides Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {SKINCARE_GUIDES.slice(1, 3).map((guide) => (
                          <div 
                            key={guide.id}
                            onClick={() => {
                              setSocialActiveMainTab('guides');
                              setAppState(AppState.SOCIAL);
                            }}
                            className="rounded-xl bg-white border border-[#EAE9E5] hover:border-[#CFCBC2] transition-all p-5 cursor-pointer group flex flex-col justify-between space-y-3 shadow-none"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="bg-[#FAF7F0] border border-[#D6C7A9] text-[#7A6332] text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-md uppercase">
                                  {guide.category}
                                </span>
                                <span className="text-[10px] text-[#73716C] uppercase tracking-wider">{guide.readTime}</span>
                              </div>
                              <h5 className="font-sans font-semibold text-[#171717] text-xs uppercase tracking-tight group-hover:text-[#7A6332] transition-colors line-clamp-1">
                                {guide.title}
                              </h5>
                              <p className="text-xs text-[#73716C] line-clamp-2 leading-relaxed">
                                {guide.summary}
                              </p>
                            </div>
                            <div className="pt-2 border-t border-[#EAE9E5] flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#171717]">
                              <span>Read guide</span>
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        ))}
                      </div>
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


          {/* MY ROUTINES PAGE */}
          {appState === AppState.ROUTINES && (
            <motion.div 
              key="routines-page"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8 max-w-4xl mx-auto w-full pb-16"
            >
              <div className="border-b border-black/5 pb-4 md:pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sun className="w-5 h-5 text-venus-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-venus-accent">Routine</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-sans font-black text-black uppercase tracking-tight">
                    My Routines
                  </h2>
                  <p className="text-xs md:text-sm text-black/50 font-medium mt-1">
                    Track your daily routines.
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <button 
                    onClick={handleAddRoutine}
                    className="bg-black text-white px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest font-black hover:bg-venus-accent transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Routine</span>
                  </button>
                  <button 
                    onClick={() => triggerPhotoScan(dashboardFileInputRef)}
                    disabled={isDashboardScanning}
                    className="bg-black/5 hover:bg-black/10 text-black px-4 py-2.5 rounded-xl text-xs uppercase tracking-widest font-black transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    {isDashboardScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    <span>Scan Product</span>
                  </button>
                </div>
              </div>

              {renderMyRoutinesSection(true)}
            </motion.div>
          )}

          {/* BRANDS PAGE */}
          {appState === AppState.BRANDS && (
            <BrandsView 
              setAppState={setAppState}
              user={user}
              userProfile={userProfile}
              selectedBrandItem={selectedBrandItem}
              setSelectedBrandItem={setSelectedBrandItem}
              selectedBrandsLetter={selectedBrandsLetter}
              setSelectedBrandsLetter={setSelectedBrandsLetter}
              onSelectProduct={(prod) => {
                setSelectedProductForPage(prod);
                setAppState(AppState.PRODUCT_PAGE);
              }}
            />
          )}

          {appState === AppState.RANK && (
            <motion.div 
              key="rank"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-1 md:pt-2 max-w-6xl mx-auto space-y-4 w-full"
            >
              {/* Products column */}
              <div className="space-y-4 w-full">
                <div className="flex flex-col items-center gap-3 border-b-2 border-black pb-3 w-full text-center">
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black text-center w-full" style={{ fontFamily: '"fuzzy-bubbles", sans-serif' }}>
                    Browse Products
                  </h2>
                  
                  {/* Primary Filter Bubbles (Circular Photo Bubbles like reference image) */}
                  <div className="flex flex-nowrap justify-start sm:justify-center md:justify-center gap-3 md:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1 snap-x snap-mandatory w-full">
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

                  {/* Sub-bar Filter based on Primary Filter */}
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

                  <input 
                     type="text"
                     placeholder="Search by brand or name..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     style={{ display: "none" }}
                     className="w-full bg-transparent border-t border-black/10 pt-3 text-xs font-black uppercase text-black placeholder:text-black/40 outline-none hidden"
                   />
                  {isSearching && <div className="text-[9px] font-black uppercase text-venus-accent animate-pulse text-center w-full">Searching...</div>}
                </div>

                {products.length === 0 ? (
                  <div className="text-center py-20 clean-card border-dashed border-2 border-black/5 bg-white/50 w-full">
                    <ShoppingBag className="w-12 h-12 text-black/10 mx-auto mb-4" />
                    <p className="text-black/30 text-sm font-black uppercase tracking-widest mb-6">Database currently indexing...</p>
                    {user?.email === 'mv.botez@gmail.com' && (
                      <button 
                        onClick={async (e) => {
                          const btn = e.currentTarget;
                          btn.disabled = true;
                          btn.innerText = "Syncing Routine...";
                          try {
                            const data = await import('./data/products.json');
                            const payload = data.default;
                            const { error } = await supabase
                              .from('products')
                              .insert(payload);
                            
                            if (error) {
                               throw error;
                            }
                          } catch (err: any) {
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3 md:gap-4 w-full">
                    {(() => {
                      const baseList = searchQuery ? searchResults : products;
                      const filtered = baseList.filter(p => {
                        const pType = (p.type || p.Type || '').toLowerCase();
                        const pName = (p.name || p.Name || p.ProductName || p['Product Name'] || '').toLowerCase();
                        const pBrand = (p.brand || p.Brand || '').toLowerCase();
                        const pDesc = (p.description || '').toLowerCase();
                        const pIngs = Array.isArray(p.ingredients) ? p.ingredients.map((i: string) => i.toLowerCase()) : [];

                        const cat2 = (p.product_scores?.cat2 || '').toLowerCase();
                        const pf = (Array.isArray(p.products_filter) ? p.products_filter[0] : p.products_filter) || {};
                        const isMen = pf.men === true;
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
                          if (!pregSafe) return false;
                          if (subFilter === 'All' || subFilter === 'all') return true;
                          return cat2 === subFilter.toLowerCase() || pType.includes(subFilter.toLowerCase()) || pName.includes(subFilter.toLowerCase());
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
                                 pDesc.includes(target) || (cleanTarget.length > 2 && pDesc.includes(cleanTarget)) ||
                                 pName.includes(target) || (cleanTarget.length > 2 && pName.includes(cleanTarget));
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

                      if (filtered.length === 0) {
                        return (
                          <div className="col-span-2 sm:col-span-4 md:col-span-4 py-12 text-center text-black/40 text-xs uppercase font-black tracking-widest clean-card bg-white/50 w-full">
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
                            className="cursor-pointer clean-card p-3 border-2 bg-white border-black/5 hover:border-black transition-all flex flex-col items-center text-center justify-between gap-2 relative group w-full"
                            data-product-id={p.id}
                          >
                            {p.photo_url ? (
                              <img 
                                src={p.photo_url} 
                                alt={p.name || p.Name || p.ProductName || p['Product Name'] || 'Product'} 
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
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
                              <h3 className="text-[10px] md:text-xs font-black text-black uppercase leading-tight whitespace-normal break-words text-center">
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

                {/* Server-Side Pagination Load More & Progress */}
                {products.length > 0 && (
                  <div className="mt-8 flex flex-col items-center justify-center gap-3 w-full pb-8">
                    <p className="text-[10px] md:text-xs font-black uppercase tracking-wider text-black/60">
                      Showing {products.length} of {totalProductCount} products
                    </p>
                    {products.length < totalProductCount && (
                      <button
                        onClick={handleLoadMoreProducts}
                        disabled={isLoadingMore}
                        className="px-6 py-3 bg-black text-white hover:bg-venus-accent transition-all rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {isLoadingMore ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <span>LOAD MORE</span>
                        )}
                      </button>
                    )}
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

          {appState === AppState.PROFILE && (
            <ProfileView
              user={user}
              profile={profile}
              userProfile={userProfile}
              setUserProfile={setUserProfile}
              setProfile={setProfile}
              setAppState={setAppState}
              navigateTo={navigateTo}
              handleSignOut={handleSignOut}
            />
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

                    {/* Public Checkbox */}
                    <div className="mb-6 flex items-center gap-3 bg-black/5 p-4 rounded-xl border border-black/5">
                      <input 
                        type="checkbox" 
                        id="routinePublicCheckbox"
                        checked={routinePublic}
                        onChange={e => setRoutinePublic(e.target.checked)}
                        className="w-4 h-4 rounded border-black/20 text-black focus:ring-black cursor-pointer"
                      />
                      <label htmlFor="routinePublicCheckbox" className="text-xs font-black uppercase tracking-widest text-black cursor-pointer select-none">
                        Public (Share routine in Spotlights & Community Inspo)
                      </label>
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

                    {/* Routine Video Link */}
                    <div className="mb-6">
                       <h3 className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-3">Routine Video Link (TikTok, Instagram, or YouTube)</h3>
                       <input 
                         type="url" 
                         placeholder="e.g. https://www.tiktok.com/... or https://youtube.com/..." 
                         className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black transition-all"
                         value={routineUrl}
                         onChange={e => setRoutineUrl(e.target.value)}
                       />
                       <p className="text-[10px] text-black/40 mt-1 font-medium">Optional. Only TikTok, Instagram, and YouTube links are accepted and will be shown when opened from community routines.</p>
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
      {(appState === AppState.ROUTINES || appState === AppState.PROFILE || appState === AppState.DASHBOARD || appState === AppState.RANK || appState === AppState.TRACKER || appState === AppState.SOCIAL || appState === AppState.BRANDS || appState === AppState.COMMUNITY) && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-40 pointer-events-none px-4">
          <div className="pointer-events-auto bg-white/90 backdrop-blur-md border border-[#E5E4E0] shadow-sm rounded-full px-6 py-2.5 flex items-center gap-6 md:gap-8">
            {user && (
              <button 
                onClick={() => setAppState(AppState.DASHBOARD)}
                className={`p-1.5 transition-colors cursor-pointer relative ${appState === AppState.DASHBOARD ? 'text-[#171717]' : 'text-[#73716C] hover:text-[#171717]'}`}
                title="Dashboard"
              >
                <Home className="w-5 h-5 stroke-[1.5]" />
                {appState === AppState.DASHBOARD && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#171717] rounded-full" />
                )}
              </button>
            )}
            
            <button 
              onClick={() => setAppState(AppState.RANK)}
              className={`p-1.5 transition-colors cursor-pointer relative ${appState === AppState.RANK ? 'text-[#171717]' : 'text-[#73716C] hover:text-[#171717]'}`}
              title="Products"
            >
              <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
              {appState === AppState.RANK && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#171717] rounded-full" />
              )}
            </button>

            <button
              onClick={() => triggerPhotoScan(navFileInputRef)}
              disabled={isNavScanning}
              className="p-1.5 text-[#73716C] hover:text-[#171717] transition-colors cursor-pointer"
              title="Scan Product"
            >
              {isNavScanning ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#171717]" />
              ) : (
                <Camera className="w-5 h-5 stroke-[1.5]" />
              )}
            </button>

            <button 
              onClick={() => setAppState(AppState.TRACKER)}
              className={`p-1.5 transition-colors cursor-pointer relative ${appState === AppState.TRACKER ? 'text-[#171717]' : 'text-[#73716C] hover:text-[#171717]'}`}
              title="Tracker"
            >
              <CheckSquare className="w-5 h-5 stroke-[1.5]" />
              {appState === AppState.TRACKER && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#171717] rounded-full" />
              )}
            </button>

            {Number(profile?.type) === 1 && (
              <button 
                onClick={() => setAppState(AppState.COMMUNITY)}
                className={`p-1.5 transition-colors cursor-pointer relative ${appState === AppState.COMMUNITY ? 'text-[#171717]' : 'text-[#73716C] hover:text-[#171717]'}`}
                title="Community"
              >
                <Users className="w-5 h-5 stroke-[1.5]" />
                {appState === AppState.COMMUNITY && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#171717] rounded-full" />
                )}
              </button>
            )}

            <button 
              onClick={() => { setAppState(AppState.SOCIAL); setIsFollowsOpen(false); }}
              className={`p-1.5 transition-colors cursor-pointer relative ${appState === AppState.SOCIAL ? 'text-[#171717]' : 'text-[#73716C] hover:text-[#171717]'}`}
              title="The Edit & Social"
            >
              <Heart className="w-5 h-5 stroke-[1.5]" />
              {appState === AppState.SOCIAL && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#171717] rounded-full" />
              )}
            </button>
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
              if (nudgeError) {}
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
      <AiProductComparisonModal
        isOpen={isAiCompareModalOpen}
        onClose={() => setIsAiCompareModalOpen(false)}
        userId={user?.id}
      />
      <TrackerNewProductModal
        isOpen={isTrackerModalOpen}
        onClose={() => setIsTrackerModalOpen(false)}
        userId={user?.id}
        onSave={fetchTrackerData}
        onProductAdded={handleTrackerProductAdded}
        onSuccess={handleTrackerProductAdded}
      />
      {isSharingOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl border border-black/10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black uppercase tracking-tighter text-black">Share Routine</h3>
              <button onClick={() => { setIsSharingOpen(false); setShareRoutine(null); setUsernameSearch(''); }} className="p-2 rounded-full bg-black/5 hover:bg-black/10 text-black transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-black/60 font-medium">
              Share "{shareRoutine?.routine_name || 'Routine'}" to social apps or friends:
            </p>

            {/* Social Share Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  const text = `Check out this routine "${shareRoutine?.routine_name || 'Skincare Routine'}" on Canonic!\n\nExplore Canonic: https://www.canonic.co.uk`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="p-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#075E54] rounded-2xl flex items-center gap-2.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer border border-[#25D366]/20"
              >
                <span className="w-6 h-6 rounded-full bg-[#25D366] text-white flex items-center justify-center text-xs font-bold">W</span>
                <span>WhatsApp</span>
              </button>

              <button
                onClick={() => {
                  const text = `Check out this routine "${shareRoutine?.routine_name || 'Skincare Routine'}" on Canonic!\n\nExplore Canonic: ${window.location.href}`;
                  navigator.clipboard.writeText(text);
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
                }}
                className="p-3 bg-[#0084FF]/10 hover:bg-[#0084FF]/20 text-[#0063CC] rounded-2xl flex items-center gap-2.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer border border-[#0084FF]/20"
              >
                <span className="w-6 h-6 rounded-full bg-[#0084FF] text-white flex items-center justify-center text-xs font-bold">M</span>
                <span>Messenger</span>
              </button>

              <button
                onClick={() => {
                  const text = `Check out this routine "${shareRoutine?.routine_name || 'Skincare Routine'}" on Canonic!\n\nExplore Canonic: ${window.location.href}`;
                  navigator.clipboard.writeText(text);
                  alert('Routine copied to clipboard! Paste it into your Instagram Story, caption, or post.');
                }}
                className="p-3 bg-[#E1306C]/10 hover:bg-[#E1306C]/20 text-[#C13584] rounded-2xl flex items-center gap-2.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer border border-[#E1306C]/20"
              >
                <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#FD1D1D] to-[#833AB4] text-white flex items-center justify-center text-xs font-bold">IG</span>
                <span>Instagram</span>
              </button>

              <button
                onClick={() => {
                  const text = `Check out this routine "${shareRoutine?.routine_name || 'Skincare Routine'}" on Canonic!\n\nExplore Canonic: ${window.location.href}`;
                  navigator.clipboard.writeText(text);
                  alert('Routine copied to clipboard! Paste it into your TikTok video description.');
                }}
                className="p-3 bg-black/5 hover:bg-black/10 text-black rounded-2xl flex items-center gap-2.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer border border-black/10"
              >
                <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">TT</span>
                <span>TikTok</span>
              </button>
            </div>

            <div className="pt-1">
              <button
                onClick={() => {
                  const text = `Check out this routine "${shareRoutine?.routine_name || 'Skincare Routine'}" on Canonic!\n\nExplore Canonic: ${window.location.href}`;
                  navigator.clipboard.writeText(text);
                  setSuccessMessage('Routine copied to clipboard!');
                  setTimeout(() => setSuccessMessage(null), 2500);
                }}
                className="w-full py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-venus-accent transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Copy Routine & Link</span>
              </button>
              {successMessage && (
                <p className="text-[11px] text-green-600 font-bold text-center mt-1.5">{successMessage}</p>
              )}
            </div>

            {/* Internal User Sharing */}
            <div className="space-y-2 pt-2 border-t border-black/10">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/50">Share with Canonic Users</span>
              <input 
                type="text" 
                placeholder="Search usernames..." 
                value={usernameSearch} 
                onChange={(e) => setUsernameSearch(e.target.value)}
                className="w-full text-xs p-3 bg-black/5 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-black"
              />
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {userResults.map(u => (
                  <button key={u.id} onClick={() => handleShareRoutine(u.id)} className="w-full text-left p-2.5 hover:bg-black/5 rounded-xl text-xs font-black uppercase text-black transition-colors">
                    @{u.username}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => { setIsSharingOpen(false); setShareRoutine(null); setUsernameSearch(''); }} className="w-full py-2 text-[10px] font-black uppercase tracking-wider text-black/50 hover:text-black cursor-pointer">Cancel</button>
          </motion.div>
        </div>
      )}
      {error && <ErrorModal error={typeof error === 'string' ? error : error?.message || String(error)} onClose={() => setError(null)} />}
      {authPromptModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full relative space-y-4 text-center">
            <button className="absolute top-4 right-4 text-gray-400 hover:text-black transition cursor-pointer p-1" onClick={() => { setAuthPromptModalOpen(false); setAuthPromptConfig(null); }}>
              <X className="w-5 h-5"/>
            </button>
            <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto text-black">
              <UserIcon className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-black">
              {authPromptConfig?.title || "Log In or Sign Up to add this to your tracker"}
            </h3>
            <p className="text-xs text-black/60">
              {authPromptConfig?.description || "Create an account or log in to track your skincare routine, products, and skin progress."}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setAuthPromptModalOpen(false);
                  setAuthPromptConfig(null);
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
                  setAuthPromptConfig(null);
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
      <FeatureUnavailableModal
        isOpen={showFeatureUnavailable}
        onClose={() => setShowFeatureUnavailable(false)}
      />
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
      {(isNavScanning || isDashboardScanning) && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/65 backdrop-blur-md">
          <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl max-w-xs text-center border-2 border-black/5">
            <Loader2 className="w-10 h-10 animate-spin text-venus-accent" />
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-black">
                Analyzing Photo...
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsNavScanning(false);
                setIsDashboardScanning(false);
              }}
              className="mt-1 text-xs text-black/40 hover:text-black font-semibold underline cursor-pointer"
            >
              Cancel
            </button>
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
      {navScanError && (
        <div className="fixed bottom-6 left-6 right-6 z-[210] p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-center space-y-2 shadow-2xl max-w-md mx-auto">
          <p className="text-xs font-bold">{navScanError}</p>
          <button
            onClick={() => {
              setNavScanError(null);
              triggerPhotoScan(navFileInputRef);
            }}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all cursor-pointer"
          >
            Retry Scan
          </button>
        </div>
      )}
    </div>
  </>
);
}
