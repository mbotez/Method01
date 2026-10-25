import { breakoutTypeStringToId } from '../utils/RoutineCheck';
export { breakoutTypeStringToId };

export const BREAKOUT_PHOTO_OPTIONS = [
  {
    value: 1,
    title: 'Surface Whiteheads',
    fullTitle: 'Blocked pores with closed white heads on the surface',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Whiteheads2.png'
  },
  {
    value: 2,
    title: 'Surface Blackheads',
    fullTitle: 'Blocked pores with open dark heads on the surface',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Blackheads.webp'
  },
  {
    value: 3,
    title: 'Post-Blemish Red Marks',
    fullTitle: 'Pink or red marks left after blemishes heal',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/PIE.png'
  },
  {
    value: 4,
    title: 'Post-Blemish Dark Spots',
    fullTitle: 'Dark spots left after blemishes heal',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/PIH.png'
  },
  {
    value: 5,
    title: 'Surface Bumps',
    fullTitle: 'Small surface bumps without visible heads',
    img: '/assets/surface_bumps.png'
  },
  {
    value: 6,
    title: 'General Congestion',
    fullTitle: 'Textured or clogged skin areas',
    img: 'https://stbperzlmmslrkdpqawt.supabase.co/storage/v1/object/public/Website%20art/Conglobate.png'
  },
  {
    value: 7,
    title: 'Surface Blemishes',
    fullTitle: 'Blemishes with visible surface heads',
    img: '/assets/surface_blemishes.png'
  },
  {
    value: 8,
    title: 'Deep & Tender Bumps',
    fullTitle: 'Deep or firm congestion',
    img: ''
  }
];

export type BreakoutOptionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface BreakoutOption {
  value: number | string;
  title: string;
  fullTitle: string;
  img: string;
}

export function getBreakoutOption(id: number | string): BreakoutOption | undefined {
  const numId = typeof id === 'number' ? id : parseInt(id, 10);
  if (!isNaN(numId)) {
    return BREAKOUT_PHOTO_OPTIONS.find(o => o.value === numId);
  }
  // Lookup in sanitized map
  const mapped = breakoutTypeStringToId[String(id).toLowerCase().trim()];
  return mapped ? BREAKOUT_PHOTO_OPTIONS.find(o => o.value === mapped) : undefined;
}

export function getBreakoutTitle(id: number | string, fallback?: string): string {
  const opt = getBreakoutOption(id);
  return opt ? opt.title : (fallback || String(id));
}

