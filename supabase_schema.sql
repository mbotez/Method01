-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.users (
  id uuid NOT NULL,
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
  tags ARRAY DEFAULT '{}'::text[],
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
  CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT fk_comments_users FOREIGN KEY (user_id) REFERENCES public.users(id)
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
  burn_risk text,
  skin_characteristics integer,
  new_product_reaction integer,
  barrier_status integer,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  sensitivity jsonb DEFAULT '[]'::jsonb,
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
  scan_breakout_type text,
  sex text,
  pregnant text,
  actives_used ARRAY DEFAULT '{}'::text[],
  main_concern integer,
  scnd_concern integer,
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
  Breakouts_Blemishes bigint,
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
  Yeast_Trigger boolean,
  High_Irritation_Risk boolean,
  Essential_Oils_Fragrance boolean,
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  CONSTRAINT ingredient_scores_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_ingredients (
  product_id bigint NOT NULL,
  Full name text NOT NULL,
  Position bigint,
  ingredient text,
  row_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  ingredient_id integer,
  CONSTRAINT product_ingredients_pkey PRIMARY KEY (row_id),
  CONSTRAINT fk_product_ingredients_ingredient_scores FOREIGN KEY (ingredient_id) REFERENCES public.ingredient_scores(id),
  CONSTRAINT fk_product_ingredients_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.products (
  id bigint NOT NULL,
  brand text,
  name text,
  full_name text,
  photo_url text,
  type text,
  created_at timestamp with time zone,
  user_add boolean,
  user_id uuid,
  fts_search tsvector DEFAULT to_tsvector('english'::regconfig, ((COALESCE(brand, ''::text) || ' '::text) || COALESCE(name, ''::text))),
  trending boolean DEFAULT false,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_description (
  id bigint NOT NULL,
  product_name text,
  description text,
  ingredients_list text,
  CONSTRAINT product_description_pkey PRIMARY KEY (id)
);
CREATE TABLE public.blog_videos (
  id bigint NOT NULL DEFAULT nextval('blog_videos_id_seq'::regclass),
  video_id text NOT NULL,
  video_url text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['tiktok'::text, 'youtube'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  tags ARRAY DEFAULT '{}'::text[],
  CONSTRAINT blog_videos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.video_products (
  id bigint NOT NULL DEFAULT nextval('video_products_id_seq'::regclass),
  video_table_id bigint,
  product_id bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT video_products_pkey PRIMARY KEY (id),
  CONSTRAINT fk_video_products_products FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT video_products_video_table_id_fkey FOREIGN KEY (video_table_id) REFERENCES public.blog_videos(id)
);
CREATE TABLE public.product_scores (
  product_id bigint NOT NULL,
  product_name text,
  cat1 text,
  cat2 text,
  cat3 integer,
  pregnancy_safe boolean,
  vehicle integer,
  liposomal text,
  viscosity integer,
  skin_types_to_avoid text,
  barrier_states_to_avoid integer,
  barrier_repair_dry_skin integer,
  barrier_repair_oily_skin integer,
  barrier_repair_combi_skin integer,
  hydration_dry_skin integer,
  hydration_oily_skin integer,
  hydration_combi_skin integer,
  oil_control integer,
  calm_redness_dry_skin integer,
  calm_redness_oily_skin integer,
  calm_redness_combi_skin integer,
  clear_blackheads integer,
  clear_whiteheads integer,
  clear_surface_breakouts integer,
  soothe_deep_breakouts integer,
  fade_pie integer,
  fade_pih integer,
  reduce_wrinkles integer,
  reg_type integer,
  type2_makeup text,
  type3_makeup text,
  has_brightening_ingredient boolean DEFAULT false,
  has_yeast_trigger boolean DEFAULT false,
  has_fragrance_top50 boolean DEFAULT false,
  has_high_irritation boolean DEFAULT false,
  has_bha_active boolean DEFAULT false,
  has_purifying_active boolean DEFAULT false,
  has_5alpha_reductase_inhibitor boolean DEFAULT false,
  synergy_breakout_response integer DEFAULT 0 CHECK (synergy_breakout_response >= '-5'::integer AND synergy_breakout_response <= 5),
  synergy_deep_breakout_penetration integer DEFAULT 0 CHECK (synergy_deep_breakout_penetration >= '-5'::integer AND synergy_deep_breakout_penetration <= 5),
  aggregated_clogging_risk integer DEFAULT 0 CHECK (aggregated_clogging_risk >= '-5'::integer AND aggregated_clogging_risk <= 5),
  fatty_acid_mismatch boolean DEFAULT false,
  has_vascular_calmer boolean DEFAULT false,
  has_melanin_inhibitor boolean DEFAULT false,
  active_antagonistic_group character varying DEFAULT 'None'::character varying,
  uv_sensitivity_required boolean DEFAULT false,
  disc character varying DEFAULT 'n'::character varying,
  night boolean DEFAULT false,
  contains_frag boolean DEFAULT false,
  oil_free boolean DEFAULT true,
  sulfate_free boolean DEFAULT true,
  has_aha_active boolean DEFAULT false,
  has_cell_turnover_accelerator boolean DEFAULT false,
  CONSTRAINT product_scores_pkey PRIMARY KEY (product_id),
  CONSTRAINT fk_product_scores_products FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_user_ratings (
  product_id text NOT NULL,
  user_id uuid NOT NULL,
  dwis smallint CHECK (dwis >= 1 AND dwis <= 5),
  price_value smallint CHECK (price_value >= 1 AND price_value <= 5),
  feel smallint CHECK (feel >= 1 AND feel <= 5),
  layer smallint CHECK (layer >= 1 AND layer <= 5),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_user_ratings_pkey PRIMARY KEY (product_id, user_id),
  CONSTRAINT product_user_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.articles (
  article_id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text,
  article_content text NOT NULL,
  article_link text,
  tags ARRAY DEFAULT '{}'::text[],
  image_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT articles_pkey PRIMARY KEY (article_id)
);
CREATE TABLE public.brands (
  brand_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  brand_name text NOT NULL UNIQUE,
  country text,
  sephora boolean DEFAULT false,
  spacenk boolean DEFAULT false,
  boots boolean DEFAULT false,
  harrods boolean DEFAULT false,
  selfridges boolean DEFAULT false,
  liberty boolean DEFAULT false,
  harvey boolean DEFAULT false,
  CONSTRAINT brands_pkey PRIMARY KEY (brand_id)
);
CREATE TABLE public.products_filter (
  product_id bigint NOT NULL,
  full_name text NOT NULL,
  c_retinol boolean DEFAULT false,
  c_ha boolean DEFAULT false,
  c_collagen boolean DEFAULT false,
  c_pdrn boolean DEFAULT false,
  c_vitc boolean DEFAULT false,
  c_vite boolean DEFAULT false,
  c_salicylic boolean DEFAULT false,
  c_niac boolean DEFAULT false,
  c_glycolic boolean DEFAULT false,
  blem_prone boolean DEFAULT false,
  red boolean DEFAULT false,
  dry boolean DEFAULT false,
  aging boolean DEFAULT false,
  k_beauty boolean DEFAULT false,
  j_beauty boolean DEFAULT false,
  glass boolean DEFAULT false,
  pdrn boolean DEFAULT false,
  natural boolean DEFAULT false,
  winter boolean DEFAULT false,
  men boolean DEFAULT false,
  preg_safe boolean DEFAULT false,
  c_ceramide boolean DEFAULT false,
  c_peptides boolean DEFAULT false,
  c_ahabha boolean DEFAULT false,
  CONSTRAINT products_filter_pkey PRIMARY KEY (product_id),
  CONSTRAINT products_filter_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_metric_culprits (
  metric_name text NOT NULL, -- Holds the product identifier (product_id or product_name)
  active_antagonistic_group text,
  aggregated_clogging_risk text,
  calm_redness text,
  clear_blackheads text,
  clear_surface_breakouts text,
  clear_whiteheads text,
  contains_frag text,
  fade_pie text,
  fade_pih text,
  has_5alpha_inh text,
  has_aha_active text,
  has_bha_active text,
  has_brightening_ingredient text,
  has_cell_turnover_accelerator text,
  has_fragrance_top50 text,
  has_high_irritation text,
  has_yeast_trigger text,
  reduce_wrinkles text,
  soothe_deep_breakouts text,
  synergy_breakout_response text,
  synergy_deep_breakout_penetration text,
  CONSTRAINT product_metric_culprits_pkey PRIMARY KEY (metric_name)
);
CREATE TABLE public.5alpha (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  ingredient_name text,
  ingredient_id integer,
  CONSTRAINT 5alpha_pkey PRIMARY KEY (id)
);

-- RPC Function: get_routines_with_live_products
-- Resolves the denormalization issue where routines.products stores a static snapshot.
-- Performs a live join from routines.products JSON elements into products, product_scores, and products_filter
-- so any updates to product attributes (e.g. contains_aha_bha, has_aha_active, brand, name, cat2) instantly reflect across all routines.
CREATE OR REPLACE FUNCTION public.get_routines_with_live_products(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'user_id', r.user_id,
      'time', r.time,
      'days', r.days,
      'routine_name', r.routine_name,
      'notes', r.notes,
      'reminder', r.reminder,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'products', (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', COALESCE(p.id, (elem->>'id')::bigint),
              'brand', COALESCE(p.brand, elem->>'brand'),
              'name', COALESCE(p.name, elem->>'name'),
              'type', COALESCE(ps.cat2, p.type, elem->>'type'),
              'photo_url', COALESCE(p.photo_url, elem->>'photo_url'),
              'cat2', ps.cat2,
              'cat3', ps.cat3,
              'pregnancy_safe', COALESCE(ps.pregnancy_safe, pf.preg_safe, true),
              'has_aha_active', COALESCE(ps.has_aha_active, false),
              'has_bha_active', COALESCE(ps.has_bha_active, false),
              'contains_aha_bha', (COALESCE(ps.has_aha_active, false) OR COALESCE(ps.has_bha_active, false) OR COALESCE(pf.c_ahabha, false)),
              'c_ahabha', COALESCE(pf.c_ahabha, false),
              'active_antagonistic_group', COALESCE(ps.active_antagonistic_group, 'None'),
              'has_high_irritation', COALESCE(ps.has_high_irritation, false),
              'has_fragrance_top50', COALESCE(ps.has_fragrance_top50, false),
              'has_yeast_trigger', COALESCE(ps.has_yeast_trigger, false),
              'oil_control', COALESCE(ps.oil_control, 0),
              'clear_blackheads', COALESCE(ps.clear_blackheads, 0),
              'clear_whiteheads', COALESCE(ps.clear_whiteheads, 0),
              'clear_surface_breakouts', COALESCE(ps.clear_surface_breakouts, 0),
              'soothe_deep_breakouts', COALESCE(ps.soothe_deep_breakouts, 0),
              'reduce_wrinkles', COALESCE(ps.reduce_wrinkles, 0),
              'fade_pie', COALESCE(ps.fade_pie, 0),
              'fade_pih', COALESCE(ps.fade_pih, 0)
            )
          ),
          '[]'::jsonb
        )
        FROM jsonb_array_elements(r.products) AS elem
        LEFT JOIN public.products p ON p.id = (elem->>'id')::bigint
        LEFT JOIN public.product_scores ps ON ps.product_id = p.id
        LEFT JOIN public.products_filter pf ON pf.product_id = p.id
      )
    )
  )
  INTO result
  FROM public.routines r
  WHERE r.user_id = p_user_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;