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
  ChevronDown
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { supabase } from './lib/supabase';
import { ProductCardProvider, useProductCard } from './context/ProductCardContext';
import { Login } from './components/Login';
import { ProductDetailModalNew } from './components/ProductDetailModalNew';
import { ProductCard } from './components/ProductCard';
import { ProductLink } from './components/ProductLink';
import { ComparisonModal } from './components/ComparisonModal';
import { TrackerNewProductModal } from './components/TrackerNewProductModal';
import { TrackerProductCard } from './components/TrackerProductCard';
import { Social } from './components/Social';
import { Questionnaire } from './components/Questionnaire';
import { INVENTORY, Product } from './constants';
import { searchProductsFromPhoto, ProductConfirmationModal, MatchedProduct } from './components/photo_search';
import { evaluateProductCategory } from './utils/productCategoryEvaluator';

// --- Components ---

// ... (rest of imports)

const GlowingBackground = ({ appState }: { appState: AppState }) => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-b from-[#FAF9F6] to-[#F3F2EE]">
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
  LEADERBOARD,
  TRACKER,
  SOCIAL,
  PROFILE
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
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
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<any | null>(null);
  const [selectedProductForUPP, setSelectedProductForUPP] = useState<any | null>(null);
  const [uppCategories, setUppCategories] = useState<string[]>([]);
  const [uppImpression, setUppImpression] = useState<'Loved it' | 'Was OK' | 'Not for me'>('Loved it');
  const [uppNotes, setUppNotes] = useState('');
  const [uppLength, setUppLength] = useState('');
  const [uppFrequency, setUppFrequency] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [trackerFilter, setTrackerFilter] = useState<{ category: string; subOption?: string }>({ category: 'All' });
  const [isTrackerFilterOpen, setIsTrackerFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [expandedRoutines, setExpandedRoutines] = useState<number[]>([]);

  const toggleRoutineExpansion = (idx: number) => {
    setExpandedRoutines(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
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
  const [isSharingOpen, setIsSharingOpen] = useState(false);
  const [shareRoutine, setShareRoutine] = useState<any>(null);
  const [usernameSearch, setUsernameSearch] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [newProductForComparison, setNewProductForComparison] = useState<any | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [isFollowsOpen, setIsFollowsOpen] = useState(false);
  const [socialTab, setSocialTab] = useState<'Messages' | 'Friends'>('Friends');

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
  const [landingEvaluationResults, setLandingEvaluationResults] = useState<any[]>([]);
  const [isLandingEvaluationOpen, setIsLandingEvaluationOpen] = useState(false);
  const [isLandingEvaluating, setIsLandingEvaluating] = useState(false);

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
    
    console.log('Sharing routine to:', targetUserId);
    
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
        console.log('Routine shared successfully');
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

        const symptomsScore = (answers.sensitivity || []).length;
        const reactionScore = reactionMap[answers.reaction] || 0;

        // Calculate redness score from answers
        let rednessScore = 0;
        const sensitivityList = answers.sensitivity || [];
        if (sensitivityList.includes('Redness')) {
            rednessScore += 45;
        }
        const goals = answers.goals || [];
        const hasCalmRedness = Array.isArray(goals) 
            ? goals.includes('Calm redness') 
            : goals === 'Calm redness';
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
            age: String(answers.age || '0'),
            skin_tone: parseInt(answers.skinTone) || 0,
            burn_risk: String(sunMap[answers.sun] || 'medium'),
            symptoms: symptomsScore,
            new_product_reaction: reactionScore,
            barrier_risk: symptomsScore + reactionScore,
            sensitivity: answers.sensitivity || [],
            goals: answers.goals || [],
            breakout_type: answers.breakoutType || [],
            breakout_where: answers.breakoutWhere || null,
            env: answers.env || null,
            sunscreen: answers.sunscreen || null,
            makeup: answers.makeup || null,
            makeup_remove: answers.makeupRemove || null,
            current_products: answers.currentProducts || [],
            past_problems: answers.pastProblems || null,
            redness: rednessScore,
            redness_score: answers.redness_score !== undefined ? Number(answers.redness_score) : null,
            wrinkles_score: answers.wrinkles_score !== undefined ? Number(answers.wrinkles_score) : null,
            redness_main_area: answers.redness_main_area || null,
            wrinkels_main_area: answers.wrinkels_main_area || null,
            scan_acne_type: answers.scan_acne_type || null,
            sex: answers.sex || null,
            pregnant: answers.pregnant || null,
            actives_used: answers.activesUsed || []
        };

        let { error: profileError } = await supabase
            .from('user_profile')
            .upsert(profilePayload);
        
        // Graceful retry fallback if the new face scan columns or sex/pregnant/actives_used columns do not exist in the backend database yet
        if (profileError && (profileError.message.toLowerCase().includes('column') || profileError.code === '42703')) {
            console.warn('Supabase profile table structure does not match, removing extended columns and retrying...');
            const { 
              redness, redness_score, wrinkles_score, redness_main_area, wrinkels_main_area, scan_acne_type,
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

  const performSearch = async (query: string, filter: string) => {
    const currentId = ++searchIdRef.current;
    if (!query && filter === 'All') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      let supabaseQuery = supabase
        .from('products')
        .select('id, brand, name, type, photo_url');

      if (query.trim()) {
        const formattedQuery = query
          .trim()
          .split(/\s+/)
          .filter(word => word.length > 0)
          .map(word => `${word}:*`)
          .join(' & ');

        supabaseQuery = supabaseQuery.textSearch('fts_search', formattedQuery, {
          config: 'english'
        });
      }

      if (filter !== 'All') {
        supabaseQuery = supabaseQuery.ilike('type', filter);
      }

      const { data, error } = await supabaseQuery.limit(10);
      
      if (error) throw error;
      if (currentId === searchIdRef.current) {
        setSearchResults(data || []);
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
  };

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
  }, [debouncedSearchQuery, productFilter]);

  useEffect(() => {
    performRoutineSearch(debouncedRoutineSearchQuery);
  }, [debouncedRoutineSearchQuery]);

  // Handlers
  const handleDeleteRoutine = async () => {
    if (!routineToDelete) {
      console.warn("handleDeleteRoutine: routineToDelete is null");
      return;
    }
    console.log("handleDeleteRoutine: Attempting to delete routine:", routineToDelete);
    try {
      const { data, error, status } = await supabase
        .from('routines')
        .delete()
        .eq('id', routineToDelete.id)
        .select();

      console.log("Delete response:", { data, error, status });

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

  const handleTrackerProductClick = async (item: any) => {
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
      openProductCard(productId);
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

  // Auth Listener
  useEffect(() => {
    let mounted = true;
    
    // Quick initialize check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
       if (error) {
           console.error("Session fetching error (ignoring and clearing):", error);
           supabase.auth.signOut().catch(console.error);
       }
       // If no session, we aren't waiting for a profile fetch
       if (!session && mounted) {
           setLoading(false);
       }
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

                // Save and evaluate cached landing products if they exist right after they signed up
                const cachedLanding = localStorage.getItem('cachedLandingProducts');
                if (cachedLanding) {
                    if (mounted) setIsLandingEvaluating(true);
                    try {
                        const productsToEvaluate = JSON.parse(cachedLanding);
                        
                        // We do NOT automatically save the scanned photo-captured products to the tracker table here.
                        // Only products they explicitly declared they are using in the questionnaire are saved to tracker.
                        await fetchTrackerData(currentUser.id);

                        // Evaluate each product's category for the new skin profile
                        const evaluations = await Promise.all(
                            productsToEvaluate.map(async (prod: any) => {
                                try {
                                    const result = await evaluateProductCategory(currentUser.id, prod.id, []);
                                    return {
                                        product: prod,
                                        evaluation: result
                                    };
                                } catch (err) {
                                    console.error(`Error evaluating product ${prod.id}:`, err);
                                    return {
                                        product: prod,
                                        evaluation: {
                                            category: 'Safe',
                                            reasons: ['Unable to fetch evaluation results.']
                                        }
                                    };
                                }
                            })
                        );
                        
                        // Set state to show the evaluation results popup
                        if (mounted) {
                            setLandingEvaluationResults(evaluations);
                            setIsLandingEvaluationOpen(true);
                        }
                        
                        // Clear the cached products
                        localStorage.removeItem('cachedLandingProducts');
                    } catch (cacheErr) {
                        console.error("Error processing cached landing products:", cacheErr);
                    } finally {
                        if (mounted) setIsLandingEvaluating(false);
                    }
                }
            } catch (e: any) {
                console.error("Error saving pending profile:", e);
                setError(`Error saving profile info: ${e.message}`);
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

    if (user) {
      // If we are on landing/auth but logged in, move directly to dashboard
      if (appState === AppState.LANDING || appState === AppState.AUTH) {
        setAppState(AppState.DASHBOARD);
      }
    } else {
      // If logged out, only allow entry points
      const allowedStates = [AppState.LANDING, AppState.AUTH, AppState.ONBOARDING_DETAILS, AppState.RANK, AppState.LEADERBOARD, AppState.TRACKER];
      if (!allowedStates.includes(appState)) {
        setAppState(AppState.LANDING);
      }
    }
  }, [user, profile, appState, loading]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('id, brand, name, type, photo_url')
        .limit(10);
      if (error) { console.error('FAILED CALL:', { table: 'products', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
      if (productsData) setProducts(productsData);
    };

    fetchProducts();

    const productsChannel = supabase.channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const { data, error } = await supabase.from('products').select('id, brand, name, type, photo_url').limit(10);
        if (error) { console.error('FAILED CALL:', { table: 'products', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
        if (data) setProducts(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
    };
  }, []);

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

  // Supabase listeners
  useEffect(() => {
    if (!user) return;

    const fetchInitialData = async () => {
      console.log('Fetching initial data for user:', user.id);
      // Routines
      const { data: routinesData, error: routinesError } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: true });
      if (routinesError) { console.error('FAILED ROUTINES CALL:', routinesError); }
      else { console.log('Fetched routines:', routinesData); setRoutines(routinesData || []); }

      // Progress
      const { data: progressData, error: progressError } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });
      if (progressError) { console.error('FAILED PROGRESS CALL:', progressError); }
      else { console.log('Fetched progress:', progressData); setProgressPhotos(progressData || []); }

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
      else { console.log('Fetched user_profile:', profileData); setUserProfile(profileData || null); }

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
        console.log('Realtime change detected in upp table:', payload);
        const { data, error } = await supabase.from('upp').select('*').eq('user_id', user.id);
        if (error) { console.error('FAILED CALL:', { table: 'upp', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
        if (data) {
          console.log('UPP products updated via realtime:', data.length);
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
    console.log('Attempting sign out...');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Supabase sign out error returned:', error);
      } else {
        console.log('Supabase sign out executed successfully.');
      }
      setUser(null);
      setAppState(AppState.AUTH);
      console.log('Sign out completed, state updated.');
    } catch (error) {
      console.error('Sign out caught error:', error);
      // Even if sign out fails, force clean up local state
      setUser(null);
      setAppState(AppState.AUTH);
      alert('Sign out encountered an error.');
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
      console.log("Progress upload started for file:", file.name);
      
      try {
        // Options for compression
        const options = {
          maxSizeMB: 0.1, // ~100kb
          maxWidthOrHeight: 1200,
          useWebWorker: false,
          fileType: 'image/webp'
        };

        const compressedFile = await imageCompression(file, options);
        console.log('Compressed file size:', compressedFile.size / 1024, 'KB');

        // Define unique path
        const fileExt = 'webp';
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        console.log('Attempting upload to Supabase storage:', filePath);
        
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
        
        console.log('Upload successful:', uploadData);

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('progress_pics')
          .getPublicUrl(filePath);
        
        console.log('Generated Public URL:', publicUrl);

        // Insert into progress table
        const payload = {
          user_id: user.id,
          image_url: publicUrl,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString() // Keep timestamp for existing UI compatibility
        };

        console.log('Inserting into progress table with payload:', payload);

        const { data: insertedData, error: insertError } = await supabase
          .from('progress')
          .insert(payload)
          .select()
          .single();

        if (insertError) {
          console.error('Database Insert Error:', insertError);
          throw insertError;
        }

        console.log('Database insertion successful:', insertedData);

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
    console.log("Delete button clicked for photo:", photo.id);
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
      console.log("Original image_url:", filePath);
      
      // If it's a full Supabase storage URL, we need the part after the bucket name
      const bucketName = 'progress_pics';
      if (filePath.includes(`/${bucketName}/`)) {
        filePath = filePath.split(`/${bucketName}/`).pop()?.split('?')[0] || filePath;
      }
      
      console.log("Extracted filePath for storage deletion:", filePath);

      // 2. Delete from Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      console.log("Storage removal result:", { storageData, storageError });
      if (storageError) {
        console.warn("Storage deletion warning (might already be gone):", storageError);
      }

      // 3. Delete from Database
      console.log("Attempting database deletion for id:", photo.id);
      const { error: dbError } = await supabase
        .from('progress')
        .delete()
        .eq('id', photo.id);

      if (dbError) {
        console.error("Database deletion error:", dbError);
        throw dbError;
      }

      console.log("Deletion successful");

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
    console.log('Questionnaire answers:', answers);
    
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
      const payload = {
        id: user.id,
        email: user.email,
        skin_type: skinType,
        primary_issue: concern,
        onboarding_complete: true,
        created_at: new Date().toISOString()
      };
      console.log('Attempting to write to users with payload:', payload);

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
      console.log('Attempting to write to routines with payload:', routinePayload);

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
      console.log('Attempting to write to users with payload:', userPayload);
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
    console.log('handleSaveRoutine clicked, user:', !!user);
    setRoutineFormError(null);
    setIsSavingRoutineForm(true);
    if (!user) {
      console.error('No user found');
      setRoutineFormError('No user found');
      setIsSavingRoutineForm(false);
      return;
    }
    
    try {
      console.log('modalMode:', modalMode);
      let processedProducts: any[] = [];
      if (modalMode === 'reminder') {
          console.log('Saving reminder for:', reminderRoutine.id);
          const { error } = await supabase.from('routines').update({ reminder: reminderTime }).eq('id', reminderRoutine.id);
          if (error) throw error;
      } else {
          console.log('Processing products:', routineSelectedProducts);
          processedProducts = await Promise.all(routineSelectedProducts.map(async p => {
            let productData = {
              id: p.id,
              brand: p.brand || p.Brand,
              name: p.name || p.ProductName || p.Name,
              type: p.type || p.Type || 'Custom',
              photo_url: p.photo_url || p.PhotoUrl || p.photoUrl || null
            };

            if (p.tempId) {
              console.log('Adding new product to supabase:', p.brand, p.name);
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
          console.log('Processed products:', processedProducts);

          const payload = {
            user_id: user.id,
            time: routineTime,
            days: routineDays,
            routine_name: routineName,
            notes: routineNotes,
            products: processedProducts
          };
          console.log('Saving routine:', payload);
          if (modalMode === 'edit') {
            const { error } = await supabase.from('routines').update(payload).eq('id', editingRoutine.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('routines').insert(payload);
            if (error) throw error;
          }
      }
      console.log('Routine saved successfully');
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
    console.log('handleSaveUPP triggered', { user: !!user, selectedProduct: !!selectedProductForUPP });
    if (!user || !selectedProductForUPP) {
       console.log('Early return in handleSaveUPP', { user: !!user, selectedProduct: !!selectedProductForUPP });
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
      
      console.log('Insert result from Supabase:', newProductEntry);

      if (insertError) throw insertError;

      // 2. Refresh userProducts immediately to ensure the latest Supabase calculations are reflected
      const { data: updatedProducts, error: refreshError } = await supabase.from('upp').select('*').eq('user_id', user.id);
      console.log('Fetched updated products:', updatedProducts);
      
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
      console.log('Fallback timeout: forced loading to false');
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  console.log('Current Loading State:', loading);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-[#FAF9F6] to-[#F3F2EE] space-y-4">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-venus-accent border-t-transparent rounded-full" />
      <button onClick={() => setLoading(false)} className="text-xs font-black uppercase tracking-widest hover:opacity-50">Skip Loading</button>
    </div>
  );

  return (
    <>
      <ProductCard />
      <div className="min-h-screen font-sans text-venus-warm relative overflow-x-hidden">
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
                <span className="font-bubble text-3xl text-black font-medium cursor-pointer" onClick={() => { setAppState(AppState.LANDING); setIsMobileNavOpen(false); }}>Méli</span>
                <button onClick={() => setIsMobileNavOpen(false)}><X /></button>
            </div>
            {/* Navigation items moved from footer */}
            <div className="flex flex-col gap-4">
              <button onClick={() => { setAppState(AppState.LANDING); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.LANDING ? 'text-black font-black' : 'text-black/60'}`}>
                <Newspaper className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Feed</span>
              </button>
              <button onClick={() => { setAppState(AppState.DASHBOARD); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.DASHBOARD ? 'text-black font-black' : 'text-black/60'}`}>
                <FlaskConical className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Home</span>
              </button>
              <button onClick={() => { setAppState(AppState.RANK); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.RANK ? 'text-black font-black' : 'text-black/60'}`}>
                <ShoppingBag className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Products</span>
              </button>
              <button onClick={() => { setAppState(AppState.LEADERBOARD); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.LEADERBOARD ? 'text-black font-black' : 'text-black/60'}`}>
                <Award className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Rankings</span>
              </button>
              <button onClick={() => { setAppState(AppState.SOCIAL); setIsFollowsOpen(false); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.SOCIAL && !isFollowsOpen ? 'text-black font-black' : 'text-black/60'}`}>
                <Heart className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Blog</span>
              </button>
              <button onClick={() => { setAppState(AppState.SOCIAL); setIsFollowsOpen(true); setSocialTab('Messages'); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.SOCIAL && isFollowsOpen ? 'text-black font-black' : 'text-black/60'}`}>
                <MessageCircle className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Messages</span>
              </button>
              <button onClick={() => { setAppState(AppState.TRACKER); setIsMobileNavOpen(false); }} className={`flex items-center gap-4 ${appState === AppState.TRACKER ? 'text-black font-black' : 'text-black/60'}`}>
                <CheckSquare className="w-6 h-6" />
                <span className="text-sm uppercase tracking-widest font-black">Tracker</span>
              </button>
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
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-black/5">
        <div className="flex justify-between items-center px-4 py-1.5 md:py-3 gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)} className="p-1">
              <Menu className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="flex-1 max-w-md mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-black/40" />
              <input 
                type="text" 
                placeholder="Search products..."
                className="w-full bg-white border border-black/10 py-1.5 px-3 pl-8 md:py-2 md:pl-10 rounded-lg text-[10px] md:text-xs font-black uppercase text-black placeholder:text-black/40 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {!user ? (
              <>
                <button 
                  onClick={() => { setIsSignUp(false); setAppState(AppState.AUTH); }}
                  className="text-xs md:text-sm font-black uppercase tracking-widest text-black/60 hover:text-black transition-colors"
                >
                  Sign In
                </button>
                <button 
                  onClick={() => { setIsSignUp(true); setAppState(AppState.AUTH); }}
                  className="bg-black text-white text-xs md:text-sm font-black uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-venus-accent transition-colors"
                >
                  Join
                </button>
              </>
            ) : (
               <div className="flex items-center gap-2">
                <button 
                  onClick={() => setAppState(AppState.DASHBOARD)} 
                  className={`transition-colors ${appState === AppState.DASHBOARD ? 'text-black' : 'text-black/60 hover:text-black'}`}
                  title="Dashboard"
                >
                  <UserIcon className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleSignOut}
                  className="text-black/60 hover:text-black transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
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
              <div className="flex items-center gap-4 mb-2 relative -top-32 md:-top-24">
                <h1 className="text-6xl md:text-8xl font-cursive font-bold leading-[0.8] text-venus-pink tracking-normal">
                  Méli
                </h1>
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
            <Questionnaire onComplete={handleQuestionnaireComplete} />
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
                <h2 className="text-5xl font-sans font-black text-black uppercase italic tracking-tighter">Curated Selection</h2>
                <div className="bg-black inline-block px-6 py-2 rounded-lg">
                  <span className="text-white text-xs font-black uppercase tracking-widest">Ritual 01-A</span>
                </div>
              </header>

              <div className="space-y-10">
                <h3 className="text-3xl font-sans font-black text-center text-black uppercase italic tracking-tight underline decoration-venus-accent decoration-4">Your Daily Ritual</h3>
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
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2 text-[80%]"
            >
              

              {/* Routine Card */}
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center justify-between md:border-0 md:pb-0">
                  <div className="flex items-center gap-2 text-black">
                    <h3 className="font-sans font-black text-lg md:text-xl uppercase italic tracking-tight">My routines</h3>
                  </div>
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
                      <div key={rIdx} className="clean-card p-4 border-2 border-black/5 bg-white relative group flex flex-col gap-2">
                        {/* Header row: Number, Routine Name + Actions - Clickable to toggle */}
                        <div className="flex items-start gap-4 cursor-pointer" onClick={() => toggleRoutineExpansion(rIdx)}>
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
                                    <span className="text-[9px] font-black bg-black/5 text-black px-1.5 py-0.5 rounded uppercase shrink-0">0/100</span>
                                  </div>
                                )}
                                {/* Day */}
                                <div className="mt-0.5">
                                   <span className="text-[9px] uppercase font-bold tracking-widest text-black/40 truncate">{(rt.days || []).join(', ')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Products */}
                        {expandedRoutines.includes(rIdx) && (
                          <div className="space-y-2 pt-2 border-t border-black/5">
                              {(rt.products || []).map((p: any, i: number) => (
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

              {/* Progress Tracker increased spacing*/}
              <div className="space-y-6 mt-12">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-black">
                    <h3 className="font-sans font-black text-lg md:text-xl uppercase italic tracking-tight">Progress</h3>
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
                                console.log("X button element clicked direct");
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

              <div className="flex justify-center pt-8">
                <div className="clean-card px-8 py-8 text-center space-y-4 max-w-sm bg-venus-accent/5">
                   <Heart className="w-8 h-8 text-venus-accent mx-auto fill-venus-accent/20" />
                   <p className="text-sm leading-relaxed opacity-80">"Routine is the foundation of change. Stick to the steps and the results will follow."</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* RANK / LEADERBOARD */}
          {(appState === AppState.RANK || appState === AppState.LEADERBOARD) && (
            <motion.div 
              key={appState}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {/* Left Column: Existing Products/Search - Only show on mobile if AppState.RANK */}
              <div className={`space-y-4 md:pl-2 ${appState === AppState.LEADERBOARD ? 'hidden md:block' : 'block'}`}>
                <div className="flex flex-col gap-4 border-b-2 border-black pb-4">
                  <h2 className="text-lg md:text-xl font-sans font-black text-black uppercase italic tracking-tight">Products</h2>
                  
                  {/* Tabs */}
                  <div className="flex gap-2">
                      {[
                        { name: 'Used', color: 'bg-blue-100' },
                        { name: 'Wishlist', color: 'bg-green-100' },
                        { name: 'Avoid', color: 'bg-amber-100' }
                      ].map(t => (
                          <button key={t.name} onClick={() => setFilterCategory(t.name === filterCategory ? null : t.name)} className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${t.color} ${filterCategory === t.name ? 'ring-2 ring-black' : ''}`}>
                              {t.name}
                          </button>
                      ))}
                  </div>

                  {/* Product Filter Tabs */}
                  <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {['All', 'Cleanser', 'SPF', 'Cream', 'Serum', 'Toner', 'Retinol', 'Moisturizer'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setProductFilter(type)}
                            className={`text-[10px] font-black uppercase transition-all whitespace-nowrap ${productFilter === type ? 'text-black' : 'text-black/40 hover:text-black'}`}
                        >
                            {type}
                        </button>
                    ))}
                  </div>
                  <input 
                    type="text"
                    placeholder="Search by brand or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="hidden md:block w-full bg-transparent border-t border-black/10 pt-4 text-xs font-black uppercase text-black placeholder:text-black/40 outline-none"
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
                  <div className="grid grid-cols-1 gap-2">
                    {(searchQuery || productFilter !== 'All' ? searchResults : products)
                      .filter(p => !filterCategory || userProducts.some(up => (up?.product_name === (p.name || p.Name || p.ProductName || p['Product Name'])) && (up?.category?.includes(filterCategory) ?? false)))
                      .map((p: any) => {
                        const userProd = userProducts.find(up => (up?.product_name === (p.name || p.Name || p.ProductName || p['Product Name'])));
                        const cat = userProd?.category || '';
                        const isUsed = cat.includes('Used');
                        const isAvoid = cat.includes('Avoid');
                        
                        let bgClass = 'bg-white';
                        if (isUsed && isAvoid) bgClass = 'bg-gradient-to-r from-blue-100 to-amber-100';
                        else if (isUsed) bgClass = 'bg-blue-100';
                        else if (cat.includes('Wishlist')) bgClass = 'bg-green-100';
                        else if (isAvoid) bgClass = 'bg-amber-100';

                        return (
                          <div 
                            key={p.id} 
                            onClick={() => setSelectedProductForDetail(p)} 
                            className={`cursor-pointer clean-card p-3 border-2 ${bgClass} border-black/5 hover:border-black transition-all flex items-center justify-between gap-3`}
                            data-product-id={p.id}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {p.photo_url ? (
                                <img 
                                  src={p.photo_url} 
                                  alt={p.name || p.Name || p.ProductName || p['Product Name'] || 'Product'} 
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 object-cover rounded-lg border border-black/10 flex-shrink-0" 
                                />
                              ) : (
                                <div className="w-10 h-10 bg-black/5 rounded-lg border border-black/10 flex items-center justify-center flex-shrink-0 text-[8px] text-black/40">
                                  No Image
                                </div>
                              )}
                              <div className="truncate flex-1">
                                <div className="text-[9px] font-black uppercase tracking-widest text-venus-accent mb-0.5 truncate">
                                  {p.brand || p.Brand || 'Unknown'}
                                </div>
                                <h3 className="text-[10px] font-black text-black uppercase leading-tight truncate">
                                  {p.name || p.Name || p.ProductName || p['Product Name'] || 'Unnamed'}
                                </h3>
                                <div className="text-[8px] text-black/40 font-mono mt-0.5">ID: {p.id}</div>
                              </div>
                            </div>
                            {userProd ? (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteUPP(userProd.id); }} className="p-1 hover:bg-black/10 rounded-full shrink-0">
                                <Trash2 className="w-3 h-3 text-black/70"/>
                              </button>
                            ) : (
                              <button onClick={(e) => { e.stopPropagation(); setSelectedProductForUPP(p); }} className="p-1 hover:bg-black/5 rounded-full shrink-0">
                                <Plus className="w-3 h-3 text-black/50"/>
                              </button>
                            )}
                          </div>
                        )})}
                  </div>
                )}
              </div>

              {/* Right Column: Leaderboard - Only show on mobile if AppState.LEADERBOARD */}
              <div className={`space-y-4 ${appState === AppState.RANK ? 'hidden md:block' : 'block'}`}>
                <div className="pb-4">
                  <h2 className="text-lg md:text-xl font-sans font-black text-black uppercase italic tracking-tight">Rankings</h2>
                  <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-2">
                    {['All', 'Cleanser', 'SPF', 'Cream', 'Serum', 'Toner', 'Retinol', 'Moisturizer'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setLeaderboardFilter(type)}
                        className={`text-[10px] font-black uppercase transition-all whitespace-nowrap ${leaderboardFilter === type ? 'text-black' : 'text-black/40 hover:text-black'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                {userProducts.filter(up => up?.category === 'Used' && (leaderboardFilter === 'All' || (up?.type || '').toLowerCase() === leaderboardFilter.toLowerCase())).length === 0 ? (
                    <p className="text-black/50 text-xs font-black uppercase italic">You haven't ranked any products yet</p>
                ) : (
                    userProducts
                        .filter(up => up?.category === 'Used' && (leaderboardFilter === 'All' || (up?.type || '').toLowerCase() === leaderboardFilter.toLowerCase()))
                        .sort((a, b) => (b.personal_score || 0) - (a.personal_score || 0))
                        .map((up: any) => (
                            <div key={up.id} className="clean-card p-2 border-2 border-black/5 flex items-center justify-between">
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-venus-accent mb-0.5">
                                {up?.product_brand}
                                </div>
                                <h3 className="text-[10px] font-black text-black uppercase">{up?.product_name}</h3>
                            </div>
                            <div className="text-right">
                                <span className="text-md font-black">{up?.personal_score?.toFixed(1) || '0.0'}</span>
                            </div>
                            </div>
                        ))
                )
                }
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
                    <h2 className="text-lg md:text-xl font-sans font-black text-black uppercase italic tracking-tight">Tracker</h2>
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
                          
                          {/* Grid of Product Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                            {groupedTracker[groupKey].map((item, idx) => (
                              <TrackerProductCard
                                key={`${item.id}-${idx}`}
                                item={item}
                                onUpdate={handleUpdateTracker}
                                onDelete={handleDeleteFromTracker}
                                onClick={handleTrackerProductClick}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
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
                <h2 className="text-4xl md:text-5xl font-sans font-black text-black uppercase italic tracking-tighter">
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
                        <span className="text-[10px] font-black uppercase tracking-wider text-black/50 block mb-1">Skin Barrier Risk Score</span>
                        <div className="flex items-center gap-3">
                          <span className="text-3xl font-black text-black">
                            {userProfile.barrier_risk !== null && userProfile.barrier_risk !== undefined ? userProfile.barrier_risk : '0'}
                          </span>
                          <div className="flex flex-col">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              Number(userProfile.barrier_risk) >= 6 ? 'text-red-600' :
                              Number(userProfile.barrier_risk) >= 3 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {Number(userProfile.barrier_risk) >= 6 ? 'Compromised / High Sensitivity' :
                               Number(userProfile.barrier_risk) >= 3 ? 'Moderate Sensitivity Risk' :
                               'Strong Barrier / Healthy'}
                            </span>
                            <span className="text-[9px] text-black/40">Computed from self-reported symptoms & reactivity</span>
                          </div>
                        </div>
                      </div>
                      <Award className="w-8 h-8 text-black/10" />
                    </div>

                    {/* Progress Bar representation */}
                    <div className="w-full bg-black/5 h-2 rounded-full overflow-hidden mb-4">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          Number(userProfile.barrier_risk) >= 6 ? 'bg-red-500' :
                          Number(userProfile.barrier_risk) >= 3 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, (Number(userProfile.barrier_risk) || 0) * 10))}%` }}
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
                        {userProfile.breakout_type.map((b: string, idx: number) => (
                          <span 
                            key={b + idx} 
                            className="text-xs bg-purple-50 text-purple-900 border border-purple-200/50 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : typeof userProfile.breakout_type === 'string' && userProfile.breakout_type.trim() !== '' ? (
                      <span className="text-xs bg-purple-50 text-purple-900 border border-purple-200/50 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm inline-block">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        {userProfile.breakout_type}
                      </span>
                    ) : (
                      <p className="text-xs text-black/40 italic">No specific breakout characteristics specified.</p>
                    )}
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
                    console.log("Delete button clicked in expanded view");
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
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-10 space-y-8 max-h-[90vh] overflow-y-auto">
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
                         <div className="max-h-40 overflow-y-auto clean-card mb-4 bg-white p-2 border-2 border-black/5">
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
      {(appState === AppState.DASHBOARD || appState === AppState.RANK || appState === AppState.LEADERBOARD || appState === AppState.TRACKER || appState === AppState.SOCIAL) && (
        <div className="fixed bottom-0 left-0 right-0 flex justify-center bg-gradient-to-t from-white to-transparent z-40">
          <div className="clean-card py-3 px-6 flex justify-between md:justify-center gap-6 md:gap-8 items-center w-full md:w-auto bg-white border-t-2 md:border-2 border-black/5 shadow-2xl md:rounded-3xl">
            <Home className={`w-6 h-6 text-black cursor-pointer ${appState === AppState.DASHBOARD ? '' : 'opacity-30'}`} onClick={() => setAppState(AppState.DASHBOARD)} />
            <div className="w-px h-4 bg-black/10 hidden md:block" />
            <Award className={`w-6 h-6 hover:opacity-100 cursor-pointer text-black ${appState === AppState.LEADERBOARD ? '' : 'opacity-30'}`} onClick={() => setAppState(AppState.LEADERBOARD)} />
            <div className="w-px h-4 bg-black/10 hidden md:block" />
            <CheckSquare className={`w-6 h-6 hover:opacity-100 cursor-pointer text-black ${appState === AppState.TRACKER ? '' : 'opacity-30'}`} onClick={() => setAppState(AppState.TRACKER)} />
            <div className="w-px h-4 bg-black/10 hidden md:block" />
            <Heart className={`w-6 h-6 hover:opacity-100 cursor-pointer text-black ${appState === AppState.SOCIAL ? '' : 'opacity-30'}`} onClick={() => { setAppState(AppState.SOCIAL); setIsFollowsOpen(false); }} />
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
                console.log('UI refreshed after ranking update:', refreshedProducts.length);
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
      <ProductConfirmationModal
        isOpen={isDashboardConfirmOpen}
        products={dashboardScanMatched}
        onConfirm={handleDashboardConfirmScan}
        onCancel={() => setIsDashboardConfirmOpen(false)}
      />
      <ProductConfirmationModal
        isOpen={isNavConfirmOpen}
        products={navScanMatched}
        onConfirm={handleNavConfirmScan}
        onCancel={() => setIsNavConfirmOpen(false)}
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
              <p className="text-xs text-black/50 mt-1 font-mono">
                {isLandingEvaluating ? "Running compatibility checks" : "AI is identifying your products"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Landing Evaluation Results Pop-up Modal */}
      {isLandingEvaluationOpen && landingEvaluationResults.length > 0 && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white p-4 sm:p-6 md:p-8 rounded-3xl w-full max-w-xl shadow-2xl max-h-[92vh] md:max-h-[85vh] overflow-y-auto flex flex-col gap-6 border-2 border-black/5"
          >
            <div className="flex justify-between items-center pb-4 border-b border-black/5">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-black flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-venus-accent fill-venus-accent/20 animate-pulse" />
                  Skin Match Results
                </h3>
                <p className="text-xs text-black/50 mt-1">
                  How your products match your skin profile
                </p>
              </div>
              <button 
                onClick={() => setIsLandingEvaluationOpen(false)}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-black/60" />
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {landingEvaluationResults.map((item: any, idx: number) => {
                const prod = item.product;
                const evalResult = item.evaluation;
                const isAvoid = evalResult.category === 'Avoid';
                const isCaution = evalResult.category === 'Caution';
                const isRecommended = evalResult.category === 'Recommended';
                const isSafe = evalResult.category === 'Safe';

                let badgeBg = 'bg-gray-100 text-gray-800 border-gray-200';
                if (isAvoid) badgeBg = 'bg-red-50 text-red-700 border-red-200';
                if (isCaution) badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
                if (isRecommended) badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (isSafe) badgeBg = 'bg-blue-50 text-blue-700 border-blue-200';

                return (
                  <div key={idx} className="p-4 rounded-2xl bg-black/[0.02] border border-black/5 flex flex-col gap-3">
                    <div className="flex gap-4 items-start">
                      {prod.photo_url ? (
                        <img 
                          src={prod.photo_url} 
                          alt={prod.name} 
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 object-cover rounded-xl border border-black/10 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-black/5 rounded-xl border border-black/10 flex items-center justify-center flex-shrink-0 text-[10px] text-black/40 text-center leading-tight">
                          No Image
                        </div>
                      )}
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] uppercase font-black tracking-widest text-venus-accent block">
                              {prod.brand}
                            </span>
                            <h4 className="text-sm font-bold text-black break-words leading-snug">
                              {prod.name}
                            </h4>
                            <span className="text-[10px] text-black/40 font-mono">
                              {prod.type}
                            </span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider shrink-0 ${badgeBg}`}>
                            {evalResult.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs space-y-1 bg-white p-3 rounded-xl border border-black/[0.03]">
                      <span className="font-extrabold text-black/60 block uppercase text-[9px] tracking-wider mb-1">
                        Analysis Details:
                      </span>
                      {evalResult.reasons && evalResult.reasons.map((reason: string, rIdx: number) => (
                        <p key={rIdx} className="text-black/70 leading-relaxed pl-2 border-l border-black/10 font-medium">
                          {reason}
                        </p>
                      ))}
                      {evalResult.potentialBreakoutRisk && (
                        <div className="mt-2 p-2 bg-rose-50 text-rose-800 rounded-lg text-[11px] leading-relaxed">
                          <span className="font-bold">Breakout Risk: </span>
                          Contains potentially acne-triggering ingredients in low concentrations.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setIsLandingEvaluationOpen(false)}
              className="w-full py-3.5 bg-black text-white hover:bg-black/90 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-[0.98]"
            >
              Done, Go to Dashboard
            </button>
          </motion.div>
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
