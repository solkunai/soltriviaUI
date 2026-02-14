import * as React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../src/utils/supabase';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PRIZE_POOL_WALLET, REVENUE_WALLET, SUPABASE_FUNCTIONS_URL } from '../src/utils/constants';
import { getAuthHeaders, fetchRoundPayouts, markPayoutPaid, postWinnersOnChain, type RoundPayout } from '../src/utils/api';
import { getSolanaRpcEndpoint } from '../src/utils/rpc';

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

type TabType = 'questions' | 'users' | 'rounds' | 'stats' | 'lives' | 'rankings' | 'quests' | 'round_winners' | 'referrals' | 'answer_debug';

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

      setStats({
        totalQuestions: questionsCount || 0,
        totalPlayers: playersCount || 0,
        totalGames: gamesCount || 0,
        activePlayers24h: activePlayersCount || 0,
        totalLivesPurchased: totalLives,
        totalRevenueSol: totalRevenue / LAMPORTS_PER_SOL,
        revenueWalletBalance: revenueBalance,
        prizePoolWalletBalance: prizePoolBalance,
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
          { id: 'referrals', label: '🔗 Referrals', icon: '🔗' },
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
        {activeTab === 'referrals' && <ReferralsView />}
        {activeTab === 'answer_debug' && <AnswerDebugView functionsUrl={SUPABASE_FUNCTIONS_URL} />}
      </div>
    </div>
  );
};

// Stub tabs (coming soon) — fix missing component errors
const RankingsView: React.FC = () => {
  const [list, setList] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from('player_profiles')
      .select('wallet_address, username, total_games_played, total_points, current_streak')
      .order('total_points', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setList((data as PlayerStats[]) || []);
        setLoading(false);
      });
  }, []);
  if (loading) return <div className="py-12 text-center text-zinc-400">Loading rankings...</div>;
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
                <td className="py-2 px-2 text-zinc-400">{i + 1}</td>
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
    </div>
  );
};

const UsersView: React.FC = () => {
  const [list, setList] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from('player_profiles')
      .select('wallet_address, username, total_games_played, total_points, current_streak')
      .order('updated_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setList((data as PlayerStats[]) || []);
        setLoading(false);
      });
  }, []);
  if (loading) return <div className="py-12 text-center text-zinc-400">Loading users...</div>;
  return (
    <div className="py-6">
      <h2 className="text-xl font-black text-white mb-4">Users (player profiles)</h2>
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
                <td className="py-2 px-2 font-mono text-xs text-zinc-300">{p.wallet_address}</td>
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

const RoundWinnersAdminView: React.FC = () => {
  const [rounds, setRounds] = useState<Array<{ id: string; date: string; round_number: number; pot_lamports: number; player_count: number }>>([]);
  const [payouts, setPayouts] = useState<RoundPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [paidInput, setPaidInput] = useState<{ roundId: string; rank: number; value: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [postingRoundId, setPostingRoundId] = useState<string | null>(null);

  const creds = getAdminCreds();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      const { data: roundsData, error: roundsErr } = await supabase
        .from('daily_rounds')
        .select('id, date, round_number, pot_lamports, player_count')
        .order('date', { ascending: false })
        .order('round_number', { ascending: false })
        .limit(50);
      if (roundsErr || !roundsData?.length) {
        if (mounted) setRounds([]);
        if (mounted) setPayouts([]);
        setLoading(false);
        return;
      }
      if (mounted) setRounds(roundsData as typeof rounds);
      const ids = roundsData.map((r: { id: string }) => r.id);
      const list = await fetchRoundPayouts(ids);
      if (mounted) setPayouts(list);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

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

  return (
    <div className="py-6">
      <h2 className="text-xl font-black text-white mb-2">Round Winners (Top 5, 100% pot)</h2>
      <p className="text-zinc-500 text-sm mb-6">Copy wallet, mark as paid, and set prize amount paid. 1st 50%, 2nd 20%, 3rd 15%, 4th 10%, 5th 5%.</p>
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
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Paid</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Paid amount</th>
              <th className="py-3 px-2 text-zinc-500 font-black text-[10px] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => {
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
                  <td className="py-2 px-2">{p.paid_at ? <span className="text-[#14F195] font-bold text-xs">Yes</span> : <span className="text-zinc-500 text-xs">No</span>}</td>
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
      {rounds.length > 0 && payouts.length === 0 && (
        <p className="text-zinc-500 text-sm mt-4">No payouts yet. Top 5 are populated when players complete games (calculate_rankings_and_winner).</p>
      )}
    </div>
  );
};
const LivesView: React.FC = () => {
  const [lives, setLives] = useState<Array<{ wallet_address: string; lives_count: number; total_purchased: number; total_used: number }>>([]);
  const [purchases, setPurchases] = useState<Array<{ wallet_address: string; lives_purchased: number; amount_lamports: number; created_at?: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      supabase.from('player_lives').select('wallet_address, lives_count, total_purchased, total_used').order('total_purchased', { ascending: false }).limit(100),
      supabase.from('lives_purchases').select('wallet_address, lives_purchased, amount_lamports, created_at').order('created_at', { ascending: false }).limit(100),
    ]).then(([lRes, pRes]) => {
      setLives((lRes.data as typeof lives) || []);
      setPurchases((pRes.data as typeof purchases) || []);
      setLoading(false);
    });
  }, []);
  if (loading) return <div className="py-12 text-center text-zinc-400">Loading lives...</div>;
  return (
    <div className="py-6 space-y-8">
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
        <h2 className="text-xl font-black text-white mb-4">Recent Lives Purchases</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Wallet</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Lives</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Amount (SOL)</th>
                <th className="py-2 px-2 text-zinc-500 text-xs font-black uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-2 px-2 font-mono text-xs text-zinc-300">{p.wallet_address.slice(0, 8)}...{p.wallet_address.slice(-4)}</td>
                  <td className="py-2 px-2 text-[#14F195]">{p.lives_purchased ?? 0}</td>
                  <td className="py-2 px-2 text-white">{(p.amount_lamports / 1_000_000_000).toFixed(4)}</td>
                  <td className="py-2 px-2 text-zinc-500 text-xs">{(p as any).created_at ? new Date((p as any).created_at).toLocaleString() : '—'}</td>
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

      {/* Other Stats */}
      <h3 className="text-xl font-black mb-4 text-zinc-400">Platform Statistics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard label="Total Questions" value={stats.totalQuestions} color="blue" />
        <StatCard label="Total Players" value={stats.totalPlayers} color="green" />
        <StatCard label="Total Games" value={stats.totalGames} color="purple" />
        <StatCard label="Active Players (24h)" value={stats.activePlayers24h} color="yellow" />
        <StatCard label="Lives Purchased" value={stats.totalLivesPurchased} color="red" />
        <StatCard label="Total Revenue from Lives" value={`${stats.totalRevenueSol.toFixed(3)} SOL`} color="green" />
      </div>
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
      headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
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
      headers: getAuthHeaders(),
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

export default AdminDashboardEnhanced;
