import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';
import { HapticFeedback } from '../src/utils/haptics';
import { playCorrectSound, playWrongSound } from '../src/utils/sounds';
import { getQuestions, submitAnswer, getPracticeQuestions, type PracticeQuestion } from '../src/utils/api';
import { supabase } from '../src/utils/supabase';

interface QuizViewProps {
  sessionId: string | null;
  onFinish: (score: number, points: number, totalTime: number) => void;
  onQuit: () => void;
  mode?: 'paid' | 'practice';
  practiceQuestionIds?: string[];
}

const BASE_POINTS = 500;
const MAX_SPEED_BONUS = 500;
const SPEED_BONUS_DECAY_SEC = 7; // Match per-question timer (paid mode)
const SECONDS_PER_QUESTION = 7; // Paid mode timer
const PRACTICE_SECONDS_PER_QUESTION = 12; // Practice mode: longer timer for reading
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const; // Display labels; indices 0–3 sent to API

const QuizView: React.FC<QuizViewProps> = ({ sessionId, onFinish, onQuit, mode = 'paid', practiceQuestionIds }) => {
  const isPracticeMode = mode === 'practice';
  const timePerQuestion = isPracticeMode ? PRACTICE_SECONDS_PER_QUESTION : SECONDS_PER_QUESTION;
  const speedDecaySec = isPracticeMode ? PRACTICE_SECONDS_PER_QUESTION : SPEED_BONUS_DECAY_SEC;
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

  const timerRef = useRef<number | null>(null);
  const questionTimerRef = useRef<number | null>(null);

  // Fetch questions from Supabase when component mounts
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!sessionId && !isPracticeMode) {
        // Parent may have cleared session after quiz finished; avoid error state and noisy log
        setLoading(false);
        return;
      }

      console.log('🎮 QuizView mounted with session:', isPracticeMode ? 'PRACTICE' : sessionId);

      try {
        setLoading(true);

        if (isPracticeMode) {
          // Practice mode: fetch questions with correct answers included
          if (!practiceQuestionIds || practiceQuestionIds.length === 0) {
            setError('No practice questions available');
            return;
          }

          const response = await getPracticeQuestions(practiceQuestionIds);
          console.log('📚 Practice questions fetched:', response.questions.length, 'questions');

          const transformedQuestions: Question[] = response.questions.map((q: PracticeQuestion) => ({
            id: String(q.id),
            text: q.text || '',
            options: [...q.options],
            correctAnswer: q.correct_index, // Include correct answer for client-side scoring
          }));

          setQuestions(transformedQuestions);
          setError(null);
        } else {
          // Paid mode: fetch questions without correct answers (server-side validation)
          const response = await getQuestions(sessionId!);
          console.log('📚 Questions fetched:', response.questions.length, 'questions');

          // Transform API response to Question format; keep real id (UUID string) for submit-answer
          // NOTE: correct_index is NOT sent from API for security (prevents cheating)
          // Answer validation happens server-side only; option indices 0-3 match DB order
          const transformedQuestions: Question[] = response.questions.map((q: any, idx: number) => ({
            id: q.id != null ? String(q.id) : String(idx),
            text: q.text || q.question || '',
            options: Array.isArray(q.options) ? [...q.options] : (Array.isArray(q.answers) ? [...q.answers] : []),
            correctAnswer: -1, // Never exposed to client - validated server-side only
          }));

          if (transformedQuestions.length === 0) {
            setError('No questions available');
            return;
          }

          // For resumed sessions, the backend may have advanced current_question_index
          // beyond 0. Fetch it so we start from the right question instead of re-asking
          // already-answered questions (which causes QUESTION_INDEX_MISMATCH errors).
          const { data: sessionRow } = await supabase
            .from('game_sessions')
            .select('current_question_index')
            .eq('id', sessionId!)
            .single();

          const startIdx = sessionRow?.current_question_index || 0;
          if (startIdx >= transformedQuestions.length) {
            // All questions were already answered but session wasn't properly completed.
            // Auto-finish with 0 score so the user can start a fresh game.
            console.log('⚠️ Resumed session already answered all questions, auto-finishing');
            onFinish(0, 0, 0);
            return;
          }
          if (startIdx > 0) {
            console.log(`🔄 Resuming session at question ${startIdx + 1}/${transformedQuestions.length}`);
            setCurrentIdx(startIdx);
          }

          setQuestions(transformedQuestions);
          setError(null);
        }
      } catch (err: any) {
        console.error('Failed to fetch questions:', err);
        setError(err.message || 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [sessionId, isPracticeMode, practiceQuestionIds]);

  useEffect(() => {
    if (questions.length > 0) {
      timerRef.current = window.setInterval(() => {
        setSessionTimer(prev => prev + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [questions]);

  // Per-question countdown; on 0, submit as wrong and advance
  useEffect(() => {
    if (questions.length === 0 || selectedOption !== null || timedOut) return;
    setQuestionTimeLeft(timePerQuestion);
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
  }, [questions.length, currentIdx, selectedOption, timedOut]);

  // When questionTimeLeft hits 0, submit time_expired and advance
  const timeoutFiredRef = useRef(false);
  useEffect(() => {
    if (questionTimeLeft !== 0 || selectedOption !== null || timedOut || questions.length === 0) return;
    if (!isPracticeMode && !sessionId) return;
    if (timeoutFiredRef.current) return;
    timeoutFiredRef.current = true;
    setTimedOut(true);
    const currentQuestion = questions[currentIdx];
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    (async () => {
      try {
        // Only submit to backend in paid mode
        if (!isPracticeMode && sessionId) {
          await submitAnswer({
            session_id: sessionId,
            question_id: currentQuestion.id.toString(),
            question_index: currentIdx,
            time_taken_ms: Math.floor(timeTaken * 1000),
            time_expired: true,
          });
        }
        if (questionTimerRef.current) clearInterval(questionTimerRef.current);
        questionTimerRef.current = null;
        HapticFeedback.error();
        playWrongSound();
        setTimeout(() => {
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
        }, 800);
      } catch (err) {
        console.error('Timeout submit failed:', err);
        timeoutFiredRef.current = false;
        setTimedOut(false);
      }
    })();
  }, [questionTimeLeft, selectedOption, timedOut, sessionId, isPracticeMode, questions, currentIdx, questionStartTime, score, totalPoints, sessionTimer, onFinish]);

  const handleOptionSelect = async (optionIdx: number) => {
    if (selectedOption !== null || questions.length === 0) return;
    if (!isPracticeMode && !sessionId) return;

    const timeTaken = (Date.now() - questionStartTime) / 1000;
    setSelectedOption(optionIdx);

    const currentQuestion = questions[currentIdx];

    let correct = false;
    let pointsEarned = 0;
    let actualCorrectIndex = -1;

    if (isPracticeMode) {
      // Practice mode: client-side scoring
      actualCorrectIndex = currentQuestion.correctAnswer;
      correct = optionIdx === actualCorrectIndex;

      if (correct) {
        const speedBonus = Math.max(0, Math.floor(MAX_SPEED_BONUS * (1 - timeTaken / speedDecaySec)));
        pointsEarned = BASE_POINTS + speedBonus;
      }

      console.log('🎮 Practice mode answer:', {
        selected: optionIdx,
        correct: actualCorrectIndex,
        isCorrect: correct,
        points: pointsEarned,
      });
    } else {
      // Paid mode: Submit answer to backend for validation (ONLY source of truth)
      try {
        if (!sessionId || !currentQuestion.id) {
          throw new Error('Missing session or question ID');
        }

        // Debug logging
        console.log('📤 Submitting answer:', {
          session_id: sessionId,
          question_id: currentQuestion.id.toString(),
          question_index: currentIdx,
          selected_index: optionIdx,
        });

        const answerResponse = await submitAnswer({
          session_id: sessionId,
          question_id: currentQuestion.id.toString(),
          question_index: currentIdx,
          selected_index: optionIdx,
          time_taken_ms: Math.floor(timeTaken * 1000),
        });

        console.log('📥 Answer response:', answerResponse);

        correct = answerResponse.correct; // Backend returns 'correct', not 'is_correct'
        pointsEarned = answerResponse.pointsEarned || 0; // Backend returns camelCase
        actualCorrectIndex = answerResponse.correctIndex !== undefined ? answerResponse.correctIndex : -1; // Backend returns camelCase

      } catch (err) {
        console.error('❌ Failed to submit answer:', err);
        console.error('Session ID:', sessionId);
        console.error('Question:', currentQuestion);
        setError('Failed to submit answer. Please try again.');
        setLoading(false);
        return;
      }
    }

    setIsCorrect(correct);

    // Haptic feedback and sound effects
    if (correct) {
      HapticFeedback.success();
      playCorrectSound();
    } else {
      HapticFeedback.error();
      playWrongSound();
    }

    // ALWAYS store the correct answer for display (especially when user gets it wrong)
    if (actualCorrectIndex >= 0 && !isPracticeMode) {
      const updatedQuestions = [...questions];
      updatedQuestions[currentIdx].correctAnswer = actualCorrectIndex;
      setQuestions(updatedQuestions);
      console.log('✅ Correct answer set:', OPTION_LABELS[actualCorrectIndex], '(index:', actualCorrectIndex, ')');
    } else if (actualCorrectIndex < 0 && !isPracticeMode) {
      console.warn('⚠️ Backend did not return correctIndex');
    }

    let pointsForThisQuestion = pointsEarned || 0;
    if (correct) {
      // Use points from backend if available, otherwise calculate
      if (pointsEarned === 0 && !isPracticeMode) {
        const speedBonus = Math.max(0, Math.floor(MAX_SPEED_BONUS * (1 - timeTaken / SPEED_BONUS_DECAY_SEC)));
        pointsForThisQuestion = BASE_POINTS + speedBonus;
      }

      setScore(prev => prev + 1);
      setTotalPoints(prev => prev + pointsForThisQuestion);
      setLastGainedPoints(pointsForThisQuestion);
    }

    setTimeout(() => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      questionTimerRef.current = null;
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
        setSelectedOption(null);
        setIsCorrect(null);
        setLastGainedPoints(null);
        setQuestionStartTime(Date.now());
        setQuestionTimeLeft(timePerQuestion);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        onFinish(score + (correct ? 1 : 0), totalPoints + pointsForThisQuestion, sessionTimer);
      }
    }, 1200);
  };

  // Show loading or error state
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
      <div className="min-h-full flex items-center justify-center bg-[#050505]">
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

  return (
    <div className="min-h-full flex flex-col bg-[#050505] p-4 sm:p-8 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5 overflow-hidden">
        <div className="scan-line"></div>
      </div>

      <div className="relative z-10 flex justify-between items-center mb-8 md:mb-16">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#00FFA3] text-[9px] font-black tracking-[0.4em] uppercase italic">TRIVIA</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FFA3] animate-pulse"></div>
          </div>
          <h3 className="text-xl md:text-3xl font-[1000] italic text-white uppercase tracking-tighter">ARENA_NODE_B1</h3>
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

      <div className="relative z-10 flex-1 flex flex-col justify-center items-center">
        <div className="w-full max-w-4xl mx-auto">
          <div className="flex justify-between items-end mb-4 px-2">
            <span className="text-[#00FFA3] text-xs font-black italic uppercase tracking-[0.2em]">Block {currentIdx + 1} / 10</span>
            {showTimer && (
              <span className={`text-sm font-[1000] italic tabular-nums ${questionTimeLeft <= 2 ? 'text-[#FF3131] animate-pulse' : 'text-[#14F195]'}`}>
                {questionTimeLeft}s
              </span>
            )}
            {timedOut && (
              <span className="text-[#FF3131] text-sm font-[1000] italic uppercase">Time&apos;s up!</span>
            )}
          </div>

          <div className="bg-[#0A0A0A] border border-white/5 p-6 sm:p-10 md:p-16 rounded-sm shadow-2xl relative overflow-hidden group mb-6 md:mb-10">
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
              let stateClass = "border-white/5 hover:border-[#00FFA3]/20 text-zinc-400 hover:text-white bg-white/[0.02]";
              let animationClass = "";
              
              if (selectedOption === idx) {
                if (isCorrect === true) {
                  stateClass = "border-[#00FFA3] bg-[#00FFA3]/10 text-[#00FFA3] shadow-[0_0_20px_rgba(0,255,163,0.1)]";
                  animationClass = "answer-correct";
                } else if (isCorrect === false) {
                  stateClass = "border-[#FF3131] bg-[#FF3131]/10 text-[#FF3131]";
                  animationClass = "answer-wrong";
                } else {
                  // Pending: answer submitted, waiting for result — show neutral so we don't flash red
                  stateClass = "border-[#00FFA3]/40 bg-[#00FFA3]/5 text-white";
                  animationClass = "";
                }
              } else if (selectedOption !== null && idx === question.correctAnswer) {
                stateClass = "border-[#00FFA3] bg-[#00FFA3]/5 text-[#00FFA3]/60";
                animationClass = "answer-correct";
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null || timedOut}
                  onClick={() => handleOptionSelect(idx)}
                  className={`relative p-5 md:p-7 text-left border transition-all duration-300 group flex items-center gap-5 md:gap-8 active:scale-[0.99] ${stateClass} ${animationClass}`}
                >
                  <div className={`w-8 h-8 md:w-12 md:h-12 border flex items-center justify-center font-[1000] italic text-sm md:text-xl transition-all duration-300 flex-shrink-0 ${selectedOption === idx ? 'bg-current text-black border-transparent' : 'border-current opacity-20 group-hover:opacity-100'}`}>
                    {OPTION_LABELS[idx] ?? String.fromCharCode(65 + idx)}
                  </div>
                  <span className="text-base md:text-lg font-black italic uppercase tracking-tight flex-1 leading-tight">{option}</span>
                  
                  {selectedOption === idx && isCorrect && lastGainedPoints && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                       <span className="text-[#00FFA3] text-[10px] md:text-xs font-[1000] italic points-popup block">
                          +{lastGainedPoints} XP
                       </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-12 flex flex-col md:flex-row gap-6 md:gap-0 justify-between items-center pt-8 border-t border-white/5">
        <div className="flex flex-col items-center md:items-start">
          <span className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em] mb-2 italic">GAME PROGRESS</span>
          <div className="flex gap-2">
             {[...Array(questions.length)].map((_, i) => (
               <div 
                 key={i} 
                 className={`w-4 h-1 transition-all duration-500 ${i < currentIdx ? 'bg-[#00FFA3] opacity-100' : i === currentIdx ? 'bg-[#00FFA3] animate-pulse' : 'bg-white/5'}`}
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
           <div className="h-8 w-[1px] bg-white/10 hidden sm:block"></div>
           <div className="text-right hidden sm:block">
              <span className="text-zinc-700 text-[8px] font-black uppercase block tracking-widest italic">Accuracy</span>
              <span className="text-white font-[1000] italic text-2xl leading-none tabular-nums">
                {score}/{questions.length}
              </span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default QuizView;
