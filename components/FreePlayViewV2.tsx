/**
 * FreePlayViewV2 — web Free Play / Train Up page. Lives inside WebShell.
 * Real categories (from practice_questions) + real profile stats. Picking a
 * category starts that category's practice via onStartCategory.
 *
 * Game Pass gate: Pass = unlimited + pick any category. No Pass = limited
 * free games + Mixed only. No per-category played/accuracy is shown because
 * practice results aren't tracked server-side.
 */
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { useWallet } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';

interface Props {
  hasGamePass?: boolean;
  practiceRunsLeft?: number;
  /** Starts practice for a category id, or 'all' for Mixed. */
  onStartCategory?: (category: string) => void;
  onBuyGamePass?: () => void;
}

// The seven substantial practice categories, mapped to real practice_questions
// category ids. Niche crypto categories (memecoins, nfts, defi…) have few Qs
// and are left for a future deep-cuts section.
const CATEGORIES = [
  { id: 'sports', label: 'SPORTS', sub: 'GOALS · RECORDS', color: '#14F195' },
  { id: 'history', label: 'HISTORY', sub: 'EMPIRES · WARS', color: '#FFD700' },
  { id: 'entertainment', label: 'ENTERTAINMENT', sub: 'FILM · MUSIC', color: '#a855f7' },
  { id: 'geography', label: 'GEOGRAPHY', sub: 'MAPS · CAPITALS', color: '#3b82f6' },
  { id: 'science', label: 'SCIENCE & TECH', sub: 'PHYSICS · BIO', color: '#22D3EE' },
  { id: 'crypto', label: 'CRYPTO & WEB3', sub: 'CHAINS · DEFI', color: '#F472B6' },
  { id: 'general', label: 'GENERAL', sub: 'TRIVIA · MIX', color: '#a1a1aa' },
];

type Stats = { xp: number; games: number; streak: number; best: number } | null;

