import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowLeft, Plus, CheckCircle2, Shield, ShoppingBag, Loader2, Star, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useProductDetail } from './ProductComparisonTable';
import { getScoreColorConfig } from '../utils/scoreColors';

interface CompareViewProps {
  productIds: string[];
  trackerItems?: Record<string, any>;
  onClose: () => void;
  onRemoveProduct: (productId: string) => void;
  onAddProduct: () => void;
  onBackToPicker: () => void;
}

const PRODUCT_LETTERS = ['A', 'B', 'C', 'D', 'E'];

export const CompareView: React.FC<CompareViewProps> = ({
  productIds,
  trackerItems,
  onClose,
  onRemoveProduct,
  onAddProduct,
  onBackToPicker
}) => {
  const p1 = useProductDetail(productIds[0] || null, trackerItems?.[productIds[0]]);
  const p2 = useProductDetail(productIds[1] || null, trackerItems?.[productIds[1]]);
  const p3 = useProductDetail(productIds[2] || null, trackerItems?.[productIds[2]]);
  const p4 = useProductDetail(productIds[3] || null, trackerItems?.[productIds[3]]);
  const p5 = useProductDetail(productIds[4] || null, trackerItems?.[productIds[4]]);

  const allDetails = [p1, p2, p3, p4, p5];
  const activeDetails = allDetails.slice(0, productIds.length);

  const [expandIngredientsMap, setExpandIngredientsMap] = useState<Record<number, boolean>>({});

  const N = productIds.length;
  const showAddColumn = N < 5;
  const totalCols = N + (showAddColumn ? 1 : 0);

  const gridStyle = {
    gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))`
  };

  const productNames = activeDetails.map(d => d.product?.name || `Product`).join(' VS ');

  return (
    <div 
      className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[94vh] overflow-y-auto overflow-x-hidden my-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Header / Breadcrumb */}
      <div className="flex items-center justify-between bg-[#FAF9F6] px-6 py-4 border-b border-black/10 flex-shrink-0 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToPicker}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black transition-colors cursor-pointer"
            title="Back to picker"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-black/50">
              <span>Comparisons</span>
              <span>/</span>
              <span className="text-black truncate max-w-xs sm:max-w-md">{productNames}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Side-by-Side Content Container */}
      <div className="flex-1 w-full p-4 sm:p-6 space-y-6">
        
        {/* ROW: PRODUCTS HEADER (Images, Names, Brands, Match %, Remove) */}
        <div className="relative">
          {N === 2 && (
            <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 z-20 bg-white border border-black/10 shadow-lg px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-black">
              Versus
            </div>
          )}

          <div className="grid gap-3 sm:gap-4 w-full" style={gridStyle}>
            {activeDetails.map((detail, index) => {
              const id = productIds[index];
              const letter = PRODUCT_LETTERS[index];
              const compScore = detail.comp?.compatibilityScore;
              const scoreConfig = getScoreColorConfig(compScore);

              return (
                <div 
                  key={id} 
                  className="bg-[#FAF9F6] border border-black/10 rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center relative min-w-0"
                >
                  {N > 2 && (
                    <button
                      type="button"
                      onClick={() => onRemoveProduct(id)}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white border border-black/10 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-black/50 transition-colors cursor-pointer shadow-xs"
                      title={`Remove product ${letter}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <span className="text-[9px] font-black uppercase tracking-widest text-black/50 mb-2">
                    Product {letter}
                  </span>

                  {detail.loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-black" />
                      <span className="text-[10px] font-bold">Loading...</span>
                    </div>
                  ) : detail.product ? (
                    <>
                      {detail.product.photo_url && !detail.imageError ? (
                        <img
                          src={detail.product.photo_url}
                          alt={detail.product.name}
                          referrerPolicy="no-referrer"
                          onError={() => detail.setImageError(true)}
                          className={`object-cover rounded-2xl border border-black/10 bg-white shadow-sm mb-3 ${
                            N >= 4 ? 'w-14 h-14 sm:w-20 sm:h-20' : N === 3 ? 'w-16 h-16 sm:w-24 sm:h-24' : 'w-20 h-20 sm:w-28 sm:h-28'
                          }`}
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-white border border-black/10 flex items-center justify-center text-black/30 mb-3 shadow-sm">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                      )}

                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-black/50 block truncate max-w-full">
                        {detail.product.brand || 'Brand'}
                      </span>

                      <h3 className="text-xs sm:text-sm font-black text-black leading-snug line-clamp-2 mt-1 break-words">
                        {detail.product.name}
                      </h3>

                      {/* Type displayed discreetly under product's name */}
                      {detail.product.type && (
                        <span className="text-[9px] font-bold text-black/60 bg-black/5 px-2 py-0.5 rounded-md inline-block mt-1.5 truncate max-w-full">
                          {detail.product.type}
                        </span>
                      )}

                      {/* Match % Badge */}
                      {compScore != null && (
                        <div className="mt-3">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${scoreConfig.pillClasses}`}>
                            {detail.comp.scoreDisplay || `${compScore}% Match`}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-red-600 font-bold py-8">Failed to load product</div>
                  )}
                </div>
              );
            })}

            {showAddColumn && (
              <button
                type="button"
                onClick={onAddProduct}
                className="border-2 border-dashed border-black/20 hover:border-black rounded-2xl p-4 flex flex-col items-center justify-center gap-2 text-black/60 hover:text-black bg-white/50 hover:bg-white transition-all cursor-pointer min-h-[160px]"
              >
                <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center shadow-md">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider">Add Product</span>
              </button>
            )}
          </div>
        </div>

        {/* ATTRIBUTE SECTION: DESCRIPTION */}
        <div className="space-y-2">
          <div className="bg-[#FAF9F6] border-y border-black/10 py-2 px-4 rounded-xl">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-black/60 text-center sm:text-left">Description</h4>
          </div>
          <div className="grid gap-3 sm:gap-4 w-full" style={gridStyle}>
            {activeDetails.map((detail, index) => (
              <div key={index} className="p-3 bg-white border border-black/10 rounded-2xl min-w-0">
                <p className="text-xs text-black/70 leading-relaxed break-words line-clamp-4">
                  {detail.product?.description || <span className="text-black/30 italic">No description available.</span>}
                </p>
              </div>
            ))}
            {showAddColumn && <div className="hidden sm:block"></div>}
          </div>
        </div>

        {/* ATTRIBUTE SECTION: SKIN FIT / COMPATIBILITY */}
        <div className="space-y-2">
          <div className="bg-[#FAF9F6] border-y border-black/10 py-2 px-4 rounded-xl">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-black/60 text-center sm:text-left">Skin Fit & Conflicts</h4>
          </div>
          <div className="grid gap-3 sm:gap-4 w-full" style={gridStyle}>
            {activeDetails.map((detail, index) => (
              <div key={index} className="p-3 bg-white border border-black/10 rounded-2xl space-y-2 min-w-0">
                {detail.isAuthenticated && detail.comp ? (
                  <>
                    <div className="text-xs font-bold text-black">
                      {detail.comp.scoreDisplay || 'Compatibility Evaluated'}
                    </div>
                    {detail.comp.conflicts && detail.comp.conflicts.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {detail.comp.conflicts.map((c: string, i: number) => (
                          <span key={i} className="bg-red-50 text-red-800 border border-red-200 rounded-lg px-2 py-0.5 text-[9px] font-bold flex items-center gap-1">
                            <Shield className="w-3 h-3 text-red-600 shrink-0" />
                            <span className="break-words">{c}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-emerald-700 font-bold">No active conflicts detected</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-black/40 italic">Log in or take quiz to view skin fit</p>
                )}
              </div>
            ))}
            {showAddColumn && <div className="hidden sm:block"></div>}
          </div>
        </div>

        {/* ATTRIBUTE SECTION: KEY BENEFITS */}
        <div className="space-y-2">
          <div className="bg-[#FAF9F6] border-y border-black/10 py-2 px-4 rounded-xl">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-black/60 text-center sm:text-left">Key Benefits</h4>
          </div>
          <div className="grid gap-3 sm:gap-4 w-full" style={gridStyle}>
            {activeDetails.map((detail, index) => (
              <div key={index} className="p-3 bg-white border border-black/10 rounded-2xl min-w-0">
                {detail.comp?.benefits && detail.comp.benefits.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.comp.benefits.map((b: string, i: number) => (
                      <span key={i} className="bg-purple-50 text-purple-900 border border-purple-200/80 rounded-xl px-2.5 py-1 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-purple-600 shrink-0" />
                        <span className="break-words">{b}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-black/40 italic">Standard formulation</span>
                )}
              </div>
            ))}
            {showAddColumn && <div className="hidden sm:block"></div>}
          </div>
        </div>

        {/* ATTRIBUTE SECTION: POTENTIAL IRRITANTS */}
        <div className="space-y-2">
          <div className="bg-[#FAF9F6] border-y border-black/10 py-2 px-4 rounded-xl">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-black/60 text-center sm:text-left">Potential Irritants</h4>
          </div>
          <div className="grid gap-3 sm:gap-4 w-full" style={gridStyle}>
            {activeDetails.map((detail, index) => (
              <div key={index} className="p-3 bg-white border border-black/10 rounded-2xl min-w-0">
                {detail.comp?.safetyConcerns && detail.comp.safetyConcerns.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.comp.safetyConcerns.map((concern: string, idx: number) => (
                      <span key={idx} className="bg-amber-50 text-amber-900 border border-amber-200/80 rounded-xl px-2.5 py-1 text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="break-words">{concern}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-emerald-700 font-bold">None detected</span>
                )}
              </div>
            ))}
            {showAddColumn && <div className="hidden sm:block"></div>}
          </div>
        </div>

        {/* ATTRIBUTE SECTION: INGREDIENTS */}
        <div className="space-y-2">
          <div className="bg-[#FAF9F6] border-y border-black/10 py-2 px-4 rounded-xl">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-black/60 text-center sm:text-left">Ingredients</h4>
          </div>
          <div className="grid gap-3 sm:gap-4 w-full" style={gridStyle}>
            {activeDetails.map((detail, index) => {
              const isExpanded = !!expandIngredientsMap[index];
              const ings = detail.product?.ingredients || [];
              const ingsListText = Array.isArray(ings) ? ings.join(', ') : (typeof ings === 'string' ? ings : '');

              return (
                <div key={index} className="p-3 bg-white border border-black/10 rounded-2xl space-y-1.5 min-w-0">
                  {ingsListText ? (
                    <div>
                      <p className={`text-[10px] sm:text-[10.5px] text-black/70 leading-relaxed break-words ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {ingsListText}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExpandIngredientsMap(prev => ({ ...prev, [index]: !isExpanded }))}
                        className="mt-1 text-[9px] font-black uppercase tracking-wider text-purple-700 hover:text-purple-900 inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Less' : 'Full list'}</span>
                        {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-black/40 italic">Ingredients not available</span>
                  )}
                </div>
              );
            })}
            {showAddColumn && <div className="hidden sm:block"></div>}
          </div>
        </div>

        {/* ATTRIBUTE SECTION: RATINGS (Strictly Supabase ratings, no fallbacks) */}
        <div className="space-y-2">
          <div className="bg-[#FAF9F6] border-y border-black/10 py-2 px-4 rounded-xl">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-black/60 text-center sm:text-left">Ratings</h4>
          </div>
          <div className="grid gap-3 sm:gap-4 w-full" style={gridStyle}>
            {activeDetails.map((detail, index) => {
              const ratingAvg = detail.globalRatingsSummary?.avg;
              const ratingCount = detail.globalRatingsSummary?.count;
              const hasRatings = ratingAvg != null && ratingAvg > 0 && ratingCount != null && ratingCount > 0;

              return (
                <div key={index} className="p-3 bg-white border border-black/10 rounded-2xl flex items-center gap-2 min-w-0">
                  {hasRatings ? (
                    <>
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                      <span className="text-xs font-black text-black">
                        {ratingAvg.toFixed(1)}
                      </span>
                      <span className="text-[10px] font-medium text-black/50">
                        ({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-black/40 italic">No ratings yet</span>
                  )}
                </div>
              );
            })}
            {showAddColumn && <div className="hidden sm:block"></div>}
          </div>
        </div>

      </div>
    </div>
  );
};
