import React, { useState, useEffect, useRef } from 'react';
import { HapticFeedback } from '../src/utils/haptics';
import { playCorrectSound, playWrongSound } from '../src/utils/sounds';
import { getCustomQuestions, submitCustomAnswer, completeCustomSession, type CustomQuestionResponse } from '../src/utils/api';

interface CustomGameQuizViewProps {
  sessionId: string;
  gameData: {
    name: string;
    questionCount: number;
    roundCount: number;
    timeLimitSeconds: number;
  };
  onFinish: (results: {
    score: number;
    correctCount: number;
    totalPoints: number;
    timeTakenMs: number;
    rank: number | null;
  }) => void;
  onQuit: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
const BASE_POINTS = 100;
const MAX_SPEED_BONUS = 900;

interface QuizQuestion {
  index: number;
  id: string;
  text: string;
  options: string[];
  correctAnswer: number; // set after server response
}

const CustomGameQuizView: React.FC<CustomGameQuizViewProps> = ({ sessionId, gameData, onFinish, onQuit }) => {
  const { timeLimitSeconds, roundCount, questionCount } = gameData;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
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
  const [questionTimeLeft, setQuestionTimeLeft] = useState(timeLimitSeconds);
  const [timedOut, setTimedOut] = useState(false);

  // Multi-round state
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(roundCount);
  const [showRoundInterstitial, setShowRoundInterstitial] = useState(false);
  const [roundQuestionOffset, setRoundQuestionOffset] = useState(0); // global offset for display

  const timerRef = useRef<number | null>(null);
  const questionTimerRef = useRef<number | null>(null);
  const timeoutFiredRef = useRef(false);

  // Fetch questions for current round
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        setError(null);
        const response: CustomQuestionResponse = await getCustomQuestions(sessionId);
        setCurrentRound(response.current_round);
        setTotalRounds(response.total_rounds);

        const transformed: QuizQuestion[] = response.questions.map((q) => ({
          index: q.index,
          id: q.id,
          text: q.question,
          options: [...q.options],
          correctAnswer: -1, // never exposed to client
        }));

        if (transformed.length === 0) {
          setError('No questions available');
          return;
        }

        setQuestions(transformed);
        setCurrentIdx(0);
        setQuestionStartTime(Date.now());
        setQuestionTimeLeft(timeLimitSeconds);
      } catch (err: any) {
        setError(err.message || 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };

    if (!showRoundInterstitial) {
      fetchQuestions();
    }
  }, [sessionId, currentRound, showRoundInterstitial]);

  // Session timer
  useEffect(() => {
    if (questions.length > 0 && !showRoundInterstitial) {
      timerRef.current = window.setInterval(() => setSessionTimer((prev) => prev + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [questions, showRoundInterstitial]);

  // Per-question countdown
  useEffect(() => {
    if (questions.length === 0 || selectedOption !== null || timedOut || showRoundInterstitial) return;
    setQuestionTimeLeft(timeLimitSeconds);
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
  }, [questions.length, currentIdx, selectedOption, timedOut, showRoundInterstitial, timeLimitSeconds]);

  // Timeout handler
  useEffect(() => {
    if (questionTimeLeft !== 0 || selectedOption !== null || timedOut || questions.length === 0) return;
    if (timeoutFiredRef.current) return;
    timeoutFiredRef.current = true;
    setTimedOut(true);

    const currentQuestion = questions[currentIdx];
    const timeTaken = Date.now() - questionStartTime;

    (async () => {
      try {
        const response = await submitCustomAnswer({
          session_id: sessionId,
          question_id: currentQuestion.id,
          question_index: roundQuestionOffset + currentIdx,
          time_taken_ms: timeTaken,
          time_expired: true,
        });

        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        HapticFeedback.error();
        playWrongSound();

        // Store correct answer for display
        const updatedQuestions = [...questions];
        updatedQuestions[currentIdx].correctAnswer = response.correctIndex;
        setQuestions(updatedQuestions);

        setTimeout(() => {
          timeoutFiredRef.current = false;
          setTimedOut(false);
          handleAdvance(response.isLastQuestionInRound, response.isLastQuestionInGame, response.totalScore, response.correctCount);
        }, 800);
      } catch (err) {
        console.error('Timeout submit failed:', err);
        timeoutFiredRef.current = false;
        setTimedOut(false);
      }
    })();
  }, [questionTimeLeft, selectedOption, timedOut, questions, currentIdx, sessionId, questionStartTime, roundQuestionOffset]);

  const handleAdvance = (isLastInRound: boolean, isLastInGame: boolean, serverScore: number, serverCorrectCount: number) => {
    if (isLastInGame) {
      // Game complete
      if (timerRef.current) clearInterval(timerRef.current);
      const totalTimeMs = sessionTimer * 1000;

      completeCustomSession({
        session_id: sessionId,
        total_score: serverScore,
        correct_count: serverCorrectCount,
        time_taken_ms: totalTimeMs,
      }).then((result) => {
        onFinish({
          score: serverCorrectCount,
          correctCount: serverCorrectCount,
          totalPoints: serverScore,
          timeTakenMs: totalTimeMs,
          rank: result.rank,
        });
      }).catch(() => {
        onFinish({
          score: serverCorrectCount,
          correctCount: serverCorrectCount,
          totalPoints: serverScore,
          timeTakenMs: totalTimeMs,
          rank: null,
        });
      });
    } else if (isLastInRound) {
      // Round complete, show interstitial
      setRoundQuestionOffset((prev) => prev + questions.length);
      setShowRoundInterstitial(true);
    } else {
      // Next question in same round
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setIsCorrect(null);
      setLastGainedPoints(null);
      setQuestionStartTime(Date.now());
      setQuestionTimeLeft(timeLimitSeconds);
    }
  };

  const handleNextRound = () => {
    setShowRoundInterstitial(false);
    setCurrentRound((prev) => prev + 1);
    setSelectedOption(null);
    setIsCorrect(null);
    setLastGainedPoints(null);
  };

  const handleOptionSelect = async (optionIdx: number) => {
    if (selectedOption !== null || questions.length === 0) return;

    const timeTaken = Date.now() - questionStartTime;
    setSelectedOption(optionIdx);
    const currentQuestion = questions[currentIdx];

    try {
      const response = await submitCustomAnswer({
        session_id: sessionId,
        question_id: currentQuestion.id,
        question_index: roundQuestionOffset + currentIdx,
        selected_index: optionIdx,
        time_taken_ms: timeTaken,
      });

      const correct = response.correct;
      const pointsEarned = response.pointsEarned || 0;
      const actualCorrectIndex = response.correctIndex;

      setIsCorrect(correct);

      // Haptic + sound
      if (correct) {
        HapticFeedback.success();
        playCorrectSound();
      } else {
        HapticFeedback.error();
        playWrongSound();
      }

      // Store correct answer for display
      if (actualCorrectIndex >= 0) {
        const updatedQuestions = [...questions];
        updatedQuestions[currentIdx].correctAnswer = actualCorrectIndex;
        setQuestions(updatedQuestions);
      }

      if (correct) {
        setScore((prev) => prev + 1);
        setTotalPoints((prev) => prev + pointsEarned);
        setLastGainedPoints(pointsEarned);
      }

      setTimeout(() => {
        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        handleAdvance(response.isLastQuestionInRound, response.isLastQuestionInGame, response.totalScore, response.correctCount);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to submit custom answer:', err);
      setError('Failed to submit answer. Please try again.');
    }
  };

  // Round interstitial
  if (showRoundInterstitial) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="text-center">
          <p className="text-[#14F195] text-[10px] font-black uppercase tracking-[0.4em] mb-4">Round Complete</p>
          <h2 className="text-5xl md:text-7xl font-[1000] italic text-white uppercase mb-4">
            Round {currentRound + 1}
          </h2>
          <p className="text-zinc-400 text-sm font-black uppercase mb-2">
            Score: {score}/{roundQuestionOffset + questions.length} &middot; {totalPoints.toLocaleString()} XP
          </p>
          <p className="text-zinc-600 text-xs font-black uppercase mb-8">
            Next: Round {currentRound + 2} of {totalRounds}
          </p>
          <button
            onClick={handleNextRound}
            className="min-h-[48px] px-10 py-4 bg-[#14F195] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#00FFA3] transition-all active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Loading
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

  // Error
  if (error || questions.length === 0) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <p className="text-red-400 text-xl font-black uppercase mb-4">{error || 'No questions available'}</p>
          <button onClick={onQuit} className="px-6 py-3 bg-[#14F195] text-black font-[1000] italic uppercase rounded-lg">Go Back</button>
        </div>
      </div>
    );
  }

  const question = questions[currentIdx];
  const showTimer = selectedOption === null && !timedOut;
  const globalIdx = roundQuestionOffset + currentIdx;

  return (
    <div className="min-h-full flex flex-col bg-[#050505] p-4 sm:p-8 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5 overflow-hidden">
        <div className="scan-line"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center mb-8 md:mb-16">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#00FFA3] text-[9px] font-black tracking-[0.4em] uppercase italic">Custom</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FFA3] animate-pulse"></div>
          </div>
          <h3 className="text-lg md:text-2xl font-[1000] italic text-white uppercase tracking-tighter leading-tight max-w-[200px] md:max-w-none truncate">
            {gameData.name}
          </h3>
          {totalRounds > 1 && (
            <span className="text-zinc-600 text-[9px] font-black uppercase tracking-wider mt-1">
              Round {currentRound + 1} / {totalRounds}
            </span>
          )}
        </div>

        <div className="flex gap-4 md:gap-12 items-center">
          <div className="text-right">
            <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-1 italic">Total_Time</span>
            <span className="text-white text-xl md:text-3xl font-[1000] italic tabular-nums leading-none">
              {Math.floor(sessionTimer / 60)}:{(sessionTimer % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <button
            onClick={onQuit}
            className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-[#FF3131]/20 hover:border-[#FF3131]/40 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest transition-all rounded-sm italic"
          >
            ABORT
          </button>
        </div>
      </div>

      {/* Question */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center">
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex justify-between items-end mb-4 px-2">
            <span className="text-[#00FFA3] text-xs font-black italic uppercase tracking-[0.2em]">
              Block {globalIdx + 1} / {questionCount}
            </span>
            {showTimer && (
              <span className={`text-sm font-[1000] italic tabular-nums ${questionTimeLeft <= 3 ? 'text-[#FF3131] animate-pulse' : 'text-[#14F195]'}`}>
                {questionTimeLeft}s
              </span>
            )}
            {timedOut && (
              <span className="text-[#FF3131] text-sm font-[1000] italic uppercase">Time&apos;s up!</span>
            )}
          </div>

          <div className="bg-[#0A0A0A] border border-white/5 p-6 sm:p-10 md:p-16 rounded-sm shadow-2xl relative overflow-hidden mb-6 md:mb-10">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#00FFA3]/30"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#00FFA3]/30"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#00FFA3]/30"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#00FFA3]/30"></div>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-[1000] italic text-white uppercase tracking-tighter leading-[0.9] md:leading-[0.85]">
              {question.text}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-1">
            {question.options.map((option, idx) => {
              let stateClass = 'border-white/5 hover:border-[#00FFA3]/20 text-zinc-400 hover:text-white bg-white/[0.02]';
              let animationClass = '';

              if (selectedOption === idx) {
                if (isCorrect === true) {
                  stateClass = 'border-[#00FFA3] bg-[#00FFA3]/10 text-[#00FFA3] shadow-[0_0_20px_rgba(0,255,163,0.1)]';
                  animationClass = 'answer-correct';
                } else if (isCorrect === false) {
                  stateClass = 'border-[#FF3131] bg-[#FF3131]/10 text-[#FF3131]';
                  animationClass = 'answer-wrong';
                } else {
                  stateClass = 'border-[#00FFA3]/40 bg-[#00FFA3]/5 text-white';
                }
              } else if (selectedOption !== null && idx === question.correctAnswer) {
                stateClass = 'border-[#00FFA3] bg-[#00FFA3]/5 text-[#00FFA3]/60';
                animationClass = 'answer-correct';
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null || timedOut}
                  onClick={() => handleOptionSelect(idx)}
                  className={`relative p-5 md:p-7 text-left border transition-all duration-300 flex items-center gap-5 md:gap-8 active:scale-[0.99] ${stateClass} ${animationClass}`}
                >
                  <div className={`w-8 h-8 md:w-12 md:h-12 border flex items-center justify-center font-[1000] italic text-sm md:text-xl transition-all duration-300 shrink-0 ${selectedOption === idx ? 'bg-current text-black border-transparent' : 'border-current opacity-20 group-hover:opacity-100'}`}>
                    {OPTION_LABELS[idx]}
                  </div>
                  <span className="text-base md:text-lg font-black italic uppercase tracking-tight flex-1 leading-tight">{option}</span>
                  {selectedOption === idx && isCorrect && lastGainedPoints && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className="text-[#00FFA3] text-[10px] md:text-xs font-[1000] italic points-popup block">+{lastGainedPoints} XP</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-12 flex flex-col md:flex-row gap-6 md:gap-0 justify-between items-center pt-8 border-t border-white/5">
        <div className="flex flex-col items-center md:items-start">
          <span className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em] mb-2 italic">GAME PROGRESS</span>
          <div className="flex gap-2">
            {[...Array(questionCount)].map((_, i) => (
              <div
                key={i}
                className={`w-4 h-1 transition-all duration-500 ${i < globalIdx ? 'bg-[#00FFA3] opacity-100' : i === globalIdx ? 'bg-[#00FFA3] animate-pulse' : 'bg-white/5'}`}
              ></div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-zinc-700 text-[8px] font-black uppercase block tracking-widest italic">TRIVIA XP</span>
            <span className="text-[#00FFA3] font-[1000] italic text-2xl leading-none tabular-nums">
              {totalPoints.toLocaleString()} <span className="text-[10px] opacity-50 tracking-normal">XP</span>
            </span>
          </div>
          <div className="h-8 w-px bg-white/10 hidden sm:block"></div>
          <div className="text-right hidden sm:block">
            <span className="text-zinc-700 text-[8px] font-black uppercase block tracking-widest italic">Accuracy</span>
            <span className="text-white font-[1000] italic text-2xl leading-none tabular-nums">
              {score}/{globalIdx + (selectedOption !== null || timedOut ? 1 : 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomGameQuizView;
