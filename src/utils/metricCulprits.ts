/**
 * Metric culprits utility for mapping individual product_metric_culprits table rows
 * to existing Key Benefits and Potential Irritants flags in the product card.
 */

export interface MetricCulprit {
  id?: number;
  product_id: number;
  product_name?: string;
  metric_name: string;
  ingredient_id?: number;
  position?: number;
  score_value?: number;
  ingredient_name: string;
}

export interface DeduplicatedIngredient {
  name: string;
  position?: number;
  score_value?: number;
  metrics: string[];
}

/**
 * Maps existing flag names to individual metric_name values stored in product_metric_culprits.
 * No new flags are introduced; only mapped to existing Key Benefits and Potential Irritants.
 */
export const FLAG_TO_METRIC_NAMES: Record<string, string[]> = {
  // Key Benefits
  'Clears pores & blemishes': [
    'clear_blackheads',
    'clear_whiteheads',
    'clear_surface_breakouts',
    'soothe_deep_breakouts',
    'has_bha_active',
    'has_5alpha_inh',
    'synergy_breakout_response',
    'synergy_deep_breakout_penetration',
    'has_aha_active'
  ],
  'Calms facial redness': [
    'calm_redness',
    'fade_pie'
  ],
  'Repairs skin barrier': [
    'repair_barrier'
  ],
  'Deep hydration': [
    'deep_hydration'
  ],
  'Brightens skin tone & fades dark spots': [
    'has_brightening_ingredient',
    'fade_pih',
    'fade_pie'
  ],
  'Smooths fine lines & wrinkles': [
    'reduce_wrinkles',
    'has_cell_turnover_accelerator',
    'has_aha_active'
  ],

  // Potential Irritants
  'Contains Fragrance': [
    'contains_frag',
    'has_fragrance_top50'
  ],
  'Yeast-induced Breakout Trigger': [
    'has_yeast_trigger'
  ],
  'High Irritation Risk': [
    'has_high_irritation',
    'active_antagonistic_group',
    'aggregated_clogging_risk'
  ]
};

/**
 * Returns the mapped metric_name array for a given flag string with case-insensitive and partial matching support.
 */
export function getMetricsForFlag(flag: string): string[] {
  if (!flag) return [];
  if (FLAG_TO_METRIC_NAMES[flag]) return FLAG_TO_METRIC_NAMES[flag];

  const lower = flag.toLowerCase().trim();
  for (const [key, metrics] of Object.entries(FLAG_TO_METRIC_NAMES)) {
    if (lower === key.toLowerCase()) return metrics;
  }

  if (lower.includes('barrier')) return FLAG_TO_METRIC_NAMES['Repairs skin barrier'];
  if (lower.includes('hydrat')) return FLAG_TO_METRIC_NAMES['Deep hydration'];
  if (lower.includes('redness')) return FLAG_TO_METRIC_NAMES['Calms facial redness'];
  if (
    lower.includes('pore') ||
    lower.includes('blemish') ||
    lower.includes('blackhead') ||
    lower.includes('whitehead') ||
    lower.includes('breakout')
  ) {
    return FLAG_TO_METRIC_NAMES['Clears pores & blemishes'];
  }
  if (lower.includes('wrinkle') || lower.includes('fine line') || lower.includes('smooth')) {
    return FLAG_TO_METRIC_NAMES['Smooths fine lines & wrinkles'];
  }
  if (lower.includes('bright') || lower.includes('dark spot') || lower.includes('fade')) {
    return FLAG_TO_METRIC_NAMES['Brightens skin tone & fades dark spots'];
  }
  if (lower.includes('fragrance') || lower.includes('fragran') || lower.includes('parfum')) {
    return FLAG_TO_METRIC_NAMES['Contains Fragrance'];
  }
  if (lower.includes('yeast') || lower.includes('fungal') || lower.includes('malassezia')) {
    return FLAG_TO_METRIC_NAMES['Yeast-induced Breakout Trigger'];
  }
  if (
    lower.includes('irritan') ||
    lower.includes('irritat') ||
    lower.includes('clog') ||
    lower.includes('antagonistic')
  ) {
    return FLAG_TO_METRIC_NAMES['High Irritation Risk'];
  }

  return [];
}

