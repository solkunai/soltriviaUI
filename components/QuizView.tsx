import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';
import { HapticFeedback } from '../src/utils/haptics';
import { playCorrectSound, playWrongSound } from '../src/utils/sounds';
import { getQuestions, submitAnswer, getPracticeQuestions, getPlayerLives, type PracticeQuestion } from '../src/utils/api';
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, getCategoryColor, categoryLabel } from '../src/utils/categoryColors';
import { useWallet } from '../src/contexts/WalletContext';
import UseALifePopup from './UseALifePopup';

const MAX_QUESTION_RETRIES_PER_GAME = 2; // per Kyle's spec + submit-answer v52

interface QuizViewProps {
  sessionId: string | null;
  onFinish: (score: number, points: number, totalTime: number) => void;
  onQuit: () => void;
  mode?: 'paid' | 'practice';
  practiceQuestionIds?: string[];
}

const BASE_POINTS = 500;
const MAX_SPEED_BONUS = 500;
const SPEED_BONUS_DECAY_SEC = 10;
const SECONDS_PER_QUESTION = 10;
const PRACTICE_SECONDS_PER_QUESTION = 12;
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

/**
 * Bold solid-color category pill , imports color map from the shared util
 * (src/utils/categoryColors.ts) so QuizView + FreePlayViewV2 stay aligned.
 * White italic uppercase Saira text on ANY pill color. Color-tinted glow.
 */
function CategoryPill({ category }: { category?: string }) {
  const color = getCategoryColor(category);
  const label = categoryLabel(category);
  return (
    <div
      className="px-6 py-2.5 rounded-full inline-flex items-center justify-center"
      style={{
        background: color,
        boxShadow: `0 0 28px ${color}66`,
      }}
    >
      <span
        className="text-white font-black italic text-xs sm:text-sm tracking-[0.18em]"
        style={{
          fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
          fontWeight: 900,
        }}
      >
        {label}
      </span>
    </div>
  );
}

