import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User as UserIcon, 
  FlaskConical, 
  Sun, 
  Award, 
  Heart, 
  Shield, 
  Trash2, 
  LogOut, 
  Pencil, 
  Check, 
  CheckCircle2, 
  Loader2, 
  X 
} from 'lucide-react';
import { AppState, AvoidedIngredient } from '../types';
import { 
  SKIN_CONCERN_OPTIONS, 
  ACTIVE_SKINCARE_OPTIONS, 
  ACTIVES_TEXT_MAP 
} from '../config/appConstants';
import { BREAKOUT_PHOTO_OPTIONS, getBreakoutTitle } from '../data/breakoutOptions';
import { 
  getSkinConcernLabel, 
  getActivesSelectedIds, 
  extractAvoidedIngredientIds, 
  parseAvoidedIngredients 
} from '../utils/profileHelpers';
import { supabase } from '../lib/supabase';

export interface ProfileViewProps {
  user: any;
  profile: any;
  userProfile: any;
  setUserProfile: React.Dispatch<React.SetStateAction<any>>;
  setProfile: React.Dispatch<React.SetStateAction<any>>;
  setAppState: (state: AppState) => void;
  navigateTo: (state: AppState, path?: string) => void;
  handleSignOut: () => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  profile,
  userProfile,
  setUserProfile,
  setProfile,
  setAppState,
  navigateTo,
  handleSignOut
}) => {
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

  const [isEditingBurnRisk, setIsEditingBurnRisk] = useState(false);
  const [editBurnRiskVal, setEditBurnRiskVal] = useState('medium');
  const [isSavingBurnRisk, setIsSavingBurnRisk] = useState(false);
  const [burnRiskSaveError, setBurnRiskSaveError] = useState<string | null>(null);

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
        .update({ username })
        .eq('id', user.id)
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

  const handleSaveBurnRisk = async () => {
    if (!user?.id) return;
    setIsSavingBurnRisk(true);
    setBurnRiskSaveError(null);
    try {
      const sunMap: Record<string, string> = {
        'I burn like a lobster': 'high',
        'Burn then tan': 'medium',
        'Got no problems tanning': 'low',
        'high': 'high',
        'medium': 'medium',
        'low': 'low'
      };
      const resolvedRisk = sunMap[editBurnRiskVal] || editBurnRiskVal;
      const { error } = await supabase
        .from('user_profile')
        .upsert({ id: user.id, burn_risk: resolvedRisk });
      if (error) throw error;
      setUserProfile((prev: any) => prev ? { ...prev, burn_risk: resolvedRisk } : { burn_risk: resolvedRisk });
      setIsEditingBurnRisk(false);
    } catch (err: any) {
      setBurnRiskSaveError(err?.message || 'Failed to update UV burn risk');
    } finally {
      setIsSavingBurnRisk(false);
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

      // If user used to have breakouts (1) as a goal (or had breakout characteristics) and now changed to something else:
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

  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8 max-w-2xl mx-auto pb-12 w-full"
    >
      <header className="text-center space-y-3">
        <div className="inline-flex p-3 bg-black/5 rounded-full mb-1">
          <UserIcon className="w-8 h-8 text-black" />
        </div>
        <h2 className="text-[1.8rem] md:text-[2.4rem] font-sans font-bold uppercase tracking-[0.14em] text-[#171717] leading-tight">
          Profile
        </h2>
        <div className="flex flex-col items-center justify-center gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[13.2px] font-black uppercase tracking-wider text-black/50">Username:</span>
            {isEditingUsername ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editUsernameVal}
                  onChange={(e) => setEditUsernameVal(e.target.value)}
                  placeholder="Enter new username"
                  className="bg-black/5 border border-black/10 rounded-xl px-3 py-1.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                />
                <button
                  onClick={handleSaveUsername}
                  disabled={isSavingUsername}
                  className="bg-black text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  {isSavingUsername && <Loader2 className="w-3 h-3 animate-spin" />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditingUsername(false);
                    setUsernameSaveError(null);
                  }}
                  disabled={isSavingUsername}
                  className="bg-black/5 hover:bg-black/10 text-black px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-black">
                  {profile?.username && profile.username.trim() !== '' ? profile.username : (user?.user_metadata?.username && user.user_metadata.username.trim() !== '' ? user.user_metadata.username : 'xxx')}
                </span>
                <button
                  onClick={() => {
                    setEditUsernameVal(profile?.username || user?.user_metadata?.username || '');
                    setUsernameSaveError(null);
                    setIsEditingUsername(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                  title="Edit username"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
            )}
          </div>
          {usernameSaveError && (
            <p className="text-xs text-red-600 font-semibold">{usernameSaveError}</p>
          )}
        </div>
      </header>

      {(() => {
        const hasCompletedQuiz = Boolean(userProfile?.skin_type && userProfile.skin_type.trim() !== '');
        return !hasCompletedQuiz;
      })() ? (
        <div className="clean-card bg-white border border-black/10 rounded-3xl p-8 shadow-sm text-center space-y-6">
          <div className="max-w-sm mx-auto space-y-2">
            <p className="text-xs md:text-sm font-bold text-black">
              No info yet.{' '}
              <button
                onClick={() => setAppState(AppState.ONBOARDING_DETAILS)}
                className="text-venus-accent underline cursor-pointer hover:opacity-80 transition-opacity font-black"
              >
                Complete the skin quiz here
              </button>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Skin Type Card */}
          <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-venus-accent/[0.03] rounded-full -mr-6 -mt-6" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-venus-accent" />
                <span className="text-[11px] font-black uppercase tracking-wider text-black/50 block">Skin Type</span>
              </div>
              {!isEditingSkinType && (
                <button
                  onClick={() => {
                    setEditSkinTypeVal(userProfile?.skin_type || 'normal');
                    setSkinTypeSaveError(null);
                    setIsEditingSkinType(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                  title="Edit skin type"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditingSkinType ? (
              <div className="space-y-3 pt-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-black/60 block">
                  How does your skin feel right after washing?
                </label>
                <select
                  value={editSkinTypeVal}
                  onChange={(e) => setEditSkinTypeVal(e.target.value)}
                  className="w-full bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="dry">Dry and tight</option>
                  <option value="oily">Oily all over</option>
                  <option value="combination">Oily forehead and nose, but dry cheeks (Combination)</option>
                  <option value="normal">Comfortable / Balanced (Normal)</option>
                </select>

                {skinTypeSaveError && (
                  <p className="text-xs text-red-600 font-semibold">{skinTypeSaveError}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveSkinType}
                    disabled={isSavingSkinType}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSavingSkinType && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Skin Type
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingSkinType(false);
                      setSkinTypeSaveError(null);
                    }}
                    disabled={isSavingSkinType}
                    className="bg-black/5 hover:bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-2xl font-black text-black uppercase tracking-tight capitalize">
                  {userProfile.skin_type || 'Unknown'}
                </h3>
                <p className="text-[11px] text-black/60 font-medium mt-3">
                  {userProfile.skin_type === 'dry' && 'Your skin produces less sebum than normal, which can lead to tightness, flaking, or a dull complexion.'}
                  {userProfile.skin_type === 'oily' && 'Your skin likely has overactive glands, producing excess sebum, which can result in shine and breakouts.'}
                  {userProfile.skin_type === 'combination' && 'Your skin has an oily T-zone (forehead, nose, chin) but is normal or dry on the cheeks.'}
                  {userProfile.skin_type === 'normal' && 'Your skin is well-balanced, with just the right amount of moisture and sebum, and is less prone to sensitivities.'}
                  {!['dry', 'oily', 'combination', 'normal'].includes(userProfile.skin_type?.toLowerCase()) && 'Your primary skin barrier classification.'}
                </p>
              </div>
            )}
          </div>

          {/* Barrier Risk Card */}
          <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-black/50 block mb-1">Skin Barrier Status Score</span>
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
                    <span className="text-[9px] text-black/40">Based on self-reported skin characteristics</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Award className="w-8 h-8 text-black/10" />
                {!isEditingBarrier && (
                  <button
                    onClick={() => {
                      setEditSensitivity(Array.isArray(userProfile?.sensitivity) ? userProfile.sensitivity : []);
                      setEditReaction(userProfile?.new_product_reaction === 3 ? 'Almost everything irritates my skin' : userProfile?.new_product_reaction === 2 ? 'Often get redness, bumps, or burning' : userProfile?.new_product_reaction === 1 ? 'Sometimes sensitive' : 'Very good, no problems');
                      setBarrierSaveError(null);
                      setIsEditingBarrier(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                    title="Edit skin barrier status"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>

            {isEditingBarrier ? (
              <div className="space-y-4 pt-2 border-t border-black/5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black/60 block">
                    Skin Sensitivity Issues (Select all that apply)
                  </label>
                  {[
                    'Burning or stinging from products',
                    'Redness',
                    'Itching',
                    'Flaking or peeling',
                    'Tightness even after moisturizing'
                  ].map((symptom) => {
                    const checked = editSensitivity.includes(symptom);
                    return (
                      <label key={symptom} className="flex items-center gap-2 text-xs font-medium text-black/80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditSensitivity([...editSensitivity, symptom]);
                            } else {
                              setEditSensitivity(editSensitivity.filter(s => s !== symptom));
                            }
                          }}
                          className="rounded border-black/20 text-black focus:ring-black w-4 h-4"
                        />
                        <span>{symptom}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black/60 block">
                    How does your skin react to new products?
                  </label>
                  <select
                    value={editReaction}
                    onChange={(e) => setEditReaction(e.target.value)}
                    className="w-full bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    <option value="Very good, no problems">Very good, no problems</option>
                    <option value="Sometimes sensitive">Sometimes sensitive</option>
                    <option value="Often get redness, bumps, or burning">Often get redness, bumps, or burning</option>
                    <option value="Almost everything irritates my skin">Almost everything irritates my skin</option>
                  </select>
                </div>

                {barrierSaveError && (
                  <p className="text-xs text-red-600 font-semibold">{barrierSaveError}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveBarrier}
                    disabled={isSavingBarrier}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSavingBarrier && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Barrier Status
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingBarrier(false);
                      setBarrierSaveError(null);
                    }}
                    disabled={isSavingBarrier}
                    className="bg-black/5 hover:bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Skin Goals Card */}
          <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[13.2px] font-black uppercase tracking-wider text-black/50 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-venus-accent" />
                Skin Goals & Concerns
              </h4>
              {!isEditingGoals && (
                <button
                  onClick={() => {
                    setEditMainConcern(userProfile?.main_concern ? Number(userProfile.main_concern) : 12);
                    setEditScndConcern(userProfile?.scnd_concern ? Number(userProfile.scnd_concern) : 12);
                    setGoalsSaveError(null);
                    setIsEditingGoals(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                  title="Edit skincare goals"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditingGoals ? (
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black/60 block">
                    Main Concern
                  </label>
                  <select
                    value={editMainConcern}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditMainConcern(val);
                      if (val === 1 || editScndConcern === 1) {
                        setEditBreakoutTypes(prev => prev.slice(0, 1));
                      } else {
                        setEditBreakoutTypes([]);
                      }
                    }}
                    className="w-full bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    {SKIN_CONCERN_OPTIONS.map((c) => (
                      <option key={`edit-main-${c.id}`} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black/60 block">
                    Secondary Concern (Optional)
                  </label>
                  <select
                    value={editScndConcern}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditScndConcern(val);
                      if (val === 1 || editMainConcern === 1) {
                        setEditBreakoutTypes(prev => prev.slice(0, 1));
                      } else {
                        setEditBreakoutTypes([]);
                      }
                    }}
                    className="w-full bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  >
                    {SKIN_CONCERN_OPTIONS.map((c) => (
                      <option key={`edit-scnd-${c.id}`} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {goalsSaveError && (
                  <p className="text-xs text-red-600 font-semibold">{goalsSaveError}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveGoals}
                    disabled={isSavingGoals}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSavingGoals && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Goals
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingGoals(false);
                      setGoalsSaveError(null);
                    }}
                    disabled={isSavingGoals}
                    className="bg-black/5 hover:bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const mainLabel = getSkinConcernLabel(userProfile?.main_concern);
                const scndLabel = getSkinConcernLabel(userProfile?.scnd_concern);
                const legacyGoals = Array.isArray(userProfile?.goals) 
                  ? userProfile.goals 
                  : typeof userProfile?.goals === 'string' && userProfile.goals.trim() !== '' 
                  ? [userProfile.goals] 
                  : [];

                const hasAnyGoals = Boolean(mainLabel || (scndLabel && scndLabel !== mainLabel) || legacyGoals.length > 0);

                if (!hasAnyGoals) {
                  return <p className="text-xs text-black/40 italic">No specific skincare goals chosen</p>;
                }

                return (
                  <div className="flex flex-wrap gap-2">
                    {mainLabel && (
                      <span className="text-xs bg-black text-white px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-venus-pink" />
                        <span>{mainLabel}</span>
                        <span className="text-[9px] text-white/50 font-normal ml-1">Main</span>
                      </span>
                    )}
                    {scndLabel && scndLabel !== mainLabel && (
                      <span className="text-xs bg-black text-white px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-venus-pink" />
                        <span>{scndLabel}</span>
                        <span className="text-[9px] text-white/50 font-normal ml-1">Secondary</span>
                      </span>
                    )}
                    {legacyGoals.map((g: string, idx: number) => (
                      <span 
                        key={g + idx} 
                        className="text-xs bg-black text-white px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-venus-pink" />
                        {g}
                      </span>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          {/* Breakout Types Card */}
          <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
            {(() => {
              const isBreakoutGoalActive = Boolean(
                (isEditingGoals ? (editMainConcern === 1 || editScndConcern === 1) : (userProfile?.main_concern === 1 || userProfile?.scnd_concern === 1)) ||
                userProfile?.main_concern === 1 ||
                userProfile?.scnd_concern === 1
              );

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[13.2px] font-black uppercase tracking-wider text-black/50 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-purple-500" />
                      Breakout Characteristics
                    </h4>
                    {!isEditingBreakout && (
                      <button
                        onClick={() => {
                          const raw = Array.isArray(userProfile?.breakout_type) ? userProfile.breakout_type : (userProfile?.breakout_type ? [userProfile.breakout_type] : []);
                          const normalized = raw.map((b: any) => typeof b === 'number' ? b : parseInt(String(b), 10)).filter((n: number) => !isNaN(n));
                          setEditBreakoutTypes(isBreakoutGoalActive && normalized.length > 1 ? normalized.slice(0, 1) : normalized);
                          setBreakoutSaveError(null);
                          setIsEditingBreakout(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                        title="Edit breakout types"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  {isEditingBreakout ? (
                    <div className="space-y-4 pt-1">
                      <p className="text-xs text-black/60 font-medium">
                        {isBreakoutGoalActive 
                          ? 'Select the one that best resembles your breakouts' 
                          : 'Select all breakout characteristics that apply to your skin'}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {BREAKOUT_PHOTO_OPTIONS.map((opt) => {
                          const isSelected = editBreakoutTypes.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                if (isBreakoutGoalActive) {
                                  if (isSelected) {
                                    setEditBreakoutTypes([]);
                                  } else {
                                    setEditBreakoutTypes([opt.value]);
                                  }
                                } else {
                                  if (isSelected) {
                                    setEditBreakoutTypes(editBreakoutTypes.filter(v => v !== opt.value));
                                  } else {
                                    setEditBreakoutTypes([...editBreakoutTypes, opt.value]);
                                  }
                                }
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-500/20' : 'border-black/10 hover:bg-black/[0.02]'
                              }`}
                            >
                              {opt.img && (
                                <img src={opt.img} alt={opt.title} className="w-full h-20 object-cover rounded-lg mb-2 border border-black/5" />
                              )}
                              <span className="text-xs font-black text-black">{opt.title}</span>
                              {isSelected && <Check className="w-4 h-4 text-purple-600 mt-1 self-end" />}
                            </button>
                          );
                        })}
                      </div>

                      {breakoutSaveError && (
                        <p className="text-xs text-red-600 font-semibold">{breakoutSaveError}</p>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={handleSaveBreakout}
                          disabled={isSavingBreakout}
                          className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          {isSavingBreakout && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Save Breakout Types
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingBreakout(false);
                            setBreakoutSaveError(null);
                          }}
                          disabled={isSavingBreakout}
                          className="bg-black/5 hover:bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    Array.isArray(userProfile.breakout_type) && userProfile.breakout_type.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {(isBreakoutGoalActive ? userProfile.breakout_type.slice(0, 1) : userProfile.breakout_type).map((b: any, idx: number) => (
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
                    )
                  )}
                </>
              );
            })()}
          </div>

          {/* UV Burn Risk Card */}
          <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-400/[0.03] rounded-full -mr-6 -mt-6" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sun className="w-5 h-5 text-yellow-500" />
                <span className="text-[11px] font-black uppercase tracking-wider text-black/50 block">UV Burn Risk</span>
              </div>
              {!isEditingBurnRisk && (
                <button
                  onClick={() => {
                    setEditBurnRiskVal((userProfile?.burn_risk || 'medium').toLowerCase());
                    setBurnRiskSaveError(null);
                    setIsEditingBurnRisk(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                  title="Edit UV burn risk"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditingBurnRisk ? (
              <div className="space-y-3 pt-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-black/60 block">
                  How does your skin usually react to the sun?
                </label>
                <select
                  value={editBurnRiskVal}
                  onChange={(e) => setEditBurnRiskVal(e.target.value)}
                  className="w-full bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="low">Minimal — Got no problems tanning (Low)</option>
                  <option value="medium">Moderate — Burn then tan (Medium)</option>
                  <option value="high">High Risk — Burns easily (High)</option>
                </select>

                {burnRiskSaveError && (
                  <p className="text-xs text-red-600 font-semibold">{burnRiskSaveError}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveBurnRisk}
                    disabled={isSavingBurnRisk}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSavingBurnRisk && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save UV Burn Risk
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingBurnRisk(false);
                      setBurnRiskSaveError(null);
                    }}
                    disabled={isSavingBurnRisk}
                    className="bg-black/5 hover:bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-black text-black uppercase tracking-tight capitalize">
                    {userProfile?.burn_risk || 'Medium'}
                  </h3>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    userProfile?.burn_risk?.toLowerCase() === 'high' ? 'bg-red-100 text-red-700' :
                    userProfile?.burn_risk?.toLowerCase() === 'low' ? 'bg-green-100 text-green-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {userProfile?.burn_risk?.toLowerCase() === 'high' ? 'High Risk' :
                     userProfile?.burn_risk?.toLowerCase() === 'low' ? 'Minimal' : 'Moderate'}
                  </span>
                </div>
                <p className="text-[11px] text-black/60 font-medium mt-3">
                  {userProfile?.burn_risk?.toLowerCase() === 'high' && 'Highly sensitive to UV. Burns easily, tans minimally. Essential to use daily SPF 50+ and limit direct sun.'}
                  {userProfile?.burn_risk?.toLowerCase() === 'medium' && 'Moderately sensitive to UV. May burn initially, then tan. Daily SPF 30+ recommended.'}
                  {userProfile?.burn_risk?.toLowerCase() === 'low' && 'High melanin resilience. Burns rarely, tans easily. Standard daily SPF 30 is recommended for protection.'}
                  {!['high', 'medium', 'low'].includes(userProfile?.burn_risk?.toLowerCase()) && 'Your skin reactivity to solar radiation.'}
                </p>
              </div>
            )}
          </div>

          {/* Pregnancy Status Card */}
          <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[13.2px] font-black uppercase tracking-wider text-black/50 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-pink-500" />
                Pregnant or Breastfeeding Status
              </h4>
              {!isEditingPregnant && (
                <button
                  onClick={() => {
                    setEditPregnantVal(userProfile?.pregnant || 'No');
                    setPregnantSaveError(null);
                    setIsEditingPregnant(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                  title="Edit pregnancy status"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditingPregnant ? (
              <div className="space-y-4 pt-1">
                <select
                  value={editPregnantVal}
                  onChange={(e) => setEditPregnantVal(e.target.value)}
                  className="w-full bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>

                {pregnantSaveError && (
                  <p className="text-xs text-red-600 font-semibold">{pregnantSaveError}</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSavePregnant}
                    disabled={isSavingPregnant}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSavingPregnant && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Status
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingPregnant(false);
                      setPregnantSaveError(null);
                    }}
                    disabled={isSavingPregnant}
                    className="bg-black/5 hover:bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-xs bg-pink-50 text-pink-900 border border-pink-200/50 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider inline-block shadow-sm">
                {userProfile?.pregnant || 'No'}
              </span>
            )}
          </div>

          {/* Actives Used Card */}
          <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[13.2px] font-black uppercase tracking-wider text-black/50 flex items-center gap-1.5">
                <FlaskConical className="w-4 h-4 text-amber-500" />
                Active Skincare Ingredients Used
              </h4>
              {!isEditingActives && (
                <button
                  onClick={() => {
                    const currentActives = getActivesSelectedIds(userProfile?.actives_used);
                    setEditActivesVal(currentActives);
                    setActivesSaveError(null);
                    setIsEditingActives(true);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                  title="Edit actives used"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditingActives ? (
              <div className="space-y-4 pt-1">
                <p className="text-xs text-black/60 font-medium">Select active ingredients you currently use:</p>
                <div className="space-y-2">
                  {ACTIVE_SKINCARE_OPTIONS.map((opt) => {
                    const isSelected = editActivesVal.includes(opt.id);
                    return (
                      <label key={opt.id} className="flex items-center gap-2.5 text-xs font-bold text-black/85 cursor-pointer select-none py-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (opt.id === 4) {
                                setEditActivesVal([4]);
                              } else {
                                setEditActivesVal([...editActivesVal.filter(id => id !== 4 && id !== opt.id), opt.id]);
                              }
                            } else {
                              setEditActivesVal(editActivesVal.filter(id => id !== opt.id));
                            }
                          }}
                          className="rounded border-black/20 text-black focus:ring-black w-4 h-4 cursor-pointer"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>

                {activesSaveError && (
                  <p className="text-xs text-red-600 font-semibold">{activesSaveError}</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveActives}
                    disabled={isSavingActives}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSavingActives && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Actives Used
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingActives(false);
                      setActivesSaveError(null);
                    }}
                    disabled={isSavingActives}
                    className="bg-black/5 hover:bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const selectedIds = getActivesSelectedIds(userProfile?.actives_used);
                if (selectedIds.length === 0) {
                  return <p className="text-xs text-black/40 italic">No actives currently specified.</p>;
                }
                return (
                  <div className="flex flex-wrap gap-2">
                    {selectedIds.map((id) => {
                      const opt = ACTIVE_SKINCARE_OPTIONS.find(o => o.id === id);
                      const displayText = opt ? opt.label : (ACTIVES_TEXT_MAP[id] || `Active #${id}`);
                      return (
                        <span 
                          key={id} 
                          className="text-xs bg-amber-50 text-amber-900 border border-amber-200/50 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          {displayText}
                        </span>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

          {/* Past Problems / Ingredients to Avoid Card */}
          <div className="clean-card bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[13.2px] font-black uppercase tracking-wider text-black/50 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-red-500" />
                Past Problems / Ingredients to Avoid
              </h4>
              {!isEditingPastProblems && (
                <button
                  onClick={() => {
                    const parsedList = parseAvoidedIngredients(userProfile?.past_problems);
                    const listWithNames = parsedList.map(item => {
                      if (item.id && avoidedIngredientNames[item.id]) {
                        return { id: item.id, name: avoidedIngredientNames[item.id] };
                      }
                      return item;
                    });
                    setEditPastProblemsVal(listWithNames);
                    setNewProblemInput('');
                    setIngredientSuggestions([]);
                    setPastProblemsSaveError(null);
                    setIsEditingPastProblems(true);

                    const neededIds = listWithNames
                      .map(p => p.id)
                      .filter((id): id is number => typeof id === 'number' && !avoidedIngredientNames[id]);
                    if (neededIds.length > 0) {
                      supabase
                        .from('ingredient_scores')
                        .select('id, ingredient')
                        .in('id', neededIds)
                        .then(({ data }) => {
                          if (data && data.length > 0) {
                            setAvoidedIngredientNames(prev => {
                              const next = { ...prev };
                              data.forEach((d: any) => {
                                if (d.id && d.ingredient) next[d.id] = d.ingredient;
                              });
                              return next;
                            });
                            setEditPastProblemsVal(prev => prev.map(item => {
                              if (item.id) {
                                const match = data.find(d => d.id === item.id);
                                if (match && match.ingredient) return { id: item.id, name: match.ingredient };
                              }
                              return item;
                            }));
                          }
                        });
                    }

                    const missing = listWithNames.filter(p => p.id === null).map(p => p.name);
                    if (missing.length > 0) {
                      supabase
                        .from('ingredient_scores')
                        .select('id, ingredient')
                        .in('ingredient', missing)
                        .then(({ data }) => {
                          if (data && data.length > 0) {
                            setEditPastProblemsVal(prev => prev.map(item => {
                              if (item.id === null) {
                                const match = data.find(d => d.ingredient.toLowerCase() === item.name.toLowerCase());
                                if (match) return { id: match.id, name: match.ingredient };
                              }
                              return item;
                            }));
                          }
                        });
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-black/5 hover:bg-black/10 text-black rounded-lg transition-colors cursor-pointer"
                  title="Edit past problems"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditingPastProblems ? (
              <div className="space-y-4 pt-1">
                <p className="text-xs text-black/60 font-medium">Add or remove ingredients you wish to avoid because of past skin issues:</p>
                
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newProblemInput}
                      onChange={(e) => setNewProblemInput(e.target.value)}
                      onFocus={() => {
                        if (ingredientSuggestions.length > 0) setIsIngredientSuggestionsOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddProblemIngredient();
                        }
                      }}
                      placeholder="Search ingredient (e.g. Salicylic acid)..."
                      className="flex-1 bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <button
                      type="button"
                      onClick={handleAddProblemIngredient}
                      className="bg-black text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {isIngredientSuggestionsOpen && ingredientSuggestions.length > 0 && (
                    <div className="absolute left-0 right-12 top-full mt-1 bg-white border border-black/10 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto">
                      {ingredientSuggestions.map((sug) => (
                        <button
                          key={(sug.id ?? sug.name) + sug.name}
                          type="button"
                          onClick={() => {
                            if (!editPastProblemsVal.some(p => (sug.id !== null && p.id === sug.id) || p.name.toLowerCase() === sug.name.toLowerCase())) {
                              setEditPastProblemsVal([...editPastProblemsVal, sug]);
                            }
                            setNewProblemInput('');
                            setIngredientSuggestions([]);
                            setIsIngredientSuggestionsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-black hover:bg-black/5 transition-colors border-b border-black/5 last:border-b-0 cursor-pointer flex items-center justify-between"
                        >
                          <span>{sug.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {editPastProblemsVal.map((prob, idx) => {
                    const displayName = (prob.id && avoidedIngredientNames[prob.id]) ? avoidedIngredientNames[prob.id] : prob.name;
                    return (
                      <span
                        key={(prob.id ? String(prob.id) : prob.name) + idx}
                        className="text-xs bg-red-50 text-red-900 border border-red-200/50 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-2 shadow-sm"
                      >
                        <span>{displayName}</span>
                        <button
                          type="button"
                          onClick={() => setEditPastProblemsVal(editPastProblemsVal.filter((_, i) => i !== idx))}
                          className="w-4 h-4 rounded-full bg-red-200/60 hover:bg-red-300 text-red-800 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                  {editPastProblemsVal.length === 0 && (
                    <p className="text-xs text-black/40 italic">No ingredients added yet.</p>
                  )}
                </div>

                {pastProblemsSaveError && (
                  <p className="text-xs text-red-600 font-semibold">{pastProblemsSaveError}</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSavePastProblems}
                    disabled={isSavingPastProblems}
                    className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-black/80 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    {isSavingPastProblems && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Ingredients to Avoid
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingPastProblems(false);
                      setPastProblemsSaveError(null);
                    }}
                    disabled={isSavingPastProblems}
                    className="bg-black/5 hover:bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const problemsList = parseAvoidedIngredients(userProfile?.past_problems);

                if (problemsList.length === 0) {
                  return <p className="text-xs text-black/40 italic">No specific past problem ingredients specified.</p>;
                }

                return (
                  <div className="flex flex-wrap gap-2">
                    {problemsList.map((prob, idx) => {
                      const displayName = (prob.id && avoidedIngredientNames[prob.id]) ? avoidedIngredientNames[prob.id] : prob.name;
                      return (
                        <span 
                          key={(prob.id ? String(prob.id) : prob.name) + idx} 
                          className="text-xs bg-red-50 text-red-900 border border-red-200/50 px-3 py-1.5 rounded-xl font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span>{displayName}</span>
                        </span>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-black/70 hover:text-black transition-colors bg-black/5 px-6 py-3 rounded-xl border border-black/10 cursor-pointer shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
            <button
              onClick={() => navigateTo(AppState.DELETE_ACCOUNT, '/delete-account')}
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition-colors bg-red-50 px-6 py-3 rounded-xl border border-red-200/50 cursor-pointer shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
