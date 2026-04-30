import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  isSignUpInitial?: boolean;
}

export const Login: React.FC<LoginProps> = ({ onSuccess, onError, isSignUpInitial = false }) => {
  const [isSignUp, setIsSignUp] = useState(isSignUpInitial);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user) {
          const { error: profileError } = await supabase.from('users').insert([{
            id: data.user.id,
            email: email,
            username: username
          }]);
          
          if (profileError && profileError.code !== '23505') { 
             console.error("Error creating user profile", profileError);
          }
        }
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

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto"
    >
      <div className="clean-card p-10 border-2 border-black/5 bg-white shadow-2xl rounded-3xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-sans font-black text-black uppercase italic tracking-tighter mb-2">
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </h2>
          <p className="text-black/50 text-sm font-medium">
            {isSignUp ? 'Join the number 1 skincare community' : 'Access the community'}
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
                placeholder="skincare_guru"
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
              placeholder="name@nexus.com"
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
            disabled={loading || isSubmitting}
            className="w-full bg-black text-white font-black uppercase tracking-widest py-4 rounded-xl hover:bg-venus-accent transition-all disabled:opacity-50"
          >
            {loading || isSubmitting ? 'Authenticating...' : "Let's go"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs font-black text-black/40 uppercase tracking-widest">
          {isSignUp ? 'Already have credentials?' : 'Haven\'t joined yet?'}
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="ml-2 text-black hover:text-venus-accent underline"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </motion.div>
  );
};
