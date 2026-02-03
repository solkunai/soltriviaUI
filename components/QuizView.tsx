import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';
import { HapticFeedback } from '../src/utils/haptics';
import { playCorrectSound, playWrongSound } from '../src/utils/sounds';
import { getQuestions, submitAnswer } from '../src/utils/api';

interface QuizViewProps {
  sessionId: string | null;
  onFinish: (score: number, points: number, totalTime: number) => void;
  onQuit: () => void;
}

const BASE_POINTS = 500;
const MAX_SPEED_BONUS = 500;
const SPEED_BONUS_DECAY_SEC = 10;
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const; // Display labels; indices 0–3 sent to API

const QuizView: React.FC<QuizViewProps> = ({ sessionId, onFinish, onQuit }) => {
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
  
  const timerRef = useRef<number | null>(null);

  // Fetch questions from Supabase when component mounts
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getQuestions(sessionId);
        
        // Transform API response to Question format
        // NOTE: correct_index is NOT sent from API for security (prevents cheating)
        // Answer validation happens server-side only
        const transformedQuestions: Question[] = response.questions.map((q: any, idx: number) => ({
          id: parseInt(q.id) || idx + 1,
          text: q.text || q.question || '',
          options: Array.isArray(q.options) ? q.options : (Array.isArray(q.answers) ? q.answers : []),
          correctAnswer: -1, // Never exposed to client - validated server-side only
        }));

        if (transformedQuestions.length === 0) {
          setError('No questions available');
          return;
        }

        setQuestions(transformedQuestions);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch questions:', err);
        setError(err.message || 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [sessionId]);

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

  const handleOptionSelect = async (optionIdx: number) => {
    if (selectedOption !== null || !sessionId || questions.length === 0) return;
    
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    setSelectedOption(optionIdx);
    
    const currentQuestion = questions[currentIdx];
    
    // Submit answer to backend for validation (ONLY source of truth)
    let correct = false;
    let pointsEarned = 0;
    let actualCorrectIndex = -1;
    
    try {
      if (!sessionId || !currentQuestion.id) {
        throw new Error('Missing session or question ID');
      }
      
      const answerResponse = await submitAnswer({
        session_id: sessionId,
        question_id: currentQuestion.id.toString(),
        question_index: currentIdx,
        selected_index: optionIdx,
        time_taken_ms: Math.floor(timeTaken * 1000),
      });
      
      correct = answerResponse.correct; // Backend returns 'correct', not 'is_correct'
      pointsEarned = answerResponse.pointsEarned || 0; // Backend returns camelCase
      actualCorrectIndex = answerResponse.correctIndex !== undefined ? answerResponse.correctIndex : -1; // Backend returns camelCase
      
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setError('Failed to submit answer. Please try again.');
      setLoading(false);
      return;
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

    // Store the correct answer for display (when user gets it wrong)
    if (!correct && actualCorrectIndex >= 0) {
      const updatedQuestions = [...questions];
      updatedQuestions[currentIdx].correctAnswer = actualCorrectIndex;
      setQuestions(updatedQuestions);
    }

    let pointsForThisQuestion = pointsEarned || 0;
    if (correct) {
      // Use points from backend if available, otherwise calculate
      if (pointsEarned === 0) {
        const speedBonus = Math.max(0, Math.floor(MAX_SPEED_BONUS * (1 - timeTaken / SPEED_BONUS_DECAY_SEC)));
        pointsForThisQuestion = BASE_POINTS + speedBonus;
      }
      
      setScore(prev => prev + 1);
      setTotalPoints(prev => prev + pointsForThisQuestion);
      setLastGainedPoints(pointsForThisQuestion);
    }

    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1);
        setSelectedOption(null);
        setIsCorrect(null);
        setLastGainedPoints(null);
        setQuestionStartTime(Date.now());
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
                if (isCorrect) {
                  stateClass = "border-[#00FFA3] bg-[#00FFA3]/10 text-[#00FFA3] shadow-[0_0_20px_rgba(0,255,163,0.1)]";
                  animationClass = "answer-correct";
                } else {
                  stateClass = "border-[#FF3131] bg-[#FF3131]/10 text-[#FF3131]";
                  animationClass = "answer-wrong";
                }
              } else if (selectedOption !== null && idx === question.correctAnswer) {
                stateClass = "border-[#00FFA3] bg-[#00FFA3]/5 text-[#00FFA3]/60";
                animationClass = "answer-correct";
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null}
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
