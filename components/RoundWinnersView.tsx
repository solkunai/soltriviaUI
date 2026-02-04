import React, { useState, useEffect } from 'react';
import { DEFAULT_AVATAR } from '../src/utils/constants';
import { fetchRoundsWithWinners, type RoundWithWinner } from '../src/utils/api';

interface RoundWinnersViewProps {
  onOpenGuide?: () => void;
}

const RoundWinnersView: React.FC<RoundWinnersViewProps> = ({ onOpenGuide }) => {
  const [rounds, setRounds] = useState<RoundWithWinner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchRoundsWithWinners(50)
      .then((data) => {
        if (mounted) setRounds(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const formatWallet = (w: string) => `${w.slice(0, 4)}...${w.slice(-4)}`;
  const potSol = (lamports: number) => (lamports / 1_000_000_000).toFixed(2);

  return (
    <div className="min-h-full bg-[#050505] text-white safe-top relative flex flex-col overflow-x-hidden">
      <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-[#050505] sticky top-0 z-[100]">
        <h2 className="text-2xl font-[1000] italic uppercase tracking-tighter">ROUND WINNERS</h2>
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9945FF] via-[#3b82f6] to-[#14F195] flex items-center justify-center shadow-lg active:scale-95 transition-all"
          >
            <span className="text-white font-[1000] text-xl italic leading-none">?</span>
          </button>
        )}
      </div>

      <div className="p-6 md:p-12 lg:p-20 max-w-[1000px] mx-auto w-full pb-32">
        <div className="mb-10">
          <h1 className="text-4xl md:text-7xl font-[1000] italic uppercase tracking-tighter leading-[0.85]">
            ROUND<br /><span className="sol-gradient-text">HALL OF FAME</span>
          </h1>
          <div className="h-1 w-16 bg-[#14F195] mt-4 shadow-[0_0_15px_#14F195]" />
          <p className="text-zinc-500 text-[10px] md:text-xs font-black uppercase tracking-widest italic mt-4 max-w-md">
            Each 6-hour round has one top scorer. Winners tracked by round.
          </p>
        </div>

        {loading && (
          <div className="text-center py-20">
            <p className="text-zinc-500 font-black uppercase tracking-widest italic animate-pulse">Loading rounds...</p>
          </div>
        )}

        {!loading && rounds.length === 0 && (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg font-bold italic">No completed rounds yet.</p>
            <p className="text-zinc-600 text-sm mt-2">Winners will appear here after each round ends.</p>
          </div>
        )}

        {!loading && rounds.length > 0 && (
          <div className="space-y-4">
            {rounds.map((r) => (
              <div
                key={r.round_id}
                className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4 hover:border-[#14F195]/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[#14F195] text-[10px] md:text-xs font-black uppercase tracking-widest italic mb-1">
                    ROUND
                  </div>
                  <div className="text-white font-[1000] italic text-base md:text-lg leading-tight truncate">
                    {r.round_title}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                    <span>{r.player_count} players</span>
                    <span>·</span>
                    <span>{potSol(r.pot_lamports)} SOL pool</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 md:gap-6 md:min-w-[280px]">
                  {r.winner_wallet ? (
                    <>
                      <div className="w-12 h-12 rounded-full border-2 border-[#14F195]/50 overflow-hidden flex-shrink-0 bg-zinc-900">
                        <img
                          src={r.winner_avatar || DEFAULT_AVATAR}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic">
                          WINNER
                        </div>
                        <div className="text-white font-[1000] italic truncate">
                          {r.winner_display_name || formatWallet(r.winner_wallet)}
                        </div>
                        {r.winner_display_name && (
                          <div className="text-zinc-500 text-[9px] font-mono">
                            {formatWallet(r.winner_wallet)}
                          </div>
                        )}
                        <div className="text-[#14F195] text-sm font-black italic mt-0.5">
                          {r.winner_score.toLocaleString()} XP
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-zinc-600 text-sm font-bold italic">
                      No winner (round in progress or no finishers)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoundWinnersView;
