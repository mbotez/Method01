import React, { useState, useEffect } from 'react';
import { Heart, Trash2, RefreshCw } from 'lucide-react';

interface TrackerSpreadsheetRowProps {
  item: any;
  onUpdate: (item: any, field: string, value: any) => void;
  onDelete: (id: string) => void;
  onClickProduct: (item: any, withTrackerItem?: boolean) => void;
}

export const TrackerSpreadsheetRow: React.FC<TrackerSpreadsheetRowProps> = ({
  item,
  onUpdate,
  onDelete,
  onClickProduct,
}) => {
  const [localSize, setLocalSize] = useState(item.size || '');
  const [localNotes, setLocalNotes] = useState(item.notes || '');
  const [localPoa, setLocalPoa] = useState(item.poa || '');

  useEffect(() => {
    setLocalSize(item.size || '');
  }, [item.size]);

  useEffect(() => {
    setLocalNotes(item.notes || '');
  }, [item.notes]);

  useEffect(() => {
    setLocalPoa(item.poa || '');
  }, [item.poa]);

  return (
    <tr className="hover:bg-black/[0.02] transition-colors border-b border-black/5 last:border-0">
      {/* Product column */}
      <td className="p-3">
        <div
          onClick={() => onClickProduct(item, false)}
          className="flex items-center gap-3 min-w-[240px] cursor-pointer group"
          id={`spreadsheet-prod-${item.id}`}
        >
          {item.photo_url ? (
            <img
              src={item.photo_url}
              alt={item.product_name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 object-cover rounded-lg border border-black/10 group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-10 h-10 bg-black/5 rounded-lg border border-black/10 flex items-center justify-center text-[8px] text-black/40 font-bold">
              N/A
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-black uppercase tracking-tight break-words group-hover:text-venus-accent transition-colors">
              {item.brand || '-'}
            </h4>
            <p className="text-[11px] text-black/60 font-semibold normal-case break-words">
              {item.product_name || '-'}
            </p>
          </div>
        </div>
      </td>

      {/* Routine column */}
      <td className="p-3">
        <select
          value={item.routine_time || 'AM/PM'}
          onChange={(e) => onUpdate(item, 'routine_time', e.target.value)}
          className="bg-white border border-black/10 rounded-lg px-2 py-1 text-xs font-semibold focus:ring-black focus:border-black w-full"
          id={`spreadsheet-routine-${item.id}`}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
          <option value="AM/PM">AM/PM</option>
        </select>
      </td>

      {/* In Use column */}
      <td className="p-3 text-center">
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={!!item.in_use}
            onChange={(e) => onUpdate(item, 'in_use', e.target.checked)}
            className="w-4 h-4 rounded border-black/20 text-black focus:ring-black cursor-pointer"
            id={`spreadsheet-inuse-${item.id}`}
          />
        </div>
      </td>

      {/* Liked column */}
      <td className="p-3 text-center">
        <div className="flex justify-center">
          <button
            onClick={() => onUpdate(item, 'is_liked', !item.is_liked)}
            className="p-1 hover:bg-black/5 rounded transition-colors"
            title={item.is_liked ? 'Unlike' : 'Like'}
            id={`spreadsheet-like-${item.id}`}
          >
            <Heart className={`w-4 h-4 text-red-500 ${item.is_liked ? 'fill-red-500' : ''}`} />
          </button>
        </div>
      </td>

      {/* Buy Again column */}
      <td className="p-3 text-center">
        <div className="flex justify-center">
          <button
            onClick={() => onUpdate(item, 'repurchase', !item.repurchase)}
            className="p-1 hover:bg-black/5 rounded transition-colors"
            title={item.repurchase ? 'Do not buy again' : 'Buy again'}
            id={`spreadsheet-buyagain-${item.id}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${item.repurchase ? 'text-blue-500 font-bold' : 'text-black/30'}`} />
          </button>
        </div>
      </td>

      {/* Size column */}
      <td className="p-3">
        <input
          type="text"
          value={localSize}
          onChange={(e) => setLocalSize(e.target.value)}
          onBlur={() => onUpdate(item, 'size', localSize)}
          placeholder="e.g. 50ml"
          className="bg-white border border-black/10 rounded-lg px-2 py-1 text-xs font-mono focus:ring-black focus:border-black w-full text-right"
          id={`spreadsheet-size-${item.id}`}
        />
      </td>

      {/* Notes column */}
      <td className="p-3">
        <input
          type="text"
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={() => onUpdate(item, 'notes', localNotes)}
          placeholder="Add tracking notes..."
          className="bg-white border border-black/10 rounded-lg px-2 py-1 text-xs focus:ring-black focus:border-black w-full"
          id={`spreadsheet-notes-${item.id}`}
        />
      </td>

      {/* Open Date column */}
      <td className="p-3">
        <input
          type="date"
          value={item.open_date || ''}
          onChange={(e) => onUpdate(item, 'open_date', e.target.value)}
          className="bg-white border border-black/10 rounded-lg px-1.5 py-1 text-xs font-mono focus:ring-black focus:border-black w-full"
          id={`spreadsheet-opendate-${item.id}`}
        />
      </td>

      {/* Best By column */}
      <td className="p-3">
        <input
          type="date"
          value={item.best_by_date && !item.best_by_date.includes('0001') ? item.best_by_date : ''}
          onChange={(e) => onUpdate(item, 'best_by_date', e.target.value)}
          className="bg-white border border-black/10 rounded-lg px-1.5 py-1 text-xs font-mono focus:ring-black focus:border-black w-full"
          id={`spreadsheet-bestby-${item.id}`}
        />
      </td>

      {/* POA column */}
      <td className="p-3">
        <input
          type="text"
          value={localPoa}
          onChange={(e) => setLocalPoa(e.target.value)}
          onBlur={() => onUpdate(item, 'poa', localPoa)}
          placeholder="e.g. 12M"
          className="bg-white border border-black/10 rounded-lg px-2 py-1 text-xs font-mono focus:ring-black focus:border-black w-full uppercase text-center"
          id={`spreadsheet-poa-${item.id}`}
        />
      </td>

      {/* Actions column */}
      <td className="p-3 text-center">
        <div className="flex justify-center">
          <button
            onClick={() => onDelete(item.id)}
            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Remove from tracker"
            id={`spreadsheet-delete-${item.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};
