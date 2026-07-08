import { supabase } from '../lib/supabase';

export type Category = 'Avoid' | 'Safe' | 'Goodie';
export type BarrierLevel = 'low' | 'medium' | 'high';

export interface EvaluationResult {
  category: Category;
  reasons: string[];        // User-facing explanations of the gating verdict
  logicTrace: string[];     // Debug trace showing which specific gate was hit
  route: number | null;
  barrierLevel: BarrierLevel | null;
  warnings: {
    fungalAcneWarning: boolean;
    comedogenicWarning: boolean;
    occlusiveWarning: boolean;
    irritationWarning: boolean;
    pmOnly: boolean;
    isPrescription: boolean;
    antagonistGroup: string;
  };
  details: {
    userId: string;
    productId: string;
    userProfileFound: boolean;
    productFound: boolean;
  };
}

interface UserProfileRow {
  skin_type: 'dry' | 'oily' | 'combination' | null;
  barrier_risk: number | null;
  burn_risk: 'low' | 'medium' | 'high' | null;
  new_product_reaction: number | null;
  main_concern: number | null;
  scnd_concern: number | null;
  breakout_type: number[] | string | null;
  scan_acne_type: number[] | string | null;
  pregnant: string | boolean | null;
  age: number | null;
  actives_used: number | null;
  env: number | null;
}

interface ProductScoreRow {
  product_id: number;
  cat1: string | null;
  cat2: 'Cleanser' | 'Treatment' | 'Moisturiser' | 'SPF' | 'Targeted' | null;
  cat3: number | null;
  disc: string | null;
  skin_types_to_avoid: string | null;
  pregnancy_safe: boolean | null;
  barrier_states_to_avoid: number | null;
  vehicle: number | null;
  viscosity: number | null;
  liposomal: string | null;
  reg_type: number | null;

  // Derived Indicators & Actives
  aggregated_clogging_risk: number | null;
  fatty_acid_mismatch: boolean | null;
  has_bha_active: boolean | null;
  has_antibacterial_active: boolean | null;
  has_5alpha_reductase_inhibitor: boolean | null;
  has_vascular_calmer: boolean | null;
  has_melanin_inhibitor: boolean | null;
  uv_sensitivity_required: boolean | null;
  active_antagonistic_group: string | null;

  // Performance Metric Columns (-5 to +5)
  barrier_repair_dry_skin: number | null;
  barrier_repair_oily_skin: number | null;
  barrier_repair_combi_skin: number | null;
  hydration_dry_skin: number | null;
  hydration_oily_skin: number | null;
  hydration_combi_skin: number | null;
  oil_control: number | null;
  calm_redness_dry_skin: number | null;
  calm_redness_oily_skin: number | null;
  calm_redness_combi_skin: number | null;
  clear_blackheads: number | null;
  clear_whiteheads: number | null;
  clear_surface_acne: number | null;
  soothe_deep_acne: number | null;
  fade_pie: number | null;
  fade_pih: number | null;
  reduce_wrinkles: number | null;
  has_brightening_ingredient: boolean | null;

  // Flag Exclusions
  has_fungal_trigger: boolean | null;
  has_fragrance_top50: boolean | null;
  has_high_irritation: boolean | null;
}

// Helper to safely cast database numbers
const n = (v: number | null | undefined, fallback = 0): number =>
  v === null || v === undefined ? fallback : Number(v);

function parseIntArray(raw: number[] | string | null): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => Number(x)).filter((x) => !Number.isNaN(x));
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => Number(x)).filter((x) => !Number.isNaN(x));
  } catch {}
  const single = Number(raw);
  return Number.isNaN(single) ? [] : [single];
}

