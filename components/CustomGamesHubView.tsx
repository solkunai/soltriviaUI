import React, { useState, useEffect } from 'react';
import { supabase } from '../src/utils/supabase';

interface CustomGamesHubViewProps {
  walletAddress: string | null;
  hasGamePass: boolean;
  onCreateGame: () => void;
  onViewGame: (slug: string) => void;
  onBack: () => void;
}

interface BrowsableGame {
  id: string;
  slug: string;
  name: string;
  creator_wallet: string;
  question_count: number;
  total_plays: number;
  expires_at: string;
  created_at: string;
  prize_model: string | null;
  entry_fee_lamports: number | null;
  player_count: number | null;
  max_players: number | null;
}

interface EndedGame {
  id: string;
  slug: string;
  name: string;
  creator_wallet: string;
  question_count: number;
  total_plays: number;
  expires_at: string;
  prize_model: string | null;
  total_pot_lamports: number | null;
}

const CustomGamesHubView: React.FC<CustomGamesHubViewProps> = ({ walletAddress, hasGamePass, onCreateGame, onViewGame, onBack }) => {
  const [joinable, setJoinable] = useState<BrowsableGame[]>([]);
  const [ended, setEnded] = useState<EndedGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchGames = async () => {
      setLoading(true);
      try {
        // Joinable: active, not expired, public (is_public not false)
        const { data: activeGames } = await supabase
          .from('custom_games')
          .select('id, slug, name, creator_wallet, question_count, total_plays, expires_at, created_at, prize_model, entry_fee_lamports, player_count, max_players')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(20);

        if (mounted && activeGames) {
          // Filter out user's own games
          setJoinable(activeGames.filter(g => g.creator_wallet !== walletAddress));
        }

        // Recently ended: expired or past expiry, public
        const { data: endedGames } = await supabase
          .from('custom_games')
          .select('id, slug, name, creator_wallet, question_count, total_plays, expires_at, prize_model, total_pot_lamports')
          .lt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(15);

        if (mounted && endedGames) {
          setEnded(endedGames);
        }
      } catch (err) {
        console.error('Failed to fetch custom games:', err);
      }
      if (mounted) setLoading(false);
    };

    fetchGames();
    return () => { mounted = false; };
  }, [walletAddress]);

  return (
    <div className="min-h-full bg-[#050505] p-4 sm:p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-[#38BDF8] text-[9px] font-black tracking-[0.4em] uppercase italic block mb-1">Community</span>
            <h1 className="text-4xl md:text-6xl font-[1000] italic text-white uppercase tracking-tighter">Custom Games</h1>
          </div>
          <button onClick={onBack} className="px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-sm italic">Back</button>
        </div>

        {/* Create Game */}
        <div className="mb-8 p-5 bg-gradient-to-br from-[#38BDF8]/10 to-transparent border border-[#38BDF8]/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-white font-[1000] text-base italic uppercase tracking-tight mb-1">Create Your Own</h2>
            <p className="text-zinc-500 text-xs font-bold">Write questions, share a link, challenge anyone.</p>
          </div>
          <button
            onClick={onCreateGame}
            className="px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-sm tracking-tight rounded-lg hover:bg-[#38BDF8]/80 transition-all active:scale-[0.98] whitespace-nowrap"
          >
            + Create Game
          </button>
        </div>

        {/* Joinable Games */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-black text-sm uppercase tracking-wider">Joinable Games</h2>
            <span className="text-zinc-600 text-[10px] font-bold">{joinable.length} active</span>
          </div>

          {loading ? (
            <div className="py-10 text-center">
              <div className="w-7 h-7 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-zinc-500 text-xs font-bold uppercase">Loading...</p>
            </div>
          ) : joinable.length === 0 ? (
            <div className="py-10 text-center border border-white/5 rounded-xl">
              <p className="text-zinc-500 text-sm font-bold uppercase mb-1">No joinable games right now</p>
              <p className="text-zinc-600 text-xs">Create one or check back later!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {joinable.map((game) => {
                const daysLeft = Math.max(0, Math.ceil((new Date(game.expires_at).getTime() - Date.now()) / 86400000));
                const isPaid = game.prize_model === 'player_funded';
                return (
                  <div key={game.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-lg hover:border-[#38BDF8]/20 transition-all">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-[1000] text-sm italic truncate">{game.name}</span>
                        {isPaid && (
                          <span className="text-amber-400 text-[7px] font-black italic uppercase px-1.5 py-0.5 bg-amber-400/10 rounded shrink-0">Prize</span>
                        )}
                        <span className="text-[#14F195] text-[7px] font-black italic uppercase px-1.5 py-0.5 bg-[#14F195]/10 rounded shrink-0">{daysLeft}d left</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-bold">
                        <span>{game.question_count} Q</span>
                        <span>{game.total_plays ?? 0} plays</span>
                        {isPaid && game.entry_fee_lamports && (
                          <span className="text-amber-400">{(game.entry_fee_lamports / 1e9).toFixed(3)} SOL entry</span>
                        )}
                        {isPaid && game.max_players && (
                          <span>{game.player_count ?? 0}/{game.max_players} players</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onViewGame(game.slug)}
                      className="px-4 py-2 bg-[#38BDF8]/20 text-[#38BDF8] font-black uppercase text-[10px] rounded hover:bg-[#38BDF8]/30 transition-all active:scale-[0.98] shrink-0"
                    >
                      Play
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently Ended */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-black text-sm uppercase tracking-wider">Recently Ended</h2>
          </div>

          {loading ? null : ended.length === 0 ? (
            <div className="py-8 text-center border border-white/5 rounded-xl">
              <p className="text-zinc-600 text-xs font-bold uppercase">No recently ended games</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ended.map((game) => {
                const isPaid = game.prize_model === 'player_funded';
                return (
                  <div key={game.id} className="flex items-center justify-between p-4 bg-white/[0.01] border border-white/5 rounded-lg opacity-70">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-zinc-300 font-[1000] text-sm italic truncate">{game.name}</span>
                        <span className="text-zinc-600 text-[7px] font-black italic uppercase px-1.5 py-0.5 bg-white/5 rounded shrink-0">Ended</span>
                        {isPaid && game.total_pot_lamports ? (
                          <span className="text-amber-400/60 text-[7px] font-black italic uppercase px-1.5 py-0.5 bg-amber-400/5 rounded shrink-0">
                            {(game.total_pot_lamports / 1e9).toFixed(3)} SOL pot
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-zinc-600 text-[10px] font-bold">
                        <span>{game.question_count} Q</span>
                        <span>{game.total_plays ?? 0} plays</span>
                        <span>Ended {new Date(game.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onViewGame(game.slug)}
                      className="px-4 py-2 bg-white/5 text-zinc-400 font-black uppercase text-[10px] rounded hover:bg-white/10 transition-all active:scale-[0.98] shrink-0"
                    >
                      View
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomGamesHubView;
