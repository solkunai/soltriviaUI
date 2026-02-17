import React, { useState, useEffect } from 'react';
import { getCustomGame, type CustomGameData } from '../src/utils/api';
import { CUSTOM_GAME_MAX_ATTEMPTS } from '../src/utils/constants';
import { DEFAULT_AVATAR } from '../src/utils/constants';

interface CustomGameLobbyViewProps {
  slug: string;
  walletAddress: string | null;
  onStartGame: (gameData: CustomGameData) => void;
  onBack: () => void;
  onConnectWallet: () => void;
}

const CustomGameLobbyView: React.FC<CustomGameLobbyViewProps> = ({
  slug,
  walletAddress,
  onStartGame,
  onBack,
  onConnectWallet,
}) => {
  const [gameData, setGameData] = useState<CustomGameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/game/${slug}`;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCustomGame(slug, walletAddress || undefined);
        setGameData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load game');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, walletAddress]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleShareX = () => {
    if (!gameData) return;
    const text = `Join my custom trivia game "${gameData.name}" on @SolTrivia!`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <p className="text-white text-xl font-black uppercase mb-4">Loading Game...</p>
          <div className="w-16 h-16 border-4 border-[#14F195] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // Error
  if (error || !gameData) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-[1000] italic text-white uppercase mb-2">Game Not Found</h2>
          <p className="text-zinc-400 text-sm mb-6">{error || 'This game does not exist or has been removed.'}</p>
          <button onClick={onBack} className="min-h-[44px] px-8 py-3 bg-[#14F195] text-black font-[1000] italic uppercase rounded-xl hover:bg-[#00FFA3] transition-all active:scale-[0.98]">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Expired
  if (gameData.is_expired || gameData.status === 'expired') {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-[1000] italic text-white uppercase mb-2">Game Expired</h2>
          <p className="text-zinc-400 text-sm mb-2">"{gameData.name}" has expired after 7 days.</p>
          <p className="text-zinc-600 text-xs mb-6">Custom games are available for 7 days after creation.</p>
          <button onClick={onBack} className="min-h-[44px] px-8 py-3 bg-[#14F195] text-black font-[1000] italic uppercase rounded-xl hover:bg-[#00FFA3] transition-all active:scale-[0.98]">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Banned
  if (gameData.status === 'banned') {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-[1000] italic text-red-400 uppercase mb-2">Game Removed</h2>
          <p className="text-zinc-400 text-sm mb-6">This game has been removed for violating content guidelines.</p>
          <button onClick={onBack} className="min-h-[44px] px-8 py-3 bg-[#14F195] text-black font-[1000] italic uppercase rounded-xl hover:bg-[#00FFA3] transition-all active:scale-[0.98]">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const expiresAt = new Date(gameData.expires_at);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
  const daysLeft = Math.floor(hoursLeft / 24);
  const expiryLabel = daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h left` : `${hoursLeft}h left`;

  const attemptsUsed = gameData.player_attempts ?? 0;
  const canPlay = attemptsUsed < CUSTOM_GAME_MAX_ATTEMPTS;
  const creatorShort = gameData.creator_username || `${gameData.creator_wallet.slice(0, 4)}...${gameData.creator_wallet.slice(-4)}`;

  return (
    <div className="min-h-full flex flex-col bg-[#050505] p-4 sm:p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#14F195]/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Back */}
        <button onClick={onBack} className="mb-6 text-zinc-500 hover:text-zinc-300 font-black uppercase text-[10px] tracking-wider transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>

        {/* Game Info Card */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-8 mb-6">
          <p className="text-[#14F195] text-[9px] font-black uppercase tracking-[0.4em] mb-2">Custom Game</p>
          <h1 className="text-3xl md:text-5xl font-[1000] italic text-white uppercase tracking-tighter mb-4 leading-tight">
            {gameData.name}
          </h1>

          <div className="flex flex-wrap gap-3 mb-6">
            <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-zinc-400 text-[10px] font-black uppercase tracking-wider">
              {gameData.question_count} Questions
            </span>
            <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-zinc-400 text-[10px] font-black uppercase tracking-wider">
              {gameData.round_count} {gameData.round_count === 1 ? 'Round' : 'Rounds'}
            </span>
            <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-zinc-400 text-[10px] font-black uppercase tracking-wider">
              {gameData.time_limit_seconds}s per Q
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Created by</span>
              <span className="text-white text-xs font-black italic">{creatorShort}</span>
            </div>
            <div className="text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Total Plays</span>
              <span className="text-white text-xs font-black italic">{gameData.total_plays}</span>
            </div>
            <div className="text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Expires</span>
              <span className="text-yellow-400 text-xs font-black italic">{expiryLabel}</span>
            </div>
          </div>

          {/* Share */}
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 min-h-[44px] px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-[10px] tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handleShareX}
              className="flex-1 min-h-[44px] px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-[10px] tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Share on X
            </button>
          </div>
        </div>

        {/* Play Button */}
        <div className="mb-6">
          {!walletAddress ? (
            <button
              onClick={onConnectWallet}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#14F195] text-white font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:shadow-[0_10px_40px_-10px_rgba(20,241,149,0.4)] transition-all active:scale-[0.98]"
            >
              Connect Wallet to Play
            </button>
          ) : canPlay ? (
            <button
              onClick={() => onStartGame(gameData)}
              className="w-full min-h-[56px] px-6 py-4 bg-[#14F195] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#00FFA3] shadow-[0_10px_40px_-10px_rgba(20,241,149,0.3)] transition-all active:scale-[0.98]"
            >
              Play Now
            </button>
          ) : (
            <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
              <span className="text-zinc-400 font-[1000] italic uppercase text-lg">Max Attempts Reached</span>
              {gameData.player_best_score != null && (
                <p className="text-zinc-500 text-xs font-black mt-1">Your best: {gameData.player_best_score} XP</p>
              )}
            </div>
          )}
          {walletAddress && canPlay && (
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-wider text-center mt-2">
              Attempts: {attemptsUsed} / {CUSTOM_GAME_MAX_ATTEMPTS}
            </p>
          )}
        </div>

        {/* Leaderboard */}
        {gameData.leaderboard.length > 0 && (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-[1000] italic text-white uppercase tracking-tighter mb-4">Leaderboard</h3>
            <div className="space-y-2">
              {gameData.leaderboard.map((entry, i) => {
                const isYou = walletAddress && entry.wallet_address === walletAddress;
                return (
                  <div
                    key={entry.wallet_address}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isYou ? 'bg-[#14F195]/10 border border-[#14F195]/20' : 'bg-white/[0.02] border border-white/5'}`}
                  >
                    <span className={`w-8 text-center font-[1000] italic text-sm ${i < 3 ? 'text-[#14F195]' : 'text-zinc-500'}`}>
                      #{entry.rank}
                    </span>
                    <img
                      src={entry.avatar_url || DEFAULT_AVATAR}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-white/10"
                      onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`font-black italic text-sm truncate block ${isYou ? 'text-[#14F195]' : 'text-white'}`}>
                        {entry.username}
                        {isYou && <span className="text-[#14F195] text-[9px] ml-1 uppercase">(You)</span>}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#14F195] font-[1000] italic text-sm">{entry.score.toLocaleString()}</span>
                      <span className="text-zinc-600 text-[8px] font-black uppercase block">XP</span>
                    </div>
                    {entry.is_seeker_verified && (
                      <span className="text-[8px] font-black text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded uppercase">SGT</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomGameLobbyView;
