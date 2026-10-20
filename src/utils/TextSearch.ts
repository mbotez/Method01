import { supabase } from '../lib/supabase';

export const searchProducts = async (searchQuery: string, filter: string = 'All') => {
  if (!searchQuery.trim() && filter === 'All') {
    return [];
  }

  let query = supabase
    .from('products')
    .select('id, brand, name, type, photo_url');

  if (searchQuery.trim()) {
    const formattedQuery = searchQuery
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map(word => `${word}:*`)
      .join(' & ');
    query = query.textSearch('fts_search', formattedQuery, { config: 'english' });
  }

  if (filter !== 'All') {
    query = query.ilike('type', filter);
  }

  const { data } = await query.limit(10);
  return data || [];
};
