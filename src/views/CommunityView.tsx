import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Users, Heart, Share2, Search, Sun, Moon, Sparkles, ShoppingBag, Check } from 'lucide-react';

interface CommunityViewProps {
  publicRoutines: any[];
  onVoteRoutine: (routineId: string) => void;
  onShareRoutine: (routine: any) => void;
  openProductCard: (productId: string) => void;
  setAppState: (state: any) => void;
  user: any;
  profile: any;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  publicRoutines,
  onVoteRoutine,
  onShareRoutine,
  openProductCard,
  setAppState,
  user,
  profile
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTime, setFilterTime] = useState<'All' | 'AM' | 'PM'>('All');

  const filteredRoutines = publicRoutines.filter(rt => {
    const matchesSearch = 
      (rt.routine_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rt.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rt.time || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTime = filterTime === 'All' || (rt.time || 'AM').toUpperCase() === filterTime;
    return matchesSearch && matchesTime;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-8 max-w-5xl mx-auto w-full pb-24 px-4 md:px-6"
    >
      {/* Header Banner */}
      <div className="bg-white border border-black/10 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-black text-white">
              <Users className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-black/50">Skincare Community</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-black font-bubble">
            Community Spotlights
          </h1>
          <p className="text-xs md:text-sm text-black/60 font-medium max-w-xl">
            Explore verified routines and regimens shared by skincare enthusiasts worldwide. Upvote your favorite regimens and discover powerful product pairings.
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
          <input
            type="text"
            placeholder="Search community routines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-black/10 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-black focus:outline-none focus:border-black transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['All', 'AM', 'PM'] as const).map((time) => (
            <button
              key={time}
              onClick={() => setFilterTime(time)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                filterTime === time
                  ? 'bg-black text-white shadow-md'
                  : 'bg-white border border-black/10 text-black/60 hover:text-black'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      {/* Routines Grid */}
      {filteredRoutines.length === 0 ? (
        <div className="py-20 text-center bg-white border border-black/10 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mx-auto text-black/40">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-wider text-black">No community routines found</h3>
          <p className="text-xs text-black/50 max-w-sm mx-auto">
            {searchQuery ? 'Try adjusting your search query or filters.' : 'Be the first to share your routine publicly from your Routines tab!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoutines.map((rt, idx) => (
            <div
              key={rt.id || idx}
              className="bg-white border border-black/10 hover:border-black p-6 rounded-3xl transition-all duration-300 hover:shadow-xl flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-[#FAF9F6] border border-black/10 font-mono text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                    {(rt.time || 'AM').toUpperCase() === 'AM' ? <Sun className="w-3 h-3 text-amber-500" /> : <Moon className="w-3 h-3 text-indigo-500" />}
                    {rt.time || 'AM'} Routine
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onShareRoutine(rt); }}
                      className="p-2 rounded-xl bg-black/5 hover:bg-black/10 text-black transition-colors cursor-pointer"
                      title="Share routine"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onVoteRoutine(rt.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black text-black hover:text-white text-xs font-black transition-colors cursor-pointer"
                      title="Upvote routine"
                    >
                      <Heart className="w-3.5 h-3.5 text-venus-accent fill-venus-accent/20" />
                      <span>{rt.votes_count || 0}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black uppercase tracking-tight text-black group-hover:text-venus-accent transition-colors line-clamp-2">
                    {rt.routine_name || 'Community Routine'}
                  </h3>
                  {rt.notes && (
                    <p className="text-xs text-black/70 font-medium leading-relaxed line-clamp-3">
                      {rt.notes}
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-black/5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-black/40">
                    Included Products ({Array.isArray(rt.products) ? rt.products.length : 0})
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {Array.isArray(rt.products) && rt.products.map((p: any, pIdx: number) => (
                      <div
                        key={pIdx}
                        onClick={(e) => { e.stopPropagation(); openProductCard(String(p.id || p.product_id)); }}
                        className="text-xs font-semibold text-black/90 truncate flex items-center gap-2 cursor-pointer hover:text-venus-accent transition-colors p-2 rounded-xl bg-[#FAF9F6] border border-black/5"
                        title="Click to view product details"
                      >
                        <span className="w-2 h-2 rounded-full bg-venus-accent shrink-0" />
                        <span className="truncate underline font-bold">{p.brand}</span>
                        <span className="truncate text-black/60">— {p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-black/5 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-black/50">
                <span>{Array.isArray(rt.days) && rt.days.length > 0 ? rt.days.join(', ') : 'Daily'}</span>
                <span className="text-black font-bold">Community Spot</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
