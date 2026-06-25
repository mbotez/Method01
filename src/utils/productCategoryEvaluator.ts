import { supabase } from '../lib/supabase';

export interface EvaluationResult {
  category: 'Avoid' | 'Caution' | 'Safe' | 'Recommended';
  reasons: string[];
  potentialBreakoutRisk?: boolean;
  potentialBreakoutIngredients?: string[];
  potentialBreakoutReasons?: string[];
  details?: {
    userId: string;
    productId: string;
    userProfileFound: boolean;
    userProfileData?: {
      new_product_reaction: number | null;
      barrier_risk: number | null;
      pregnant: string | null;
      breakout_type: any;
    };
    totalIngredientsProcessed: number;
    matchedIngredientsCount: number;
    matchedIngredients: string[];
    missingIngredients: string[];
  };
}

/**
 * Standalone, reusable utility to evaluate a skincare product category for a user
 * based on their user profile attributes and the product's ingredients score data.
 * 
 * @param userId - Unique identifier of the user in Supabase user_profile table.
 * @param productId - Unique identifier of the product.
 * @param ingredients - Array of ingredient names to evaluate.
 */
export async function evaluateProductCategory(
  userId: string,
  productId: string,
  ingredients: string[]
): Promise<EvaluationResult> {
  console.log(`[evaluateProductCategory] Starting evaluation for userId: ${userId}, productId: ${productId}`);

  let userProfileFound = false;
  let userProfileDataForDetails: any = null;
  let potentialBreakoutRisk = false;
  const potentialBreakoutIngredients: string[] = [];
  const potentialBreakoutReasons: string[] = [];

  // 1. Prepare Target Ingredients - bypass products lookup if ingredients were already provided!
  let targetIngredients = ingredients && ingredients.length > 0 ? ingredients : [];

  if (targetIngredients.length === 0 && productId) {
    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          product_ingredients (
            Position,
            ingredient
          )
        `)
        .eq('id', parseInt(productId, 10))
        .order('Position', { foreignTable: 'product_ingredients', ascending: true })
        .maybeSingle();

      if (productError) {
        console.error('[evaluateProductCategory] Error fetching product and ingredients:', productError);
      } else if (productData && productData.product_ingredients && productData.product_ingredients.length > 0) {
        // Double-check sorting on the client side to guarantee correct order
        const sortedIngredients = [...productData.product_ingredients].sort((a: any, b: any) => {
          const posA = Number(a.Position ?? a.position ?? 0);
          const posB = Number(b.Position ?? b.position ?? 0);
          return posA - posB;
        });

        const dbIngredients = sortedIngredients
          .map(row => row.ingredient)
          .filter((ing): ing is string => typeof ing === 'string' && ing.trim().length > 0);
        
        if (dbIngredients.length > 0) {
          console.log(`[evaluateProductCategory] Found ${dbIngredients.length} ingredients from product_ingredients table for productId: ${productId}`);
          targetIngredients = dbIngredients;
        } else {
          console.warn(`[evaluateProductCategory] product_ingredients has rows but ingredient column is empty for productId: ${productId}`);
        }
      } else {
        console.warn(`[evaluateProductCategory] No ingredients found in product_ingredients for productId: ${productId}. Using fallback ingredients.`);
      }
    } catch (err) {
      console.error('[evaluateProductCategory] Uncaught exception in product_ingredients lookup:', err);
    }
  }

  const uniqueIngredients = Array.from(new Set(targetIngredients.map(i => i.trim()).filter(i => i.length > 0)));

  // 2. Fetch User Profile AND Ingredient Scores in parallel to speed up the process!
  const userProfilePromise = (async () => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('user_profile')
        .select('skin_type, goals, new_product_reaction, barrier_risk, pregnant, breakout_type')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[evaluateProductCategory] Error fetching user profile:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[evaluateProductCategory] Exception fetching user profile:', err);
      return null;
    }
  })();

  const ingredientScoresPromise = (async () => {
    if (uniqueIngredients.length === 0) return [];
    try {
      const queryIngredients = Array.from(new Set([
        ...uniqueIngredients,
        ...uniqueIngredients.map(i => i.trim()),
        ...uniqueIngredients.map(i => i.toLowerCase().trim())
      ]));

      const { data, error } = await supabase
        .from('ingredient_scores')
        .select('*')
        .in('ingredient', queryIngredients);

      if (error) {
        console.error('[evaluateProductCategory] Error fetching ingredient scores:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[evaluateProductCategory] Uncaught exception fetching ingredient scores:', err);
      return [];
    }
  })();

  // Execute both database fetches concurrently
  const [userProfileRaw, scoreData] = await Promise.all([
    userProfilePromise,
    ingredientScoresPromise
  ]);

  const userProfile = userProfileRaw as any;

  if (userProfile) {
    userProfileFound = true;
    userProfileDataForDetails = {
      skin_type: userProfile.skin_type,
      goals: userProfile.goals,
      new_product_reaction: userProfile.new_product_reaction,
      barrier_risk: userProfile.barrier_risk,
      pregnant: userProfile.pregnant,
      breakout_type: userProfile.breakout_type
    };
    console.log('[evaluateProductCategory] Fetched user profile in parallel:', userProfileDataForDetails);
  } else if (userId) {
    console.warn(`[evaluateProductCategory] No profile found for userId: ${userId}. Using defaults.`);
  }

  // Define fallback user profile defaults if missing or not logged in
  const userReaction = userProfile?.new_product_reaction !== null && userProfile?.new_product_reaction !== undefined 
    ? Number(userProfile.new_product_reaction) 
    : 1; // Default to 'Sometimes sensitive'
  const userBarrierRisk = userProfile?.barrier_risk !== null && userProfile?.barrier_risk !== undefined 
    ? Number(userProfile.barrier_risk) 
    : 0; // Default to no barrier risk
  const isPregnant = (userProfile?.pregnant && 
    (String(userProfile.pregnant).toLowerCase() === 'yes' || String(userProfile.pregnant).toLowerCase() === 'true')) ||
    userProfile?.pregnancy === true;
  
  // Parse breakout types safely from JSONB column
  const breakoutTypes: string[] = [];
  if (userProfile?.breakout_type) {
    if (Array.isArray(userProfile.breakout_type)) {
      breakoutTypes.push(...userProfile.breakout_type.map((t: any) => String(t).toLowerCase()));
    } else if (typeof userProfile.breakout_type === 'string') {
      try {
        const parsed = JSON.parse(userProfile.breakout_type);
        if (Array.isArray(parsed)) {
          breakoutTypes.push(...parsed.map((t: any) => String(t).toLowerCase()));
        } else {
          breakoutTypes.push(String(parsed).toLowerCase());
        }
      } catch {
        breakoutTypes.push(userProfile.breakout_type.toLowerCase());
      }
    }
  }
  const isFungalAcneProne = breakoutTypes.some(t => t.includes('fungal'));

  // Parse goals array safely from JSONB column
  const goalsArray: string[] = [];
  if (userProfile?.goals) {
    if (Array.isArray(userProfile.goals)) {
      goalsArray.push(...userProfile.goals.map((g: any) => String(g)));
    } else if (typeof userProfile.goals === 'string') {
      try {
        const parsed = JSON.parse(userProfile.goals);
        if (Array.isArray(parsed)) {
          goalsArray.push(...parsed.map((g: any) => String(g)));
        } else {
          goalsArray.push(String(parsed));
        }
      } catch {
        goalsArray.push(userProfile.goals);
      }
    }
  }

  // Support target_goal and mapped goals
  const targetGoal = userProfile?.target_goal || userProfile?.primary_issue || "";
  const hasAcneGoal = targetGoal === 'Acne' || goalsArray.some(g => g === 'Clear breakouts' || g.toLowerCase().includes('acne'));
  const hasRednessGoal = targetGoal === 'Redness' || goalsArray.some(g => g === 'Calm redness' || g.toLowerCase().includes('redness'));
  const hasFineLinesGoal = targetGoal === 'Fine Lines' || goalsArray.some(g => g === 'Soften fine lines and wrinkles' || g.toLowerCase().includes('fine lines') || g.toLowerCase().includes('wrinkle'));
  const hasElasticityGoal = targetGoal === 'Elasticity Loss' || goalsArray.some(g => g === 'Improve elasticity' || g.toLowerCase().includes('elasticity'));

  const isOilySkin = userProfile?.skin_type?.toLowerCase() === 'oily';
  const isDrySkin = userProfile?.skin_type?.toLowerCase() === 'dry';

  const scoreMap = new Map<string, any>();
  const matchedIngredients: string[] = [];
  const missingIngredients: string[] = [];

  if (scoreData) {
    for (const row of scoreData) {
      const ingName = row.ingredient || row.Ingredient;
      if (ingName) {
        scoreMap.set(ingName.toLowerCase().trim(), row);
      }
    }
  }

  for (const ing of uniqueIngredients) {
    const key = ing.toLowerCase().trim();
    if (scoreMap.has(key)) {
      matchedIngredients.push(ing);
    } else {
      missingIngredients.push(ing);
    }
  }

  // --- LOG INGREDIENT SCORES RESULTS ---
  console.log(`\n======================================================`);
  console.log(`🧪 [evaluateProductCategory] INGREDIENT SCORES RESULTS`);
  console.log(`======================================================`);
  console.log(`Total Ingredients Processed: ${uniqueIngredients.length}`);
  console.log(`Matched with DB scores: ${matchedIngredients.length}`);
  console.log(`Missing from DB scores: ${missingIngredients.length}`);
  
  if (matchedIngredients.length > 0) {
    console.log(`\nMatched Ingredients & Scores:`);
    matchedIngredients.forEach(ing => {
      const row = scoreMap.get(ing.toLowerCase().trim());
      console.log(`  • "${ing}":`, JSON.stringify({
        Breakouts_Acne: row.Breakouts_Acne,
        Oiliness: row.Oiliness,
        Clogged_Pores: row.Clogged_Pores_Blackheads,
        Dry_Skin: row.Dry_Skin,
        Barrier_Repair: row.Barrier_Repair,
        High_Irritation_Risk: row.High_Irritation_Risk,
        Fungal_Acne_Trigger: row.Fungal_Acne_Trigger,
        Pregnancy_Safe: row.Pregnancy_Safe,
        Antagonistic_Group: row.Antagonistic_Group,
        Essential_Oils_Fragrance: row.Essential_Oils_Fragrance,
        UV_Sensitive: row.UV_Sensitive
      }));
    });
  }
  if (missingIngredients.length > 0) {
    console.log(`\nMissing Ingredients (No Score Data found):`);
    console.log(`  [ ${missingIngredients.join(', ')} ]`);
  }
  console.log(`======================================================\n`);

  const isUVSensitive = (val: any): boolean => {
    if (val === true) return true;
    if (typeof val === 'string') {
      const lower = val.toLowerCase().trim();
      return lower === 'true' || lower === 'yes' || lower === 'y';
    }
    return false;
  };

  const getDetails = () => ({
    userId,
    productId,
    userProfileFound,
    userProfileData: userProfileDataForDetails,
    totalIngredientsProcessed: uniqueIngredients.length,
    matchedIngredientsCount: matchedIngredients.length,
    matchedIngredients,
    missingIngredients
  });

  // Keep a running trace of logic evaluation steps
  const logicSteps: string[] = [];
  logicSteps.push(`Starting category evaluation logic for userId "${userId}" and productId "${productId}".`);
  logicSteps.push(`User skin profile parameters:`);
  logicSteps.push(`  - Skin Type: ${userProfile?.skin_type || 'default/unknown'}`);
  logicSteps.push(`  - Sensitive level (new product reaction): ${userReaction} (1= sometimes, 2= moderate, 3= severe)`);
  logicSteps.push(`  - Barrier Risk Score: ${userBarrierRisk} (0-10)`);
  logicSteps.push(`  - Is Pregnant: ${isPregnant}`);
  logicSteps.push(`  - Is Fungal Acne Prone: ${isFungalAcneProne}`);
  logicSteps.push(`  - Goals: ${JSON.stringify(goalsArray)} (AcneGoal: ${hasAcneGoal}, RednessGoal: ${hasRednessGoal}, FineLinesGoal: ${hasFineLinesGoal}, ElasticityGoal: ${hasElasticityGoal})`);

  // Helper to log a triggered rule and return the category
  const triggerAvoidRule = (ruleNum: number, desc: string, ingredient: string, ruleResult: any) => {
    const msg = `[AVOID TRIGGERED - Rule ${ruleNum}] ${desc} triggered by ingredient "${ingredient}".`;
    logicSteps.push(msg);
    logicSteps.push(`Rule Evaluation Result: ${JSON.stringify(ruleResult)}`);
    
    console.log(`\n📋 CATEGORY EVALUATION LOGIC TRACE:`);
    logicSteps.forEach((step, idx) => console.log(`  [Step ${idx + 1}] ${step}`));
    console.log(`🎯 FINAL CATEGORY DETERMINED: Avoid\n`);

    return {
      category: 'Avoid' as const,
      reasons: [desc],
      potentialBreakoutRisk: potentialBreakoutRisk || undefined,
      potentialBreakoutIngredients: potentialBreakoutIngredients.length > 0 ? potentialBreakoutIngredients : undefined,
      potentialBreakoutReasons: potentialBreakoutReasons.length > 0 ? potentialBreakoutReasons : undefined,
      details: getDetails()
    };
  };

  const triggerCautionRule = (ruleNum: number, desc: string, ingredient: string, ruleResult: any) => {
    const msg = `[CAUTION TRIGGERED - Rule ${ruleNum}] ${desc} triggered by ingredient "${ingredient}".`;
    logicSteps.push(msg);
    logicSteps.push(`Rule Evaluation Result: ${JSON.stringify(ruleResult)}`);

    console.log(`\n📋 CATEGORY EVALUATION LOGIC TRACE:`);
    logicSteps.forEach((step, idx) => console.log(`  [Step ${idx + 1}] ${step}`));
    console.log(`🎯 FINAL CATEGORY DETERMINED: Caution\n`);

    return {
      category: 'Caution' as const,
      reasons: [desc],
      potentialBreakoutRisk: potentialBreakoutRisk || undefined,
      potentialBreakoutIngredients: potentialBreakoutIngredients.length > 0 ? potentialBreakoutIngredients : undefined,
      potentialBreakoutReasons: potentialBreakoutReasons.length > 0 ? potentialBreakoutReasons : undefined,
      details: getDetails()
    };
  };

  const checkAndApplyBottomHalfBypass = (ing: string, ruleNum: number, ruleName: string): boolean => {
    const originalIndex = targetIngredients.findIndex(t => t.trim().toLowerCase() === ing.trim().toLowerCase());
    const totalCount = targetIngredients.length;
    if (totalCount === 0 || originalIndex === -1) return false;
    
    const relPos = originalIndex / totalCount;
    const isBottomHalf = relPos > 0.50;

    if (isBottomHalf) {
      potentialBreakoutRisk = true;
      if (!potentialBreakoutIngredients.includes(ing)) {
        potentialBreakoutIngredients.push(ing);
        potentialBreakoutReasons.push(`[Rule ${ruleNum} Override] ${ruleName} ingredient "${ing}" at relative position ${(relPos * 100).toFixed(1)}% is in the bottom half of the ingredients list.`);
      }
      logicSteps.push(`[Rule ${ruleNum} OVERRIDDEN] ${ruleName} ingredient "${ing}" at relative position ${(relPos * 100).toFixed(1)}% is in the bottom half of formula. Avoid verdict bypassed, Potential Breakout Risk flag activated.`);
      return true;
    }
    return false;
  };

  // =========================================================================
  // --- POSITION-BASED RULE FLAGS CONFIGURATION ---
  // =========================================================================
  
  // Create an ordered representation of target ingredients with their scores and relative positions
  const totalIngredients = targetIngredients.length;
  const orderedIngredientsWithScores = targetIngredients.map((ing, index) => {
    const name = ing.trim();
    const lowerName = name.toLowerCase();
    const scoreRow = scoreMap.get(lowerName);
    const relPosition = totalIngredients > 0 ? (index / totalIngredients) : 0;
    return {
      name,
      lowerName,
      index,
      relPosition,
      scoreRow
    };
  });

  // Flag 1: Anhydrous Active Bypass (Rule 1)
  let isAnhydrousVehicle = false;
  if (userBarrierRisk > 6 || userReaction === 3) {
    const vehicleBase = orderedIngredientsWithScores.filter(item => item.relPosition <= 0.15);
    const hasWaterOrAqua = vehicleBase.some(item => 
      item.lowerName.includes('water') || item.lowerName.includes('aqua')
    );
    if (!hasWaterOrAqua) {
      const hasSqualaneOrHighBarrierRepair = vehicleBase.some(item => {
        if (item.lowerName.includes('squalane')) return true;
        const score = item.scoreRow;
        return score && score.Barrier_Repair !== null && score.Barrier_Repair !== undefined && Number(score.Barrier_Repair) > 3;
      });
      if (hasSqualaneOrHighBarrierRepair) {
        isAnhydrousVehicle = true;
        logicSteps.push(`Rule 1 "Anhydrous Active" Bypass active: isAnhydrousVehicle = true (barrier risk > 6 or reaction === 3 AND no water/aqua in vehicle base and has squalane/barrier_repair > 3).`);
      }
    }
  }

  // Flag 2: Silicone Suspension Matrix Cushion (Rule 2)
  let isSiliconeCushion = false;
  if (userBarrierRisk > 6) {
    const vehicleBase = orderedIngredientsWithScores.filter(item => item.relPosition <= 0.15);
    const hasSiliconeFilmFormer = vehicleBase.some(item => {
      const isSiliconeName = item.lowerName.includes('dimethicone') || 
                             item.lowerName.includes('silicone') || 
                             item.lowerName.includes('siloxane');
      const astringentVal = item.scoreRow?.Astringent;
      const isAstringent = astringentVal === true;
      return isSiliconeName && !isAstringent;
    });
    if (hasSiliconeFilmFormer) {
      isSiliconeCushion = true;
      logicSteps.push(`Rule 2 "Silicone Suspension Matrix" Cushion active: isSiliconeCushion = true (barrier risk > 6 AND non-astringent silicone in vehicle base).`);
    }
  }

  // Flag 4: Heavy Lipids / High-Oleic Trap (Rule 4)
  let isHeavyVehicle = false;
  if (isOilySkin && hasAcneGoal) {
    const vehicleBase = orderedIngredientsWithScores.filter(item => item.relPosition <= 0.15);
    const hasHeavyIngredient = vehicleBase.some(item => {
      if (!item.scoreRow) return false;
      const isHighOleic = item.scoreRow.Fatty_Acid_Profile === 'High_Oleic';
      const oilySkinVal = item.scoreRow.Oily_Skin_Type !== null && item.scoreRow.Oily_Skin_Type !== undefined ? Number(item.scoreRow.Oily_Skin_Type) : 0;
      return isHighOleic || oilySkinVal < -2;
    });
    if (hasHeavyIngredient) {
      isHeavyVehicle = true;
      logicSteps.push(`Rule 4 Heavy Lipids flag active: isHeavyVehicle = true (oily skin + acne goal AND high-oleic/heavy oily-skin-type ingredient in vehicle base).`);
    }
  }

  // --- RULE 3: The "Penetration Enhancer" Trap ---
  if (userBarrierRisk > 6 || userReaction === 3) {
    const functionalZone = orderedIngredientsWithScores.filter(item => item.relPosition <= 0.35);
    for (const item of functionalZone) {
      if (item.scoreRow) {
        const isPenetrationEnhancer = item.scoreRow.Penetration_Enhancer === true;
        const isEssentialOilsFragrance = item.scoreRow.Essential_Oils_Fragrance === true;
        const isAstringent = item.scoreRow.Astringent === true;
        
        if (isPenetrationEnhancer || isEssentialOilsFragrance || isAstringent) {
          const reason = `A compromised barrier cannot tolerate early-stage delivery vectors or volatile aromatics (found "${item.name}" with a penetration enhancer, fragrance/essential oil, or astringent in the first 35% of the formula).`;
          return triggerAvoidRule(3, reason, item.name, {
            Penetration_Enhancer: isPenetrationEnhancer,
            Essential_Oils_Fragrance: isEssentialOilsFragrance,
            Astringent: isAstringent,
            relPosition: item.relPosition
          });
        }
      }
    }
  }

  // --- AVOID RULES (Loop over ingredients and early-exit on first conflict) ---
  logicSteps.push(`Evaluating AVOID rules...`);
  for (const ing of uniqueIngredients) {
    const row = scoreMap.get(ing.toLowerCase().trim());
    if (!row) continue;

    const originalIndex = targetIngredients.findIndex(t => t.trim().toLowerCase() === ing.trim().toLowerCase());
    const relPosition = totalIngredients > 0 ? (originalIndex / totalIngredients) : 0;

    const hasAntagonisticGroup = row.Antagonistic_Group !== null && 
                                 row.Antagonistic_Group !== undefined && 
                                 String(row.Antagonistic_Group).trim() !== '' && 
                                 String(row.Antagonistic_Group).trim().toLowerCase() !== 'none';
    const isHighIrritationRisk = row.High_Irritation_Risk === true;

    let shouldAvoidForAntagonistic = hasAntagonisticGroup;
    let shouldAvoidForHighIrritation = isHighIrritationRisk;

    // Rule 2 Exception (Silicone Suspension Matrix Cushion):
    // If isSiliconeCushion is true, downgrade severity of active ingredients further down the list (relPosition > 0.15)
    // belonging to an Antagonistic_Group or marked High_Irritation_Risk === true.
    if (isSiliconeCushion && relPosition > 0.15) {
      if (shouldAvoidForAntagonistic) {
        shouldAvoidForAntagonistic = false;
        logicSteps.push(`Rule 2 Exception: Bypassing absolute avoidance block for Antagonistic_Group on ingredient "${ing}" (outside of vehicle base, silicone cushion active).`);
      }
      if (shouldAvoidForHighIrritation) {
        shouldAvoidForHighIrritation = false;
        logicSteps.push(`Rule 2 Exception: Bypassing absolute avoidance block for High_Irritation_Risk on ingredient "${ing}" (outside of vehicle base, silicone cushion active).`);
      }
    }

    // Rule 1 & Rule 2: Severe Reaction or High Barrier Risk Avoidance Rules
    if (userReaction === 3 || userBarrierRisk > 6) {
      const isBarrierRepairNegative2 = row.Barrier_Repair !== null && row.Barrier_Repair !== undefined && Number(row.Barrier_Repair) < -2;
      const isBarrierAndAcneRisk = (row.Barrier_Repair !== null && row.Barrier_Repair !== undefined && Number(row.Barrier_Repair) < 0) &&
                                   (row.Breakouts_Acne !== null && row.Breakouts_Acne !== undefined && Number(row.Breakouts_Acne) < -2);
      
      let triggerTurnover = row.Cell_Turnover_Accelerator === true;
      let triggerPHActive = row.pH_Dependent_Active === true;

      // Rule 1 Exception (Anhydrous Active Bypass):
      // If isAnhydrousVehicle is true, do NOT trigger an absolute avoidance block for
      // Cell_Turnover_Accelerator or pH_Dependent_Active if they are located outside of the Vehicle Base (relPosition > 0.15)
      if (isAnhydrousVehicle && relPosition > 0.15) {
        if (triggerTurnover) {
          triggerTurnover = false;
          logicSteps.push(`Rule 1 Exception: Bypassing absolute avoidance block for Cell_Turnover_Accelerator on ingredient "${ing}" (outside of vehicle base, anhydrous vehicle active).`);
        }
        if (triggerPHActive) {
          triggerPHActive = false;
          logicSteps.push(`Rule 1 Exception: Bypassing absolute avoidance block for pH_Dependent_Active on ingredient "${ing}" (outside of vehicle base, anhydrous vehicle active).`);
        }
      }

      if (isBarrierRepairNegative2 || isBarrierAndAcneRisk || shouldAvoidForAntagonistic || shouldAvoidForHighIrritation || triggerTurnover || triggerPHActive) {
        if (!checkAndApplyBottomHalfBypass(ing, 1, 'Barrier compromise/irritation/active/antagonist')) {
          return triggerAvoidRule(1, 
            'Extremely sensitive skin or high barrier risk + barrier compromise, antagonistic active, turnover accelerator, pH-dependent active, or high irritation risk ingredient',
            ing,
            { isBarrierRepairNegative2, isBarrierAndAcneRisk, shouldAvoidForAntagonistic, shouldAvoidForHighIrritation, triggerTurnover, triggerPHActive }
          );
        }
      }
    }

    // Rule 3: Acne Goal Conflict
    if (hasAcneGoal) {
      const breakoutsAcne = row.Breakouts_Acne !== null && row.Breakouts_Acne !== undefined ? Number(row.Breakouts_Acne) : 0;
      const cloggedPores = row.Clogged_Pores_Blackheads !== null && row.Clogged_Pores_Blackheads !== undefined ? Number(row.Clogged_Pores_Blackheads) : 0;
      const oiliness = row.Oiliness !== null && row.Oiliness !== undefined ? Number(row.Oiliness) : 0;
      const isFungalTrigger = row.Fungal_Acne_Trigger === true;
      
      let isExfoliantAntagonist = row.Antagonistic_Group === 'AHA_BHA_Exfoliant';
      if (isSiliconeCushion && relPosition > 0.15 && isExfoliantAntagonist) {
        isExfoliantAntagonist = false;
        logicSteps.push(`Rule 2 Exception: Bypassing absolute avoidance block for exfoliant antagonist AHA_BHA_Exfoliant on ingredient "${ing}" due to Silicone Cushion.`);
      }

      if (breakoutsAcne <= -4 || cloggedPores <= -4 || isExfoliantAntagonist || oiliness <= -3) {
        if (!checkAndApplyBottomHalfBypass(ing, 3, 'Comedogenic/exfoliating active')) {
          return triggerAvoidRule(3,
            'Acne concern + comedogenic / exfoliating trigger',
            ing,
            { breakoutsAcne, cloggedPores, oiliness, isFungalTrigger, isExfoliantAntagonist }
          );
        }
      }
    }

    // Rule 4: Heavy Lipids / High-Oleic Trap for Oily Acne Profiles
    if (isHeavyVehicle) {
      const breakoutsAcne = row.Breakouts_Acne !== null && row.Breakouts_Acne !== undefined ? Number(row.Breakouts_Acne) : 0;
      const cloggedPores = row.Clogged_Pores_Blackheads !== null && row.Clogged_Pores_Blackheads !== undefined ? Number(row.Clogged_Pores_Blackheads) : 0;
      if (breakoutsAcne < 0 || cloggedPores < 0) {
        if (!checkAndApplyBottomHalfBypass(ing, 4, 'Heavy Lipids / High-Oleic Trap')) {
          return triggerAvoidRule(4,
            `Compromised heavy vehicle (heavy lipids/high-oleic oil in the vehicle base) makes ingredient "${ing}" (comedogenic/breakout risk) too heavy for oily acne-prone skin.`,
            ing,
            { breakoutsAcne, cloggedPores, isHeavyVehicle }
          );
        }
      }
    }

    // General Oily Skin + High-Oleic Oils check
    if (isOilySkin && row.Fatty_Acid_Profile === 'High_Oleic') {
      if (!checkAndApplyBottomHalfBypass(ing, 40, 'High-Oleic oil (pore-clogging risk for oily skin)')) {
        return triggerAvoidRule(40,
          'Oily skin + high-oleic oil (pore-clogging risk)',
          ing,
          { isOilySkin, Fatty_Acid_Profile: row.Fatty_Acid_Profile }
        );
      }
    }

    // Rule 5: Dry Skin + Drying / Astringent Ingredients
    if (isDrySkin) {
      const drySkinVal = row.Dry_Skin !== null && row.Dry_Skin !== undefined ? Number(row.Dry_Skin) : 0;
      if (drySkinVal <= -3 || row.Astringent === true) {
        if (!checkAndApplyBottomHalfBypass(ing, 5, 'Drying or astringent')) {
          return triggerAvoidRule(5,
            'Dry skin + strongly drying or astringent ingredient',
            ing,
            { drySkinVal, Astringent: row.Astringent }
          );
        }
      }
    }

    // Rule 6: High Irritation / Sensitivity
    if (userBarrierRisk > 3 || hasRednessGoal) {
      if (shouldAvoidForHighIrritation || isUVSensitive(row.UV_Sensitive)) {
        if (!checkAndApplyBottomHalfBypass(ing, 6, 'High irritation / UV-sensitive')) {
          return triggerAvoidRule(6,
            'Sensitive or compromised skin + high irritation / UV-sensitive ingredient',
            ing,
            { High_Irritation_Risk: row.High_Irritation_Risk, shouldAvoidForHighIrritation, UV_Sensitive: row.UV_Sensitive }
          );
        }
      }
    }

    // Rule 7: Target Goal Conflicts (Redness / Aging)
    if (hasRednessGoal) {
      const rednessVal = row.Redness !== null && row.Redness !== undefined ? Number(row.Redness) : 0;
      if (rednessVal <= -2) {
        if (!checkAndApplyBottomHalfBypass(ing, 7, 'Redness-worsening')) {
          return triggerAvoidRule(7,
            'Redness concern + redness-worsening ingredient',
            ing,
            { rednessVal }
          );
        }
      }
    }
    if (hasFineLinesGoal || hasElasticityGoal) {
      const elasticityVal = row.Elasticity_Loss !== null && row.Elasticity_Loss !== undefined ? Number(row.Elasticity_Loss) : 0;
      if (elasticityVal <= -3) {
        if (!checkAndApplyBottomHalfBypass(ing, 7, 'Elasticity-harming')) {
          return triggerAvoidRule(7,
            'Anti-aging goal + ingredient harmful to elasticity',
            ing,
            { elasticityVal }
          );
        }
      }
    }

    // Rule 8: Antagonistic / Incompatible Actives (strong rule)
    if (shouldAvoidForAntagonistic) {
      if (!checkAndApplyBottomHalfBypass(ing, 8, 'Antagonistic active')) {
        return triggerAvoidRule(8,
          'Contains antagonistic active (Retinoid, Direct Vit C, Copper Peptide, AHA/BHA)',
          ing,
          { Antagonistic_Group: row.Antagonistic_Group }
        );
      }
    }

    // Rule 9: Pregnancy Safety
    if (isPregnant && row.Pregnancy_Safe === false) {
      if (!checkAndApplyBottomHalfBypass(ing, 9, 'Not pregnancy safe')) {
        return triggerAvoidRule(9,
          'Not pregnancy safe',
          ing,
          { isPregnant, Pregnancy_Safe: row.Pregnancy_Safe }
        );
      }
    }

  }
  logicSteps.push(`No AVOID rules triggered.`);

  // --- CAUTION RULES (Loop over ingredients and early-exit on first conflict) ---
  logicSteps.push(`Evaluating CAUTION rules...`);
  for (const ing of uniqueIngredients) {
    const row = scoreMap.get(ing.toLowerCase().trim());
    if (!row) continue;

    // Rule 11: Fungal Acne Trigger Caution Rule
    if (isFungalAcneProne && row.Fungal_Acne_Trigger === true) {
      return triggerCautionRule(11,
        'Contains a known fungal acne trigger, which may cause flares for your skin type.',
        ing,
        { isFungalAcneProne, Fungal_Acne_Trigger: row.Fungal_Acne_Trigger }
      );
    }

    // Rule 12: Essential Oils / Fragrance Sensitivity Rule
    if (userReaction >= 2 && row.Essential_Oils_Fragrance === true) {
      return triggerCautionRule(12,
        'Contains fragrance or essential oils, which may trigger irritation on sensitive skin.',
        ing,
        { userReaction, Essential_Oils_Fragrance: row.Essential_Oils_Fragrance }
      );
    }

    // Rule 13: High Irritation Risk for moderately sensitive users
    if (userReaction === 2 && row.High_Irritation_Risk === true) {
      return triggerCautionRule(13,
        'Contains ingredient with high irritation risk, which may affect your moderately sensitive skin.',
        ing,
        { userReaction, High_Irritation_Risk: row.High_Irritation_Risk }
      );
    }
  }
  logicSteps.push(`No CAUTION rules triggered.`);

  // --- RECOMMENDATION RULES (Check for matching ingredients) ---
  logicSteps.push(`Evaluating RECOMMENDATION rules...`);
  const recommendationReasons: string[] = [];
  for (const ing of uniqueIngredients) {
    const key = ing.toLowerCase().trim();
    const row = scoreMap.get(key);
    if (!row) continue;
    if (userBarrierRisk > 3 && row.Barrier_Repair !== null && row.Barrier_Repair !== undefined && Number(row.Barrier_Repair) >= 2) {
      const reasonMsg = `"${row.ingredient || row.Ingredient || ing}" is highly recommended because it actively supports skin barrier repair (score: ${row.Barrier_Repair}).`;
      recommendationReasons.push(reasonMsg);
      logicSteps.push(`[RECOMMENDED] Matching ingredient "${ing}" supports skin barrier repair (score: ${row.Barrier_Repair}).`);
    }
  }

  if (recommendationReasons.length > 0) {
    logicSteps.push(`Determined Category: Recommended.`);
    
    console.log(`\n📋 CATEGORY EVALUATION LOGIC TRACE:`);
    logicSteps.forEach((step, idx) => console.log(`  [Step ${idx + 1}] ${step}`));
    console.log(`🎯 FINAL CATEGORY DETERMINED: Recommended\n`);

    const finalReasons = [...recommendationReasons];
    if (potentialBreakoutRisk) {
      finalReasons.push('Potential breakout risk: Contains comedogenic or exfoliating active ingredients (or high-oleic oils for oily skin), but they are in the bottom half of the ingredients list, suggesting low concentration/risk.');
    }

    return {
      category: 'Recommended',
      reasons: finalReasons,
      potentialBreakoutRisk: potentialBreakoutRisk || undefined,
      potentialBreakoutIngredients: potentialBreakoutIngredients.length > 0 ? potentialBreakoutIngredients : undefined,
      potentialBreakoutReasons: potentialBreakoutReasons.length > 0 ? potentialBreakoutReasons : undefined,
      details: getDetails()
    };
  }

  // --- SAFE DEFAULT ---
  logicSteps.push(`No direct conflict found. Determined Category: Safe.`);
  
  console.log(`\n📋 CATEGORY EVALUATION LOGIC TRACE:`);
  logicSteps.forEach((step, idx) => console.log(`  [Step ${idx + 1}] ${step}`));
  console.log(`🎯 FINAL CATEGORY DETERMINED: Safe\n`);

  const safeReasons = ['This product does not contain any known ingredients that conflict with your skin profile and is considered safe to use.'];
  if (potentialBreakoutRisk) {
    safeReasons.push('Potential breakout risk: Contains comedogenic or exfoliating active ingredients (or high-oleic oils for oily skin), but they are in the bottom half of the ingredients list, suggesting low concentration/risk.');
  }

  return {
    category: 'Safe',
    reasons: safeReasons,
    potentialBreakoutRisk: potentialBreakoutRisk || undefined,
    potentialBreakoutIngredients: potentialBreakoutIngredients.length > 0 ? potentialBreakoutIngredients : undefined,
    potentialBreakoutReasons: potentialBreakoutReasons.length > 0 ? potentialBreakoutReasons : undefined,
    details: getDetails()
  };
}