export async function evaluateProductCategory(
  userId: string,
  productId: string
): Promise<EvaluationResult> {
  const baseDetails = { userId, productId, userProfileFound: false, productFound: false };
  const trace: string[] = [];
  const reasons: string[] = [];

  trace.push(`Initializing Gating Architecture for verification.`);

  // --- Parallel Supabase Query Fetch ---
  const [{ data: userProfile, error: userErr }, { data: product, error: productErr }] =
    await Promise.all([
      supabase
        .from('user_profile')
        .select('*')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('product_scores')
        .select('*')
        .eq('product_id', parseInt(productId, 10))
        .maybeSingle(),
    ]);

  if (userErr) console.error('user_profile query failure:', userErr);
  if (productErr) console.error('product_scores query failure:', productErr);

  if (!product) {
    trace.push('Aborting: Target product not found.');
    return {
      category: 'Safe',
      reasons: ['Product payload missing. Baseline assignment enforced.'],
      logicTrace: trace,
      route: null,
      barrierLevel: null,
      warnings: { fungalAcneWarning: false, comedogenicWarning: false, occlusiveWarning: false, irritationWarning: false, pmOnly: false, isPrescription: false, antagonistGroup: 'None' },
      details: baseDetails,
    };
  }

  const pRow = product as unknown as ProductScoreRow;
  const uRow = (userProfile ?? null) as UserProfileRow | null;
  const details = { ...baseDetails, userProfileFound: !!uRow, productFound: true };

  // --- Dynamic Parameter Extraction ---
  const skinType = uRow?.skin_type ?? 'combination';
  const mainConcern = uRow?.main_concern ?? null;
  const scndConcern = uRow?.scnd_concern ?? null;
  const isPregnant = uRow?.pregnant === 'Yes' || uRow?.pregnant === true;

  // Determine effective barrier thresholds
  const rawBarrierRisk = n(uRow?.barrier_risk, 0);
  const effectiveBarrierRisk = uRow?.new_product_reaction === 3 ? 8 : rawBarrierRisk;
  const barrierLevel: BarrierLevel = effectiveBarrierRisk <= 3 ? 'low' : effectiveBarrierRisk <= 6 ? 'medium' : 'high';
  const route = barrierLevel === 'high' ? 1 : 2;

  // Build merged unified array for active acne types
  const breakoutArr = parseIntArray(uRow?.breakout_type);
  const scanAcneArr = parseIntArray(uRow?.scan_acne_type);
  const activeBreakouts = Array.from(new Set([...breakoutArr, ...scanAcneArr]));

  // =========================================================================
  // GATE 1: SAFETY EXCLUSIONS (AVOID GATE)
  // =========================================================================
  trace.push('Evaluating Gate 1: Safety Exclusions...');

  if (pRow.disc === 'y') {
    trace.push('Gate 1 Fail: Product is discontinued.');
    return { category: 'Avoid', reasons: ['Product is discontinued.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
  }

  if (skinType && pRow.skin_types_to_avoid === skinType) {
    trace.push(`Gate 1 Fail: Explicit avoid match for skin type: ${skinType}`);
    return { category: 'Avoid', reasons: [`Formulated to avoid ${skinType} skin conditions.`], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
  }

  if (isPregnant && pRow.pregnancy_safe === false) {
    trace.push('Gate 1 Fail: Pregnancy risk mismatch.');
    return { category: 'Avoid', reasons: ['Contains ingredients flagged unsafe during pregnancy.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
  }

  if ((barrierLevel === 'high' && pRow.barrier_states_to_avoid === 2) || 
      (barrierLevel === 'medium' && pRow.barrier_states_to_avoid === 1)) {
    trace.push(`Gate 1 Fail: Structural barrier integrity conflict. Level: ${barrierLevel}`);
    return { category: 'Avoid', reasons: [`Unsuitable for a vulnerable skin barrier (${barrierLevel} risk).`], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
  }

  if ((mainConcern === 11 || scndConcern === 11) && pRow.has_fungal_trigger === true) {
    trace.push('Gate 1 Fail: Active fungal acne trigger detected.');
    return { category: 'Avoid', reasons: ['Contains components known to exacerbate fungal breakout clusters.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
  }

  if ((mainConcern === 2 || mainConcern === 10) && pRow.has_high_irritation === true) {
    trace.push('Gate 1 Fail: Active high irritation risk conflicts with vascular/eczema profile.');
    return { category: 'Avoid', reasons: ['High irritation profile conflicts with active eczema/redness state.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
  }

  // =========================================================================
  // GATE 2: BASE VEHICLE COMPATIBILITY (SAFE GATE)
  // =========================================================================
  trace.push(`Evaluating Gate 2: Base Vehicle Compatibility for skin_type="${skinType}"`);

  if (skinType === 'oily' || skinType === 'combination') {
    if (n(pRow.aggregated_clogging_risk) < 0) {
      trace.push('Gate 2 Fail: Comedogenic load baseline check failed.');
      return { category: 'Avoid', reasons: ['Pore-clogging risk score violates safety index rules for sebum retention.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
    }
    if (pRow.fatty_acid_mismatch === true) {
      trace.push('Gate 2 Fail: Excessive free high-oleic lipids matched against active sebum lines.');
      return { category: 'Avoid', reasons: ['Lipid structure is inappropriate for high sebum production zones.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
    }
    if (pRow.vehicle === 3 || pRow.vehicle === 4) {
      trace.push('Gate 2 Fail: Emulsion matrix weight violation (Water-in-Oil / Anhydrous).');
      return { category: 'Avoid', reasons: ['Heavy occlusive formulation type traps sebum across oily skin profiles.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
    }
    if (n(pRow.viscosity) >= 4) {
      trace.push('Gate 2 Fail: Texture density limits exceeded.');
      return { category: 'Avoid', reasons: ['Rich cream/ointment texture is structurally too heavy for your skin type.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
    }
  }

  if (skinType === 'dry') {
    if (n(pRow.oil_control) > 2 && pRow.cat2 === 'Moisturiser') {
      trace.push('Gate 2 Fail: Matched over-stripping oil-control asset inside lipid barrier cream layer.');
      return { category: 'Avoid', reasons: ['Moisturizer includes aggressive sebum-reduction agents unfit for dry skin.'], logicTrace: trace, route, barrierLevel, warnings: getWarnings(skinType, barrierLevel, pRow), details };
    }
  }

  trace.push('Passed Safety and Core Compatibility. Core status: Safe.');

  // =========================================================================
  // GATE 3: EFFICACY ALIGNMENT (GOODIE GATE)
  // =========================================================================
  trace.push('Evaluating Gate 3: Concern Targets (Goodie Eligibility Status Checking)');

  // Dynamic Skin Type Mapping Utilities for Column Selection
  const suffix = skinType === 'dry' ? 'dry_skin' : skinType === 'oily' ? 'oily_skin' : 'combi_skin';
  const barrierScore = n(pRow[`barrier_repair_${suffix}` as keyof ProductScoreRow] as number);
  const hydrationScore = n(pRow[`hydration_${suffix}` as keyof ProductScoreRow] as number);
  const rednessScore = n(pRow[`calm_redness_${suffix}` as keyof ProductScoreRow] as number);

  function evaluateConcernTarget(concernCode: number | null): boolean {
    if (!concernCode) return false;

    switch (concernCode) {
      case 1: // Acne & Scars Matrix
        if (activeBreakouts.includes(1) && n(pRow.clear_blackheads) >= 3) return true;
        if (activeBreakouts.includes(2) && n(pRow.clear_whiteheads) >= 3) return true;
        if ((activeBreakouts.includes(5) || activeBreakouts.includes(7)) && n(pRow.clear_surface_acne) >= 3) return true;
        if ((activeBreakouts.includes(6) || activeBreakouts.includes(8) || activeBreakouts.includes(9)) && n(pRow.soothe_deep_acne) >= 3) return true;
        if (activeBreakouts.includes(3) && n(pRow.fade_pie) >= 3) return true;
        if (activeBreakouts.includes(4) && n(pRow.fade_pih) >= 3) return true;
        return false;
      case 2: // Redness
        return rednessScore >= 3;
      case 3: // Dark Spots
        return n(pRow.fade_pih) >= 3 || pRow.has_brightening_ingredient === true;
      case 4: // Dullness
        return pRow.has_brightening_ingredient === true;
      case 5: // Dryness
        return hydrationScore >= 3;
      case 6: // Oiliness
        return n(pRow.oil_control) >= 3;
      case 7: // Wrinkles & Fine Lines
        return n(pRow.reduce_wrinkles) >= 3;
      case 8: // Pores & Texture
        return n(pRow.clear_blackheads) >= 3 || n(pRow.oil_control) >= 3;
      case 9: // Sensitivity
        return rednessScore >= 3 && barrierScore >= 3;
      case 10: // Eczema
        return barrierScore >= 3;
      case 11: // Fungal Acne Verification pass
        return pRow.has_fungal_trigger === false && pRow.cat2 === 'Treatment';
      default:
        return false;
    }
  }

  const primaryMatch = evaluateConcernTarget(mainConcern);
  const secondaryMatch = evaluateConcernTarget(scndConcern);

  if (primaryMatch || secondaryMatch) {
    trace.push(`Gate 3 Pass! Product elevated to Goodie. PrimaryMatch=${primaryMatch}, SecondaryMatch=${secondaryMatch}`);
    reasons.push('Strong therapeutic composition alignment with active skin target priorities.');
    return {
      category: 'Goodie',
      reasons,
      logicTrace: trace,
      route,
      barrierLevel,
      warnings: getWarnings(skinType, barrierLevel, pRow),
      details
    };
  }

  // --- Fallback State Verification ---
  reasons.push('Passed standard safety evaluations but lacks strong performance signals targeting primary profiles.');
  return {
    category: 'Safe',
    reasons,
    logicTrace: trace,
    route,
    barrierLevel,
    warnings: getWarnings(skinType, barrierLevel, pRow),
    details
  };
}

// Separate routine block calculating informational user dashboard warnings
function getWarnings(skinType: string, barrierLevel: BarrierLevel, pRow: ProductScoreRow) {
  return {
    fungalAcneWarning: pRow.has_fungal_trigger === true,
    comedogenicWarning: n(pRow.aggregated_clogging_risk) > 1,
    occlusiveWarning: skinType === 'oily' && (pRow.vehicle === 3 || pRow.vehicle === 4 || n(pRow.viscosity) >= 4),
    irritationWarning: (skinType === 'dry' || barrierLevel === 'medium' || barrierLevel === 'high') && pRow.has_high_irritation === true,
    pmOnly: pRow.uv_sensitivity_required === true,
    isPrescription: pRow.reg_type === 3,
    antagonistGroup: pRow.active_antagonistic_group ?? 'None',
  };
}