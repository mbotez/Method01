import { supabase } from '../lib/supabase';

export const searchProducts = async (searchQuery: string, filter: string = 'All', limit: number = 15) => {
  const q = searchQuery.trim();

  if (!q && filter === 'All') {
    return [];
  }

  let results: any[] = [];

  if (q) {
    try {
      const rawWords = q.split(/\s+/).filter(w => w.length > 0);

      // 1. First attempt: Prefix full-text search across tokens
      const ftsWords = rawWords
        .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
        .filter(w => w.length > 0)
        .map(w => `${w}:*`);

      const formattedQuery = ftsWords.length > 0 ? ftsWords.join(' & ') : '';

      if (formattedQuery) {
        let query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', formattedQuery, { config: 'english' });

        if (filter !== 'All') {
          query = query.ilike('type', filter);
        }

        const { data, error } = await query.limit(limit);
        if (!error && data && data.length > 0) {
          results = data;
        }
      }

      // 2. Second attempt: websearch FTS mode if prefix search gave no results
      if (results.length === 0) {
        let webQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', q, { config: 'english', type: 'websearch' });

        if (filter !== 'All') {
          webQuery = webQuery.ilike('type', filter);
        }

        const { data: webData, error: webError } = await webQuery.limit(limit);
        if (!webError && webData && webData.length > 0) {
          results = webData;
        }
      }

      // 3. Third attempt: Multi-word ILIKE chaining across full_name & type
      // Matches products where all words are present in full_name (brand + name) or type,
      // regardless of order or word separation.
      if (results.length === 0 && rawWords.length > 0) {
        let ilikeQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, full_name');

        for (const word of rawWords) {
          const sanitizedWord = word.replace(/[,()]/g, '').trim();
          if (sanitizedWord) {
            ilikeQuery = ilikeQuery.or(`full_name.ilike.%${sanitizedWord}%,type.ilike.%${sanitizedWord}%`);
          }
        }

        if (filter !== 'All') {
          ilikeQuery = ilikeQuery.ilike('type', filter);
        }

        const { data: ilikeData, error: ilikeError } = await ilikeQuery.limit(limit);
        if (!ilikeError && ilikeData && ilikeData.length > 0) {
          results = ilikeData;
        }
      }

      // 4. Fourth attempt: Substring or fallback
      if (results.length === 0) {
        let fallbackQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .or(`brand.ilike.%${q}%,name.ilike.%${q}%`);

        if (filter !== 'All') {
          fallbackQuery = fallbackQuery.ilike('type', filter);
        }

        const { data: fallbackData } = await fallbackQuery.limit(limit);
        results = fallbackData || [];
      }
    } catch (err: any) {
      // Safe fallback if any network or query syntax error happens
      try {
        const rawWords = q.split(/\s+/).filter(w => w.length > 0);
        let safeQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url, full_name');

        for (const word of rawWords) {
          const sanitized = word.replace(/[,()]/g, '').trim();
          if (sanitized) {
            safeQuery = safeQuery.or(`full_name.ilike.%${sanitized}%,type.ilike.%${sanitized}%`);
          }
        }

        if (filter !== 'All') {
          safeQuery = safeQuery.ilike('type', filter);
        }

        const { data } = await safeQuery.limit(limit);
        results = data || [];
      } catch (innerErr: any) {
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

  const { data, error } = await query.limit(limit);
  return data || [];
};
