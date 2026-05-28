/**
 * QuestsViewV2 — web W9. Lives inside WebShell. Editorial header + XP hero
 * + ALL/SOCIAL/CLAIMABLE tabs + quest rows + COMPLETED accordion (gated to
 * the CLAIMABLE tab), matching the native dApp.
 *
 * Real data: fetchQuests + fetchUserQuestProgress + fetchUserQuestSubmissions
 * + player_profiles.current_streak. Claim via claimQuestReward; social proof
 * via submitQuestProof (admin-approved, then claimable).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';
import {
  fetchQuests,
  fetchUserQuestProgress,
  fetchUserQuestSubmissions,
  claimQuestReward,
  submitQuestProof,
  type Quest,
  type QuestSubmissionStatus,
} from '../src/utils/api';

type Tab = 'ALL' | 'SOCIAL' | 'CLAIMABLE';
type SocialKind = 'x' | 'discord' | 'telegram';

const KIND_COLOR = {
  daily: '#14F195',
  weekly: '#14F195',
  social: '#3b82f6',
} as const;

type Kind = keyof typeof KIND_COLOR;

function kindOf(q: Quest): Kind {
  if (q.quest_type === 'SOCIAL') return 'social';
  if (q.quest_type === 'ELITE') return 'weekly';
  return 'daily';
}
function socialOf(q: Quest): SocialKind | undefined {
  if (q.quest_type !== 'SOCIAL') return undefined;
  const link = (q.requirement_config?.link || '').toLowerCase();
  const slug = q.slug.toLowerCase();
  if (link.includes('discord') || slug.includes('discord')) return 'discord';
  if (link.includes('t.me') || link.includes('telegram') || slug.includes('telegram')) return 'telegram';
  return 'x';
}
function requiresProof(q: Quest): boolean {
  const cfg = q.requirement_config as { requires_proof?: boolean } | undefined;
  if (cfg?.requires_proof === false) return false;
  return q.quest_type === 'SOCIAL' || q.slug === 'true_raider';
}

function SocialBadge({ kind }: { kind: SocialKind }) {
  if (kind === 'x') {
    return (
      <span style={{ width: 18, height: 18, background: '#fff', color: '#000', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>
        𝕏
      </span>
    );
  }
  if (kind === 'discord') {
    return (
      <span style={{ width: 18, height: 18, background: '#5865F2', color: '#fff', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }}>
        𝓓
      </span>
    );
  }
  return (
    <span style={{ width: 18, height: 18, background: '#26A5E4', borderRadius: '50%', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
      ✈
    </span>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="font-black italic uppercase rounded-full"
      style={{ fontSize: 8, color, background: `${color}22`, border: `1px solid ${color}55`, padding: '3px 8px', letterSpacing: '0.14em' }}
    >
      {children}
    </span>
  );
}

interface RowProps {
  q: Quest;
  progress: number;
  claimed: boolean;
  submission?: QuestSubmissionStatus;
  busy: boolean;
  proofUrl: string;
  showProof: boolean;
  onSetProofUrl: (v: string) => void;
  onClaim: () => void;
  onStart: () => void;
  onVerify: () => void;
}

function QuestRow({ q, progress, claimed, submission, busy, proofUrl, showProof, onSetProofUrl, onClaim, onStart, onVerify }: RowProps) {
  const kind = kindOf(q);
  const tagColor = KIND_COLOR[kind];
  const social = socialOf(q);
  const big = q.quest_type === 'ELITE';
  const max = q.requirement_config?.max ?? 1;
  const pct = max ? Math.min(100, (progress / max) * 100) : 0;
  const claimable = !claimed && progress >= max;
  const isSocial = kind === 'social';
  const pending = submission === 'pending';

  // Button state machine.
  let label = 'ACTIVE';
  let actionable = false;
  let primary = false;
  if (claimed) {
    label = 'CLAIMED ✓';
  } else if (claimable) {
    label = 'CLAIM';
    actionable = true;
    primary = true;
  } else if (pending) {
    label = 'PENDING';
  } else if (isSocial) {
    label = 'START';
    actionable = true;
  }

  const onClick = () => {
    if (busy) return;
    if (claimable) onClaim();
    else if (isSocial && !pending) onStart();
  };

  return (
    <div
      className="rounded-xl"
      style={{
        background: '#0c0c0c',
        border: `1px solid ${big ? '#14F195' : 'rgba(255,255,255,0.08)'}`,
        padding: '14px 16px',
        opacity: claimed ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Tag color={tagColor}>{kind.toUpperCase()}</Tag>
            {social ? <SocialBadge kind={social} /> : null}
            {big ? <Tag color="#14F195">BIG REWARD</Tag> : null}
            {pending ? <Tag color="#FFD700">IN REVIEW</Tag> : null}
          </div>
          <div className="font-black italic uppercase text-white" style={{ fontSize: 15, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {q.title}
          </div>
          <div className="font-black italic uppercase mt-1" style={{ fontSize: 10, color: '#e4e4e7', letterSpacing: '0.12em' }}>
            {q.description}
          </div>
          {max > 1 && !claimed ? (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: '#1a1a1a' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#14F195' : tagColor }} />
              </div>
              <span className="font-black italic uppercase" style={{ fontSize: 9, color: '#a1a1aa', letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}>
                {progress.toLocaleString()}/{max.toLocaleString()}
              </span>
            </div>
          ) : null}
        </div>
        <div className="text-right">
          <div className="font-black italic" style={{ fontSize: 20, color: '#14F195', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            +{(q.reward_tp ?? 0).toLocaleString()}
          </div>
          <div className="font-black italic uppercase" style={{ fontSize: 8, color: '#71717a', letterSpacing: '0.14em' }}>
            XP
          </div>
        </div>
        <button
          disabled={!actionable || busy}
          onClick={onClick}
          className="font-black italic uppercase rounded-full active:opacity-90"
          style={{
            background: primary ? '#14F195' : 'transparent',
            border: primary ? 'none' : '1px solid rgba(255,255,255,0.25)',
            color: primary ? '#000' : claimed ? '#52525b' : actionable ? '#fff' : '#52525b',
            padding: '8px 18px',
            fontSize: 11,
            letterSpacing: '0.14em',
            minWidth: 80,
            cursor: actionable && !busy ? 'pointer' : 'default',
          }}
        >
          {busy ? '…' : label}
        </button>
      </div>

      {/* Proof input — appears after START on a proof-requiring social quest. */}
      {showProof && !claimed ? (
        <div className="flex gap-2 mt-3">
          <input
            value={proofUrl}
            onChange={(e) => onSetProofUrl(e.target.value)}
            placeholder="Paste your post / proof URL"
            className="flex-1 rounded-lg"
            style={{
              background: '#000',
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '10px 12px',
              fontSize: 12,
              color: '#fff',
              outline: 'none',
            }}
          />
          <button
            disabled={busy || !proofUrl.trim()}
            onClick={onVerify}
            className="font-black italic uppercase rounded-lg active:opacity-90"
            style={{
              background: proofUrl.trim() ? '#14F195' : '#0F0F0F',
              border: proofUrl.trim() ? 'none' : '1px solid rgba(255,255,255,0.08)',
              color: proofUrl.trim() ? '#000' : '#52525b',
              padding: '10px 16px',
              fontSize: 11,
              letterSpacing: '0.14em',
              cursor: proofUrl.trim() && !busy ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? '…' : 'VERIFY'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const QuestsViewV2: React.FC = () => {
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [tab, setTab] = useState<Tab>('ALL');
  const [showCompleted, setShowCompleted] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, { progress: number; claimed: boolean }>>({});
  const [subMap, setSubMap] = useState<Record<string, QuestSubmissionStatus>>({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [showProof, setShowProof] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      const qs = await fetchQuests();
      setQuests(qs);
    } catch {
      setQuests([]);
    }
    if (!connected || !wallet) {
      setProgressMap({});
      setSubMap({});
      setStreak(0);
      return;
    }
    try {
      const [rows, subs, profileRes] = await Promise.all([
        fetchUserQuestProgress(wallet),
        fetchUserQuestSubmissions(wallet).catch(() => []),
        supabase.from('player_profiles').select('current_streak').eq('wallet_address', wallet).maybeSingle(),
      ]);
      const pm: Record<string, { progress: number; claimed: boolean }> = {};
      rows.forEach((r) => { pm[r.quest_id] = { progress: r.progress ?? 0, claimed: r.claimed_at != null }; });
      setProgressMap(pm);
      const sm: Record<string, QuestSubmissionStatus> = {};
      subs.forEach((s) => { if (!sm[s.quest_id]) sm[s.quest_id] = s.status; });
      setSubMap(sm);
      setStreak((profileRes.data as { current_streak?: number } | null)?.current_streak ?? 0);
    } catch {
      /* non-fatal — empty progress is the right default for a fresh wallet */
    }
  }, [connected, wallet]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    loadData().finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [loadData]);

  // Light polling so progress + claim state stay fresh while the tab is open.
  useEffect(() => {
    if (!connected || !wallet) return;
    const id = setInterval(loadData, 15000);
    return () => clearInterval(id);
  }, [connected, wallet, loadData]);

  const progOf = (id: string) => progressMap[id]?.progress ?? 0;
  const claimedOf = (id: string) => !!progressMap[id]?.claimed;
  const maxOf = (q: Quest) => q.requirement_config?.max ?? 1;
  const claimableOf = (q: Quest) => !claimedOf(q.id) && progOf(q.id) >= maxOf(q);

  const totalXp = useMemo(
    () => quests.reduce((sum, q) => (claimedOf(q.id) ? sum + (q.reward_tp || 0) : sum), 0),
    [quests, progressMap],
  );
  const readyToClaim = useMemo(
    () => quests.reduce((sum, q) => (claimableOf(q) ? sum + (q.reward_tp || 0) : sum), 0),
    [quests, progressMap],
  );

  const { active, completed } = useMemo(() => {
    const a: Quest[] = [];
    const c: Quest[] = [];
    for (const q of quests) {
      if (claimedOf(q.id)) { c.push(q); continue; }
      if (tab === 'SOCIAL' && q.quest_type !== 'SOCIAL') continue;
      if (tab === 'CLAIMABLE' && !claimableOf(q)) continue;
      a.push(q);
    }
    a.sort((x, y) => Number(claimableOf(y)) - Number(claimableOf(x)));
    return { active: a, completed: c };
  }, [quests, tab, progressMap]);

  const counts = useMemo(() => ({
    ALL: quests.filter((q) => !claimedOf(q.id)).length,
    SOCIAL: quests.filter((q) => q.quest_type === 'SOCIAL' && !claimedOf(q.id)).length,
    CLAIMABLE: quests.filter((q) => claimableOf(q)).length,
  }), [quests, progressMap]);

  const handleClaim = async (q: Quest) => {
    if (!wallet || busyKey) return;
    setBusyKey(q.id);
    try {
      const res = await claimQuestReward(wallet, q.id);
      if (res.success) {
        setProgressMap((prev) => ({ ...prev, [q.id]: { progress: maxOf(q), claimed: true } }));
        loadData();
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleStart = (q: Quest) => {
    const link = q.requirement_config?.link || (q.slug === 'true_raider' ? 'https://x.com/soltrivia_app' : '');
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    if (requiresProof(q)) {
      setShowProof((prev) => ({ ...prev, [q.id]: true }));
      return;
    }
    // Simple follow/join — mark claimable locally; user still taps CLAIM to award XP.
    setProgressMap((prev) => ({ ...prev, [q.id]: { progress: maxOf(q), claimed: false } }));
  };

  const handleVerify = async (q: Quest) => {
    const url = (proofUrls[q.id] || '').trim();
    if (!url || !wallet || busyKey) return;
    setBusyKey(q.id);
    try {
      const res = await submitQuestProof(wallet, q.slug, url);
      if (res.ok) {
        setShowProof((prev) => ({ ...prev, [q.id]: false }));
        setProofUrls((prev) => ({ ...prev, [q.id]: '' }));
        loadData();
      }
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}>
          COMPLETE TO EARN XP
        </div>
        <h1 className="font-black italic uppercase mt-1 text-white" style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          QUESTS
        </h1>
      </div>

      {/* XP hero */}
      <div className="rounded-2xl mb-4 flex items-center justify-between gap-6" style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.08)', padding: '18px 22px' }}>
        <div>
          <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}>
            TOTAL XP EARNED FROM QUESTS
          </div>
          <div className="font-black italic mt-1 text-white" style={{ fontSize: 54, lineHeight: 0.9, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {loading ? '—' : totalXp.toLocaleString()}
          </div>
        </div>
        <div className="flex gap-6 items-end">
          <div className="text-right">
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}>
              DAY STREAK
            </div>
            <div className="font-black italic mt-1 text-white" style={{ fontSize: 22, letterSpacing: '-0.02em' }}>
              🔥 {loading ? '—' : streak}
            </div>
          </div>
          <div className="text-right">
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}>
              READY TO CLAIM
            </div>
            <div className="font-black italic mt-1" style={{ fontSize: 22, color: '#FFD700', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
              +{loading ? '—' : readyToClaim.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['ALL', 'SOCIAL', 'CLAIMABLE'] as Tab[]).map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="font-black italic uppercase rounded-full active:opacity-90"
              style={{
                background: on ? 'rgba(20,241,149,0.13)' : 'transparent',
                border: `1px solid ${on ? '#14F195' : 'rgba(255,255,255,0.1)'}`,
                color: on ? '#14F195' : '#a1a1aa',
                padding: '8px 16px',
                fontSize: 11,
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              {id} <span style={{ opacity: 0.6, marginLeft: 4 }}>· {counts[id]}</span>
            </button>
          );
        })}
      </div>

      {/* Connect prompt */}
      {!connected ? (
        <div className="rounded-xl flex flex-col items-center justify-center gap-2" style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.08)', height: 200 }}>
          <span className="font-black italic uppercase text-white" style={{ fontSize: 15 }}>CONNECT TO TRACK QUESTS</span>
          <span className="font-black italic uppercase" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.14em' }}>EARN XP FOR EVERY MISSION</span>
        </div>
      ) : loading ? (
        <div className="rounded-xl flex items-center justify-center" style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.08)', height: 200 }}>
          <span className="font-black italic uppercase" style={{ fontSize: 11, color: '#52525b', letterSpacing: '0.18em' }}>LOADING…</span>
        </div>
      ) : (
        <>
          {/* Quest rows (active = unclaimed) */}
          <div className="flex flex-col gap-2">
            {active.length === 0 ? (
              <div className="rounded-xl flex items-center justify-center" style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.08)', height: 120 }}>
                <span className="font-black italic uppercase" style={{ fontSize: 11, color: '#52525b', letterSpacing: '0.14em' }}>
                  {tab === 'CLAIMABLE' ? 'NOTHING TO CLAIM YET' : 'ALL CAUGHT UP'}
                </span>
              </div>
            ) : (
              active.map((q) => (
                <QuestRow
                  key={q.id}
                  q={q}
                  progress={progOf(q.id)}
                  claimed={claimedOf(q.id)}
                  submission={subMap[q.id]}
                  busy={busyKey === q.id}
                  proofUrl={proofUrls[q.id] || ''}
                  showProof={!!showProof[q.id]}
                  onSetProofUrl={(v) => setProofUrls((prev) => ({ ...prev, [q.id]: v }))}
                  onClaim={() => handleClaim(q)}
                  onStart={() => handleStart(q)}
                  onVerify={() => handleVerify(q)}
                />
              ))
            )}
          </div>

          {/* COMPLETED accordion — only in the CLAIMABLE tab, collapsed by default */}
          {tab === 'CLAIMABLE' && completed.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="w-full flex items-center rounded-xl active:opacity-90"
                style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', cursor: 'pointer' }}
              >
                <span className="font-black italic uppercase flex-1 text-left" style={{ fontSize: 11, letterSpacing: '0.14em', color: '#a1a1aa' }}>
                  COMPLETED · {completed.length}
                </span>
                <span className="font-black" style={{ fontSize: 14, color: '#a1a1aa' }}>{showCompleted ? '▾' : '▸'}</span>
              </button>
              {showCompleted ? (
                <div className="flex flex-col gap-2 mt-2">
                  {completed.map((q) => (
                    <QuestRow
                      key={`done-${q.id}`}
                      q={q}
                      progress={maxOf(q)}
                      claimed
                      submission={subMap[q.id]}
                      busy={false}
                      proofUrl=""
                      showProof={false}
                      onSetProofUrl={() => {}}
                      onClaim={() => {}}
                      onStart={() => {}}
                      onVerify={() => {}}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuestsViewV2;
