import { supabase } from '../lib/supabase';

export const searchProducts = async (searchQuery: string, filter: string = 'All') => {
  const q = searchQuery.trim();
  console.log('[TextSearch] searchProducts invoked with query:', JSON.stringify(q), 'filter:', filter);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  console.log('[TextSearch] Auth session in searchProducts:', {
    hasSession: !!sessionData?.session,
    userEmail: sessionData?.session?.user?.email,
    provider: sessionData?.session?.user?.app_metadata?.provider,
    sessionError: sessionError?.message
  });

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
      console.log('[TextSearch] Formatted FTS query:', formattedQuery);

      if (formattedQuery) {
        let query = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', formattedQuery, { config: 'english' });

        if (filter !== 'All') {
          query = query.ilike('type', filter);
        }

        const { data, error } = await query.limit(15);
        console.log('[TextSearch] FTS query result - data count:', data?.length, 'error:', error);
        if (error) {
          console.error('[TextSearch] FTS query error details:', error);
        }
        if (!error && data && data.length > 0) {
          results = data;
        }
      }

      if (results.length === 0) {
        console.log('[TextSearch] FTS returned 0 results, trying websearch for q:', JSON.stringify(q));
        let webQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .textSearch('fts_search', q, { config: 'english', type: 'websearch' });

        if (filter !== 'All') {
          webQuery = webQuery.ilike('type', filter);
        }

        const { data: webData, error: webError } = await webQuery.limit(15);
        console.log('[TextSearch] websearch result - data count:', webData?.length, 'error:', webError);
        if (webError) {
          console.error('[TextSearch] websearch error details:', webError);
        }
        if (webData && webData.length > 0) {
          results = webData;
        } else {
          console.log('[TextSearch] websearch returned 0 results, trying ILIKE fallback for q:', JSON.stringify(q));
          let ilikeQuery = supabase
            .from('products')
            .select('id, brand, name, type, photo_url')
            .or(`brand.ilike.%${q}%,name.ilike.%${q}%`);

          if (filter !== 'All') {
            ilikeQuery = ilikeQuery.ilike('type', filter);
          }

          const { data: ilikeData, error: ilikeError } = await ilikeQuery.limit(15);
          console.log('[TextSearch] ILIKE query result - data count:', ilikeData?.length, 'error:', ilikeError);
          if (ilikeError) {
            console.error('[TextSearch] ILIKE query error details:', ilikeError);
          }
          results = ilikeData || [];
        }
      }
    } catch (err: any) {
      console.error('[TextSearch] Exception during searchProducts:', err);
      // Fallback ILIKE
      try {
        console.log('[TextSearch] Catch block: running ILIKE fallback');
        let ilikeQuery = supabase
          .from('products')
          .select('id, brand, name, type, photo_url')
          .or(`brand.ilike.%${q}%,name.ilike.%${q}%`);

        if (filter !== 'All') {
          ilikeQuery = ilikeQuery.ilike('type', filter);
        }

        const { data: ilikeData, error: ilikeError } = await ilikeQuery.limit(15);
        console.log('[TextSearch] Catch fallback ILIKE result count:', ilikeData?.length, 'error:', ilikeError);
        results = ilikeData || [];
      } catch (innerErr: any) {
        console.error('[TextSearch] Inner catch fallback error:', innerErr);
        results = [];
      }
    }

    console.log('[TextSearch] searchProducts final results count:', results.length);
    return results;
  }

  let query = supabase
    .from('products')
    .select('id, brand, name, type, photo_url');

  if (filter !== 'All') {
    query = query.ilike('type', filter);
  }

  const { data, error } = await query.limit(15);
  console.log('[TextSearch] empty query results count:', data?.length, 'error:', error);
  return data || [];
};
