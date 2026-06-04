import React, { useState, useEffect, useRef } from 'react';
import { getDuel, subscribeDuelUpdates, type DuelInfo } from '../src/utils/api';
import { toPng } from 'html-to-image';
import DuelShareCard from './DuelShareCard';
import { pickTweet, xIntentUrl } from '../src/utils/tweetVariants';

interface DuelResultsViewProps {
  duelId: number;
  dbDuelId: string;
  myWallet: string;
  myScore: number;
  myCorrect: number;
  opponentWallet: string;
  opponentUsername: string | null;
  opponentAvatar: string | null;
  opponentScore: number;
  opponentCorrect: number;
  winnerWallet: string | null;
  entryFee: number;
  totalPot: number;
  duelComplete: boolean;
  isPlayer1: boolean;
  /** v2.1 SPL: when set, the duel was a token wager. Share card renders the
   *  amount + symbol instead of "SOL". Falls back to SOL formatting when null. */
  tokenSymbol?: string | null;
  tokenDecimals?: number | null;
  onClaimPrize: () => Promise<void>;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

const DuelResultsView: React.FC<DuelResultsViewProps> = ({
  duelId, dbDuelId, myWallet, myScore, myCorrect,
  opponentWallet, opponentUsername, opponentAvatar,
  opponentScore, opponentCorrect, winnerWallet: initialWinner,
  entryFee, totalPot: initialPot, duelComplete: initialComplete,
  isPlayer1, tokenSymbol, tokenDecimals, onClaimPrize, onPlayAgain, onBackToLobby,
}) => {
  const [winner, setWinner] = useState<string | null>(initialWinner);
  const [resolved, setResolved] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [oppScore, setOppScore] = useState(opponentScore);
  const [oppCorrect, setOppCorrect] = useState(opponentCorrect);
  const [waitingForOpponent, setWaitingForOpponent] = useState(!initialComplete);
  const [sharing, setSharing] = useState(false);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);
  const pollRef = useRef<number | null>(null);
  /** Off-screen DuelShareCard DOM node , target for html-to-image capture. */
  const shareCardRef = useRef<HTMLDivElement>(null);

  const isWinner = winner === myWallet;
  const isDraw = winner === null && !waitingForOpponent;
  const totalPot = initialPot || entryFee * 2;
  const houseCut = Math.floor(totalPot * 0.1);
  const winnerPrize = totalPot - houseCut;
  const oppDisplayName = opponentUsername || `${opponentWallet.slice(0, 4)}...${opponentWallet.slice(-4)}`;

  // Subscribe to duel updates for resolution
  useEffect(() => {
    subRef.current = subscribeDuelUpdates(dbDuelId, (duel) => {
      if (duel.status === 'resolved') setResolved(true);
      if (duel.status === 'completed' || duel.status === 'resolved') {
        setWaitingForOpponent(false);
        if (duel.winner_wallet) setWinner(duel.winner_wallet as string);
        // Read the OTHER player's data as opponent
        const oppScoreKey = isPlayer1 ? 'player2_score' : 'player1_score';
        const oppCorrectKey = isPlayer1 ? 'player2_correct' : 'player1_correct';
        if (duel[oppScoreKey] != null) setOppScore(duel[oppScoreKey] as number);
        if (duel[oppCorrectKey] != null) setOppCorrect(duel[oppCorrectKey] as number);
      }
    });
    return () => { subRef.current?.unsubscribe(); };
  }, [dbDuelId, isPlayer1]);

  // Poll for resolution status
  useEffect(() => {
    if (resolved) return;
    const poll = async () => {
      try {
        const duel = await getDuel({ duel_id: duelId, wallet_address: myWallet });
        if (duel.status === 'resolved') { setResolved(true); if (pollRef.current) clearInterval(pollRef.current); }
        if (duel.status === 'completed' || duel.status === 'resolved') {
          setWaitingForOpponent(false);
          if (duel.winner_wallet) setWinner(duel.winner_wallet);
          // Read the OTHER player's data as opponent
          const opp = isPlayer1 ? duel.player2 : duel.player1;
          if (opp) {
            setOppScore(opp.score);
            setOppCorrect(opp.correct);
          }
        }
      } catch {}
    };
    pollRef.current = window.setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [duelId, myWallet, resolved, isPlayer1]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await onClaimPrize();
    } catch (err: any) {
      console.error('Claim failed:', err);
    } finally {
      setClaiming(false);
    }
  };

