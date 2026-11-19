/**
 * 5-tier color scale for score cards (0-100) in increments of 20:
 * - 0 to 20: Red
 * - 20 to 40: Orange
 * - 40 to 60: Yellow / Amber
 * - 60 to 80: Light Green / Lime
 * - 80 to 100: Green / Emerald
 */

export interface ScoreColorConfig {
  tier: number; // 1 to 5 (0 for pending/unknown)
  rangeLabel: string; // '0–20', '20–40', etc.
  statusLabel: string; // 'Critical', 'Needs Improvement', 'Moderate', 'Good', 'Optimal'
  badgeBg: string; // Refined badge styles
  pillClasses: string; // Saturated pill badge styles
  barBg: string; // Progress bar fill class
  cardBg: string; // Card background tint
  cardBorder: string; // Card border class
  textColor: string; // Text color class
}

export function getScoreTier(score: number | undefined | null): number {
  if (score === undefined || score === null || isNaN(score)) return 0;
  if (score < 20) return 1; // 0 to 20
  if (score < 40) return 2; // 20 to 40
  if (score < 60) return 3; // 40 to 60
  if (score < 80) return 4; // 60 to 80
  return 5; // 80 to 100
}

export function getScoreColorConfig(score: number | undefined | null): ScoreColorConfig {
  const tier = getScoreTier(score);

  switch (tier) {
    case 1: // 0 to 20: Red
      return {
        tier: 1,
        rangeLabel: '0–20',
        statusLabel: 'Poor',
        badgeBg: 'bg-red-50 text-red-700 border-red-200',
        pillClasses: 'bg-red-100 text-red-800 border-red-300',
        barBg: 'bg-red-500',
        cardBg: 'bg-red-50/40',
        cardBorder: 'border-red-200',
        textColor: 'text-red-700',
      };
    case 2: // 20 to 40: Orange
      return {
        tier: 2,
        rangeLabel: '20–40',
        statusLabel: 'Fair',
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
        pillClasses: 'bg-orange-100 text-orange-800 border-orange-300',
        barBg: 'bg-orange-500',
        cardBg: 'bg-orange-50/40',
        cardBorder: 'border-orange-200',
        textColor: 'text-orange-700',
      };
    case 3: // 40 to 60: Yellow / Amber
      return {
        tier: 3,
        rangeLabel: '40–60',
        statusLabel: 'Moderate',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        pillClasses: 'bg-amber-100 text-amber-800 border-amber-300',
        barBg: 'bg-amber-500',
        cardBg: 'bg-amber-50/40',
        cardBorder: 'border-amber-200',
        textColor: 'text-amber-700',
      };
    case 4: // 60 to 80: Light Green / Lime
      return {
        tier: 4,
        rangeLabel: '60–80',
        statusLabel: 'Good',
        badgeBg: 'bg-lime-50 text-lime-800 border-lime-300',
        pillClasses: 'bg-lime-100 text-lime-800 border-lime-300',
        barBg: 'bg-lime-500',
        cardBg: 'bg-lime-50/40',
        cardBorder: 'border-lime-200',
        textColor: 'text-lime-800',
      };
    case 5: // 80 to 100: Green / Emerald
      return {
        tier: 5,
        rangeLabel: '80–100',
        statusLabel: 'Optimal',
        badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        pillClasses: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        barBg: 'bg-emerald-500',
        cardBg: 'bg-emerald-50/40',
        cardBorder: 'border-emerald-200',
        textColor: 'text-emerald-800',
      };
    default:
      return {
        tier: 0,
        rangeLabel: 'N/A',
        statusLabel: 'Pending',
        badgeBg: 'bg-[#FAF7F0] text-[#73716C] border-[#EAE9E5]',
        pillClasses: 'bg-neutral-100 text-neutral-600 border-neutral-200',
        barBg: 'bg-[#73716C]',
        cardBg: 'bg-black/[0.02]',
        cardBorder: 'border-black/10',
        textColor: 'text-[#73716C]',
      };
  }
}
