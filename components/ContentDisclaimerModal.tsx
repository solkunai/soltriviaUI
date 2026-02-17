import React, { useState } from 'react';

interface ContentDisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onClose: () => void;
}

const STORAGE_KEY = 'soltrivia_custom_disclaimer_accepted';

export function hasAcceptedContentDisclaimer(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const ContentDisclaimerModal: React.FC<ContentDisclaimerModalProps> = ({ isOpen, onAccept, onClose }) => {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  const handleAccept = () => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 md:p-10 max-w-lg w-full shadow-2xl">
        {/* Warning Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-[1000] italic text-white text-center mb-2 uppercase tracking-tighter">
          Content Guidelines
        </h2>
        <p className="text-yellow-400 text-[10px] md:text-xs font-black uppercase tracking-widest text-center mb-6">
          Read before creating
        </p>

        {/* Guidelines */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 md:p-5 mb-6">
          <p className="text-zinc-300 text-xs md:text-sm leading-relaxed mb-3">
            Custom games are shared publicly. By creating a custom game, you agree that your content will <span className="text-white font-bold">NOT</span> contain:
          </p>
          <ul className="text-zinc-400 text-xs md:text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">&#10005;</span>
              <span>Hate speech, discrimination, or harassment</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">&#10005;</span>
              <span>Terrorism, violence, or threats</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">&#10005;</span>
              <span>Sexually explicit or NSFW content</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">&#10005;</span>
              <span>Scams, phishing links, or malicious content</span>
            </li>
          </ul>
          <div className="mt-4 pt-3 border-t border-white/5">
            <p className="text-red-400 text-[10px] md:text-xs font-black uppercase tracking-wider">
              Violation will result in permanent ban of your wallet address.
            </p>
          </div>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 mb-8 cursor-pointer group select-none">
          <div className="relative shrink-0 mt-0.5">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${agreed ? 'bg-[#14F195] border-[#14F195]' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
              {agreed && (
                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-zinc-300 text-xs md:text-sm leading-relaxed">
            I agree to create content that follows the community guidelines and understand that violations will result in a <span className="text-white font-bold">permanent ban</span>.
          </span>
        </label>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={!agreed}
            className={`flex-1 min-h-[44px] px-6 py-3 rounded-xl font-black uppercase text-xs tracking-wider transition-all active:scale-[0.98] ${agreed ? 'bg-[#14F195] text-black hover:bg-[#00FFA3]' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}
          >
            I Agree
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContentDisclaimerModal;
