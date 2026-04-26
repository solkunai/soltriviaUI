import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWallet } from '../src/contexts/WalletContext';
import { fetchQuests, fetchUserQuestProgress, subscribeUserQuestProgress, subscribeQuests, submitQuestProof, claimQuestReward, fetchUserQuestSubmissions, type Quest, type UserQuestProgress, type QuestSubmissionStatus } from '../src/utils/api';

interface QuestsViewProps {
  onGoToProfile?: () => void;
  onOpenGuide?: () => void;
}

const CATEGORY_ORDER = ['Priority Mission', 'Social Operations', 'Active Operations'];

const QuestsView: React.FC<QuestsViewProps> = ({ onGoToProfile, onOpenGuide }) => {
  const { t } = useTranslation();
  const { publicKey, connected } = useWallet();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserQuestProgress>>({});
  const [submissionStatusMap, setSubmissionStatusMap] = useState<Record<string, QuestSubmissionStatus>>({});
  const [loading, setLoading] = useState(true);
  // Per-quest proof input state (keyed by quest id) so multiple proof-requiring quests
  // can have independent inputs at the same time.
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [showProofInput, setShowProofInput] = useState<Record<string, boolean>>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const [rewardToast, setRewardToast] = useState<{ tp: number } | null>(null);

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
      setSubmissionStatusMap({});
      return;
    }
    try {
      const wallet = publicKey.toBase58();
      const [list, submissions] = await Promise.all([
        fetchUserQuestProgress(wallet),
        fetchUserQuestSubmissions(wallet).catch(() => []),
      ]);
      const map: Record<string, UserQuestProgress> = {};
      list.forEach((p) => { map[p.quest_id] = p; });
      setProgressMap(map);
      // submissions arrive ordered DESC by created_at — first occurrence is latest per quest
      const subMap: Record<string, QuestSubmissionStatus> = {};
      submissions.forEach((s) => { if (!subMap[s.quest_id]) subMap[s.quest_id] = s.status; });
      setSubmissionStatusMap(subMap);
    } catch {
      setProgressMap({});
      setSubmissionStatusMap({});
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
  const getClaimed = (questId: string) => progressMap[questId]?.claimed_at != null;

  // Every SOCIAL quest gets a proof-link input by default — the user clicks the quest's
  // link, completes the action, then pastes the resulting URL (their tweet, their post,
  // etc.) for verification. Admin can opt out a specific quest with
  // `requires_proof: false` in its requirement_config.
  const questRequiresProof = (q: Quest): boolean => {
    const cfg = q.requirement_config as { requires_proof?: boolean } | undefined;
    if (cfg?.requires_proof === false) return false;
    return q.quest_type === 'SOCIAL' || q.slug === 'true_raider';
  };

  const setProofUrl = (questId: string, value: string) => {
    setProofUrls((prev) => ({ ...prev, [questId]: value }));
  };

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
      {rewardToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl bg-[#14F195]/20 border border-[#14F195]/50 shadow-lg animate-fade-in">
          <p className="text-[#14F195] font-black text-sm md:text-base uppercase tracking-wide">{t('quests.claimedToast')}</p>
          <p className="text-white font-bold text-lg md:text-xl">{t('quests.claimedToastMessage', { reward: rewardToast.tp.toLocaleString() })}</p>
        </div>
      )}
      <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-[#050505] sticky top-0 z-[60]">
        <h2 className="text-2xl font-[1000] italic uppercase tracking-tighter text-white">{t('quests.title')}</h2>
        <button
          onClick={onOpenGuide}
          className="w-10 h-10 rounded-full bg-[#14F195] flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <span className="text-black font-[1000] text-xl italic leading-none">?</span>
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
            <span className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] mb-1 md:mb-2 italic block">{t('quests.triviaPoints')}</span>
            <div className="flex items-baseline gap-2 md:justify-end">
              <span className="text-[#14F195] text-4xl md:text-5xl font-[1000] italic leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(20,241,149,0.3)]">
                {loading ? '—' : totalTP.toLocaleString()}
              </span>
              <span className="text-[#14F195] text-[10px] md:text-sm font-black italic">{t('quests.tp')}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-zinc-500 font-black uppercase tracking-widest italic">{t('quests.loadingQuests')}</p>
          </div>
        ) : (
          <div className="space-y-12 md:space-y-16 relative z-10">
            {questCategories.map((category, catIdx) => (
              <div key={catIdx}>
                <div className="flex items-center gap-4 mb-6 md:mb-8">
                  <h2 className="text-zinc-500 font-black uppercase text-[9px] md:text-[10px] tracking-[0.5em] whitespace-nowrap italic">{
                    category.title === 'Priority Mission' ? t('quests.priorityMission') :
                    category.title === 'Social Operations' ? t('quests.socialOperations') :
                    category.title === 'Active Operations' ? t('quests.activeOperations') :
                    category.title
                  }</h2>
                  <div className="h-[1px] w-full bg-gradient-to-r from-white/10 to-transparent"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
                  {category.quests.map((quest) => {
                    const requiresProof = questRequiresProof(quest);
                    const currentProofUrl = proofUrls[quest.id] || '';
                    const inputOpen = !!showProofInput[quest.id];
                    const subStatus = submissionStatusMap[quest.id];
                    const isPendingReview = requiresProof && subStatus === 'pending' && !getClaimed(quest.id);
                    const isRejected = requiresProof && subStatus === 'rejected' && !getClaimed(quest.id);
                    return (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      progress={getProgress(quest.id)}
                      completed={getCompleted(quest.id)}
                      claimed={getClaimed(quest.id)}
                      submissionStatus={subStatus}
                      showInput={requiresProof && inputOpen && !getClaimed(quest.id) && !isPendingReview}
                      inputValue={currentProofUrl}
                      onInputChange={(val) => setProofUrl(quest.id, val)}
                      onGoToProfile={quest.slug === 'identity_sync' ? onGoToProfile : undefined}
                      onRaiderClick={quest.quest_type === 'SOCIAL' && !getClaimed(quest.id) && !isPendingReview ? () => {
                        const link = (quest.requirement_config as { link?: string })?.link || (quest.slug === 'true_raider' ? 'https://x.com/soltrivia_app' : '');
                        if (link) window.open(link, '_blank');
                        if (requiresProof) setShowProofInput((prev) => ({ ...prev, [quest.id]: true }));
                      } : undefined}
                      onVerifyRaider={requiresProof ? async () => {
                        if (!publicKey || !currentProofUrl.trim()) return;
                        setSubmitStatus('submitting');
                        setSubmitMessage('');
                        const { ok, error, message, auto_claimed, reward_tp } = await submitQuestProof(publicKey.toBase58(), quest.slug, currentProofUrl.trim());
                        if (ok) {
                          setSubmitStatus('success');
                          setSubmitMessage(auto_claimed ? (message || 'Quest completed! Your reward has been added.') : (message || 'Submitted for review. You’ll get TP once approved.'));
                          setProofUrl(quest.id, '');
                          setShowProofInput((prev) => ({ ...prev, [quest.id]: false }));
                          loadProgress();
                          if (auto_claimed && reward_tp != null) {
                            setRewardToast({ tp: reward_tp });
                            setTimeout(() => setRewardToast(null), 4000);
                          }
                        } else {
                          setSubmitStatus('error');
                          setSubmitMessage(error || 'Submit failed');
                        }
                        setTimeout(() => setSubmitStatus('idle'), 4000);
                      } : undefined}
                      onClaim={connected && publicKey ? async (q) => {
                        const result = await claimQuestReward(publicKey.toBase58(), q.id);
                        if (result.success) {
                          loadProgress();
                          if (result.reward_tp != null) {
                            setRewardToast({ tp: result.reward_tp });
                            setTimeout(() => setRewardToast(null), 4000);
                          }
                        }
                        return result;
                      } : undefined}
                      submitStatus={submitStatus}
                      submitMessage={submitMessage}
                    />
                    );
                  })}
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
  claimed?: boolean;
  submissionStatus?: QuestSubmissionStatus;
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
  claimed = false,
  submissionStatus,
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
  const { t } = useTranslation();
  const [claimPopup, setClaimPopup] = React.useState<{ tp: number } | null>(null);
  const [claiming, setClaiming] = React.useState(false);
  const max = quest.requirement_config?.max ?? 1;
  const isClaimable = progress >= max && !completed;
  const progressPercent = max > 0 ? Math.min(100, Math.floor((progress / max) * 100)) : 0;
  const timeLeftPercent = 100 - progressPercent;

  let badgeColor = 'bg-[#14F195]';
  let badgeLabel = t('quests.mission');
  if (quest.quest_type === 'ELITE') {
    badgeColor = 'bg-[#FFD700]';
    badgeLabel = t('quests.eliteUnit');
  } else if (quest.quest_type === 'SOCIAL') {
    badgeColor = 'bg-[#3b82f6]';
    badgeLabel = t('quests.socialMission');
  }

  const isPendingReview = submissionStatus === 'pending' && !claimed;
  const isRejected = submissionStatus === 'rejected' && !claimed && !isClaimable;
  const isActionableSocial = quest.quest_type === 'SOCIAL' && !!onRaiderClick && !claimed && !isClaimable && !isPendingReview;
  const statusText = isPendingReview
    ? 'Awaiting review'
    : claimed
      ? t('quests.claimedStatus')
      : isClaimable
        ? t('quests.claimStatus')
        : isRejected
          ? 'Rejected — Resubmit'
          : isActionableSocial
            ? t('quests.startRaid') // reuse the "Start" CTA copy for any social mission
            : quest.slug === 'true_raider'
              ? t('quests.startRaid')
              : t('quests.active');
  const rewardLabel = quest.reward_label || `${quest.reward_tp?.toLocaleString() ?? 0} TP`;

  const handleAction = async () => {
    if (claimed) return;
    if (isPendingReview) return;
    if (isClaimable) {
      if (!onClaim) {
        alert(t('quests.connectWalletAlert'));
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
    // Any quest the parent has wired up onRaiderClick for (every SOCIAL quest by default)
    // can be "started" from this button — opens the link, surfaces the proof input.
    if (!claimed && onRaiderClick && quest.slug !== 'identity_sync') onRaiderClick();
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
          <label className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-500 italic block mb-1 md:mb-2">{t('quests.pastePostUrl')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              placeholder={t('quests.xComPlaceholder')}
              className="flex-1 bg-black border border-white/10 p-2 md:p-3 text-white font-bold text-[10px] md:text-xs focus:outline-none focus:border-[#14F195]/50 transition-all rounded-sm"
            />
            <button
              onClick={onVerifyRaider}
              disabled={submitStatus === 'submitting' || !inputValue?.trim()}
              className="px-3 md:px-4 bg-[#14F195] text-black font-black uppercase text-[8px] md:text-[9px] italic rounded-sm hover:scale-105 active:scale-95 shadow-md disabled:opacity-50"
            >
              {submitStatus === 'submitting' ? '…' : t('quests.verify')}
            </button>
          </div>
          {submitMessage && (
            <p className={`mt-2 text-[10px] font-bold italic ${submitStatus === 'error' ? 'text-red-400' : 'text-[#14F195]'}`}>
              {submitMessage}
            </p>
          )}
        </div>
      ) : isPendingReview ? (
        <div className="mb-4 md:mb-8 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-sm">
          <p className="text-yellow-300 text-[10px] md:text-xs font-black italic uppercase tracking-wider">Proof submitted — admin reviewing</p>
          <p className="text-yellow-200/70 text-[9px] md:text-[10px] font-bold italic mt-0.5">You'll see a Claim button when approved.</p>
        </div>
      ) : isRejected ? (
        <div className="mb-4 md:mb-8 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-sm">
          <p className="text-red-400 text-[10px] md:text-xs font-black italic uppercase tracking-wider">Submission rejected</p>
          <p className="text-red-300/70 text-[9px] md:text-[10px] font-bold italic mt-0.5">Tap Resubmit to try again with a new link.</p>
        </div>
      ) : (
        <div className="mb-4 md:mb-8">
          <div className="flex justify-between items-end mb-1 md:mb-2">
            <span className="text-zinc-600 text-[8px] md:text-[9px] font-black uppercase italic tracking-widest">
              {t('quests.progressLabel', { percent: timeLeftPercent })}
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
          <span className="text-zinc-600 text-[7px] md:text-[8px] font-black uppercase italic mb-0.5 md:mb-1 tracking-widest">{t('quests.bounty')}</span>
          <span className="text-[#14F195] text-lg md:text-3xl font-[1000] italic leading-none">{rewardLabel}</span>
        </div>
        <button
          onClick={handleAction}
          disabled={(isClaimable && claiming) || claimed || isPendingReview}
          className={`px-4 md:px-8 py-2 md:py-3 font-[1000] uppercase text-[9px] md:text-xs italic shadow-lg active:scale-95 transition-all rounded-sm disabled:opacity-70 ${isClaimable ? 'bg-[#14F195] text-black' : claimed ? 'bg-white/5 text-zinc-500 cursor-default' : isPendingReview ? 'bg-yellow-500/20 text-yellow-300 cursor-default' : isRejected ? 'bg-red-500/30 text-red-300' : (quest.slug === 'true_raider' || isActionableSocial) ? 'bg-[#3b82f6] text-white' : 'bg-white/5 text-zinc-600'}`}
        >
          {isClaimable && claiming ? '…' : statusText}
        </button>
      </div>
    </div>
  );
};

export default QuestsView;
