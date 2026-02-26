import React, { useState, useEffect, useRef } from 'react';
import { HapticFeedback } from '../src/utils/haptics';
import { playCorrectSound, playWrongSound } from '../src/utils/sounds';
import { getDuelQuestions, submitDuelAnswer, subscribeDuelUpdates, type DuelQuestionResponse, type SubmitDuelAnswerResponse } from '../src/utils/api';
import { DUEL_SECONDS_PER_QUESTION } from '../src/utils/constants';

interface DuelQuizViewProps {
  dbDuelId: string;
  duelId: number;
  walletAddress: string;
  opponentWallet: string;
  opponentUsername: string | null;
  opponentAvatar: string | null;
  isPlayer1: boolean;
  onFinish: (results: {
    myScore: number;
    myCorrect: number;
    opponentScore: number;
    opponentCorrect: number;
    winner: string | null;
    duelComplete: boolean;
  }) => void;
  onQuit: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

interface QuizQuestion {
  index: number;
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
}

const DuelQuizView: React.FC<DuelQuizViewProps> = ({ dbDuelId, duelId, walletAddress, opponentWallet, opponentUsername, opponentAvatar, isPlayer1, onFinish, onQuit }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [myCorrect, setMyCorrect] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentCorrect, setOpponentCorrect] = useState(0);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [lastGainedPoints, setLastGainedPoints] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(DUEL_SECONDS_PER_QUESTION);
  const [timedOut, setTimedOut] = useState(false);

