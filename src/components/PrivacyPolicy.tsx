import React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import privPolText from './priv_pol.txt?raw';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  // Parse lines or display paragraphs cleanly
  const lines = privPolText.split('\n').filter(Boolean);
  const title = lines[0] || 'Privacy Policy';
  const metadata = lines.slice(1, 4);
  const bodyLines = lines.slice(4);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-black/70 hover:text-black bg-black/5 hover:bg-black/10 px-4 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2 text-venus-accent">
          <Shield className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-widest">Canonic Security</span>
        </div>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-6 sm:p-10 shadow-sm space-y-6">
        <div className="border-b border-black/10 pb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight mb-2">
            {title}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/60 font-semibold">
            {metadata.map((meta, i) => (
              <span key={i}>{meta}</span>
            ))}
          </div>
        </div>

        <div className="space-y-4 text-sm text-black/80 leading-relaxed">
          {bodyLines.map((line, idx) => {
            const trimmed = line.trim();
            const isHeading = /^\d+\./.test(trimmed);
            if (isHeading) {
              return (
                <h2 key={idx} className="text-base font-black text-black pt-4 pb-1 border-b border-black/5">
                  {trimmed}
                </h2>
              );
            }
            return (
              <p key={idx} className="text-black/70 leading-relaxed">
                {trimmed}
              </p>
            );
          })}
        </div>

        <div className="pt-6 border-t border-black/10 text-center text-xs text-black/40 font-semibold">
          © {new Date().getFullYear()} Daybreak Technologies Ltd. All rights reserved.
        </div>
      </div>
    </div>
  );
};
