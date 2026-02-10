import { useState, useEffect } from 'react';

interface LoadingScreenProps {
  minDuration?: number;
  onComplete: () => void;
}

export default function LoadingScreen({ minDuration = 2000, onComplete }: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 500);
    }, minDuration);
    return () => clearTimeout(timer);
  }, [minDuration, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background: '#0a0a14' }}
    >
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.08] animate-pulse"
          style={{
            background: 'radial-gradient(circle, #3EC6B0 0%, transparent 70%)',
            top: '15%',
            left: '20%',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute w-[300px] h-[300px] rounded-full opacity-[0.08] animate-pulse"
          style={{
            background: 'radial-gradient(circle, #7E7ED6 0%, transparent 70%)',
            bottom: '20%',
            right: '15%',
            filter: 'blur(60px)',
            animationDelay: '1s',
          }}
        />
      </div>

      {/* Floating question marks */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {['15%', '35%', '55%', '75%', '90%', '5%', '48%', '82%'].map((left, i) => (
          <span
            key={i}
            className="absolute text-lg font-bold"
            style={{
              left,
              color: i % 2 === 0 ? 'rgba(62, 198, 176, 0.15)' : 'rgba(126, 126, 214, 0.15)',
              fontSize: `${14 + (i % 5) * 3}px`,
              animation: 'loadingFloatUp 3s ease-in-out infinite',
              animationDelay: `${i * 0.4}s`,
            }}
          >
            ?
          </span>
        ))}
      </div>

      {/* Logo with spinning rings */}
      <div className="relative w-40 h-40 mb-10 z-10">
        <div
          className="absolute -inset-2.5 rounded-full animate-spin"
          style={{
            border: '2px solid transparent',
            borderTopColor: '#3EC6B0',
            borderRightColor: 'rgba(62, 198, 176, 0.3)',
            animationDuration: '2s',
          }}
        />
        <div
          className="absolute -inset-1 rounded-full"
          style={{
            border: '1px solid transparent',
            borderBottomColor: '#7E7ED6',
            borderLeftColor: 'rgba(126, 126, 214, 0.3)',
            animation: 'spin 3s linear infinite reverse',
          }}
        />
        <img
          src="/sol_trivia_logo_final.png"
          alt="SOL Trivia"
          className="w-[140px] h-[140px] rounded-full object-cover absolute top-[10px] left-[10px]"
        />
      </div>

      {/* App name */}
      <div className="text-4xl font-extrabold tracking-wider mb-2 z-10">
        <span
          style={{
            background: 'linear-gradient(135deg, #3EC6B0, #5BAEC8, #7E7ED6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          SOL
        </span>{' '}
        <span className="text-white">TRIVIA</span>
      </div>

      {/* Tagline */}
      <p className="text-white/40 text-sm tracking-[4px] uppercase mb-12 z-10">
        Play. Compete. Earn.
      </p>

      {/* Bouncing dots */}
      <div className="flex gap-2 mb-4 z-10">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full"
            style={{
              background: ['#3EC6B0', '#5BAEC8', '#7E7ED6'][i],
              animation: 'loadingBounceDot 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      {/* Loading text */}
      <p className="text-white/30 text-xs tracking-widest uppercase z-10">
        Sol Trivia is loading...
      </p>

      {/* Bottom badge */}
      <div className="absolute bottom-12 z-10">
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/[0.08]">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#3EC6B0' }} />
          <span className="text-white/40 text-xs tracking-wide">Built on Solana</span>
        </div>
      </div>

      <style>{`
        @keyframes loadingFloatUp {
          0% { bottom: -30px; opacity: 0; transform: rotate(0deg); }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { bottom: 110%; opacity: 0; transform: rotate(20deg); }
        }
        @keyframes loadingBounceDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
