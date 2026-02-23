import React, { useState, useEffect, useRef } from 'react';
import { useConnection } from '../src/contexts/WalletContext';
import { getOpenDuels, fetchCompletedDuels, fetchMyDuelWins, type CompletedDuel, type MyDuelWin } from '../src/utils/api';
import { fetchDuel } from '../src/utils/soltriviaContract';
import { V2_DUEL_FEES, V2_DUEL_LABELS, TXN_FEE_LAMPORTS } from '../src/utils/constants';

interface DuelLobbyViewProps {
  walletAddress: string | null;
  onCreateDuel: (entryFee: number, isPublic: boolean) => void;
  onJoinDuel: (duelId: number, entryFee: number) => void;
  onJoinByCode: (shareCode: string) => void;
  onConnectWallet: () => void;
  onBack: () => void;
  onClaimDuelPrize?: (duelId: number) => Promise<void>;
}

interface OpenDuel {
  id: string;
  duel_id: number;
  player1_wallet: string;
  entry_fee_lamports: number;
  is_public: boolean;
  share_code: string;
  created_at: string;
  expires_at: string;
}

const DuelLobbyView: React.FC<DuelLobbyViewProps> = ({ walletAddress, onCreateDuel, onJoinDuel, onJoinByCode, onConnectWallet, onBack, onClaimDuelPrize }) => {
  const { connection } = useConnection();
  const [openDuels, setOpenDuels] = useState<OpenDuel[]>([]);
  const [recentDuels, setRecentDuels] = useState<CompletedDuel[]>([]);
  const [claimableDuels, setClaimableDuels] = useState<MyDuelWin[]>([]);
  const [claimingDuelId, setClaimingDuelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFeeIdx, setSelectedFeeIdx] = useState(0);
  const [isPublic, setIsPublic] = useState(true);
  const [shareCodeInput, setShareCodeInput] = useState('');
  const [creating, setCreating] = useState(false);
  const pollRef = useRef<number | null>(null);

  const fetchDuels = async () => {
    try {
      const duels = await getOpenDuels();
      setOpenDuels(duels.filter(d => d.player1_wallet !== walletAddress));
    } catch (err) {
      console.error('Failed to fetch open duels:', err);
    }
    setLoading(false);
  };

  const fetchRecent = async () => {
    try {
      const { duels } = await fetchCompletedDuels(10);
      setRecentDuels(duels);
    } catch { /* non-fatal */ }
  };

  const fetchClaimable = async () => {
    if (!walletAddress) return;
    try {
      const wins = await fetchMyDuelWins(walletAddress);
      const unclaimed: MyDuelWin[] = [];
      for (const dw of wins) {
        try {
          const onChain = await fetchDuel(connection, dw.duel_id);
          if (onChain && !onChain.winnerClaimed) unclaimed.push(dw);
        } catch { /* skip */ }
      }
      setClaimableDuels(unclaimed);
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    fetchDuels();
    fetchRecent();
    fetchClaimable();
    pollRef.current = window.setInterval(fetchDuels, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [walletAddress]);

  const handleCreate = () => {
    if (!walletAddress) { onConnectWallet(); return; }
    setCreating(true);
    onCreateDuel(V2_DUEL_FEES[selectedFeeIdx], isPublic);
  };

  const handleJoinByCode = () => {
    const code = shareCodeInput.trim();
    if (!code) return;
    if (!walletAddress) { onConnectWallet(); return; }
    onJoinByCode(code);
  };

  const getTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-full bg-[#050505] p-4 sm:p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[#FF3131] text-[9px] font-black tracking-[0.4em] uppercase italic">1v1</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF3131] animate-pulse"></div>
            </div>
            <h1 className="text-4xl md:text-6xl font-[1000] italic text-white uppercase tracking-tighter">Duels</h1>
          </div>
          <button onClick={onBack} className="px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-sm italic">Back</button>
        </div>

        {/* Create Duel Section */}
        <div className="mb-8 p-6 bg-gradient-to-br from-[#FF3131]/10 to-transparent border border-[#FF3131]/20 rounded-xl">
          <h2 className="text-white font-black text-sm uppercase tracking-wider mb-4">Create a Duel</h2>

          {/* Fee Selector */}
          <p className="text-zinc-500 text-[10px] font-bold uppercase mb-2">Wager Amount</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {V2_DUEL_FEES.map((fee, idx) => (
              <button
                key={fee}
                onClick={() => setSelectedFeeIdx(idx)}
                className={`px-3 py-3 text-center font-black text-xs uppercase rounded border transition-all ${
                  selectedFeeIdx === idx
                    ? 'bg-[#FF3131]/20 border-[#FF3131]/60 text-[#FF3131]'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20'
                }`}
              >
                {V2_DUEL_LABELS[idx]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-4">
            {/* Public/Private Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="accent-[#FF3131]" />
              <span className="text-zinc-400 text-xs font-bold uppercase">Public (visible in lobby)</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-6 py-3 bg-[#FF3131] text-white font-[1000] italic uppercase text-sm tracking-tight rounded-lg hover:bg-[#FF3131]/80 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {creating ? 'Creating...' : 'Create Duel'}
            </button>
            <p className="text-zinc-600 text-xs">
              Total cost: {((V2_DUEL_FEES[selectedFeeIdx] + TXN_FEE_LAMPORTS) / 1_000_000_000).toFixed(4)} SOL (wager + platform fee)
            </p>
          </div>
        </div>

        {/* Join by Code */}
        <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="text-white font-black text-xs uppercase tracking-wider mb-3">Join by Share Code</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareCodeInput}
              onChange={(e) => setShareCodeInput(e.target.value)}
              placeholder="Enter 8-character code"
              className="flex-1 px-4 py-2 bg-black border border-white/20 rounded text-white text-sm font-mono"
              maxLength={8}
            />
            <button
              onClick={handleJoinByCode}
              disabled={!shareCodeInput.trim()}
              className="px-4 py-2 bg-[#14F195] text-black font-black uppercase text-xs rounded disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>

        {/* Unclaimed Duel Wins */}
        {claimableDuels.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[#14F195] font-black text-sm uppercase tracking-wider mb-3">Unclaimed Wins</h2>
            <div className="space-y-2">
              {claimableDuels.map((dw) => {
                const houseCut = Math.floor(dw.total_pot_lamports * 0.1);
                const prize = dw.total_pot_lamports - houseCut;
                const oppName = dw.opponent_username || `${dw.opponent_wallet.slice(0, 4)}...${dw.opponent_wallet.slice(-4)}`;
                return (
                  <div key={dw.duel_id} className="flex items-center justify-between p-3 bg-[#14F195]/5 border border-[#14F195]/20 rounded-lg">
                    <div className="min-w-0">
                      <span className="text-white text-xs font-[1000] italic">vs {oppName}</span>
                      <span className="text-zinc-500 text-[10px] ml-2">{dw.player1_score}–{dw.player2_score}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[#14F195] text-xs font-bold">{(prize / 1_000_000_000).toFixed(4)} SOL</span>
                      <button
                        disabled={claimingDuelId === dw.duel_id}
                        onClick={async () => {
                          if (!onClaimDuelPrize) return;
                          setClaimingDuelId(dw.duel_id);
                          try {
                            await onClaimDuelPrize(dw.duel_id);
                            setClaimableDuels(prev => prev.filter(d => d.duel_id !== dw.duel_id));
                          } catch { /* re-enables button */ }
                          finally { setClaimingDuelId(null); }
                        }}
                        className="px-3 py-1.5 bg-[#14F195] text-black font-[1000] text-[10px] uppercase italic rounded disabled:opacity-50"
                      >
                        {claimingDuelId === dw.duel_id ? 'Claiming...' : 'Claim'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Open Duels */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-black text-sm uppercase tracking-wider">Open Duels</h2>
            <button onClick={fetchDuels} className="text-zinc-500 text-[10px] font-bold uppercase hover:text-zinc-300">Refresh</button>
          </div>

          {loading ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-2 border-[#FF3131] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-zinc-500 text-xs font-bold uppercase">Loading duels...</p>
            </div>
          ) : openDuels.length === 0 ? (
            <div className="py-12 text-center border border-white/5 rounded-xl">
              <p className="text-zinc-500 text-sm font-bold uppercase mb-2">No open duels right now</p>
              <p className="text-zinc-600 text-xs">Create one above or share a link with a friend!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openDuels.map((duel) => (
                <div key={duel.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-lg hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#FF3131]/20 rounded-lg flex items-center justify-center text-[#FF3131] font-black text-xs">VS</div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        {(duel.entry_fee_lamports / 1_000_000_000).toFixed(2)} SOL
                      </p>
                      <p className="text-zinc-500 text-[10px] font-mono">
                        {duel.player1_wallet.slice(0, 6)}...{duel.player1_wallet.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-600 text-[10px] font-bold tabular-nums">{getTimeRemaining(duel.expires_at)}</span>
                    <button
                      onClick={() => {
                        if (!walletAddress) { onConnectWallet(); return; }
                        onJoinDuel(duel.duel_id, duel.entry_fee_lamports);
                      }}
                      className="px-4 py-2 bg-[#14F195] text-black font-black uppercase text-[10px] rounded hover:bg-[#00FFA3] transition-all active:scale-[0.98]"
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Duels */}
        {recentDuels.length > 0 && (
          <div className="mt-8">
            <h2 className="text-white font-black text-sm uppercase tracking-wider mb-4">Recent Duels</h2>
            <div className="space-y-2">
              {recentDuels.map((duel) => {
                const winnerIsP1 = duel.winner_wallet === duel.player1_wallet;
                const winnerName = winnerIsP1
                  ? (duel.player1_username || `${duel.player1_wallet.slice(0, 4)}...${duel.player1_wallet.slice(-4)}`)
                  : (duel.player2_username || (duel.player2_wallet ? `${duel.player2_wallet.slice(0, 4)}...${duel.player2_wallet.slice(-4)}` : '—'));
                const potSol = (duel.total_pot_lamports / 1_000_000_000).toFixed(3);
                const isDraw = !duel.winner_wallet && duel.player1_score === duel.player2_score;
                const p1Name = duel.player1_username || `${duel.player1_wallet.slice(0, 4)}...${duel.player1_wallet.slice(-4)}`;
                const p2Name = duel.player2_wallet
                  ? (duel.player2_username || `${duel.player2_wallet.slice(0, 4)}...${duel.player2_wallet.slice(-4)}`)
                  : '—';
                const timeAgo = (() => {
                  const d = duel.resolved_at || duel.created_at;
                  const diff = Date.now() - new Date(d).getTime();
                  const mins = Math.floor(diff / 60000);
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return `${Math.floor(hrs / 24)}d ago`;
                })();

                return (
                  <div key={duel.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-white text-xs font-[1000] italic truncate">{p1Name}</span>
                        <span className="text-zinc-600 text-[10px] font-black">VS</span>
                        <span className="text-white text-xs font-[1000] italic truncate">{p2Name}</span>
                      </div>
                      <span className="text-zinc-600 text-[9px] font-bold shrink-0 ml-2">{timeAgo}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[10px] font-bold">
                        <span className="text-zinc-500">{duel.player1_score}–{duel.player2_score}</span>
                        <span className="text-zinc-600">{(duel.entry_fee_lamports / 1e9).toFixed(2)} SOL each</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isDraw ? (
                          <span className="text-yellow-400 text-[10px] font-[1000] italic uppercase">Draw</span>
                        ) : (
                          <>
                            <span className="text-[#14F195] text-[10px] font-[1000] italic truncate max-w-[100px]">{winnerName}</span>
                            <span className="text-[#14F195] text-[10px] font-bold">+{potSol} SOL</span>
                          </>
                        )}
                      </div>
                    </div>
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

export default DuelLobbyView;
