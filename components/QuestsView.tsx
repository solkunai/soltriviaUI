import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../src/contexts/WalletContext';
import { fetchQuests, fetchUserQuestProgress, subscribeUserQuestProgress, subscribeQuests, submitQuestProof, claimQuestReward, type Quest, type UserQuestProgress } from '../src/utils/api';

interface QuestsViewProps {
  onGoToProfile?: () => void;
  onOpenGuide?: () => void;
}

const CATEGORY_ORDER = ['Priority Mission', 'Social Operations', 'Active Operations'];

const QuestsView: React.FC<QuestsViewProps> = ({ onGoToProfile, onOpenGuide }) => {
  const { publicKey, connected } = useWallet();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserQuestProgress>>({});
  const [loading, setLoading] = useState(true);
  const [raiderUrl, setRaiderUrl] = useState('');
  const [showRaiderInput, setShowRaiderInput] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const loadQuests = useCallback(async () => {
    try {
      const data = await fetchQuests();
      setQuests(data);
    } catch {
      setQuests([]);
    }
  }, []);

  const loadProgress = useCallback(async () => {
    if (!connected || !publicKey) {
      setProgressMap({});
      return;
    }
    try {
      const list = await fetchUserQuestProgress(publicKey.toBase58());
      const map: Record<string, UserQuestProgress> = {};
      list.forEach((p) => { map[p.quest_id] = p; });
      setProgressMap(map);
    } catch {
      setProgressMap({});
    }
  }, [connected, publicKey]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([loadQuests(), loadProgress()]).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [loadQuests, loadProgress]);

  useEffect(() => {
    const sub = subscribeQuests((data) => setQuests(data));
    const questPoll = setInterval(loadQuests, 30000);
    return () => {
      sub.unsubscribe();
      clearInterval(questPoll);
    };
  }, [loadQuests]);

  useEffect(() => {
    if (!connected || !publicKey) return;
    const sub = subscribeUserQuestProgress(publicKey.toBase58(), (list) => {
      const map: Record<string, UserQuestProgress> = {};
      list.forEach((p) => { map[p.quest_id] = p; });
      setProgressMap(map);
    });
    const interval = setInterval(loadProgress, 15000);
    return () => {
      sub.unsubscribe();
      clearInterval(interval);
    };
  }, [connected, publicKey, loadProgress]);

  const totalTP = quests.reduce((sum, q) => {
    const p = progressMap[q.id];
    const max = q.requirement_config?.max ?? 1;
    if (p && p.progress >= max) return sum + (q.reward_tp || 0);
    return sum;
  }, 0);

  const getProgress = (questId: string) => progressMap[questId]?.progress ?? 0;
  const getCompleted = (questId: string) => progressMap[questId]?.completed_at != null;

  const questCategories = React.useMemo(() => {
    const byCategory: Record<string, Quest[]> = {};
    CATEGORY_ORDER.forEach((c) => { byCategory[c] = []; });
    quests.forEach((q) => {
      if (!byCategory[q.category]) byCategory[q.category] = [];
      byCategory[q.category].push(q);
    });
    quests.forEach((q) => {
      if (!CATEGORY_ORDER.includes(q.category)) {
        if (!byCategory[q.category]) byCategory[q.category] = [];
        byCategory[q.category].push(q);
      }
    });
    return CATEGORY_ORDER.map((title) => ({
      title,
      quests: (byCategory[title] || []).sort((a, b) => a.sort_order - b.sort_order),
    })).filter((c) => c.quests.length > 0);
  }, [quests]);

  return (
    <div className="min-h-full bg-[#050505] overflow-x-hidden safe-top relative flex flex-col">
      <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-[#050505] sticky top-0 z-[60]">
        <h2 className="text-2xl font-[1000] italic uppercase tracking-tighter text-white">QUESTS</h2>
        <button
          onClick={onOpenGuide}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9945FF] via-[#3b82f6] to-[#14F195] flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <span className="text-white font-[1000] text-xl italic leading-none">?</span>
        </button>
      </div>

      <div className="p-6 md:p-12 lg:p-20 max-w-[1400px] mx-auto w-full pb-48 relative">
        <div className="relative z-10 mb-10 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8">
          <div className="flex-1">
            <h1 className="text-5xl sm:text-7xl md:text-[110px] font-[1000] italic leading-[0.75] tracking-tight uppercase text-white pr-8">
              MISSION<br /><span className="sol-gradient-text">BOARD</span>
            </h1>
            <div className="h-1.5 w-16 md:w-20 bg-[#14F195] mt-4 md:mt-6 shadow-[0_0_15px_#14F195]"></div>
          </div>

          <div className="bg-[#0A0A0A] border border-white/5 p-6 md:p-8 rounded-2xl md:rounded-3xl text-left md:text-right min-w-[240px] md:min-w-[280px] shadow-2xl">
            <span className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] mb-1 md:mb-2 italic block">TRIVIA POINTS</span>
            <div className="flex items-baseline gap-2 md:justify-end">
              <span className="text-[#14F195] text-4xl md:text-5xl font-[1000] italic leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(20,241,149,0.3)]">
                {loading ? '—' : totalTP.toLocaleString()}
              </span>
              <span className="text-[#14F195] text-[10px] md:text-sm font-black italic">TP</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-zinc-500 font-black uppercase tracking-widest italic">Loading quests...</p>
          </div>
        ) : (
          <div className="space-y-12 md:space-y-16 relative z-10">
            {questCategories.map((category, catIdx) => (
              <div key={catIdx}>
                <div className="flex items-center gap-4 mb-6 md:mb-8">
                  <h2 className="text-zinc-500 font-black uppercase text-[9px] md:text-[10px] tracking-[0.5em] whitespace-nowrap italic">{category.title}</h2>
                  <div className="h-[1px] w-full bg-gradient-to-r from-white/10 to-transparent"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
                  {category.quests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      progress={getProgress(quest.id)}
                      completed={getCompleted(quest.id)}
                      showInput={quest.slug === 'true_raider' && showRaiderInput}
                      inputValue={raiderUrl}
                      onInputChange={setRaiderUrl}
                      onGoToProfile={quest.slug === 'identity_sync' ? onGoToProfile : undefined}
                      onRaiderClick={quest.slug === 'true_raider' ? () => {
                        window.open('https://x.com/solana', '_blank');
                        setShowRaiderInput(true);
                      } : undefined}
                      onVerifyRaider={quest.slug === 'true_raider' ? async () => {
                        if (!publicKey || !raiderUrl.trim()) return;
                        setSubmitStatus('submitting');
                        setSubmitMessage('');
                        const { ok, error } = await submitQuestProof(publicKey.toBase58(), 'true_raider', raiderUrl.trim());
                        if (ok) {
                          setSubmitStatus('success');
                          setSubmitMessage('Submitted for review. You’ll get TP once approved.');
                          setRaiderUrl('');
                          setShowRaiderInput(false);
                          loadProgress();
                        } else {
                          setSubmitStatus('error');
                          setSubmitMessage(error || 'Submit failed');
                        }
                        setTimeout(() => setSubmitStatus('idle'), 4000);
                      } : undefined}
                      onClaim={connected && publicKey ? async (q) => {
                        const result = await claimQuestReward(publicKey.toBase58(), q.id);
                        if (result.success) loadProgress();
                        return result;
                      } : undefined}
                      submitStatus={submitStatus}
                      submitMessage={submitMessage}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface QuestCardProps {
  quest: Quest;
  progress: number;
  completed: boolean;
  showInput?: boolean;
  inputValue?: string;
  onInputChange?: (v: string) => void;
  onGoToProfile?: () => void;
  onRaiderClick?: () => void;
  onVerifyRaider?: () => void;
  onClaim?: (quest: Quest) => Promise<{ success: boolean; reward_tp?: number; error?: string }>;
  submitStatus?: 'idle' | 'submitting' | 'success' | 'error';
  submitMessage?: string;
}

const QuestCard: React.FC<QuestCardProps> = ({
  quest,
  progress,
  completed,
  showInput,
  inputValue,
  onInputChange,
  onGoToProfile,
  onRaiderClick,
  onVerifyRaider,
  onClaim,
  submitStatus = 'idle',
  submitMessage = '',
}) => {
  const [claimPopup, setClaimPopup] = React.useState<{ tp: number } | null>(null);
  const [claiming, setClaiming] = React.useState(false);
  const max = quest.requirement_config?.max ?? 1;
  const isClaimable = progress >= max && !completed;
  const progressPercent = max > 0 ? Math.min(100, Math.floor((progress / max) * 100)) : 0;
  const timeLeftPercent = 100 - progressPercent;

  let badgeColor = 'bg-[#14F195]';
  let badgeLabel = 'MISSION';
  if (quest.quest_type === 'ELITE') {
    badgeColor = 'bg-[#FFD700]';
    badgeLabel = 'ELITE UNIT';
  } else if (quest.quest_type === 'SOCIAL') {
    badgeColor = 'bg-[#3b82f6]';
    badgeLabel = 'SOCIAL MISSION';
  }

  const statusText = quest.slug === 'true_raider' ? 'START RAID' : (isClaimable ? 'CLAIM' : 'ACTIVE');
  const rewardLabel = quest.reward_label || `${quest.reward_tp?.toLocaleString() ?? 0} TP`;

  const handleAction = async () => {
    if (isClaimable) {
      if (!onClaim) {
        alert('Please connect wallet to claim rewards');
        return;
      }
      setClaiming(true);
      try {
        const result = await onClaim(quest);
        if (result.success && result.reward_tp != null) {
          setClaimPopup({ tp: result.reward_tp });
          setTimeout(() => setClaimPopup(null), 1100);
        } else if (result.error) {
          alert(result.error);
        }
      } finally {
        setClaiming(false);
      }
      return;
    }
    if (quest.slug === 'identity_sync') onGoToProfile?.();
    if (quest.slug === 'true_raider') onRaiderClick?.();
  };

  return (
    <div className={`relative bg-[#050505] border rounded-sm p-4 md:p-8 flex flex-col transition-all duration-300 ${isClaimable ? 'border-[#14F195] shadow-[0_0_30px_rgba(20,241,149,0.1)]' : 'border-white/5'}`}>
      {claimPopup && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="text-[#14F195] text-lg md:text-xl font-[1000] italic points-popup block">
            +{claimPopup.tp.toLocaleString()} TP
          </span>
        </div>
      )}
      <div className={`absolute top-0 right-0 px-2 md:px-3 py-0.5 md:py-1 ${badgeColor} text-black font-[1000] text-[7px] md:text-[8px] uppercase tracking-widest italic rounded-bl-sm shadow-md`}>
        {badgeLabel}
      </div>

      <div className="mb-3 md:mb-6">
        <h3 className="text-xl md:text-3xl font-[1000] italic uppercase tracking-tighter mb-1 md:mb-2 text-[#14F195] leading-none">
          {quest.title}
        </h3>
        <p className="text-zinc-500 text-[9px] md:text-xs font-black uppercase tracking-tight leading-relaxed italic">
          {quest.description}
        </p>
      </div>

      {showInput ? (
        <div className="mb-4 md:mb-8 animate-fade-in">
          <label className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-500 italic block mb-1 md:mb-2">Paste Post URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder="https://x.com/..."
              className="flex-1 bg-black border border-white/10 p-2 md:p-3 text-white font-bold text-[10px] md:text-xs focus:outline-none focus:border-[#14F195]/50 transition-all rounded-sm"
            />
            <button
              onClick={onVerifyRaider}
              disabled={submitStatus === 'submitting' || !inputValue?.trim()}
              className="px-3 md:px-4 bg-[#14F195] text-black font-black uppercase text-[8px] md:text-[9px] italic rounded-sm hover:scale-105 active:scale-95 shadow-md disabled:opacity-50"
            >
              {submitStatus === 'submitting' ? '…' : 'VERIFY'}
            </button>
          </div>
          {submitMessage && (
            <p className={`mt-2 text-[10px] font-bold italic ${submitStatus === 'error' ? 'text-red-400' : 'text-[#14F195]'}`}>
              {submitMessage}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-4 md:mb-8">
          <div className="flex justify-between items-end mb-1 md:mb-2">
            <span className="text-zinc-600 text-[8px] md:text-[9px] font-black uppercase italic tracking-widest">
              PROGRESS ({timeLeftPercent}% LEFT)
            </span>
            <span className="text-white text-[10px] md:text-sm font-[1000] italic">
              {progress}/{max}
            </span>
          </div>
          <div className="w-full h-1 md:h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-[#14F195]" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      )}

      <div className="mt-auto flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-zinc-600 text-[7px] md:text-[8px] font-black uppercase italic mb-0.5 md:mb-1 tracking-widest">BOUNTY</span>
          <span className="text-[#14F195] text-lg md:text-3xl font-[1000] italic leading-none">{rewardLabel}</span>
        </div>
        <button
          onClick={handleAction}
          disabled={isClaimable && claiming}
          className={`px-4 md:px-8 py-2 md:py-3 font-[1000] uppercase text-[9px] md:text-xs italic shadow-lg active:scale-95 transition-all rounded-sm disabled:opacity-70 ${isClaimable ? 'bg-[#14F195] text-black' : quest.slug === 'true_raider' ? 'bg-[#3b82f6] text-white' : 'bg-white/5 text-zinc-600'}`}
        >
          {isClaimable && claiming ? '…' : statusText}
        </button>
      </div>
    </div>
  );
};

export default QuestsView;
