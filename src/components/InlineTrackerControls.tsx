import React, { useState, useEffect } from 'react';
import { CheckCircle2, Heart, RefreshCw, Calendar, HelpCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InlineTrackerControlsProps {
  item: any;
  onRefresh: () => void;
  onDelete: () => void;
}

export const InlineTrackerControls: React.FC<InlineTrackerControlsProps> = ({
  item,
  onRefresh,
  onDelete
}) => {
  const [localSize, setLocalSize] = useState(item?.size || '');
  const [localNotes, setLocalNotes] = useState(item?.notes || '');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (item) {
      setLocalSize(item.size || '');
      setLocalNotes(item.notes || '');
    }
  }, [item]);

  const handleUpdateTracker = async (field: string, value: any) => {
    if (!item?.id) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('tracker')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', item.id);
      
      if (error) {
        console.error('Update failed:', error);
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <h3 className="font-black text-xs uppercase tracking-widest text-gray-400">My Tracker</h3>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={isUpdating}
          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-[10px] font-bold uppercase disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all cursor-pointer shadow-sm select-none">
          <input 
            type="checkbox" 
            className="rounded border-gray-300 text-black focus:ring-black mb-1 w-4 h-4"
            checked={!!item.in_use}
            onChange={(e) => handleUpdateTracker('in_use', e.target.checked)}
            disabled={isUpdating}
          />
          <span className="text-[9px] font-black uppercase text-gray-600 flex items-center gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
            In Use
          </span>
        </label>

        <label className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all cursor-pointer shadow-sm select-none">
          <input 
            type="checkbox" 
            className="rounded border-gray-300 text-black focus:ring-black mb-1 w-4 h-4"
            checked={!!item.is_liked}
            onChange={(e) => handleUpdateTracker('is_liked', e.target.checked)}
            disabled={isUpdating}
          />
          <span className="text-[9px] font-black uppercase text-gray-600 flex items-center gap-0.5">
            <Heart className={`w-2.5 h-2.5 text-red-500 ${item.is_liked ? 'fill-red-500' : ''}`} />
            Liked
          </span>
        </label>

        <label className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all cursor-pointer shadow-sm select-none">
          <input 
            type="checkbox" 
            className="rounded border-gray-300 text-black focus:ring-black mb-1 w-4 h-4"
            checked={!!item.repurchase}
            onChange={(e) => handleUpdateTracker('repurchase', e.target.checked)}
            disabled={isUpdating}
          />
          <span className="text-[9px] font-black uppercase text-gray-600 flex items-center gap-0.5">
            <RefreshCw className="w-2.5 h-2.5 text-blue-500" />
            Buy again
          </span>
        </label>
      </div>

      <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
        {/* Notes */}
        <div className="flex flex-col gap-1 border-b border-gray-200 pb-2 mb-2">
          <span className="text-[9px] font-black uppercase text-gray-400">Notes</span>
          <input 
            type="text" 
            placeholder="Add tracking notes..." 
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={() => handleUpdateTracker('notes', localNotes)}
            disabled={isUpdating}
            className="bg-transparent border-none p-0 text-xs text-gray-700 italic focus:ring-0 w-full placeholder:text-gray-300"
          />
        </div>
        {/* Size */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-2">
          <span className="text-[9px] font-black uppercase text-gray-400">Size</span>
          <input 
            type="text" 
            placeholder="e.g. 50ml" 
            value={localSize}
            onChange={(e) => setLocalSize(e.target.value)}
            onBlur={() => handleUpdateTracker('size', localSize)}
            disabled={isUpdating}
            className="bg-transparent border border-gray-200 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-gray-700 focus:ring-black max-w-[120px] h-7 text-right"
          />
        </div>
        {/* Dates */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-2">
          <span className="text-[9px] font-black uppercase text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> Best By</span>
          <input 
            type="date" 
            value={item.best_by_date && !item.best_by_date.includes('0001') ? item.best_by_date : ''}
            onChange={(e) => handleUpdateTracker('best_by_date', e.target.value)}
            disabled={isUpdating}
            className="bg-transparent border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-mono text-gray-700 focus:ring-black max-w-[120px] h-7"
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2 mb-2">
          <span className="text-[9px] font-black uppercase text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> Open Date</span>
          <input 
            type="date" 
            value={item.open_date || ''}
            onChange={(e) => handleUpdateTracker('open_date', e.target.value)}
            disabled={isUpdating}
            className="bg-transparent border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-mono text-gray-700 focus:ring-black max-w-[120px] h-7"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-black uppercase text-gray-400 flex items-center gap-1"><HelpCircle className="w-3 h-3"/> POA</span>
          <input 
            type="text" 
            placeholder="e.g. 12M"
            value={item.poa || ''}
            onChange={(e) => handleUpdateTracker('poa', e.target.value)}
            disabled={isUpdating}
            className="bg-transparent border border-gray-200 rounded-lg px-2 py-0.5 text-[11px] font-mono text-gray-700 focus:ring-black max-w-[120px] h-7 uppercase text-right"
          />
        </div>
      </div>
    </div>
  );
};
