import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProductCard } from '../context/ProductCardContext';

interface CollageCardItem {
  image_url?: string;
  caption?: string;
  sticky_note?: string;
}

interface EditorialArticleModalProps {
  article: any | null;
  onClose: () => void;
}

export const EditorialArticleModal: React.FC<EditorialArticleModalProps> = ({ article, onClose }) => {
  const { openProductCard } = useProductCard();
  const [articleProductPhotos, setArticleProductPhotos] = useState<Record<string, string>>({});
  const [selectedWhyId, setSelectedWhyId] = useState<string | number | null>(null);

  const [isDesktop, setIsDesktop] = useState(false);
  const [p1Height, setP1Height] = useState<number | undefined>(undefined);
  const [p3Height, setP3Height] = useState<number | undefined>(undefined);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const p1Ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setP1Height(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const p3Ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setP3Height(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!article || !article.content || !Array.isArray(article.content)) {
      setArticleProductPhotos({});
      return;
    }
    const productIds = article.content
      .filter((b: any) => (b.type === 'product_card' || b.product_id) && b.product_id)
      .map((b: any) => b.product_id)
      .filter((id: string) => id && !id.startsWith('00000000-0000-0000-0000-'));

    if (productIds.length === 0) {
      setArticleProductPhotos({});
      return;
    }

    supabase
      .from('products')
      .select('id, photo_url, name, brand')
      .in('id', productIds)
      .then(({ data, error }) => {
        if (!error && data) {
          const map: Record<string, string> = {};
          data.forEach((p: any) => {
            if (p.photo_url) map[String(p.id)] = p.photo_url;
          });
          setArticleProductPhotos(map);
        }
      });
  }, [article]);

  if (!article) return null;

  // Format published date DD/MM/YYYY
  const rawDate = article.published_at || article.created_at || new Date().toISOString();
  const dateObj = new Date(rawDate);
  const formattedDate = !isNaN(dateObj.getTime())
    ? `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`
    : rawDate;

  const categoryLabel = article.category_label || article.category || 'EDITORIAL';
  const trendTag = article.trend_tag;

  // Filter valid collage cards (Rule: When collage_cards is empty, null, or an item has no valid image_url, render nothing for that slot)
  const collageCardsValid: CollageCardItem[] = Array.isArray(article.collage_cards)
    ? article.collage_cards.filter((c: any) => c && typeof c.image_url === 'string' && c.image_url.trim() !== '')
    : [];

  // Helper for deterministic marker highlights
  const renderHighlightedText = (text: string, highlights?: string[]) => {
    if (!highlights || highlights.length === 0 || typeof text !== 'string') {
      return text;
    }
    const sortedHighlights = [...highlights].sort((a, b) => b.length - a.length);
    const escaped = sortedHighlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'g');

    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (sortedHighlights.includes(part)) {
        return (
          <mark 
            key={i} 
            className="bg-transparent bg-[linear-gradient(transparent_55%,#F5E6A8_55%)] px-1 font-semibold text-[#141413]"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Parse content blocks or string
  let contentBlocks: any[] = [];
  if (Array.isArray(article.content)) {
    contentBlocks = article.content;
  } else if (typeof article.content === 'string') {
    contentBlocks = article.content.split('\n\n').map(t => ({ type: 'paragraph', text: t }));
  } else if (article.content && typeof article.content === 'object') {
    contentBlocks = [{ type: 'paragraph', text: article.content.text || JSON.stringify(article.content) }];
  } else {
    contentBlocks = [{ type: 'paragraph', text: article.article_content || article.excerpt || '' }];
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#181816]/60 backdrop-blur-sm"
        />

        {/* Modal Canvas Surface #FAF7F2 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative bg-[#FAF7F2] rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-10 shadow-2xl z-10 border border-[#E6E0D6] text-[#181816] space-y-6"
        >
          {/* Top Metadata Bar */}
          <div className="flex items-center justify-between border-b border-[#E6E0D6] pb-4">
            <div className="flex items-center gap-2.5 font-['JetBrains_Mono','IBM_Plex_Mono',monospace] text-[11px] text-[#6E6A61]">
              <span className="px-2.5 py-1 bg-[#F3E59A] text-[#141413] font-bold rounded uppercase tracking-wider">
                {categoryLabel}
              </span>
              <span>•</span>
              <span>{formattedDate}</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#E6E0D6]/40 hover:bg-[#E6E0D6] text-[#181816] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Close article"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Headline & Trend Tag */}
          <div className="space-y-3">
            <h1 className="font-['Newsreader','Playfair_Display',serif] text-3xl sm:text-[36px] font-bold text-[#141413] leading-[1.12] tracking-tight">
              {article.title}
            </h1>
            {trendTag && (
              <div className="inline-block transform -rotate-[2deg]">
                <span className="font-['JetBrains_Mono','IBM_Plex_Mono',monospace] text-[10px] font-black uppercase tracking-wider bg-[#F7DFC2] text-[#4A3B2C] px-3 py-1 rounded shadow-xs inline-block">
                  {trendTag}
                </span>
              </div>
            )}
          </div>

          {/* Main Content Blocks Rendering */}
          <div className="space-y-6 pt-2">
            {(() => {
              let paragraphCount = 0;
              return contentBlocks.map((block: any, idx: number) => {
                if (!block) return null;

                // 1. Heading check FIRST before paragraphs
                if (block.type === 'heading' || block.level === 2 || (typeof block === 'object' && block.type === 'heading')) {
                  return (
                    <h2 
                      key={idx} 
                      className="font-['Newsreader','Playfair_Display',serif] text-[24px] font-bold text-[#141413] mt-10 mb-4 pb-2 border-b border-[#E6E0D6]"
                    >
                      {block.text || block.title}
                    </h2>
                  );
                }

                // Ignore product_card blocks inside text loop
                if (block.type === 'product_card') {
                  return null;
                }

                // 2. Paragraph check
                const isString = typeof block === 'string';
                const isParagraph = isString || block.type === 'paragraph' || block.text || block.content;

                if (isParagraph) {
                  paragraphCount++;
                  const pIdx = paragraphCount;
                  const textVal = isString ? block : (block.text || block.content || '');

                  if (pIdx === 1) {
                    return (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-start mb-8">
                        <div ref={p1Ref} className="space-y-2">
                          <p className="font-['Plus_Jakarta_Sans',Inter,sans-serif] text-[15.5px] leading-[1.72] text-[#181816]">
                            <span className="float-left text-[3.5rem] leading-[0.85] pr-3 font-['Newsreader','Playfair_Display',serif] font-bold text-[#141413]">
                              {textVal.charAt(0)}
                            </span>
                            {renderHighlightedText(textVal.slice(1), article.highlights)}
                          </p>
                        </div>
                        {collageCardsValid[0]?.image_url ? (
                          <div className="w-full flex justify-center md:justify-start">
                            <div 
                              className="relative bg-white p-3 pb-4 shadow-[0_8px_24px_rgba(0,0,0,0.1)] rounded-sm border border-[#E6E0D6] flex flex-col justify-between w-full min-w-[160px] max-w-[240px] aspect-[4/5] transform rotate-[2deg] h-auto md:h-auto"
                              style={{ height: isDesktop && p1Height ? `${p1Height}px` : undefined }}
                            >
                              <div className="flex-1 min-h-0 w-full overflow-hidden bg-white rounded-sm border border-[#E6E0D6]/60 p-1">
                                <img src={collageCardsValid[0].image_url} alt="" className="w-full h-full object-cover rounded-sm" />
                              </div>
                              {collageCardsValid[0].caption && (
                                <div className="shrink-0 pt-2 pb-1 text-center">
                                  <p className="font-['Caveat'] text-base md:text-lg text-[#181816] leading-snug line-clamp-2">
                                    {collageCardsValid[0].caption}
                                  </p>
                                </div>
                              )}
                              {collageCardsValid[0].sticky_note && (
                                <div className="absolute -bottom-3 -right-3 bg-[#F7EA99] text-[#181816] font-['Caveat'] text-xs p-2.5 shadow-md transform rotate-[-4deg] max-w-[120px] border border-amber-200">
                                  {collageCardsValid[0].sticky_note}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  } else if (pIdx === 2) {
                    return (
                      <div key={idx} className="mb-8">
                        <div className="max-w-[60ch]">
                          <p className="font-['Plus_Jakarta_Sans',Inter,sans-serif] text-[15.5px] leading-[1.72] text-[#181816]">
                            {renderHighlightedText(textVal, article.highlights)}
                          </p>
                        </div>
                      </div>
                    );
                  } else if (pIdx === 3) {
                    return (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-start mb-8">
                        {collageCardsValid[1]?.image_url ? (
                          <div className="w-full flex justify-center md:justify-start order-2 md:order-1">
                            <div 
                              className="relative bg-white p-3 pb-4 shadow-[0_8px_24px_rgba(0,0,0,0.1)] rounded-sm border border-[#E6E0D6] flex flex-col justify-between w-full min-w-[160px] max-w-[240px] aspect-[4/5] transform rotate-[-2deg] h-auto md:h-auto"
                              style={{ height: isDesktop && p3Height ? `${p3Height}px` : undefined }}
                            >
                              <div className="flex-1 min-h-0 w-full overflow-hidden bg-white rounded-sm border border-[#E6E0D6]/60 p-1">
                                <img src={collageCardsValid[1].image_url} alt="" className="w-full h-full object-cover rounded-sm" />
                              </div>
                              {collageCardsValid[1].caption && (
                                <div className="shrink-0 pt-2 pb-1 text-center">
                                  <p className="font-['Caveat'] text-base md:text-lg text-[#181816] leading-snug line-clamp-2">
                                    {collageCardsValid[1].caption}
                                  </p>
                                </div>
                              )}
                              {collageCardsValid[1].sticky_note && (
                                <div className="absolute -bottom-3 -right-3 bg-[#F7EA99] text-[#181816] font-['Caveat'] text-xs p-2.5 shadow-md transform rotate-[4deg] max-w-[120px] border border-amber-200">
                                  {collageCardsValid[1].sticky_note}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                        <div ref={p3Ref} className={`order-1 ${collageCardsValid[1]?.image_url ? 'md:order-2' : ''}`}>
                          <div className="max-w-[60ch]">
                            <p className="font-['Plus_Jakarta_Sans',Inter,sans-serif] text-[15.5px] leading-[1.72] text-[#181816]">
                              {renderHighlightedText(textVal, article.highlights)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div key={idx} className="mb-8">
                        <div className="max-w-[60ch]">
                          <p className="font-['Plus_Jakarta_Sans',Inter,sans-serif] text-[15.5px] leading-[1.72] text-[#181816]">
                            {renderHighlightedText(textVal, article.highlights)}
                          </p>
                        </div>
                      </div>
                    );
                  }
                }

                return null;
              });
            })()}

            {/* Product Grid ("5 Cult-Favorite & Trending Products to Try") */}
            {contentBlocks.some((b: any) => b && b.type === 'product_card') && (
              <div className="mt-10 pt-4 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {contentBlocks
                    .filter((b: any) => b && b.type === 'product_card')
                    .map((block: any, pIdx: number) => {
                      const photoUrl = articleProductPhotos[block.product_id] || block.image_url || block.photo_url;
                      const currentId = block.product_id || pIdx;
                      const isSelectedWhy = selectedWhyId === currentId;

                      return (
                        <div
                          key={pIdx}
                          onClick={() => {
                            if (block.product_id) {
                              openProductCard(block.product_id);
                            }
                          }}
                          className="relative bg-white rounded-xl p-3 border border-[#E6E0D6] shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:-translate-y-1 transition-transform duration-200 cursor-pointer flex flex-col justify-between group"
                        >
                          {/* Top-left numbered badge in #F3E59A */}
                          <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-md bg-[#F3E59A] text-[#141413] text-[11px] font-bold flex items-center justify-center shadow-xs">
                            {pIdx + 1}
                          </div>

                          {/* Product Image */}
                          <div className="aspect-[4/5] w-full bg-white rounded-md p-2 border border-[#E6E0D6]/60 flex items-center justify-center mb-3 overflow-hidden">
                            {photoUrl ? (
                              <img src={photoUrl} alt={block.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="text-xs font-bold text-[#6E6A61]">
                                {block.name?.charAt(0) || 'P'}
                              </div>
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="space-y-1">
                            <p className="font-['JetBrains_Mono',monospace] text-[11px] text-[#6E6A61]">
                              {block.price_point || 'Staple'}
                            </p>
                            <h3 className="font-['Plus_Jakarta_Sans',sans-serif] text-[13px] font-bold text-[#141413] line-clamp-2 leading-tight group-hover:text-[#B08000] transition-colors">
                              {block.name}
                            </h3>
                            {block.best_for && (
                              <p className="font-['Plus_Jakarta_Sans',sans-serif] text-[10px] text-[#4A4741] italic line-clamp-1">
                                {block.best_for}
                              </p>
                            )}
                          </div>

                          {/* Why it fits / details toggle */}
                          {block.why_it_fits && (
                            <div className="mt-3 pt-2 border-t border-[#E6E0D6]/60">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedWhyId(prev => prev === currentId ? null : currentId);
                                }}
                                className="text-[10px] font-black uppercase tracking-wider text-[#B08000] hover:underline w-full text-left"
                              >
                                {isSelectedWhy ? 'Hide Fit Notes' : 'Why it fits →'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Full-width why it fits details panel across the whole page under the products */}
                {selectedWhyId !== null && (() => {
                  const selectedBlock = contentBlocks
                    .filter((b: any) => b && b.type === 'product_card')
                    .find((b: any, i: number) => (b.product_id || i) === selectedWhyId);
                  if (!selectedBlock || !selectedBlock.why_it_fits) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl p-6 border border-[#E6E0D6] shadow-[0_8px_24px_rgba(0,0,0,0.06)] space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-[#E6E0D6]/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-[#F3E59A] text-[#141413] font-['JetBrains_Mono',monospace] text-[10px] font-bold uppercase tracking-wider">
                            Fit Analysis
                          </span>
                          <h4 className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-bold text-[#141413]">
                            {selectedBlock.name}
                          </h4>
                        </div>
                        <button
                          onClick={() => setSelectedWhyId(null)}
                          className="text-xs font-bold text-[#6E6A61] hover:text-[#181816] cursor-pointer"
                        >
                          Close ✕
                        </button>
                      </div>
                      <p className="font-['Plus_Jakarta_Sans',sans-serif] text-xs sm:text-sm text-[#181816] leading-relaxed">
                        {selectedBlock.why_it_fits}
                      </p>
                    </motion.div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Modal Footer / Close button */}
          <div className="pt-6 border-t border-[#E6E0D6] flex items-center justify-end">
            <button
              onClick={onClose}
              className="py-2.5 px-6 bg-[#141413] text-[#FAF7F2] rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#B08000] transition-colors cursor-pointer"
            >
              Close Article
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
