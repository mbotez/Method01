import { supabase } from '../lib/supabase';

export type ProductMetricName =
  | 'active_antagonistic_group'
  | 'aggregated_clogging_risk'
  | 'calm_redness'
  | 'clear_blackheads'
  | 'clear_surface_breakouts'
  | 'clear_whiteheads'
  | 'contains_frag'
  | 'fade_pie'
  | 'fade_pih'
  | 'has_5alpha_inh'
  | 'has_aha_active'
  | 'has_bha_active'
  | 'has_brightening_ingredient'
  | 'has_cell_turnover_accelerator'
  | 'has_fragrance_top50'
  | 'has_high_irritation'
  | 'has_yeast_trigger'
  | 'reduce_wrinkles'
  | 'soothe_deep_breakouts'
  | 'synergy_breakout_response'
  | 'synergy_deep_breakout_penetration';

export interface ProductMetricCulprit {
  id?: number;
  product_id: number;
  product_name?: string;
  metric_name: string;
  ingredient_id?: number | null;
  position?: number | null;
  score_value?: number | null;
  ingredient_name: string;
}

export interface MetricMetadata {
  metric_name: ProductMetricName;
  category: 'benefit' | 'irritant';
  displayName: string;
  shortLabel: string;
  description: string;
  aliases: string[];
}

