import React, { useState, useEffect } from 'react';
import { Trash2, ChevronDown, ChevronUp, Sun, Moon, Calendar, HelpCircle, Heart, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TrackerProductCardProps {
  item: any;
  onUpdate: (item: any, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onClick: (item: any) => void;
}

const cleanNotesForUser = (notes: string | null): string => {
  if (!notes) return '';
  let cleaned = notes.replace(/\[Potential Breakout Risk:[^\]]+\]/gi, '');
  cleaned = cleaned.replace(/\[Potential Comedogenic Risk[^\]]*\]/gi, '');
  return cleaned.trim();
};

const parseBreakoutRisk = (notes: string | null) => {
  if (!notes) return null;
  const match = notes.match(/\[Potential Breakout Risk:\s*([^\]|]+)(?:\|\s*([^\]]+))?\]/i);
  if (match) {
    const ingredientsStr = match[1] || '';
    const reasonsStr = match[2] || '';
    return {
      ingredients: ingredientsStr.split(',').map(s => s.trim()).filter(Boolean),
      reasons: reasonsStr.split(';').map(s => s.trim()).filter(Boolean)
    };
  }
  if (notes.toLowerCase().includes('[potential breakout risk]') || notes.toLowerCase().includes('[potential comedogenic risk]')) {
    return {
      ingredients: [],
      reasons: []
    };
  }
  return null;
};

