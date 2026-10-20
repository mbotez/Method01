import { supabase } from '../lib/supabase';

// ==========================================
// TYPES AND INTERFACES
// ==========================================

export interface UserProfile {
  skin_type: 'dry' | 'oily' | 'combination';
  barrier_risk: number; // 0-8
  burn_risk: 'low' | 'medium' | 'high';
  new_product_reaction: number; // 0-3
  main_concern: number; // 1-12
  scnd_concern: number; // 1-12
  breakout_type: number[] | null; // 1-9
  pregnant: 'Yes' | 'No';
  age: number;
  actives_used: number; // 1-4
  env: number; // 1-4
  redness_score: number; // 1-100
  wrinkles_score: number; // 1-100
  scan_acne_type: number[]; // 1-9
  blemish_assessment?: any;
}

export interface RoutineCheckResult {
  routine_score: number;
  missing: { type: string; severity: 'high' | 'medium' | 'low'; message: string }[];
  detrimental: { product_id: string; reason: string; severity: 'high' | 'medium' | 'low' }[];
  incompatible_products: { product_ids: [string, string]; reason: string; resolved_by_timing: boolean }[];
  recommended_additions: { concern: string; product_id: string; reason: string }[];
  recommendations: string[];
  warnings: string[];
  debug: {
    user_irritation_threshold: 'low' | 'medium' | 'high';
    active_count: number;
    active_budget: number;
  };
}

// ==========================================
// DEFENSIVE UTILITY HELPERS
// ==========================================

/**
 * Parses any value to a boolean, handling string-based booleans from SQL/JSON.
 */
function isTrueVal(val: any): boolean {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const l = val.trim().toLowerCase();
    return l === 'true' || l === '1' || l === 'yes';
  }
  return false;
}

/**
 * Safely converts any value to a number with a fallback default value.
 */
