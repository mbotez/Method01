import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { AppState } from '../types';
import { supabase } from '../lib/supabase';

export interface FeedbackViewProps {
  user: any;
  setIsSignUp: (isSignUp: boolean) => void;
  setAppState: (state: AppState) => void;
}

export const FeedbackView: React.FC<FeedbackViewProps> = ({
  user,
  setIsSignUp,
  setAppState,
}) => {
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      setFeedbackError('Please enter your feedback.');
      return;
    }
    setFeedbackSubmitting(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        feedback: trimmed
      });
      if (error) throw error;
      setFeedbackSuccess('Thank you! Your feedback has been successfully submitted.');
      setFeedbackText('');
    } catch (err: any) {
      setFeedbackError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <motion.div
      key="feedback"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 max-w-xl mx-auto pb-12 w-full pt-6"
    >
      <div className="clean-card bg-white border border-black/10 rounded-3xl p-8 shadow-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 bg-black/5 rounded-full mb-2">
            <MessageSquare className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-3xl md:text-4xl font-sans font-black text-black uppercase tracking-tighter">
            Feedback
          </h2>
          <p className="text-xs md:text-sm text-black/60 font-medium max-w-sm mx-auto">
            We value your thoughts, feature requests, and bug reports. Let us know how we can improve your experience.
          </p>
        </div>

        {!user ? (
          <div className="space-y-6 text-center bg-black/[0.02] p-6 rounded-2xl border border-black/5">
            <p className="text-sm font-medium text-black/80">
              You are currently not signed in. Please log in to send feedback.
            </p>
            <button
              onClick={() => {
                setIsSignUp(false);
                setAppState(AppState.AUTH);
                window.history.pushState(null, '', '/auth');
              }}
              className="w-full bg-black text-white py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-venus-accent transition-colors shadow-md cursor-pointer"
            >
              Log In to Proceed
            </button>
          </div>
        ) : (
          <form onSubmit={handleFeedbackSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">Your Feedback</label>
              <textarea 
                rows={6}
                required
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Type your feedback here..."
                className="w-full bg-black/5 border-2 border-black/5 rounded-2xl p-4 font-medium outline-none focus:border-black transition-colors text-xs md:text-sm resize-y"
              />
            </div>

            {feedbackError && (
              <p className="text-red-600 text-xs font-bold text-center bg-red-50 p-3 rounded-xl">{feedbackError}</p>
            )}

            {feedbackSuccess && (
              <p className="text-green-700 text-xs font-bold text-center bg-green-50 p-3 rounded-xl">{feedbackSuccess}</p>
            )}

            <button 
              type="submit" 
              disabled={feedbackSubmitting}
              className="w-full bg-black text-white font-black uppercase tracking-widest py-3.5 rounded-xl hover:bg-neutral-800 transition-all disabled:opacity-50 cursor-pointer text-xs"
            >
              {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
};
