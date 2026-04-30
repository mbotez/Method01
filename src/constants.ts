export interface Product {
  id: string;
  type: string;
  brand: string;
  name: string;
  description: string;
  ingredients: string[];
  price: number;
}

export const INVENTORY: Product[] = [
  // Cleansers
  {
    id: 'c1',
    type: 'Cleanser',
    brand: 'Venus Radiance',
    name: 'Glow Gentle Cleanser',
    description: 'Mild foaming cleanser with Vitamin C and Green Tea.',
    ingredients: ['Vitamin C', 'Green Tea'],
    price: 24
  },
  {
    id: 'c2',
    type: 'Cleanser',
    brand: 'Natura',
    name: 'Purifying Clay Wash',
    description: 'Deep cleaning for oily skin with Kaolin clay.',
    ingredients: ['Kaolin Clay', 'Salicylic Acid'],
    price: 18
  },
  {
    id: 'c3',
    type: 'Cleanser',
    brand: 'Silk',
    name: 'Hydrating Cream Cleanser',
    description: 'Ultra-gentle for dry, sensitive skin.',
    ingredients: ['Ceramides', 'Glycerin'],
    price: 22
  },
  // Serums
  {
    id: 's1',
    type: 'Serum',
    brand: 'Essence',
    name: 'Anti-Aging Elixir',
    description: 'Retinol based serum for fine lines.',
    ingredients: ['Retinol', 'Bakuchiol'],
    price: 45
  },
  {
    id: 's2',
    type: 'Serum',
    brand: 'Venus Radiance',
    name: 'Blemish Control Drop',
    description: 'Targeted acne treatment with Niacinamide.',
    ingredients: ['Niacinamide', 'Zinc'],
    price: 32
  },
  {
    id: 's3',
    type: 'Serum',
    brand: 'Dewy',
    name: 'Plumping Hyaluronic',
    description: 'Deep hydration for dull, dry skin.',
    ingredients: ['Hyaluronic Acid', 'B5'],
    price: 28
  },
  // Moisturizers
  {
    id: 'm1',
    type: 'Moisturizer',
    brand: 'Venus Radiance',
    name: 'Luminous Day Cream',
    description: 'Lightweight moisturizer with SPF 30.',
    ingredients: ['Peptides', 'SPF'],
    price: 38
  },
  {
    id: 'm2',
    type: 'Moisturizer',
    brand: 'Deep Restore',
    name: 'Rich Barrier Repair',
    description: 'Thick moisturizer for intense nighttime recovery.',
    ingredients: ['Squalane', 'Shea Butter'],
    price: 42
  },
  {
    id: 'm3',
    type: 'Moisturizer',
    brand: 'Balance',
    name: 'Oil-Free Water Gel',
    description: 'Instantly absorbing hydration for oily skin.',
    ingredients: ['Hyaluronic Acid', 'Witch Hazel'],
    price: 30
  }
];
