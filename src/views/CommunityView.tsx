import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Tag as TagIcon, 
  X, 
  Send, 
  Share2, 
  Heart, 
  ArrowUp, 
  Check, 
  Search, 
  RefreshCw, 
  Loader2, 
  User as UserIcon, 
  Sparkles, 
  Clock, 
  Hash, 
  Plus, 
  Flame,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppState } from '../types';

export interface CommunityViewProps {
  user: any;
  profile: any;
  setAppState: (state: any) => void;
  openProductCard?: (productId: string) => void;
  publicRoutines?: any[];
  onVoteRoutine?: (routineId: string) => void;
  onShareRoutine?: (routine: any) => void;
}

export interface CommunityPost {
  post_id: string;
  user_id: string;
  username?: string | null;
  title?: string | null;
  content: string;
  post_media?: string | null;
  timestamp?: string;
  created_at?: string;
  tags?: string[] | null;
  votes_count?: number;
}

const PRESET_TAGS = [
  'Routine',
  'Review',
  'Question',
  'Holy Grail',
  'Barrier Repair',
  'Acne & Blemishes',
  'Sun Care',
  'Product Recs',
  'Sensitive Skin'
];

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'Just now';
  const postDate = new Date(dateString);
  if (isNaN(postDate.getTime())) return 'Recently';

  const diffMs = Date.now() - postDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return postDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  user,
  profile,
  setAppState,
  openProductCard
}) => {
  // Posts state
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // New Post Form State
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Filter & Search State
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, boolean>>({});

  const composerRef = useRef<HTMLDivElement>(null);

  // Determine current active username
  const currentUsername = useMemo(() => {
    if (profile?.username && profile.username.trim() !== '') return profile.username.trim();
    if (user?.user_metadata?.username && user.user_metadata.username.trim() !== '') return user.user_metadata.username.trim();
    if (user?.email) return user.email.split('@')[0];
    return 'skincare_user';
  }, [profile, user]);

  // Fetch posts ordered by created_at (with fallback to timestamp)
  const fetchPosts = async () => {
    setLoadingPosts(true);
    setFetchError(null);
    try {
      // Primary: try ordering by created_at
      let res = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      // Fallback: if created_at column is not found on the table, order by timestamp
      if (res.error && res.error.message?.includes('created_at')) {
        res = await supabase
          .from('posts')
          .select('*')
          .order('timestamp', { ascending: false });
      }

      if (res.error) {
        console.error('Error fetching posts:', res.error);
        setFetchError(res.error.message);
      } else if (res.data) {
        setPosts(res.data as CommunityPost[]);
      }
    } catch (err: any) {
      console.error('Fetch posts exception:', err);
      setFetchError(err.message || 'Failed to load posts');
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to realtime updates on posts table
    const postChannel = supabase
      .channel('community_posts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postChannel);
    };
  }, []);

  // Tag helpers
  const handleTogglePresetTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim().replace(/^#+/, '');
    if (!trimmed) return;
    if (!selectedTags.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      setSelectedTags(prev => [...prev, trimmed]);
    }
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagToRemove));
  };

  // Submit Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAppState(AppState.AUTH);
      window.history.pushState(null, '', '/auth');
      return;
    }

    const trimmedTitle = postTitle.trim();
    const trimmedContent = postContent.trim();

    if (!trimmedTitle) {
      setSubmitError('Please enter a title for your post.');
      return;
    }
    if (!trimmedContent) {
      setSubmitError('Please write some content for your post.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // Resolve accurate username
      let resolvedUsername = currentUsername;
      try {
        const { data: uData } = await supabase
          .from('users')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        if (uData?.username) {
          resolvedUsername = uData.username;
        }
      } catch (e) {
        // use currentUsername fallback
      }

      const generatedPostId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const nowIso = new Date().toISOString();

      // Post payload containing all required fields:
      // user_id, username connected to user_id, title, content, post_id, timestamp, tags
      const postPayload: any = {
        post_id: generatedPostId,
        user_id: user.id,
        username: resolvedUsername,
        title: trimmedTitle,
        content: trimmedContent,
        tags: selectedTags,
        timestamp: nowIso,
        created_at: nowIso
      };

      // Try inserting with created_at
      let { data, error } = await supabase
        .from('posts')
        .insert(postPayload)
        .select();

      // If created_at column is not in the database table yet, retry without created_at
      if (error && error.message?.includes('created_at')) {
        const { created_at, ...withoutCreatedAt } = postPayload;
        const retry = await supabase.from('posts').insert(withoutCreatedAt).select();
        data = retry.data;
        error = retry.error;
      }

      // If username column does not exist yet in posts table, inform user clearly
      if (error && error.message?.includes('username')) {
        setSubmitError(
          `Supabase table column missing: "${error.message}". Please run the SQL migration in Supabase to add the 'username' column to 'posts'.`
        );
        return;
      }

      // If tags column has issue
      if (error && error.message?.includes('tags')) {
        setSubmitError(
          `Supabase table column missing: "${error.message}". Please run the SQL migration to add the 'tags' column to 'posts'.`
        );
        return;
      }

      if (error) {
        throw error;
      }

      // Prepend immediately to state for zero-latency UX
      const newlyCreated: CommunityPost = data && data[0] ? data[0] : postPayload;
      setPosts(prev => [newlyCreated, ...prev]);

      // Reset form
      setPostTitle('');
      setPostContent('');
      setSelectedTags([]);
      setCustomTagInput('');
      setIsComposerFocused(false);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    } catch (err: any) {
      console.error('Failed to create post:', err);
      setSubmitError(err.message || 'Failed to submit post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upvote post locally
  const handleToggleVote = (postId: string) => {
    setUserVotes(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
  };

  // Copy share link
  const handleCopyShare = (post: CommunityPost) => {
    const textToCopy = `${window.location.origin}/community#${post.post_id}\n\n"${post.title}" by u/${post.username || 'user'}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedPostId(post.post_id);
      setTimeout(() => setCopiedPostId(null), 2500);
    }
  };

  // Filter posts by activeTagFilter and searchQuery
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const matchesSearch = 
        !searchQuery ||
        (post.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(post.tags) && post.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesTag = 
        !activeTagFilter ||
        (Array.isArray(post.tags) && post.tags.some(t => t.toLowerCase() === activeTagFilter.toLowerCase()));

      return matchesSearch && matchesTag;
    });
  }, [posts, searchQuery, activeTagFilter]);

  // Extract all unique tags across existing posts
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    PRESET_TAGS.forEach(t => tagSet.add(t));
    posts.forEach(p => {
      if (Array.isArray(p.tags)) {
        p.tags.forEach(t => {
          if (t && typeof t === 'string' && t.trim()) {
            tagSet.add(t.trim());
          }
        });
      }
    });
    return Array.from(tagSet);
  }, [posts]);

  return (
    <motion.div
      key="community"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6 max-w-3xl mx-auto w-full pb-28 px-4 md:px-6 pt-2"
    >
      {/* Page Header */}
      <div className="border-b border-black/10 pb-4 md:pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-sans font-black text-black uppercase tracking-tight">
            Community
          </h1>
          <p className="text-xs md:text-sm text-black/50 font-medium mt-0.5">
            Discuss routines, ask skincare questions, and share honest product reviews.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchPosts()}
            disabled={loadingPosts}
            title="Refresh feed"
            className="p-2.5 rounded-xl border border-black/10 bg-white hover:bg-black/5 text-black/70 hover:text-black transition-colors cursor-pointer text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPosts ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      <AnimatePresence>
        {submitSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Your post has been published to the community!</span>
            </div>
            <button onClick={() => setSubmitSuccess(false)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reddit-Style Post Composer */}
      <div 
        ref={composerRef}
        className="bg-white border border-black/10 rounded-3xl p-4 md:p-6 shadow-sm transition-all duration-200"
      >
        {!user ? (
          /* Unauthenticated prompt */
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black/5 border border-black/10 flex items-center justify-center text-black/40 font-bold shrink-0">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-bold text-black">
                  Join the Community conversation
                </h3>
                <p className="text-[11px] text-black/50">
                  Log in or sign up to ask questions, share routines, and tag your posts.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setAppState(AppState.AUTH);
                window.history.pushState(null, '', '/auth');
              }}
              className="w-full sm:w-auto bg-black text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-venus-accent transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              Log In to Post
            </button>
          </div>
        ) : (
          /* Reddit-style interactive input composer */
          <form onSubmit={handleCreatePost} className="space-y-3.5">
            {/* User Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-venus-accent/20 border border-venus-accent/40 text-black font-black text-xs flex items-center justify-center uppercase">
                  {currentUsername.charAt(0) || 'U'}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-black">u/{currentUsername}</span>
                  <span className="text-[10px] text-black/40 font-medium">· Posting to Community</span>
                </div>
              </div>

              {isComposerFocused && (
                <button
                  type="button"
                  onClick={() => {
                    setIsComposerFocused(false);
                    setPostTitle('');
                    setPostContent('');
                    setSelectedTags([]);
                    setSubmitError(null);
                  }}
                  className="text-[11px] font-bold text-black/40 hover:text-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Title Input */}
            <div>
              <input
                type="text"
                value={postTitle}
                onFocus={() => setIsComposerFocused(true)}
                onChange={(e) => setPostTitle(e.target.value)}
                placeholder="Title (e.g., My 3-month barrier repair routine, or which serum is best for redness?)"
                maxLength={200}
                className="w-full bg-[#FAF9F6] border border-black/10 rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-black placeholder:text-black/40 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            {/* Content Textarea (Expanded or visible on focus) */}
            <AnimatePresence>
              {(isComposerFocused || postTitle.length > 0 || postContent.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3.5 overflow-hidden"
                >
                  <div>
                    <textarea
                      rows={4}
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      placeholder="Share details about your skin type, products used, concerns, or the advice you're looking for..."
                      className="w-full bg-[#FAF9F6] border border-black/10 rounded-2xl p-4 text-xs md:text-sm font-medium text-black placeholder:text-black/40 focus:outline-none focus:border-black transition-colors resize-y"
                    />
                  </div>

                  {/* Tags Selection Section */}
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-black/60">
                        <TagIcon className="w-3.5 h-3.5 text-venus-accent" />
                        <span>Add Tags to Your Post</span>
                      </div>
                      <span className="text-[10px] text-black/40 font-mono">
                        {selectedTags.length} selected
                      </span>
                    </div>

                    {/* Selected Tags Chips */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-[#FAF9F6] rounded-xl border border-black/5">
                        {selectedTags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black text-white text-[11px] font-bold shadow-xs animate-in fade-in"
                          >
                            <span>#{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="hover:text-venus-accent cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Quick Preset Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_TAGS.map(tag => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            type="button"
                            key={tag}
                            onClick={() => handleTogglePresetTag(tag)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-black text-white shadow-xs'
                                : 'bg-black/5 hover:bg-black/10 text-black/70 hover:text-black'
                            }`}
                          >
                            #{tag}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Tag Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="relative flex-1">
                        <Hash className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
                        <input
                          type="text"
                          value={customTagInput}
                          onChange={(e) => setCustomTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomTag();
                            }
                          }}
                          placeholder="Type custom tag & press Enter..."
                          className="w-full bg-[#FAF9F6] border border-black/10 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-black placeholder:text-black/40 focus:outline-none focus:border-black"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCustomTag}
                        disabled={!customTagInput.trim()}
                        className="px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 text-black text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Submission Error Display */}
                  {submitError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      <span className="flex-1">{submitError}</span>
                    </div>
                  )}

                  {/* Footer Action Bar */}
                  <div className="pt-2 border-t border-black/5 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-black/40 font-mono">
                      Markdown & plain text supported
                    </span>

                    <button
                      type="submit"
                      disabled={isSubmitting || !postTitle.trim() || !postContent.trim()}
                      className="bg-black text-white hover:bg-venus-accent transition-colors px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Publishing...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Post</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </div>

      {/* Feed Filters & Search */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts by keyword, title, tag, or author..."
              className="w-full bg-white border border-black/10 rounded-2xl pl-9 pr-4 py-2 text-xs font-medium text-black placeholder:text-black/40 focus:outline-none focus:border-black shadow-xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Tag indicator if filtered */}
          {activeTagFilter && (
            <button
              onClick={() => setActiveTagFilter(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <span>Tag: #{activeTagFilter}</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tag Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTagFilter(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTagFilter === null
                ? 'bg-black text-white shadow-xs'
                : 'bg-white border border-black/10 text-black/60 hover:text-black'
            }`}
          >
            All Posts ({posts.length})
          </button>
          {availableTags.map(tag => {
            const isActive = activeTagFilter?.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                onClick={() => setActiveTagFilter(isActive ? null : tag)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-white border border-black/10 text-black/70 hover:text-black'
                }`}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed Error Alert */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Notice while retrieving posts
          </p>
          <p>{fetchError}</p>
        </div>
      )}

      {/* Posts Feed Display (Ordered by created_at) */}
      <div className="space-y-4">
        {loadingPosts && posts.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-white border border-black/10 rounded-3xl">
            <Loader2 className="w-6 h-6 animate-spin text-black/40 mx-auto" />
            <p className="text-xs font-bold uppercase tracking-wider text-black/50">
              Loading community posts...
            </p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-white border border-black/10 rounded-3xl px-4">
            <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mx-auto text-black/40">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-wider text-black">
              {searchQuery || activeTagFilter ? 'No matching posts found' : 'No community posts yet'}
            </h3>
            <p className="text-xs text-black/50 max-w-sm mx-auto">
              {searchQuery || activeTagFilter
                ? 'Try clearing your filters or search query.'
                : 'Be the first to share your thoughts, routine, or review in the community!'}
            </p>
            {user && (
              <button
                onClick={() => {
                  setIsComposerFocused(true);
                  if (composerRef.current) {
                    composerRef.current.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="mt-2 inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-venus-accent transition-colors shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Post</span>
              </button>
            )}
          </div>
        ) : (
          filteredPosts.map((post) => {
            const isVoted = Boolean(userVotes[post.post_id]);
            const displayDate = post.created_at || post.timestamp;
            const timeAgo = formatTimeAgo(displayDate);
            const isAuthor = user?.id && post.user_id === user.id;

            return (
              <motion.article
                key={post.post_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-black/10 hover:border-black/25 rounded-3xl p-5 md:p-6 shadow-xs transition-all duration-200 space-y-3 group"
              >
                {/* Post Author & Meta Info */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-black/5 border border-black/10 flex items-center justify-center font-black text-[11px] text-black uppercase">
                      {(post.username || 'U').charAt(0)}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-black">
                        u/{post.username || 'skincare_user'}
                      </span>
                      {isAuthor && (
                        <span className="px-1.5 py-0.5 rounded-md bg-venus-accent/20 text-venus-accent text-[9px] font-black uppercase tracking-wider">
                          You
                        </span>
                      )}
                      <span className="text-black/30">·</span>
                      <span className="text-[11px] font-medium text-black/50 flex items-center gap-1" title={displayDate ? new Date(displayDate).toLocaleString() : ''}>
                        <Clock className="w-3 h-3 text-black/30" />
                        {timeAgo}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopyShare(post)}
                    title="Share link to post"
                    className="p-1.5 rounded-lg hover:bg-black/5 text-black/40 hover:text-black transition-colors cursor-pointer"
                  >
                    {copiedPostId === post.post_id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Post Title */}
                {post.title && (
                  <h2 className="text-base md:text-lg font-black text-black tracking-tight leading-snug">
                    {post.title}
                  </h2>
                )}

                {/* Tags Badges */}
                {Array.isArray(post.tags) && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {post.tags.map((t, idx) => (
                      <button
                        key={`${t}-${idx}`}
                        onClick={() => setActiveTagFilter(t)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-black/5 hover:bg-black hover:text-white text-black/70 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <Hash className="w-2.5 h-2.5 opacity-40" />
                        <span>{t}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Post Content */}
                <div className="text-xs md:text-sm text-black/80 font-medium leading-relaxed whitespace-pre-line break-words pt-1">
                  {post.content}
                </div>

                {/* Post Footer Actions */}
                <div className="pt-3 border-t border-black/5 flex items-center justify-between text-xs text-black/60">
                  <div className="flex items-center gap-3">
                    {/* Upvote button */}
                    <button
                      onClick={() => handleToggleVote(post.post_id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs transition-colors cursor-pointer ${
                        isVoted
                          ? 'bg-venus-accent text-white shadow-xs'
                          : 'bg-black/5 hover:bg-black/10 text-black'
                      }`}
                    >
                      <ArrowUp className={`w-3.5 h-3.5 ${isVoted ? 'stroke-[3]' : ''}`} />
                      <span>{isVoted ? 1 : 0}</span>
                    </button>

                    {/* Community comment indicator */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 text-black/70 text-xs font-semibold">
                      <MessageSquare className="w-3.5 h-3.5 text-black/40" />
                      <span>Discussion</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-black/40">
                    ID: {post.post_id.slice(0, 8)}
                  </span>
                </div>
              </motion.article>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
