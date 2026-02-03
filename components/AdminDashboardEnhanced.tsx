import * as React from 'react';
import { useState, useEffect } from 'react';
import { supabase } from '../src/utils/supabase';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PRIZE_POOL_WALLET, REVENUE_WALLET, SUPABASE_FUNCTIONS_URL } from '../src/utils/constants';
import { getAuthHeaders } from '../src/utils/api';
import { getSolanaRpcEndpoint } from '../src/utils/rpc';

type TabType = 'questions' | 'users' | 'rounds' | 'stats' | 'lives' | 'rankings' | 'quests';

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

  const getCreds = (): { u: string; p: string } => ({
    u: import.meta.env.VITE_ADMIN_USERNAME || '',
    p: import.meta.env.VITE_ADMIN_PASSWORD || '',
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-[1000] italic uppercase tracking-tighter mb-2">Admin Dashboard</h1>
        <p className="text-zinc-500 text-sm">Manage your Solana Trivia Protocol</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'stats', label: '📊 Stats', icon: '📊' },
          { id: 'rankings', label: '🏆 Rankings', icon: '🏆' },
          { id: 'questions', label: '❓ Questions', icon: '❓' },
          { id: 'quests', label: '📋 Quests', icon: '📋' },
          { id: 'users', label: '👥 Users', icon: '👥' },
          { id: 'rounds', label: '🎮 Rounds', icon: '🎮' },
          { id: 'lives', label: '❤️ Lives', icon: '❤️' },
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
        {activeTab === 'questions' && <QuestionsView functionsUrl={SUPABASE_FUNCTIONS_URL} />}
        {activeTab === 'quests' && <QuestsManagementView />}
        {activeTab === 'users' && <UsersView />}
        {activeTab === 'rounds' && <RoundsView />}
        {activeTab === 'lives' && <LivesView />}
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
  requirement_config: { max?: number };
  sort_order: number;
  quest_type: string;
  is_active: boolean;
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
  const [newQuest, setNewQuest] = useState({
    slug: '',
    title: '',
    description: '',
    category: 'Active Operations',
    reward_tp: 250,
    reward_label: '250 TP',
    requirement_type: 'manual',
    requirement_config: { max: 1 },
    sort_order: 0,
    quest_type: 'STANDARD' as string,
    is_active: true,
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quests' }, () => {
        fetchQuests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quest_submissions' }, () => {
        fetchSubmissions();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const callManage = async (action: string, payload?: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/manage-quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      await callManage('create', {
        slug: newQuest.slug.trim().toLowerCase().replace(/\s+/g, '_'),
        title: newQuest.title.trim(),
        description: newQuest.description.trim(),
        category: newQuest.category,
        reward_tp: newQuest.reward_tp,
        reward_label: newQuest.reward_label || `${newQuest.reward_tp} TP`,
        requirement_type: newQuest.requirement_type,
        requirement_config: newQuest.requirement_config,
        sort_order: newQuest.sort_order,
        quest_type: newQuest.quest_type,
        is_active: newQuest.is_active,
      });
      setSuccess('Quest created');
      setShowAddForm(false);
      setNewQuest({ slug: '', title: '', description: '', category: 'Active Operations', reward_tp: 250, reward_label: '250 TP', requirement_type: 'manual', requirement_config: { max: 1 }, sort_order: 0, quest_type: 'STANDARD', is_active: true });
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

  if (loading) return <div className="text-center py-20">Loading quests...</div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-black">Quests Management ({quests.length})</h2>
        <button
          onClick={() => { setShowAddForm(!showAddForm); setError(''); }}
          className="px-4 py-2 bg-[#14F195] text-black font-black text-xs uppercase rounded"
        >
          {showAddForm ? 'Cancel' : '+ Add Quest'}
        </button>
      </div>
      {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm">{success}</div>}

      {showAddForm && (
        <div className="mb-6 p-6 bg-white/5 border border-white/10 rounded-xl space-y-3">
          <h3 className="font-black text-[#14F195]">New Quest</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="bg-black/40 border border-white/10 px-3 py-2 rounded text-sm" placeholder="Slug (e.g. my_quest)" value={newQuest.slug} onChange={(e) => setNewQuest((q) => ({ ...q, slug: e.target.value }))} />
            <input className="bg-black/40 border border-white/10 px-3 py-2 rounded text-sm" placeholder="Title" value={newQuest.title} onChange={(e) => setNewQuest((q) => ({ ...q, title: e.target.value }))} />
            <textarea className="md:col-span-2 bg-black/40 border border-white/10 px-3 py-2 rounded text-sm" placeholder="Description" value={newQuest.description} onChange={(e) => setNewQuest((q) => ({ ...q, description: e.target.value }))} rows={2} />
            <select className="bg-black/40 border border-white/10 px-3 py-2 rounded text-sm" value={newQuest.category} onChange={(e) => setNewQuest((q) => ({ ...q, category: e.target.value }))}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="bg-black/40 border border-white/10 px-3 py-2 rounded text-sm" value={newQuest.quest_type} onChange={(e) => setNewQuest((q) => ({ ...q, quest_type: e.target.value }))}>
              {QUEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" className="bg-black/40 border border-white/10 px-3 py-2 rounded text-sm" placeholder="Reward TP" value={newQuest.reward_tp} onChange={(e) => setNewQuest((q) => ({ ...q, reward_tp: parseInt(e.target.value, 10) || 0, reward_label: `${parseInt(e.target.value, 10) || 0} TP` }))} />
            <input type="number" className="bg-black/40 border border-white/10 px-3 py-2 rounded text-sm" placeholder="Sort order" value={newQuest.sort_order} onChange={(e) => setNewQuest((q) => ({ ...q, sort_order: parseInt(e.target.value, 10) || 0 }))} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newQuest.is_active} onChange={(e) => setNewQuest((q) => ({ ...q, is_active: e.target.checked }))} />
              Active
            </label>
          </div>
          <button onClick={handleCreate} className="px-4 py-2 bg-[#14F195] text-black font-black text-xs uppercase rounded">Create Quest</button>
        </div>
      )}

      <p className="text-zinc-500 text-sm mb-4">Changes (add/delete/pause) sync in real time to the app. Paused quests are hidden from players.</p>
      <div className="space-y-4">
        {quests.map((q) => (
          <div key={q.id} className={`bg-white/5 border p-4 rounded-xl flex flex-wrap items-center gap-4 ${q.is_active ? 'border-white/10' : 'border-amber-500/30 opacity-80'}`}>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="font-black text-[#14F195]">{q.title}</span>
                {!q.is_active && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase">Paused</span>}
              </div>
              <div className="text-zinc-500 text-xs">{q.description}</div>
              <div className="text-zinc-600 text-[10px] mt-1">{q.category} · {q.reward_label || `${q.reward_tp} TP`}</div>
            </div>
            <input
              className="bg-black/40 border border-white/10 px-3 py-1 rounded text-sm w-24"
              type="number"
              value={q.sort_order}
              onChange={(e) => setQuests((prev) => prev.map((x) => x.id === q.id ? { ...x, sort_order: parseInt(e.target.value, 10) || 0 } : x))}
            />
            <select
              className="bg-black/40 border border-white/10 px-3 py-1 rounded text-sm"
              value={q.category}
              onChange={(e) => setQuests((prev) => prev.map((x) => x.id === q.id ? { ...x, category: e.target.value } : x))}
            >
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => handleTogglePause(q)} className="px-3 py-1.5 text-xs font-black uppercase rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">
              {q.is_active ? 'Pause' : 'Resume'}
            </button>
            <button onClick={() => handleUpdate(quests.find((x) => x.id === q.id)!)} className="px-4 py-2 bg-[#14F195] text-black font-black text-xs uppercase rounded">Save</button>
            <button onClick={() => handleDelete(q)} className="px-3 py-1.5 text-xs font-black uppercase rounded bg-red-500/20 text-red-400 hover:bg-red-500/30">Delete</button>
          </div>
        ))}
      </div>

      <div className="mt-10 pt-8 border-t border-white/10">
        <h3 className="text-xl font-black mb-4">Pending proof submissions (e.g. TRUE RAIDER)</h3>
        <p className="text-zinc-500 text-sm mb-4">Approve to grant the user the quest reward (TP) automatically. Reject to let them submit again.</p>
        {submissionsLoading ? (
          <p className="text-zinc-500 text-sm">Loading...</p>
        ) : submissions.length === 0 ? (
          <p className="text-zinc-500 text-sm">No pending submissions.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[180px]">
                  <p className="font-mono text-xs text-[#14F195]">{s.wallet_address.slice(0, 8)}...{s.wallet_address.slice(-6)}</p>
                  <p className="text-zinc-500 text-xs mt-1">{(s.quest as { title?: string })?.title || s.quest_id}</p>
                  <a href={s.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs hover:underline break-all">{s.proof_url}</a>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleReviewSubmission(s.id, 'approve')} className="px-4 py-2 bg-[#14F195] text-black font-black text-xs uppercase rounded">Approve</button>
                  <button onClick={() => handleReviewSubmission(s.id, 'reject')} className="px-4 py-2 bg-red-500/20 text-red-400 font-black text-xs uppercase rounded">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
    const res = await fetch(`${functionsUrl}/manage-questions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, payload: payload ?? {} }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  };

  useEffect(() => {
    fetchQuestions();
  }, [functionsUrl]);

  const fetchQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const json = await callManageQuestions('list', { limit: 100 });
      const data = (json.data || []) as Question[];
      setQuestions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  };

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
      setError(err.message || 'Failed to save question');
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black">Questions Management ({questions.length})</h2>
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
          {questions.map((q) => {
            const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as any);
            return (
              <div
                key={q.id}
                className={`p-4 border rounded-lg ${
                  q.active ? 'bg-black/20 border-white/10' : 'bg-zinc-900/20 border-zinc-700/30'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        q.active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'
                      }`}
                    >
                      {q.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400">
                      {q.category}
                    </span>
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400">
                      Difficulty {q.difficulty}
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
                      className={`p-2 rounded ${
                        idx === q.correct_index
                          ? 'bg-green-500/20 text-green-400 font-bold'
                          : 'bg-white/5 text-zinc-400'
                      }`}
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

// Users Management Tab
const UsersView: React.FC = () => {
  const [users, setUsers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from('player_profiles')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(50);

      const { data: lives } = await supabase
        .from('player_lives')
        .select('wallet_address, lives_count');

      const livesMap = new Map(lives?.map((l) => [l.wallet_address, l.lives_count]) || []);

      const usersData: PlayerStats[] = profiles?.map((p) => ({
        wallet_address: p.wallet_address,
        username: p.username || 'Anonymous',
        total_games_played: p.total_games_played || 0,
        total_points: p.total_points || 0,
        current_streak: p.current_streak || 0,
        lives_count: livesMap.get(p.wallet_address) || 0,
      })) || [];

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-10">Loading users...</div>;

  return (
    <div>
      <h2 className="text-2xl font-black mb-6">Players ({users.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-black/40 text-xs font-black text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Wallet</th>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-center">Games</th>
              <th className="px-4 py-3 text-center">Points</th>
              <th className="px-4 py-3 text-center">Streak</th>
              <th className="px-4 py-3 text-center">Lives</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((user) => (
              <tr key={user.wallet_address} className="hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-xs text-[#14F195]">
                  {user.wallet_address.slice(0, 8)}...{user.wallet_address.slice(-6)}
                </td>
                <td className="px-4 py-3">{user.username}</td>
                <td className="px-4 py-3 text-center">{user.total_games_played}</td>
                <td className="px-4 py-3 text-center font-bold">{user.total_points.toLocaleString()}</td>
                <td className="px-4 py-3 text-center">{user.current_streak} 🔥</td>
                <td className="px-4 py-3 text-center text-red-400">❤️ {user.lives_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Rounds Management Tab
const RoundsView: React.FC = () => {
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRounds();
  }, []);

  const fetchRounds = async () => {
    try {
      const { data } = await supabase
        .from('daily_rounds')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      setRounds(data || []);
    } catch (error) {
      console.error('Error fetching rounds:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-10">Loading rounds...</div>;

  return (
    <div>
      <h2 className="text-2xl font-black mb-6">Game Rounds ({rounds.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-black/40 text-xs font-black text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-center">Round</th>
              <th className="px-4 py-3 text-center">Players</th>
              <th className="px-4 py-3 text-center">Pot</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rounds.map((round) => (
              <tr key={round.id} className="hover:bg-white/5">
                <td className="px-4 py-3">{round.date}</td>
                <td className="px-4 py-3 text-center">Round {round.round_number + 1}</td>
                <td className="px-4 py-3 text-center">{round.player_count}</td>
                <td className="px-4 py-3 text-center font-bold text-[#14F195]">
                  {(round.pot_lamports / 1_000_000_000).toFixed(3)} SOL
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      round.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-zinc-500/20 text-zinc-400'
                    }`}
                  >
                    {round.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Lives Management Tab
const LivesView: React.FC = () => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      const { data } = await supabase
        .from('lives_purchases')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-10">Loading purchases...</div>;

  return (
    <div>
      <h2 className="text-2xl font-black mb-6">Lives Purchases ({purchases.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-black/40 text-xs font-black text-zinc-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Wallet</th>
              <th className="px-4 py-3 text-center">Lives</th>
              <th className="px-4 py-3 text-center">Amount</th>
              <th className="px-4 py-3 text-left">TX</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-sm">
                  {new Date(purchase.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#14F195]">
                  {purchase.wallet_address.slice(0, 8)}...{purchase.wallet_address.slice(-6)}
                </td>
                <td className="px-4 py-3 text-center">❤️ {purchase.lives_purchased}</td>
                <td className="px-4 py-3 text-center font-bold">
                  {(purchase.amount_lamports / 1_000_000_000).toFixed(3)} SOL
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <a
                    href={`https://solscan.io/tx/${purchase.tx_signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {purchase.tx_signature.slice(0, 8)}...
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Rankings Management Tab
const RankingsView: React.FC = () => {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null);

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      const { data } = await supabase
        .from('player_profiles')
        .select('wallet_address, username, total_points, total_wins, total_games_played, highest_score, current_streak')
        .order('total_points', { ascending: false })
        .limit(100);

      setRankings(data || []);
    } catch (error) {
      console.error('Error fetching rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyWalletAddress = async (wallet: string) => {
    try {
      await navigator.clipboard.writeText(wallet);
      setCopiedWallet(wallet);
      setTimeout(() => setCopiedWallet(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading rankings...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-black">🏆 Player Rankings ({rankings.length})</h2>
        <button
          onClick={fetchRankings}
          className="px-4 py-2 bg-[#14F195] text-black font-bold rounded-lg hover:bg-[#14F195]/80 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-4 py-3 text-center">#</th>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-left">Wallet Address</th>
              <th className="px-4 py-3 text-center">Total Points</th>
              <th className="px-4 py-3 text-center">Wins</th>
              <th className="px-4 py-3 text-center">Games</th>
              <th className="px-4 py-3 text-center">High Score</th>
              <th className="px-4 py-3 text-center">Streak</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rankings.map((player, index) => (
              <tr key={player.wallet_address} className="hover:bg-white/5">
                <td className="px-4 py-3 text-center font-black text-xl">
                  {index === 0 && <span className="text-yellow-400">🥇</span>}
                  {index === 1 && <span className="text-gray-300">🥈</span>}
                  {index === 2 && <span className="text-orange-400">🥉</span>}
                  {index > 2 && <span className="text-zinc-500">{index + 1}</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="font-bold text-white">
                    {player.username || 'Anonymous'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#14F195]">
                      {player.wallet_address.slice(0, 8)}...{player.wallet_address.slice(-6)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-black text-lg text-[#14F195]">
                    {player.total_points.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-bold text-yellow-400">
                    🏆 {player.total_wins}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-zinc-400">
                  {player.total_games_played}
                </td>
                <td className="px-4 py-3 text-center text-purple-400 font-bold">
                  {player.highest_score}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold ${player.current_streak > 0 ? 'text-orange-400' : 'text-zinc-500'}`}>
                    🔥 {player.current_streak}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => copyWalletAddress(player.wallet_address)}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      copiedWallet === player.wallet_address
                        ? 'bg-green-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title="Copy wallet address for rewards"
                  >
                    {copiedWallet === player.wallet_address ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rankings.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          No player rankings yet. Players will appear here once they start playing!
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-300">
          💡 <strong>Tip:</strong> Use the "Copy" button to quickly copy wallet addresses for sending rewards manually.
          Rankings are sorted by total points across all games.
        </p>
      </div>
    </div>
  );
};

export default AdminDashboardEnhanced;
