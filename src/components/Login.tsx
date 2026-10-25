import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../utils/auth';

interface LoginProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  isSignUp: boolean;
  setIsSignUp: (isSignUp: boolean) => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, onError, isSignUp, setIsSignUp }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || googleLoading) return;
    
    setIsSubmitting(true);
    setLoading(true);
    setLocalError(null);
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              username: username
            }
          }
        });
        if (error) throw error;
        
        // Rows in public.users, public.user_profile, public.user_contacts 
        // are created automatically by database trigger on auth.users insert.
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onSuccess?.();
    } catch (err: any) {
      setLocalError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (loading || isSubmitting || googleLoading) return;
    setGoogleLoading(true);
    setLocalError(null);

    try {
      await signInWithGoogle();
      // On web, signInWithOAuth redirects the window.
      // On native mobile, external browser opens and redirects back via com.daybreak.canonic://auth-callback
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      const msg = err.message || 'Failed to authenticate with Google';
      setLocalError(msg);
      onError?.(msg);
      setGoogleLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto"
    >
      <div className="clean-card p-10 border-2 border-black/5 bg-white shadow-2xl rounded-3xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-sans font-black text-black uppercase tracking-tighter mb-2">
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </h2>
          <p className="text-black/50 text-sm font-medium">
            {isSignUp ? 'Join the number 1 skincare community' : 'Consistency leads to lasting results'}
          </p>
        </div>

        {/* Google OAuth Button */}
        <button 
          type="button" 
          onClick={handleGoogleAuth}
          disabled={loading || isSubmitting || googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-50 text-black border-2 border-black/10 hover:border-black/30 font-bold py-3.5 px-4 rounded-xl transition-all shadow-xs hover:shadow-sm disabled:opacity-50 cursor-pointer text-sm"
        >
          {googleLoading ? (
            <span className="text-xs uppercase tracking-wider font-black text-black/60">Connecting to Google...</span>
          ) : (
            <>
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isSignUp ? 'Sign up with Google' : 'Sign in with Google'}</span>
            </>
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/10" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-white px-3 font-black text-black/35 tracking-widest">or email</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">Username</label>
              <input 
                type="text" 
                required={isSignUp}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 font-medium outline-none focus:border-black transition-colors"
              />
            </div>
          )}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">E-mail</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 font-medium outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 font-medium outline-none focus:border-black transition-colors"
              placeholder="••••••••"
            />
          </div>

          {localError && (
            <p className="text-venus-accent text-xs font-bold text-center">{localError}</p>
          )}

          <button 
            type="submit" 
            disabled={loading || isSubmitting || googleLoading}
            className="w-full bg-black text-white font-black uppercase tracking-widest py-3 rounded-xl hover:bg-neutral-800 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading || isSubmitting ? 'Authenticating...' : "Let's go"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs font-black text-black/40 uppercase tracking-widest">
          {isSignUp ? 'Already joined?' : 'Haven\'t joined yet?'}
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="ml-2 text-black hover:text-venus-accent underline cursor-pointer"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </motion.div>
  );
};