function getNum(val: any, defaultVal = 0): number {
  if (val === null || val === undefined) return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Extracts a single ingredient score row from Supabase's optional nested array/object structure.
 */
function getIngScores(ing: any): any {
  if (!ing || !ing.ingredient_scores) return null;
  if (Array.isArray(ing.ingredient_scores)) {
    return ing.ingredient_scores[0] || null;
  }
  return ing.ingredient_scores;
}

/**
 * Checks if two antagonistic active groups form a conflict.
 * Retinoid/AHA_BHA_Exfoliant/Direct_Vitamin_C/Copper_peptide/None
 */
function isConflictingPair(g1: string, g2: string): boolean {
  const p1 = [g1, g2].sort().join('+');
  const conflictPairs = [
    'AHA_BHA_Exfoliant+Retinoid',
    'Direct_Vitamin_C+Retinoid',
    'Copper_peptide+Direct_Vitamin_C',
    'AHA_BHA_Exfoliant+Direct_Vitamin_C'
  ];
  return conflictPairs.includes(p1);
}

/**
 * Builds a friendly display name ("Brand - Name") for a product row, with fallbacks.
 */
function getDisplayName(p: any): string {
  const brand = p?.products?.brand || '';
  const name = p?.products?.name || p?.product_name || `Product #${p?.product_id}`;
  return brand ? `${brand} - ${name}` : name;
}

/**
 * Pulls the ingredient name(s) for a product that match a given score predicate.
 * Used so warnings can name the exact ingredients responsible instead of speaking generically.
 */

function getMatchingIngredientNames(
  productId: any,
  ingredientsData: any[],
  predicate: (scores: any) => boolean,
  limitToTopFive = true
): string[] {
  const names = ingredientsData
    .filter(ing => Number(ing.product_id) === Number(productId))
    .filter(ing => {
      const pos = getNum(ing.Position);
      if (limitToTopFive && pos > 5) return false;
      const scores = getIngScores(ing);
      return scores ? predicate(scores) : false;
    })
    .map(ing => {
      const scores = getIngScores(ing);
      // Prefer the score table's ingredient name or the joined chemical name
      return scores?.ingredient || ing.ingredient || ing['Full name'];
    })
    .filter(Boolean);
  return Array.from(new Set(names));
}

/**
 * Joins a list of ingredient names into a natural, readable phrase.
 * ["A"] -> "A" | ["A","B"] -> "A and B" | ["A","B","C"] -> "A, B and C"
 */
function joinNaturally(items: string[], fallback: string): string {
  if (!items || items.length === 0) return fallback;
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// Concern number map label key
const concernLabels: Record<number, string> = {
  1: 'acne_and_scars',
  2: 'redness',
  3: 'dark_spots',
  4: 'dullness',
  5: 'dryness',
  6: 'oiliness',
  7: 'wrinkles_and_fine_lines',
  8: 'pores_and_texture',
  9: 'sensitivity',
  10: 'eczema',
  11: 'fungal_acne',
  12: 'not_sure'
};

// ==========================================
// STEP-BY-STEP CALCULATION HELPERS
// ==========================================

/**
 * IMPLEMENTS STEP 3 (Part 1) — User Irritation Threshold Calculation.
 * Establishes the user's skin barrier sensitivity risk tier based on questionnaire and scans.
 */
export function computeIrritationThreshold(userProfile: UserProfile): 'low' | 'medium' | 'high' {
  let riskTier: 'low' | 'medium' | 'high' = 'low';
  const barrierRisk = getNum(userProfile.barrier_risk);
  if (barrierRisk >= 0 && barrierRisk <= 3) {
    riskTier = 'low';
  } else if (barrierRisk >= 4 && barrierRisk <= 6) {
    riskTier = 'medium';
  } else if (barrierRisk >= 7 && barrierRisk <= 8) {
    riskTier = 'high';
  }

  // Force-overrides to high risk
  if (userProfile.new_product_reaction === 3) {
    riskTier = 'high';
  }
  if ([2, 9, 10].includes(userProfile.main_concern) || [2, 9, 10].includes(userProfile.scnd_concern)) {
    riskTier = 'high';
  }

  return riskTier;
}

// Add this mapping dictionary near your other constants or inside the function
const acneTypeStringToId: Record<string, number> = {
  'blackheads': 1,
  'whiteheads': 2,
  'pie': 3,
  'pih': 4,
  'papules': 5,
  'congestion': 6,
  'pustules': 7,
  'severe_painful': 8,
  'surface acne': 5,
  'inflammatory acne': 7,
  'deep acne': 6
};

// Global normalizer applied across all steps
export const normalizeToIds = (arr: any | null | undefined): number[] => {
  if (!arr) return [];
  // Convert non-array single inputs into an array
  const safeArr = Array.isArray(arr) ? arr : [arr];

  return safeArr
    .map(x => {
      if (typeof x === 'string') {
        const key = x.trim().toLowerCase();
        return acneTypeStringToId[key] ?? getNum(x, 0);
      }
      return getNum(x, 0);
    })
    .filter(id => id > 0);
};


/**
 * IMPLEMENTS STEP 7 — Concern-Target Matching Metric Calculations.
 * Calculates the metric performance maximum of a routine for a specific concern number.
 * Scores are now normalized to a scale of 0.0 to 5.0 to ensure threshold alignment.
 */
export function computeConcernMetricScore(concernNum: number, userProfile: UserProfile, routineProducts: any[], ingredientsData: any[]): number {
  if (routineProducts.length === 0) return 0;
  switch (concernNum) {
    case 1: { // Acne & Scars
      // Extract and safely normalize breakout types and scan types using the global helper
      const normalizedBreakouts = normalizeToIds(userProfile.breakout_type);
      const normalizedScans = normalizeToIds(userProfile.blemish_assessment || userProfile.scan_acne_type);

      // Handle the edge case where a single string property like `acne_type` was passed dynamically to the profile object
      const extraAcneType = (userProfile as any).acne_type;
      if (typeof extraAcneType === 'string') {
        const mappedId = acneTypeStringToId[extraAcneType.trim().toLowerCase()];
        if (mappedId) normalizedBreakouts.push(mappedId);
      }

      // Compile the robust, fully numeric union array
      const union = Array.from(new Set([...normalizedBreakouts, ...normalizedScans]));
      
      const branches: number[] = [];

      // Branch 1: Blackheads & Whiteheads (specific to Treatments/Targeted)
      if (union.includes(1) || union.includes(2)) {
        const matchingProducts = routineProducts.filter(p => p.cat2 === 'Treatment' || p.cat2 === 'Targeted');

        if (matchingProducts.length > 0) {
          const subScores: number[] = [];

          // 1. Find the absolute highest blackheads score across all matching products
          if (union.includes(1)) {
            const maxBlackheads = Math.max(...matchingProducts.map(p => getNum(p.clear_blackheads)));
            subScores.push(maxBlackheads);
          }

          // 2. Find the absolute highest whiteheads score across all matching products
          if (union.includes(2)) {
            const maxWhiteheads = Math.max(...matchingProducts.map(p => getNum(p.clear_whiteheads)));
            subScores.push(maxWhiteheads);
          }

          // 3. Average only the target sub-types that are actually active in the user's profile
          branches.push(subScores.reduce((a, b) => a + b, 0) / subScores.length);
        } else {
          branches.push(0);
        }
      }

      // Branch 2: Surface Acne & Inflammatory acne
      if (union.includes(5) || union.includes(7)) {
        const maxVal = Math.max(...routineProducts.map(p => getNum(p.clear_surface_acne) + getNum(p.synergy_inflammatory_acne)));
        // Normalize 0-10 sum down to a standard 0-5 scale
        branches.push(maxVal / 2);
      }

      // Branch 3: Deep Acne & Penetration
      if (union.includes(6) || union.includes(8) || union.includes(9)) {
        const maxVal = Math.max(...routineProducts.map(p => getNum(p.soothe_deep_acne) + getNum(p.synergy_deep_acne_penetration)));
        // Normalize 0-10 sum down to a standard 0-5 scale
        branches.push(maxVal / 2);
      }

      if (branches.length > 0) {
        return branches.reduce((a, b) => a + b, 0) / branches.length;
      }
      return 0;
    }

    // ... keeping the rest of your switch case statements exactly the same ...
    default:
      return 5.0;
  }
}

/**
 * IMPLEMENTS STEP 8 (Part 2) — recommended_additions retrieval query.
 * Queries Supabase database for the absolute best treatment/targeted additions for an under-served concern.
 */
async function getRecommendedAddition(concernNum: number, userProfile: UserProfile): Promise<string[]> {
  let orderCol = 'clear_surface_acne';
  const skinType = userProfile.skin_type;
  if (concernNum === 1) {
    orderCol = 'clear_surface_acne';
  } else if ([2, 9, 10].includes(concernNum)) {
    orderCol = skinType === 'dry' ?
      'calm_redness_dry_skin' : (skinType === 'oily' ? 'calm_redness_oily_skin' : 'calm_redness_combi_skin');
  } else if (concernNum === 3 || concernNum === 4) {
    orderCol = 'fade_pih';
  } else if (concernNum === 5) {
    orderCol = skinType === 'dry' ?
      'hydration_dry_skin' : (skinType === 'oily' ? 'hydration_oily_skin' : 'hydration_combi_skin');
  } else if (concernNum === 6) {
    orderCol = 'oil_control';
  } else if (concernNum === 7) {
    orderCol = 'reduce_wrinkles';
  } else if (concernNum === 8) {
    orderCol = 'clear_blackheads';
  } else if (concernNum === 11 || concernNum === 12) {
    orderCol = 'clear_surface_acne';
  }

  try {
    let query = supabase
      .from('product_scores')
      .select('*')
      .in('cat2', ['Treatment', 'Targeted']);
    if (userProfile.pregnant === 'Yes') {
      query = query.eq('pregnancy_safe', true);
    }

    if (concernNum === 11 || userProfile.main_concern === 11 || userProfile.scnd_concern === 11) {
      query = query.eq('has_fungal_trigger', false);
    }

    query = query.order(orderCol, { ascending: false }).limit(30);

    const { data, error } = await query;
    if (error || !data) {
      console.warn(`[getRecommendedAddition] Failed to query suggested products for concern ${concernNum}`, error);
      return [];
    }

    // Clean, client-side filtration for robust execution (ignoring null and casing mismatches)
    const filtered = (data as any[]).filter(p => {
      if (!p.skin_types_to_avoid) return true;
      return !p.skin_types_to_avoid.toLowerCase().includes(userProfile.skin_type.toLowerCase());
    });
    return filtered.slice(0, 2).map(p => String(p.product_id));
  } catch (err) {
    console.error("[getRecommendedAddition] Exception thrown in suggestion query:", err);
    return [];
  }
}

// ==========================================
// PRIMARY EXPORTED FUNCTION
// ==========================================

/**
 * Checks an entire skincare routine for completeness, compatibility, safety, and efficacy against a user profile.
 *
 * @param userProfile The survey/onboarding responses and scanned scores of the active user.
 * @param routineProductIds The array of database product_ids present in the routine.
 * @param routineTiming Optional timing overrides (AM, PM, both) per product.
 */
export async function checkRoutine(
  userProfile: UserProfile,
  routineProductIds: string[],
  routineTiming?: Record<string, 'AM' | 'PM' | 'both'>
): Promise<RoutineCheckResult> {

  const warnings: string[] = [];
  const missing: { type: string; severity: 'high' | 'medium' | 'low'; message: string }[] = [];
  const detrimental: { product_id: string; reason: string; severity: 'high' | 'medium' | 'low' }[] = [];
  const incompatible_products: { product_ids: [string, string]; reason: string; resolved_by_timing: boolean }[] = [];
  const recommended_additions: { concern: string; product_id: string; reason: string }[] = [];
  const recommendations: string[] = [];
  // Per-product natural-language notes, combined into a single bullet block per product later on,
  // so a product's name is never repeated more than once across all its warnings.
  const productNotes: Record<string, string[]> = {};
  const addNote = (id: any, note: string) => {
    const key = String(id);
    if (!productNotes[key]) productNotes[key] = [];
    productNotes[key].push(note);
  };

  // General (non-per-product) natural-language notes, grouped into their own single blocks.
  const shortfallNotes: string[] = [];
  const conflictNotes: string[] = [];
  const redundancyNotes: string[] = [];
  const envNotes: string[] = [];

  // Defensive block: Empty routine
  if (!routineProductIds || routineProductIds.length === 0) {
    return {
      routine_score: 0,
      missing: [
        { type: 'missing_all', severity: 'high', message: "Your routine is empty right now — add some products so we can check it." }
      ],
      detrimental: [],
      incompatible_products: [],
      recommended_additions: [],
      recommendations: ["Your routine is empty. Start with a cleanser, SPF, and moisturiser."],
      warnings: ["No products were provided to verify."],
      debug: {
        user_irritation_threshold: computeIrritationThreshold(userProfile),
        active_count: 0,
        active_budget: 0
      }
    };
  }

  // Parse product ids defensively to numbers to query the database bigint columns
  const numericIds = routineProductIds.map(id => Number(id)).filter(id => !isNaN(id));
  // ------------------------------------------
  // STEP 1 — Fetch Data
  // ------------------------------------------
  let productsData: any[] = [];
  let ingredientsData: any[] = [];

  try {
    // Query product scores joined with products details
    const { data: pData, error: pError } = await supabase
      .from('product_scores')
      .select(`
        *,
        products (
          brand,
          name
        )
      `)
      .in('product_id', numericIds);

    if (pError) throw pError;
    productsData = pData || [];

    // Query ingredients joined with ingredient scores
    const { data: iData, error: iError } = await supabase
      .from('product_ingredients')
      .select(`
        product_id,
        "Full name",
        Position,
        ingredient,
        ingredient_id,
        row_id,
        ingredient_scores (
          id,
          ingredient,
          Breakouts_Acne,
          Oiliness,
          Clogged_Pores_Blackheads,
          Dry_Skin,
          Large_Pores_Texture,
          Dark_Spots,
          Dullness,
          Redness,
          Elasticity_Loss,
          Barrier_Repair,
          Dry_Skin_Type,
          Oily_Skin_Type,
          Combination_Skin_Type,
          Normal_Skin_Type,
          UV_Sensitive,
          pH_Dependent_Active,
          Tyrosinase_Inhibitor,
          Vasoconstrictor,
          Penetration_Enhancer,
          Astringent,
          Cell_Turnover_Accelerator,
          Pregnancy_Safe,
          Fungal_Acne_Trigger,
          High_Irritation_Risk,
          Essential_Oils_Fragrance,
          Antagonistic_Group,
          Fatty_Acid_Profile
        )
      `)
      .in('product_id', numericIds);

    if (iError) throw iError;
    ingredientsData = iData || [];
  } catch (err) {
    console.error("[checkRoutine] Database connection or select query failed:", err);
    warnings.push("Could not complete routine check due to database connection errors.");
  }

  // Log warnings for any products missed
  for (const id of routineProductIds) {
    const found = productsData.some(p => Number(p.product_id) === Number(id));
    if (!found) {
      warnings.push(`Product ID ${id} was not found in the database and was skipped.`);
    }
  }

  // Preserve the original ordering from routineProductIds for stable evaluation
  const routineProducts = routineProductIds
    .map(id => productsData.find(p => Number(p.product_id) === Number(id)))
    .filter(Boolean);


  // Map timing per product
  const productTimings: Record<string, 'AM' | 'PM' | 'both'> = {};
  for (const product of routineProducts) {
    const prodIdStr = String(product.product_id);
    const productIngredients = ingredientsData.filter(ing => Number(ing.product_id) === Number(product.product_id));

    const enforceUvSensitivity = isTrueVal(product.night) || (product.active_antagonistic_group === 'Retinoid' && String(product.cat3) === '4');
    // UV sensitive or Cell turnover accelerator in first 5 ingredients sets default to PM
    const top5HasUvOrCell = productIngredients.some(ing => {
      const pos = getNum(ing.Position);
      const scores = getIngScores(ing);
      const isUvSensitive = enforceUvSensitivity && isTrueVal(scores.UV_Sensitive);
      return pos <= 5 && scores && (isUvSensitive || isTrueVal(scores.Cell_Turnover_Accelerator));
    });
    let defaultTiming: 'AM' | 'PM' | 'both' = 'both';
    if ((enforceUvSensitivity && isTrueVal(product.uv_sensitivity_required)) || top5HasUvOrCell) {
      defaultTiming = 'PM';
    }

    // Apply manual overrides from third argument if available
    let resolvedTiming: 'AM' | 'PM' | 'both' = defaultTiming;
    if (routineTiming) {
      if (routineTiming[prodIdStr] !== undefined) {
        resolvedTiming = routineTiming[prodIdStr];
      } else if (routineTiming[Number(prodIdStr)] !== undefined) {
        resolvedTiming = routineTiming[Number(prodIdStr)];
      }
    }

    productTimings[prodIdStr] = resolvedTiming;
  }

  // ------------------------------------------
  // STEP 2 — Core Pillar Completeness Check
  // ------------------------------------------

  const hasCleanser = routineProducts.some(p => p.cat2 === 'Cleanser');
  const hasSPF = routineProducts.some(p => p.cat2 === 'SPF');
  const hasMoisturiser = routineProducts.some(p => p.cat2 === 'Moisturiser');
  
  if (!hasCleanser) {

    missing.push({
      type: 'missing_cleanser',
      severity: 'high',
      message: "No cleanser yet — it's the base step for clearing away oil and daily buildup."
    });
  }

  if (!hasSPF) {

    missing.push({
      type: 'missing_spf',
      severity: 'high',
      message: "No SPF in the mix — that's your best defense against sun damage and early aging."
    });
  }

  if (!hasMoisturiser) {

    const isOily = userProfile.skin_type === 'oily';
    const otherHydrator = routineProducts.some(p =>
      ['SPF', 'Treatment', 'Targeted'].includes(p.cat2) && getNum(p.hydration_oily_skin) > 0
    );
    if (isOily && otherHydrator) {

      missing.push({
        type: 'missing_moisturiser',
        severity: 'low',
        message: "No standalone moisturiser, but since you have oily skin and your routine already contains a hydrating SPF or treatment, that's fine to skip."
      });
    } else {

      missing.push({
        type: 'missing_moisturiser',
        severity: 'high',
        message: "No moisturiser. You'll want one to keep your barrier hydrated and healthy."
      });
    }
  }

  // ------------------------------------------
  // STEP 3 — User_Irritation_Threshold and Active Budget
  // ------------------------------------------
  const effectiveRiskTier = computeIrritationThreshold(userProfile);

  // Active Classification & Budgeting
  interface ActiveProductRecord {
    product_id: string;
    isProductActive: boolean;
    isIngredientActive: boolean;
  }
  const activeRecords: ActiveProductRecord[] = [];

  for (const product of routineProducts) {
    const prodIdStr = String(product.product_id);
    const isProductActive = isTrueVal(product.has_high_irritation) ||
      (product.active_antagonistic_group && product.active_antagonistic_group !== 'None');

    const productIngredients = ingredientsData.filter(ing => Number(ing.product_id) === Number(product.product_id));
    const isIngredientActive = !isProductActive && productIngredients.some(ing => {
      const pos = getNum(ing.Position);
      const scores = getIngScores(ing);
      return pos <= 5 && scores && isTrueVal(scores.High_Irritation_Risk);
    });
    if (isProductActive || isIngredientActive) {
      activeRecords.push({
        product_id: prodIdStr,
        isProductActive,
        isIngredientActive
      });
    }
  }

  let activeBudget = 2;
  if (effectiveRiskTier === 'high') {
    activeBudget = 0;
  } else if (effectiveRiskTier === 'medium') {
    activeBudget = 1;
  } else if (effectiveRiskTier === 'low') {
    activeBudget = 2;
  }

  // Dynamic ranking of active formulations based on cumulative irritation risk.
  // This preserves mild actives within the budget, and flags the most irritating ones as the over-budget items.
  const scoredActives = activeRecords.map(record => {
    const prod = routineProducts.find(p => String(p.product_id) === record.product_id);
    let irritationScore = 0;
    if (prod) {
      if (isTrueVal(prod.has_high_irritation)) irritationScore += 10;
      if (isTrueVal(prod.contains_frag)) irritationScore += 5;
      if (prod.barrier_states_to_avoid === 1 || prod.barrier_states_to_avoid === 2) irritationScore += 8;
      if (prod.active_antagonistic_group && prod.active_antagonistic_group !== 'None') irritationScore += 3;
    }
    return { record, irritationScore, prod };
  });

  // Sort ascending by irritation potential so highly aggressive elements sit at the back (indices >= budget) to get flagged first
  scoredActives.sort((a, b) => a.irritationScore - b.irritationScore);

  if (activeRecords.length > activeBudget) {
    shortfallNotes.push(
      `You're using ${activeRecords.length} products containing actives, which is too many and may irritate your skin. Ideally don't include more than ${activeBudget} and reduce if you notice any discomfort.`
    );
  }

  // Loop 1: Active budget violations
  for (let idx = 0; idx < scoredActives.length; idx++) {
    const { record, prod } = scoredActives[idx];
    if (idx >= activeBudget) {
      detrimental.push({
        product_id: record.product_id,
        reason: `Pushes you over your active-ingredient limit for your barrier sensitivity.`,
        severity: 'medium'
      });
    }
  }

  // Loop 2: Barrier State Check
  for (const product of routineProducts) {
    const bAvoid = product.barrier_states_to_avoid;
    const isMatch = (bAvoid === 1 && (effectiveRiskTier === 'medium' || effectiveRiskTier === 'high')) ||
      (bAvoid === 2 && effectiveRiskTier === 'high');

    if (isMatch) {
      const displayName = getDisplayName(product);
      const irritantNames = getMatchingIngredientNames(product.product_id, ingredientsData, s => isTrueVal(s.High_Irritation_Risk));
      const ingredientPhrase = joinNaturally(irritantNames, 'strong ingredients');
    
      detrimental.push({
        product_id: String(product.product_id),
        reason: `Compromised Skin Warning: ${displayName} contains ${ingredientPhrase}, which may be too much for your compromised skin barrier.`,
        severity: 'high'
      });
    
      addNote(product.product_id, `Contains ${ingredientPhrase} — likely too strong for your barrier right now.`);
    }
  }

  // Loop 3: High Risk Fragrance Check
  for (const { record: r, prod: p } of scoredActives) {
    if (effectiveRiskTier === 'high' && p && isTrueVal(p.contains_frag)) {
      detrimental.push({
        product_id: r.product_id,
        reason: `Compromised Skin Warning: Fragrant Active Warning: ${getDisplayName(p)} contains fragrance, which can be extra sensitizing for a vulnerable barrier.`,
        severity: 'high'
      });

      // Updated phrasing as requested
      addNote(r.product_id, `Contains fragrance, which can irritate more than usual given your barrier risk.`);
    }
  }

  // ------------------------------------------
  // STEP 4 — Antagonistic Layering Check
  // ------------------------------------------

  interface LayerActiveItem {
    product_id: string;
    group: string;
    timing: 'AM' | 'PM' | 'both';
    displayName: string;
  }

  const layerItems: LayerActiveItem[] = routineProducts
    .filter(p => p.active_antagonistic_group && p.active_antagonistic_group !== 'None' && p.active_antagonistic_group !== 'none')
    .map(p => ({
      product_id: String(p.product_id),
      group: p.active_antagonistic_group,
      timing: productTimings[String(p.product_id)],
      displayName: getDisplayName(p)
    }));

  // Map to store conflicts per base product: 
  // baseProductId -> Map<conflictingGroup, Set<conflictingProductNames>>
  const conflictsByProduct: Record<string, {
    baseName: string;
    baseGroup: string;
    conflictsByGroup: Record<string, Set<string>>;
  }> = {};

  for (let i = 0; i < layerItems.length; i++) {
    for (let j = i + 1; j < layerItems.length; j++) {
      const item1 = layerItems[i];
      const item2 = layerItems[j];

      if (isConflictingPair(item1.group, item2.group)) {
        const sharesTiming = item1.timing === 'both' ||
          item2.timing === 'both' || item1.timing === item2.timing;

        if (sharesTiming) {
          incompatible_products.push({
            product_ids: [item1.product_id, item2.product_id],
            reason: `${item1.displayName} and ${item2.displayName} shouldn't be layered together — they can irritate each other.`,
            resolved_by_timing: false
          });

          // Track item1 as the base anchor product
          if (!conflictsByProduct[item1.product_id]) {
            conflictsByProduct[item1.product_id] = {
              baseName: item1.displayName,
              baseGroup: item1.group,
              conflictsByGroup: {}
            };
          }
          if (!conflictsByProduct[item1.product_id].conflictsByGroup[item2.group]) {
            conflictsByProduct[item1.product_id].conflictsByGroup[item2.group] = new Set();
          }
          conflictsByProduct[item1.product_id].conflictsByGroup[item2.group].add(item2.displayName);
        }
      }
    }
  }

  // Build human-friendly sentences from grouped conflicts
  for (const entry of Object.values(conflictsByProduct)) {
    const { baseName, baseGroup, conflictsByGroup } = entry;

    const targetPhrases: string[] = [];
    for (const [otherGroup, namesSet] of Object.entries(conflictsByGroup)) {
      const namesList = joinNaturally(Array.from(namesSet), 'other products');
      targetPhrases.push(`${namesList} which contains ${otherGroup.replace(/_/g, ' ')}`);
    }

    const combinedTargets = joinNaturally(targetPhrases, '');
    conflictNotes.push(
      `${baseName} contains ${baseGroup.replace(/_/g, ' ')} and shouldn't be used at the same time as ${combinedTargets}.`
    );
  }

  // ------------------------------------------
  // STEP 5 — Absolute Contraindications
  // ------------------------------------------

  for (const product of routineProducts) {
    // ... logic ...
    // (I will add logs inside the loop in the next step)
  }
  for (const product of routineProducts) {
    const prodIdStr = String(product.product_id);
    const productIngredients = ingredientsData.filter(ing => Number(ing.product_id) === Number(product.product_id));

    // Pregnancy Check
    if (userProfile.pregnant === 'Yes') {
      const isProdPregUnsafe = !isTrueVal(product.pregnancy_safe);
      const hasUnsafePregIng = productIngredients.some(ing => {
        const scores = getIngScores(ing);
        return scores && scores.Pregnancy_Safe === false;
      });
      if (isProdPregUnsafe || hasUnsafePregIng) {
        detrimental.push({
          product_id: prodIdStr,
          reason: `Not considered safe to use during pregnancy.`,
          severity: 'high'
        });
        addNote(prodIdStr, `Not pregnancy-safe — best to skip this one for now.`);
      }
    }

    // Fungal Acne Check
    const isFungalConcern = userProfile.main_concern === 11 ||
      userProfile.scnd_concern === 11;
    if (isFungalConcern) {
      const isProdFungalTrigger = isTrueVal(product.has_fungal_trigger);
      const hasFungalTriggerIng = productIngredients.some(ing => {
        const scores = getIngScores(ing);
        return scores && isTrueVal(scores.Fungal_Acne_Trigger);
      });
      if (isProdFungalTrigger || hasFungalTriggerIng) {
        detrimental.push({
          product_id: prodIdStr,
          reason: `Contains ingredients that can feed fungal acne.`,
          severity: 'high'
        });
        addNote(prodIdStr, `Can feed fungal acne — worth swapping out given your concern.`);
      }
    }

    // Fatty Acid Mismatch Check
    if (['oily', 'combination'].includes(userProfile.skin_type)) {
      if (isTrueVal(product.fatty_acid_mismatch)) {
        detrimental.push({
          product_id: prodIdStr,
          reason: `Rich in fatty acids that tend to clog oily or combination skin.`,
          severity: 'high'
        });
        addNote(prodIdStr, `Its fatty acid profile tends to clog oilier skin.`);
      }
    }
  }

  // ------------------------------------------
  // STEP 6 — Dynamic Skin-Type Matrix (Max-Performance Optimization)
  // ------------------------------------------
  let skinTypeMaxScore = 0;
  const st = userProfile.skin_type;

  if (routineProducts.length > 0) {
    if (st === 'dry') {
      skinTypeMaxScore = Math.max(...routineProducts.map(p => getNum(p.barrier_repair_dry_skin) + getNum(p.hydration_dry_skin)));
    } else if (st === 'oily') {
      skinTypeMaxScore = Math.max(...routineProducts.map(p => getNum(p.hydration_oily_skin) + getNum(p.oil_control)));
    } else if (st === 'combination') {
      skinTypeMaxScore = Math.max(...routineProducts.map(p => getNum(p.hydration_combi_skin) + getNum(p.barrier_repair_combi_skin)));
    }
  }

  // Keep your Anti-masking Loophole Verification exactly as it is
  let individualProductFailed = false;
  const failingProductNames: string[] = [];
  for (const p of routineProducts) {
    let pScore = 0;
    if (st === 'dry') {
      pScore = getNum(p.barrier_repair_dry_skin) + getNum(p.hydration_dry_skin);
    } else if (st === 'oily') {
      pScore = getNum(p.hydration_oily_skin) + getNum(p.oil_control);
    } else if (st === 'combination') {
      pScore = getNum(p.hydration_combi_skin) + getNum(p.barrier_repair_combi_skin);
    }
    if (pScore < -2) {
      individualProductFailed = true;
      failingProductNames.push(getDisplayName(p));
    }
  }

  // Update the gate condition to check if your best-performing product is still failing (< 2)
  if (skinTypeMaxScore < 2 || individualProductFailed) {
    let message = `Overall, these formulas aren't doing much for your ${st} skin (best score: ${skinTypeMaxScore}).`;
    if (individualProductFailed) {
      message = `Your routine contains products (like ${joinNaturally(failingProductNames, 'some items')}) that are highly unsuitable or stripping for your ${st} skin.`;
    }
    missing.push({
      type: 'poorly_optimized_for_skin_type',
      severity: 'medium',
      message
    });
    shortfallNotes.push(individualProductFailed
      ? `Your routine contains products that actively work against your ${st} skin.`
      : `Overall, these formulas aren't really working with your ${st} skin.`);
  }

  // ------------------------------------------
  // STEP 7 — Concern-Target Matching
  // ------------------------------------------
  // Acne & scars PIH melanin inhibitor gap check safely mapped
  const breakoutUnionBreakouts = normalizeToIds(userProfile.breakout_type);
  const breakoutUnionScans = normalizeToIds(userProfile.blemish_assessment || userProfile.scan_acne_type);
  const breakoutUnion = Array.from(new Set([...breakoutUnionBreakouts, ...breakoutUnionScans]));
  
  if (breakoutUnion.includes(4) && (userProfile.main_concern === 3 || userProfile.main_concern === 4 || userProfile.scnd_concern === 3 || userProfile.scnd_concern === 4)) {
    const hasMelaninInhibitor = routineProducts.some(p => isTrueVal(p.has_melanin_inhibitor));
    if (!hasMelaninInhibitor) {
      missing.push({
        type: 'missing_melanin_inhibitor',
        severity: 'medium',
        message: "You've got dark marks from past breakouts, but nothing here actively helps fade them."
      });
      shortfallNotes.push(`Nothing here targets the dark marks left behind by past breakouts.`);
    }
  }

  // Wrinkles high score gap check
  if ((userProfile.main_concern === 7 || userProfile.scnd_concern === 7) && userProfile.wrinkles_score > 60) {
    const wrinklesScoreMax = Math.max(...routineProducts.map(p => getNum(p.reduce_wrinkles)));
    if (wrinklesScoreMax <= 0) {
      missing.push({
        type: 'wrinkles_gap',
        severity: 'high',
        message: "Your scan flagged noticeable wrinkles, but nothing here supports cell turnover or fine lines."
      });
      shortfallNotes.push(`Your scan flagged noticeable wrinkles, but nothing here is working on them.`);
    }
  }

  // Efficacy calculations for primary/secondary concerns (Evaluated on normalized 0.0 - 5.0 scale)
  let mainScore = computeConcernMetricScore(userProfile.main_concern, userProfile, routineProducts, ingredientsData);
  if (userProfile.main_concern === 11) {
    const hasFungalTriggers = detrimental.some(d => d.reason.toLowerCase().includes('fungal acne'));
    mainScore = hasFungalTriggers ? 0 : 5;
  } else if (userProfile.main_concern === 12) {
    const corePillarsPass = !missing.some(m => m.type === 'missing_cleanser' || m.type === 'missing_spf');
    mainScore = corePillarsPass ? 5 : 0;
  }

  let scndScore = computeConcernMetricScore(userProfile.scnd_concern, userProfile, routineProducts, ingredientsData);
  if (userProfile.scnd_concern === 11) {
    const hasFungalTriggers = detrimental.some(d => d.reason.toLowerCase().includes('fungal acne'));
    scndScore = hasFungalTriggers ? 0 : 5;
  } else if (userProfile.scnd_concern === 12) {
    const corePillarsPass = !missing.some(m => m.type === 'missing_cleanser' || m.type === 'missing_spf');
    scndScore = corePillarsPass ? 5 : 0;
  }

  // Re-calculate for Log 4
  const normalizedBreakoutsForLog = normalizeToIds(userProfile.breakout_type);
  const normalizedScansForLog = normalizeToIds(userProfile.blemish_assessment || userProfile.scan_acne_type);
  const union = Array.from(new Set([...normalizedBreakoutsForLog, ...normalizedScansForLog]));
  
  const matchingProducts = routineProducts.filter(p => p.cat2 === 'Treatment' || p.cat2 === 'Targeted');

  if (mainScore < 3) {
    const mainLabel = concernLabels[userProfile.main_concern] || 'your main concern';
    shortfallNotes.push(`This routine isn't doing much for ${mainLabel.replace(/_/g, ' ')}, your top concern.`);
  }
  if (scndScore < 3 && userProfile.scnd_concern !== userProfile.main_concern) {
    const scndLabel = concernLabels[userProfile.scnd_concern] || 'your secondary concern';
    shortfallNotes.push(`It's also light on support for ${scndLabel.replace(/_/g, ' ')}.`);
  }

  // ------------------------------------------
  // STEP 8 — Holistic Routine Efficacy Score and suggested query
  // ------------------------------------------
  const underServedConcerns: { num: number; type: 'main' | 'secondary' }[] = [];
  if (mainScore < 3) {
    underServedConcerns.push({ num: userProfile.main_concern, type: 'main' });
  }
  if (scndScore < 3 && userProfile.scnd_concern !== userProfile.main_concern) {
    underServedConcerns.push({ num: userProfile.scnd_concern, type: 'secondary' });
  }

  // Run async queries for recommendations
  for (const item of underServedConcerns) {
    const ids = await getRecommendedAddition(item.num, userProfile);
    const label = concernLabels[item.num] || `concern #${item.num}`;
    for (const pid of ids) {
      recommended_additions.push({
        concern: item.type === 'main' ? 'primary' : 'secondary',
        product_id: String(pid),
        reason: `A solid pick to help with ${label.replace(/_/g, ' ')}.`
      });
    }
  }

  // Normalization Scoring Engine starting from 100 points
  let score = 100;
  // 1. Subtract fixed penalties for Hard completeness failures (-20 each)
  const hardMissingCount = missing.filter(m => m.severity === 'high').length;
  score -= hardMissingCount * 20;

  // 2. Subtract fixed penalties for Hard contraindication failures (-20 each)
  const hardDetrimentalCount = detrimental.filter(d => d.severity === 'high').length;
  score -= hardDetrimentalCount * 20;

  // 3. Subtract medium penalties for overload/irritations/mismatch (-10 each)
  const medDetrimentalCount = detrimental.filter(d => d.severity === 'medium').length;
  score -= medDetrimentalCount * 10;

  const conflictCount = incompatible_products.length;
  score -= conflictCount * 10;
  const medMissingCount = missing.filter(m => m.severity === 'medium').length;
  score -= medMissingCount * 10;

  // 4. Subtract scaled efficacy shortfall (-10 points per point below the 3.0 threshold on standardized scale)
  const mainShortfall = Math.max(0, 3.0 - mainScore);
  const scndShortfall = Math.max(0, 3.0 - scndScore);
  score -= (mainShortfall + scndShortfall) * 10;

  const routine_score = Math.max(0, Math.min(100, Math.round(score)));

  // ------------------------------------------
  // STEP 9 — Optional Enhanced Checks (Redundancy, Environment)
  // ------------------------------------------
  // Redundancy Check
  for (let i = 0; i < routineProducts.length; i++) {
    for (let j = i + 1; j < routineProducts.length; j++) {
      const p1 = routineProducts[i];
      const p2 = routineProducts[j];

      const shareCat = p1.cat3 && p1.cat3 === p2.cat3;
      const shareActive = p1.active_antagonistic_group && p1.active_antagonistic_group !== 'None' && p1.active_antagonistic_group === p2.active_antagonistic_group;
      if (shareCat && shareActive) {
        redundancyNotes.push(`${getDisplayName(p1)} and ${getDisplayName(p2)} overlap a lot — you probably don't need both.`);
      }
    }
  }

  // Environment Fit warnings
  if (userProfile.env === 3) {
    const moisturizers = routineProducts.filter(p => p.cat2 === 'Moisturiser');
    const hasThickMoisturizer = moisturizers.some(p => getNum(p.viscosity) >= 3);
    if (moisturizers.length > 0 && !hasThickMoisturizer) {
      envNotes.push("You're in a cold, dry climate — a richer cream or a facial oil would help shield your barrier.");
    }
  } else if (userProfile.env === 2) {
    const thickMoisturizers = routineProducts.filter(p => p.cat2 === 'Moisturiser' && getNum(p.viscosity) >= 4);
    if (thickMoisturizers.length > 0) {
      envNotes.push("You're in a hot, humid climate — a heavy cream can trap sebum. A lighter gel or lotion would breathe better.");
    }
  }

  // ------------------------------------------
  // USER-FACING SYNTHESIS WRITING — grouped into single blocks
  // ------------------------------------------

  // Block: missing essentials (one bullet block, not separate lines)
  const missingLines = missing
    .filter(m => m.type !== 'poorly_optimized_for_skin_type' && m.type !== 'missing_melanin_inhibitor' && m.type !== 'wrinkles_gap')
    .map(m => `• ${m.message}`);
  if (missingLines.length > 0) {
    recommendations.push(`Your routine's missing a few things:\n${missingLines.join('\n')}`);
  }

  // Block: per-product warnings — one block per product, name shown once as the header
  const productWarningBlocks: string[] = [];
  for (const [productId, notes] of Object.entries(productNotes)) {
    const prod = routineProducts.find(p => String(p.product_id) === productId);
    const displayName = prod ? getDisplayName(prod) : `Product #${productId}`;
    const uniqueNotes = Array.from(new Set(notes));
    productWarningBlocks.push(`${displayName}:\n${uniqueNotes.map(n => `• ${n}`).join('\n')}`);
  }
  if (productWarningBlocks.length > 0) {
    recommendations.push(`A few things worth watching:\n\n${productWarningBlocks.join('\n\n')}`);
  }

    // Block: where the routine falls short on results
  if (shortfallNotes.length > 0) {
    const uniqueShortfalls = Array.from(new Set(shortfallNotes));
    recommendations.push(`Where this routine could do more:\n${uniqueShortfalls.map(n => `• ${n}`).join('\n')}`);
  }

  // Block: ingredient conflicts and timing notes
  if (conflictNotes.length > 0) {
    const uniqueConflictNotes = Array.from(new Set(conflictNotes));
    recommendations.push(`Ingredient timing:\n${uniqueConflictNotes.map(n => `• ${n}`).join('\n')}`);
  }

  // Block: redundant products
  if (redundancyNotes.length > 0) {
    const uniqueRedundancy = Array.from(new Set(redundancyNotes));
    recommendations.push(`Possible overlap:\n${uniqueRedundancy.map(n => `• ${n}`).join('\n')}`);
  }

  // Block: environment fit
  if (envNotes.length > 0) {
    recommendations.push(`Climate fit:\n${envNotes.map(n => `• ${n}`).join('\n')}`);
  }


  return {
    routine_score,
    missing,
    detrimental,
    incompatible_products,
    recommended_additions,
    recommendations: Array.from(new Set(recommendations)), // de-duplicate recommendation blocks
    warnings,
    debug: {
      user_irritation_threshold: effectiveRiskTier,
      active_count: activeRecords.length,
      active_budget: activeBudget
    }
  };
}