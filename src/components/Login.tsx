import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onAwaitingApproval?: () => void;
  isSignUp: boolean;
  setIsSignUp: (isSignUp: boolean) => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, onError, onAwaitingApproval, isSignUp, setIsSignUp }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setLoading(true);
    setLocalError(null);
    
    try {
      if (isSignUp) {
        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
          throw new Error('Please enter a username');
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        // Check if username already exists in database
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('username', trimmedUsername)
          .maybeSingle();

        if (existingUser) {
          throw new Error('Username is already taken');
        }

        const { data: authData, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              username: trimmedUsername
            }
          }
        });
        if (error) throw error;
        
        const sessionUser = authData.user || (await supabase.auth.getSession()).data.session?.user;
        if (sessionUser) {
          await supabase.from('users').upsert({ id: sessionUser.id, username: trimmedUsername, is_approved: false }, { onConflict: 'id' });
        }
        
        await supabase.auth.signOut();
        onAwaitingApproval?.();
      } else {
        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        const sessionUser = authData.user;
        if (sessionUser) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('is_approved')
            .eq('id', sessionUser.id)
            .maybeSingle();
          
          if (!userData || userData.is_approved !== true) {
            await supabase.auth.signOut();
            throw new Error('Awaiting approval');
          }
        }
        onSuccess?.();
      }
    } catch (err: any) {
      const msg = err.message === 'Awaiting approval' ? 'Awaiting approval' : (err.message || 'Authentication failed');
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
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

          {isSignUp && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block mb-2">Repeat Password</label>
              <input 
                type="password" 
                required={isSignUp}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-black/5 border-2 border-black/5 rounded-xl px-4 py-3 font-medium outline-none focus:border-black transition-colors"
                placeholder="••••••••"
              />
            </div>
          )}

          {localError && (
            <p className="text-venus-accent text-xs font-bold text-center">{localError}</p>
          )}

          <button 
            type="submit" 
            disabled={loading || isSubmitting}
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
