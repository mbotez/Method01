import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, 
  Heart, 
  Share2, 
  X, 
  Search, 
  SlidersHorizontal, 
  Camera, 
  ArrowRight, 
  ChevronRight,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  FlaskConical,
  Sun,
  Shield,
  Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProductCard } from '../context/ProductCardContext';

interface Product {
  id: string;
  brand: string;
  name: string;
  photo_url?: string;
}

interface VideoProduct {
  product_id: string;
  products: Product;
}

interface VideoItem {
  id: string;
  video_id: string;
  url: string;
  platform: 'youtube' | 'tiktok';
  title: string;
  category: 'Glass skin' | 'Routine' | 'Educational';
  tags?: string[];
  video_products: VideoProduct[];
}

export interface SkincareGuide {
  id: string;
  category: 'Layering' | 'Actives' | 'Barrier' | 'Acne' | 'Sun Care' | 'Sensitive';
  title: string;
  readTime: string;
  subtitle: string;
  summary: string;
  keyRule: string;
  steps: { title: string; desc: string }[];
  dos: string[];
  donts: string[];
  recommendedActives: string[];
  imageUrl: string;
}

export const SKINCARE_GUIDES: SkincareGuide[] = [
  {
    id: 'layering-mastery',
    category: 'Layering',
    title: 'The Ultimate Skincare Layering Order',
    readTime: '4 min read',
    subtitle: 'From molecular density to occlusive barrier seal',
    summary: 'Master the exact order of application from thinnest water-based textures to richest lipid creams to guarantee maximum skin absorption without pilling or flushing.',
    keyRule: 'Rule of Viscosity: Water-based hydrating products first, treatments and serums second, lipid emulsions third, and sun protection or oils last.',
    steps: [
      { title: 'Step 1: Cleanse Thoroughly', desc: 'In AM, splash with lukewarm water or use a gentle non-foaming wash. In PM, double-cleanse with an oil cleanser to dissolve SPF and makeup, followed by a pH-balanced cleanser.' },
      { title: 'Step 2: Hydrating Toner or Essence', desc: 'Apply to damp skin within 30 seconds of cleansing. Humectants like hyaluronic acid and glycerin pull surface moisture deeper.' },
      { title: 'Step 3: Lightweight Active Serums', desc: 'Apply actives such as Vitamin C, Niacinamide, or Azelaic acid. Allow 60 seconds for absorption.' },
      { title: 'Step 4: Heavier Treatment Emulsions', desc: 'Introduce peptides, retinol, or barrier lipid complexes if needed. Keep active combinations focused.' },
      { title: 'Step 5: Barrier Cream & Moisturiser', desc: 'Seal active ingredients into the skin with ceramides, squalane, and cholesterol.' },
      { title: 'Step 6: Daytime SPF 50+ / Night Facial Oil', desc: 'Sunscreen comes last. SPF must form an uninterrupted shield over all products.' }
    ],
    dos: [
      'Apply hydrating products to slightly damp skin',
      'Wait 60–90 seconds between strong active layers',
      'Warm face creams between fingertips before pressing into skin'
    ],
    donts: [
      'Never mix sunscreen directly with moisturiser or foundation',
      'Avoid layering multiple direct exfoliating acids',
      'Do not apply pure essential oils onto dry or compromised barriers'
    ],
    recommendedActives: ['Hyaluronic Acid', 'Ceramides NP/AP', 'Niacinamide', 'Squalane'],
    imageUrl: '/assets/g1.jpg'
  },
  {
    id: 'actives-compatibility',
    category: 'Actives',
    title: 'Active Ingredients Compatibility Matrix',
    readTime: '5 min read',
    subtitle: 'Synergy, antagonism, and conflict avoidance',
    summary: 'A reference table explaining which actives can be combined in the same routine, and which combinations can render them useless or cause irritation.',
    keyRule: 'Rule of Separation: Powerful actives that alter cellular turnover (retinoids, AHA/BHA, benzoyl peroxide) should be spaced into opposite routines (AM vs PM) or alternating days.',
    steps: [
      { title: 'Retinoids + Niacinamide (Gold Synergy)', desc: 'Niacinamide up-regulates ceramide synthesis, counteracting retinoid flaking and redness. Safe to layer together.' },
      { title: 'Vitamin C + SPF (Daytime Photoprotection)', desc: 'L-ascorbic acid neutralizes reactive oxygen species that penetrate UV filters, boosting overall defense.' },
      { title: 'Retinol + AHA/BHA (Dangerous Conflict)', desc: 'Layering glycolic or salicylic acid directly with retinol overwhelms the barrier. Alternate evenings instead.' },
      { title: 'Benzoyl Peroxide + Pure Retinol (Oxidation Alert)', desc: 'Benzoyl peroxide can oxidize retinol molecules, reducing their efficacy. Use Benzoyl Peroxide in AM and Retinol in PM.' },
      { title: 'Copper Peptides + Direct Vitamin C (Chelation)', desc: 'Direct acidic vitamin C (low pH) can destabilize peptide bonds and oxidize copper ions. Separate by 12 hours.' }
    ],
    dos: [
      'Pair retinoids with barrier-replenishing humectants and ceramides',
      'Use pure L-ascorbic acid (Vitamin C) on dry skin in the morning',
      'Introduce only one new active ingredient every 3 to 4 weeks'
    ],
    donts: [
      'Never stack high-concentration BHA and physical scrubs in the same routine',
      'Do not use prescription tretinoin immediately after hot showers',
      'Avoid applying direct Vitamin C onto already irritated or peeling patches'
    ],
    recommendedActives: ['Niacinamide', 'Azelaic Acid', 'Tetrahexyldecyl Ascorbate', 'Retinal'],
    imageUrl: '/assets/g2.jpg'
  },
  {
    id: 'barrier-repair-protocol',
    category: 'Barrier',
    title: 'Barrier Repair Emergency Rules',
    readTime: '3 min read',
    subtitle: 'The 14-day reset for stinging and sensitized skin',
    summary: 'When your skin barrier is damaged, moisture escapes and irritants enter, causing burning, tightness, rough texture, and sudden breakouts. Follow this 14-day reset.',
    keyRule: 'Rule of Subtraction: The quickest way to repair a compromised skin barrier is stopping what damaged it, not adding more products.',
    steps: [
      { title: 'Days 1–3: The Complete Active Fast', desc: 'Cease all exfoliants (AHA/BHA), retinoids, vitamin C, essential oils, and clays. Cleanse only with lukewarm water or soap-free milk.' },
      { title: 'Days 4–7: Lipid Restoration', desc: 'Apply a moisturiser containing a 3:1:1 ratio of ceramides, cholesterol, and free fatty acids. Add panthenol (Pro-Vitamin B5).' },
      { title: 'Days 8–11: Slug & Soothe', desc: 'In PM, seal vulnerable areas (cheeks, around nose and mouth) with a thin film of squalane oil or medical-grade petrolatum ointment.' },
      { title: 'Days 12–14: Barrier Evaluation Check', desc: 'Assess skin: no stinging upon applying gentle lotion, zero tight pulling sensation. Maintain simple routine for 1 more week before considering actives.' }
    ],
    dos: [
      'Pat dry gently with a clean microfibre towel; never rub',
      'Stick to 100% mineral zinc oxide sunscreen while barrier is healing',
      'Keep showers lukewarm; avoid direct high-pressure shower stream on face'
    ],
    donts: [
      'Never peel off flaking skin or use physical exfoliating tools',
      'Do not try new sheet masks or scented facial mists during repair phase',
      'Avoid fragrance, denatured alcohol, and botanical essential oils'
    ],
    recommendedActives: ['Ceramides 1, 3, 6-II', 'Panthenol (B5)', 'Centella Asiatica', 'Colloidal Oat'],
    imageUrl: '/assets/g3.jpg'
  },
  {
    id: 'purging-vs-breakouts',
    category: 'Acne',
    title: 'Purging vs. Breakouts: The Diagnostic Blueprint',
    readTime: '4 min read',
    subtitle: 'How to distinguish accelerated turnover from clogged pores',
    summary: 'When introducing an active that speeds cell turnover, skin may undergo a temporary purge. Learn how to tell if a reaction is a normal purge or an inflammatory breakout.',
    keyRule: 'Rule of Location & Lifecycle: Purging occurs where you routinely experience blemishes and clears quickly. Breakouts in brand new areas indicate product rejection.',
    steps: [
      { title: 'Location Check', desc: 'Purging appears strictly where you already have a predisposition to breakouts (usually T-zone). If you suddenly break out on your neck or cheeks where you are normally clear, it is a negative reaction.' },
      { title: 'Timeline & Speed', desc: 'Purge blemishes surface, mature, and disappear much faster than typical breakouts (usually within 3–5 days per spot). Total purge cycle lasts 4–6 weeks.' },
      { title: 'Ingredient Culprit Check', desc: 'Only cell-turnover accelerants cause purging (Retinoids, AHAs, BHAs, Vitamin C, Benzoyl Peroxide). Hydrating serums, oils, and moisturisers CANNOT cause purging—they simply clog or irritate.' },
      { title: 'Action Plan', desc: 'If purging: decrease frequency (e.g., from daily to every 3rd night) and support hydration. If breaking out: discontinue the suspect product immediately.' }
    ],
    dos: [
      'Track photos to observe blemish turnover',
      'Continue daily gentle hydration and broad-spectrum sun protection',
      'Keep hands off blemishes to prevent dark spots'
    ],
    donts: [
      'Do not pick, squeeze, or attempt DIY extraction of purge whiteheads',
      'Do not panic and introduce multiple anti-acne spot treatments simultaneously',
      'Do not conclude a product has failed before week 6 if symptoms fit a true purge'
    ],
    recommendedActives: ['Salicylic Acid (BHA)', 'Adapalene', 'Zinc PCA', 'Madecassoside'],
    imageUrl: '/assets/g4.jpg'
  },
  {
    id: 'sun-protection-mastery',
    category: 'Sun Care',
    title: 'Sun Protection Mastery: Mineral vs. Chemical',
    readTime: '4 min read',
    subtitle: 'UVA/UVB filtration, application quantity, and reapplication',
    summary: 'Sunscreen is the single most potent anti-aging and anti-pigmentation tool. Understand the critical distinctions between inorganic and modern organic UV filters.',
    keyRule: 'Rule of Quantity: 2 milligrams per square centimetre of skin—equivalent to 2 full finger lengths for the face and ears alone.',
    steps: [
      { title: 'Mineral / Inorganic (Zinc Oxide, Titanium Dioxide)', desc: 'Sit on skin surface and reflect/absorb radiation. Non-irritating, immediate protection, ideal for sensitive skin.' },
      { title: 'Chemical / Organic (Tinosorb, Uvinul, Mexoryl)', desc: 'Modern European & Asian filters absorb UV and convert it into benign heat. Ultralight, non-greasy, completely transparent across all skin tones.' },
      { title: 'UVA vs. UVB Coverage', desc: 'UVB causes surface burns; UVA causes deep collagen destruction and hyperpigmentation. Always look for PA++++ or European UVA circle logo.' },
      { title: 'Reapplication Strategy', desc: 'UV filters degrade under sun exposure. Reapply every 2 hours of direct sun or after heavy sweating using an SPF cushion or mist.' }
    ],
    dos: [
      'Apply SPF as the final step of your morning skincare routine',
      'Cover ears, hairline, eyelids, and back of the neck',
      'Wear SPF indoors if seated near windows receiving direct daylight'
    ],
    donts: [
      'Never rely on the SPF in liquid foundation or powder alone',
      'Do not store sunscreen bottles in hot parked vehicles (degrades filters)',
      'Do not skip sunscreen on overcast or rainy days—UVA penetrates clouds'
    ],
    recommendedActives: ['Zinc Oxide', 'Tinosorb S/M', 'Ectoin', 'Tocopherol (Vitamin E)'],
    imageUrl: '/assets/g5.jpg'
  },
  {
    id: 'sensitive-skin-rosacea',
    category: 'Sensitive',
    title: 'The Sensitive & Rosacea-Prone Protocol',
    readTime: '3 min read',
    subtitle: 'Vascular stabilization, thermal control, and barrier comfort',
    summary: 'An expert guide to reducing chronic redness, transient flushing, and skin irritation while maintaining active skin rejuvenation.',
    keyRule: 'Rule of Thermal & Chemical Restraint: Minimize extreme temperature shifts and eliminate vascular irritants like ethanol, menthol, and synthetic dyes.',
    steps: [
      { title: 'Vascular Calming with Azelaic Acid', desc: 'Azelaic acid (10–15%) reduces inflammatory cathelicidins and visibly calms micro-vascular dilation without triggering photosensitivity.' },
      { title: 'Eliminate Thermal Triggers', desc: 'Avoid face-steaming, ice-rolling (can cause rebound vasodilation), and hot baths directly before skincare application.' },
      { title: 'Gentle Cleansing Routine', desc: 'Use non-surfactant cleansing lotions. Pat dry with ultra-soft cotton, never terrycloth.' },
      { title: 'Targeted Barrier Reinforcement', desc: 'Incorporate beta-glucan and ectoin, which stabilize cell membranes and reduce trans-epidermal water loss.' }
    ],
    dos: [
      'Always patch test any new product behind the ear for 48 hours',
      'Choose fragrance-free, essential-oil-free mineral sunscreens',
      'Store soothing serums in a cool spot for gentle anti-inflammatory relief'
    ],
    donts: [
      'Avoid high-foaming SLS/SLES cleansers and alcohol-based astringents',
      'Do not use rotating brush cleansing devices or scrub beads',
      'Avoid high-heat saunas, extreme spice, and sudden hot-cold transitions'
    ],
    recommendedActives: ['Azelaic Acid', 'Centella Asiatica', 'Allantoin', 'Ectoin'],
    imageUrl: '/assets/g6.jpg'
  }
];