/**
 * Fallback pattern mapping to detect key active ingredients directly from formula ingredients
 * when the product_metric_culprits database table is currently unpopulated (0 rows).
 */
const INGREDIENT_FALLBACK_PATTERNS: Record<string, string[]> = {
  'Repairs skin barrier': [
    'ceramide',
    'cholesterol',
    'phytosphingosine',
    'squalane',
    'urea',
    'linoleic acid',
    'phospholipid',
    'fatty acid',
    'panthenol',
    'ectoin'
  ],
  'Deep hydration': [
    'hyaluronic acid',
    'sodium hyaluronate',
    'glycerin',
    'polyglutamic acid',
    'beta-glucan',
    'panthenol',
    'trehalose',
    'urea',
    'betaine',
    'tremella',
    'sodium pca',
    'butylene glycol',
    'propanediol'
  ],
  'Calms facial redness': [
    'centella',
    'madecassoside',
    'asiaticoside',
    'allantoin',
    'panthenol',
    'bisabolol',
    'camellia sinensis',
    'green tea',
    'licorice',
    'glycyrrhiza',
    'dipotassium glycyrrhizate',
    'azelaic acid',
    'oatmeal',
    'beta-glucan',
    'artemisia',
    'mugwort',
    'chamomilla',
    'niacinamide'
  ],
  'Clears pores & blemishes': [
    'salicylic acid',
    'salicylate',
    'willow bark',
    'glycolic acid',
    'lactic acid',
    'mandelic acid',
    'gluconolactone',
    'zinc pca',
    'tea tree',
    'melaleuca',
    'niacinamide',
    'sulfur',
    'benzoyl peroxide'
  ],
  'Smooths fine lines & wrinkles': [
    'retinol',
    'retinal',
    'retinyl',
    'bakuchiol',
    'peptide',
    'matrixyl',
    'tripeptide',
    'hexapeptide',
    'adenosine',
    'glycolic acid',
    'lactic acid'
  ],
  'Brightens skin tone & fades dark spots': [
    'ascorbic acid',
    'ascorbyl',
    'vitamin c',
    'arbutin',
    'tranexamic acid',
    'kojic acid',
    'azelaic acid',
    'niacinamide',
    'licorice',
    'glabridin'
  ],
  'Contains Fragrance': [
    'fragrance',
    'parfum',
    'limonene',
    'linalool',
    'citronellol',
    'geraniol',
    'eugenol',
    'citral',
    'benzyl alcohol',
    'benzyl benzoate',
    'lavandula',
    'lavender',
    'citrus',
    'essential oil'
  ],
  'Yeast-induced Breakout Trigger': [
    'polysorbate',
    'sorbitan',
    'isopropyl palmitate',
    'isopropyl myristate',
    'ethylhexyl palmitate',
    'glyceryl stearate',
    'peg-100 stearate',
    'cetyl alcohol',
    'cetearyl alcohol',
    'stearic acid',
    'lauric acid',
    'myristic acid',
    'oleic acid',
    'palmitic acid',
    'galactomyces',
    'ferment'
  ],
  'High Irritation Risk': [
    'alcohol denat',
    'denatured alcohol',
    'essential oil',
    'salicylic acid',
    'glycolic acid',
    'lactic acid',
    'sodium lauryl sulfate',
    'citrus',
    'menthol',
    'camphor'
  ]
};

export interface ResolvedCulprits {
  ingredients: DeduplicatedIngredient[];
  source: 'database' | 'formula_fallback';
}

/**
 * Resolves culprit ingredients for a selected flag.
 * 1. Checks if database culprits from `product_metric_culprits` exist.
 * 2. If no DB records exist (e.g. table has 0 rows), scans the product's actual ingredient list.
 */
