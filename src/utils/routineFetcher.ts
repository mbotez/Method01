import { supabase } from '../lib/supabase';

export interface LiveProductAttributes {
  id: number | string;
  brand: string;
  name: string;
  type: string;
  photo_url?: string | null;
  cat2?: string;
  cat3?: number;
  pregnancy_safe?: boolean;
  viscosity?: number;
  has_aha_active?: boolean;
  has_bha_active?: boolean;
  contains_aha_bha?: boolean;
  c_ahabha?: boolean;
  active_antagonistic_group?: string;
  has_high_irritation?: boolean;
  has_fragrance_top50?: boolean;
  has_yeast_trigger?: boolean;
  oil_control?: number;
  clear_blackheads?: number;
  clear_whiteheads?: number;
  clear_surface_breakouts?: number;
  soothe_deep_breakouts?: number;
  reduce_wrinkles?: number;
  fade_pie?: number;
  fade_pih?: number;
  product_scores?: any;
  products_filter?: any;
}

/**
 * Hydrates an array of routine objects whose `products` array contains
 * static JSON snapshots by performing a live join against `products`,
 * `product_scores`, and `products_filter` tables in Supabase.
 */
export async function hydrateRoutineProducts(routines: any[]): Promise<any[]> {
  if (!routines || routines.length === 0) return [];

  // Extract all distinct product IDs across all routines
  const allProductIds = Array.from(
    new Set(
      routines
        .flatMap((rt: any) =>
          (Array.isArray(rt.products) ? rt.products : []).map(
            (p: any) => p.id ?? p.product_id
          )
        )
        .filter((id: any) => id !== undefined && id !== null)
    )
  );

  if (allProductIds.length === 0) {
    return routines;
  }

  const numericIds = allProductIds
    .map((id) => Number(id))
    .filter((id) => !isNaN(id));

  if (numericIds.length === 0) {
    return routines;
  }

  // Live queries against products, product_scores, and products_filter in parallel
  // to avoid fragile foreign-key relation names and guarantee fresh live data.
  const [prodsRes, scoresRes, filterRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, brand, name, type, photo_url, user_add')
      .in('id', numericIds),
    supabase
      .from('product_scores')
      .select('*')
      .in('product_id', numericIds),
    supabase
      .from('products_filter')
      .select('*')
      .in('product_id', numericIds)
  ]);

  const prodMap = new Map<number, any>();
  if (prodsRes.data) {
    prodsRes.data.forEach((p: any) => prodMap.set(Number(p.id), p));
  }

  const scoreMap = new Map<number, any>();
  if (scoresRes.data) {
    scoresRes.data.forEach((s: any) => scoreMap.set(Number(s.product_id), s));
  }

  const filterMap = new Map<number, any>();
  if (filterRes.data) {
    filterRes.data.forEach((f: any) => filterMap.set(Number(f.product_id), f));
  }

  const liveProductMap = new Map<string, LiveProductAttributes>();

  for (const id of numericIds) {
    const p = prodMap.get(id) || {};
    const s = scoreMap.get(id) || {};
    const f = filterMap.get(id) || {};

    // Check if contains_aha_bha or AHA/BHA flags were explicitly set to false
    const explicitAhaBhaFalse =
      (s as any).contains_aha_bha === false ||
      (s as any).contains_aha_bha === 'false' ||
      (p as any).contains_aha_bha === false ||
      (p as any).contains_aha_bha === 'false' ||
      ((s as any).has_aha_active === false &&
        (s as any).has_bha_active === false &&
        (f as any).c_ahabha === false);

    const hasAhaBha =
      !explicitAhaBhaFalse &&
      Boolean(
        (s as any).contains_aha_bha ||
        (p as any).contains_aha_bha ||
        s.has_aha_active ||
        s.has_bha_active ||
        f.c_ahabha
      );

    const activeAntagonisticGroup =
      explicitAhaBhaFalse && s.active_antagonistic_group === 'AHA_BHA_Exfoliant'
        ? 'None'
        : (s.active_antagonistic_group ||
          (hasAhaBha ? 'AHA_BHA_Exfoliant' : 'None'));

    const brand = p.brand || s.product_name || '';
    const name = p.name || s.product_name || '';
    const type = s.cat2 || p.type || 'Custom';

    liveProductMap.set(String(id), {
      id,
      brand,
      name,
      type,
      photo_url: p.photo_url || null,
      cat2: s.cat2 || type,
      cat3: s.cat3,
      pregnancy_safe:
        s.pregnancy_safe !== undefined
          ? s.pregnancy_safe
          : f.preg_safe !== undefined
          ? f.preg_safe
          : true,
      viscosity: s.viscosity,
      has_aha_active: explicitAhaBhaFalse ? false : Boolean(s.has_aha_active),
      has_bha_active: explicitAhaBhaFalse ? false : Boolean(s.has_bha_active),
      contains_aha_bha: hasAhaBha,
      c_ahabha: explicitAhaBhaFalse ? false : Boolean(f.c_ahabha),
      active_antagonistic_group: activeAntagonisticGroup,
      has_high_irritation: Boolean(s.has_high_irritation),
      has_fragrance_top50: Boolean(s.has_fragrance_top50),
      has_yeast_trigger: Boolean(s.has_yeast_trigger),
      oil_control: s.oil_control ?? 0,
      clear_blackheads: s.clear_blackheads ?? 0,
      clear_whiteheads: s.clear_whiteheads ?? 0,
      clear_surface_breakouts: s.clear_surface_breakouts ?? 0,
      soothe_deep_breakouts: s.soothe_deep_breakouts ?? 0,
      reduce_wrinkles: s.reduce_wrinkles ?? 0,
      fade_pie: s.fade_pie ?? 0,
      fade_pih: s.fade_pih ?? 0,
      product_scores: s,
      products_filter: f
    });
  }

  // Hydrate each routine by merging live product attributes into the static snapshots
  return routines.map((rt: any) => {
    const rawProds = Array.isArray(rt.products) ? rt.products : [];
    const hydratedProds = rawProds.map((snap: any) => {
      const pid = String(snap.id ?? snap.product_id);
      const live = liveProductMap.get(pid);
      if (!live) {
        return snap;
      }
      return {
        ...snap,
        ...live,
        id: snap.id ?? live.id,
        // Ensure live brand, name, and type always override stale snapshot fields
        brand: live.brand || snap.brand,
        name: live.name || snap.name,
        type: live.type || snap.type,
        photo_url: live.photo_url || snap.photo_url
      };
    });

    return {
      ...rt,
      products: hydratedProds
    };
  });
}

/**
 * Fetches user routines with live joined product attributes.
 * Attempts the database RPC function first (if provisioned), and seamlessly
 * falls back to a live relational join across `routines`, `products`,
 * `product_scores`, and `products_filter`.
 */
export async function fetchRoutinesWithLiveProducts(
  userId: string,
  signal?: AbortSignal
): Promise<any[]> {
  if (!userId) return [];

  // 1. Attempt database RPC function if available in Supabase
  try {
    let rpcQuery = supabase.rpc('get_routines_with_live_products', {
      p_user_id: userId
    });
    if (signal) {
      rpcQuery = rpcQuery.abortSignal(signal);
    }
    const { data: rpcData, error: rpcError } = await rpcQuery;
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return rpcData;
    }
  } catch {
    // Graceful fallback to client-side live join
  }

  // 2. Query routines directly
  let query = supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true });

  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data: rawRoutines, error: routinesError } = await query;
  if (routinesError || !rawRoutines) {
    return [];
  }

  // 3. Live join and hydrate product attributes
  return await hydrateRoutineProducts(rawRoutines);
}