interface SocialProps {
  isFollowsOpen?: boolean;
  setIsFollowsOpen?: (open: boolean) => void;
  activeMainTab?: 'videos' | 'articles' | 'guides' | 'community';
  setActiveMainTab?: (tab: 'videos' | 'articles' | 'guides' | 'community') => void;
}

export const Social = ({
  isFollowsOpen: externalIsFollowsOpen,
  setIsFollowsOpen: externalSetIsFollowsOpen,
  activeMainTab: externalActiveMainTab,
  setActiveMainTab: externalSetActiveMainTab,
}: SocialProps) => {
  const { openProductCard } = useProductCard();
  const [internalIsFollowsOpen, internalSetIsFollowsOpen] = useState(false);

  const isFollowsOpen = externalIsFollowsOpen !== undefined ? externalIsFollowsOpen : internalIsFollowsOpen;
  const setIsFollowsOpen = externalSetIsFollowsOpen !== undefined ? externalSetIsFollowsOpen : internalSetIsFollowsOpen;

  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [videos, setVideos] = useState<VideoItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchVideos = async () => {
      try {
        const { data, error } = await supabase
          .from('blog_videos')
          .select(`
          *,
          video_products (
            product_id,
            products (
              id,
              brand,
              name,
              photo_url
            )
          )
        `)
          .order('created_at', { ascending: false })
          .abortSignal(signal);
        if (!error && data && isMounted && !signal.aborted) {
          const mappedVideos: VideoItem[] = data.map((v: any) => ({
            id: v.id,
            video_id: v.video_id,
            url: v.video_url,
            platform: v.type,
            title: v.title,
            category: v.category,
            tags: v.tags || [],
            video_products: v.video_products || [],
          }));
          setVideos(mappedVideos);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal.aborted) return;
      }
    };
    fetchVideos();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  const [internalActiveMainTab, internalSetActiveMainTab] = useState<'videos' | 'articles' | 'guides' | 'community'>('videos');
  const activeMainTab = externalActiveMainTab !== undefined ? externalActiveMainTab : internalActiveMainTab;
  const setActiveMainTab = externalSetActiveMainTab !== undefined ? externalSetActiveMainTab : internalSetActiveMainTab;

  const [videoCategoryFilter, setVideoCategoryFilter] = useState<'All' | 'Glass skin' | 'Routine' | 'Educational'>('All');
  const [isVideoCategoryDropdownOpen, setIsVideoCategoryDropdownOpen] = useState(false);
  const [expandedVideoProducts, setExpandedVideoProducts] = useState<Record<string, boolean>>({});
  const [likedVideos, setLikedVideos] = useState<Record<string, boolean>>({});
  const [savedVideos, setSavedVideos] = useState<Record<string, boolean>>({});
  const [videoLikesCount, setVideoLikesCount] = useState<Record<string, number>>({
    "nabwuTwtlnM": 1420,
    "C6xZDLw6vwM": 852,
    "ythV9PhG-XQ": 2405,
    "7606234334558981396": 34500,
    "7629345393230318862": 51200,
    "7341849029694737696": 12800
  });

  // Guides States
  const [guideCategoryFilter, setGuideCategoryFilter] = useState<string>('All');
  const [isGuideCategoryDropdownOpen, setIsGuideCategoryDropdownOpen] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<SkincareGuide | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [savedGuideIds, setSavedGuideIds] = useState<string[]>([]);
  const [guides, setGuides] = useState<SkincareGuide[]>(SKINCARE_GUIDES);

  const toggleSaveGuide = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSavedGuideIds(prev => 
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
  };

  const toggleLikeVideo = (id: string) => {
    setLikedVideos(prev => {
      const wasLiked = prev[id];
      setVideoLikesCount(likes => ({
        ...likes,
        [id]: wasLiked ? likes[id] - 1 : likes[id] + 1
      }));
      return {
        ...prev,
        [id]: !wasLiked
      };
    });
  };

  const toggleSaveVideo = (id: string) => {
    setSavedVideos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // User Search
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [follows, setFollows] = useState<any[]>([]);

  async function handleFollow(following_id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('follows')
      .insert({
        follower_id: user.id,
        following_id: following_id,
      });

    if (error) return;

    fetchInitialData();
    setUserSearch('');
    setUserSearchResults([]);
  }

  async function fetchInitialData(signal?: AbortSignal, checkMounted?: () => boolean) {
    setLoading(true);
    try {
      let articlesQuery = supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });
      if (signal) articlesQuery = articlesQuery.abortSignal(signal);
      const { data: articleData } = await articlesQuery;

      if (checkMounted && !checkMounted()) return;
      if (articleData) setArticles(articleData);

      let guidesQuery = supabase
        .from('guides')
        .select('*');
      if (signal) guidesQuery = guidesQuery.abortSignal(signal);
      const { data: guideData } = await guidesQuery;

      if (checkMounted && !checkMounted()) return;
      if (guideData && guideData.length > 0) {
        const mappedGuides = guideData.map((g: any, idx: number) => ({
          id: g.id,
          category: g.category,
          title: g.title,
          readTime: g.read_time || '4 min read',
          subtitle: g.subtitle,
          summary: g.description,
          keyRule: g.rule,
          steps: g.roadmap || [],
          dos: g.dos || [],
          donts: g.donts || [],
          recommendedActives: g.recommended_formulations || [],
          imageUrl: g.image_url || `/assets/g${(idx % 6) + 1}.jpg`
        }));
        setGuides(mappedGuides);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (checkMounted && !checkMounted()) return;
      if (user) {
        let followsQuery = supabase
          .from('follows')
          .select('*, following:users!follows_following_id_fkey(username, skin_type)')
          .eq('follower_id', user.id);
        if (signal) followsQuery = followsQuery.abortSignal(signal);
        const { data: followsData } = await followsQuery;
        if (checkMounted && !checkMounted()) return;
        if (followsData) setFollows(followsData);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
    } finally {
      if (!checkMounted || checkMounted()) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    fetchInitialData(abortController.signal, () => isMounted);

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);


  const filteredVideos = videos.filter(video => {
    const matchesSearch = searchQuery.trim() === '' || 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      video.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (video.tags && video.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())));
      
    const matchesCategory = videoCategoryFilter === 'All' || video.category === videoCategoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const filteredArticles = articles.filter(article => {
    const matchesSearch = searchQuery.trim() === '' || 
      article.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      article.article_content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (article.tags && article.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesSearch;
  });

  const filteredGuides = guides.filter(guide => {
    const matchesCategory = guideCategoryFilter === 'All' || guide.category === guideCategoryFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || 
      guide.title.toLowerCase().includes(query) ||
      guide.subtitle.toLowerCase().includes(query) ||
      guide.summary.toLowerCase().includes(query) ||
      guide.recommendedActives.some(a => a.toLowerCase().includes(query));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-4xl mx-auto h-full px-2 sm:px-4">
      <div className="w-full h-full">
        {/* Main Tab Switcher */}
        <div className="flex justify-center gap-8 md:gap-12 border-b border-black/5 pb-2.5 mb-6">
          <button 
            onClick={() => {
              setActiveMainTab('videos');
              setSearchQuery('');
            }} 
            className={`text-xs md:text-sm font-black uppercase tracking-widest relative pb-2 transition-all cursor-pointer ${
              activeMainTab === 'videos' 
                ? 'text-black font-black border-b-2 border-black' 
                : 'text-black/40 hover:text-black/60'
            }`}
          >
            Trending
          </button>
          <button 
            onClick={() => {
              setActiveMainTab('articles');
              setSearchQuery('');
            }} 
            className={`text-xs md:text-sm font-black uppercase tracking-widest relative pb-2 transition-all cursor-pointer ${
              activeMainTab === 'articles' 
                ? 'text-black font-black border-b-2 border-black' 
                : 'text-black/40 hover:text-black/60'
            }`}
          >
            Articles
          </button>
          <button 
            onClick={() => {
              setActiveMainTab('guides');
              setSearchQuery('');
            }} 
            className={`text-xs md:text-sm font-black uppercase tracking-widest relative pb-2 transition-all cursor-pointer ${
              activeMainTab === 'guides' || (activeMainTab as any) === 'community'
                ? 'text-black font-black border-b-2 border-black' 
                : 'text-black/40 hover:text-black/60'
            }`}
          >
            Guides
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 mb-6 max-w-xl mx-auto w-full">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/30 pointer-events-none" />
            <input 
              type="text" 
              placeholder={
                activeMainTab === 'videos' 
                  ? "Search trending tutorials..." 
                  : activeMainTab === 'articles' 
                  ? "Search articles..." 
                  : "Search skincare guides & ingredients..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/5 border-none rounded-xl py-2 pl-9 pr-4 text-[10px] md:text-xs font-bold focus:ring-2 focus:ring-black/10 outline-none transition-all placeholder:uppercase placeholder:tracking-tighter"
            />
          </div>

          {activeMainTab === 'videos' && (
            /* Filter button and dropdown for Videos */
            <div className="relative">
              <button 
                onClick={() => setIsVideoCategoryDropdownOpen(!isVideoCategoryDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-2 bg-black/5 hover:bg-black/10 text-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{videoCategoryFilter}</span>
              </button>
              
              <AnimatePresence>
                {isVideoCategoryDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsVideoCategoryDropdownOpen(false)} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute right-0 mt-1 w-36 bg-white border border-black/5 rounded-xl shadow-xl z-20 py-1"
                    >
                      {(['All', 'Glass skin', 'Routine', 'Educational'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setVideoCategoryFilter(cat);
                            setIsVideoCategoryDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider hover:bg-black/5 transition-all cursor-pointer ${videoCategoryFilter === cat ? 'text-venus-accent font-black' : 'text-black/60'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {(activeMainTab === 'guides' || (activeMainTab as any) === 'community') && (
            /* Filter dropdown for Guides */
            <div className="relative">
              <button 
                onClick={() => setIsGuideCategoryDropdownOpen(!isGuideCategoryDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-2 bg-black/5 hover:bg-black/10 text-black rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{guideCategoryFilter}</span>
              </button>
              
              <AnimatePresence>
                {isGuideCategoryDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsGuideCategoryDropdownOpen(false)} 
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute right-0 mt-1 w-40 bg-white border border-black/5 rounded-xl shadow-xl z-20 py-1"
                    >
                      {(['All', 'Layering', 'Actives', 'Barrier', 'Acne', 'Sun Care', 'Sensitive'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setGuideCategoryFilter(cat);
                            setIsGuideCategoryDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-[9px] font-black uppercase tracking-wider hover:bg-black/5 transition-all cursor-pointer ${guideCategoryFilter === cat ? 'text-venus-accent font-black' : 'text-black/60'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Tab 1: TRENDING (VIDEOS) */}
        {activeMainTab === 'videos' ? (
          <div className="space-y-6 pb-32">
            {filteredVideos.length === 0 ? (
              <div className="text-center py-12 bg-black/[0.02] rounded-2xl border border-dashed border-black/10">
                <p className="text-xs text-black/40 font-bold uppercase italic">No trending videos match your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6">
                {filteredVideos.map((video) => {
                  const isExpanded = !!expandedVideoProducts[video.id];
                  const isLiked = !!likedVideos[video.id];
                  const isSaved = !!savedVideos[video.id];
                  const likesCount = videoLikesCount[video.video_id] || 1200;

                  return (
                    <div key={video.id} className="clean-card bg-white border border-black/5 rounded-2xl overflow-hidden hover:border-black/20 hover:shadow-md transition-all flex flex-col justify-between overflow-x-hidden">
                      {/* Video Player */}
                      <div className="relative aspect-[9/16] max-h-[460px] bg-black rounded-t-xl overflow-hidden">
                        {video.platform === 'youtube' ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${video.video_id}`}
                            title={video.title}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <div className="w-full h-full overflow-hidden relative">
                            <iframe
                              src={`https://www.tiktok.com/embed/v2/${video.video_id}`}
                              title={video.title}
                              className="w-full h-full border-0 transform scale-[0.98] origin-top"
                              scrolling="no"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        )}
                      </div>

                      {/* Video Info */}
                      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-black/40 font-medium">
                            <span>{video.category}</span>
                            <span className="uppercase text-[9px] font-black px-1.5 py-0.5 bg-black/5 rounded">
                              {video.platform}
                            </span>
                          </div>
                          <h3 className="text-sm font-black uppercase tracking-tight text-black line-clamp-2">
                            {video.title}
                          </h3>
                        </div>

                        {/* Products Featured in Video */}
                        {video.video_products && video.video_products.length > 0 && (
                          <div className="border-t border-black/5 pt-2">
                            <button
                              onClick={() => {
                                setExpandedVideoProducts(prev => ({
                                  ...prev,
                                  [video.id]: !prev[video.id]
                                }));
                              }}
                              className="text-[10px] font-black uppercase tracking-wider text-venus-accent hover:opacity-80 flex items-center justify-between w-full cursor-pointer"
                            >
                              <span>Featured Products ({video.video_products.length})</span>
                              <span>{isExpanded ? 'Hide' : 'Show'}</span>
                            </button>

                            {isExpanded && (
                              <div className="mt-2 space-y-2">
                                {video.video_products.map((vp: any) => {
                                  const prod = vp.products;
                                  if (!prod) return null;
                                  return (
                                    <div 
                                      key={vp.product_id}
                                      onClick={() => openProductCard(prod.id)}
                                      className="flex items-center gap-2 p-1.5 rounded-lg bg-black/[0.02] hover:bg-black/5 transition-colors cursor-pointer"
                                    >
                                      {prod.photo_url ? (
                                        <img src={prod.photo_url} alt={prod.name} className="w-8 h-8 rounded object-cover border border-black/5" />
                                      ) : (
                                        <div className="w-8 h-8 rounded bg-black/5 flex items-center justify-center text-[8px] font-black">
                                          P
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0 text-left">
                                        <p className="text-[9px] font-black uppercase tracking-wider text-venus-accent truncate">{prod.brand}</p>
                                        <p className="text-[10px] font-bold text-black truncate">{prod.name}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Footer: Like & Share */}
                        <div className="flex items-center gap-4 pt-2 border-t border-black/5 mt-auto">
                          <button 
                            onClick={() => toggleLikeVideo(video.id)}
                            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                              isLiked ? 'text-red-500' : 'text-black/40 hover:text-red-500'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                            <span className="text-[9px] font-black">{likesCount.toLocaleString()}</span>
                          </button>
                          <button 
                            onClick={() => toggleSaveVideo(video.id)}
                            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                              isSaved ? 'text-venus-accent font-black' : 'text-black/40 hover:text-venus-accent'
                            }`}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span className="text-[9px] font-black">{isSaved ? 'Saved' : 'Save'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeMainTab === 'articles' ? (
          /* Tab 2: ARTICLES */
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 pb-32">
            {filteredArticles.length === 0 ? (
              <div className="text-center py-12 bg-black/[0.02] rounded-2xl border border-dashed border-black/10">
                <p className="text-xs text-black/40 font-bold uppercase italic">No articles match your search query</p>
              </div>
            ) : (
              filteredArticles.map(article => (
                <div 
                  key={article.article_id || article.id} 
                  onClick={() => setSelectedArticle(article)}
                  className="clean-card bg-white border border-black/5 p-4 md:p-6 rounded-2xl hover:border-black/25 hover:shadow-sm transition-all space-y-3 cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {article.image_url && (
                      <div className="rounded-xl overflow-hidden border border-black/5 mb-3 max-h-40">
                        <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-black/40">
                      <span className="font-black uppercase tracking-wider text-venus-accent">Clinical Editorial</span>
                      <span>{new Date(article.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-xs md:text-sm font-black uppercase tracking-tight text-black group-hover:text-venus-accent transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-[10px] md:text-xs text-black/70 leading-relaxed font-medium line-clamp-2">
                      {article.article_content}
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-black/5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-black">
                    <span className="group-hover:underline flex items-center gap-1">
                      Read Article
                      <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
                    <span className="text-[9px] text-black/40 font-bold lowercase">canonic.lab</span>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Tab 3: GUIDES */
          <div className="space-y-6 pb-32">
            {/* Category Filter Pills (Functional Buttons) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
              {['All', 'Layering', 'Actives', 'Barrier', 'Acne', 'Sun Care', 'Sensitive'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setGuideCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                    guideCategoryFilter === cat
                      ? 'bg-black text-white shadow-sm'
                      : 'bg-black/5 text-black/60 hover:bg-black/10 hover:text-black'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {filteredGuides.length === 0 ? (
              <div className="text-center py-12 bg-black/[0.02] rounded-2xl border border-dashed border-black/10">
                <p className="text-xs text-black/40 font-bold uppercase italic">No guides found matching your criteria</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6">
                {filteredGuides.map((guide) => {
                  const isSaved = savedGuideIds.includes(guide.id);
                  return (
                    <div 
                      key={guide.id}
                      onClick={() => setSelectedGuide(guide)}
                      className="clean-card bg-white border border-black/5 rounded-2xl p-4 md:p-6 hover:border-black/20 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                    >
                      <div className="space-y-2">
                        {guide.imageUrl && (
                          <div className="w-full h-32 rounded-xl overflow-hidden mb-3 border border-black/5 bg-black/5">
                            <img src={guide.imageUrl} alt={guide.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-black/50">
                            <span className="font-black uppercase tracking-wider text-venus-accent">{guide.category}</span>
                            <span>·</span>
                            <span>{guide.readTime}</span>
                          </div>
                          <button
                            onClick={(e) => toggleSaveGuide(guide.id, e)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isSaved ? 'text-venus-accent bg-venus-accent/10' : 'text-black/30 hover:text-black hover:bg-black/5'}`}
                            title="Save guide"
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        <div>
                          <h3 className="text-xs md:text-sm font-black text-black uppercase tracking-tight group-hover:text-venus-accent transition-colors line-clamp-1">
                            {guide.title}
                          </h3>
                          <p className="text-[10px] text-black/50 font-medium italic mt-0.5">
                            {guide.subtitle}
                          </p>
                        </div>

                        <p className="text-[10px] md:text-xs text-black/70 leading-relaxed font-medium line-clamp-2">
                          {guide.summary}
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-black/5 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-black group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                          Read Protocol
                          <ChevronRight className="w-3 h-3" />
                        </span>
                        <span className="text-[9px] font-bold text-black/40 uppercase tracking-widest">{guide.steps.length} Steps</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {/* Article Detail Modal */}
      <AnimatePresence>
        {selectedArticle && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArticle(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8 shadow-2xl z-10 border border-black/10 space-y-6"
            >
              <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-black/50 mb-1">
                    <span className="font-black uppercase tracking-wider text-venus-accent text-[10px]">Clinical Editorial</span>
                    <span>·</span>
                    <span>{new Date(selectedArticle.created_at).toLocaleDateString()}</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black">
                    {selectedArticle.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedArticle.image_url && (
                <div className="rounded-2xl overflow-hidden border border-black/5 max-h-72">
                  <img src={selectedArticle.image_url} alt={selectedArticle.title} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-xs md:text-sm text-black/80 leading-relaxed font-medium whitespace-pre-line">
                {selectedArticle.article_content}
              </p>

              <div className="pt-4 border-t border-black/5 flex items-center justify-between">
                <a 
                  href={selectedArticle.article_link || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs font-black uppercase tracking-widest text-black hover:underline flex items-center gap-1.5"
                >
                  <span>Open External Link</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="py-2.5 px-6 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-venus-accent transition-colors cursor-pointer"
                >
                  Close Article
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>

      {/* Guide Detail Modal */}
      <AnimatePresence>
        {selectedGuide && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGuide(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8 shadow-2xl z-10 border border-black/10 space-y-6"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-black/5 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-black/50 mb-1">
                    <span className="font-black uppercase tracking-wider text-venus-accent text-[10px]">{selectedGuide.category}</span>
                    <span>·</span>
                    <span>{selectedGuide.readTime}</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black">
                    {selectedGuide.title}
                  </h2>
                  <p className="text-xs text-black/60 font-medium italic mt-0.5">
                    {selectedGuide.subtitle}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedGuide(null)}
                  className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 text-black flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Summary */}
              {selectedGuide.imageUrl && (
                <div className="w-full h-64 rounded-2xl overflow-hidden border border-black/5">
                  <img src={selectedGuide.imageUrl} alt={selectedGuide.title} className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-xs md:text-sm text-black/80 leading-relaxed font-medium">
                {selectedGuide.summary}
              </p>

               {/* Core Routine Rule */}
              <div className="p-4 rounded-2xl bg-venus-accent/[0.06] border border-black/5 text-left space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-black/50 block">Skin Science Governing Rule</span>
                <p className="text-xs md:text-sm font-bold text-black leading-snug">
                  {selectedGuide.keyRule}
                </p>
              </div>

              {/* Step by Step Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                  <Layers className="w-4 h-4 text-venus-accent" />
                  Routine Application Roadmap
                </h4>
                <div className="space-y-2.5">
                  {selectedGuide.steps.map((st, sIdx) => (
                    <div key={sIdx} className="p-3.5 rounded-xl border border-black/5 bg-black/[0.01] flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {sIdx + 1}
                      </span>
                      <div className="space-y-0.5">
                        <h5 className="text-xs font-black text-black uppercase tracking-tight">{st.title}</h5>
                        <p className="text-[11px] text-black/70 leading-relaxed font-medium">{st.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dos & Don'ts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/50 space-y-2">
                  <h5 className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Expert Dos
                  </h5>
                  <ul className="space-y-1.5">
                    {selectedGuide.dos.map((item, dIdx) => (
                      <li key={dIdx} className="text-[11px] text-emerald-900/90 font-medium flex items-start gap-1.5">
                        <span className="text-emerald-600 font-black">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/50 space-y-2">
                  <h5 className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Day-to-Day Don'ts
                  </h5>
                  <ul className="space-y-1.5">
                    {selectedGuide.donts.map((item, dIdx) => (
                      <li key={dIdx} className="text-[11px] text-rose-900/90 font-medium flex items-start gap-1.5">
                        <span className="text-rose-600 font-black">✕</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recommended Actives */}
              <div className="space-y-2 pt-2 border-t border-black/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-black/40 block">Key Recommended Formulations</span>
                <div className="flex flex-wrap gap-2">
                  {selectedGuide.recommendedActives.map((act) => (
                    <span key={act} className="text-xs font-bold uppercase px-3 py-1 bg-black text-white rounded-xl shadow-xs">
                      {act}
                    </span>
                  ))}
                </div>
              </div>

              {/* Close Button */}
              <div className="pt-2">
                <button
                  onClick={() => setSelectedGuide(null)}
                  className="w-full py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-venus-accent transition-colors cursor-pointer"
                >
                  Close Guide
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