  // ── Share card formatting ──────────────────────────────────────────
  //
  // SPL duels pass tokenSymbol + tokenDecimals. Native SOL duels leave both
  // undefined and we fall back to 9-decimal SOL formatting. Prize amount is
  // 90% of pot (10% house cut already baked into winnerPrize above).
  const _decimals = tokenDecimals ?? 9;
  const _symbol = tokenSymbol ?? 'SOL';
  const _fmt = (raw: number) => {
    const v = raw / 10 ** _decimals;
    // SOL keeps 4 decimals (legacy); SPL gets 2 trimmed decimals so memecoins
    // render as "1,000 NERD" not "1000.0000000 NERD".
    const dp = _symbol === 'SOL' ? 4 : 2;
    return v.toLocaleString(undefined, { maximumFractionDigits: dp });
  };
  const prizeLabel = `${_fmt(winnerPrize)} ${_symbol}`;
  const wagerLabel = `${_fmt(entryFee)} ${_symbol} each`;

  // ── Share / save handlers ──────────────────────────────────────────
  //
  // Capture the off-screen DuelShareCard to a PNG blob via html-to-image,
  // then attach to the share intent. Web Share API path attaches the image
  // file (Twitter mobile + iOS Safari pick it up). Desktop path downloads
  // the PNG locally + opens the X intent URL so the user can attach manually.
  const captureCard = async (): Promise<Blob | null> => {
    if (!shareCardRef.current) return null;
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#08080a',
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (err) {
      console.error('Share card capture failed:', err);
      return null;
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShareX = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const tweet = pickTweet(isWinner ? 'duel_win' : 'duel_loss', {
        wager: wagerLabel.replace(' each', ''),
        prize: prizeLabel,
        score: myScore,
        correct: `${myCorrect}/5`,
        opponent: oppDisplayName,
      });
      const blob = await captureCard();
      if (blob && typeof navigator.share === 'function') {
        const file = new File([blob], `sol-trivia-duel-${duelId}.png`, { type: 'image/png' });
        const navAny = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
        if (!navAny.canShare || navAny.canShare({ files: [file] })) {
          try {
            await navigator.share({ text: tweet, files: [file] });
            return;
          } catch {
            // user dismissed the sheet, fall through to download + intent fallback
          }
        }
      }
      // Fallback: download the PNG, pop X intent URL so user attaches manually.
      if (blob) downloadBlob(blob, `sol-trivia-duel-${duelId}.png`);
      window.open(xIntentUrl(tweet), '_blank');
    } finally {
      setSharing(false);
    }
  };