const FreePlayViewV2: React.FC<Props> = ({
  hasGamePass,
  practiceRunsLeft = 0,
  onStartCategory,
  onBuyGamePass,
}) => {
  const isMobile = useIsMobile();
  const { publicKey, connected } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;

  const [pick, setPick] = useState<string>('mixed');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Stats>(null);

  // Real per-category question counts.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const results = await Promise.all(
        CATEGORIES.map((c) =>
          supabase.from('practice_questions').select('id', { count: 'exact', head: true }).eq('category', c.id),
        ),
      );
      if (!mounted) return;
      const next: Record<string, number> = {};
      CATEGORIES.forEach((c, i) => { next[c.id] = results[i].count ?? 0; });
      setCounts(next);
    })();
    return () => { mounted = false; };
  }, []);

  // Real profile stats.
  useEffect(() => {
    let mounted = true;
    if (!connected || !wallet) {
      setStats(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('player_profiles')
        .select('total_points, total_games_played, current_streak, highest_score')
        .eq('wallet_address', wallet)
        .maybeSingle();
      if (!mounted) return;
      const d = data as any;
      setStats(
        d
          ? {
              xp: Number(d.total_points) || 0,
              games: Number(d.total_games_played) || 0,
              streak: Number(d.current_streak) || 0,
              best: Number(d.highest_score) || 0,
            }
          : { xp: 0, games: 0, streak: 0, best: 0 },
      );
    })();
    return () => { mounted = false; };
  }, [connected, wallet]);

  const freeGamesRemaining = hasGamePass ? Infinity : Math.max(0, practiceRunsLeft);
  const canPickCategory = !!hasGamePass;
  const canPlayMixed = hasGamePass || freeGamesRemaining > 0;

  const selectedColor =
    pick === 'mixed' ? '#14F195' : CATEGORIES.find((c) => c.id === pick)?.color || '#14F195';

  const handlePick = (id: string) => {
    if (!canPickCategory && id !== 'mixed') return;
    setPick(id);
  };
  const start = () => {
    if (!canPlayMixed) return;
    onStartCategory?.(pick === 'mixed' ? 'all' : pick);
  };

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div className="font-black italic uppercase" style={{ fontSize: 11, color: '#14F195', letterSpacing: '0.18em' }}>
          FREE PLAY · NO STAKES
        </div>
        <h1 className="font-black italic uppercase mt-1 text-white" style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          TRAIN <span style={{ color: '#14F195' }}>UP</span>
        </h1>
        {!hasGamePass && (
          <div className="font-black italic uppercase mt-2" style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}>
            {freeGamesRemaining} FREE PLAYS LEFT · MIXED ONLY
          </div>
        )}
      </div>

      {/* Lifetime stats strip — real profile stats */}
      <div className="rounded-2xl mb-4 flex" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', padding: '14px 0' }}>
        {[
          { label: 'TOTAL XP', value: stats ? fmt(stats.xp) : '—', color: '#fff' },
          { label: 'GAMES', value: stats ? String(stats.games) : '—', color: '#14F195' },
          { label: 'STREAK', value: stats ? `🔥 ${stats.streak}` : '—', color: '#FFD700' },
          { label: 'BEST SCORE', value: stats ? fmt(stats.best) : '—', color: '#F472B6' },
        ].map((s, i) => (
          <div key={s.label} className="flex-1 text-center" style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none', padding: '0 12px' }}>
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.18em' }}>
              {s.label}
            </div>
            <div className="font-black italic mt-1" style={{ fontSize: 22, color: s.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* All categories */}
      <div className="font-black italic uppercase mb-2" style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}>
        ALL CATEGORIES{!hasGamePass ? ' · PASS TO UNLOCK' : ''}
      </div>
      <div className="mb-3" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
        {CATEGORIES.map((c) => {
          const sel = pick === c.id;
          const count = counts[c.id];
          return (
            <button
              key={c.id}
              onClick={() => handlePick(c.id)}
              className="text-left rounded-xl active:opacity-90"
              style={{
                background: sel ? `${c.color}1F` : '#0a0a0a',
                border: `1.5px solid ${sel ? c.color : `${c.color}55`}`,
                padding: '12px 14px',
                color: '#fff',
                cursor: canPickCategory ? 'pointer' : 'not-allowed',
                opacity: canPickCategory ? 1 : 0.45,
              }}
            >
              <div className="font-black italic uppercase" style={{ fontSize: 12, color: c.color, letterSpacing: '-0.01em' }}>
                {c.label.split(' & ')[0].split(' ')[0]}
              </div>
              <div className="font-black italic uppercase mt-1" style={{ fontSize: 8, color: '#52525b', letterSpacing: '0.14em' }}>
                {c.sub}
              </div>
              <div className="font-black italic uppercase mt-3" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}>
                {count != null ? `${count.toLocaleString()} QUESTIONS` : '…'}
              </div>
            </button>
          );
        })}
      </div>

      {/* MIXED tile */}
      <button
        onClick={() => handlePick('mixed')}
        className="w-full rounded-xl flex items-center gap-3 active:opacity-90 mb-4"
        style={{
          background: pick === 'mixed' ? 'rgba(20,241,149,0.08)' : '#0a0a0a',
          border: `1.5px dashed ${pick === 'mixed' ? '#14F195' : 'rgba(255,255,255,0.2)'}`,
          padding: '14px 18px',
          color: '#fff',
          cursor: canPlayMixed ? 'pointer' : 'not-allowed',
          opacity: canPlayMixed ? 1 : 0.55,
        }}
      >
        <div className="rounded-md flex items-center justify-center" style={{ width: 34, height: 34, background: 'rgba(20,241,149,0.13)', border: '1px solid rgba(20,241,149,0.33)', color: '#14F195' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14F195" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black italic uppercase" style={{ fontSize: 15, letterSpacing: '-0.01em' }}>
            MIXED · SURPRISE ME
          </div>
          <div className="font-black italic uppercase mt-1" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}>
            RANDOM QUESTIONS ACROSS ALL CATEGORIES
          </div>
        </div>
        <span className="font-black italic" style={{ fontSize: 18, color: '#14F195' }}>→</span>
      </button>

      {/* Game Pass nudge */}
      {!hasGamePass && (
        <button
          onClick={onBuyGamePass}
          className="w-full rounded-xl flex items-center gap-3 active:opacity-90 mb-4"
          style={{ background: 'rgba(20,241,149,0.08)', border: '1px solid rgba(20,241,149,0.4)', padding: '14px 18px', color: '#fff', cursor: 'pointer' }}
        >
          <div className="flex-1 text-left">
            <div className="font-black italic uppercase" style={{ fontSize: 11, color: '#14F195', letterSpacing: '0.14em' }}>
              UNLOCK ALL CATEGORIES
            </div>
            <div className="text-zinc-300 font-bold mt-1" style={{ fontSize: 11, lineHeight: 1.3 }}>
              Game Pass = unlimited practice + pick any category
            </div>
          </div>
          <span className="font-black italic uppercase" style={{ fontSize: 13, color: '#14F195', letterSpacing: '0.14em' }}>
            GET →
          </span>
        </button>
      )}

      {/* Sticky CTA */}
      <button
        onClick={start}
        disabled={!canPlayMixed}
        className="w-full font-black italic uppercase rounded-full active:opacity-90"
        style={{
          background: canPlayMixed ? selectedColor : '#1a1a1a',
          color: canPlayMixed ? '#000' : '#52525b',
          padding: '14px 0',
          fontSize: 14,
          letterSpacing: '0.14em',
          border: 'none',
          cursor: canPlayMixed ? 'pointer' : 'not-allowed',
        }}
      >
        START PRACTICE →
      </button>
    </div>
  );
};

export default FreePlayViewV2;
