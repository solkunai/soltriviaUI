import React, { useState, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SystemProgram, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { createCustomGame } from '../src/utils/api';
import {
  REVENUE_WALLET,
  CUSTOM_GAME_CREATION_FEE_LAMPORTS,
  CUSTOM_GAME_PLATFORM_FEE_LAMPORTS,
  CUSTOM_GAME_QUESTION_COUNTS,
  CUSTOM_GAME_TIME_LIMITS,
  CUSTOM_GAME_NAME_MAX,
  CUSTOM_GAME_QUESTION_TEXT_MAX,
  CUSTOM_GAME_OPTION_TEXT_MAX,
  CUSTOM_GAME_SLUG_MIN,
  CUSTOM_GAME_SLUG_MAX,
  VALID_ROUND_COUNTS,
} from '../src/utils/constants';

interface CreateCustomGameViewProps {
  hasGamePass: boolean;
  onGameCreated: (slug: string) => void;
  onBack: () => void;
}

interface QuestionDraft {
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

type Step = 'settings' | 'questions' | 'review';

const CreateCustomGameView: React.FC<CreateCustomGameViewProps> = ({ hasGamePass, onGameCreated, onBack }) => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  // Step
  const [step, setStep] = useState<Step>('settings');

  // Settings
  const [gameName, setGameName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15>(10);
  const [roundCount, setRoundCount] = useState<number>(1);
  const [timeLimit, setTimeLimit] = useState<number>(15);

  // Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);

  // State
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Valid round counts for selected question count
  const validRounds = useMemo(() => VALID_ROUND_COUNTS[questionCount] || [1], [questionCount]);

  // Reset round count if invalid for new question count
  const handleQuestionCountChange = (count: 5 | 10 | 15) => {
    setQuestionCount(count);
    const valid = VALID_ROUND_COUNTS[count] || [1];
    if (!valid.includes(roundCount)) {
      setRoundCount(valid[0]);
    }
  };

  // Fee
  const totalFeeLamports = hasGamePass
    ? CUSTOM_GAME_PLATFORM_FEE_LAMPORTS
    : CUSTOM_GAME_CREATION_FEE_LAMPORTS + CUSTOM_GAME_PLATFORM_FEE_LAMPORTS;
  const totalFeeSol = totalFeeLamports / 1_000_000_000;

  // Initialize questions when moving to question builder
  const goToQuestions = () => {
    if (!gameName.trim()) { setError('Game name is required'); return; }
    if (gameName.trim().length > CUSTOM_GAME_NAME_MAX) { setError(`Game name max ${CUSTOM_GAME_NAME_MAX} chars`); return; }
    if (customSlug && (customSlug.length < CUSTOM_GAME_SLUG_MIN || customSlug.length > CUSTOM_GAME_SLUG_MAX)) {
      setError(`Slug must be ${CUSTOM_GAME_SLUG_MIN}-${CUSTOM_GAME_SLUG_MAX} characters`); return;
    }
    if (customSlug && !/^[a-z0-9-]+$/.test(customSlug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens'); return;
    }
    setError(null);

    // Initialize empty questions if needed
    if (questions.length !== questionCount) {
      const newQuestions: QuestionDraft[] = Array.from({ length: questionCount }, (_, i) =>
        questions[i] || { questionText: '', options: ['', '', '', ''], correctIndex: 0 as const }
      );
      setQuestions(newQuestions);
      setCurrentQIdx(0);
    }
    setStep('questions');
  };

  // Update current question
  const updateQuestion = (field: string, value: any) => {
    const updated = [...questions];
    if (field === 'questionText') {
      updated[currentQIdx] = { ...updated[currentQIdx], questionText: value };
    } else if (field === 'correctIndex') {
      updated[currentQIdx] = { ...updated[currentQIdx], correctIndex: value };
    } else if (field.startsWith('option')) {
      const optIdx = parseInt(field.replace('option', ''));
      const opts = [...updated[currentQIdx].options] as [string, string, string, string];
      opts[optIdx] = value;
      updated[currentQIdx] = { ...updated[currentQIdx], options: opts };
    }
    setQuestions(updated);
  };

  // Validate single question
  const isQuestionValid = (q: QuestionDraft): boolean => {
    return q.questionText.trim().length > 0 &&
      q.options.every(o => o.trim().length > 0) &&
      q.correctIndex >= 0 && q.correctIndex <= 3;
  };

  // All questions valid
  const allQuestionsValid = questions.length === questionCount && questions.every(isQuestionValid);

  const goToReview = () => {
    if (!allQuestionsValid) {
      setError('All questions must be filled out with all 4 options and a correct answer marked');
      return;
    }
    setError(null);
    setStep('review');
  };

  // Create game (payment + API)
  const handleCreate = async () => {
    if (!publicKey || creating) return;
    setCreating(true);
    setError(null);

    try {
      // Build payment tx
      const { blockhash } = await connection.getLatestBlockhash();
      const instructions = [
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(REVENUE_WALLET),
          lamports: totalFeeLamports,
        }),
      ];

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      await Promise.race([
        connection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)),
      ]);

      // Call Edge Function
      const result = await createCustomGame({
        walletAddress: publicKey.toBase58(),
        txSignature: signature,
        name: gameName.trim(),
        slug: customSlug.trim() || undefined,
        questionCount: questionCount as 5 | 10 | 15,
        roundCount,
        timeLimitSeconds: timeLimit,
        questions: questions.map(q => ({
          questionText: q.questionText.trim(),
          options: q.options.map(o => o.trim()) as [string, string, string, string],
          correctIndex: q.correctIndex,
        })),
        contentDisclaimerAccepted: true,
      });

      setCreatedSlug(result.slug);
    } catch (err: any) {
      console.error('Failed to create custom game:', err);
      setError(err.message || 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  // Success screen
  if (createdSlug) {
    const shareUrl = `${window.location.origin}/game/${createdSlug}`;
    return (
      <div className="min-h-full flex items-center justify-center p-6 bg-[#050505]">
        <div className="text-center max-w-md w-full">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#14F195]/10 border border-[#14F195]/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-[1000] italic text-white uppercase mb-2">Game Created!</h2>
          <p className="text-zinc-400 text-sm mb-6">Share the link with your friends</p>

          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 mb-6">
            <p className="text-[#14F195] text-sm font-mono break-all">{shareUrl}</p>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
              }}
              className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={() => {
                const text = `I just created a custom trivia game "${gameName}" on @SolTrivia! Think you can beat it?`;
                window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
              }}
              className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Share on X
            </button>
          </div>

          <button
            onClick={() => onGameCreated(createdSlug)}
            className="w-full min-h-[48px] px-6 py-3 bg-[#14F195] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#00FFA3] transition-all active:scale-[0.98]"
          >
            Go to Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-[#050505] p-4 sm:p-6 md:p-12 pb-32 md:pb-12 relative overflow-y-auto">
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={step === 'settings' ? onBack : () => setStep(step === 'review' ? 'questions' : 'settings')} className="text-zinc-500 hover:text-zinc-300 font-black uppercase text-[10px] tracking-wider transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="flex gap-2">
            {(['settings', 'questions', 'review'] as Step[]).map((s, i) => (
              <div key={s} className={`w-8 h-1 rounded-full transition-all ${step === s ? 'bg-[#14F195]' : i < ['settings', 'questions', 'review'].indexOf(step) ? 'bg-[#14F195]/40' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        <p className="text-[#14F195] text-[9px] font-black uppercase tracking-[0.4em] mb-2">Create Custom Game</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-xs font-black">{error}</p>
          </div>
        )}

        {/* STEP 1: Settings */}
        {step === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-4xl font-[1000] italic text-white uppercase tracking-tighter">Game Settings</h2>

            {/* Game Name */}
            <div>
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Game Name *</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value.slice(0, CUSTOM_GAME_NAME_MAX))}
                placeholder="My Trivia Night"
                className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#14F195]/40 transition-colors"
              />
              <p className="text-zinc-700 text-[10px] mt-1">{gameName.length}/{CUSTOM_GAME_NAME_MAX}</p>
            </div>

            {/* Custom Slug */}
            <div>
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Custom Link (optional)</label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-600 text-xs font-mono shrink-0">soltrivia.app/game/</span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, CUSTOM_GAME_SLUG_MAX))}
                  placeholder="auto-generated"
                  className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm placeholder-zinc-600 focus:outline-none focus:border-[#14F195]/40 transition-colors"
                />
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Questions</label>
              <div className="flex gap-2">
                {CUSTOM_GAME_QUESTION_COUNTS.map((count) => (
                  <button
                    key={count}
                    onClick={() => handleQuestionCountChange(count)}
                    className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${questionCount === count ? 'bg-[#14F195] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Round Count */}
            <div>
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Rounds</label>
              <div className="flex gap-2 flex-wrap">
                {validRounds.map((count) => (
                  <button
                    key={count}
                    onClick={() => setRoundCount(count)}
                    className={`min-w-[44px] min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${roundCount === count ? 'bg-[#14F195] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="text-zinc-700 text-[10px] mt-1">{questionCount / roundCount} questions per round</p>
            </div>

            {/* Time Limit */}
            <div>
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Time per Question</label>
              <div className="flex gap-2">
                {CUSTOM_GAME_TIME_LIMITS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeLimit(t)}
                    className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${timeLimit === t ? 'bg-[#14F195] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={goToQuestions}
              className="w-full min-h-[48px] px-6 py-3 bg-[#14F195] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#00FFA3] transition-all active:scale-[0.98]"
            >
              Next: Write Questions
            </button>
          </div>
        )}

        {/* STEP 2: Question Builder */}
        {step === 'questions' && questions.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-[1000] italic text-white uppercase tracking-tighter">Question {currentQIdx + 1}</h2>
              <span className="text-[#14F195] text-sm font-[1000] italic">{currentQIdx + 1} / {questionCount}</span>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 flex-wrap">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQIdx(i)}
                  className={`w-6 h-6 rounded-full text-[9px] font-black transition-all ${
                    i === currentQIdx
                      ? 'bg-[#14F195] text-black'
                      : isQuestionValid(q)
                        ? 'bg-[#14F195]/20 text-[#14F195] border border-[#14F195]/30'
                        : 'bg-white/5 text-zinc-600 border border-white/10'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Question Text */}
            <div>
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Question *</label>
              <textarea
                value={questions[currentQIdx].questionText}
                onChange={(e) => updateQuestion('questionText', e.target.value.slice(0, CUSTOM_GAME_QUESTION_TEXT_MAX))}
                placeholder="What is the capital of France?"
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#14F195]/40 transition-colors resize-none"
              />
              <p className="text-zinc-700 text-[10px] mt-1">{questions[currentQIdx].questionText.length}/{CUSTOM_GAME_QUESTION_TEXT_MAX}</p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block">Answers * (tap to mark correct)</label>
              {['A', 'B', 'C', 'D'].map((label, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuestion('correctIndex', idx as 0 | 1 | 2 | 3)}
                    className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-[1000] italic text-sm transition-all active:scale-[0.95] ${
                      questions[currentQIdx].correctIndex === idx
                        ? 'bg-[#14F195] text-black'
                        : 'bg-white/5 border border-white/10 text-zinc-500 hover:border-[#14F195]/30'
                    }`}
                  >
                    {label}
                  </button>
                  <input
                    type="text"
                    value={questions[currentQIdx].options[idx]}
                    onChange={(e) => updateQuestion(`option${idx}`, e.target.value.slice(0, CUSTOM_GAME_OPTION_TEXT_MAX))}
                    placeholder={`Option ${label}`}
                    className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#14F195]/40 transition-colors"
                  />
                </div>
              ))}
              <p className="text-zinc-600 text-[10px]">Tap the letter to mark the correct answer. Currently: <span className="text-[#14F195] font-black">{['A', 'B', 'C', 'D'][questions[currentQIdx].correctIndex]}</span></p>
            </div>

            {/* Nav */}
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentQIdx(Math.max(0, currentQIdx - 1))}
                disabled={currentQIdx === 0}
                className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 disabled:opacity-30 transition-all active:scale-[0.98]"
              >
                Prev
              </button>
              {currentQIdx < questionCount - 1 ? (
                <button
                  onClick={() => setCurrentQIdx(currentQIdx + 1)}
                  className="flex-1 min-h-[44px] px-4 py-3 bg-[#14F195] text-black font-[1000] italic uppercase text-sm tracking-tighter rounded-xl hover:bg-[#00FFA3] transition-all active:scale-[0.98]"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={goToReview}
                  disabled={!allQuestionsValid}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic uppercase text-sm tracking-tighter transition-all active:scale-[0.98] ${
                    allQuestionsValid ? 'bg-[#14F195] text-black hover:bg-[#00FFA3]' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  Review Game
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Review & Pay */}
        {step === 'review' && (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-4xl font-[1000] italic text-white uppercase tracking-tighter">Review & Create</h2>

            {/* Summary */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-[1000] italic text-xl uppercase mb-4">{gameName}</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Questions</span>
                  <span className="text-white font-[1000] italic">{questionCount}</span>
                </div>
                <div className="text-center">
                  <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Rounds</span>
                  <span className="text-white font-[1000] italic">{roundCount}</span>
                </div>
                <div className="text-center">
                  <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Time/Q</span>
                  <span className="text-white font-[1000] italic">{timeLimit}s</span>
                </div>
              </div>
              {customSlug && (
                <p className="text-zinc-500 text-xs font-mono">soltrivia.app/game/{customSlug}</p>
              )}
            </div>

            {/* Questions Preview */}
            <div className="space-y-2">
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block">Questions Preview</label>
              {questions.map((q, i) => (
                <details key={i} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                  <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 hover:bg-white/[0.03] transition-colors">
                    <span className={`w-6 h-6 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 ${isQuestionValid(q) ? 'bg-[#14F195]/20 text-[#14F195]' : 'bg-red-500/20 text-red-400'}`}>{i + 1}</span>
                    <span className="text-white text-sm font-bold truncate flex-1">{q.questionText || '(empty)'}</span>
                  </summary>
                  <div className="px-4 pb-3 space-y-1">
                    {q.options.map((opt, j) => (
                      <div key={j} className={`text-xs px-3 py-1.5 rounded ${j === q.correctIndex ? 'text-[#14F195] bg-[#14F195]/10' : 'text-zinc-500'}`}>
                        {['A', 'B', 'C', 'D'][j]}. {opt || '(empty)'}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {/* Fee */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-xs font-black uppercase">Total Fee</span>
                <span className="text-[#14F195] text-lg font-[1000] italic">{totalFeeSol} SOL</span>
              </div>
              <div className="mt-2 space-y-1">
                {!hasGamePass && (
                  <div className="flex justify-between text-zinc-600 text-[10px]">
                    <span>Creation fee</span>
                    <span>{CUSTOM_GAME_CREATION_FEE_LAMPORTS / 1_000_000_000} SOL</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-600 text-[10px]">
                  <span>Platform fee</span>
                  <span>{CUSTOM_GAME_PLATFORM_FEE_LAMPORTS / 1_000_000_000} SOL</span>
                </div>
                {hasGamePass && (
                  <p className="text-[#14F195] text-[10px] font-black mt-1">Game Pass: creation fee waived!</p>
                )}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className={`w-full min-h-[52px] px-6 py-4 rounded-xl font-[1000] italic uppercase text-xl tracking-tighter transition-all active:scale-[0.98] ${
                creating ? 'bg-zinc-800 text-zinc-500 cursor-wait' : 'bg-[#14F195] text-black hover:bg-[#00FFA3] shadow-[0_10px_40px_-10px_rgba(20,241,149,0.3)]'
              }`}
            >
              {creating ? 'Creating...' : `Create Game (${totalFeeSol} SOL)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateCustomGameView;
