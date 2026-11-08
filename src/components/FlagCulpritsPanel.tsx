import React from 'react';
import { CheckCircle2, AlertTriangle, X, Loader2, Sparkles, AlertCircle, Database, HelpCircle } from 'lucide-react';
import {
  ProductMetricCulprit,
  ProductMetricName,
  METRIC_DEFINITIONS,
  getCulpritsForFlag
} from '../utils/productMetricCulprits';

interface FlagCulpritsPanelProps {
  flag: string;
  productId: string | number;
  productIngredients?: string | string[];
  culprits: ProductMetricCulprit[];
  loading: boolean;
  error?: any;
  onClose: () => void;
}

export const FlagCulpritsPanel: React.FC<FlagCulpritsPanelProps> = ({
  flag,
  productId,
  productIngredients,
  culprits,
  loading,
  error,
  onClose
}) => {
  const { metrics, matchedCulprits } = getCulpritsForFlag(flag, culprits);

  // Determine if this flag is primarily a benefit or an irritant
  const isIrritant = metrics.some((m) => METRIC_DEFINITIONS[m]?.category === 'irritant');
  const primaryMetricKey = metrics.length > 0 ? metrics[0] : null;
  const primaryMetric = primaryMetricKey ? METRIC_DEFINITIONS[primaryMetricKey] : null;

  // Derive raw ingredients list for heuristic fallback if table returned no rows
  const rawList: string[] = Array.isArray(productIngredients)
    ? productIngredients
    : typeof productIngredients === 'string'
    ? productIngredients.split(/,\s*/)
    : [];

  const heuristicFallbackIngredients = React.useMemo(() => {
    if (matchedCulprits.length > 0 || rawList.length === 0 || metrics.length === 0) return [];
    const found: string[] = [];

    const testMatch = (pattern: RegExp) => {
      for (const ing of rawList) {
        if (pattern.test(ing) && !found.includes(ing.trim())) {
          found.push(ing.trim());
        }
      }
    };

    for (const m of metrics) {
      if (m === 'calm_redness') testMatch(/(centella|cica|madecassoside|asiaticoside|allantoin|panthenol|camellia sinensis|green tea|mugwort|artemisia|licorice|glycyrrhiza|bisabolol)/i);
      if (m === 'clear_blackheads' || m === 'has_bha_active') testMatch(/(salicylic acid|betaine salicylate|willow bark)/i);
      if (m === 'has_aha_active' || m === 'clear_whiteheads') testMatch(/(glycolic acid|lactic acid|mandelic acid|citric acid|tartaric acid|malic acid)/i);
      if (m === 'has_brightening_ingredient' || m === 'fade_pih' || m === 'fade_pie') testMatch(/(niacinamide|ascorbic acid|vitamin c|arbutin|tranexamic acid|kojic acid|licorice|tetrahexyldecyl)/i);
      if (m === 'reduce_wrinkles' || m === 'has_cell_turnover_accelerator') testMatch(/(retinol|retinal|bakuchiol|peptide|palmitoyl|adenosine|copper tripeptide)/i);
      if (m === 'contains_frag' || m === 'has_fragrance_top50') testMatch(/(fragrance|parfum|linalool|limonene|citronellol|geraniol|eugenol|citral)/i);
      if (m === 'has_yeast_trigger') testMatch(/(polysorbate|stearate|palmitate|myristate|ferment|galactomyces)/i);
      if (m === 'has_high_irritation') testMatch(/(alcohol denat|sodium hydroxide|fragrance|parfum|menthol|eucalyptus)/i);
      if (m === 'aggregated_clogging_risk') testMatch(/(ethylhexyl palmitate|isopropyl myristate|coconut oil|cocos nucifera|cetearyl alcohol)/i);
      if (m === 'has_5alpha_inh') testMatch(/(zinc|saw palmetto|green tea|epigallocatechin|azelaic acid)/i);
    }

    return found;
  }, [matchedCulprits.length, rawList, metrics]);

  return (
    <div
      className={`rounded-2xl p-4 my-2 border transition-all duration-200 animate-in fade-in-50 zoom-in-95 ${
        isIrritant
          ? 'bg-amber-50/80 border-amber-200/90 text-amber-950 shadow-xs'
          : 'bg-purple-50/80 border-purple-200/90 text-purple-950 shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b pb-2.5 border-black/5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`p-1.5 rounded-lg flex items-center justify-center ${
              isIrritant ? 'bg-amber-200 text-amber-800' : 'bg-purple-200 text-purple-800'
            }`}
          >
            {isIrritant ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          </span>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-black">
                {flag}
              </span>
              <span
                className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                  isIrritant ? 'bg-amber-200/80 text-amber-900' : 'bg-purple-200/80 text-purple-900'
                }`}
              >
                {isIrritant ? 'Potential Irritant Flag' : 'Key Benefit Flag'}
              </span>
            </div>
            {metrics.length > 0 && (
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <span className="text-[9px] text-gray-400 font-mono">metric_name:</span>
                {metrics.map((m) => (
                  <span
                    key={m}
                    className="text-[9px] font-mono bg-white px-1.5 py-0.2 rounded border border-black/10 text-gray-700"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-black hover:bg-black/5 transition cursor-pointer flex-shrink-0"
          title="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Flag / Metric Description */}
      {primaryMetric?.description && (
        <p className="text-[11px] text-gray-600 leading-snug pt-2">
          {primaryMetric.description}
        </p>
      )}

      {/* Culprit Ingredients Content */}
      <div className="mt-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Retrieving ingredients from product_metric_culprits...</span>
          </div>
        ) : matchedCulprits.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" />
                Associated Ingredients from product_metric_culprits ({matchedCulprits.length})
              </span>
              <span className="text-[9px] font-mono text-gray-400">product_id: {productId}</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {matchedCulprits.map((culprit, idx) => (
                <div
                  key={culprit.id || `${culprit.ingredient_name}-${idx}`}
                  className="p-2 bg-white rounded-xl border border-black/5 shadow-2xs hover:border-black/15 transition-all flex items-start justify-between gap-2"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-gray-900 break-words leading-tight">
                      {culprit.ingredient_name}
                    </span>
                    {metrics.length > 1 && culprit.metric_name && (
                      <span className="text-[8px] font-mono text-gray-400 mt-0.5">
                        metric: {culprit.metric_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                    {culprit.position != null && (
                      <span
                        className="text-[9px] font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded-md"
                        title="Position in the full product formulation"
                      >
                        #{culprit.position}
                      </span>
                    )}
                    {culprit.score_value != null && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          isIrritant ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                        }`}
                        title="Metric score impact value"
                      >
                        Score: {culprit.score_value}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white/90 rounded-xl border border-black/10 space-y-2">
            <div className="flex items-start gap-2 text-gray-700">
              <Database className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-bold text-black">No rows returned from product_metric_culprits</span> for
                product ID <span className="font-mono font-bold">#{productId}</span> with metric
                {metrics.length > 1 ? 's' : ''}{' '}
                <span className="font-mono text-purple-700">
                  {metrics.length > 0 ? metrics.join(', ') : flag}
                </span>.
              </div>
            </div>

            {/* Smart Heuristic Preview if ingredients are detected in formula */}
            {heuristicFallbackIngredients.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Formula Ingredients Matching This Flag Category:
                </span>
                <div className="flex flex-wrap gap-1">
                  {heuristicFallbackIngredients.map((ing, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-gray-100 text-gray-800 font-semibold px-2 py-0.5 rounded-md border border-gray-200"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Database Permission Diagnostic Notice */}
            {error && error.code === '42501' && (
              <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Database Permission Notice (Supabase Error 42501)
                </div>
                <p className="text-[10px] text-amber-800 leading-snug">
                  The <code className="bg-amber-100 px-1 py-0.2 rounded font-mono">product_metric_culprits</code> table
                  requires read permissions. Run this in your Supabase SQL Editor:
                </p>
                <pre className="bg-amber-100/80 p-1.5 rounded font-mono text-[9px] select-all overflow-x-auto text-amber-950 font-bold">
                  GRANT SELECT ON public.product_metric_culprits TO anon, authenticated;
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Helper */}
      <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-[9px] text-gray-400">
        <span className="flex items-center gap-1">
          <HelpCircle className="w-2.5 h-2.5" />
          Click any flag above to switch view, or click again to close
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-black/60 hover:text-black font-bold uppercase underline cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
