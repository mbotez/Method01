/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ChevronRight, 
  ArrowRight, 
  CheckCircle2, 
  Sun, 
  Moon, 
  Plus, 
  History, 
  Heart,
  User as UserIcon,
  LogOut,
  ShoppingBag,
  Award,
  Pencil,
  AlarmClock,
  Newspaper,
  FlaskConical,
  Trash2
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { Login } from './components/Login';
import { ComparisonModal } from './components/ComparisonModal';
import { INVENTORY, Product } from './constants';

// --- Components ---

const GlowingBackground = () => (
  <div className="fixed inset-0 -z-10 overflow-hidden bg-white">
    <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] rounded-full bg-black/[0.03] blur-[100px]" />
    <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] rounded-full bg-venus-accent/[0.05] blur-[80px]" />
  </div>
);

const SkincareIllustration = () => (
  <div className="relative w-full h-48 flex items-center justify-center mb-12">
    <div className="relative">
      <div className="w-32 h-32 rounded-2xl bg-black shadow-2xl flex items-center justify-center transform rotate-3">
        <Sparkles className="w-12 h-12 text-white animate-pulse" />
      </div>
      <motion.div 
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-venus-accent flex items-center justify-center shadow-xl border-4 border-white"
      >
        <div className="text-white font-black text-xs">M-01</div>
      </motion.div>
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
  RANK
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.LANDING);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [skinType, setSkinType] = useState('normal');
  const [concern, setConcern] = useState('Other');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [newProductForComparison, setNewProductForComparison] = useState<any | null>(null);

  const [isAddingRoutine, setIsAddingRoutine] = useState(false);
  const [modalMode, setModalMode] = useState<'new'|'edit'|'reminder'>('new');
  
  const [routineTime, setRoutineTime] = useState<'AM'|'PM'>('AM');
  const [routineDays, setRoutineDays] = useState<string[]>([]);
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [routineSelectedProducts, setRoutineSelectedProducts] = useState<any[]>([]);
  const [routineName, setRoutineName] = useState('');
  const [routineNotes, setRoutineNotes] = useState('');
  
  const [editingRoutine, setEditingRoutine] = useState<any>(null);
  const [reminderRoutine, setReminderRoutine] = useState<any>(null);
  const [reminderTime, setReminderTime] = useState('');

  // Handlers
  const handleEditRoutine = (rt: any) => {
    setEditingRoutine(rt);
    setRoutineName(rt.routine_name || '');
    setRoutineNotes(rt.notes || '');
    setRoutineTime(rt.time);
    setRoutineDays(rt.days || []);
    setRoutineSelectedProducts(rt.products || []);
    setModalMode('edit');
    setIsAddingRoutine(true);
  };

  const handleSetReminder = (rt: any) => {
    setReminderRoutine(rt);
    setReminderTime(rt.reminder || '');
    setModalMode('reminder');
    setIsAddingRoutine(true);
  };

  const progressInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = dataUrl;
    });
  };

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
           console.error("Session fetching error:", error);
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
        } catch (e) {
          console.error("Auth profile error:", e);
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) {
            setProfile(null);
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
      const allowedStates = [AppState.LANDING, AppState.AUTH, AppState.ONBOARDING_DETAILS, AppState.RANK];
      if (!allowedStates.includes(appState)) {
        setAppState(AppState.LANDING);
      }
    }
  }, [user, profile, appState, loading]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data: productsData, error } = await supabase
        .from('products')
        .select('*');
      if (error) { console.error('FAILED CALL:', { table: 'products', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
      if (productsData) setProducts(productsData);
    };

    fetchProducts();

    const productsChannel = supabase.channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        const { data, error } = await supabase.from('products').select('*');
        if (error) { console.error('FAILED CALL:', { table: 'products', action: 'SELECT', errorCode: error.code, message: error.message, details: error.details, hint: error.hint }); }
        if (data) setProducts(data);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
    };
  }, []);

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
      if (routinesError) { console.error('FAILED CALL:', { table: 'routines', action: 'SELECT', errorCode: routinesError.code, message: routinesError.message, details: routinesError.details, hint: routinesError.hint }); }
      if (routinesData) setRoutines(routinesData);

      // Progress
      const { data: progressData, error: progressError } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });
      if (progressError) { console.error('FAILED CALL:', { table: 'progress', action: 'SELECT', errorCode: progressError.code, message: progressError.message, details: progressError.details, hint: progressError.hint }); }
      if (progressData) setProgressPhotos(progressData);

      // Upp
      const { data: uppData, error: uppError } = await supabase
        .from('upp')
        .select('*')
        .eq('user_id', user.id);
      if (uppError) { console.error('FAILED CALL:', { table: 'upp', action: 'SELECT', errorCode: uppError.code, message: uppError.message, details: uppError.details, hint: uppError.hint }); }
      if (uppData) setUserProducts(uppData);
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

    return () => {
      supabase.removeChannel(routineChannel);
      supabase.removeChannel(progressChannel);
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
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Sign out error", e);
    } finally {
      setUser(null);
      setAppState(AppState.LANDING);
    }
  };

  const handleProgressUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      console.log("Progress upload started for file:", file.name);
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        if (result && result.length > 50) {
          try {
            const resized = await resizeImage(result);

            const payload = {
              user_id: user.id,
              image_url: resized,
              timestamp: new Date().toISOString()
            };
            console.log('Attempting to write to progress with payload:', payload);

            const { error: insertError } = await supabase
              .from('progress')
              .insert(payload);

            if (insertError) { 
               console.error('FAILED CALL:', { table: 'progress', action: 'INSERT', errorCode: insertError.code, message: insertError.message, details: insertError.details, hint: insertError.hint }); 
               throw insertError;
            }
            
          } catch (err: any) {
            console.error("Progress upload process failed:", err);
            setError("Failed to process entry: " + (err.message || 'Unknown error'));
          }
        } else {
          console.error("Failed to read image data");
          setError("Could not read the selected image.");
        }
      };
      reader.onerror = () => {
        console.error("FileReader error");
        setError("Error reading file.");
      };
      reader.readAsDataURL(file);
      
      if (progressInputRef.current) {
        progressInputRef.current.value = '';
      }
    }
  };

  const defaultRitualSteps = [
    { type: 'Cleanser', benefits: 'Purifies and prepares skin' },
    { type: 'Serum', benefits: 'Targeted active formulation' },
    { type: 'Moisturizer', benefits: 'Barrier protection and hydration' },
    { type: 'Sunscreen', benefits: 'UV and environmental defense' }
  ];

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
          id: p.id
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
    if (!user) return;
    
    try {
      if (modalMode === 'reminder') {
          const { error } = await supabase.from('routines').update({ reminder: reminderTime }).eq('id', reminderRoutine.id);
          if (error) throw error;
      } else {
          const payload = {
            user_id: user.id,
            time: routineTime,
            days: routineDays,
            routine_name: routineName,
            notes: routineNotes,
            products: routineSelectedProducts.map(p => ({
              id: p.id,
              brand: p.brand || p.Brand,
              name: p.name || p.ProductName || p.Name,
              type: p.type || p.Type || 'Custom'
            }))
          };
          if (modalMode === 'edit') {
            const { error } = await supabase.from('routines').update(payload).eq('id', editingRoutine.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('routines').insert(payload);
            if (error) throw error;
          }
      }

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
    } catch (e) {
      console.error("error saving routine", e);
      setError("Error saving routine.");
    }
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
        category: 'Used',
        impression: uppCategories.includes('Used') ? uppImpression : null,
        personal_score: initialScore,
        notes: uppNotes,
        length: uppLength,
        frequency: uppFrequency
      }).select().single();
      
      if (insertError) throw insertError;

      // 2. Check if user already has other 'Used' products
      const { data: existingProducts, error: checkError } = await supabase
        .from('upp')
        .select('id')
        .eq('user_id', user.id)
        .eq('category', 'Used')
        .neq('id', newProductEntry.id);
      
      if (checkError) throw checkError;

      if (existingProducts && existingProducts.length > 0) {
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
      setError(`Error saving product to UPP: ${e instanceof Error ? e.message : String(e)}`);
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
    <div className="flex flex-col items-center justify-center h-screen bg-venus-pink space-y-4">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-venus-accent border-t-transparent rounded-full" />
      <button onClick={() => setLoading(false)} className="text-xs font-black uppercase tracking-widest hover:opacity-50">Skip Loading</button>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-venus-warm relative overflow-x-hidden">
      <GlowingBackground />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center bg-white/90 backdrop-blur-md border-b border-black/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <span className="font-sans font-black text-2xl tracking-tighter text-black uppercase italic cursor-pointer" onClick={() => setAppState(AppState.LANDING)}>M-01</span>
        </div>
        
        <div className="flex items-center gap-4">
          {!user ? (
            <>
              <button 
                onClick={() => { setIsSignUp(false); setAppState(AppState.AUTH); }}
                className="text-xs font-black uppercase tracking-widest text-black/60 hover:text-black transition-colors ml-4"
              >
                Sign In
              </button>
              <button 
                onClick={() => { setIsSignUp(true); setAppState(AppState.AUTH); }}
                className="bg-black text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-venus-accent transition-colors"
              >
                Sign Up
              </button>
            </>
          ) : (
             <div className="flex items-center gap-4 ml-4">
              <button 
                onClick={() => setAppState(AppState.DASHBOARD)} 
                className={`transition-colors ${appState === AppState.DASHBOARD ? 'text-black' : 'text-black/60 hover:text-black'}`}
                title="Dashboard"
              >
                <UserIcon className="w-5 h-5" />
              </button>
              <button 
                onClick={handleSignOut}
                className="text-black/60 hover:text-black transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )
          }
        </div>
      </header>
      
      {appState !== AppState.LANDING && (
        <footer className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex justify-between px-6 items-center bg-white border-t border-black/5 py-4">
          <button onClick={() => setAppState(AppState.LANDING)} className="flex flex-col items-center gap-1 text-black/60">
            <Newspaper className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase">Feed</span>
          </button>
          <button onClick={() => setAppState(AppState.DASHBOARD)} className="flex flex-col items-center gap-1 text-black/60">
            <FlaskConical className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase">Routines</span>
          </button>
          <button onClick={() => setAppState(AppState.RANK)} className="flex flex-col items-center gap-1 text-black/60">
            <ShoppingBag className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase">Your items</span>
          </button>
        </footer>
      )}

      <main className="pt-32 pb-24 px-6 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          
          {appState === AppState.AUTH && (
            <Login 
              isSignUpInitial={isSignUp}
              onSuccess={() => setAppState(AppState.DASHBOARD)}
              onError={(err) => setError(err)}
            />
          )}

          {/* LANDING */}
          {appState === AppState.LANDING && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="text-center"
            >
              <SkincareIllustration />
              <h1 className="text-6xl md:text-9xl font-sans font-black mb-6 leading-[0.8] text-black uppercase italic tracking-tighter">
                Method <span className="text-venus-accent">01.</span>
              </h1>
              <p className="text-black text-xl font-medium mb-12 max-w-xl mx-auto opacity-70">
                Beyond the hype
              </p>
              <button 
                onClick={() => setAppState(AppState.ONBOARDING_DETAILS)}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                Start
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {/* ONBOARDING: DETAILS */}
          {appState === AppState.ONBOARDING_DETAILS && (
            <motion.div 
              key="onboarding-details"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-12"
            >
              <div>
                <h2 className="text-4xl font-sans font-black mb-8 text-center text-black uppercase italic tracking-tighter">Parameters</h2>
                
                <div className="space-y-8">
                  {/* Skin Type */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-black/40">Density & Texture</label>
                    <div className="grid grid-cols-3 gap-4">
                      {['dry', 'normal', 'oily'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setSkinType(t)}
                          className={`py-6 rounded-2xl clean-card transition-all ${skinType === t ? 'border-venus-accent ring-1 ring-venus-accent' : 'hover:scale-[1.02]'}`}
                        >
                          <span className="capitalize">{t}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Concern */}
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-black/40">Primary Target</label>
                    <div className="grid grid-cols-2 gap-4">
                      {['Acne', 'Lines', 'Redness', 'Other'].map(c => (
                        <button 
                          key={c}
                          onClick={() => setConcern(c)}
                          className={`py-8 rounded-2xl clean-card transition-all font-bold ${concern === c ? 'bg-black text-white' : 'hover:bg-venus-accent/5'}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-center p-4 bg-orange-100 text-orange-800 rounded-2xl text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="flex justify-center pt-8">
                <button 
                  onClick={generateCuratedSelection}
                  className="btn-primary"
                >
                  Get Curated Selection
                </button>
              </div>
            </motion.div>
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
              className="space-y-12"
            >
              <div className="flex items-center justify-between border-b-2 border-black pb-8">
                <div>
                  <h2 className="text-4xl font-sans font-black text-black uppercase italic tracking-tighter">Dashboard</h2>
                  <p className="text-venus-accent font-black text-xs uppercase tracking-widest mt-1">{user?.email}</p>
                </div>
                <div className="w-16 h-16 rounded-lg bg-black flex items-center justify-center shadow-lg">
                  <UserIcon className="text-white w-8 h-8" />
                </div>
              </div>

              {/* Routine Card */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-black">
                    <Sparkles className="w-5 h-5 fill-current" />
                    <h3 className="font-sans font-black text-2xl uppercase italic tracking-tight">My routine</h3>
                  </div>
                  <button 
                    onClick={() => setIsAddingRoutine(true)}
                    className="text-xs uppercase tracking-widest text-black font-black hover:opacity-70 transition-opacity flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Routine
                  </button>
                </div>
                
                <div className="space-y-8">
                  {routines.length === 0 ? (
                    <div className="py-12 clean-card flex flex-col items-center justify-center border-dashed border-2 border-black/5 bg-white/50">
                      <p className="text-black/50 text-sm font-black uppercase tracking-widest">No routine added yet</p>
                    </div>
                  ) : (
                    routines.map((rt: any, rIdx: number) => (
                      <div key={rIdx} className="clean-card p-6 border-2 border-black/5 bg-white relative group flex flex-col gap-4">
                        {/* Header row: Number, Routine Name + Time/Day + Actions */}
                        <div className="flex items-start gap-4">
                            {/* Number (smaller) */}
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-black text-white flex items-center justify-center font-black text-xs mt-1">
                                0{rIdx + 1}
                            </div>
                            
                            {/* Routine Name */}
                            <div className="flex-1">
                                {rt.routine_name && <h4 className="font-black text-black uppercase text-base tracking-tight pt-1">{rt.routine_name}</h4>}
                            </div>

                            {/* Time and Day */}
                            <div className="flex flex-col items-end gap-1">
                                <span className="text-xs font-black bg-black text-white px-2 py-1 rounded">{rt.time || 'AM'}</span>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-black/40">{(rt.days || []).join(', ')}</span>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex flex-col gap-1 -mt-1">
                                <button onClick={() => handleEditRoutine(rt)} className='p-2 hover:bg-black/5 rounded-full transition-colors'>
                                    <Pencil className="w-4 h-4 text-black/40 hover:text-black" />
                                </button>
                                <button onClick={() => handleSetReminder(rt)} className='p-2 hover:bg-black/5 rounded-full transition-colors'>
                                    <AlarmClock className="w-4 h-4 text-black/40 hover:text-black" />
                                </button>
                            </div>
                        </div>

                        {/* Products (moved below) */}
                        <div className="space-y-3 pt-2 border-t border-black/5">
                            {(rt.products || []).map((p: any, i: number) => (
                                <div key={i} className="flex flex-col gap-0.5 text-xs">
                                    <span className="uppercase font-black tracking-widest text-venus-accent">{p.type}</span>
                                    <div className="flex flex-col pl-4">
                                        <span className="font-bold text-black/80">{p.brand}</span>
                                        <span className="text-black/60">{p.name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-black">
                    <History className="w-5 h-5 fill-current" />
                    <h3 className="font-sans font-black text-2xl uppercase italic tracking-tight">Progress</h3>
                  </div>
                  <button 
                    onClick={() => progressInputRef.current?.click()}
                    className="text-xs uppercase tracking-widest text-black font-black hover:opacity-70 transition-opacity flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    New Entry
                  </button>
                  <input 
                    type="file" 
                    style={{ display: 'none' }}
                    accept="image/*" 
                    ref={progressInputRef} 
                    onChange={handleProgressUpload} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {progressPhotos.length === 0 ? (
                    <div 
                       onClick={() => progressInputRef.current?.click()}
                       className="col-span-2 py-20 clean-card flex flex-col items-center justify-center border-dashed border-2 border-black/5 cursor-pointer bg-white/50 hover:bg-black/5 transition-colors"
                    >
                      <Plus className="w-12 h-12 text-black/10 mb-2" />
                      <p className="text-black/30 text-sm font-black uppercase tracking-widest">Initialize progress log</p>
                    </div>
                  ) : (
                    progressPhotos.map((photo: any) => (
                      <div key={photo.id} className="aspect-square clean-card relative group overflow-hidden border-2 border-black/5">
                        <img src={photo.image_url} alt="Progress" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                        <div className="absolute inset-x-0 bottom-0 bg-white/95 p-3 text-center opacity-0 group-hover:opacity-100 transition-all border-t border-black/10">
                          <p className="text-[10px] uppercase font-black tracking-widest text-black">{new Date(photo.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
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

          {/* RANK */}
          {appState === AppState.RANK && (
            <motion.div 
              key="rank"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 pt-4"
            >
              <div className="flex flex-col gap-4 border-b-2 border-black pb-4">
                <h2 className="text-2xl font-sans font-black text-black uppercase italic tracking-tighter">Your products</h2>
                
                {/* Tabs */}
                <div className="flex gap-2">
                    {[
                      { name: 'Used', color: 'bg-blue-100' },
                      { name: 'Bucketlist', color: 'bg-green-100' },
                      { name: 'Avoid', color: 'bg-orange-100' }
                    ].map(t => (
                        <button key={t.name} onClick={() => setFilterCategory(t.name === filterCategory ? null : t.name)} className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${t.color} ${filterCategory === t.name ? 'ring-2 ring-black' : ''}`}>
                            {t.name}
                        </button>
                    ))}
                </div>

                {/* Product Filter Tabs */}
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {['All', 'Cleanser', 'SPF', 'Cream', 'Serum', 'Toner', 'Retinol', 'Moisturizer'].map((type) => (
                      <button
                          key={type}
                          onClick={() => setProductFilter(type)}
                          className={`text-[10px] font-black uppercase transition-all ${productFilter === type ? 'text-black' : 'text-black/40 hover:text-black'}`}
                      >
                          {type}
                      </button>
                  ))}
                </div>
                <input 
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-t border-black/10 pt-2 text-[10px] font-black uppercase text-black/40 placeholder:text-black/40 outline-none"
                />
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
                          console.log('Attempting to write to products with payload:', payload);
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
                  {products
                    .filter(p => !searchQuery || (p.brand || p.Brand || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.name || p.Name || p.ProductName || '').toLowerCase().includes(searchQuery.toLowerCase()))
                    .filter(p => productFilter === 'All' || (p.type || p.Type || '').toLowerCase() === productFilter.toLowerCase())
                    .filter(p => !filterCategory || userProducts.some(up => (up.product_name === (p.name || p.Name || p.ProductName || p['Product Name'])) && up.category.includes(filterCategory)))
                    .map((p: any) => {
                      const userProd = userProducts.find(up => (up.product_name === (p.name || p.Name || p.ProductName || p['Product Name'])));
                      const cat = userProd?.category || '';
                      const isUsed = cat.includes('Used');
                      const isAvoid = cat.includes('Avoid');
                      
                      let bgClass = 'bg-white';
                      if (isUsed && isAvoid) bgClass = 'bg-gradient-to-r from-blue-100 to-orange-100';
                      else if (isUsed) bgClass = 'bg-blue-100';
                      else if (cat.includes('Bucketlist')) bgClass = 'bg-green-100';
                      else if (isAvoid) bgClass = 'bg-orange-100';

                      return (
                      <div key={p.id} className={`clean-card p-3 border-2 ${bgClass} border-black/5 hover:border-black transition-all flex items-center justify-between`}>
                          <div className="truncate">
                            <div className="text-[9px] font-black uppercase tracking-widest text-venus-accent mb-0.5 truncate">
                              {p.brand || p.Brand || 'Unknown'}
                            </div>
                            <h3 className="text-[10px] font-black text-black uppercase leading-tight truncate">{p.name || p.Name || p.ProductName || p['Product Name'] || 'Unnamed'}</h3>
                          </div>
                          {userProd ? (
                            <button onClick={() => handleDeleteUPP(userProd.id)} className="p-1 hover:bg-black/10 rounded-full shrink-0">
                              <Trash2 className="w-3 h-3 text-black/70"/>
                            </button>
                          ) : (
                            <button onClick={() => setSelectedProductForUPP(p)} className="p-1 hover:bg-black/5 rounded-full shrink-0">
                              <Plus className="w-3 h-3 text-black/50"/>
                            </button>
                          )}
                      </div>
                    )})}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

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
                   <h2 className="text-2xl font-black uppercase tracking-tight">
                     {modalMode === 'edit' ? 'Edit Routine' : modalMode === 'reminder' ? 'Set yourself a reminder' : 'New Routine'}
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
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Routine Name</h3>
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
                            <span className="font-bold text-sm uppercase tracking-widest group-hover:text-venus-accent transition-colors">AM</span>
                          </label>
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative flex items-center justify-center">
                              <input type="radio" name="time" value="PM" checked={routineTime === 'PM'} onChange={() => setRoutineTime('PM')} className="peer sr-only" />
                              <div className="w-5 h-5 rounded-full border-2 border-black/20 peer-checked:border-black transition-colors"></div>
                              <div className="absolute w-2.5 h-2.5 rounded-full bg-black scale-0 peer-checked:scale-100 transition-transform"></div>
                            </div>
                            <span className="font-bold text-sm uppercase tracking-widest group-hover:text-venus-accent transition-colors">PM</span>
                          </label>
                       </div>
                    </div>

                    {/* Days */}
                    <div className="mb-6">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Days of the week</h3>
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
                              <span className="text-sm font-medium group-hover:text-venus-accent transition-colors">{day}</span>
                            </label>
                          ))}
                       </div>
                    </div>

                    {/* Product Search */}
                    <div className="mb-6">
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Add Products</h3>
                       <input 
                         type="text" 
                         placeholder="Search catalog..." 
                         className="w-full clean-card p-4 text-sm focus:border-black outline-none mb-4 bg-white"
                         value={routineSearchQuery}
                         onChange={e => setRoutineSearchQuery(e.target.value)}
                       />
                       {routineSearchQuery && (
                         <div className="max-h-40 overflow-y-auto clean-card mb-4 bg-white p-2">
                           {products
                             .filter(p => (p.name || p.ProductName || p.Name || '').toLowerCase().includes(routineSearchQuery.toLowerCase()) || (p.brand || p.Brand || '').toLowerCase().includes(routineSearchQuery.toLowerCase()))
                             .slice(0, 10)
                             .map(p => (
                               <div key={p.id} className="p-3 hover:bg-black/5 rounded-lg flex justify-between items-center cursor-pointer transition-colors" onClick={() => {
                                 if (!routineSelectedProducts.find(sp => sp.id === p.id)) {
                                   setRoutineSelectedProducts([...routineSelectedProducts, p]);
                                 }
                                 setRoutineSearchQuery('');
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
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Notes</h3>
                       <textarea 
                         placeholder="Add any instructions or notes for this routine..." 
                         className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-black transition-all resize-none h-24"
                         value={routineNotes}
                         onChange={e => setRoutineNotes(e.target.value)}
                       />
                    </div>
                  </>
                )}

                {error && (
                  <div className="mb-6 text-center p-4 bg-orange-100 text-orange-800 rounded-2xl text-sm font-medium">
                    {error}
                  </div>
                )}

                <button className="btn-primary w-full shadow-xl" onClick={handleSaveRoutine}>
                    {modalMode === 'reminder' ? 'Save Reminder' : 'Save Routine'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProductForDetail && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProductForDetail(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-10 space-y-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-venus-accent bg-venus-accent/5 px-2 py-1 rounded">
                      {selectedProductForDetail.brand || selectedProductForDetail.Brand}
                    </span>
                    <h2 className="text-3xl font-black text-black uppercase tracking-tight mt-2">{selectedProductForDetail.name || selectedProductForDetail.Name || selectedProductForDetail.ProductName || selectedProductForDetail['Product Name']}</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedProductForDetail(null)}
                    className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center hover:bg-black hover:text-white transition-all text-black/40"
                  >
                    <Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-3">Formula Breakdown</h4>
                    <div className="p-6 bg-black/5 rounded-2xl">
                      <p className="text-sm font-medium leading-relaxed text-black/80 whitespace-pre-wrap">
                        {selectedProductForDetail.ingredients || selectedProductForDetail.Ingredients}
                      </p>
                    </div>
                  </div>

                  <div className="bg-venus-accent/5 p-6 rounded-2xl border border-venus-accent/10">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-venus-accent" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-venus-accent">Protocol Status</span>
                    </div>
                    <p className="text-xs font-medium text-black/60">This formulation has been verified against skin architecture parameters.</p>
                  </div>
                </div>
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
              {(['Used', 'Bucketlist', 'Avoid'] as const).map(c => (
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
      {appState === AppState.DASHBOARD && (
        <div className="fixed bottom-0 left-0 right-0 p-6 flex justify-center bg-gradient-to-t from-white to-transparent">
          <div className="clean-card py-3 px-8 flex gap-8 items-center bg-white border-2 border-black/5 shadow-2xl">
            <Sun className="w-6 h-6 text-black cursor-pointer" />
            <div className="w-px h-4 bg-black/10" />
            <ShoppingBag className="w-6 h-6 opacity-30 hover:opacity-100 cursor-pointer text-black" />
            <div className="w-px h-4 bg-black/10" />
            <History className="w-6 h-6 opacity-30 hover:opacity-100 cursor-pointer text-black" />
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
                  p_exclude_id: newProductForComparison.id 
                });
              if (nudgeError) console.error('Nudge error:', nudgeError);
            }
          }
          setNewProductForComparison(null);
        }}
      />
    </div>
  );
}
