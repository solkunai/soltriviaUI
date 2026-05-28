import * as React from 'react';
import { useState, useEffect } from 'react';
import { isStandalonePWA, markA2HSDismissed } from '../src/utils/pwa';

interface PwaInstallPromptProps {
  /** App decides when to show this: a fresh signup/login on mobile web. */
  open: boolean;
  onClose: () => void;
}

const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ open, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Capture the beforeinstallprompt event whenever it fires (Android/Chrome)
  // + detect iOS. This runs regardless of `open` so the event isn't missed.
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent));
    }
    const onBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          markA2HSDismissed();
          onClose();
        }
      } finally {
        setInstalling(false);
      }
    }
  };

  const handleDismiss = () => {
    markA2HSDismissed();
    onClose();
  };

  // Defensive: never render if not requested or already installed.
  if (!open || isStandalonePWA()) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 z-[200] animate-fade-in"
        onClick={handleDismiss}
      />
      
      {/* Modal Popup */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none animate-fade-in">
        <div 
          className="bg-[#0a0a0a] border border-[#00FFA3]/30 rounded-2xl shadow-2xl p-6 max-w-sm w-full pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00FFA3]/20 to-[#00FFA3]/10 flex items-center justify-center border border-[#00FFA3]/30">
              <span className="text-[#00FFA3] text-3xl">📱</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-white font-bold text-xl text-center mb-2">
            Install SOL Trivia
          </h3>

          {/* Description */}
          <p className="text-white/80 text-sm text-center mb-6 leading-relaxed">
            {isIOS ? (
              <>
                Get the best experience by adding SOL Trivia to your home screen.
                <br />
                <span className="text-[#00FFA3] font-semibold mt-2 block">
                  Tap Share → "Add to Home Screen"
                </span>
              </>
            ) : (
              <>
                Add SOL Trivia to your home screen for quick access, faster loading, and a full-screen experience.
              </>
            )}
          </p>

          {/* Benefits List */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-white/70 text-xs">
              <span className="text-[#00FFA3]">✓</span>
              <span>Faster loading & offline support</span>
            </div>
            <div className="flex items-center gap-2 text-white/70 text-xs">
              <span className="text-[#00FFA3]">✓</span>
              <span>Full-screen experience</span>
            </div>
            <div className="flex items-center gap-2 text-white/70 text-xs">
              <span className="text-[#00FFA3]">✓</span>
              <span>Quick access from home screen</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {!isIOS && deferredPrompt && (
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00FFA3] to-[#00dd8f] text-black font-bold text-sm hover:from-[#00dd8f] hover:to-[#00FFA3] active:scale-95 disabled:opacity-70 transition-all shadow-lg shadow-[#00FFA3]/20"
              >
                {installing ? 'Installing...' : 'Install Now'}
              </button>
            )}
            {isIOS && (
              <div className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00FFA3] to-[#00dd8f] text-black font-bold text-sm text-center shadow-lg shadow-[#00FFA3]/20">
                Follow instructions above ↑
              </div>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 rounded-xl text-white/60 text-sm hover:text-white/80 hover:bg-white/5 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PwaInstallPrompt;
