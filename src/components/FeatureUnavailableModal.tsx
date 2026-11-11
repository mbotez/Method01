import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

interface FeatureUnavailableModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  subMessage?: string;
}

export const FeatureUnavailableModal: React.FC<FeatureUnavailableModalProps> = ({
  isOpen,
  onClose,
  message = "Feature currently not available",
  subMessage = "Please try again later or search for products manually."
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="feature-unavailable-overlay"
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[250] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          id="feature-unavailable-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feature-unavailable-title"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl max-w-sm w-full relative text-center space-y-5 border border-black/5"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            type="button"
            className="absolute top-4 right-4 text-black/40 hover:text-black transition cursor-pointer p-1.5 rounded-full hover:bg-black/5" 
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 bg-black/5 rounded-full flex items-center justify-center mx-auto text-black mt-1">
            <AlertCircle className="w-7 h-7 stroke-[1.75]" />
          </div>

          <div className="space-y-2">
            <h3 
              id="feature-unavailable-title" 
              className="text-base font-black uppercase tracking-tight text-black"
            >
              {message}
            </h3>
            {subMessage && (
              <p className="text-xs text-black/60 font-medium leading-relaxed">
                {subMessage}
              </p>
            )}
          </div>

          <div className="pt-1">
            <button
              type="button"
              id="feature-unavailable-ok-btn"
              onClick={onClose}
              className="w-full bg-black text-white py-3 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black/80 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer shadow-md"
            >
              OK
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
