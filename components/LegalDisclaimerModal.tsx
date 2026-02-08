import React, { useState } from 'react';

interface LegalDisclaimerModalProps {
  onAccept: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

const LegalDisclaimerModal: React.FC<LegalDisclaimerModalProps> = ({ onAccept, onOpenTerms, onOpenPrivacy }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 md:p-10 max-w-lg w-full shadow-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/icon-192.png"
            alt="SOL Trivia"
            className="w-24 h-24 rounded-2xl object-contain"
          />
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-[1000] italic text-white text-center mb-2 uppercase tracking-tighter">
          Welcome to SOL Trivia
        </h2>
        <p className="text-[#14F195] text-[10px] md:text-xs font-black uppercase tracking-widest text-center mb-6">
          Before you enter
        </p>

        {/* Legal Text */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 md:p-5 mb-6">
          <p className="text-zinc-300 text-xs md:text-sm leading-relaxed">
            SOL Trivia is an entertainment platform where players can win and lose real SOL. By continuing, you confirm that you are at least 18 years of age and that you have read and agree to our{' '}
            <button
              onClick={onOpenTerms}
              className="text-[#14F195] font-bold hover:underline"
            >
              Terms of Service
            </button>
            {' '}and{' '}
            <button
              onClick={onOpenPrivacy}
              className="text-[#14F195] font-bold hover:underline"
            >
              Privacy Policy
            </button>.
          </p>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 mb-8 cursor-pointer group select-none">
          <div className="relative flex-shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${
              agreed
                ? 'bg-[#14F195] border-[#14F195]'
                : 'border-zinc-600 group-hover:border-zinc-400'
            }`}>
              {agreed && (
                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-zinc-400 text-xs md:text-sm leading-relaxed">
            I have read and agree to the <span className="text-white font-semibold">Terms of Service</span> and <span className="text-white font-semibold">Privacy Policy</span>
          </span>
        </label>

        {/* Enter Button */}
        <button
          onClick={onAccept}
          disabled={!agreed}
          className={`w-full py-4 rounded-xl font-[1000] italic uppercase tracking-tight text-base md:text-lg transition-all ${
            agreed
              ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white shadow-lg shadow-[#14F195]/20 hover:shadow-[#14F195]/40 active:scale-[0.98]'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          Enter SOL Trivia
        </button>
      </div>
    </div>
  );
};

export default LegalDisclaimerModal;
