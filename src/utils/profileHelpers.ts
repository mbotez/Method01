import { SKIN_CONCERN_OPTIONS } from '../config/appConstants';
import { AvoidedIngredient } from '../types';

export const getSkinConcernLabel = (id: any): string | null => {
  if (id === null || id === undefined) return null;
  const num = Number(id);
  if (isNaN(num) || num === 12) return null;
  const match = SKIN_CONCERN_OPTIONS.find((c) => c.id === num);
  return match ? match.label : null;
};

export const getActivesSelectedIds = (raw: any): number[] => {
  if (raw === null || raw === undefined) return [];
  let items: any[] = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'number') {
    items = [raw];
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      items = trimmed.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, '').trim());
    } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        items = JSON.parse(trimmed);
      } catch {
        items = trimmed.split(',').map(s => s.trim());
      }
    } else if (trimmed.includes(',')) {
      items = trimmed.split(',').map(s => s.trim());
    } else if (trimmed !== '') {
      items = [trimmed];
    }
  }

  const selected = new Set<number>();
  for (const item of items) {
    if (item === null || item === undefined) continue;
    const s = String(item).trim();
    const num = Number(s);
    if (!isNaN(num) && num >= 1 && num <= 4) {
      selected.add(num);
    } else {
      const lower = s.toLowerCase();
      if (lower.includes('prescription') || lower.includes('tretinoin') || lower.includes('adapalene')) {
        selected.add(1);
      } else if (lower.includes('over-the-counter') || lower.includes('retinol') || lower.includes('otc')) {
        selected.add(2);
      } else if (lower.includes('acid') || lower.includes('exfoliat') || lower.includes('salicylic') || lower.includes('glycolic')) {
        selected.add(3);
      } else if (lower.includes('none') || lower.includes('not sure')) {
        selected.add(4);
      }
    }
  }
  return Array.from(selected);
};

export const extractAvoidedIngredientIds = (raw: any): number[] => {
  if (raw === null || raw === undefined) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else if (trimmed.includes(',')) {
      parsed = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    } else if (trimmed !== '') {
      parsed = [trimmed];
    } else {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    if (typeof parsed === 'number' && !isNaN(parsed)) return [parsed];
    if (typeof parsed === 'string') {
      const num = parseInt(parsed.trim(), 10);
      if (!isNaN(num) && String(num) === parsed.trim()) return [num];
    }
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.id !== undefined && parsed.id !== null) {
        const num = Number(parsed.id);
        return !isNaN(num) ? [num] : [];
      }
    }
    return [];
  }

  const ids: number[] = [];
  for (const item of parsed) {
    if (item === null || item === undefined) continue;
    if (typeof item === 'number' && !isNaN(item)) {
      if (!ids.includes(item)) ids.push(item);
    } else if (typeof item === 'string') {
      const num = parseInt(item.trim(), 10);
      if (!isNaN(num) && String(num) === item.trim()) {
        if (!ids.includes(num)) ids.push(num);
      }
    } else if (typeof item === 'object' && item !== null) {
      if (item.id !== undefined && item.id !== null) {
        const num = Number(item.id);
        if (!isNaN(num) && !ids.includes(num)) ids.push(num);
      }
    }
  }
  return ids;
};

export const parseAvoidedIngredients = (raw: any): AvoidedIngredient[] => {
  if (!raw) return [];

  let parsed = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else if (trimmed.includes(',')) {
      parsed = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    } else if (trimmed !== '') {
      parsed = [trimmed];
    } else {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    if (typeof parsed === 'object' && parsed !== null) {
      parsed = [parsed];
    } else {
      return [];
    }
  }

  return parsed.map((item: any) => {
    if (typeof item === 'object' && item !== null) {
      const id = typeof item.id === 'number' ? item.id : (item.id ? parseInt(String(item.id), 10) || null : null);
      const name = item.name || item.ingredient || item.label || item.title || (id ? `Ingredient #${id}` : '');
      return { id, name: String(name).trim() };
    }
    if (typeof item === 'number') {
      return { id: item, name: `Ingredient #${item}` };
    }
    const str = String(item).trim();
    return { id: null, name: str };
  }).filter(ing => ing.name.length > 0 || ing.id !== null);
};
