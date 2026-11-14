import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Clock, LogOut, RefreshCw, CheckCircle2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WaitlistScreenProps {
  user: any;
  profile: any;
  onSignOut: () => void;
  onRefreshStatus: () => Promise<void>;
}

export const WaitlistScreen: React.FC<WaitlistScreenProps> = ({ user, profile, onSignOut, onRefreshStatus }) => {
  const [waitlistNotes, setWaitlistNotes] = useState(profile?.waitlist_notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleUpdateApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      await supabase
        .from('users')
        .upsert({ id: user.id, waitlist_notes: waitlistNotes }, { onConflict: 'id' });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      console.error('Error updating waitlist notes:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsRefreshing(true);
    await onRefreshStatus();
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-white border-2 border-black/5 rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-black">
            <Clock className="w-8 h-8" />
          </div>
          <span className="bg-black/5 text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            Early Access Waitlist
          </span>
          <h1 className="text-2xl font-sans font-black text-black uppercase tracking-tighter mt-3 mb-2">
            You're on the Waitlist!
          </h1>
          <p className="text-black/60 text-sm font-medium leading-relaxed">
            We're rolling out access to our first 100 users in batches to ensure optimal performance and personal onboarding.
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-[#FAF9F6] border-2 border-black/5 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-widest text-black/40">Account Email</span>
            <span className="text-xs font-bold text-black truncate max-w-[200px]">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black uppercase tracking-widest text-black/40">Access Status</span>
            <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Pending Approval
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-black/40">Batch Group</span>
            <span className="text-xs font-bold text-black">Priority Waitlist (#100+)</span>
          </div>
        </div>

        {/* Optional Application Details Form */}
        <form onSubmit={handleUpdateApplication} className="space-y-4 mb-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-black/50 block mb-2">
              Tell us about your skin goals & why you want early access (Optional)
            </label>
            <textarea
              rows={3}
              value={waitlistNotes}
              onChange={(e) => setWaitlistNotes(e.target.value)}
              placeholder="e.g. Dealing with persistent breakouts and barrier damage..."
              className="w-full bg-black/5 border-2 border-black/5 rounded-xl p-3 text-sm font-medium outline-none focus:border-black transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-neutral-100 hover:bg-neutral-200 text-black font-black uppercase tracking-widest text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitted ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>Application Updated Successfully!</span>
              </>
            ) : (
              <span>{isSubmitting ? 'Saving...' : 'Update Application Details'}</span>
            )}
          </button>
        </form>

        <div className="space-y-3">
          <button
            onClick={handleCheckStatus}
            disabled={isRefreshing}
            className="w-full bg-black hover:bg-neutral-800 text-white font-black uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Check Approval Status</span>
          </button>

          <button
            onClick={onSignOut}
            className="w-full bg-transparent hover:bg-black/5 text-black/60 hover:text-black font-black uppercase tracking-widest text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