  const timerRef = useRef<number | null>(null);
  const questionTimerRef = useRef<number | null>(null);
  const timeoutFiredRef = useRef(false);
  const timeoutRetryRef = useRef(0);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Fetch questions
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const response: DuelQuestionResponse = await getDuelQuestions(dbDuelId, walletAddress);
        const transformed: QuizQuestion[] = response.questions.map((q) => ({
          index: q.index,
          id: q.id,
          text: q.question,
          options: [...q.options],
          correctAnswer: -1,
        }));
        if (transformed.length === 0) { setError('No questions available'); return; }
        setQuestions(transformed);
        setQuestionStartTime(Date.now());
      } catch (err: any) {
        setError(err.message || 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    })();
  }, [dbDuelId, walletAddress]);

  // Subscribe to opponent score updates via Realtime
  useEffect(() => {
    subRef.current = subscribeDuelUpdates(dbDuelId, (duel) => {
      const oppScore = isPlayer1 ? (duel.player2_score as number ?? 0) : (duel.player1_score as number ?? 0);
      const oppCorrect = isPlayer1 ? (duel.player2_correct as number ?? 0) : (duel.player1_correct as number ?? 0);
      setOpponentScore(oppScore);
      setOpponentCorrect(oppCorrect);
    });
    return () => { subRef.current?.unsubscribe(); };
  }, [dbDuelId, isPlayer1]);

  // Session timer
  useEffect(() => {
    if (questions.length > 0) {
      timerRef.current = window.setInterval(() => setSessionTimer((prev) => prev + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [questions]);

  // Per-question countdown
  useEffect(() => {
    if (questions.length === 0 || selectedOption !== null || timedOut) return;
    setQuestionTimeLeft(DUEL_SECONDS_PER_QUESTION);
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
    return () => { if (questionTimerRef.current) clearInterval(questionTimerRef.current); questionTimerRef.current = null; };
  }, [questions.length, currentIdx, selectedOption, timedOut]);

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
        const response = await submitDuelAnswer({
          db_duel_id: dbDuelId,
          wallet_address: walletAddress,
          question_id: currentQuestion.id,
          question_index: currentIdx,
          time_taken_ms: timeTaken,
          time_expired: true,
        });

        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        HapticFeedback.error();
        playWrongSound();
        setOpponentScore(response.opponentScore);
        setOpponentCorrect(response.opponentCorrectCount);

        setTimeout(() => {
          if (!response.isLastQuestion && !response.duelComplete) {
            timeoutFiredRef.current = false;
            setTimedOut(false);
          }
          handleAdvance(response);
        }, 800);
      } catch (err) {
        console.error('Timeout submit failed:', err);
        timeoutRetryRef.current++;
        if (timeoutRetryRef.current >= 3) {
          // Gave it 3 tries, skip the question and move on
          timeoutRetryRef.current = 0;
          timeoutFiredRef.current = false;
          setTimedOut(false);
          if (currentIdx < questions.length - 1) {
            setCurrentIdx((prev) => prev + 1);
            setSelectedOption(null);
            setIsCorrect(null);
            setLastGainedPoints(null);
            setQuestionStartTime(Date.now());
            setQuestionTimeLeft(DUEL_SECONDS_PER_QUESTION);
          } else {
            // Last question, finish with current scores
            if (timerRef.current) clearInterval(timerRef.current);
            onFinish({
              myScore,
              myCorrect,
              opponentScore,
              opponentCorrect,
              winner: null,
              duelComplete: false,
            });
          }
        } else {
          // Retry — reset flags so the timeout effect fires again
          timeoutFiredRef.current = false;
          setTimedOut(false);
        }
      }
    })();
  }, [questionTimeLeft, selectedOption, timedOut, questions, currentIdx, dbDuelId, walletAddress, questionStartTime]);

  const handleAdvance = (response: SubmitDuelAnswerResponse) => {
    if (response.duelComplete || response.isLastQuestion) {
      if (timerRef.current) clearInterval(timerRef.current);
      onFinish({
        myScore: response.totalScore,
        myCorrect: response.correctCount,
        opponentScore: response.opponentScore,
        opponentCorrect: response.opponentCorrectCount,
        winner: response.winner,
        duelComplete: response.duelComplete,
      });
    } else {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setIsCorrect(null);
      setLastGainedPoints(null);
      setQuestionStartTime(Date.now());
      setQuestionTimeLeft(DUEL_SECONDS_PER_QUESTION);
    }
  };

  const handleOptionSelect = async (optionIdx: number) => {
    if (selectedOption !== null || questions.length === 0) return;

    const timeTaken = Date.now() - questionStartTime;
    setSelectedOption(optionIdx);
    const currentQuestion = questions[currentIdx];

    try {
      const response = await submitDuelAnswer({
        db_duel_id: dbDuelId,
        wallet_address: walletAddress,
        question_id: currentQuestion.id,
        question_index: currentIdx,
        selected_index: optionIdx,
        time_taken_ms: timeTaken,
      });

      const correct = response.correct;
      const pointsEarned = response.pointsEarned || 0;

      setIsCorrect(correct);
      setOpponentScore(response.opponentScore);
      setOpponentCorrect(response.opponentCorrectCount);

      if (correct) {
        HapticFeedback.success();
        playCorrectSound();
        const updatedQuestions = [...questions];
        updatedQuestions[currentIdx].correctAnswer = response.correctIndex;
        setQuestions(updatedQuestions);
        setMyCorrect((prev) => prev + 1);
        setMyScore((prev) => prev + pointsEarned);
        setLastGainedPoints(pointsEarned);
      } else {
        HapticFeedback.error();
        playWrongSound();
        // Show correct answer on wrong pick
        const updatedQuestions = [...questions];
        updatedQuestions[currentIdx].correctAnswer = response.correctIndex;
        setQuestions(updatedQuestions);
      }

      setTimeout(() => {
        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        handleAdvance(response);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to submit duel answer:', err);
      if (currentIdx >= questions.length - 1) {
        // Last question — server likely already processed, finish gracefully
        if (timerRef.current) clearInterval(timerRef.current);
        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        onFinish({
          myScore,
          myCorrect,
          opponentScore,
          opponentCorrect,
          winner: null,
          duelComplete: false,
        });
      } else {
        // Earlier questions — reset so player can tap again
        setSelectedOption(null);
        setIsCorrect(null);
      }
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <p className="text-white text-xl font-black uppercase mb-4">Loading Duel...</p>
          <div className="w-16 h-16 border-4 border-[#FF3131] border-t-transparent rounded-full animate-spin mx-auto"></div>
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
          <button onClick={onQuit} className="px-6 py-3 bg-[#FF3131] text-white font-[1000] italic uppercase rounded-lg">Go Back</button>
        </div>
      </div>
    );
  }

  const question = questions[currentIdx];
  const showTimer = selectedOption === null && !timedOut;
  const oppDisplayName = opponentUsername || `${opponentWallet.slice(0, 4)}...${opponentWallet.slice(-4)}`;

  return (
    <div className="min-h-full flex flex-col bg-[#050505] p-4 sm:p-8 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5 overflow-hidden">
        <div className="scan-line"></div>
      </div>

      {/* Header with opponent score */}
      <div className="relative z-10 flex justify-between items-center mb-8 md:mb-16">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#FF3131] text-[9px] font-black tracking-[0.4em] uppercase italic">Duel</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF3131] animate-pulse"></div>
          </div>
          <h3 className="text-lg md:text-2xl font-[1000] italic text-white uppercase tracking-tighter">
            1v1 Battle
          </h3>
        </div>

        {/* Opponent Score Overlay */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[#FF3131]/10 border border-[#FF3131]/20 rounded-xl">
          <div className="w-8 h-8 bg-[#FF3131]/30 rounded-full flex items-center justify-center text-[#FF3131] text-[10px] font-black">
            {opponentAvatar ? <img src={opponentAvatar} alt="" className="w-8 h-8 rounded-full" /> : 'VS'}
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-[8px] font-black uppercase truncate max-w-[80px]">{oppDisplayName}</p>
            <p className="text-[#FF3131] text-lg font-[1000] italic tabular-nums leading-none">{opponentScore}</p>
          </div>
        </div>

        <div className="flex gap-4 md:gap-8 items-center">
          <div className="text-right">
            <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-1 italic">Time</span>
            <span className="text-white text-xl md:text-2xl font-[1000] italic tabular-nums leading-none">
              {Math.floor(sessionTimer / 60)}:{(sessionTimer % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center">
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex justify-between items-end mb-4 px-2">
            <span className="text-[#FF3131] text-xs font-black italic uppercase tracking-[0.2em]">
              Q{currentIdx + 1} / 5
            </span>
            {showTimer && (
              <span className={`text-sm font-[1000] italic tabular-nums ${questionTimeLeft <= 3 ? 'text-[#FF3131] animate-pulse' : 'text-[#14F195]'}`}>
                {questionTimeLeft}s
              </span>
            )}
            {timedOut && <span className="text-[#FF3131] text-sm font-[1000] italic uppercase">Time&apos;s up!</span>}
          </div>

          <div className="bg-[#0A0A0A] border border-white/5 p-6 sm:p-10 md:p-16 rounded-sm shadow-2xl relative overflow-hidden mb-6 md:mb-10">
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#FF3131]/30"></div>
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#FF3131]/30"></div>
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#FF3131]/30"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#FF3131]/30"></div>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-[1000] italic text-white uppercase tracking-tight leading-[1.1] md:leading-[1.05] text-center">
              {question.text}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-1">
            {question.options.map((option, idx) => {
              let stateClass = 'border-white/5 hover:border-[#FF3131]/20 text-zinc-400 hover:text-white bg-white/[0.02]';
              let animationClass = '';

              if (selectedOption === idx) {
                if (isCorrect === true) {
                  stateClass = 'border-[#00FFA3] bg-[#00FFA3]/10 text-[#00FFA3] shadow-[0_0_20px_rgba(0,255,163,0.1)]';
                  animationClass = 'answer-correct';
                } else if (isCorrect === false) {
                  stateClass = 'border-[#FF3131] bg-[#FF3131]/10 text-[#FF3131]';
                  animationClass = 'answer-wrong';
                } else {
                  stateClass = 'border-[#FF3131]/40 bg-[#FF3131]/5 text-white';
                }
              } else if (selectedOption !== null && question.correctAnswer === idx) {
                stateClass = 'border-[#00FFA3]/40 bg-[#00FFA3]/10 text-[#00FFA3]';
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null || timedOut}
                  onClick={() => handleOptionSelect(idx)}
                  className={`relative p-5 md:p-7 text-left border transition-all duration-300 flex items-center gap-5 md:gap-8 active:scale-[0.99] ${stateClass} ${animationClass}`}
                >
                  <div className={`w-8 h-8 md:w-12 md:h-12 border flex items-center justify-center font-[1000] italic text-sm md:text-xl transition-all duration-300 shrink-0 ${selectedOption === idx ? 'bg-current text-black border-transparent' : 'border-current opacity-20'}`}>
                    {OPTION_LABELS[idx]}
                  </div>
                  <span className="text-base md:text-lg font-black italic uppercase tracking-normal flex-1 leading-normal">{option}</span>
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
          <span className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em] mb-2 italic">Progress</span>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`w-6 h-1.5 transition-all duration-500 ${i < currentIdx ? 'bg-[#FF3131] opacity-100' : i === currentIdx ? 'bg-[#FF3131] animate-pulse' : 'bg-white/5'}`}></div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-zinc-700 text-[8px] font-black uppercase block tracking-widest italic">Your Score</span>
            <span className="text-[#14F195] font-[1000] italic text-2xl leading-none tabular-nums">
              {myScore} <span className="text-[10px] opacity-50">XP</span>
            </span>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div className="text-right">
            <span className="text-zinc-700 text-[8px] font-black uppercase block tracking-widest italic">Accuracy</span>
            <span className="text-white font-[1000] italic text-2xl leading-none tabular-nums">
              {myCorrect}/{currentIdx + (selectedOption !== null || timedOut ? 1 : 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuelQuizView;
