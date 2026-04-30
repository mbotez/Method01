-- Supabase Schema for Method 01 Skincare App

-- 1. Create tables

-- Drop tables first to ensure clean state
DROP TABLE IF EXISTS public.progress CASCADE;
DROP TABLE IF EXISTS public.routines CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Users Table
CREATE TABLE public.users (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  email text,
  username text,
  skin_type text,
  primary_issue text,
  onboarding_complete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Products Table
CREATE TABLE public.products (
  id text PRIMARY KEY, -- Using text to match 'c1', 's1', etc. from your constants
  brand text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  description text,
  price numeric,
  ingredients jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Routines Table
CREATE TABLE public.routines (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) NOT NULL,
  routine_name text,
  notes text,
  time text NOT NULL, -- e.g., 'AM', 'PM'
  days jsonb DEFAULT '[]'::jsonb,
  products jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Progress Table
CREATE TABLE public.progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) NOT NULL,
  image_url text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- UPP Table
CREATE TABLE public.upp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) NOT NULL,
  product_name text NOT NULL,
  product_brand text NOT NULL,
  category text, 
  impression text, 
  notes text,
  personal_score numeric,
  length text,
  frequency text,
  created_at timestamp with time zone DEFAULT now()
);

-- Nudge function
CREATE OR REPLACE FUNCTION nudge_lower_scores(
  p_user_id uuid,
  p_category text,
  p_impression text,
  p_exclude_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE public.upp
  SET personal_score = personal_score - 0.2
  WHERE user_id = p_user_id
    AND category = p_category
    AND impression = p_impression
    AND id != p_exclude_id
    AND personal_score > 0.2; 
END;
$$ LANGUAGE plpgsql;

-- Note: If table already exists, use:
-- ALTER TABLE public.upp ALTER COLUMN personal_score TYPE numeric;

-- 2. Set up RLS (Row Level Security)

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upp ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.upp TO authenticated;

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users 
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users 
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Products policies
CREATE POLICY "Anyone can view products" ON public.products 
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage products" ON public.products 
  FOR ALL USING (auth.role() = 'authenticated');

-- Routines policies
CREATE POLICY "Users can view their own routines" ON public.routines 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own routines" ON public.routines 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routines" ON public.routines 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routines" ON public.routines 
  FOR DELETE USING (auth.uid() = user_id);

-- Progress policies
CREATE POLICY "Users can view their own progress" ON public.progress 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress" ON public.progress 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON public.progress 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress" ON public.progress 
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own UPP" ON public.upp 
  FOR ALL USING (auth.uid() = user_id);

-- 3. Seed Products (Optional but matches frontend INVENTORY)
INSERT INTO public.products (id, brand, name, type, description, price, ingredients) VALUES
('c1', 'Venus Radiance', 'Glow Gentle Cleanser', 'Cleanser', 'Mild foaming cleanser with Vitamin C and Green Tea.', 24, '["Vitamin C", "Green Tea"]'::jsonb),
('c2', 'Natura', 'Purifying Clay Wash', 'Cleanser', 'Deep cleaning for oily skin with Kaolin clay.', 18, '["Kaolin Clay", "Salicylic Acid"]'::jsonb),
('c3', 'Silk', 'Hydrating Cream Cleanser', 'Cleanser', 'Ultra-gentle for dry, sensitive skin.', 22, '["Ceramides", "Glycerin"]'::jsonb),
('s1', 'Essence', 'Anti-Aging Elixir', 'Serum', 'Retinol based serum for fine lines.', 45, '["Retinol", "Bakuchiol"]'::jsonb),
('s2', 'Venus Radiance', 'Blemish Control Drop', 'Serum', 'Targeted acne treatment with Niacinamide.', 32, '["Niacinamide", "Zinc"]'::jsonb),
('s3', 'Dewy', 'Plumping Hyaluronic', 'Serum', 'Deep hydration for dull, dry skin.', 28, '["Hyaluronic Acid", "B5"]'::jsonb),
('m1', 'Venus Radiance', 'Luminous Day Cream', 'Moisturizer', 'Lightweight moisturizer with SPF 30.', 38, '["Peptides", "SPF"]'::jsonb),
('m2', 'Deep Restore', 'Rich Barrier Repair', 'Moisturizer', 'Thick moisturizer for intense nighttime recovery.', 42, '["Squalane", "Shea Butter"]'::jsonb),
('m3', 'Balance', 'Oil-Free Water Gel', 'Moisturizer', 'Instantly absorbing hydration for oily skin.', 30, '["Hyaluronic Acid", "Witch Hazel"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