export function resolveCulpritsForFlag(
  flag: string,
  dbCulprits: MetricCulprit[],
  rawIngredients?: string[] | string
): ResolvedCulprits {
  const metrics = getMetricsForFlag(flag);
  const matchingDb = dbCulprits.filter(c => metrics.includes(c.metric_name));

  if (matchingDb.length > 0) {
    return {
      ingredients: deduplicateCulprits(matchingDb),
      source: 'database'
    };
  }

  // Fallback: detect matching active ingredients directly from product formula
  if (!rawIngredients) {
    return { ingredients: [], source: 'database' };
  }

  const ingList: string[] = Array.isArray(rawIngredients)
    ? rawIngredients
    : String(rawIngredients)
        .split(/[,;\n]/)
        .map(s => s.trim())
        .filter(Boolean);

  if (ingList.length === 0) {
    return { ingredients: [], source: 'database' };
  }

  const matchedPatterns: string[] = [];
  const lowerFlag = flag.toLowerCase().trim();

  for (const [key, patterns] of Object.entries(INGREDIENT_FALLBACK_PATTERNS)) {
    if (lowerFlag.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerFlag)) {
      matchedPatterns.push(...patterns);
    }
  }

  if (matchedPatterns.length === 0) {
    if (lowerFlag.includes('barrier')) matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['Repairs skin barrier']);
    else if (lowerFlag.includes('hydrat')) matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['Deep hydration']);
    else if (lowerFlag.includes('redness')) matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['Calms facial redness']);
    else if (lowerFlag.includes('pore') || lowerFlag.includes('blemish') || lowerFlag.includes('breakout')) {
      matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['Clears pores & blemishes']);
    } else if (lowerFlag.includes('wrinkle') || lowerFlag.includes('line')) {
      matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['Smooths fine lines & wrinkles']);
    } else if (lowerFlag.includes('bright') || lowerFlag.includes('spot')) {
      matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['Brightens skin tone & fades dark spots']);
    } else if (lowerFlag.includes('fragran') || lowerFlag.includes('parfum')) {
      matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['Contains Fragrance']);
    } else if (lowerFlag.includes('yeast') || lowerFlag.includes('fungal')) {
      matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['Yeast-induced Breakout Trigger']);
    } else if (lowerFlag.includes('irritan') || lowerFlag.includes('clog')) {
      matchedPatterns.push(...INGREDIENT_FALLBACK_PATTERNS['High Irritation Risk']);
    }
  }

  const foundIngredients: DeduplicatedIngredient[] = [];
  const seen = new Set<string>();

  ingList.forEach((ing, index) => {
    const cleanIng = ing.trim();
    if (!cleanIng) return;
    const lowerIng = cleanIng.toLowerCase();

    for (const pat of matchedPatterns) {
      if (lowerIng.includes(pat) && !seen.has(lowerIng)) {
        seen.add(lowerIng);
        foundIngredients.push({
          name: cleanIng,
          position: index + 1,
          metrics: metrics.length > 0 ? metrics : [pat]
        });
        break;
      }
    }
  });

  return {
    ingredients: foundIngredients,
    source: foundIngredients.length > 0 ? 'formula_fallback' : 'database'
  };
}

/**
 * Deduplicates ingredient rows for a specific product and flag, preserving position order.
 */
export function deduplicateCulprits(matchingRows: MetricCulprit[]): DeduplicatedIngredient[] {
  const map = new Map<string, DeduplicatedIngredient>();

  for (const row of matchingRows) {
    if (!row.ingredient_name) continue;
    const cleanName = row.ingredient_name.trim();
    if (!cleanName) continue;
    const key = cleanName.toLowerCase();

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        name: cleanName,
        position: row.position ?? undefined,
        score_value:
          row.score_value !== undefined && row.score_value !== null ? Number(row.score_value) : undefined,
        metrics: [row.metric_name]
      });
    } else {
      if (!existing.metrics.includes(row.metric_name)) {
        existing.metrics.push(row.metric_name);
      }
      if (existing.position === undefined && row.position !== undefined && row.position !== null) {
        existing.position = row.position;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    if (a.position !== undefined) return -1;
    if (b.position !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
}