export const METRIC_DEFINITIONS: Record<ProductMetricName, MetricMetadata> = {
  calm_redness: {
    metric_name: 'calm_redness',
    category: 'benefit',
    displayName: 'Calms Facial Redness',
    shortLabel: 'Calms Redness',
    description: 'Actives and botanical agents that soothe erythema and reduce skin inflammation.',
    aliases: ['calms facial redness', 'calm redness', 'calms redness', 'redness', 'anti-redness']
  },
  clear_blackheads: {
    metric_name: 'clear_blackheads',
    category: 'benefit',
    displayName: 'Clears Blackheads',
    shortLabel: 'Blackheads',
    description: 'Pore-clearing and lipid-soluble actives that dissolve oxidized plugs in open comedones.',
    aliases: ['clears blackheads', 'clear blackheads', 'blackheads', 'clears pores & blemishes', 'clears pores and blemishes']
  },
  clear_surface_breakouts: {
    metric_name: 'clear_surface_breakouts',
    category: 'benefit',
    displayName: 'Clears Surface Breakouts',
    shortLabel: 'Surface Breakouts',
    description: 'Antibacterial and clarifying ingredients targeting papules and surface pustules.',
    aliases: ['clears surface breakouts', 'clear surface breakouts', 'surface breakouts', 'clears pores & blemishes', 'blemishes']
  },
  clear_whiteheads: {
    metric_name: 'clear_whiteheads',
    category: 'benefit',
    displayName: 'Clears Whiteheads',
    shortLabel: 'Whiteheads',
    description: 'Exfoliating and keratolytic agents addressing closed comedones.',
    aliases: ['clears whiteheads', 'clear whiteheads', 'whiteheads']
  },
  soothe_deep_breakouts: {
    metric_name: 'soothe_deep_breakouts',
    category: 'benefit',
    displayName: 'Soothes Deep Breakouts',
    shortLabel: 'Deep Breakouts',
    description: 'Anti-inflammatory and penetrating actives targeting cystic or deeper follicular swelling.',
    aliases: ['soothes deep breakouts', 'soothe deep breakouts', 'deep breakouts', 'cystic breakouts']
  },
  fade_pie: {
    metric_name: 'fade_pie',
    category: 'benefit',
    displayName: 'Fades Red Marks (PIE)',
    shortLabel: 'Fades PIE',
    description: 'Vascular calmers and barrier rebuilders targeting Post-Inflammatory Erythema (pink/red acne marks).',
    aliases: ['fades red marks (pie)', 'fade pie', 'fades pie', 'fade_pie', 'pie', 'post-inflammatory erythema']
  },
  fade_pih: {
    metric_name: 'fade_pih',
    category: 'benefit',
    displayName: 'Fades Dark Spots (PIH)',
    shortLabel: 'Fades PIH',
    description: 'Melanin and tyrosinase inhibitors targeting Post-Inflammatory Hyperpigmentation.',
    aliases: ['fades dark spots (pih)', 'fade pih', 'fades pih', 'fade_pih', 'pih', 'dark spots', 'fades dark spots', 'brightens skin tone & fades dark spots']
  },
  has_5alpha_inh: {
    metric_name: 'has_5alpha_inh',
    category: 'benefit',
    displayName: '5-Alpha Reductase Inhibitor',
    shortLabel: '5-Alpha Inh.',
    description: 'Inhibits sebum-stimulating 5α-reductase enzymes to curb excess facial oiliness.',
    aliases: ['5-alpha reductase inhibitor', '5alpha', '5-alpha', 'has_5alpha_inh', 'sebum inhibitor', 'oil control']
  },
  has_aha_active: {
    metric_name: 'has_aha_active',
    category: 'benefit',
    displayName: 'AHA Chemical Exfoliant',
    shortLabel: 'AHA Active',
    description: 'Water-soluble alpha hydroxy acids (e.g. glycolic, lactic) shedding surface dead cells.',
    aliases: ['aha chemical exfoliant', 'aha active', 'has_aha_active', 'aha exfoliation', 'alpha hydroxy acid']
  },
  has_bha_active: {
    metric_name: 'has_bha_active',
    category: 'benefit',
    displayName: 'BHA Active (Pore Clearing)',
    shortLabel: 'BHA Active',
    description: 'Lipid-soluble beta hydroxy acid (e.g. salicylic acid) penetrating deeply into pores.',
    aliases: ['bha active', 'bha pore clearing', 'has_bha_active', 'salicylic acid', 'beta hydroxy acid']
  },
  has_brightening_ingredient: {
    metric_name: 'has_brightening_ingredient',
    category: 'benefit',
    displayName: 'Brightens Skin Tone',
    shortLabel: 'Brightening',
    description: 'Proven complexion brighteners (e.g. niacinamide, vitamin C, licorice root, arbutin).',
    aliases: ['brightens skin tone', 'brightens skin tone & fades dark spots', 'has_brightening_ingredient', 'brightening']
  },
  has_cell_turnover_accelerator: {
    metric_name: 'has_cell_turnover_accelerator',
    category: 'benefit',
    displayName: 'Cell Turnover Accelerator',
    shortLabel: 'Cell Turnover',
    description: 'Promotes epidermal renewal and cellular turnover (e.g. retinoids, specialized peptides).',
    aliases: ['cell turnover accelerator', 'has_cell_turnover_accelerator', 'accelerates cell turnover', 'cell renewal']
  },
  reduce_wrinkles: {
    metric_name: 'reduce_wrinkles',
    category: 'benefit',
    displayName: 'Smooths Fine Lines & Wrinkles',
    shortLabel: 'Smooths Wrinkles',
    description: 'Collagen-supportive and elasticity-boosting ingredients targeting fine lines and wrinkles.',
    aliases: ['smooths fine lines & wrinkles', 'reduce wrinkles', 'reduce_wrinkles', 'anti-wrinkle', 'fine lines']
  },
  synergy_breakout_response: {
    metric_name: 'synergy_breakout_response',
    category: 'benefit',
    displayName: 'Synergy Breakout Defense',
    shortLabel: 'Synergy Breakout',
    description: 'Complementary active ingredients working together to suppress acne pathways.',
    aliases: ['synergy breakout defense', 'synergy breakout response', 'synergy_breakout_response']
  },
  synergy_deep_breakout_penetration: {
    metric_name: 'synergy_deep_breakout_penetration',
    category: 'benefit',
    displayName: 'Deep Breakout Penetration Synergy',
    shortLabel: 'Deep Penetration',
    description: 'Vehicle enhancers that drive active ingredients deeper into clogged follicles.',
    aliases: ['deep breakout penetration synergy', 'synergy_deep_breakout_penetration', 'deep breakout penetration']
  },
  active_antagonistic_group: {
    metric_name: 'active_antagonistic_group',
    category: 'irritant',
    displayName: 'Active Antagonistic Conflict',
    shortLabel: 'Active Conflict',
    description: 'High-potency actives that may destabilize each other or overtax delicate skin when layered.',
    aliases: ['active antagonistic conflict', 'active antagonistic group', 'active_antagonistic_group', 'active conflict']
  },
  aggregated_clogging_risk: {
    metric_name: 'aggregated_clogging_risk',
    category: 'irritant',
    displayName: 'Pore Clogging Risk',
    shortLabel: 'Clogging Risk',
    description: 'Comedogenic emollients or heavy waxes that carry a cumulative risk of blocking pores.',
    aliases: ['pore clogging risk', 'aggregated clogging risk', 'aggregated_clogging_risk', 'clogging risk', 'comedogenic']
  },
  contains_frag: {
    metric_name: 'contains_frag',
    category: 'irritant',
    displayName: 'Contains Fragrance',
    shortLabel: 'Fragrance',
    description: 'Synthetic perfumes or sensitizing fragrance compounds that may trigger contact allergies.',
    aliases: ['contains fragrance', 'contains_frag', 'fragrance', 'perfume', 'parfum']
  },
  has_fragrance_top50: {
    metric_name: 'has_fragrance_top50',
    category: 'irritant',
    displayName: 'Fragrance in Top 50 Ingredients',
    shortLabel: 'High Fragrance',
    description: 'Fragrance or essential oils located high up in the formulation indicating notable concentration.',
    aliases: ['fragrance in top 50 ingredients', 'has_fragrance_top50', 'fragrance top 50', 'contains fragrance']
  },
  has_high_irritation: {
    metric_name: 'has_high_irritation',
    category: 'irritant',
    displayName: 'High Irritation Risk',
    shortLabel: 'High Irritation',
    description: 'High-strength acids, drying alcohols, or reactive compounds that can cause burning or peeling.',
    aliases: ['high irritation risk', 'has_high_irritation', 'high irritation', 'irritation risk']
  },
  has_yeast_trigger: {
    metric_name: 'has_yeast_trigger',
    category: 'irritant',
    displayName: 'Yeast-induced Breakout Trigger',
    shortLabel: 'Yeast Trigger',
    description: 'Lipids, fatty acids, or esters that feed Malassezia yeast (associated with fungal acne).',
    aliases: ['yeast-induced breakout trigger', 'has_yeast_trigger', 'malassezia trigger', 'fungal acne trigger']
  }
};

