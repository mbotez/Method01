import { supabase } from '../lib/supabase';

export const searchProducts = async (searchQuery: string, filter: string = 'All') => {
  const q = searchQuery.trim();
  if (!q && filter === 'All') {
    return [];
  }

  let results: any[] = [];

  if (q) {
    try {
      const words = q
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length > 0)
        .map(w => `${w}:*`);

      const formattedQuery = words.length > 0 ? words.join(' & ') : '';

      if (formattedQuery) {
        let query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', formattedQuery, { config: 'english' });

        if (filter !== 'All') {
          query = query.ilike('type', filter);
        }

        const { data, error } = await query.limit(15);
        if (!error && data && data.length > 0) {
          results = data;
        }
      }

      if (results.length === 0) {
        let webQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', q, { config: 'english', type: 'websearch' });

        if (filter !== 'All') {
          webQuery = webQuery.ilike('type', filter);
        }

        const { data: webData } = await webQuery.limit(15);
        if (webData && webData.length > 0) {
          results = webData;
        } else {
          let ilikeQuery = supabase
            .from('products')
            .select('id, brand, name, type, photo_url')
            .or(`brand.ilike.%${q}%,name.ilike.%${q}%`);

          if (filter !== 'All') {
            ilikeQuery = ilikeQuery.ilike('type', filter);
          }

          const { data: ilikeData } = await ilikeQuery.limit(15);
          results = ilikeData || [];
        }
      }
    } catch {
      // Fallback ILIKE
      try {
        let ilikeQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .or(`brand.ilike.%${q}%,name.ilike.%${q}%`);

        if (filter !== 'All') {
          ilikeQuery = ilikeQuery.ilike('type', filter);
        }

        const { data: ilikeData } = await ilikeQuery.limit(15);
        results = ilikeData || [];
      } catch {
        results = [];
      }
    }

    return results;
  }

  let query = supabase
    .from('products')
    .select('id, brand, name, type, photo_url');

  if (filter !== 'All') {
    query = query.ilike('type', filter);
  }

  const { data } = await query.limit(15);
  return data || [];
};