const QuizView: React.FC<QuizViewProps> = ({ sessionId, onFinish, onQuit, mode = 'paid', practiceQuestionIds }) => {
  const isPracticeMode = mode === 'practice';
  const timePerQuestion = isPracticeMode ? PRACTICE_SECONDS_PER_QUESTION : SECONDS_PER_QUESTION;
  const speedDecaySec = isPracticeMode ? PRACTICE_SECONDS_PER_QUESTION : SPEED_BONUS_DECAY_SEC;

  // ── Game state (preserved verbatim from v1) ─────────────────────────────
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [lastGainedPoints, setLastGainedPoints] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(timePerQuestion);
  const [timedOut, setTimedOut] = useState(false);

  // ── LIVES mechanic state (Gate 2) ──────────────────────────────────────
  //   * livesRemaining , real count from player_lives table (fetched on mount)
  //   * livesUsedA , per-game retry budget consumed (max MAX_QUESTION_RETRIES_PER_GAME)
  //   * attemptIdx , passed to submit-answer v52 on every call; 0 = first
  //     attempt, 1 = first retry, 2 = second retry
  //   * showLifePopup , controls the USE A LIFE? modal visibility
  //   * popupShownAt , timestamp when the popup appeared, used to compute
  //     time_taken_ms on retry from a fresh 15s clock (not the original
  //     question start time)
  //   * isSubmittingRetry , disables popup buttons during the retry submit
  // Practice mode bypasses lives entirely (free play, no XP, no consumption).
  const [livesRemaining, setLivesRemaining] = useState(5);
  const [livesUsedA, setLivesUsedA] = useState(0);
  const [attemptIdx, setAttemptIdx] = useState(0);
  const [showLifePopup, setShowLifePopup] = useState(false);
  const [popupShownAt, setPopupShownAt] = useState<number | null>(null);
  const [isSubmittingRetry, setIsSubmittingRetry] = useState(false);
  const [streak] = useState(0);
  const { publicKey } = useWallet();

  const timerRef = useRef<number | null>(null);
  const questionTimerRef = useRef<number | null>(null);
  const timeoutFiredRef = useRef(false);
  const timeoutRetryRef = useRef(0);

  // ── Fetch questions ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!sessionId && !isPracticeMode) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        if (isPracticeMode) {
          if (!practiceQuestionIds || practiceQuestionIds.length === 0) {
            setError('No practice questions available');
            setLoading(false);
            return;
          }
          const response = await getPracticeQuestions(practiceQuestionIds);
          const transformedQuestions: Question[] = response.questions.map((q: PracticeQuestion) => ({
            id: q.id,
            text: q.text,
            options: q.options,
            correctAnswer: q.correct_index ?? -1,
            category: (q as unknown as { category?: string }).category ?? '',
          }));
          setQuestions(transformedQuestions);
          setLoading(false);
          return;
        }

        const response = await getQuestions(sessionId!);
        // Cast to loose shape because the API helper types Question with a
        // `correctAnswer` field that the live EF response does NOT include
        // (anti-cheat , correct answer comes back only after submit). The
        // server payload always has id/text/options + optional category.
        const transformedQuestions: Question[] = response.questions.map((q: unknown) => {
          const row = q as { id: string; text: string; options: string[]; category?: string };
          return {
            id: row.id,
            text: row.text,
            options: row.options,
            correctAnswer: -1, // unknown until submit-answer responds
            category: row.category ?? '',
          };
        });

        if (transformedQuestions.length === 0) {
          setError('No questions returned for this round');
          setLoading(false);
          return;
        }

        // Resume mid-round: skip already-answered questions if the response
        // includes an answered count. Falls back to 0 (start of quiz) when
        // the API does not surface it.
        const startIdx = ((response as unknown as { answered_count?: number }).answered_count) ?? 0;
        if (startIdx >= transformedQuestions.length) {
          // All already answered; immediately finalize via parent.
          onFinish(score, totalPoints, sessionTimer);
          return;
        }
        setQuestions(transformedQuestions);
        setCurrentIdx(startIdx);
        setQuestionStartTime(Date.now());
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch questions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load questions');
        setLoading(false);
      }
    };

    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isPracticeMode]);

  // ── Session timer (total) ──────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setSessionTimer((prev) => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Per-question countdown ─────────────────────────────────────────────
  useEffect(() => {
    if (loading || questions.length === 0 || selectedOption !== null || timedOut) return;

    questionTimerRef.current = window.setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1) {
          if (questionTimerRef.current) clearInterval(questionTimerRef.current);
          questionTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
    };
  }, [loading, questions.length, currentIdx, selectedOption, timedOut]);

  // ── Fetch real lives count on mount (paid mode only) ──────────────────
  useEffect(() => {
    if (isPracticeMode) return;
    const wallet = publicKey?.toBase58() ?? null;
    if (!wallet) return;
    let mounted = true;
    (async () => {
      try {
        const data = await getPlayerLives(wallet);
        if (mounted) setLivesRemaining(Number(data.lives_count) || 0);
      } catch (err) {
        console.warn('[QuizView] failed to fetch lives:', err);
      }
    })();
    return () => { mounted = false; };
  }, [isPracticeMode, publicKey]);

  // ── Visibility-change forfeit listener (anti-cheat per Kyle 2026-06-04).
  //     Tab switch / window minimize / app background mid-question = forfeit.
  //     Existing setTimedOut(true) flow handles the submission. Listener only
  //     fires when no answer yet picked and not already timed out. ─────────
  useEffect(() => {
    const handleVisibility = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden && selectedOption === null && !timedOut && !loading && questions.length > 0) {
        setTimedOut(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [selectedOption, timedOut, loading, questions.length]);

  // ── Timeout submission ─────────────────────────────────────────────────
  useEffect(() => {
    if (!timedOut || timeoutFiredRef.current) return;
    if (questions.length === 0 || (!isPracticeMode && !sessionId)) return;

    timeoutFiredRef.current = true;

    (async () => {
      try {
        if (!isPracticeMode && sessionId) {
          await submitAnswer({
            session_id: sessionId,
            question_id: String(questions[currentIdx].id),
            question_index: currentIdx,
            selected_index: 0,
            time_taken_ms: timePerQuestion * 1000,
            time_expired: true,
          });
        }

        timeoutFiredRef.current = false;
        timeoutRetryRef.current = 0;

        setTimeout(() => {
          setTimedOut(false);
          if (currentIdx < questions.length - 1) {
            setCurrentIdx((prev) => prev + 1);
            setSelectedOption(null);
            setIsCorrect(null);
            setLastGainedPoints(null);
            setQuestionStartTime(Date.now());
            setQuestionTimeLeft(timePerQuestion);
          } else {
            if (timerRef.current) clearInterval(timerRef.current);
            onFinish(score, totalPoints, sessionTimer);
          }
        }, 800);
      } catch (err) {
        console.error('Timeout submit failed:', err);
        timeoutRetryRef.current++;
        if (timeoutRetryRef.current >= 3) {
          timeoutRetryRef.current = 0;
          timeoutFiredRef.current = false;
          setTimedOut(false);
          if (currentIdx < questions.length - 1) {
            setCurrentIdx((prev) => prev + 1);
            setSelectedOption(null);
            setIsCorrect(null);
            setLastGainedPoints(null);
            setQuestionStartTime(Date.now());
            setQuestionTimeLeft(timePerQuestion);
          } else {
            if (timerRef.current) clearInterval(timerRef.current);
            onFinish(score, totalPoints, sessionTimer);
          }
        } else {
          timeoutFiredRef.current = false;
          setTimedOut(false);
        }
      }
    })();
  }, [questionTimeLeft, selectedOption, timedOut, sessionId, isPracticeMode, questions, currentIdx, questionStartTime, score, totalPoints, sessionTimer, onFinish, timePerQuestion]);

  /**
   * Submit the picked answer to the server (paid mode) or score client-side
   * (practice mode). On WRONG in paid mode with retry budget + lives, shows
   * the USE A LIFE? popup instead of advancing to the next question.
   *
   * On retry, time_taken_ms is measured from when the popup was shown
   * (fresh 15s clock per Kyle's spec), not from the original question start.
   * The retry submission passes attempt_idx > 0 so the v52 EF takes the
   * RETRY BRANCH (validates budget, updates the existing answer row in
   * place, consumes a life, returns retryUsed + livesRemaining +
   * questionAttemptsUsed).
   */
  const handleOptionSelect = async (optionIdx: number) => {
    if (selectedOption !== null || questions.length === 0) return;
    if (!isPracticeMode && !sessionId) return;
    if (showLifePopup) return; // ignore stray taps while popup is open

    // Time source: retry uses fresh popup-shown clock; first try uses
    // the original question start.
    const refStart = attemptIdx > 0 && popupShownAt != null ? popupShownAt : questionStartTime;
    const timeTaken = (Date.now() - refStart) / 1000;
    setSelectedOption(optionIdx);

    const currentQuestion = questions[currentIdx];

    let correct = false;
    let pointsEarned = 0;
    let actualCorrectIndex = -1;
    let serverLivesRemaining: number | null = null;
    let serverQAttemptsUsed: number | null = null;

    if (isPracticeMode) {
      actualCorrectIndex = currentQuestion.correctAnswer;
      correct = optionIdx === actualCorrectIndex;
      if (correct) {
        const speedBonus = Math.max(0, Math.floor(MAX_SPEED_BONUS * (1 - timeTaken / speedDecaySec)));
        pointsEarned = BASE_POINTS + speedBonus;
      }
    } else {
      try {
        if (!sessionId || !currentQuestion.id) throw new Error('Missing session or question ID');
        const answerResponse = await submitAnswer({
          session_id: sessionId,
          question_id: currentQuestion.id.toString(),
          question_index: currentIdx,
          selected_index: optionIdx,
          time_taken_ms: Math.floor(timeTaken * 1000),
          ...(attemptIdx > 0 ? { attempt_idx: attemptIdx } : {}),
        });
        correct = answerResponse.correct;
        pointsEarned = answerResponse.pointsEarned || 0;
        actualCorrectIndex = answerResponse.correctIndex !== undefined ? answerResponse.correctIndex : -1;
        if (typeof answerResponse.livesRemaining === 'number') serverLivesRemaining = answerResponse.livesRemaining;
        if (typeof answerResponse.questionAttemptsUsed === 'number') serverQAttemptsUsed = answerResponse.questionAttemptsUsed;
      } catch (err) {
        console.error('Failed to submit answer:', err);
        if (currentIdx >= questions.length - 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (questionTimerRef.current) clearInterval(questionTimerRef.current);
          onFinish(score, totalPoints, sessionTimer);
        } else {
          setSelectedOption(null);
          setIsCorrect(null);
        }
        return;
      }
    }

    setIsCorrect(correct);

    if (correct) {
      HapticFeedback.success();
      playCorrectSound();
    } else {
      HapticFeedback.error();
      playWrongSound();
    }

    // Reveal the correct answer (especially when user gets it wrong)
    if (actualCorrectIndex >= 0 && !isPracticeMode) {
      const updatedQuestions = [...questions];
      updatedQuestions[currentIdx].correctAnswer = actualCorrectIndex;
      setQuestions(updatedQuestions);
    }

    let pointsForThisQuestion = pointsEarned || 0;
    if (correct) {
      if (pointsEarned === 0 && !isPracticeMode) {
        const speedBonus = Math.max(0, Math.floor(MAX_SPEED_BONUS * (1 - timeTaken / SPEED_BONUS_DECAY_SEC)));
        pointsForThisQuestion = BASE_POINTS + speedBonus;
      }
      // On a successful retry the original wrong answer contributed 0 to
      // score/correctCount; the server already adjusted server-side.
      // Client increments locally to stay in sync until next mount.
      setScore((prev) => prev + 1);
      setTotalPoints((prev) => prev + pointsForThisQuestion);
      setLastGainedPoints(pointsForThisQuestion);
    }

    // ── RETRY BRANCH , wrong + budget + paid mode = show USE A LIFE? popup
    // instead of advancing. ─────────────────────────────────────────────
    const canOfferRetry =
      !correct &&
      !isPracticeMode &&
      livesUsedA < MAX_QUESTION_RETRIES_PER_GAME &&
      livesRemaining >= 1;

    if (canOfferRetry) {
      // Freeze the question timer so the player isn't penalized while
      // deciding. The USE A LIFE? popup has its own 5s countdown.
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
        questionTimerRef.current = null;
      }
      setShowLifePopup(true);
      return; // do NOT schedule the advance
    }

    setTimeout(() => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
      if (currentIdx < questions.length - 1) {
        setCurrentIdx((prev) => prev + 1);
        setSelectedOption(null);
        setIsCorrect(null);
        setLastGainedPoints(null);
        setQuestionStartTime(Date.now());
        setQuestionTimeLeft(timePerQuestion);
        setAttemptIdx(0); // fresh question = fresh attempt clock
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        onFinish(score + (correct ? 1 : 0), totalPoints + pointsForThisQuestion, sessionTimer);
      }
    }, 1200);

    // If this WAS a retry submission, sync local lives count from server
    // truth in the response. Suppresses drift if the user already had
    // lives debited by another tab / a previous retry on this game.
    if (serverLivesRemaining != null) setLivesRemaining(serverLivesRemaining);
    if (serverQAttemptsUsed != null) setLivesUsedA(serverQAttemptsUsed);
  };

  /**
   * USE LIFE button on the USE A LIFE? popup. Optimistically decrement
   * lives + bump attempt index so the next submitAnswer call carries
   * attempt_idx, then re-arm the quiz UI for the player to pick again
   * with a fresh 15-second countdown.
   */
  const handleUseLife = () => {
    if (isSubmittingRetry) return;
    setIsSubmittingRetry(true);
    // Optimistic local update , the server will confirm on the retry submit.
    setLivesUsedA((u) => u + 1);
    setLivesRemaining((r) => Math.max(0, r - 1));
    setAttemptIdx((i) => i + 1);
    // Re-arm the question UI for a fresh pick.
    setSelectedOption(null);
    setIsCorrect(null);
    setLastGainedPoints(null);
    setQuestionTimeLeft(timePerQuestion);
    setPopupShownAt(Date.now()); // anchor the fresh time-bonus clock here
    setShowLifePopup(false);
    setIsSubmittingRetry(false);
  };

  /**
   * SKIP button (or 5s countdown expired) on the popup. Fall through to
   * the existing wrong-answer advance flow.
   */
  const handleSkipLife = () => {
    setShowLifePopup(false);
    setPopupShownAt(null);
    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx((prev) => prev + 1);
        setSelectedOption(null);
        setIsCorrect(null);
        setLastGainedPoints(null);
        setQuestionStartTime(Date.now());
        setQuestionTimeLeft(timePerQuestion);
        setAttemptIdx(0);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        onFinish(score, totalPoints, sessionTimer);
      }
    }, 600);
  };

  // ── Loading / Error states ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <p className="text-white text-xl font-black uppercase mb-4">Loading Questions...</p>
          <div className="w-16 h-16 border-4 border-[#14F195] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="text-center">
          <p className="text-red-400 text-xl font-black uppercase mb-4">{error || 'No questions available'}</p>
          <button
            onClick={onQuit}
            className="px-6 py-3 bg-[#14F195] text-black font-[1000] italic uppercase rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentIdx];
  const showTimer = selectedOption === null && !timedOut;
  const xpIfCorrect = Math.max(BASE_POINTS, Math.floor(BASE_POINTS + MAX_SPEED_BONUS * Math.max(0, 1 - (timePerQuestion - questionTimeLeft) / speedDecaySec)));
  const accentColor = CATEGORY_COLORS[(question.category ?? '').toLowerCase()] ?? DEFAULT_CATEGORY_COLOR;

  return (
    <div className="min-h-full flex flex-col bg-[#050505] text-white">
      {/* Outer cap so the chrome + content don't stretch on 4K. ~1280px max,
          centered. Inner sections still own their own padding. */}
      <div className="w-full max-w-7xl mx-auto flex flex-col flex-1">

      {/* ── Top chrome: back ‹  ·  category pill (centered)  ·  X close ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-5 sm:pt-8">
        <button
          onClick={onQuit}
          aria-label="Back"
          className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
        >
          <span className="text-2xl font-light leading-none translate-y-[-1px]">‹</span>
        </button>
        <div className="min-w-0 px-2">
          <CategoryPill category={question.category} />
        </div>
        <button
          onClick={onQuit}
          aria-label="Close"
          className="w-10 h-10 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
        >
          <span className="text-xl font-light leading-none">×</span>
        </button>
      </div>

      {/* ── Q-count strip + progress bar ── */}
      <div className="px-4 sm:px-6 mt-6 sm:mt-7">
        <div className="flex justify-between items-baseline mb-2 gap-2">
          <span
            className="text-zinc-500 font-black italic uppercase tracking-[0.24em] text-[10px] sm:text-[11px] whitespace-nowrap"
            style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
          >
            QUESTION <span className="text-white">{(currentIdx + 1).toString().padStart(2, '0')}</span> / 10
          </span>
          {showTimer ? (
            <div className="flex items-baseline gap-2 tabular-nums whitespace-nowrap">
              <span
                className={`font-black italic tracking-tight text-base sm:text-lg ${questionTimeLeft <= 3 ? 'text-[#FF3131]' : 'text-[#14F195]'}`}
                style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
              >
                {questionTimeLeft.toString().padStart(2, '0')}s
              </span>
              <span className="text-zinc-500 text-[10px] sm:text-[11px] font-black italic tracking-widest">
                +{totalPoints.toLocaleString()} XP
              </span>
            </div>
          ) : (
            <span className="text-zinc-500 text-[10px] sm:text-[11px] font-black italic tracking-widest whitespace-nowrap">
              {timedOut ? "TIME'S UP" : 'SUBMITTED'}
            </span>
          )}
        </div>
        {/* 10-segment progress bar */}
        <div className="flex gap-[3px]">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-[3px] rounded-sm transition-colors duration-300 ${
                i < currentIdx
                  ? 'bg-[#14F195]'
                  : i === currentIdx
                  ? 'bg-[#14F195]/60'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/*
        Question hero + answer grid.
        Mobile: column , question above, answers below.
        Desktop (md+): row , question LEFT, answers RIGHT (matches Kyle's
        2026-06-03 10:21pm desktop screenshot, which shows Q on the left half
        and the 2x2 answer grid on the right half).
      */}
      <div className="flex-1 flex flex-col md:flex-row md:items-center md:gap-10 lg:gap-16 px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex gap-4 sm:gap-5 mb-6 md:mb-0 md:flex-1">
          <div className="w-[3px] bg-[#14F195] self-stretch rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <div
              className="text-[#14F195] font-black italic uppercase tracking-[0.24em] text-[10px] sm:text-xs mb-2"
              style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
            >
              Q.{(currentIdx + 1).toString().padStart(2, '0')}
            </div>
            <h2
              className="text-white font-black italic leading-[1.15] text-[22px] sm:text-3xl md:text-[34px] lg:text-[40px] break-words"
              style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif', fontWeight: 900 }}
            >
              {question.text}
            </h2>
          </div>
        </div>

        {/* ── Answer cards: 4 stacked on mobile, 2x2 on desktop ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 md:flex-1">
          {question.options.map((option, idx) => {
            const isPicked = selectedOption === idx;
            const isReveal = selectedOption !== null;
            const isCorrectAns = isReveal && question.correctAnswer === idx;
            const isPickedCorrect = isPicked && isCorrect === true;
            const isPickedWrong = isPicked && isCorrect === false;
            const isPickedPending = isPicked && isCorrect === null;

            let stateClass = 'border-white/10 bg-white/[0.02] text-zinc-300 hover:border-white/30 hover:bg-white/[0.04]';
            let badgeClass = 'text-zinc-500';
            let animationClass = '';

            if (isPickedCorrect) {
              stateClass = 'border-[#14F195] bg-[#14F195]/10 text-[#14F195]';
              badgeClass = 'text-[#14F195]';
              animationClass = 'answer-correct';
            } else if (isPickedWrong) {
              stateClass = 'border-[#FF3131] bg-[#FF3131]/10 text-[#FF3131]';
              badgeClass = 'text-[#FF3131]';
              animationClass = 'answer-wrong';
            } else if (isPickedPending) {
              // Pre-reveal picked state. Cyan on mobile (md:hidden split), green on desktop.
              stateClass = 'border-[#38BDF8] bg-[#38BDF8]/10 text-white md:border-[#14F195] md:bg-[#14F195]/10 md:text-[#14F195]';
              badgeClass = 'text-[#38BDF8] md:text-[#14F195]';
            } else if (isReveal && isCorrectAns) {
              // Show the correct answer when user picked wrong
              stateClass = 'border-[#14F195]/60 bg-[#14F195]/5 text-[#14F195]';
              badgeClass = 'text-[#14F195]';
            }

            return (
              <button
                key={idx}
                disabled={selectedOption !== null || timedOut}
                onClick={() => handleOptionSelect(idx)}
                className={`relative px-4 py-4 sm:px-5 sm:py-5 border rounded-2xl transition-all duration-200 flex items-center gap-4 text-left active:scale-[0.99] disabled:cursor-not-allowed ${stateClass} ${animationClass}`}
              >
                <span
                  className={`flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 font-black italic text-2xl sm:text-3xl flex items-center justify-center transition-colors ${badgeClass}`}
                  style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif', fontWeight: 900 }}
                >
                  {OPTION_LABELS[idx] ?? String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 text-sm sm:text-base md:text-base font-medium leading-tight text-current">
                  {option}
                </span>
                {isPickedCorrect && lastGainedPoints && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#14F195] text-[10px] sm:text-xs font-[1000] italic tracking-wide pointer-events-none points-popup">
                    +{lastGainedPoints} XP
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bottom strip: hearts + N/5 LIVES + STREAK + XP IF CORRECT ── */}
      <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-3 sm:pt-4 border-t border-white/[0.04] flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex gap-1 sm:gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={`text-[15px] sm:text-xl leading-none transition-colors ${
                  i < livesRemaining ? 'text-[#FF3131]' : 'text-[#27272a]'
                }`}
                aria-hidden
              >
                ♥
              </span>
            ))}
          </div>
          <span
            className="text-zinc-500 font-black italic uppercase tracking-[0.18em] sm:tracking-[0.22em] text-[9px] sm:text-[11px] whitespace-nowrap"
            style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
          >
            <span className="text-zinc-300">{livesRemaining}/5</span> Lives
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <span
            className="text-[#FFD700] font-black italic uppercase tracking-[0.18em] sm:tracking-[0.22em] text-[9px] sm:text-[11px] flex items-baseline gap-1 whitespace-nowrap"
            style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
          >
            STREAK x{streak} <span className="text-xs sm:text-base">🔥</span>
          </span>
          <span
            className="hidden md:inline font-black italic uppercase tracking-[0.22em] text-[11px] whitespace-nowrap"
            style={{
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              color: accentColor,
            }}
          >
            +{xpIfCorrect} XP IF CORRECT
          </span>
        </div>
      </div>

      </div>

      {/* USE A LIFE? modal , v2.1 LIVES retry mechanic. Renders above the
          quiz UI on a wrong answer when budget + lives are both available. */}
      {showLifePopup && !isPracticeMode && (
        <UseALifePopup
          livesRemaining={livesRemaining}
          livesUsedA={livesUsedA}
          disabled={isSubmittingRetry}
          onUse={handleUseLife}
          onSkip={handleSkipLife}
        />
      )}
    </div>
  );
};

export default QuizView;