/**
 * Normalizes text for matching
 */
function normalizeKey(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Returns matching metric_names for a given UI flag text (case-insensitive & alias-aware).
 */
export function findMetricsForFlag(flagText: string): ProductMetricName[] {
  if (!flagText) return [];
  const normalized = normalizeKey(flagText);

  // Exact match on metric_name
  if (normalized in METRIC_DEFINITIONS) {
    return [normalized as ProductMetricName];
  }

  const matched: ProductMetricName[] = [];
  for (const def of Object.values(METRIC_DEFINITIONS)) {
    if (normalizeKey(def.metric_name) === normalized || normalizeKey(def.displayName) === normalized || normalizeKey(def.shortLabel) === normalized) {
      matched.push(def.metric_name);
      continue;
    }
    for (const alias of def.aliases) {
      const normAlias = normalizeKey(alias);
      if (normAlias === normalized || (normAlias.length > 5 && normalized.includes(normAlias)) || (normalized.length > 5 && normAlias.includes(normalized))) {
        if (!matched.includes(def.metric_name)) {
          matched.push(def.metric_name);
        }
      }
    }
  }

  // Fallback checks for combined flags
  if (matched.length === 0) {
    if (normalized.includes('redness')) matched.push('calm_redness');
    if (normalized.includes('wrinkle') || normalized.includes('fineline')) matched.push('reduce_wrinkles');
    if (normalized.includes('bright') || normalized.includes('darkspot')) {
      matched.push('has_brightening_ingredient', 'fade_pih', 'fade_pie');
    }
    if (normalized.includes('pore') || normalized.includes('blemish') || normalized.includes('breakout')) {
      matched.push('clear_blackheads', 'clear_surface_breakouts', 'clear_whiteheads', 'soothe_deep_breakouts', 'has_bha_active', 'has_aha_active');
    }
    if (normalized.includes('fragrance') || normalized.includes('frag')) {
      matched.push('contains_frag', 'has_fragrance_top50');
    }
    if (normalized.includes('yeast') || normalized.includes('malassezia')) matched.push('has_yeast_trigger');
    if (normalized.includes('irritation')) matched.push('has_high_irritation');
    if (normalized.includes('clog')) matched.push('aggregated_clogging_risk');
  }

  return Array.from(new Set(matched));
}

/**
 * Fetches all culprit ingredients for a product from the product_metric_culprits table.
 */
export async function fetchProductCulprits(productId: string | number): Promise<{
  culprits: ProductMetricCulprit[];
  error: any;
}> {
  if (!productId) return { culprits: [], error: null };
  const numericId = typeof productId === 'number' ? productId : parseInt(productId, 10);
  const targetId = !isNaN(numericId) ? numericId : productId;

  try {
    const { data, error } = await supabase
      .from('product_metric_culprits')
      .select('id, product_id, product_name, metric_name, ingredient_id, position, score_value, ingredient_name')
      .eq('product_id', targetId);

    if (error) {
      return { culprits: [], error };
    }

    return { culprits: (data || []) as ProductMetricCulprit[], error: null };
  } catch (err) {
    return { culprits: [], error: err };
  }
}

/**
 * Filters the list of culprits for a specific flag label.
 */
export function getCulpritsForFlag(
  flagText: string,
  allCulprits: ProductMetricCulprit[]
): {
  metrics: ProductMetricName[];
  matchedCulprits: ProductMetricCulprit[];
} {
  const metrics = findMetricsForFlag(flagText);
  if (!allCulprits || allCulprits.length === 0) {
    return { metrics, matchedCulprits: [] };
  }

  // Filter culprits matching any of the resolved metrics, or direct string match on metric_name
  const matched = allCulprits.filter((c) => {
    if (!c.metric_name) return false;
    const normMetric = normalizeKey(c.metric_name);
    return (
      metrics.some((m) => normalizeKey(m) === normMetric) ||
      normMetric === normalizeKey(flagText)
    );
  });

  // Deduplicate by ingredient_name + metric_name
  const uniqueMap = new Map<string, ProductMetricCulprit>();
  for (const item of matched) {
    const key = `${(item.ingredient_name || '').toLowerCase()}_${item.metric_name}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  const result = Array.from(uniqueMap.values());
  // Sort primarily by position (earlier in list is higher concentration)
  result.sort((a, b) => {
    if (a.position != null && b.position != null) return a.position - b.position;
    if (a.position != null) return -1;
    if (b.position != null) return 1;
    return (b.score_value || 0) - (a.score_value || 0);
  });

  return {
    metrics,
    matchedCulprits: result
  };
}
