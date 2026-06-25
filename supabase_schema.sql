-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL,
  skin_type text,
  primary_issue text,
  onboarding_complete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  username text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.routines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  time text NOT NULL,
  days jsonb DEFAULT '[]'::jsonb,
  products jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  routine_name text,
  notes text,
  reminder text,
  CONSTRAINT routines_pkey PRIMARY KEY (id),
  CONSTRAINT routines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  rating integer,
  notes text,
  CONSTRAINT progress_pkey PRIMARY KEY (id),
  CONSTRAINT progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.upp (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_name text NOT NULL,
  product_brand text NOT NULL,
  category text,
  impression text,
  notes text,
  personal_score numeric,
  created_at timestamp with time zone DEFAULT now(),
  length text,
  frequency text,
  type text,
  CONSTRAINT upp_pkey PRIMARY KEY (id),
  CONSTRAINT upp_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tracker (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  brand text,
  product_name text,
  product_type text,
  routine_time text,
  ingredients text,
  size text,
  notes text,
  in_use boolean DEFAULT true,
  is_liked boolean DEFAULT false,
  repurchase boolean DEFAULT false,
  best_by_date date,
  open_date date,
  poa text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  photo_url text,
  product_id text,
  product_verdict text,
  CONSTRAINT tracker_pkey PRIMARY KEY (id),
  CONSTRAINT tracker_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.follows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT follows_pkey PRIMARY KEY (id),
  CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id),
  CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id)
);
CREATE TABLE public.posts (
  post_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  content text NOT NULL,
  post_media text,
  timestamp timestamp with time zone DEFAULT now(),
  is_article boolean DEFAULT false,
  CONSTRAINT posts_pkey PRIMARY KEY (post_id),
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(post_id),
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_contacts (
  user_id uuid NOT NULL,
  email text,
  CONSTRAINT user_contacts_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_profile (
  id uuid NOT NULL,
  skin_type text,
  age text,
  skin_tone integer,
  burn_risk text,
  symptoms integer,
  new_product_reaction integer,
  barrier_risk integer,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  sensitivity jsonb DEFAULT '[]'::jsonb,
  goals jsonb DEFAULT '[]'::jsonb,
  breakout_type jsonb DEFAULT '[]'::jsonb,
  breakout_where text,
  env text,
  sunscreen text,
  makeup text,
  makeup_remove text,
  current_products jsonb DEFAULT '[]'::jsonb,
  past_problems text,
  redness smallint,
  redness_score integer,
  wrinkles_score integer,
  redness_main_area text,
  wrinkels_main_area text,
  scan_acne_type text,
  sex text,
  pregnant text,
  actives_used ARRAY DEFAULT '{}'::text[],
  CONSTRAINT user_profile_pkey PRIMARY KEY (id),
  CONSTRAINT user_profile_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  message text NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id),
  CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id)
);
CREATE TABLE public.ingredient_scores (
  ingredient text,
  Breakouts_Acne bigint,
  Oiliness bigint,
  Clogged_Pores_Blackheads bigint,
  Dry_Skin bigint,
  Large_Pores_Texture bigint,
  Dark_Spots bigint,
  Dullness bigint,
  Redness bigint,
  Elasticity_Loss bigint,
  Barrier_Repair bigint,
  Dry_Skin_Type bigint,
  Oily_Skin_Type bigint,
  Combination_Skin_Type bigint,
  Normal_Skin_Type bigint,
  UV_Sensitive text,
  pH_Dependent_Active boolean,
  Antagonistic_Group text,
  Fatty_Acid_Profile text,
  Tyrosinase_Inhibitor text,
  Vasoconstrictor boolean,
  Penetration_Enhancer boolean,
  Astringent boolean,
  Cell_Turnover_Accelerator boolean,
  Pregnancy_Safe boolean,
  Fungal_Acne_Trigger boolean,
  High_Irritation_Risk boolean,
  Essential_Oils_Fragrance boolean
);
CREATE TABLE public.product_ingredients (
  product_id bigint,
  Full name text,
  Position bigint,
  ingredient text,
  CONSTRAINT fk_product_ingredients_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.products (
  id bigint NOT NULL,
  brand text,
  name text,
  full_name text,
  photo_url text,
  type text,
  description text,
  created_at timestamp with time zone,
  user_add boolean,
  user_id uuid,
  fts_search tsvector DEFAULT to_tsvector('english'::regconfig, ((COALESCE(brand, ''::text) || ' '::text) || COALESCE(name, ''::text))),
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_description (
  id bigint NOT NULL,
  product_name text,
  description text,
  ingredients_list text,
  CONSTRAINT product_description_pkey PRIMARY KEY (id)
);