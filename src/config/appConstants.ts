export const SKIN_CONCERN_OPTIONS = [
  { id: 1, label: 'Breakouts & post-breakout marks' },
  { id: 2, label: 'Redness' },
  { id: 3, label: 'Dark Spots' },
  { id: 4, label: 'Dullness' },
  { id: 5, label: 'Dryness' },
  { id: 6, label: 'Oily skin' },
  { id: 7, label: 'Wrinkles & fine lines' },
  { id: 8, label: 'Large pores & texture' },
  { id: 9, label: 'Sensitivity' },
  { id: 10, label: 'Extremely dry flaky skin' },
  { id: 11, label: 'Yeast-reactive skin' },
  { id: 12, label: 'Not sure' },
];

export const CAT3_MAPPING: Record<string, { id: number, name: string }[]> = {
  "Cleanser": [
    { id: 1, name: "Facewash" },
    { id: 2, name: "Makeup Remover" },
    { id: 3, name: "Exfoliator" },
    { id: 7, name: "Oil" },
    { id: 14, name: "Pad" },
    { id: 15, name: "Scrub" }
  ],
  "Moisturiser": [
    { id: 6, name: "Cream" },
    { id: 7, name: "Oil" },
    { id: 10, name: "Eyecare" },
    { id: 11, name: "Lipcare" },
    { id: 16, name: "Mask" }
  ],
  "Treatment": [
    { id: 3, name: "Exfoliator" },
    { id: 4, name: "Serum" },
    { id: 5, name: "Toner" },
    { id: 7, name: "Oil" },
    { id: 12, name: "Spot Treatment" },
    { id: 14, name: "Pad" },
    { id: 15, name: "Scrub" },
    { id: 16, name: "Mask" }
  ],
  "Targeted": [
    { id: 4, name: "Serum" },
    { id: 5, name: "Toner" },
    { id: 6, name: "Cream" },
    { id: 10, name: "Eyecare" },
    { id: 11, name: "Lipcare" },
    { id: 12, name: "Spot Treatment" },
    { id: 13, name: "Patch" },
    { id: 14, name: "Pad" },
    { id: 16, name: "Mask" }
  ],
  "SPF": [
    { id: 8, name: "Mineral SPF" },
    { id: 9, name: "Chemical SPF" },
    { id: 11, name: "Lipcare" }
  ]
};

export const ACTIVES_TEXT_MAP: Record<number | string, string> = {
  1: 'Prescription retinoids (tretinoin, adapalene etc)',
  2: 'Over-the-counter retinols',
  3: 'Exfoliating acids (salicylic, glycolic etc)',
  4: "None/ I'm not sure"
};

export const ACTIVE_SKINCARE_OPTIONS = [
  { id: 1, label: 'Prescription retinoids (tretinoin, adapalene etc)' },
  { id: 2, label: 'Over-the-counter retinols' },
  { id: 3, label: 'Exfoliating acids (salicylic, glycolic etc)' },
  { id: 4, label: "None/ I'm not sure" }
] as const;

export const DEFAULT_LANDING_ARTICLES = [
  {
    id: 'layering-mastery',
    title: 'The Ultimate Skincare Layering Order',
    category: 'Layering',
    readTime: '4 min read',
    article_content: 'Master the exact order of application from thinnest water-based textures to richest lipid creams to guarantee maximum dermal absorption without pilling or flushing.',
    image_url: '/assets/g1.jpg',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    article_link: '#'
  },
  {
    id: 'actives-compatibility',
    title: 'Active Ingredients Compatibility Matrix',
    category: 'Actives',
    readTime: '5 min read',
    article_content: 'The go-to reference table explaining which dermatological actives can be combined in the same regimen, and which combinations cause chemical degradation or micro-inflammation.',
    image_url: '/assets/g2.jpg',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    article_link: '#'
  },
  {
    id: 'barrier-repair',
    title: 'Barrier Repair & Stratum Corneum Recovery',
    category: 'Barrier',
    readTime: '4 min read',
    article_content: 'How to identify an acid-mantle breakdown, eliminate micro-irritants, and rapidly restore compromised skin using physiological 3:1:1:1 lipid ratios.',
    image_url: '/assets/g3.jpg',
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    article_link: '#'
  }
];

export const MOBILE_ROW_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
export const MOBILE_DROPDOWN_LETTERS = ['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
export const WEB_ROW_1_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
export const WEB_ROW_2_LETTERS = ['N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
