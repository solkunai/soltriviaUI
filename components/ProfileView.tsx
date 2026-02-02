import React, { useState, useEffect } from 'react';
import { useWallet } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';
import AvatarUpload from './AvatarUpload';

interface ProfileViewProps {
  username: string;
  avatar: string;
  onEdit: () => void;
  onOpenGuide?: () => void;
}

interface PlayerStats {
  total_games_played: number;
  total_wins: number;
  total_points: number;
  highest_score: number;
  current_streak: number;
  best_streak: number;
  total_sol_won: number;
}

interface GameHistory {
  round_id: string;
  rank: number;
  time_taken_seconds: number;
  correct_answers: number;
  total_questions: number;
  payout_sol: number;
  finished_at: string;
}

const ProfileView: React.FC<ProfileViewProps> = ({ username, avatar, onEdit, onOpenGuide }) => {
  const { publicKey } = useWallet();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState(avatar);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!publicKey) {
        setLoading(false);
        return;
      }

      const walletAddress = publicKey.toBase58();
      
      try {
        // Fetch player profile/stats
        const { data: profileData } = await supabase
          .from('player_profiles')
          .select('*')
          .eq('wallet_address', walletAddress)
          .single();

        if (profileData) {
          setStats({
            total_games_played: profileData.total_games_played || 0,
            total_wins: profileData.total_wins || 0,
            total_points: profileData.total_points || 0,
            highest_score: profileData.highest_score || 0,
            current_streak: profileData.current_streak || 0,
            best_streak: profileData.best_streak || 0,
            total_sol_won: 0, // Calculate from game history
          });
        } else {
          // Default stats if profile doesn't exist
          setStats({
            total_games_played: 0,
            total_wins: 0,
            total_points: 0,
            highest_score: 0,
            current_streak: 0,
            best_streak: 0,
            total_sol_won: 0,
          });
        }

        // Fetch game history (last 10 games)
        const { data: gamesData } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('wallet_address', walletAddress)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(10);

        if (gamesData) {
          // Transform game data to history format
          const transformedHistory: GameHistory[] = gamesData.map((game: any) => ({
            round_id: game.round_id || 'N/A',
            rank: 0, // TODO: Calculate rank from leaderboard
            time_taken_seconds: game.time_taken_seconds || 0,
            correct_answers: game.correct_answers || 0,
            total_questions: 10, // Fixed for now
            payout_sol: 0, // TODO: Get from payouts table
            finished_at: game.finished_at,
          }));
          setHistory(transformedHistory);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [publicKey]);

  const handleAvatarUploadSuccess = (url: string) => {
    setCurrentAvatar(url);
    setShowAvatarUpload(false);
  };
  return (
    <div className="min-h-full bg-[#050505] overflow-x-hidden safe-top relative flex flex-col">
      {/* Sticky Profile Header */}
      <div className="flex items-center justify-between px-6 py-4 md:py-6 border-b border-white/5 bg-[#050505] sticky top-0 z-[60]">
        <h2 className="text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter text-white">PROFILE</h2>
        <button 
          onClick={onOpenGuide}
          className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#9945FF] via-[#3b82f6] to-[#14F195] flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <span className="text-white font-black text-lg md:text-xl italic leading-none">?</span>
        </button>
      </div>

      <div className="p-4 md:p-12 lg:p-20 max-w-[1400px] mx-auto w-full pb-32 md:pb-48 relative">
        {/* Profile Hero Section - Optimized for Mobile */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-14 mb-8 md:mb-20 relative z-10 pt-2 md:pt-0">
          <div className="relative flex-shrink-0">
              <div className="w-24 h-24 md:w-52 md:h-52 p-1 bg-gradient-to-br from-[#14F195] via-[#3b82f6] to-[#9945FF] rounded-[24px] md:rounded-[32px] shadow-2xl">
                  <div className="w-full h-full bg-zinc-900 rounded-[21px] md:rounded-[28px] overflow-hidden">
                      <img src={currentAvatar || avatar} alt="Avatar" className="w-full h-full object-cover grayscale" />
                  </div>
              </div>
              <button
                onClick={() => setShowAvatarUpload(true)}
                className="absolute -bottom-2 -right-2 bg-[#14F195] hover:bg-[#14F195]/90 border border-[#14F195] text-black font-[1000] text-[10px] md:text-xs px-3 md:px-4 py-2 md:py-2 italic rounded-xl md:rounded-2xl shadow-2xl transition-all active:scale-95"
              >
                📷 Upload
              </button>
          </div>

          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="mb-4 md:mb-10">
                <span className="text-[#14F195] text-[8px] md:text-xs font-black uppercase tracking-[0.5em] italic block mb-1 md:mb-3 opacity-70">PROTOCOL OPERATIVE</span>
                <h1 className="text-3xl md:text-8xl font-[1000] italic uppercase tracking-tighter text-white leading-none md:leading-[0.75] mb-3 md:mb-6">{username}</h1>
                <div className="h-1 w-12 md:h-1.5 md:w-20 bg-[#14F195] mx-auto md:mx-0 shadow-[0_0_10px_#14F195]"></div>
              </div>
              
              <button 
                onClick={onEdit} 
                className="px-8 md:px-12 py-3 md:py-5 bg-white/[0.03] border border-white/10 hover:bg-[#14F195] hover:text-black text-white font-[1000] uppercase text-[10px] md:text-sm tracking-widest italic rounded-full transition-all active:scale-95 shadow-2xl hover:scale-105"
              >
                Edit Profile
              </button>
          </div>
        </div>

        {/* Global Stats Grid - Optimized for Mobile */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-16 h-16 border-4 border-[#14F195] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8 mb-8 md:mb-20 relative z-10">
            <ProfileStatCard label="TOTAL WON" value={stats?.total_sol_won.toFixed(2) || "0.00"} unit="SOL" highlight />
            <ProfileStatCard label="TRIVIAS" value={stats?.total_games_played.toString() || "0"} />
            <ProfileStatCard label="STREAK" value={stats?.current_streak.toString() || "0"} suffix="🔥" />
            <ProfileStatCard label="POINTS" value={stats?.total_points.toLocaleString() || "0"} />
          </div>
        )}

        {/* Trivia History Table - Optimized for Mobile */}
        <div className="bg-[#0A0A0A] border border-white/5 relative z-10 shadow-2xl rounded-[24px] md:rounded-[40px] overflow-hidden">
          <div className="px-6 py-4 md:px-10 md:py-8 border-b border-white/5 bg-[#0D0D0D]">
              <h2 className="text-xl md:text-4xl font-[1000] italic uppercase tracking-tighter text-white">Trivia History</h2>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[500px] md:min-w-[700px]">
                <thead className="bg-black/40 text-[8px] md:text-xs font-black text-zinc-500 uppercase tracking-[0.4em]">
                  <tr>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-left">Arena</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-center">Rank</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-center">Time</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-center">Correct</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-right">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-zinc-500 italic">
                          No game history yet. Play your first trivia to see stats!
                        </td>
                      </tr>
                    ) : (
                      history.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="px-6 py-5 md:px-10 md:py-8 font-[1000] uppercase text-[#14F195] text-sm md:text-lg italic tracking-tight">
                            #{row.round_id.slice(0, 6)}
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-center font-[1000] italic text-white text-base md:text-xl tabular-nums">
                            #{row.rank || '-'}
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-center font-[1000] italic text-zinc-400 text-sm md:text-xl tabular-nums">
                            {row.time_taken_seconds}s
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-center font-[1000] italic text-white text-sm md:text-xl tabular-nums">
                            {row.correct_answers}/{row.total_questions}
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-right font-[1000] italic text-[#14F195] text-lg md:text-3xl tabular-nums drop-shadow-[0_0_10px_rgba(20,241,149,0.3)]">
                            {row.payout_sol > 0 ? `+${row.payout_sol.toFixed(2)} SOL` : `+${row.correct_answers * 100} XP`}
                          </td>
                        </tr>
                      ))
                    )}
                </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Avatar Upload Modal */}
      {showAvatarUpload && publicKey && (
        <AvatarUpload
          walletAddress={publicKey.toBase58()}
          currentAvatar={currentAvatar || avatar}
          onUploadSuccess={handleAvatarUploadSuccess}
          onClose={() => setShowAvatarUpload(false)}
        />
      )}
    </div>
  );
};

const ProfileStatCard: React.FC<{ label: string, value: string, unit?: string, suffix?: string, highlight?: boolean }> = ({ label, value, unit, suffix, highlight }) => (
    <div className={`bg-[#0A0A0A] border p-4 md:p-10 rounded-[20px] md:rounded-[32px] shadow-2xl group hover:scale-[1.03] transition-all duration-300 ${highlight ? 'border-[#14F195]/30 bg-gradient-to-br from-[#14F195]/5 to-transparent' : 'border-white/5'}`}>
        <span className="text-[7px] md:text-xs text-zinc-500 font-black uppercase tracking-[0.2em] md:tracking-[0.3em] block mb-2 md:mb-4 group-hover:text-zinc-200 transition-colors italic">{label}</span>
        <div className="flex items-baseline gap-1 md:gap-2">
            <span className={`text-xl md:text-5xl font-[1000] italic leading-none tracking-tighter ${highlight ? 'text-[#14F195]' : 'text-white'}`}>{value}</span>
            {unit && <span className="text-[#14F195] font-[1000] text-[8px] md:text-lg italic tracking-widest">{unit}</span>}
            {suffix && <span className="text-xl md:text-4xl">{suffix}</span>}
        </div>
    </div>
);

export default ProfileView;
