import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FAQItem {
  q: string;
  a: string;
}

const FAQModal: React.FC<FAQModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const FAQ_ITEMS: FAQItem[] = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2') },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
    { q: t('faq.q5'), a: t('faq.a5') },
    { q: t('faq.q6'), a: t('faq.a6') },
    { q: t('faq.q7'), a: t('faq.a7') },
    { q: t('faq.q8'), a: t('faq.a8') },
    { q: t('faq.q9'), a: t('faq.a9') },
    { q: t('faq.q10'), a: t('faq.a10') },
    { q: t('faq.q11'), a: t('faq.a11') },
    { q: t('faq.q12'), a: t('faq.a12') },
    { q: t('faq.q13'), a: t('faq.a13') },
    { q: t('faq.q14'), a: t('faq.a14') },
    { q: t('faq.q15'), a: t('faq.a15') },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-[1000] italic uppercase tracking-tighter text-white">{t('faq.title')}</h2>
            <p className="text-zinc-500 text-[10px] font-bold italic mt-0.5">{t('faq.frequentlyAskedQuestions')}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* FAQ Items */}
        <div className="p-4 overflow-y-auto flex-1 space-y-1">
          {FAQ_ITEMS.map((item, i) => {
            const isExpanded = openIndex === i;
            return (
              <div key={i} className="border border-white/5 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenIndex(isExpanded ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-white text-sm font-bold pr-4">{item.q}</span>
                  <svg
                    className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-zinc-400 text-xs leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FAQModal;
