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
  CUSTOM_GAME_ENTRY_FEE_PRESETS,
  CUSTOM_GAME_ENTRY_FEE_LABELS,
  CUSTOM_GAME_MIN_ENTRY_FEE,
  CUSTOM_GAME_MAX_ENTRY_FEE,
  CUSTOM_GAME_MAX_PLAYER_PRESETS,
  CUSTOM_GAME_MIN_PLAYERS,
  CUSTOM_GAME_DURATION_PRESETS,
  CUSTOM_GAME_WINNER_SPLITS,
  CUSTOM_GAME_WINNER_SPLIT_LABELS,
  CUSTOM_GAME_PLATFORM_CUT_BPS,
  TXN_FEE_LAMPORTS,
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

type Step = 'settings' | 'prize' | 'questions' | 'review';
const ALL_STEPS: Step[] = ['settings', 'prize', 'questions', 'review'];

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

  // Prize Pool
  const [prizeModel, setPrizeModel] = useState<'free' | 'player_funded'>('free');
  const [entryFeeLamports, setEntryFeeLamports] = useState<number>(CUSTOM_GAME_ENTRY_FEE_PRESETS[1]); // 0.1 SOL default
  const [customEntryFee, setCustomEntryFee] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<number>(10);
  const [gameDurationMinutes, setGameDurationMinutes] = useState<number>(1440); // 24h default
  const [maxWinners, setMaxWinners] = useState<number>(3);

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

  // Prize calculations
  const isPaid = prizeModel === 'player_funded';
  const activeEntryFee = customEntryFee ? Math.round(parseFloat(customEntryFee) * 1_000_000_000) : entryFeeLamports;
  const estimatedPot = isPaid ? activeEntryFee * maxPlayers : 0;
  const platformCut = Math.floor(estimatedPot * CUSTOM_GAME_PLATFORM_CUT_BPS / 10000);
  const prizePot = estimatedPot - platformCut;
  const winnerSplitBps = CUSTOM_GAME_WINNER_SPLITS[maxWinners];
  const winnerAmounts = winnerSplitBps.filter((b: number) => b > 0).map((b: number) => Math.floor(prizePot * b / 10000));

  // Reset round count if invalid for new question count
  const handleQuestionCountChange = (count: 5 | 10 | 15) => {
    setQuestionCount(count);
    const valid = VALID_ROUND_COUNTS[count] || [1];
    if (!valid.includes(roundCount)) {
      setRoundCount(valid[0]);
    }
  };

  // Fee (creation fee for the game itself — separate from entry fee)
  const creationFeeLamports = hasGamePass
    ? CUSTOM_GAME_PLATFORM_FEE_LAMPORTS
    : CUSTOM_GAME_CREATION_FEE_LAMPORTS + CUSTOM_GAME_PLATFORM_FEE_LAMPORTS;
  const creationFeeSol = creationFeeLamports / 1_000_000_000;

  // Custom entry fee validation
  const handleCustomFeeChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setCustomEntryFee(cleaned);
  };
  const isCustomFeeValid = !customEntryFee || (
    parseFloat(customEntryFee) >= CUSTOM_GAME_MIN_ENTRY_FEE / 1_000_000_000 &&
    parseFloat(customEntryFee) <= CUSTOM_GAME_MAX_ENTRY_FEE / 1_000_000_000
  );

  // Navigate: settings → prize
  const goToPrize = () => {
    if (!gameName.trim()) { setError('Game name is required'); return; }
    if (gameName.trim().length > CUSTOM_GAME_NAME_MAX) { setError(`Game name max ${CUSTOM_GAME_NAME_MAX} chars`); return; }
    if (customSlug && (customSlug.length < CUSTOM_GAME_SLUG_MIN || customSlug.length > CUSTOM_GAME_SLUG_MAX)) {
      setError(`Slug must be ${CUSTOM_GAME_SLUG_MIN}-${CUSTOM_GAME_SLUG_MAX} characters`); return;
    }
    if (customSlug && !/^[a-z0-9-]+$/.test(customSlug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens'); return;
    }
    setError(null);
    setStep('prize');
  };

  // Navigate: prize → questions
  const goToQuestions = () => {
    if (isPaid) {
      if (!isCustomFeeValid) { setError('Entry fee must be between 0.01 and 10 SOL'); return; }
      if (activeEntryFee < CUSTOM_GAME_MIN_ENTRY_FEE) { setError('Minimum entry fee is 0.01 SOL'); return; }
      if (maxPlayers < CUSTOM_GAME_MIN_PLAYERS) { setError(`Minimum ${CUSTOM_GAME_MIN_PLAYERS} players`); return; }
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
          lamports: creationFeeLamports,
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
      const params: any = {
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
      };

      // Add prize pool fields for paid games
      if (isPaid) {
        params.prize_model = 'player_funded';
        params.entry_fee_lamports = activeEntryFee;
        params.max_players = maxPlayers;
        params.game_duration_minutes = gameDurationMinutes;
        params.max_winners = maxWinners;
        params.prize_split_bps = CUSTOM_GAME_WINNER_SPLITS[maxWinners];
      }

      const result = await createCustomGame(params);

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
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-[1000] italic text-white uppercase mb-2">Game Created!</h2>
          <p className="text-zinc-400 text-sm mb-6">Share the link with your friends</p>

          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 mb-6">
            <p className="text-[#38BDF8] text-sm font-mono break-all">{shareUrl}</p>
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
                const text = isPaid
                  ? `just dropped a prize pool trivia game on @soltrivia_app\n\n"${gameName}" | entry: ${(activeEntryFee / 1_000_000_000).toFixed(2)} SOL\n\nthink you're smart enough to win? ape in\n\n${shareUrl}`
                  : `just created "${gameName}" on @soltrivia_app\n\nfree trivia game, harder than it looks\n\nprove you're not ngmi\n\n${shareUrl}`;
                window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Share on X
            </button>
          </div>

          <button
            onClick={() => onGameCreated(createdSlug)}
            className="w-full min-h-[48px] px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
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
          <button onClick={() => {
            const idx = ALL_STEPS.indexOf(step);
            if (idx <= 0) onBack();
            else setStep(ALL_STEPS[idx - 1]);
          }} className="text-zinc-500 hover:text-zinc-300 font-black uppercase text-[10px] tracking-wider transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="flex gap-2">
            {ALL_STEPS.map((s, i) => (
              <div key={s} className={`w-8 h-1 rounded-full transition-all ${step === s ? 'bg-[#38BDF8]' : i < ALL_STEPS.indexOf(step) ? 'bg-[#38BDF8]/40' : 'bg-white/10'}`} />
            ))}
          </div>
        </div>

        <p className="text-[#38BDF8] text-[9px] font-black uppercase tracking-[0.4em] mb-2">Create Custom Game</p>

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
                className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
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
                  className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
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
                    className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${questionCount === count ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
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
                    className={`min-w-[44px] min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${roundCount === count ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
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
                    className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${timeLimit === t ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={goToPrize}
              className="w-full min-h-[48px] px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
            >
              Next: Prize Pool
            </button>
          </div>
        )}

        {/* STEP 2: Prize Pool */}
        {step === 'prize' && (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-4xl font-[1000] italic text-white uppercase tracking-tighter">Prize Pool</h2>

            {/* Free vs Paid Toggle */}
            <div>
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Game Type</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPrizeModel('free')}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${!isPaid ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                >
                  Free Game
                </button>
                <button
                  onClick={() => setPrizeModel('player_funded')}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${isPaid ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                >
                  Prize Pool
                </button>
              </div>
              <p className="text-zinc-600 text-[10px] mt-1">
                {isPaid ? 'Players pay an entry fee. Winners split the prize pool.' : 'No entry fee. Players compete for XP and bragging rights.'}
              </p>
            </div>

            {isPaid && (
              <>
                {/* Entry Fee */}
                <div>
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Entry Fee (SOL)</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {CUSTOM_GAME_ENTRY_FEE_PRESETS.map((fee, i) => (
                      <button
                        key={fee}
                        onClick={() => { setEntryFeeLamports(fee); setCustomEntryFee(''); }}
                        className={`min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${!customEntryFee && entryFeeLamports === fee ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                      >
                        {CUSTOM_GAME_ENTRY_FEE_LABELS[i]}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customEntryFee}
                    onChange={(e) => handleCustomFeeChange(e.target.value)}
                    placeholder="Custom (0.01 - 10 SOL)"
                    className={`w-full min-h-[44px] px-4 py-3 bg-white/5 border rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none transition-colors ${!isCustomFeeValid ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-[#38BDF8]/40'}`}
                  />
                  {!isCustomFeeValid && <p className="text-red-400 text-[10px] mt-1">Entry fee must be between 0.01 and 10 SOL</p>}
                </div>

                {/* Max Players */}
                <div>
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Max Players</label>
                  <div className="flex gap-2 flex-wrap">
                    {CUSTOM_GAME_MAX_PLAYER_PRESETS.map((count) => (
                      <button
                        key={count}
                        onClick={() => setMaxPlayers(count)}
                        className={`min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${maxPlayers === count ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Game Duration */}
                <div>
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Game Duration</label>
                  <div className="flex gap-2 flex-wrap">
                    {CUSTOM_GAME_DURATION_PRESETS.map((d) => (
                      <button
                        key={d.minutes}
                        onClick={() => setGameDurationMinutes(d.minutes)}
                        className={`min-h-[40px] px-3 py-2 rounded-xl font-black text-[11px] uppercase transition-all active:scale-[0.98] ${gameDurationMinutes === d.minutes ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-zinc-600 text-[10px] mt-1">Players can join and play during this window</p>
                </div>

                {/* Winners */}
                <div>
                  <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block mb-2">Winner Count</label>
                  <div className="flex gap-2">
                    {([1, 3, 5] as const).map((w) => (
                      <button
                        key={w}
                        onClick={() => setMaxWinners(w)}
                        className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${maxWinners === w ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                      >
                        <span className="font-[1000] italic text-lg block">{w}</span>
                        <span className="text-[8px] font-black uppercase tracking-wider opacity-70">
                          {w === 1 ? 'Winner' : 'Winners'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {CUSTOM_GAME_WINNER_SPLIT_LABELS[maxWinners].map((label, i) => (
                      <span key={i} className="px-2 py-1 bg-[#38BDF8]/10 border border-[#38BDF8]/20 rounded text-[#38BDF8] text-[10px] font-black">
                        {i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}: {label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Prize Calculator */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-2">
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wider mb-3">Estimated Prize Breakdown</p>
                  <div className="flex justify-between text-zinc-500 text-xs">
                    <span>Entry fee</span>
                    <span>{(activeEntryFee / 1_000_000_000).toFixed(2)} SOL x {maxPlayers} players</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 text-xs font-bold">
                    <span>Total pot</span>
                    <span>{(estimatedPot / 1_000_000_000).toFixed(2)} SOL</span>
                  </div>
                  <div className="flex justify-between text-zinc-600 text-[10px]">
                    <span>Platform cut (10%)</span>
                    <span>-{(platformCut / 1_000_000_000).toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between text-zinc-600 text-[10px]">
                    <span className="pl-4">5% to revenue, 5% to you (creator)</span>
                    <span></span>
                  </div>
                  <div className="border-t border-white/5 pt-2 mt-2">
                    <div className="flex justify-between text-[#38BDF8] text-sm font-[1000] italic">
                      <span>Prize pool</span>
                      <span>{(prizePot / 1_000_000_000).toFixed(2)} SOL</span>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2">
                    {winnerAmounts.map((amt, i) => (
                      <div key={i} className="flex justify-between text-zinc-400 text-[11px]">
                        <span>{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} place ({CUSTOM_GAME_WINNER_SPLIT_LABELS[maxWinners][i]})</span>
                        <span className="text-white font-bold">{(amt / 1_000_000_000).toFixed(4)} SOL</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-zinc-700 text-[9px] mt-2">+ {TXN_FEE_LAMPORTS / 1_000_000_000} SOL platform fee per entry</p>
                </div>
              </>
            )}

            <button
              onClick={goToQuestions}
              className="w-full min-h-[48px] px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
            >
              Next: Write Questions
            </button>
          </div>
        )}

        {/* STEP 3: Question Builder */}
        {step === 'questions' && questions.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-[1000] italic text-white uppercase tracking-tighter">Question {currentQIdx + 1}</h2>
              <span className="text-[#38BDF8] text-sm font-[1000] italic">{currentQIdx + 1} / {questionCount}</span>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 flex-wrap">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQIdx(i)}
                  className={`w-6 h-6 rounded-full text-[9px] font-black transition-all ${
                    i === currentQIdx
                      ? 'bg-[#38BDF8] text-black'
                      : isQuestionValid(q)
                        ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
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
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors resize-none"
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
                        ? 'bg-[#38BDF8] text-black'
                        : 'bg-white/5 border border-white/10 text-zinc-500 hover:border-[#38BDF8]/30'
                    }`}
                  >
                    {label}
                  </button>
                  <input
                    type="text"
                    value={questions[currentQIdx].options[idx]}
                    onChange={(e) => updateQuestion(`option${idx}`, e.target.value.slice(0, CUSTOM_GAME_OPTION_TEXT_MAX))}
                    placeholder={`Option ${label}`}
                    className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
                  />
                </div>
              ))}
              <p className="text-zinc-600 text-[10px]">Tap the letter to mark the correct answer. Currently: <span className="text-[#38BDF8] font-black">{['A', 'B', 'C', 'D'][questions[currentQIdx].correctIndex]}</span></p>
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
                  className="flex-1 min-h-[44px] px-4 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-sm tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={goToReview}
                  disabled={!allQuestionsValid}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic uppercase text-sm tracking-tighter transition-all active:scale-[0.98] ${
                    allQuestionsValid ? 'bg-[#38BDF8] text-black hover:bg-[#7DD3FC]' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
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

            {/* Prize Pool Summary (paid games) */}
            {isPaid && (
              <div className="bg-[#38BDF8]/5 border border-[#38BDF8]/20 rounded-2xl p-6">
                <p className="text-[#38BDF8] text-[9px] font-black uppercase tracking-[0.3em] mb-3">Prize Pool Game</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-zinc-600 text-[8px] font-black uppercase block">Entry Fee</span>
                    <span className="text-white font-[1000] italic">{(activeEntryFee / 1_000_000_000).toFixed(2)} SOL</span>
                  </div>
                  <div>
                    <span className="text-zinc-600 text-[8px] font-black uppercase block">Max Players</span>
                    <span className="text-white font-[1000] italic">{maxPlayers}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600 text-[8px] font-black uppercase block">Duration</span>
                    <span className="text-white font-[1000] italic">{CUSTOM_GAME_DURATION_PRESETS.find(d => d.minutes === gameDurationMinutes)?.label || `${gameDurationMinutes}m`}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600 text-[8px] font-black uppercase block">Winners</span>
                    <span className="text-white font-[1000] italic">{maxWinners} ({CUSTOM_GAME_WINNER_SPLIT_LABELS[maxWinners].join('/')})</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#38BDF8]/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Est. Prize Pool</span>
                    <span className="text-[#38BDF8] font-[1000] italic">{(prizePot / 1_000_000_000).toFixed(2)} SOL</span>
                  </div>
                </div>
              </div>
            )}

            {/* Questions Preview */}
            <div className="space-y-2">
              <label className="text-zinc-500 text-[10px] font-black uppercase tracking-wider block">Questions Preview</label>
              {questions.map((q, i) => (
                <details key={i} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                  <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 hover:bg-white/[0.03] transition-colors">
                    <span className={`w-6 h-6 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 ${isQuestionValid(q) ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'bg-red-500/20 text-red-400'}`}>{i + 1}</span>
                    <span className="text-white text-sm font-bold truncate flex-1">{q.questionText || '(empty)'}</span>
                  </summary>
                  <div className="px-4 pb-3 space-y-1">
                    {q.options.map((opt, j) => (
                      <div key={j} className={`text-xs px-3 py-1.5 rounded ${j === q.correctIndex ? 'text-[#38BDF8] bg-[#38BDF8]/10' : 'text-zinc-500'}`}>
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
                <span className="text-[#38BDF8] text-lg font-[1000] italic">{creationFeeSol} SOL</span>
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
                  <p className="text-[#38BDF8] text-[10px] font-black mt-1">Game Pass: creation fee waived!</p>
                )}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className={`w-full min-h-[52px] px-6 py-4 rounded-xl font-[1000] italic uppercase text-xl tracking-tighter transition-all active:scale-[0.98] ${
                creating ? 'bg-zinc-800 text-zinc-500 cursor-wait' : 'bg-[#38BDF8] text-black hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)]'
              }`}
            >
              {creating ? 'Creating...' : `Create Game (${creationFeeSol} SOL)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateCustomGameView;
