import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Shield, Loader2 } from 'lucide-react';
import { AppState } from '../types';
import { supabase } from '../lib/supabase';

export interface DeleteAccountViewProps {
  user: any;
  setUser: (user: any) => void;
  setProfile: (profile: any) => void;
  setUserProfile: (profile: any) => void;
  error: string | null;
  setError: (error: string | null) => void;
  setSuccessMessage: (msg: string | null) => void;
  setIsSignUp: (isSignUp: boolean) => void;
  setAppState: (state: AppState) => void;
  navigateTo: (state: AppState, path?: string) => void;
}

export const DeleteAccountView: React.FC<DeleteAccountViewProps> = ({
  user,
  setUser,
  setProfile,
  setUserProfile,
  error,
  setError,
  setSuccessMessage,
  setIsSignUp,
  setAppState,
  navigateTo,
}) => {
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion.');
      return;
    }
    if (!user?.id) return;
    setIsDeleting(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('delete-account');
      if (fnError) {
        throw new Error(fnError.message || 'Failed to delete account');
      }

      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setUserProfile(null);
      setDeleteConfirmationText('');
      setError(null);
      setSuccessMessage('Your account has been deleted.');
      navigateTo(AppState.LANDING, '/');
    } catch (err: any) {
      setError(`Failed to delete account: ${err.message || err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      key="delete-account"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 max-w-xl mx-auto pb-12 w-full pt-6"
    >
      <div className="clean-card bg-white border border-black/10 rounded-3xl p-8 shadow-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 bg-red-50 rounded-full mb-2">
            <Trash2 className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-3xl md:text-4xl font-sans font-black text-black uppercase tracking-tighter">
            Delete Account
          </h2>
          <p className="text-xs font-medium text-black/60 max-w-md mx-auto">
            Permanent Account & Data Removal Request
          </p>
        </div>

        {!user ? (
          <div className="space-y-6 text-center bg-black/[0.02] p-6 rounded-2xl border border-black/5">
            <p className="text-sm font-medium text-black/80">
              You are currently not signed in. To delete your account and associated records, please log in first.
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
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200/60 p-5 rounded-2xl space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-red-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-600" />
                Warning: Action is irreversible
              </h3>
              <p className="text-xs text-red-700 font-medium leading-relaxed">
                Deleting your account will permanently remove your profile data, skin questionnaire responses, skincare routines, progress photos, tracker items, and all associated records from the Supabase database. This action cannot be undone.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black uppercase tracking-wider text-black">
                To confirm, type <span className="text-red-600 font-black">DELETE</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full border border-black/20 bg-white rounded-xl p-3 text-sm uppercase outline-none focus:border-red-600 font-black tracking-widest text-center"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium text-center">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => navigateTo(AppState.PROFILE, '/profile')}
                className="flex-1 bg-black/5 hover:bg-black/10 text-black py-3 rounded-xl text-xs uppercase font-black tracking-widest transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationText !== 'DELETE' || isDeleting}
                className={`flex-1 py-3 rounded-xl text-xs uppercase font-black tracking-widest transition-all cursor-pointer shadow-md ${
                  deleteConfirmationText === 'DELETE' && !isDeleting
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-black/10 text-black/40 cursor-not-allowed shadow-none'
                }`}
              >
                {isDeleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  'Permanently Delete'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
