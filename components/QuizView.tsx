import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';

interface QuizViewProps {
  onFinish: (score: number, points: number, totalTime: number) => void;
  onQuit: () => void;
}

const QUESTIONS: Question[] = [
  { id: 1, text: "What consensus mechanism does Solana use alongside Proof of Stake?", options: ["Proof of Work", "Proof of History", "Proof of Authority", "Proof of Burn"], correctAnswer: 1 },
  { id: 2, text: "Who is the co-founder and CEO of Solana Labs?", options: ["Vitalik Buterin", "Anatoly Yakovenko", "Charles Hoskinson", "Sam Bankman-Fried"], correctAnswer: 1 },
  { id: 3, text: "What is the smallest unit of SOL called?", options: ["Wei", "Satoshi", "Lamport", "Gwei"], correctAnswer: 2 },
  { id: 4, text: "What does TVL stand for in DeFi?", options: ["Total Value Locked", "Token Vault Limit", "Transfer Volume Ledger", "Trade Verification Layer"], correctAnswer: 0 },
  { id: 5, text: "Which protocol is the largest DEX on Solana?", options: ["Uniswap", "PancakeSwap", "Jupiter", "SushiSwap"], correctAnswer: 2 },
  { id: 6, text: "What is impermanent loss?", options: ["A gas fee spike", "Loss from providing liquidity when prices diverge", "A failed transaction cost", "An NFT depreciation"], correctAnswer: 1 },
  { id: 7, text: "What is the maximum supply of Bitcoin?", options: ["100 million", "21 million", "18 million", "Unlimited"], correctAnswer: 1 },
  { id: 8, text: "Who created Bitcoin?", options: ["Vitalik Buterin", "Satoshi Nakamoto", "Charlie Lee", "Nick Szabo"], correctAnswer: 1 },
  { id: 9, text: "What animal is the Dogecoin mascot?", options: ["Cat", "Shiba Inu", "Frog", "Penguin"], correctAnswer: 1 },
  { id: 10, text: "Which memecoin launched on Solana became the largest by market cap in 2024?", options: ["BONK", "WIF", "MYRO", "SAMO"], correctAnswer: 1 },
];

const BASE_POINTS = 500;
const MAX_SPEED_BONUS = 500;
const SPEED_BONUS_DECAY_SEC = 10;

const QuizView: React.FC<QuizViewProps> = ({ onFinish, onQuit }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [lastGainedPoints, setLastGainedPoints] = useState<number | null>(null);
  
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleOptionSelect = (optionIdx: number) => {
    if (selectedOption !== null) return;
    
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    setSelectedOption(optionIdx);
    
    const correct = optionIdx === QUESTIONS[currentIdx].correctAnswer;
    setIsCorrect(correct);

    let pointsForThisQuestion = 0;
    if (correct) {
      const speedBonus = Math.max(0, Math.floor(MAX_SPEED_BONUS * (1 - timeTaken / SPEED_BONUS_DECAY_SEC)));
      pointsForThisQuestion = BASE_POINTS + speedBonus;
      
      setScore(prev => prev + 1);
      setTotalPoints(prev => prev + pointsForThisQuestion);
      setLastGainedPoints(pointsForThisQuestion);
    }

    setTimeout(() => {
      if (currentIdx < QUESTIONS.length - 1) {
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

  const question = QUESTIONS[currentIdx];

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
              if (selectedOption === idx) {
                stateClass = isCorrect ? "border-[#00FFA3] bg-[#00FFA3]/10 text-[#00FFA3] shadow-[0_0_20px_rgba(0,255,163,0.1)]" : "border-[#FF3131] bg-[#FF3131]/10 text-[#FF3131]";
              } else if (selectedOption !== null && idx === question.correctAnswer) {
                stateClass = "border-[#00FFA3] bg-[#00FFA3]/5 text-[#00FFA3]/60";
              }

              return (
                <button
                  key={idx}
                  disabled={selectedOption !== null}
                  onClick={() => handleOptionSelect(idx)}
                  className={`relative p-5 md:p-7 text-left border transition-all duration-300 group flex items-center gap-5 md:gap-8 active:scale-[0.99] ${stateClass}`}
                >
                  <div className={`w-8 h-8 md:w-12 md:h-12 border flex items-center justify-center font-[1000] italic text-sm md:text-xl transition-all duration-300 flex-shrink-0 ${selectedOption === idx ? 'bg-current text-black border-transparent' : 'border-current opacity-20 group-hover:opacity-100'}`}>
                    {String.fromCharCode(65 + idx)}
                  </div>
                  <span className="text-base md:text-lg font-black italic uppercase tracking-tight flex-1 leading-tight">{option}</span>
                  
                  {selectedOption === idx && isCorrect && lastGainedPoints && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                       <span className="text-[#00FFA3] text-[10px] md:text-xs font-[1000] italic animate-bounce block">
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
             {[...Array(QUESTIONS.length)].map((_, i) => (
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
                {score}/{QUESTIONS.length}
              </span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default QuizView;