  const handleSaveImage = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await captureCard();
      if (blob) downloadBlob(blob, `sol-trivia-duel-${duelId}.png`);
    } finally {
      setSharing(false);
    }
  };

  // Waiting for opponent to finish
  if (waitingForOpponent) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 border-4 border-[#FF3131] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-[1000] italic text-white uppercase tracking-tighter mb-2">Waiting for Opponent</h2>
          <p className="text-zinc-500 text-sm">Your score: <span className="text-[#14F195] font-bold">{myScore} XP</span> ({myCorrect}/5 correct)</p>
          <p className="text-zinc-600 text-xs mt-2">Opponent is still playing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
      <div className="max-w-lg w-full">
        {/* Winner Announcement */}
        <div className="text-center mb-8">
          <p className="text-[#FF3131] text-[10px] font-black uppercase tracking-[0.4em] mb-3">Duel Complete</p>
          {isWinner ? (
            <>
              <h1 className="text-5xl md:text-7xl font-[1000] italic text-[#14F195] uppercase tracking-tighter mb-2">Victory!</h1>
              <p className="text-zinc-400 text-sm">You won the duel!</p>
            </>
          ) : isDraw ? (
            <>
              <h1 className="text-5xl md:text-7xl font-[1000] italic text-yellow-400 uppercase tracking-tighter mb-2">Draw!</h1>
              <p className="text-zinc-400 text-sm">It&apos;s a tie — tiebreaker by speed</p>
            </>
          ) : (
            <>
              <h1 className="text-5xl md:text-7xl font-[1000] italic text-[#FF3131] uppercase tracking-tighter mb-2">Defeat</h1>
              <p className="text-zinc-400 text-sm">Better luck next time!</p>
            </>
          )}
        </div>

        {/* Score Comparison */}
        <div className="grid grid-cols-3 gap-4 mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-xl">
          {/* You */}
          <div className="text-center">
            <p className="text-zinc-500 text-[9px] font-black uppercase mb-2">You</p>
            <p className={`text-3xl font-[1000] italic tabular-nums ${isWinner ? 'text-[#14F195]' : 'text-white'}`}>{myScore}</p>
            <p className="text-zinc-500 text-xs mt-1">{myCorrect}/5</p>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 bg-[#FF3131]/20 rounded-full flex items-center justify-center">
              <span className="text-[#FF3131] text-sm font-[1000] italic">VS</span>
            </div>
          </div>

          {/* Opponent */}
          <div className="text-center">
            <p className="text-zinc-500 text-[9px] font-black uppercase mb-2 truncate">{oppDisplayName}</p>
            <p className={`text-3xl font-[1000] italic tabular-nums ${!isWinner && winner ? 'text-[#14F195]' : 'text-white'}`}>{oppScore}</p>
            <p className="text-zinc-500 text-xs mt-1">{oppCorrect}/5</p>
          </div>
        </div>

        {/* Prize Info */}
        <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-zinc-600 text-[9px] font-black uppercase">Total Pot</p>
              <p className="text-white font-bold text-sm">{(totalPot / 1_000_000_000).toFixed(4)} SOL</p>
            </div>
            <div>
              <p className="text-zinc-600 text-[9px] font-black uppercase">House Cut (10%)</p>
              <p className="text-zinc-400 font-bold text-sm">{(houseCut / 1_000_000_000).toFixed(4)} SOL</p>
            </div>
            <div>
              <p className="text-zinc-600 text-[9px] font-black uppercase">Winner Prize</p>
              <p className="text-[#14F195] font-bold text-sm">{(winnerPrize / 1_000_000_000).toFixed(4)} SOL</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isWinner && (
            <button
              onClick={handleClaim}
              disabled={claiming || !resolved}
              className="w-full px-6 py-4 bg-[#14F195] text-black font-[1000] italic uppercase text-lg tracking-tight rounded-xl hover:bg-[#00FFA3] disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {claiming ? 'Claiming...' : !resolved ? 'Resolving on-chain...' : 'Claim Prize'}
            </button>
          )}

          <div className="flex gap-3">
            <button onClick={onPlayAgain} className="flex-1 px-4 py-3 bg-[#FF3131] text-white font-black uppercase text-xs rounded-lg hover:bg-[#FF3131]/80 transition-all active:scale-[0.98]">
              Play Again
            </button>
            <button
              onClick={handleShareX}
              disabled={sharing}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharing ? 'Capturing…' : 'Share on X'}
            </button>
            <button
              onClick={handleSaveImage}
              disabled={sharing}
              className="px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save stats card as PNG"
            >
              Save
            </button>
            <button onClick={onBackToLobby} className="px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-xs rounded-lg transition-all">
              Lobby
            </button>
          </div>

          {/*
            Off-screen DuelShareCard , render target for html-to-image. Lives
            at fixed coordinates well outside the viewport so it does not
            interfere with layout or get scrolled into view. captureCard()
            screenshots this DOM node when the user hits Share / Save.
          */}
          <div
            aria-hidden
            style={{
              position: 'fixed',
              left: -10000,
              top: 0,
              width: 480,
              height: 600,
              pointerEvents: 'none',
              opacity: 0,
            }}
          >
            <DuelShareCard
              ref={shareCardRef}
              won={isWinner}
              prizeLabel={prizeLabel}
              wagerLabel={wagerLabel}
              myScore={myScore}
              opponentScore={oppScore}
              opponentName={oppDisplayName}
              myCorrect={myCorrect}
              opponentCorrect={oppCorrect}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuelResultsView;
