import React from 'react';
import { useTranslation } from 'react-i18next';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, onOpenTerms, onOpenPrivacy }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const steps = [
    { title: t('guide.step1Title'), desc: t('guide.step1Desc') },
    { title: t('guide.step2Title'), desc: t('guide.step2Desc') },
    { title: t('guide.step3Title'), desc: t('guide.step3Desc') },
    { title: t('guide.step4Title'), desc: t('guide.step4Desc') },
    { title: t('guide.step5Title'), desc: t('guide.step5Desc') },
    { title: t('guide.step6Title'), desc: t('guide.step6Desc') },
    { title: t('guide.step7Title'), desc: t('guide.step7Desc') },
    { title: t('guide.step8Title'), desc: t('guide.step8Desc') },
    { title: t('guide.step9Title'), desc: t('guide.step9Desc') },
    { title: t('guide.step10Title'), desc: t('guide.step10Desc') },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/90 animate-fade-in overflow-hidden">
      <div className="relative w-full max-w-md md:max-w-lg bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden max-h-[85vh] flex flex-col rounded-2xl">
        {/* Color Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#10b981]"></div>

        <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-[#00FFA3] text-[10px] font-black tracking-[0.4em] uppercase mb-1 block">{t('guide.protocolGuide')}</span>
              <h2 className="text-2xl md:text-3xl font-[1000] italic uppercase tracking-tighter text-white leading-none">HOW TO <span className="sol-gradient-text">PLAY</span></h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 mb-8">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-3.5 items-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#00FFA3] font-black italic text-[11px]">
                  {idx + 1}
                </div>
                <div className="pt-0.5">
                  <h4 className="text-white font-black uppercase text-[11px] tracking-wider mb-0.5">{step.title}</h4>
                  <p className="text-zinc-500 text-[10px] font-medium leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#111] border border-white/5 p-4 rounded-xl">
            <h3 className="text-zinc-400 font-black uppercase text-[9px] tracking-[0.3em] mb-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#FFD700]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              {t('guide.payoutMatrix')}
            </h3>
            <div className="space-y-1.5">
              {[
                { place: t('guide.firstPlace'), pct: '50%', accent: true },
                { place: t('guide.secondPlace'), pct: '20%', accent: false },
                { place: t('guide.thirdPlace'), pct: '15%', accent: false },
                { place: t('guide.fourthPlace'), pct: '10%', accent: false },
                { place: t('guide.fifthPlace'), pct: '5%', accent: false },
              ].map((row) => (
                <div key={row.place} className="flex justify-between text-[10px]">
                  <span className="text-zinc-600 font-bold uppercase">{row.place}</span>
                  <span className={`font-black italic ${row.accent ? 'text-[#00FFA3]' : 'text-white'}`}>{row.pct}</span>
                </div>
              ))}
              <div className="pt-2.5 mt-2.5 border-t border-white/5 space-y-1">
                <div className="flex justify-between text-[9px] text-zinc-500 font-bold uppercase">
                  <span>{t('guide.platformFee')}</span>
                  <span>{t('guide.platformFeeAmount')}</span>
                </div>
                <div className="flex justify-between text-[9px] text-[#14F195]/60 font-bold uppercase">
                  <span>{t('guide.potDeduction')}</span>
                  <span>{t('guide.potDeductionAmount')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Entry Limits */}
          <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl mt-4">
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-wider text-center italic leading-relaxed">
              {t('guide.fairPlayLimits')}
            </p>
          </div>

          {/* Legal links */}
          <div className="pt-5 mt-5 border-t border-white/5 flex flex-wrap items-center justify-center gap-3 text-zinc-500">
            <button
              type="button"
              onClick={() => { onClose(); onOpenTerms?.(); }}
              className="text-[10px] font-black uppercase tracking-widest italic hover:text-[#14F195] transition-colors"
            >
              {t('guide.termsOfService')}
            </button>
            <span className="text-white/20 text-[10px]">|</span>
            <button
              type="button"
              onClick={() => { onClose(); onOpenPrivacy?.(); }}
              className="text-[10px] font-black uppercase tracking-widest italic hover:text-[#14F195] transition-colors"
            >
              {t('guide.privacyPolicy')}
            </button>
          </div>
        </div>

        {/* Footer Mascot Decor */}
        <div className="absolute bottom-0 right-0 w-24 h-24 opacity-5 pointer-events-none translate-x-4 translate-y-4">
           <img src="brainy-idea.png" alt="" className="w-full h-full grayscale" />
        </div>
      </div>
    </div>
  );
};

export default GuideModal;
