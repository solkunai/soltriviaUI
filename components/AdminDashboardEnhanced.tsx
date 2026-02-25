import * as React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../src/utils/supabase';
import { Connection, PublicKey, LAMPORTS_PER_SOL, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { PRIZE_POOL_WALLET, REVENUE_WALLET, SUPABASE_FUNCTIONS_URL, OPERATOR_WALLET } from '../src/utils/constants';
import { getAuthHeaders, getAdminHeaders, fetchRoundPayouts, markPayoutPaid, postWinnersOnChain, finalizeCustomGame, type RoundPayout } from '../src/utils/api';
import { getSolanaRpcEndpoint, getRecentBlockhashWithRetry } from '../src/utils/rpc';
import { useWallet } from '../src/contexts/WalletContext';
import { WalletMultiButton } from '../src/contexts/WalletContext';
import { buildInitializeIx, fetchGameConfig, SOLTRIVIA_PROGRAM_ID } from '../src/utils/soltriviaContract';
import Pagination from './Pagination';

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

function getAdminCreds(): { u: string; p: string } {
  try {
    const u = sessionStorage.getItem('admin_username');
    const p = sessionStorage.getItem('admin_password');
    if (u != null && p != null) return { u, p };
  } catch (_) {}
  return {
    u: import.meta.env.VITE_ADMIN_USERNAME || '',
    p: import.meta.env.VITE_ADMIN_PASSWORD || '',
  };
}

type TabType = 'questions' | 'users' | 'rounds' | 'stats' | 'lives' | 'rankings' | 'quests' | 'round_winners' | 'referrals' | 'answer_debug' | 'game_passes' | 'custom_games' | 'duels' | 'notifications';

interface Question {
  id?: string;
  category: string;
  text: string;
  options: string[];
  correct_index: number;
  difficulty: number;
  active: boolean;
}

interface PlayerStats {
  wallet_address: string;
  username: string;
  total_games_played: number;
  total_points: number;
  current_streak: number;
  lives_count: number;
}

interface RoundData {
  id: string;
  date: string;
  round_number: number;
  player_count: number;
  pot_lamports: number;
  status: string;
}

const AdminDashboardEnhanced: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalPlayers: 0,
    totalGames: 0,
    activePlayers24h: 0,
    totalLivesPurchased: 0,
    totalRevenueSol: 0,
    revenueWalletBalance: 0,
    prizePoolWalletBalance: 0,
    totalGamePasses: 0,
    totalCustomGames: 0,
    totalCustomGamePlays: 0,
    totalReferrals: 0,
    totalQuestsCompleted: 0,
    totalRoundsCompleted: 0,
    totalPaidOutSol: 0,
    uniqueWalletsWeek: 0,
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      // Fetch total questions
      const { count: questionsCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

      // Fetch total players
      const { count: playersCount } = await supabase
        .from('player_profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch total games
      const { count: gamesCount } = await supabase
        .from('game_sessions')
        .select('*', { count: 'exact', head: true });

      // Fetch active players in last 24h
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const { count: activePlayersCount } = await supabase
        .from('daily_activity')
        .select('*', { count: 'exact', head: true })
        .gte('activity_date', yesterday.toISOString().split('T')[0]);

      // Fetch total lives purchased
      const { data: livesData } = await supabase
        .from('lives_purchases')
        .select('lives_purchased, amount_lamports');

      const totalLives = livesData?.reduce((sum, p) => sum + p.lives_purchased, 0) || 0;
      const totalRevenue = livesData?.reduce((sum, p) => sum + p.amount_lamports, 0) || 0;

      // Fetch wallet balances
      let revenueBalance = 0;
      let prizePoolBalance = 0;
      try {
        const connection = new Connection(getSolanaRpcEndpoint(), 'confirmed');
        
        const [revenueLamports, prizePoolLamports] = await Promise.all([
          connection.getBalance(new PublicKey(REVENUE_WALLET)),
          connection.getBalance(new PublicKey(PRIZE_POOL_WALLET)),
        ]);

        revenueBalance = revenueLamports / LAMPORTS_PER_SOL;
        prizePoolBalance = prizePoolLamports / LAMPORTS_PER_SOL;
      } catch (balanceError) {
        console.error('Error fetching wallet balances:', balanceError);
      }

      // Fetch additional stats in parallel
      const [gamePassesRes, customGamesRes, customGamePlaysRes, referralsRes, questsRes, roundsRes, payoutsRes, weeklyWalletsRes] = await Promise.all([
        supabase.from('game_passes').select('*', { count: 'exact', head: true }),
        supabase.from('custom_games').select('*', { count: 'exact', head: true }),
        supabase.from('custom_game_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('player_profiles').select('referred_by', { count: 'exact', head: true }).not('referred_by', 'is', null),
        supabase.from('quest_completions').select('*', { count: 'exact', head: true }),
        supabase.from('daily_rounds').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('round_payouts').select('paid_lamports').not('paid_at', 'is', null),
        supabase.from('daily_activity').select('wallet_address', { count: 'exact', head: true }).gte('activity_date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]),
      ]);

      const totalPaidOut = payoutsRes.data?.reduce((sum: number, p: { paid_lamports: number | null }) => sum + (p.paid_lamports ?? 0), 0) || 0;

      setStats({
        totalQuestions: questionsCount || 0,
        totalPlayers: playersCount || 0,
        totalGames: gamesCount || 0,
        activePlayers24h: activePlayersCount || 0,
        totalLivesPurchased: totalLives,
        totalRevenueSol: totalRevenue / LAMPORTS_PER_SOL,
        revenueWalletBalance: revenueBalance,
        prizePoolWalletBalance: prizePoolBalance,
        totalGamePasses: gamePassesRes.count || 0,
        totalCustomGames: customGamesRes.count || 0,
        totalCustomGamePlays: customGamePlaysRes.count || 0,
        totalReferrals: referralsRes.count || 0,
        totalQuestsCompleted: questsRes.count || 0,
        totalRoundsCompleted: roundsRes.count || 0,
        totalPaidOutSol: totalPaidOut / LAMPORTS_PER_SOL,
        uniqueWalletsWeek: weeklyWalletsRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-[1000] italic uppercase tracking-tighter mb-2">Admin Dashboard</h1>
        <p className="text-zinc-500 text-sm">Manage your SOL Trivia</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'stats', label: '📊 Stats', icon: '📊' },
          { id: 'rankings', label: '🏆 Rankings', icon: '🏆' },
          { id: 'round_winners', label: '🏅 Round Winners', icon: '🏅' },
          { id: 'questions', label: '❓ Questions', icon: '❓' },
          { id: 'quests', label: '📋 Quests', icon: '📋' },
          { id: 'users', label: '👥 Users', icon: '👥' },
          { id: 'rounds', label: '🎮 Rounds', icon: '🎮' },
          { id: 'lives', label: '❤️ Lives', icon: '❤️' },
          { id: 'game_passes', label: '🎫 Game Passes', icon: '🎫' },
          { id: 'custom_games', label: '🎲 Custom Games', icon: '🎲' },
          { id: 'duels', label: '⚔️ Duels', icon: '⚔️' },
          { id: 'referrals', label: '🔗 Referrals', icon: '🔗' },
          { id: 'notifications', label: '🔔 Notifications', icon: '🔔' },
          { id: 'answer_debug', label: '🔬 Answer debug', icon: '🔬' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-6 py-3 font-black text-sm uppercase rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-[#14F195] text-black'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8">
        {activeTab === 'stats' && <StatsView stats={stats} loading={loading} />}
        {activeTab === 'rankings' && <RankingsView />}
        {activeTab === 'round_winners' && <RoundWinnersAdminView />}
        {activeTab === 'questions' && <QuestionsView functionsUrl={SUPABASE_FUNCTIONS_URL} />}
        {activeTab === 'quests' && <QuestsManagementView />}
        {activeTab === 'users' && <UsersView />}
        {activeTab === 'rounds' && <RoundsView />}
        {activeTab === 'lives' && <LivesView />}
        {activeTab === 'game_passes' && <GamePassesView />}
        {activeTab === 'custom_games' && <CustomGamesAdminView />}
        {activeTab === 'duels' && <DuelsAdminView />}
        {activeTab === 'referrals' && <ReferralsView />}
        {activeTab === 'notifications' && <NotificationsView />}
        {activeTab === 'answer_debug' && <AnswerDebugView functionsUrl={SUPABASE_FUNCTIONS_URL} />}
      </div>
    </div>
  );
};

const RANKINGS_PAGE_SIZE = 50;
const RankingsView: React.FC = () => {
  const [list, setList] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  useEffect(() => {
    setLoading(true);
    const from = page * RANKINGS_PAGE_SIZE;
    const to = from + RANKINGS_PAGE_SIZE - 1;
    supabase
      .from('player_profiles')
      .select('wallet_address, username, total_games_played, total_points, current_streak', { count: 'exact' })
      .order('total_points', { ascending: false })
      .range(from, to)
      .then(({ data, count }) => {
        setList((data as PlayerStats[]) || []);
        setTotalCount(count ?? 0);
        setLoading(false);
      });
  }, [page]);
  if (loading && list.length === 0) return <div className="py-12 text-center text-zinc-400">Loading rankings...</div>;
  return (
    <div className="py-6">
      <h2 className="text-xl font-black text-white mb-4">Player Rankings (by total points)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">#</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Wallet</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Username</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Games</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Points</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Streak</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={p.wallet_address} className="border-b border-white/5">
                <td className="py-2 px-2 text-zinc-400">{page * RANKINGS_PAGE_SIZE + i + 1}</td>
                <td className="py-2 px-2 font-mono text-xs text-zinc-300">{p.wallet_address.slice(0, 8)}...{p.wallet_address.slice(-4)}</td>
                <td className="py-2 px-2 text-white text-sm">{p.username || '—'}</td>
                <td className="py-2 px-2 text-[#14F195]">{p.total_games_played ?? 0}</td>
                <td className="py-2 px-2 text-[#14F195] font-bold">{(p.total_points ?? 0).toLocaleString()}</td>
                <td className="py-2 px-2 text-zinc-400">{p.current_streak ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="text-zinc-500 mt-4">No players yet.</p>}
      <Pagination currentPage={page} totalCount={totalCount} pageSize={RANKINGS_PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
};

const USERS_PAGE_SIZE = 50;
const UsersView: React.FC = () => {
  const [list, setList] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  useEffect(() => {
    setLoading(true);
    const from = page * USERS_PAGE_SIZE;
    const to = from + USERS_PAGE_SIZE - 1;
    supabase
      .from('player_profiles')
      .select('wallet_address, username, total_games_played, total_points, current_streak', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(from, to)
      .then(({ data, count }) => {
        setList((data as PlayerStats[]) || []);
        setTotalCount(count ?? 0);
        setLoading(false);
      });
  }, [page]);
  if (loading && list.length === 0) return <div className="py-12 text-center text-zinc-400">Loading users...</div>;
  return (
    <div className="py-6">
      <h2 className="text-xl font-black text-white mb-4">Users (player profiles) — {totalCount} total</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Wallet</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Username</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Games</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Points</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Streak</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.wallet_address} className="border-b border-white/5">
                <td className="py-2 px-2 font-mono text-xs text-zinc-300">{p.wallet_address.slice(0, 8)}...{p.wallet_address.slice(-4)}</td>
                <td className="py-2 px-2 text-white text-sm">{p.username || '—'}</td>
                <td className="py-2 px-2 text-[#14F195]">{p.total_games_played ?? 0}</td>
                <td className="py-2 px-2 text-[#14F195]">{(p.total_points ?? 0).toLocaleString()}</td>
                <td className="py-2 px-2 text-zinc-400">{p.current_streak ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="text-zinc-500 mt-4">No users yet.</p>}
      <Pagination currentPage={page} totalCount={totalCount} pageSize={USERS_PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
};

const RoundsView: React.FC = () => {
  const [list, setList] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from('daily_rounds')
      .select('id, date, round_number, pot_lamports, player_count, status')
      .order('date', { ascending: false })
      .order('round_number', { ascending: false })
      .limit(80)
      .then(({ data }) => {
        setList((data as RoundData[]) || []);
        setLoading(false);
      });
  }, []);
  if (loading) return <div className="py-12 text-center text-zinc-400">Loading rounds...</div>;
  return (
    <div className="py-6">
      <h2 className="text-xl font-black text-white mb-4">Daily Rounds</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Date</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Round</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Pot (SOL)</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Players</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
                <td className="py-2 px-2 text-white text-sm">{r.date}</td>
                <td className="py-2 px-2 text-zinc-400">#{r.round_number ?? 0}</td>
                <td className="py-2 px-2 text-[#14F195] font-bold">{((r.pot_lamports ?? 0) / 1_000_000_000).toFixed(4)}</td>
                <td className="py-2 px-2 text-zinc-400">{r.player_count ?? 0}</td>
                <td className="py-2 px-2 text-zinc-500 text-xs">{r.status ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="text-zinc-500 mt-4">No rounds yet.</p>}
    </div>
  );
};

function getRoundLabel(date: string, roundNumber: number): string {
  const d = new Date(date + 'Z');
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const start = roundNumber * 6;
  const end = start + 6;
  return `${day} ${start}:00–${end}:00 UTC`;
}

const ROUND_WINNERS_PAGE_SIZE = 10;
const RoundWinnersAdminView: React.FC = () => {
  const [rounds, setRounds] = useState<Array<{ id: string; date: string; round_number: number; pot_lamports: number; player_count: number }>>([]);
  const [payouts, setPayouts] = useState<RoundPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [paidInput, setPaidInput] = useState<{ roundId: string; rank: number; value: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [postingRoundId, setPostingRoundId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalRoundsCount, setTotalRoundsCount] = useState(0);
  const [claimFilter, setClaimFilter] = useState<'all' | 'unclaimed' | 'claimed'>('all');

  const creds = getAdminCreds();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const from = page * ROUND_WINNERS_PAGE_SIZE;
    const to = from + ROUND_WINNERS_PAGE_SIZE - 1;
    (async () => {
      const { data: roundsData, count: roundsCount, error: roundsErr } = await supabase
        .from('daily_rounds')
        .select('id, date, round_number, pot_lamports, player_count', { count: 'exact' })
        .order('date', { ascending: false })
        .order('round_number', { ascending: false })
        .range(from, to);
      if (roundsErr || !roundsData?.length) {
        if (mounted) setRounds([]);
        if (mounted) setPayouts([]);
        if (mounted) setTotalRoundsCount(roundsCount ?? 0);
        setLoading(false);
        return;
      }
      if (mounted) setRounds(roundsData as typeof rounds);
      if (mounted) setTotalRoundsCount(roundsCount ?? 0);
      const ids = roundsData.map((r: { id: string }) => r.id);
      const list = await fetchRoundPayouts(ids);
      if (mounted) setPayouts(list);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [page]);

  const copyWallet = (wallet: string) => {
    navigator.clipboard.writeText(wallet).then(() => {
      setCopyFeedback(wallet);
      setTimeout(() => setCopyFeedback(null), 1500);
    });
  };

  const handleMarkPaid = async (roundId: string, rank: number, paidLamports: number) => {
    if (!creds.u?.trim() || !creds.p) {
      alert('Admin credentials missing. Please log out and log in again so Mark as paid can authenticate.');
      return;
    }
    setMarking(`${roundId}-${rank}`);
    const result = await markPayoutPaid(roundId, rank, paidLamports, creds.u, creds.p);
    setMarking(null);
    setPaidInput(null);
    if (result.success) {
      setPayouts((prev) => prev.map((p) => (p.round_id === roundId && p.rank === rank ? { ...p, paid_at: new Date().toISOString(), paid_lamports: paidLamports } : p)));
    } else {
      alert(result.error || 'Failed to mark paid');
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-zinc-400">
        <p className="font-black uppercase tracking-widest">Loading round winners...</p>
      </div>
    );
  }

  const roundsWithFivePayouts = rounds.filter((r) => payouts.filter((p) => p.round_id === r.id).length >= 5);

  const handlePostWinnersOnChain = async (roundId: string) => {
    setPostingRoundId(roundId);
    const result = await postWinnersOnChain(roundId);
    setPostingRoundId(null);
    if (result.success) {
      alert(`Winners posted on-chain. Tx: ${result.signature ?? 'ok'}`);
    } else {
      alert(result.error ?? 'Failed to post winners on-chain');
    }
  };

  // Claim tracking stats
  const unclaimedPayouts = payouts.filter(p => !p.paid_at);
  const claimedPayouts = payouts.filter(p => !!p.paid_at);
  const unclaimedSol = unclaimedPayouts.reduce((sum, p) => sum + p.prize_lamports, 0) / 1_000_000_000;
  const claimedSol = claimedPayouts.reduce((sum, p) => sum + (p.paid_lamports ?? p.prize_lamports), 0) / 1_000_000_000;

  // Filter payouts by claim status
  const filteredPayouts = claimFilter === 'all' ? payouts : claimFilter === 'unclaimed' ? unclaimedPayouts : claimedPayouts;

  return (
    <div className="py-6">
      <h2 className="text-xl font-black text-white mb-2">Round Winners (Top 5, 100% pot)</h2>
      <p className="text-zinc-500 text-sm mb-4">Copy wallet, mark as paid, and set prize amount paid. 1st 50%, 2nd 20%, 3rd 15%, 4th 10%, 5th 5%.</p>

      {/* Claim Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-zinc-500 text-[10px] font-black uppercase">Total Payouts</p>
          <p className="text-2xl font-[1000] text-white">{payouts.length}</p>
          <p className="text-zinc-500 text-xs">{(payouts.reduce((s, p) => s + p.prize_lamports, 0) / 1_000_000_000).toFixed(4)} SOL total</p>
        </div>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="text-yellow-400 text-[10px] font-black uppercase">Unclaimed</p>
          <p className="text-2xl font-[1000] text-yellow-400">{unclaimedPayouts.length}</p>
          <p className="text-yellow-400/60 text-xs">{unclaimedSol.toFixed(4)} SOL pending</p>
        </div>
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <p className="text-[#14F195] text-[10px] font-black uppercase">Claimed</p>
          <p className="text-2xl font-[1000] text-[#14F195]">{claimedPayouts.length}</p>
          <p className="text-[#14F195]/60 text-xs">{claimedSol.toFixed(4)} SOL paid out</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4">
        {(['all', 'unclaimed', 'claimed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setClaimFilter(f)}
            className={`px-3 py-1.5 text-xs font-black uppercase rounded border ${
              claimFilter === f
                ? f === 'unclaimed' ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                  : f === 'claimed' ? 'bg-[#14F195]/20 border-[#14F195]/40 text-[#14F195]'
                  : 'bg-white/10 border-white/20 text-white'
                : 'bg-transparent border-white/10 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f} ({f === 'all' ? payouts.length : f === 'unclaimed' ? unclaimedPayouts.length : claimedPayouts.length})
          </button>
        ))}
      </div>

      {roundsWithFivePayouts.length > 0 && (
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-zinc-400 text-xs font-black uppercase tracking-wider mb-3">Finalize on-chain (so winners can claim from vault)</p>
          <div className="flex flex-wrap gap-2">
            {roundsWithFivePayouts.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={postingRoundId !== null}
                onClick={() => handlePostWinnersOnChain(r.id)}
                className="px-3 py-1.5 bg-[#14F195]/20 hover:bg-[#14F195]/30 border border-[#14F195]/40 text-[#14F195] text-xs font-bold rounded disabled:opacity-50"
              >
                {postingRoundId === r.id ? '…' : `Post ${getRoundLabel(r.date, r.round_number)} on-chain`}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Round</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Rank</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Wallet</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Score</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Prize (SOL)</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Claim Status</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Paid amount</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayouts.map((p) => {
              const round = rounds.find((r) => r.id === p.round_id);
              const roundLabel = round ? getRoundLabel(round.date, round.round_number) : p.round_id.slice(0, 8);
              const isMarking = marking === `${p.round_id}-${p.rank}`;
              const isInputOpen = paidInput?.roundId === p.round_id && paidInput?.rank === p.rank;
              return (
                <tr key={`${p.round_id}-${p.rank}`} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-2 text-white text-sm font-mono">{roundLabel}</td>
                  <td className="py-2 px-2 text-zinc-400 font-black">#{p.rank}</td>
                  <td className="py-2 px-2">
                    <span className="font-mono text-xs text-zinc-300">{p.wallet_address.slice(0, 6)}...{p.wallet_address.slice(-4)}</span>
                    <button
                      type="button"
                      onClick={() => copyWallet(p.wallet_address)}
                      className="ml-2 px-2 py-0.5 bg-white/10 hover:bg-[#14F195]/20 text-[10px] font-bold rounded"
                    >
                      {copyFeedback === p.wallet_address ? 'Copied!' : 'Copy'}
                    </button>
                  </td>
                  <td className="py-2 px-2 text-[#14F195] text-sm font-bold">{p.score.toLocaleString()}</td>
                  <td className="py-2 px-2 text-white text-sm">{(p.prize_lamports / 1_000_000_000).toFixed(4)}</td>
                  <td className="py-2 px-2">
                    {p.paid_at ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#14F195]/20 text-[#14F195] text-xs font-bold rounded-full">
                        Claimed
                        <span className="text-[#14F195]/60 text-[10px] ml-1">{new Date(p.paid_at).toLocaleDateString()}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-full">
                        Unclaimed
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {p.paid_lamports != null ? (p.paid_lamports / 1_000_000_000).toFixed(4) + ' SOL' : '—'}
                  </td>
                  <td className="py-2 px-2">
                    {isInputOpen ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        <input
                          type="number"
                          step="any"
                          placeholder="SOL"
                          value={paidInput.value}
                          onChange={(e) => setPaidInput((prev) => prev ? { ...prev, value: e.target.value } : null)}
                          className="w-24 px-2 py-1 bg-black border border-white/20 rounded text-white text-xs"
                        />
                        <button
                          type="button"
                          disabled={isMarking}
                          onClick={() => {
                            const lamports = Math.round(parseFloat(paidInput.value || '0') * 1_000_000_000);
                            if (lamports >= 0) handleMarkPaid(p.round_id, p.rank, lamports);
                          }}
                          className="px-2 py-1 bg-[#14F195] text-black text-xs font-bold rounded disabled:opacity-50"
                        >
                          {isMarking ? '…' : 'Save'}
                        </button>
                        <button type="button" onClick={() => setPaidInput(null)} className="px-2 py-1 text-zinc-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPaidInput({ roundId: p.round_id, rank: p.rank, value: p.paid_lamports != null ? String(p.paid_lamports / 1_000_000_000) : '' })}
                        className="px-2 py-1 bg-white/10 hover:bg-[#14F195]/20 text-[10px] font-bold rounded"
                      >
                        Mark paid
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rounds.length > 0 && filteredPayouts.length === 0 && (
        <p className="text-zinc-500 text-sm mt-4">
          {claimFilter === 'all' ? 'No payouts yet. Top 5 are populated when players complete games (calculate_rankings_and_winner).'
            : claimFilter === 'unclaimed' ? 'All payouts have been claimed!' : 'No claimed payouts yet.'}
        </p>
      )}
      <Pagination currentPage={page} totalCount={totalRoundsCount} pageSize={ROUND_WINNERS_PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
};

const GAME_PASSES_PAGE_SIZE = 50;
const GamePassesView: React.FC = () => {
  const [passes, setPasses] = useState<Array<{ wallet_address: string; purchased_at: string; tx_signature: string; is_active: boolean; payment_token: string | null; amount_usd: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [giftWallet, setGiftWallet] = useState('');
  const [gifting, setGifting] = useState(false);
  const [giftMsg, setGiftMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showGiftedOnly, setShowGiftedOnly] = useState(false);

  const fetchPasses = () => {
    setLoading(true);
    const from = page * GAME_PASSES_PAGE_SIZE;
    const to = from + GAME_PASSES_PAGE_SIZE - 1;
    supabase
      .from('game_passes')
      .select('wallet_address, purchased_at, tx_signature, is_active, payment_token, amount_usd', { count: 'exact' })
      .order('purchased_at', { ascending: false })
      .range(from, to)
      .then(({ data, count }) => {
        setPasses((data as typeof passes) ?? []);
        setTotalCount(count ?? 0);
        setLoading(false);
      });
  };

  useEffect(() => { fetchPasses(); }, [page]);

  const handleGiftPass = async () => {
    const wallet = giftWallet.trim();
    if (!wallet || wallet.length < 32 || wallet.length > 44) {
      setGiftMsg({ ok: false, text: 'Invalid wallet address' });
      return;
    }
    try { new PublicKey(wallet); } catch { setGiftMsg({ ok: false, text: 'Invalid Solana address' }); return; }
    setGifting(true);
    setGiftMsg(null);
    try {
      // Check if wallet already has an active pass
      const { data: existing } = await supabase.from('game_passes').select('wallet_address, is_active').eq('wallet_address', wallet).maybeSingle();
      if (existing?.is_active) {
        setGiftMsg({ ok: false, text: `Wallet ${wallet.slice(0, 8)}...${wallet.slice(-4)} already has an active Game Pass` });
        setGifting(false);
        return;
      }
      // Upsert game pass
      await supabase.from('game_passes').upsert({
        wallet_address: wallet,
        is_active: true,
        tx_signature: `ADMIN_GIFT_${Date.now()}`,
        purchased_at: new Date().toISOString(),
        gifted_by: 'admin',
        amount_usd: 0,
      }, { onConflict: 'wallet_address' });
      setGiftMsg({ ok: true, text: `Game Pass gifted to ${wallet.slice(0, 8)}...${wallet.slice(-4)}` });
      setGiftWallet('');
      fetchPasses();
    } catch (err: any) {
      setGiftMsg({ ok: false, text: err.message || 'Failed to gift game pass' });
    }
    setGifting(false);
  };

  if (loading && passes.length === 0) return <div className="py-12 text-center text-zinc-400">Loading game passes...</div>;

  const filteredPasses = showGiftedOnly ? passes.filter(p => p.tx_signature?.startsWith('ADMIN_GIFT')) : passes;

  return (
    <div className="py-6 space-y-8">
      {/* Gift Game Pass Section */}
      <div className="p-4 bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl">
        <h3 className="text-white font-black text-sm uppercase mb-3">Gift Game Pass (Giveaway)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-zinc-500 text-[10px] font-bold uppercase block mb-1">Wallet Address</label>
            <input
              type="text"
              value={giftWallet}
              onChange={(e) => setGiftWallet(e.target.value)}
              placeholder="Enter Solana wallet address"
              className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white text-sm font-mono"
            />
          </div>
          <button onClick={handleGiftPass} disabled={gifting} className="px-4 py-2 bg-[#9945FF] text-white text-xs font-black uppercase rounded hover:bg-[#9945FF]/80 disabled:opacity-50">
            {gifting ? 'Gifting...' : 'Gift Game Pass'}
          </button>
        </div>
        {giftMsg && <p className={`mt-2 text-sm ${giftMsg.ok ? 'text-[#14F195]' : 'text-red-400'}`}>{giftMsg.text}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-black text-white">Game Passes</h2>
            <p className="text-zinc-500 text-sm">{totalCount} total game pass purchases</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showGiftedOnly} onChange={(e) => setShowGiftedOnly(e.target.checked)} className="accent-[#9945FF]" />
            <span className="text-zinc-400 text-xs font-bold uppercase">Show gifted only</span>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Wallet</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Purchased</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Token</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">USD</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Active</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Tx</th>
              </tr>
            </thead>
            <tbody>
              {filteredPasses.map((p) => (
                <tr key={p.wallet_address} className="border-b border-white/5">
                  <td className="py-2 px-2 font-mono text-xs text-zinc-300">{p.wallet_address.slice(0, 8)}...{p.wallet_address.slice(-4)}</td>
                  <td className="py-2 px-2 text-zinc-400 text-xs">{new Date(p.purchased_at).toLocaleString()}</td>
                  <td className="py-2 px-2 text-white text-sm font-bold">{p.tx_signature?.startsWith('ADMIN_GIFT') ? <span className="text-yellow-400 font-bold">GIFT</span> : p.payment_token || 'SOL'}</td>
                  <td className="py-2 px-2 text-[#14F195] font-bold">{p.tx_signature?.startsWith('ADMIN_GIFT') ? <span className="text-yellow-400 font-bold">GIFT</span> : p.amount_usd != null ? `$${Number(p.amount_usd).toFixed(2)}` : '—'}</td>
                  <td className="py-2 px-2">{p.is_active ? <span className="text-[#14F195] font-bold text-xs">Active</span> : <span className="text-red-400 font-bold text-xs">Inactive</span>}</td>
                  <td className="py-2 px-2">{p.tx_signature?.startsWith('ADMIN_GIFT') ? <span className="text-yellow-400 text-xs font-bold">Admin Gift</span> : <a href={`https://solscan.io/tx/${p.tx_signature}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline">{p.tx_signature.slice(0, 8)}...</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredPasses.length === 0 && <p className="text-zinc-500 mt-4">{showGiftedOnly ? 'No gifted passes yet.' : 'No game passes purchased yet.'}</p>}
        <Pagination currentPage={page} totalCount={totalCount} pageSize={GAME_PASSES_PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
};

const LivesView: React.FC = () => {
  const [lives, setLives] = useState<Array<{ wallet_address: string; lives_count: number; total_purchased: number; total_used: number }>>([]);
  const [purchases, setPurchases] = useState<Array<{ wallet_address: string; lives_purchased: number; amount_lamports: number; created_at?: string; payment_token?: string | null; amount_usd?: number | null; tx_signature?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [giftWallet, setGiftWallet] = useState('');
  const [giftCount, setGiftCount] = useState(3);
  const [gifting, setGifting] = useState(false);
  const [giftMsg, setGiftMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showGiftedOnly, setShowGiftedOnly] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      supabase.from('player_lives').select('wallet_address, lives_count, total_purchased, total_used').order('total_purchased', { ascending: false }).limit(100),
      supabase.from('lives_purchases').select('wallet_address, lives_purchased, amount_lamports, created_at, payment_token, amount_usd, tx_signature').order('created_at', { ascending: false }).limit(100),
    ]).then(([lRes, pRes]) => {
      setLives((lRes.data as typeof lives) || []);
      setPurchases((pRes.data as typeof purchases) || []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const handleGiftLives = async () => {
    const wallet = giftWallet.trim();
    if (!wallet || wallet.length < 32 || wallet.length > 44) {
      setGiftMsg({ ok: false, text: 'Invalid wallet address' });
      return;
    }
    try { new PublicKey(wallet); } catch { setGiftMsg({ ok: false, text: 'Invalid Solana address' }); return; }
    setGifting(true);
    setGiftMsg(null);
    try {
      // Upsert player_lives: increment lives_count and total_purchased
      const { data: existing } = await supabase.from('player_lives').select('lives_count, total_purchased').eq('wallet_address', wallet).maybeSingle();
      if (existing) {
        await supabase.from('player_lives').update({
          lives_count: (existing.lives_count ?? 0) + giftCount,
          total_purchased: (existing.total_purchased ?? 0) + giftCount,
          updated_at: new Date().toISOString(),
        }).eq('wallet_address', wallet);
      } else {
        await supabase.from('player_lives').insert({
          wallet_address: wallet,
          lives_count: giftCount,
          total_purchased: giftCount,
          total_used: 0,
        });
      }
      // Insert purchase record for audit
      await supabase.from('lives_purchases').insert({
        wallet_address: wallet,
        lives_purchased: giftCount,
        amount_lamports: 0,
        tx_signature: `ADMIN_GIFT_${Date.now()}`,
        gifted_by: 'admin',
      });
      setGiftMsg({ ok: true, text: `Gifted ${giftCount} lives to ${wallet.slice(0, 8)}...${wallet.slice(-4)}` });
      setGiftWallet('');
      fetchData();
    } catch (err: any) {
      setGiftMsg({ ok: false, text: err.message || 'Failed to gift lives' });
    }
    setGifting(false);
  };

  if (loading) return <div className="py-12 text-center text-zinc-400">Loading lives...</div>;

  const filteredPurchases = showGiftedOnly ? purchases.filter(p => p.tx_signature?.startsWith('ADMIN_GIFT')) : purchases;

  return (
    <div className="py-6 space-y-8">
      {/* Gift Lives Section */}
      <div className="p-4 bg-gradient-to-r from-red-500/10 to-transparent border border-red-500/20 rounded-xl">
        <h3 className="text-white font-black text-sm uppercase mb-3">Gift Lives (Giveaway)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-zinc-500 text-[10px] font-bold uppercase block mb-1">Wallet Address</label>
            <input
              type="text"
              value={giftWallet}
              onChange={(e) => setGiftWallet(e.target.value)}
              placeholder="Enter Solana wallet address"
              className="w-full px-3 py-2 bg-black border border-white/20 rounded text-white text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-zinc-500 text-[10px] font-bold uppercase block mb-1">Lives</label>
            <select value={giftCount} onChange={(e) => setGiftCount(Number(e.target.value))} className="px-3 py-2 bg-black border border-white/20 rounded text-white text-sm">
              {[1, 3, 5, 10, 15, 35].map(n => <option key={n} value={n}>{n} lives</option>)}
            </select>
          </div>
          <button onClick={handleGiftLives} disabled={gifting} className="px-4 py-2 bg-[#14F195] text-black text-xs font-black uppercase rounded hover:bg-[#14F195]/80 disabled:opacity-50">
            {gifting ? 'Gifting...' : 'Gift Lives'}
          </button>
        </div>
        {giftMsg && <p className={`mt-2 text-sm ${giftMsg.ok ? 'text-[#14F195]' : 'text-red-400'}`}>{giftMsg.text}</p>}
      </div>

      <div>
        <h2 className="text-xl font-black text-white mb-4">Player Lives (current balance)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Wallet</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Lives</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Total purchased</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Total used</th>
              </tr>
            </thead>
            <tbody>
              {lives.map((r) => (
                <tr key={r.wallet_address} className="border-b border-white/5">
                  <td className="py-2 px-2 font-mono text-xs text-zinc-300">{r.wallet_address.slice(0, 8)}...{r.wallet_address.slice(-4)}</td>
                  <td className="py-2 px-2 text-[#14F195] font-bold">{r.lives_count ?? 0}</td>
                  <td className="py-2 px-2 text-zinc-400">{r.total_purchased ?? 0}</td>
                  <td className="py-2 px-2 text-zinc-400">{r.total_used ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {lives.length === 0 && <p className="text-zinc-500 mt-4">No player_lives rows yet.</p>}
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-white">Recent Lives Purchases</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showGiftedOnly} onChange={(e) => setShowGiftedOnly(e.target.checked)} className="accent-[#14F195]" />
            <span className="text-zinc-400 text-xs font-bold uppercase">Show gifted only</span>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Wallet</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Lives</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Token</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Amount</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((p, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2 px-2 font-mono text-xs text-zinc-300">{p.wallet_address.slice(0, 8)}...{p.wallet_address.slice(-4)}</td>
                  <td className="py-2 px-2 text-[#14F195]">{p.lives_purchased ?? 0}</td>
                  <td className="py-2 px-2 text-white text-sm font-bold">{p.payment_token || 'SOL'}</td>
                  <td className="py-2 px-2 text-[#14F195]">{p.tx_signature?.startsWith('ADMIN_GIFT') ? <span className="text-yellow-400 font-bold">GIFT</span> : p.amount_usd != null ? `$${Number(p.amount_usd).toFixed(2)}` : `${(p.amount_lamports / 1_000_000_000).toFixed(4)} SOL`}</td>
                  <td className="py-2 px-2 text-zinc-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {purchases.length === 0 && <p className="text-zinc-500 mt-4">No purchases yet.</p>}
      </div>
    </div>
  );
};

// Stats Overview Tab
const StatsView: React.FC<{ stats: any; loading: boolean }> = ({ stats, loading }) => {
  if (loading) {
    return <div className="text-center py-20">Loading stats...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-black mb-6">Platform Overview</h2>
      
      {/* Wallet Balances - Featured */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs uppercase font-black">💰 Prize Pool Wallet</p>
            <button
              onClick={() => window.open(`https://solscan.io/account/${PRIZE_POOL_WALLET}`, '_blank')}
              className="text-xs text-blue-400 hover:underline"
            >
              View on Solscan →
            </button>
          </div>
          <p className="text-4xl font-[1000] italic text-green-400 mb-2">
            {stats.prizePoolWalletBalance.toFixed(4)} SOL
          </p>
          <p className="text-xs text-zinc-500 font-mono">{PRIZE_POOL_WALLET.slice(0, 12)}...{PRIZE_POOL_WALLET.slice(-8)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-zinc-400 text-xs uppercase font-black">💵 Revenue Wallet</p>
            <button
              onClick={() => window.open(`https://solscan.io/account/${REVENUE_WALLET}`, '_blank')}
              className="text-xs text-blue-400 hover:underline"
            >
              View on Solscan →
            </button>
          </div>
          <p className="text-4xl font-[1000] italic text-purple-400 mb-2">
            {stats.revenueWalletBalance.toFixed(4)} SOL
          </p>
          <p className="text-xs text-zinc-500 font-mono">{REVENUE_WALLET.slice(0, 12)}...{REVENUE_WALLET.slice(-8)}</p>
        </div>
      </div>

      {/* Player & Engagement */}
      <h3 className="text-xl font-black mb-4 text-zinc-400">Players & Engagement</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Players" value={stats.totalPlayers} color="green" />
        <StatCard label="Active (24h)" value={stats.activePlayers24h} color="yellow" />
        <StatCard label="Unique Wallets (7d)" value={stats.uniqueWalletsWeek} color="blue" />
        <StatCard label="Referrals Completed" value={stats.totalReferrals} color="purple" />
      </div>

      {/* Games & Content */}
      <h3 className="text-xl font-black mb-4 text-zinc-400">Games & Content</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Paid Games" value={stats.totalGames} color="purple" />
        <StatCard label="Rounds Completed" value={stats.totalRoundsCompleted} color="blue" />
        <StatCard label="Total Questions" value={stats.totalQuestions} color="blue" />
        <StatCard label="Quests Completed" value={stats.totalQuestsCompleted} color="yellow" />
      </div>

      {/* Custom Games & Passes */}
      <h3 className="text-xl font-black mb-4 text-zinc-400">Custom Games & Passes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Custom Games Created" value={stats.totalCustomGames} color="purple" />
        <StatCard label="Custom Games Played" value={stats.totalCustomGamePlays} color="blue" />
        <StatCard label="Game Passes Sold" value={stats.totalGamePasses} color="green" />
      </div>

      {/* Revenue */}
      <h3 className="text-xl font-black mb-4 text-zinc-400">Revenue & Payouts</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Lives Purchased" value={stats.totalLivesPurchased} color="red" />
        <StatCard label="Lives Revenue" value={`${stats.totalRevenueSol.toFixed(3)} SOL`} color="green" />
        <StatCard label="Total Paid to Winners" value={`${stats.totalPaidOutSol.toFixed(4)} SOL`} color="green" />
      </div>

      {/* On-Chain Program Setup */}
      <h3 className="text-xl font-black mb-4 text-zinc-400">On-Chain Contract</h3>
      <InitializeMainnetCard />
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; color: string }> = ({
  label,
  value,
  color,
}) => {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    green: 'from-green-500/20 to-green-500/5 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
    red: 'from-red-500/20 to-red-500/5 border-red-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} border p-6 rounded-xl`}>
      <p className="text-zinc-400 text-xs uppercase font-black mb-2">{label}</p>
      <p className="text-3xl font-[1000] italic">{value}</p>
    </div>
  );
};

// ─── Initialize Mainnet Card (one-time setup) ────────────────────────────────
const MAINNET_RPC = (() => {
  const helius = import.meta.env.VITE_HELIUS_API_KEY;
  if (helius) return `https://mainnet.helius-rpc.com/?api-key=${helius}`;
  const alchemy = import.meta.env.VITE_ALCHEMY_API_KEY;
  if (alchemy) return `https://solana-mainnet.g.alchemy.com/v2/${alchemy}`;
  return 'https://rpc.ankr.com/solana';
})();
const OPERATOR = new PublicKey(OPERATOR_WALLET);
const REVENUE = new PublicKey(REVENUE_WALLET);
const OWNER_WALLET = '8qHMpkPLfj4neP7MYm74Xos26jPE55bMUUBTJBQRYuBF';

const InitializeMainnetCard: React.FC = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [status, setStatus] = useState<'idle' | 'checking' | 'ready' | 'sending' | 'done' | 'already' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [sig, setSig] = useState('');

  const checkConfig = async () => {
    setStatus('checking');
    setMessage('Checking if program is already initialized on mainnet...');
    try {
      const conn = new Connection(MAINNET_RPC, 'confirmed');
      const config = await fetchGameConfig(conn, SOLTRIVIA_PROGRAM_ID);
      if (config) {
        setStatus('already');
        setMessage(`Program already initialized. Owner: ${config.owner.slice(0, 8)}... Operator: ${config.operator.slice(0, 8)}...`);
      } else {
        setStatus('ready');
        setMessage('Program deployed but NOT initialized. Connect wallet 8qHMpk... and click Initialize.');
      }
    } catch (err: any) {
      setStatus('ready');
      setMessage('Could not check config (may not exist yet). Ready to initialize.');
    }
  };

  useEffect(() => { checkConfig(); }, []);

  const handleInitialize = async () => {
    if (!publicKey || !sendTransaction) {
      setMessage('Connect your wallet first using the button above.');
      return;
    }

    if (publicKey.toBase58() !== OWNER_WALLET) {
      setMessage(`Wrong wallet. Expected: ${OWNER_WALLET.slice(0, 8)}... but got ${publicKey.toBase58().slice(0, 8)}... Switch wallet in Phantom.`);
      setStatus('error');
      return;
    }

    setStatus('sending');
    setMessage('Building transaction... Confirm in Phantom when prompted.');

    try {
      const conn = new Connection(MAINNET_RPC, 'confirmed');
      const ix = buildInitializeIx(publicKey, OPERATOR, REVENUE, REVENUE);

      const { blockhash } = await getRecentBlockhashWithRetry(conn);
      const msg = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(msg);

      const signature = await sendTransaction(tx, conn);
      await conn.confirmTransaction(signature, 'confirmed');

      setSig(signature);
      setStatus('done');
      setMessage('Program initialized successfully on mainnet!');
    } catch (err: any) {
      setStatus('error');
      setMessage(`Initialize failed: ${err.message || String(err)}`);
    }
  };

  const statusColor = {
    idle: 'border-zinc-500/30',
    checking: 'border-yellow-500/30',
    ready: 'border-orange-500/30',
    sending: 'border-yellow-500/30',
    done: 'border-green-500/30',
    already: 'border-green-500/30',
    error: 'border-red-500/30',
  }[status];

  return (
    <div className={`border ${statusColor} bg-gradient-to-br from-white/5 to-transparent p-6 rounded-xl`}>
      <h3 className="text-lg font-black mb-3">Mainnet Program Setup</h3>
      <div className="text-xs text-zinc-400 space-y-1 mb-4">
        <p>Program: <span className="font-mono text-zinc-300">{SOLTRIVIA_PROGRAM_ID.toBase58().slice(0, 16)}...</span></p>
        <p>Owner: <span className="font-mono text-zinc-300">{OWNER_WALLET.slice(0, 8)}... (transfer to Ledger later)</span></p>
        <p>Operator: <span className="font-mono text-zinc-300">{OPERATOR_WALLET.slice(0, 8)}...</span></p>
        <p>Revenue: <span className="font-mono text-zinc-300">{REVENUE_WALLET.slice(0, 8)}...</span></p>
        <p>Sweep: <span className="font-mono text-zinc-300">{REVENUE_WALLET.slice(0, 8)}... (same as revenue)</span></p>
      </div>

      {message && (
        <p className={`text-sm mb-4 ${status === 'error' ? 'text-red-400' : status === 'done' || status === 'already' ? 'text-green-400' : 'text-yellow-400'}`}>
          {message}
        </p>
      )}

      {sig && (
        <p className="text-xs mb-4">
          <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            View transaction on Solscan
          </a>
        </p>
      )}

      {(status === 'ready' || status === 'error') && (
        <div className="space-y-3">
          {!connected && (
            <div className="flex items-center gap-3">
              <WalletMultiButton />
              <span className="text-xs text-zinc-500">Connect your Ledger wallet</span>
            </div>
          )}
          {connected && (
            <button
              onClick={handleInitialize}
              className="w-full py-3 px-4 rounded-lg font-black text-sm uppercase bg-[#14F195] text-black hover:bg-[#0dd884] transition-all"
            >
              Initialize Program on Mainnet
            </button>
          )}
        </div>
      )}

      {status === 'sending' && (
        <div className="flex items-center gap-2 text-yellow-400 text-sm">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Waiting for Ledger confirmation...
        </div>
      )}
    </div>
  );
};

interface AdminQuest {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  reward_tp: number;
  reward_label: string | null;
  requirement_type: string;
  requirement_config: { max?: number; link?: string };
  sort_order: number;
  quest_type: string;
  is_active: boolean;
  completion_count?: number;
}

interface QuestSubmission {
  id: string;
  wallet_address: string;
  quest_id: string;
  proof_url: string;
  status: string;
  created_at: string;
  quest?: { id: string; slug: string; title: string };
}

const CATEGORY_OPTIONS = ['Priority Mission', 'Social Operations', 'Active Operations'];
const QUEST_TYPES = ['STANDARD', 'ELITE', 'SOCIAL'];

const QuestsManagementView: React.FC = () => {
  const [quests, setQuests] = useState<AdminQuest[]>([]);
  const [submissions, setSubmissions] = useState<QuestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<AdminQuest | null>(null);
  const [newQuest, setNewQuest] = useState({
    slug: '',
    title: '',
    description: '',
    category: 'Active Operations',
    reward_tp: 250,
    reward_label: '250 TP',
    requirement_type: 'manual',
    requirement_config: { max: 1, link: '' as string },
    sort_order: 0,
    quest_type: 'STANDARD' as string,
    is_active: true,
    link: '', // Link URL for SOCIAL quests (stored in requirement_config.link)
  });

  const fetchQuests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manage-quests`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ action: 'list', payload: {} }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load quests');
      setQuests((json.data || []) as AdminQuest[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load quests');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manage-quests`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ action: 'list_submissions', payload: { status: 'pending' } }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setSubmissions((json.data || []) as QuestSubmission[]);
    } catch {
      // ignore
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
    fetchSubmissions();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-quests-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, () => fetchQuests())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quest_submissions' }, () => fetchSubmissions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_quest_progress' }, () => fetchQuests())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const callManage = async (action: string, payload?: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manage-quests`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ action, payload: payload ?? {} }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  };

  const handleUpdate = async (quest: AdminQuest) => {
    setError('');
    setSuccess('');
    try {
      await callManage('update', {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        category: quest.category,
        reward_tp: quest.reward_tp,
        reward_label: quest.reward_label,
        requirement_type: quest.requirement_type,
        requirement_config: quest.requirement_config,
        sort_order: quest.sort_order,
        quest_type: quest.quest_type,
        is_active: quest.is_active,
      });
      setSuccess('Quest updated');
      fetchQuests();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleTogglePause = async (quest: AdminQuest) => {
    setError('');
    setSuccess('');
    try {
      await callManage('update', { id: quest.id, is_active: !quest.is_active });
      setSuccess(quest.is_active ? 'Quest paused' : 'Quest resumed');
      setQuests((prev) => prev.map((x) => x.id === quest.id ? { ...x, is_active: !x.is_active } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleDelete = async (quest: AdminQuest) => {
    if (!confirm(`Delete "${quest.title}"? This cannot be undone.`)) return;
    setError('');
    setSuccess('');
    try {
      await callManage('delete', { id: quest.id });
      setSuccess('Quest deleted');
      setQuests((prev) => prev.filter((x) => x.id !== quest.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleCreate = async () => {
    if (!newQuest.slug.trim() || !newQuest.title.trim()) {
      setError('Slug and title required');
      return;
    }
    setError('');
    setSuccess('');
    try {
      const requirementConfig: { max: number; link?: string } = {
        max: newQuest.requirement_config?.max ?? 1,
        ...(newQuest.quest_type === 'SOCIAL' && newQuest.link?.trim() ? { link: newQuest.link.trim() } : {}),
      };
      await callManage('create', {
        slug: newQuest.slug.trim().toLowerCase().replace(/\s+/g, '_'),
        title: newQuest.title.trim(),
        description: newQuest.description.trim(),
        category: newQuest.category,
        reward_tp: newQuest.reward_tp,
        reward_label: newQuest.reward_label || `${newQuest.reward_tp} TP`,
        requirement_type: newQuest.requirement_type,
        requirement_config: requirementConfig,
        sort_order: newQuest.sort_order,
        quest_type: newQuest.quest_type,
        is_active: newQuest.is_active,
      });
      setSuccess('Quest created');
      setShowAddForm(false);
      setNewQuest({ slug: '', title: '', description: '', category: 'Active Operations', reward_tp: 250, reward_label: '250 TP', requirement_type: 'manual', requirement_config: { max: 1, link: '' }, sort_order: 0, quest_type: 'STANDARD', is_active: true, link: '' });
      fetchQuests();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const handleReviewSubmission = async (submissionId: string, decision: 'approve' | 'reject') => {
    setError('');
    setSuccess('');
    try {
      await callManage('review_submission', { submissionId, decision, reviewedBy: 'admin' });
      setSuccess(decision === 'approve' ? 'Approved — user rewarded' : 'Rejected');
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
    }
  };

  if (loading) return <div className="text-center py-20 text-zinc-400">Loading quests...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white">Quest management</h2>
          <p className="text-zinc-500 text-sm mt-1">Edit quests, track completions, and review proof submissions. Paused quests are hidden from players.</p>
        </div>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setError(''); }}
          className="px-4 py-2 bg-[#14F195] text-black font-black text-xs uppercase rounded hover:opacity-90"
        >
          {showAddForm ? 'Cancel' : '+ Add quest'}
        </button>
      </div>

      {error && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
      {success && <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">{success}</div>}

      {/* Add new quest (collapsible) */}
      {showAddForm && (
        <section className="p-6 bg-white/5 border border-white/10 rounded-xl">
          <h3 className="text-lg font-black text-[#14F195] mb-4">Add new quest</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Slug</label>
              <input className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" placeholder="e.g. my_quest" value={newQuest.slug} onChange={(e) => setNewQuest((q) => ({ ...q, slug: e.target.value }))} />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Title</label>
              <input className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" placeholder="Quest title" value={newQuest.title} onChange={(e) => setNewQuest((q) => ({ ...q, title: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Description</label>
              <textarea className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" placeholder="What the player must do" value={newQuest.description} onChange={(e) => setNewQuest((q) => ({ ...q, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Category</label>
              <select className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={newQuest.category} onChange={(e) => setNewQuest((q) => ({ ...q, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Type</label>
              <select className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={newQuest.quest_type} onChange={(e) => setNewQuest((q) => ({ ...q, quest_type: e.target.value }))}>
                {QUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {newQuest.quest_type === 'SOCIAL' && (
              <div className="md:col-span-2">
                <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Link URL (e.g. tweet, Discord)</label>
                <input className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" placeholder="https://x.com/..." value={newQuest.link} onChange={(e) => setNewQuest((q) => ({ ...q, link: e.target.value }))} />
                <p className="text-zinc-500 text-xs mt-1">Players open this link when they tap the quest action. Required for social quests.</p>
              </div>
            )}
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Reward (TP)</label>
              <input type="number" className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={newQuest.reward_tp} onChange={(e) => setNewQuest((q) => ({ ...q, reward_tp: parseInt(e.target.value, 10) || 0, reward_label: `${parseInt(e.target.value, 10) || 0} TP` }))} />
            </div>
            <div>
              <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Sort order</label>
              <input type="number" className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={newQuest.sort_order} onChange={(e) => setNewQuest((q) => ({ ...q, sort_order: parseInt(e.target.value, 10) || 0 }))} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={newQuest.is_active} onChange={(e) => setNewQuest((q) => ({ ...q, is_active: e.target.checked }))} className="rounded" />
                Active (visible to players)
              </label>
            </div>
          </div>
          <button onClick={handleCreate} className="mt-4 px-4 py-2 bg-[#14F195] text-black font-black text-xs uppercase rounded hover:opacity-90">Create quest</button>
        </section>
      )}

      {/* Quest list with completion counts */}
      <section>
        <h3 className="text-lg font-black text-white mb-3">All quests ({quests.length})</h3>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="py-3 px-4 text-zinc-400 text-xs font-bold uppercase tracking-wider">Title</th>
                <th className="py-3 px-4 text-zinc-400 text-xs font-bold uppercase tracking-wider">Slug</th>
                <th className="py-3 px-4 text-zinc-400 text-xs font-bold uppercase tracking-wider">Category</th>
                <th className="py-3 px-4 text-zinc-400 text-xs font-bold uppercase tracking-wider">Reward</th>
                <th className="py-3 px-4 text-zinc-400 text-xs font-bold uppercase tracking-wider text-center">Completed</th>
                <th className="py-3 px-4 text-zinc-400 text-xs font-bold uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-zinc-400 text-xs font-bold uppercase tracking-wider w-20">Sort</th>
                <th className="py-3 px-4 text-zinc-400 text-xs font-bold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quests.map((q) => (
                <tr key={q.id} className={`border-b border-white/5 hover:bg-white/5 ${!q.is_active ? 'opacity-70' : ''}`}>
                  <td className="py-3 px-4">
                    <span className="font-bold text-white">{q.title}</span>
                    {q.description && <p className="text-zinc-500 text-xs mt-0.5 line-clamp-1">{q.description}</p>}
                  </td>
                  <td className="py-3 px-4 font-mono text-zinc-500 text-xs">{q.slug}</td>
                  <td className="py-3 px-4 text-zinc-400 text-sm">{q.category}</td>
                  <td className="py-3 px-4 text-[#14F195] font-medium">{q.reward_label || `${q.reward_tp} TP`}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded bg-[#14F195]/10 text-[#14F195] font-bold text-sm">
                      {q.completion_count ?? 0}
                    </span>
                    <span className="text-zinc-500 text-xs block mt-0.5">users</span>
                  </td>
                  <td className="py-3 px-4">
                    {q.is_active ? (
                      <span className="text-[#14F195] text-xs font-bold uppercase">Active</span>
                    ) : (
                      <span className="text-amber-400 text-xs font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20">Paused</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <input
                      className="w-14 bg-black/40 border border-white/10 px-2 py-1 rounded text-sm text-white"
                      type="number"
                      value={q.sort_order}
                      onChange={(e) => setQuests((prev) => prev.map((x) => x.id === q.id ? { ...x, sort_order: parseInt(e.target.value, 10) || 0 } : x))}
                    />
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button onClick={() => setEditingQuest({ ...q, requirement_config: { ...q.requirement_config } })} className="px-2 py-1 text-xs font-bold uppercase rounded bg-white/10 text-white hover:bg-white/20">Edit</button>
                    <select
                      className="bg-black/40 border border-white/10 px-2 py-1 rounded text-xs text-white"
                      value={q.category}
                      onChange={(e) => setQuests((prev) => prev.map((x) => x.id === q.id ? { ...x, category: e.target.value } : x))}
                    >
                      {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => handleTogglePause(q)} className="px-2 py-1 text-xs font-bold uppercase rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
                      {q.is_active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => handleUpdate(quests.find((x) => x.id === q.id)!)} className="px-3 py-1 text-xs font-bold uppercase rounded bg-[#14F195] text-black hover:opacity-90">Save</button>
                    <button onClick={() => handleDelete(q)} className="px-2 py-1 text-xs font-bold uppercase rounded bg-red-500/20 text-red-400 hover:bg-red-500/30">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit quest modal */}
      {editingQuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setEditingQuest(null)}>
          <div className="bg-[#0D0D0D] border border-white/20 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-black text-[#14F195] mb-4">Edit quest: {editingQuest.title}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Title</label>
                  <input className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={editingQuest.title} onChange={(e) => setEditingQuest((p) => p ? { ...p, title: e.target.value } : null)} />
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Description</label>
                  <textarea className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" rows={2} value={editingQuest.description} onChange={(e) => setEditingQuest((p) => p ? { ...p, description: e.target.value } : null)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Category</label>
                    <select className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={editingQuest.category} onChange={(e) => setEditingQuest((p) => p ? { ...p, category: e.target.value } : null)}>
                      {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Reward (TP)</label>
                    <input type="number" className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={editingQuest.reward_tp} onChange={(e) => setEditingQuest((p) => p ? { ...p, reward_tp: parseInt(e.target.value, 10) || 0, reward_label: `${parseInt(e.target.value, 10) || 0} TP` } : null)} />
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Reward label (e.g. &quot;2,500 TP&quot;)</label>
                  <input className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={editingQuest.reward_label || ''} onChange={(e) => setEditingQuest((p) => p ? { ...p, reward_label: e.target.value || null } : null)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Requirement type</label>
                    <input className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={editingQuest.requirement_type} onChange={(e) => setEditingQuest((p) => p ? { ...p, requirement_type: e.target.value } : null)} />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Max (completion threshold)</label>
                    <input type="number" className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" value={editingQuest.requirement_config?.max ?? 1} onChange={(e) => setEditingQuest((p) => p ? { ...p, requirement_config: { ...p.requirement_config, max: parseInt(e.target.value, 10) || 1 } } : null)} />
                  </div>
                </div>
                {editingQuest.quest_type === 'SOCIAL' && (
                  <div>
                    <label className="block text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Link URL (tweet, Discord, etc.)</label>
                    <input className="w-full bg-black/40 border border-white/10 px-3 py-2 rounded text-sm text-white" placeholder="https://x.com/..." value={editingQuest.requirement_config?.link ?? ''} onChange={(e) => setEditingQuest((p) => p ? { ...p, requirement_config: { ...p.requirement_config, link: e.target.value.trim() || undefined } } : null)} />
                    <p className="text-zinc-500 text-xs mt-1">Players open this link when they tap the quest. Edit TRUE RAIDER’s tweet link here.</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setEditingQuest(null)} className="px-4 py-2 border border-white/20 text-white text-sm font-bold rounded hover:bg-white/10">Cancel</button>
                <button onClick={() => { if (editingQuest) { handleUpdate(editingQuest); setEditingQuest(null); } }} className="px-4 py-2 bg-[#14F195] text-black font-black text-sm rounded hover:opacity-90">Save changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending submissions (manual-review quests only; TRUE RAIDER is auto-approved) */}
      <section className="pt-6 border-t border-white/10">
        <h3 className="text-lg font-black text-white mb-1">Pending proof submissions</h3>
        <p className="text-zinc-500 text-sm mb-4">Quests that require manual review (e.g. custom proof quests). TRUE RAIDER is auto-approved when users submit, so it won’t appear here.</p>
        {submissionsLoading ? (
          <p className="text-zinc-500 text-sm">Loading...</p>
        ) : submissions.length === 0 ? (
          <p className="text-zinc-500 text-sm">No pending submissions.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm text-[#14F195]">{s.wallet_address.slice(0, 8)}…{s.wallet_address.slice(-6)}</p>
                  <p className="text-zinc-500 text-xs mt-1">{(s.quest as { title?: string })?.title || s.quest_id}</p>
                  <a href={s.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline break-all">Proof: {s.proof_url}</a>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleReviewSubmission(s.id, 'approve')} className="px-4 py-2 bg-[#14F195] text-black font-black text-xs uppercase rounded hover:opacity-90">Approve</button>
                  <button onClick={() => handleReviewSubmission(s.id, 'reject')} className="px-4 py-2 bg-red-500/20 text-red-400 font-black text-xs uppercase rounded hover:bg-red-500/30">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// Answer debug tab: pick a question from the list, click an option — see if DB correct_index matches (no session ID needed)
interface AnswerDebugViewProps {
  functionsUrl: string;
}

const AnswerDebugView: React.FC<AnswerDebugViewProps> = ({ functionsUrl }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastClick, setLastClick] = useState<{ selectedIndex: number; correctIndex: number; match: boolean } | null>(null);

  const loadQuestions = async () => {
    setLoading(true);
    setError('');
    setQuestions([]);
    setSelectedId('');
    setLastClick(null);
    try {
      const res = await fetch(`${functionsUrl}/manage-questions`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ action: 'list', payload: { limit: 100 } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      const list = (json.data || []) as Question[];
      setQuestions(list);
      if (list.length > 0) setSelectedId(String((list[0] as Question).id ?? ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const question = questions.find((q) => String(q.id) === selectedId);
  const options = question
    ? Array.isArray(question.options)
      ? question.options
      : typeof question.options === 'string'
        ? (() => {
            try {
              return JSON.parse(question.options);
            } catch {
              return [];
            }
          })()
        : []
    : [];

  const handleOptionClick = (selectedIndex: number) => {
    if (!question) return;
    const correctIndex = Number(question.correct_index);
    const match = selectedIndex === correctIndex;
    setLastClick({ selectedIndex, correctIndex, match });
  };

  return (
    <div>
      <h2 className="text-2xl font-black mb-4">Answer debug</h2>
      <p className="text-zinc-500 text-sm mb-6">
        Load your questions, pick one, then click an option (A/B/C/D). The panel shows what the DB has as <code className="bg-white/10 px-1 rounded">correct_index</code> and whether your click would count as correct. No game or session needed.
      </p>
      <button
        onClick={loadQuestions}
        disabled={loading}
        className="mb-6 px-6 py-2 bg-[#14F195] text-black font-black uppercase text-sm rounded-lg disabled:opacity-50"
      >
        {loading ? 'Loading…' : 'Load questions'}
      </button>
      {error && <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
      {questions.length > 0 && (
        <div className="mb-6">
          <label className="block text-xs font-black uppercase text-zinc-500 mb-2">Pick a question</label>
          <select
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setLastClick(null); }}
            className="w-full max-w-xl px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
          >
            {questions.map((q) => (
              <option key={q.id} value={String(q.id)}>
                {(q.text || '').slice(0, 80)}{(q.text?.length ?? 0) > 80 ? '…' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {question && options.length > 0 && (
        <div className="mb-8">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-4">
            <p className="text-white font-medium mb-2">{question.text}</p>
            <p className="text-zinc-500 text-xs mb-3">In DB: correct_index = {Number(question.correct_index)} ({OPTION_LABELS[Number(question.correct_index)] ?? '?'}) — click an option:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(idx)}
                  className="p-4 text-left border border-white/10 rounded-lg hover:border-[#14F195]/50 hover:bg-white/5 flex items-center gap-3"
                >
                  <span className="w-8 h-8 flex items-center justify-center border border-white/20 rounded font-black text-sm">{OPTION_LABELS[idx] ?? idx}</span>
                  <span>{opt}</span>
                </button>
              ))}
            </div>
          </div>
          {lastClick != null && (
            <div className="p-4 rounded-xl border border-white/20 bg-white/5">
              <p className="text-zinc-400 text-sm">
                You clicked index <strong className="text-white">{lastClick.selectedIndex}</strong> ({OPTION_LABELS[lastClick.selectedIndex]}).
                DB <code className="bg-white/10 px-1 rounded">correct_index</code> = <strong className="text-white">{lastClick.correctIndex}</strong> ({OPTION_LABELS[lastClick.correctIndex]}).
                Would mark as correct: <strong className={lastClick.match ? 'text-[#14F195]' : 'text-red-400'}>{lastClick.match ? 'YES' : 'NO'}</strong>
                {!lastClick.match && (
                  <span className="block mt-2 text-amber-400/90 text-xs">Fix this question in the Questions tab: set correct_index to the index of the right answer (0=A, 1=B, 2=C, 3=D).</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Questions Management Tab (uses manage-questions Edge Function so admin can bypass RLS; no extra auth — dashboard is already behind login)
interface QuestionsViewProps {
  functionsUrl: string;
}

const QuestionsView: React.FC<QuestionsViewProps> = ({ functionsUrl }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [questionSearch, setQuestionSearch] = useState('');

  const [formData, setFormData] = useState<Question>({
    category: 'solana',
    text: '',
    options: ['', '', '', ''],
    correct_index: 0,
    difficulty: 1,
    active: true,
  });

  const categories = ['solana', 'defi', 'nfts', 'bitcoin', 'memecoins', 'history'];

  const callManageQuestions = async (action: string, payload?: Record<string, unknown>) => {
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 20) {
      throw new Error('Missing Supabase anon key. Add VITE_SUPABASE_ANON_KEY to your .env (and .env.local if used) so the Questions tab can call manage-questions.');
    }
    const res = await fetch(`${functionsUrl}/manage-questions`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ action, payload: payload ?? {} }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = json.error || `Request failed (${res.status})`;
      const error = new Error(errorMsg);
      (error as any).code = json.code;
      (error as any).details = json.details;
      throw error;
    }
    return json;
  };

  const fetchQuestions = async (search?: string) => {
    setLoading(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { limit: 500 };
      if (search && search.trim()) payload.search = search.trim();
      const json = await callManageQuestions('list', payload);
      const data = (json.data || []) as Question[];
      setQuestions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [functionsUrl]);

  // Debounced server-side search when user types in the search box
  useEffect(() => {
    const t = setTimeout(() => fetchQuestions(questionSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [questionSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (formData.options.some(opt => !opt.trim())) {
        throw new Error('All options must be filled');
      }

      const optionsJsonb = JSON.stringify(formData.options);
      const row = {
        category: formData.category,
        text: formData.text,
        options: optionsJsonb,
        correct_index: formData.correct_index,
        difficulty: formData.difficulty,
        active: formData.active,
      };

      if (editingQuestion?.id) {
        await callManageQuestions('update', { id: editingQuestion.id, ...row });
        setSuccess('Question updated successfully!');
      } else {
        await callManageQuestions('create', row);
        setSuccess('Question added successfully!');
      }

      setFormData({
        category: 'solana',
        text: '',
        options: ['', '', '', ''],
        correct_index: 0,
        difficulty: 1,
        active: true,
      });
      setEditingQuestion(null);
      setShowForm(false);
      fetchQuestions();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save question';
      const details = err.details ? ` Details: ${err.details}` : '';
      const code = err.code ? ` (${err.code})` : '';
      setError(`${errorMsg}${code}${details}`);
      console.error('Save question error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      category: question.category,
      text: question.text,
      options: Array.isArray(question.options) ? question.options : (typeof question.options === 'string' ? JSON.parse(question.options) : ['', '', '', '']),
      correct_index: question.correct_index,
      difficulty: question.difficulty,
      active: question.active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      await callManageQuestions('delete', { id });
      setSuccess('Question deleted successfully!');
      fetchQuestions();
    } catch (err: any) {
      setError(err.message || 'Failed to delete question');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await callManageQuestions('set_active', { id, active: !currentActive });
      setSuccess(`Question ${!currentActive ? 'activated' : 'deactivated'} successfully!`);
      fetchQuestions();
    } catch (err: any) {
      setError(err.message || 'Failed to update question');
    }
  };

  const questionsTitle = questionSearch.trim()
    ? 'Questions Search — ' + questions.length + ' results'
    : 'Questions Management (' + questions.length + ')';

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-2xl font-black">
          {questionsTitle}
        </h2>
        <div className="flex items-center gap-3">
          <label className="sr-only" htmlFor="questions-search">Search questions</label>
          <input
            id="questions-search"
            type="search"
            placeholder="Search by question text or category..."
            value={questionSearch}
            onChange={(e) => {
              setQuestionSearch(e.target.value);
              if (!e.target.value.trim()) fetchQuestions();
            }}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-500 w-72 max-w-full text-sm focus:border-[#14F195]/50 focus:ring-1 focus:ring-[#14F195]/30"
          />
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingQuestion(null);
              setFormData({
                category: 'solana',
                text: '',
                options: ['', '', '', ''],
                correct_index: 0,
                difficulty: 1,
                active: true,
              });
            }}
            className="px-6 py-3 bg-[#14F195] text-black font-black uppercase text-sm rounded-lg hover:bg-[#14F195]/90"
          >
            {showForm ? 'Cancel' : '+ Add Question'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-6 p-6 bg-black/40 border border-white/10 rounded-xl">
          <h3 className="text-xl font-black mb-4">
            {editingQuestion ? 'Edit Question' : 'Add New Question'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-black uppercase text-zinc-400 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-black uppercase text-zinc-400 mb-2">
                  Difficulty
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white"
                >
                  <option value={1}>Easy</option>
                  <option value={2}>Medium</option>
                  <option value={3}>Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-black uppercase text-zinc-400 mb-2">
                Question Text
              </label>
              <textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formData.options.map((option, idx) => (
                <div key={idx}>
                  <label className="block text-sm font-black uppercase text-zinc-400 mb-2">
                    Option {String.fromCharCode(65 + idx)}
                  </label>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...formData.options];
                      newOptions[idx] = e.target.value;
                      setFormData({ ...formData, options: newOptions });
                    }}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white"
                    required
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-black uppercase text-zinc-400 mb-2">
                Correct Answer
              </label>
              <select
                value={formData.correct_index}
                onChange={(e) => setFormData({ ...formData, correct_index: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white"
              >
                {formData.options.map((_, idx) => (
                  <option key={idx} value={idx}>
                    Option {String.fromCharCode(65 + idx)} - {formData.options[idx] || '(empty)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-5 h-5"
              />
              <label className="text-sm font-black uppercase text-zinc-400">Active</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#14F195] text-black font-black uppercase rounded-lg hover:bg-[#14F195]/90 disabled:opacity-50"
            >
              {loading ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
            </button>
          </form>
        </div>
      )}

      {/* Questions List */}
      {loading && !showForm ? (
        <div className="text-center py-10">Loading questions...</div>
      ) : (
        <div className="space-y-3">
          {questions.length === 0 && (
            <p className="text-zinc-500 text-center py-6">
              {questions.length === 0 ? 'No questions yet.' : 'No questions match your search.'}
            </p>
          )}
          {questions.map((q) => {
            const options = Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? JSON.parse(q.options) : []);
            const rowClass = q.active ? 'p-4 border rounded-lg bg-black/20 border-white/10' : 'p-4 border rounded-lg bg-zinc-900/20 border-zinc-700/30';
            return (
              <div key={q.id} className={rowClass}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span
                      className={q.active ? 'text-xs px-2 py-1 rounded bg-green-500/20 text-green-400' : 'text-xs px-2 py-1 rounded bg-zinc-500/20 text-zinc-400'}
                    >
                      {q.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                      {q.category}
                    </span>
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">
                      Difficulty {q.difficulty}
                    </span>
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 font-black">
                      ✓ {OPTION_LABELS[q.correct_index] || '?'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(q.id!, q.active)}
                      className="px-3 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30"
                    >
                      {q.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleEdit(q)}
                      className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(q.id!)}
                      className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="font-bold mb-2">{q.text}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {options.map((opt: string, idx: number) => (
                    <div
                      key={idx}
                      className={idx === q.correct_index ? 'p-2 rounded bg-green-500/20 text-green-400 font-bold' : 'p-2 rounded bg-white/5 text-zinc-400'}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ReferralsView: React.FC = () => {
  const [topReferrers, setTopReferrers] = useState<Array<{
    wallet_address: string;
    username: string | null;
    total_referrals: number;
    referral_points: number;
  }>>([]);
  const [recentReferrals, setRecentReferrals] = useState<Array<{
    referrer_wallet: string;
    referred_wallet: string;
    referral_code: string;
    status: string;
    points_awarded: number;
    referred_at: string;
    completed_at: string | null;
  }>>([]);
  const [totalStats, setTotalStats] = useState({ total: 0, pending: 0, completed: 0, totalPoints: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      // Fetch top referrers from player_profiles
      const { data: profiles } = await supabase
        .from('player_profiles')
        .select('wallet_address, username, total_referrals, referral_points')
        .gt('total_referrals', 0)
        .order('total_referrals', { ascending: false })
        .limit(50);

      // Fetch recent referrals
      const { data: referrals } = await supabase
        .from('referrals')
        .select('referrer_wallet, referred_wallet, referral_code, status, points_awarded, referred_at, completed_at')
        .order('referred_at', { ascending: false })
        .limit(100);

      // Fetch totals
      const { count: total } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true });

      const { count: pending } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: completed } = await supabase
        .from('referrals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed');

      if (mounted) {
        setTopReferrers((profiles as typeof topReferrers) || []);
        setRecentReferrals((referrals as typeof recentReferrals) || []);
        const totalPts = (profiles || []).reduce((sum, p) => sum + ((p as any).referral_points ?? 0), 0);
        setTotalStats({
          total: total ?? 0,
          pending: pending ?? 0,
          completed: completed ?? 0,
          totalPoints: totalPts,
        });
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-zinc-400"><p className="font-black uppercase tracking-widest">Loading referrals...</p></div>;
  }

  const truncate = (w: string) => w ? `${w.slice(0, 6)}...${w.slice(-4)}` : '—';

  return (
    <div className="py-6 space-y-8">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Total Referrals</p>
          <p className="text-white text-2xl font-[1000] italic mt-1">{totalStats.total}</p>
        </div>
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Pending</p>
          <p className="text-yellow-400 text-2xl font-[1000] italic mt-1">{totalStats.pending}</p>
        </div>
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Completed</p>
          <p className="text-[#14F195] text-2xl font-[1000] italic mt-1">{totalStats.completed}</p>
        </div>
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Total XP Awarded</p>
          <p className="text-white text-2xl font-[1000] italic mt-1">{totalStats.totalPoints.toLocaleString()}</p>
        </div>
      </div>

      {/* Top Referrers */}
      <div>
        <h2 className="text-xl font-black text-white mb-4">Top Referrers</h2>
        {topReferrers.length === 0 ? (
          <p className="text-zinc-500 text-sm">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">#</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Wallet</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Username</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Referrals</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">XP Earned</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map((r, i) => (
                  <tr key={r.wallet_address} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3 text-zinc-400 font-black">{i + 1}</td>
                    <td className="py-2 px-3 font-mono text-xs text-zinc-300">{truncate(r.wallet_address)}</td>
                    <td className="py-2 px-3 text-white text-sm">{r.username || '—'}</td>
                    <td className="py-2 px-3 text-[#14F195] font-black text-sm">{r.total_referrals}</td>
                    <td className="py-2 px-3 text-white text-sm">{(r.referral_points ?? 0).toLocaleString()} XP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Referral Activity */}
      <div>
        <h2 className="text-xl font-black text-white mb-4">Recent Referral Activity</h2>
        {recentReferrals.length === 0 ? (
          <p className="text-zinc-500 text-sm">No referral activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Referrer</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Referred</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Code</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Status</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">XP</th>
                  <th className="py-3 px-3 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentReferrals.map((r, i) => (
                  <tr key={`${r.referrer_wallet}-${r.referred_wallet}-${i}`} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 px-3 font-mono text-xs text-zinc-300">{truncate(r.referrer_wallet)}</td>
                    <td className="py-2 px-3 font-mono text-xs text-zinc-300">{truncate(r.referred_wallet)}</td>
                    <td className="py-2 px-3 text-white text-xs font-bold">{r.referral_code}</td>
                    <td className="py-2 px-3">
                      {r.status === 'completed' ? (
                        <span className="text-[#14F195] text-[10px] font-bold uppercase">Completed</span>
                      ) : (
                        <span className="text-yellow-400 text-[10px] font-bold uppercase">Pending</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-white text-xs">{r.points_awarded > 0 ? `+${r.points_awarded.toLocaleString()}` : '—'}</td>
                    <td className="py-2 px-3 text-zinc-400 text-xs">{new Date(r.referred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Custom Games Admin Tab ───────────────────────────────────────────────
const CUSTOM_GAMES_PAGE_SIZE = 25;

interface CustomGameRow {
  id: string;
  slug: string;
  name: string;
  creator_wallet: string;
  question_count: number;
  round_count: number;
  time_limit_seconds: number;
  total_plays: number;
  status: string;
  expires_at: string;
  created_at: string;
  creation_fee_lamports: number;
  platform_fee_lamports: number;
  prize_model: string | null;
  entry_fee_lamports: number | null;
  player_count: number | null;
}

interface CustomGameQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
}

interface CustomGameSession {
  id: string;
  wallet_address: string;
  score: number;
  correct_count: number;
  time_taken_ms: number;
  status: string;
  created_at: string;
}

const CustomGamesAdminView: React.FC = () => {
  const [games, setGames] = useState<CustomGameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<CustomGameQuestion[]>([]);
  const [detailSessions, setDetailSessions] = useState<CustomGameSession[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ gameId: string; action: string } | null>(null);

  const fetchGames = async () => {
    setLoading(true);
    const from = page * CUSTOM_GAMES_PAGE_SIZE;
    const to = from + CUSTOM_GAMES_PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from('custom_games')
      .select('id, slug, name, creator_wallet, question_count, round_count, time_limit_seconds, total_plays, status, expires_at, created_at, creation_fee_lamports, platform_fee_lamports, prize_model, entry_fee_lamports, player_count', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    setGames((data as CustomGameRow[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchGames(); }, [page]);

  const handleExpand = async (gameId: string) => {
    if (expandedGameId === gameId) {
      setExpandedGameId(null);
      return;
    }
    setExpandedGameId(gameId);
    setDetailLoading(true);
    const [qRes, sRes] = await Promise.all([
      supabase.from('custom_game_questions').select('id, question_text, options, correct_index').eq('game_id', gameId).order('sort_order'),
      supabase.from('custom_game_sessions').select('id, wallet_address, score, correct_count, time_taken_ms, status, created_at').eq('game_id', gameId).order('score', { ascending: false }).limit(50),
    ]);
    setDetailQuestions((qRes.data as CustomGameQuestion[]) ?? []);
    setDetailSessions((sRes.data as CustomGameSession[]) ?? []);
    setDetailLoading(false);
  };

  const handleModAction = async (gameId: string, newStatus: string) => {
    setActionLoading(gameId);
    setConfirmAction(null);
    const { error } = await supabase.from('custom_games').update({ status: newStatus }).eq('id', gameId);
    setActionLoading(null);
    if (error) {
      alert(`Failed: ${error.message}`);
    } else {
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, status: newStatus } : g));
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'active') return <span className="px-2 py-0.5 bg-[#14F195]/20 text-[#14F195] text-[10px] font-bold rounded uppercase">Active</span>;
    if (status === 'started') return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold rounded uppercase">Started</span>;
    if (status === 'completed') return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded uppercase">Completed</span>;
    if (status === 'finalized') return <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded uppercase">Finalized</span>;
    if (status === 'expired') return <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold rounded uppercase">Expired</span>;
    if (status === 'banned') return <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded uppercase">Banned</span>;
    return <span className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 text-[10px] font-bold rounded uppercase">{status}</span>;
  };

  const handleFinalize = async (gameId: string) => {
    setActionLoading(gameId);
    try {
      const result = await finalizeCustomGame(gameId);
      alert(`Game finalized! ${result.winners.length} winner(s) posted on-chain. TX: ${result.signature.slice(0, 16)}...`);
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, status: 'finalized' } : g));
    } catch (err: any) {
      alert(`Finalize failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && games.length === 0) return <div className="py-12 text-center text-zinc-400">Loading custom games...</div>;

  return (
    <div className="py-6">
      <h2 className="text-xl font-black text-white mb-2">Custom Games</h2>
      <p className="text-zinc-500 text-sm mb-6">{totalCount} total custom games. Click a row to expand details.</p>

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-4">
          <p className="text-red-300 text-sm flex-1">
            Are you sure you want to <span className="font-bold">{confirmAction.action}</span> this game?
          </p>
          <button onClick={() => handleModAction(confirmAction.gameId, confirmAction.action === 'ban' ? 'banned' : confirmAction.action === 'expire' ? 'expired' : 'active')} className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded">Confirm</button>
          <button onClick={() => setConfirmAction(null)} className="px-3 py-1 bg-white/10 text-zinc-400 text-xs font-bold rounded">Cancel</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Name</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Creator</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Q/R</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Plays</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Status</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Created</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Expires</th>
              <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => {
              const isExpanded = expandedGameId === g.id;
              return (
                <React.Fragment key={g.id}>
                  <tr className={`border-b border-white/5 hover:bg-white/5 cursor-pointer ${isExpanded ? 'bg-white/5' : ''}`} onClick={() => handleExpand(g.id)}>
                    <td className="py-2 px-2">
                      <div className="text-white text-sm font-bold">{g.name}</div>
                      <div className="text-zinc-500 text-[10px] font-mono">/{g.slug}</div>
                    </td>
                    <td className="py-2 px-2 font-mono text-xs text-zinc-300">{g.creator_wallet.slice(0, 6)}...{g.creator_wallet.slice(-4)}</td>
                    <td className="py-2 px-2 text-zinc-400 text-sm">{g.question_count}/{g.round_count}</td>
                    <td className="py-2 px-2">
                      <span className="text-[#14F195] font-bold">{g.total_plays}</span>
                      {g.prize_model === 'player_funded' && (
                        <span className="ml-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[8px] font-bold rounded uppercase">{(g.entry_fee_lamports ?? 0) / 1e9} SOL</span>
                      )}
                    </td>
                    <td className="py-2 px-2">{statusBadge(g.status)}</td>
                    <td className="py-2 px-2 text-zinc-500 text-xs">{new Date(g.created_at).toLocaleDateString()}</td>
                    <td className="py-2 px-2 text-zinc-500 text-xs">{new Date(g.expires_at).toLocaleDateString()}</td>
                    <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      {actionLoading === g.id ? (
                        <span className="text-zinc-400 text-xs">...</span>
                      ) : g.status === 'active' || g.status === 'started' ? (
                        <div className="flex gap-1">
                          <button onClick={() => setConfirmAction({ gameId: g.id, action: 'ban' })} className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold rounded hover:bg-red-500/30">Ban</button>
                          <button onClick={() => setConfirmAction({ gameId: g.id, action: 'expire' })} className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold rounded hover:bg-yellow-500/30">Expire</button>
                        </div>
                      ) : g.status === 'completed' && g.prize_model === 'player_funded' ? (
                        <button onClick={() => handleFinalize(g.id)} className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] font-bold rounded hover:bg-purple-500/30">Finalize</button>
                      ) : g.status === 'banned' ? (
                        <button onClick={() => setConfirmAction({ gameId: g.id, action: 'reactivate' })} className="px-2 py-0.5 bg-[#14F195]/20 text-[#14F195] text-[10px] font-bold rounded hover:bg-[#14F195]/30">Reactivate</button>
                      ) : null}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <div className="bg-[#0D0D0D] border-t border-white/5 p-6">
                          {detailLoading ? (
                            <p className="text-zinc-400 text-sm">Loading details...</p>
                          ) : (
                            <div className="space-y-6">
                              {/* Game info */}
                              <div className="flex flex-wrap gap-4 text-xs">
                                <div><span className="text-zinc-500">Game ID:</span> <span className="text-zinc-300 font-mono">{g.id.slice(0, 12)}...</span></div>
                                <div><span className="text-zinc-500">Share URL:</span> <a href={`/game/${g.slug}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">soltrivia.app/game/{g.slug}</a></div>
                                <div><span className="text-zinc-500">Time limit:</span> <span className="text-zinc-300">{g.time_limit_seconds}s per question</span></div>
                                <div><span className="text-zinc-500">Creator:</span> <span className="text-zinc-300 font-mono">{g.creator_wallet}</span></div>
                              </div>

                              {/* Questions */}
                              <div>
                                <h4 className="text-white font-black text-sm uppercase mb-3">Questions ({detailQuestions.length})</h4>
                                <div className="space-y-3">
                                  {detailQuestions.map((q, qi) => (
                                    <div key={q.id} className="bg-white/5 rounded-lg p-3">
                                      <p className="text-white text-sm mb-2"><span className="text-zinc-500 mr-2">Q{qi + 1}.</span>{q.question_text}</p>
                                      <div className="grid grid-cols-2 gap-1">
                                        {(q.options ?? []).map((opt, oi) => (
                                          <div key={oi} className={`text-xs px-2 py-1 rounded ${oi === q.correct_index ? 'bg-[#14F195]/20 text-[#14F195] font-bold' : 'text-zinc-400'}`}>
                                            {OPTION_LABELS[oi]}. {opt}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Player sessions */}
                              <div>
                                <h4 className="text-white font-black text-sm uppercase mb-3">Player Sessions ({detailSessions.length})</h4>
                                {detailSessions.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="border-b border-white/10">
                                          <th className="py-1 px-2 text-zinc-500 text-[10px] font-black uppercase">#</th>
                                          <th className="py-1 px-2 text-zinc-500 text-[10px] font-black uppercase">Wallet</th>
                                          <th className="py-1 px-2 text-zinc-500 text-[10px] font-black uppercase">Score</th>
                                          <th className="py-1 px-2 text-zinc-500 text-[10px] font-black uppercase">Correct</th>
                                          <th className="py-1 px-2 text-zinc-500 text-[10px] font-black uppercase">Time</th>
                                          <th className="py-1 px-2 text-zinc-500 text-[10px] font-black uppercase">Status</th>
                                          <th className="py-1 px-2 text-zinc-500 text-[10px] font-black uppercase">Date</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detailSessions.map((s, si) => (
                                          <tr key={s.id} className="border-b border-white/5">
                                            <td className="py-1 px-2 text-zinc-500 text-xs">{si + 1}</td>
                                            <td className="py-1 px-2 font-mono text-xs text-zinc-300">{s.wallet_address.slice(0, 6)}...{s.wallet_address.slice(-4)}</td>
                                            <td className="py-1 px-2 text-[#14F195] font-bold text-sm">{s.score?.toLocaleString() ?? 0}</td>
                                            <td className="py-1 px-2 text-zinc-400 text-xs">{s.correct_count ?? 0}</td>
                                            <td className="py-1 px-2 text-zinc-400 text-xs">{s.time_taken_ms ? `${(s.time_taken_ms / 1000).toFixed(1)}s` : '—'}</td>
                                            <td className="py-1 px-2">
                                              {s.status === 'completed' ? <span className="text-[#14F195] text-[10px] font-bold">Done</span> : <span className="text-yellow-400 text-[10px] font-bold">{s.status}</span>}
                                            </td>
                                            <td className="py-1 px-2 text-zinc-500 text-xs">{new Date(s.created_at).toLocaleString()}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-zinc-500 text-sm">No sessions yet.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {games.length === 0 && <p className="text-zinc-500 mt-4">No custom games created yet.</p>}
      <Pagination currentPage={page} totalCount={totalCount} pageSize={CUSTOM_GAMES_PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
};

// ─── Duels Admin View ───────────────────────────────────────────────────────
const DUELS_PAGE_SIZE = 20;
const DuelsAdminView: React.FC = () => {
  const [duels, setDuels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState({ total: 0, waiting: 0, playing: 0, completed: 0, resolved: 0, cancelled: 0, expired: 0, totalWagered: 0 });

  useEffect(() => {
    fetchDuelStats();
  }, []);

  useEffect(() => {
    fetchDuels();
  }, [page, statusFilter]);

  const fetchDuelStats = async () => {
    try {
      const [totalRes, waitingRes, playingRes, completedRes, resolvedRes, cancelledRes, expiredRes, wageredRes] = await Promise.all([
        supabase.from('duels').select('*', { count: 'exact', head: true }),
        supabase.from('duels').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
        supabase.from('duels').select('*', { count: 'exact', head: true }).eq('status', 'playing'),
        supabase.from('duels').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('duels').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('duels').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('duels').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
        supabase.from('duels').select('total_pot_lamports').in('status', ['completed', 'resolved']),
      ]);
      const totalWagered = (wageredRes.data || []).reduce((sum: number, d: any) => sum + (d.total_pot_lamports || 0), 0);
      setStats({
        total: totalRes.count || 0,
        waiting: waitingRes.count || 0,
        playing: playingRes.count || 0,
        completed: completedRes.count || 0,
        resolved: resolvedRes.count || 0,
        cancelled: cancelledRes.count || 0,
        expired: expiredRes.count || 0,
        totalWagered,
      });
    } catch (err) {
      console.error('Failed to fetch duel stats:', err);
    }
  };

  const fetchDuels = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('duels')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * DUELS_PAGE_SIZE, (page + 1) * DUELS_PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setDuels(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch duels:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'text-yellow-400 bg-yellow-400/10';
      case 'locked': return 'text-blue-400 bg-blue-400/10';
      case 'playing': return 'text-cyan-400 bg-cyan-400/10';
      case 'completed': return 'text-orange-400 bg-orange-400/10';
      case 'resolved': return 'text-green-400 bg-green-400/10';
      case 'cancelled': return 'text-zinc-400 bg-zinc-400/10';
      case 'expired': return 'text-red-400 bg-red-400/10';
      default: return 'text-zinc-400 bg-zinc-400/10';
    }
  };

  const LAMPORTS_PER_SOL = 1_000_000_000;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Duels Management</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-zinc-500 text-xs font-bold uppercase">Total Duels</p>
          <p className="text-white text-2xl font-[1000] italic">{stats.total}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-zinc-500 text-xs font-bold uppercase">Active</p>
          <p className="text-cyan-400 text-2xl font-[1000] italic">{stats.waiting + stats.playing}</p>
          <p className="text-zinc-600 text-[10px]">{stats.waiting} waiting, {stats.playing} playing</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-zinc-500 text-xs font-bold uppercase">Resolved</p>
          <p className="text-green-400 text-2xl font-[1000] italic">{stats.resolved}</p>
          <p className="text-zinc-600 text-[10px]">{stats.completed} awaiting resolve</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-zinc-500 text-xs font-bold uppercase">Total Wagered</p>
          <p className="text-[#14F195] text-2xl font-[1000] italic">{(stats.totalWagered / LAMPORTS_PER_SOL).toFixed(2)}</p>
          <p className="text-zinc-600 text-[10px]">SOL (completed + resolved)</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['all', 'waiting', 'playing', 'completed', 'resolved', 'cancelled', 'expired'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(0); }}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all ${
              statusFilter === s ? 'bg-[#14F195] text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            {s === 'all' ? `All (${stats.total})` : `${s} (${stats[s as keyof typeof stats] || 0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading duels...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase border-b border-white/10">
                <th className="text-left py-3 px-2">ID</th>
                <th className="text-left py-3 px-2">Player 1</th>
                <th className="text-left py-3 px-2">Player 2</th>
                <th className="text-left py-3 px-2">Fee</th>
                <th className="text-left py-3 px-2">Pot</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2">Winner</th>
                <th className="text-left py-3 px-2">Score</th>
                <th className="text-left py-3 px-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {duels.map((duel) => (
                <tr key={duel.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-3 px-2 font-mono text-xs text-zinc-400">{duel.duel_id}</td>
                  <td className="py-3 px-2 font-mono text-xs">
                    {duel.player1_wallet ? `${duel.player1_wallet.slice(0, 4)}...${duel.player1_wallet.slice(-4)}` : '—'}
                  </td>
                  <td className="py-3 px-2 font-mono text-xs">
                    {duel.player2_wallet ? `${duel.player2_wallet.slice(0, 4)}...${duel.player2_wallet.slice(-4)}` : '—'}
                  </td>
                  <td className="py-3 px-2 text-xs tabular-nums">{(duel.entry_fee_lamports / LAMPORTS_PER_SOL).toFixed(2)}</td>
                  <td className="py-3 px-2 text-xs tabular-nums text-[#14F195]">
                    {duel.total_pot_lamports ? (duel.total_pot_lamports / LAMPORTS_PER_SOL).toFixed(2) : '—'}
                  </td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColor(duel.status)}`}>
                      {duel.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 font-mono text-xs">
                    {duel.winner_wallet ? `${duel.winner_wallet.slice(0, 4)}...${duel.winner_wallet.slice(-4)}` : '—'}
                  </td>
                  <td className="py-3 px-2 text-xs tabular-nums">
                    {duel.player1_score || 0} vs {duel.player2_score || 0}
                  </td>
                  <td className="py-3 px-2 text-xs text-zinc-500">
                    {new Date(duel.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {duels.length === 0 && !loading && <p className="text-zinc-500 mt-4">No duels found.</p>}
      <Pagination currentPage={page} totalCount={totalCount} pageSize={DUELS_PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
};

// ===================== NOTIFICATIONS TAB =====================
const NotificationsView: React.FC = () => {
  const [subs, setSubs] = useState<{ wallet_address: string; subscription_json: any; created_at: string; updated_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [targetWallet, setTargetWallet] = useState('');
  const [title, setTitle] = useState('Test from SolTrivia');
  const [body, setBody] = useState('If you see this, push notifications are working!');

  useEffect(() => { loadSubs(); }, []);

  const loadSubs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) setSubs(data);
    setLoading(false);
  };

  const sendTest = async (wallets?: string[]) => {
    setSending(true);
    setResult(null);
    try {
      const payload: any = { title, body, url: '/', tag: 'admin-test' };
      if (wallets && wallets.length > 0) {
        payload.wallet_addresses = wallets;
      } else {
        payload.all_subscribers = true;
      }
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-notification`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setResult(`Sent: ${json.sent}, Failed: ${json.failed}, Cleaned: ${json.cleaned ?? 0}`);
      } else {
        setResult(`Error ${res.status}: ${json.error || JSON.stringify(json)}`);
      }
    } catch (err: any) {
      setResult(`Network error: ${err.message}`);
    }
    setSending(false);
  };

  const deleteSub = async (wallet: string) => {
    if (!confirm(`Remove subscription for ${wallet.slice(0, 8)}...?`)) return;
    await supabase.from('push_subscriptions').delete().eq('wallet_address', wallet);
    setSubs(prev => prev.filter(s => s.wallet_address !== wallet));
  };

  return (
    <div>
      <h2 className="text-xl font-black text-white mb-4">Push Notifications</h2>

      {/* Send test notification */}
      <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-3">Send Test Notification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Body</label>
            <input value={body} onChange={e => setBody(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>
        <div className="mb-4">
          <label className="text-xs text-zinc-400 block mb-1">Target wallet (leave empty = all subscribers)</label>
          <input value={targetWallet} onChange={e => setTargetWallet(e.target.value)} placeholder="e.g. GRjf5em..."
            className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-white text-sm font-mono" />
        </div>
        <div className="flex gap-3">
          <button onClick={() => sendTest(targetWallet ? [targetWallet] : undefined)} disabled={sending || !title || !body}
            className="px-6 py-2 bg-[#14F195] text-black font-bold rounded-lg disabled:opacity-50">
            {sending ? 'Sending...' : targetWallet ? 'Send to Wallet' : 'Send to ALL'}
          </button>
          {subs.length > 0 && (
            <button onClick={() => sendTest([subs[0].wallet_address])} disabled={sending}
              className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg disabled:opacity-50">
              {sending ? 'Sending...' : `Test ${subs[0].wallet_address.slice(0, 6)}...`}
            </button>
          )}
        </div>
        {result && (
          <div className={`mt-3 p-3 rounded-lg text-sm font-mono ${result.startsWith('Error') || result.startsWith('Network') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
            {result}
          </div>
        )}
      </div>

      {/* Subscriber list */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Active Subscribers ({subs.length})</h3>
          <button onClick={loadSubs} disabled={loading} className="text-xs text-zinc-400 hover:text-white">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {subs.length === 0 && !loading && <p className="text-zinc-500">No push subscribers yet.</p>}
        <div className="space-y-3">
          {subs.map(sub => {
            const endpoint = sub.subscription_json?.endpoint || '';
            const shortEndpoint = endpoint.length > 60 ? endpoint.slice(0, 60) + '...' : endpoint;
            return (
              <div key={sub.wallet_address} className="flex items-center justify-between bg-black/30 rounded-lg p-3 border border-white/5">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-white truncate">{sub.wallet_address}</div>
                  <div className="text-xs text-zinc-500 truncate">{shortEndpoint}</div>
                  <div className="text-xs text-zinc-600">Updated: {new Date(sub.updated_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2 ml-3 shrink-0">
                  <button onClick={() => sendTest([sub.wallet_address])} disabled={sending}
                    className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded disabled:opacity-50">
                    Test
                  </button>
                  <button onClick={() => deleteSub(sub.wallet_address)}
                    className="px-3 py-1 bg-red-600/50 text-red-300 text-xs font-bold rounded hover:bg-red-600">
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardEnhanced;