export const TrackerProductCard: React.FC<TrackerProductCardProps> = ({
  item,
  onUpdate,
  onDelete,
  onClick
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localSize, setLocalSize] = useState(item.size || '');
  const [localNotes, setLocalNotes] = useState(cleanNotesForUser(item.notes));

  // Keep local states synced if item changes from backend/realtime
  useEffect(() => {
    setLocalSize(item.size || '');
  }, [item.size]);

  useEffect(() => {
    setLocalNotes(cleanNotesForUser(item.notes));
  }, [item.notes]);

  const handleBlurSize = () => {
    if (localSize !== item.size) {
      onUpdate(item, 'size', localSize);
    }
  };

  const handleBlurNotes = () => {
    const cleanedLocal = localNotes.trim();
    // Keep any existing bracket tag from the original notes
    const match = item.notes ? item.notes.match(/\[Potential Breakout Risk:[^\]]+\]/i) : null;
    let finalNotes = cleanedLocal;
    if (match && match[0]) {
      finalNotes = cleanedLocal ? `${cleanedLocal} ${match[0]}` : match[0];
    } else if (item.notes && (item.notes.toLowerCase().includes('[potential comedogenic risk]') || item.notes.toLowerCase().includes('[potential breakout risk]'))) {
      finalNotes = cleanedLocal ? `${cleanedLocal} [Potential Breakout Risk]` : '[Potential Breakout Risk]';
    }

    if (finalNotes !== item.notes) {
      onUpdate(item, 'notes', finalNotes);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-black/10 shadow-sm hover:border-black/20 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative font-sans w-full">
      {/* Card Content Header */}
      <div className="p-4 space-y-3 flex-1">
        <div className="flex justify-between items-start gap-2">
          {/* Brand, Name, Photo */}
          <div 
            className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 group"
            onClick={() => onClick(item)}
          >
            {item.photo_url ? (
              <img 
                src={item.photo_url} 
                alt={item.product_name} 
                referrerPolicy="no-referrer"
                className="w-14 h-14 object-cover rounded-xl border border-black/10 flex-shrink-0 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-14 h-14 bg-black/5 rounded-xl border border-black/10 flex items-center justify-center flex-shrink-0 text-[10px] text-black/40 font-bold">
                N/A
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm md:text-base font-black uppercase tracking-tight truncate group-hover:text-venus-accent transition-colors">
                {item.brand || '-'}
              </h4>
              <p className="text-xs md:text-sm text-black/60 font-semibold normal-case">
                {item.product_name || '-'}
              </p>
              {/* Routine Badge */}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {item.routine_time === 'AM' && (
                  <span className="bg-amber-50 text-amber-800 border border-amber-200/50 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-500" />
                    AM Routine
                  </span>
                )}
                {item.routine_time === 'PM' && (
                  <span className="bg-indigo-50 text-indigo-800 border border-indigo-200/50 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase flex items-center gap-1">
                    <Moon className="w-3 h-3 text-indigo-500" />
                    PM Routine
                  </span>
                )}
                {(item.routine_time === 'AM/PM' || !item.routine_time) && (
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/50 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase flex items-center gap-1">
                    <Sun className="w-2.5 h-2.5 text-emerald-600" />
                    <Moon className="w-2.5 h-2.5 text-emerald-600" />
                    AM & PM Routine
                  </span>
                )}
                {item.product_verdict && (
                  <span className={`border rounded-lg px-2 py-0.5 text-[9px] font-black uppercase flex items-center gap-1 ${
                    item.product_verdict === 'Avoid' ? 'bg-red-50 text-red-800 border-red-200' :
                    item.product_verdict === 'Caution' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    item.product_verdict === 'Recommended' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                    'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    Verdict: {item.product_verdict}
                  </span>
                )}
                {parseBreakoutRisk(item.notes) && (
                  <span className="bg-amber-100 text-amber-950 border border-amber-300 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase flex items-center gap-1">
                    Potential Breakout Risk
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Delete Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="p-1.5 text-black/20 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
            title="Delete from tracker"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Notes Input & Ingredients */}
        <div className="space-y-2 pt-1">
          {/* Notes Input */}
          <div className="flex items-start gap-2 text-xs bg-black/[0.02] px-2 py-1 rounded-lg border border-black/[0.05]">
            <span className="text-[9px] font-black uppercase text-black/30 min-w-[32px] mt-0.5">Notes:</span>
            <input 
              type="text" 
              placeholder="Add tracking notes..." 
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleBlurNotes}
              className="bg-transparent border-none p-0 text-xs text-black/80 italic focus:ring-0 w-full placeholder:text-black/20"
            />
          </div>

          {/* Ingredients Snippet */}
          {item.ingredients && (
            <p className="text-[9px] text-black/40 line-clamp-1 italic px-1 pt-0.5" title={item.ingredients}>
              Ingredients: {item.ingredients}
            </p>
          )}
        </div>
      </div>

      {/* Dropdown Toggle Button */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-2 bg-black/5 hover:bg-black/10 border-t border-black/[0.08] flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-black/60 transition-colors"
      >
        <span>Details</span>
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Expanded Dropdown Details Section */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-black/5 bg-gray-50/50"
          >
            <div className="p-4 space-y-4 text-xs">
              {/* Checkbox Rows (In Use, Liked, Repurchase) */}
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-black/10 hover:border-black/20 transition-all cursor-pointer shadow-sm select-none">
                  <input 
                    type="checkbox" 
                    className="rounded border-black/10 text-black focus:ring-black mb-1 w-4 h-4"
                    checked={!!item.in_use}
                    onChange={(e) => onUpdate(item, 'in_use', e.target.checked)}
                  />
                  <span className="text-[9px] font-black uppercase text-black/60 flex items-center gap-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                    In Use
                  </span>
                </label>

                <label className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-black/10 hover:border-black/20 transition-all cursor-pointer shadow-sm select-none">
                  <input 
                    type="checkbox" 
                    className="rounded border-black/10 text-black focus:ring-black mb-1 w-4 h-4"
                    checked={!!item.is_liked}
                    onChange={(e) => onUpdate(item, 'is_liked', e.target.checked)}
                  />
                  <span className="text-[9px] font-black uppercase text-black/60 flex items-center gap-0.5">
                    <Heart className="w-2.5 h-2.5 text-red-500 fill-red-500" />
                    Liked
                  </span>
                </label>

                <label className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-black/10 hover:border-black/20 transition-all cursor-pointer shadow-sm select-none">
                  <input 
                    type="checkbox" 
                    className="rounded border-black/10 text-black focus:ring-black mb-1 w-4 h-4"
                    checked={!!item.repurchase}
                    onChange={(e) => onUpdate(item, 'repurchase', e.target.checked)}
                  />
                  <span className="text-[9px] font-black uppercase text-black/60 flex items-center gap-0.5">
                    <RefreshCw className="w-2.5 h-2.5 text-blue-500" />
                    Buy again
                  </span>
                </label>
              </div>

              {/* Potential Breakout Risk Reasons inside Expanded section */}
              {(() => {
                const parsed = parseBreakoutRisk(item.notes);
                if (parsed && (parsed.ingredients.length > 0 || parsed.reasons.length > 0)) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1">
                        ⚠️ Potential Breakout Risk Details
                      </span>
                      {parsed.ingredients.length > 0 && (
                        <p className="text-[11px] text-amber-950/80">
                          <strong className="text-amber-950">Trigger Ingredients:</strong> {parsed.ingredients.join(', ')}
                        </p>
                      )}
                      {parsed.reasons.length > 0 && (
                        <ul className="list-disc list-inside text-[11px] text-amber-950/85 pl-1 space-y-0.5">
                          {parsed.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Date Pickers, Size & POA */}
              <div className="space-y-2 bg-white p-3 rounded-xl border border-black/5 shadow-sm">
                {/* Size */}
                <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2 mb-2">
                  <span className="text-[9px] font-black uppercase text-black/40 flex items-center gap-1">
                    Size
                  </span>
                  <input 
                    type="text" 
                    placeholder="e.g. 50ml, 1.7 oz" 
                    value={localSize}
                    onChange={(e) => setLocalSize(e.target.value)}
                    onBlur={handleBlurSize}
                    className="bg-transparent border border-black/10 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-black/80 focus:ring-black max-w-[125px] h-7 uppercase text-right"
                  />
                </div>

                {/* Best By Date */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase text-black/40 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-black/50" />
                    Best By
                  </span>
                  <input 
                    type="date" 
                    value={item.best_by_date && !item.best_by_date.includes('0001') ? item.best_by_date : ''}
                    onChange={(e) => onUpdate(item, 'best_by_date', e.target.value)}
                    className="bg-transparent border border-black/10 rounded-lg px-2 py-0.5 text-[11px] font-mono text-black/80 focus:ring-black max-w-[125px] h-7"
                  />
                </div>

                {/* Open Date */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase text-black/40 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-black/50" />
                    Open Date
                  </span>
                  <input 
                    type="date" 
                    value={item.open_date || ''}
                    onChange={(e) => onUpdate(item, 'open_date', e.target.value)}
                    className="bg-transparent border border-black/10 rounded-lg px-2 py-0.5 text-[11px] font-mono text-black/80 focus:ring-black max-w-[125px] h-7"
                  />
                </div>

                {/* POA */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase text-black/40 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-black/50" />
                    POA (Period)
                  </span>
                  <input 
                    type="text" 
                    placeholder="e.g. 12M, 6M"
                    value={item.poa || ''}
                    onChange={(e) => onUpdate(item, 'poa', e.target.value)}
                    className="bg-transparent border border-black/10 rounded-lg px-2 py-0.5 text-xs font-mono text-black/80 focus:ring-black max-w-[125px] h-7 uppercase text-right"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
