/**
 * FreePlayViewV2 , web "Train Up" page. Lives inside WebShell.
 *
 * 2026-06-04 rewrite per Sol Trivia (9).zip handoff
 * (/tmp/sol-trivia-freeplay-2026-06-04/design_handoff_free_play/README.md).
 *
 * Visual style is locked from the handoff: BOLD editorial dark cards with
 * SOLID COLOR LEFT-RULES, no gradients, no glow halos, no emoji, no
 * translucent rainbow fills. Filled CatTag for streak.
 *
 * Stats: REAL DATA ONLY per Kyle 2026-06-04 night , Q ANSWERED + BEST CAT
 * + per-category PLAYED + streak. Handoff sample values for accuracy and
 * LOW flags were placeholder for visual demo; NOT wired.
 *
 * See [[project-free-play-handoff-2026-06-04]] for the full spec.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { useWallet } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';
import { getFreePlaysRemaining } from '../src/utils/api';
import { CATEGORY_COLORS, getCategoryColor, categoryLabel } from '../src/utils/categoryColors';

interface Props {
  hasGamePass?: boolean;
  practiceRunsLeft?: number;
  /** Starts practice for a category id, or 'all' for Mixed. */
  onStartCategory?: (category: string) => void;
  onBuyGamePass?: () => void;
}

/**
 * Categories shipped on FreePlay (handoff §"Category data"). Each gets a
 * decorative `sub` line that's static descriptive copy (not a stat).
 * Colors are sourced from `categoryColors.ts` (Kyle's locked, no-purple map)
 * per the color-reconciliation note in the handoff memory.
 */
const CATEGORIES: Array<{ id: string; label: string; sub: string }> = [
  { id: 'sports', label: 'SPORTS', sub: 'GOALS · RECORDS' },
  { id: 'history', label: 'HISTORY', sub: 'EMPIRES · WARS' },
  { id: 'entertainment', label: 'ENTERTAINMENT', sub: 'FILM · MUSIC' },
  { id: 'geography', label: 'GEOGRAPHY', sub: 'MAPS · CAPITALS' },
  { id: 'science', label: 'SCIENCE & TECH', sub: 'PHYSICS · BIO' },
  { id: 'crypto', label: 'CRYPTO & WEB3', sub: 'CHAINS · DEFI' },
  { id: 'general', label: 'GENERAL', sub: 'TRIVIA · MIX' },
];

const ACCENT = '#14F195';
const SURFACE = '#0A0A0A';
const SURFACE_SELECTED = '#141414';
const BORDER_LIGHT = 'rgba(255,255,255,0.10)';
const MUTED = '#71717a';
const DIM = '#52525b';

type Counts = Record<string, number>;
type ProfileStats = { streak: number } | null;

/**
 * Filled tag per handoff §"CatTag". White bold label on solid color, used
 * for the streak. Same component shape used by the QuizView category pill,
 * but here it's compact (smaller padding + font).
 */
function CatTag({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        color: '#fff',
        background: color,
        fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
        fontStyle: 'italic',
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '6px 13px',
        borderRadius: 7,
        boxShadow: `0 4px 14px ${color}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

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
  const [playedCounts, setPlayedCounts] = useState<Counts>({});
  const [profile, setProfile] = useState<ProfileStats>(null);
  /** Server-side practice plays remaining (0-5) from get_free_plays_remaining
   *  RPC. null = not fetched yet (guest mode or pre-fetch). Falls back to
   *  the prop-passed practiceRunsLeft (localStorage-based) when null. */
  const [serverFreePlays, setServerFreePlays] = useState<number | null>(null);

  // ── Per-category PLAYED count (Q ANSWERED + BEST CAT derived) ─────────
  useEffect(() => {
    let mounted = true;
    if (!connected || !wallet) {
      setPlayedCounts({});
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc('get_category_play_counts', { p_wallet: wallet });
      if (!mounted) return;
      if (error) {
        console.warn('[FreePlay] play counts fetch failed:', error);
        setPlayedCounts({});
        return;
      }
      const next: Counts = {};
      for (const row of (data ?? []) as Array<{ category: string; played: number | string }>) {
        next[row.category] = Number(row.played) || 0;
      }
      setPlayedCounts(next);
    })();
    return () => { mounted = false; };
  }, [connected, wallet]);

  // ── Server-side free plays remaining (5/24h rolling cap per Kyle
  //     2026-06-04). Replaces the localStorage-derived prop when wallet
  //     is connected. Game Pass holders skip the RPC (always unlimited). ─
  useEffect(() => {
    let mounted = true;
    if (!connected || !wallet || hasGamePass) {
      setServerFreePlays(null);
      return;
    }
    (async () => {
      try {
        const remaining = await getFreePlaysRemaining(wallet);
        if (mounted) setServerFreePlays(remaining);
      } catch (err) {
        console.warn('[FreePlay] getFreePlaysRemaining failed:', err);
        if (mounted) setServerFreePlays(null);
      }
    })();
    return () => { mounted = false; };
  }, [connected, wallet, hasGamePass]);

  // ── Streak (real number for the CatTag) ────────────────────────────────
  useEffect(() => {
    let mounted = true;
    if (!connected || !wallet) {
      setProfile(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('player_profiles')
        .select('current_streak')
        .eq('wallet_address', wallet)
        .maybeSingle();
      if (!mounted) return;
      const d = data as { current_streak?: number } | null;
      setProfile({ streak: Number(d?.current_streak) || 0 });
    })();
    return () => { mounted = false; };
  }, [connected, wallet]);

  // ── Derived stats ───────────────────────────────────────────────────────
  const totalQAnswered = useMemo(
    () => Object.values(playedCounts).reduce((a, b) => a + b, 0),
    [playedCounts],
  );
  const bestCat = useMemo(() => {
    let best = '';
    let max = 0;
    for (const [cat, n] of Object.entries(playedCounts)) {
      if (n > max) { max = n; best = cat; }
    }
    return { cat: best, played: max };
  }, [playedCounts]);
  const maxPlayed = bestCat.played || 1; // progress-bar normalization

  // Server-side count (if wallet connected, from get_free_plays_remaining RPC)
  // takes precedence over localStorage prop. Game Pass = always unlimited.
  const freeGamesRemaining = hasGamePass
    ? Infinity
    : serverFreePlays != null
    ? Math.max(0, serverFreePlays)
    : Math.max(0, practiceRunsLeft);
  const canPickCategory = !!hasGamePass;
  const canPlayMixed = hasGamePass || freeGamesRemaining > 0;

  /** Sticky CTA + selected pick color. Mixed = brand accent. */
  const ctaColor = pick === 'mixed' ? ACCENT : (CATEGORY_COLORS[pick] ?? ACCENT);
  const pickLabel = pick === 'mixed' ? 'MIXED · SURPRISE ME' : categoryLabel(pick);

  const handlePick = (id: string) => {
    if (!canPickCategory && id !== 'mixed') return;
    setPick(id);
  };
  const start = () => {
    if (!canPlayMixed) return;
    onStartCategory?.(pick === 'mixed' ? 'all' : pick);
  };

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

  // ── Card recipe (returns the per-tile button) ──────────────────────────
  const renderCategoryCard = (c: typeof CATEGORIES[number]) => {
    const sel = pick === c.id;
    const color = getCategoryColor(c.id);
    const played = playedCounts[c.id] ?? 0;
    const pct = Math.min(100, Math.round((played / maxPlayed) * 100));
    const locked = !canPickCategory;
    return (
      <button
        key={c.id}
        onClick={() => handlePick(c.id)}
        disabled={locked}
        className="text-left active:opacity-90"
        style={{
          background: sel ? SURFACE_SELECTED : SURFACE,
          border: `1px solid ${sel ? color : BORDER_LIGHT}`,
          borderRadius: isMobile ? 12 : 14,
          padding: isMobile ? '14px 14px 14px 19px' : '16px 18px 16px 27px',
          color: '#fff',
          cursor: locked ? 'not-allowed' : 'pointer',
          opacity: locked ? 0.55 : 1,
          position: 'relative',
          overflow: 'hidden',
          minHeight: isMobile ? 100 : 132,
        }}
      >
        {/* Solid color LEFT RULE , the signature handoff pattern. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: isMobile ? 4 : 5,
            background: color,
          }}
          aria-hidden
        />
        <div
          className="font-black italic"
          style={{
            fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
            fontWeight: 900,
            fontSize: isMobile ? 14 : 18,
            color: '#fff',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            lineHeight: 1.05,
          }}
        >
          {isMobile ? c.label.split(' & ')[0].split(' ')[0] : c.label}
        </div>
        <div
          className="font-black italic"
          style={{
            fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
            fontWeight: 800,
            fontSize: 9,
            color: DIM,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginTop: 4,
          }}
        >
          {c.sub}
        </div>
        <div
          className="font-black italic"
          style={{
            fontFamily: '"JetBrains Mono", "Saira Condensed", system-ui, sans-serif',
            fontWeight: 800,
            fontSize: isMobile ? 9 : 10,
            color: MUTED,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginTop: isMobile ? 10 : 14,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ color: '#a1a1aa' }}>{played.toLocaleString()}</span> PLAYED
        </div>
        {/* Progress bar (proportion of best-category played) */}
        <div
          style={{
            marginTop: 8,
            height: isMobile ? 3 : 4,
            background: '#1a1a1a',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: color,
              transition: 'width 400ms ease-out',
            }}
          />
        </div>
      </button>
    );
  };

  // ── MIXED tile (handoff: full-width, accent left rule) ─────────────────
  const renderMixedTile = () => {
    const sel = pick === 'mixed';
    return (
      <button
        onClick={() => handlePick('mixed')}
        disabled={!canPlayMixed}
        className="text-left active:opacity-90"
        style={{
          background: sel ? SURFACE_SELECTED : SURFACE,
          border: `1px solid ${sel ? ACCENT : BORDER_LIGHT}`,
          borderRadius: isMobile ? 12 : 14,
          padding: isMobile ? '14px 16px 14px 21px' : '18px 22px 18px 31px',
          color: '#fff',
          cursor: canPlayMixed ? 'pointer' : 'not-allowed',
          opacity: canPlayMixed ? 1 : 0.55,
          position: 'relative',
          overflow: 'hidden',
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Accent left rule */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: isMobile ? 4 : 5,
            background: ACCENT,
          }}
          aria-hidden
        />
        <DiceIcon size={isMobile ? 32 : 36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-black italic"
            style={{
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 900,
              fontSize: isMobile ? 16 : 20,
              color: '#fff',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              lineHeight: 1.05,
            }}
          >
            MIXED · SURPRISE ME
          </div>
          <div
            className="font-black italic"
            style={{
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 800,
              fontSize: 9,
              color: MUTED,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            10 RANDOM QUESTIONS ACROSS ALL CATEGORIES
          </div>
        </div>
        <span style={{ fontSize: 20, color: ACCENT, fontWeight: 900 }}>→</span>
      </button>
    );
  };

  return (
    <div className={isMobile ? 'pb-32' : 'pb-28 max-w-5xl'} style={{ color: '#fff' }}>
      {/* ── Header eyebrow + TRAIN UP + streak CatTag ─────────────────── */}
      <div className="mb-5" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div
            className="font-black italic"
            style={{
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 800,
              fontSize: 11,
              color: ACCENT,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {isMobile ? 'FREE PLAY' : 'FREE PLAY · NO STAKES · PRACTICE MODE'}
          </div>
          <h1
            className="font-black italic"
            style={{
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 900,
              fontSize: isMobile ? 42 : 54,
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              marginTop: 2,
            }}
          >
            <span style={{ color: '#fff' }}>TRAIN </span>
            <span style={{ color: ACCENT }}>UP</span>
          </h1>
          {!hasGamePass && (
            <div
              className="font-black italic"
              style={{
                fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
                fontWeight: 800,
                fontSize: 10,
                color: MUTED,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginTop: 8,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {freeGamesRemaining} FREE PLAYS LEFT · MIXED ONLY
            </div>
          )}
        </div>
        {profile && profile.streak > 0 && (
          <CatTag label={`${profile.streak}-DAY STREAK`} color={ACCENT} />
        )}
      </div>

      {/* ── Lifetime stats: Q ANSWERED + BEST CAT (2 cells) ──────────── */}
      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER_LIGHT}`,
          borderRadius: isMobile ? 12 : 14,
          padding: isMobile ? '12px 0' : '18px 0',
          marginBottom: isMobile ? 16 : 20,
          display: 'flex',
        }}
      >
        <StatCell label="Q ANSWERED" value={fmt(totalQAnswered)} color="#fff" big={!isMobile} />
        <div style={{ width: 1, background: BORDER_LIGHT, alignSelf: 'stretch' }} />
        <StatCell
          label="BEST CAT"
          value={bestCat.cat ? categoryLabel(bestCat.cat) : '—'}
          color={bestCat.cat ? getCategoryColor(bestCat.cat) : MUTED}
          big={!isMobile}
        />
      </div>

      {/* ── ALL CATEGORIES section ────────────────────────────────────── */}
      <div
        className="font-black italic mb-2"
        style={{
          fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
          fontWeight: 800,
          fontSize: 10,
          color: '#a1a1aa',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        ALL CATEGORIES{!hasGamePass ? ' · PASS TO UNLOCK' : ''}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: isMobile ? 8 : 12,
          marginBottom: 12,
        }}
      >
        {CATEGORIES.map(renderCategoryCard)}
        {renderMixedTile()}
      </div>

      {/* ── Game Pass nudge ───────────────────────────────────────────── */}
      {!hasGamePass && (
        <button
          onClick={onBuyGamePass}
          className="active:opacity-90"
          style={{
            width: '100%',
            background: SURFACE,
            border: `1px solid ${ACCENT}66`,
            borderRadius: isMobile ? 12 : 14,
            padding: '14px 18px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            textAlign: 'left',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="font-black italic"
              style={{
                fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
                fontWeight: 800,
                fontSize: 11,
                color: ACCENT,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              UNLOCK ALL CATEGORIES
            </div>
            <div className="text-zinc-300 mt-1" style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
              Game Pass = unlimited practice + pick any category
            </div>
          </div>
          <span
            className="font-black italic"
            style={{
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 900,
              fontSize: 13,
              color: ACCENT,
              letterSpacing: '0.14em',
            }}
          >
            GET →
          </span>
        </button>
      )}

      {/* ── Sticky START PRACTICE bar ─────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          bottom: isMobile ? 8 : 20,
          background: 'rgba(2,2,2,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${ctaColor}55`,
          borderRadius: isMobile ? 14 : 14,
          padding: isMobile ? '12px 14px' : '14px 20px',
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="font-black italic"
            style={{
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 800,
              fontSize: 9,
              color: MUTED,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            SELECTED
          </div>
          <div
            className="font-black italic"
            style={{
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 900,
              fontSize: isMobile ? 16 : 22,
              color: '#fff',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              lineHeight: 1.05,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {pickLabel}
          </div>
        </div>
        <button
          onClick={start}
          disabled={!canPlayMixed}
          className="font-black italic active:opacity-90"
          style={{
            background: canPlayMixed ? ctaColor : '#1a1a1a',
            color: canPlayMixed ? '#000' : '#52525b',
            padding: isMobile ? '10px 18px' : '12px 26px',
            fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
            fontWeight: 900,
            fontSize: isMobile ? 13 : 15,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            border: 'none',
            borderRadius: 10,
            cursor: canPlayMixed ? 'pointer' : 'not-allowed',
            boxShadow: canPlayMixed ? `0 8px 24px ${ctaColor}40` : 'none',
            transition: 'background 250ms ease, box-shadow 250ms ease',
            whiteSpace: 'nowrap',
          }}
        >
          START PRACTICE ▶
        </button>
      </div>
    </div>
  );
};

/**
 * Inline SVG dice icon , isometric 3D cube with a "?" on each visible face.
 * White faces (slight shade on the right face for depth), black bold italic
 * question marks. Transparent everywhere else , drops cleanly onto any
 * dark surface without the PNG black-box artifact Kyle flagged 2026-06-04.
 */
function DiceIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block' }}
      aria-hidden
    >
      {/* Top face (parallelogram) */}
      <path d="M 12 3 L 21 8 L 12 13 L 3 8 Z" fill="#ffffff" stroke="#0a0a0a" strokeWidth="0.4" strokeLinejoin="round" />
      {/* Left face , brightest face */}
      <path d="M 3 8 L 12 13 L 12 21 L 3 16 Z" fill="#ffffff" stroke="#0a0a0a" strokeWidth="0.4" strokeLinejoin="round" />
      {/* Right face , slight gray for depth */}
      <path d="M 21 8 L 12 13 L 12 21 L 21 16 Z" fill="#e4e4e7" stroke="#0a0a0a" strokeWidth="0.4" strokeLinejoin="round" />
      {/* "?" on each visible face , black, bold italic */}
      <text
        x="12"
        y="9.3"
        fontFamily='"Saira Condensed", "Saira", system-ui, sans-serif'
        fontSize="4.4"
        fontWeight="900"
        fontStyle="italic"
        fill="#0a0a0a"
        textAnchor="middle"
      >
        ?
      </text>
      <text
        x="7.4"
        y="16.8"
        fontFamily='"Saira Condensed", "Saira", system-ui, sans-serif'
        fontSize="4.4"
        fontWeight="900"
        fontStyle="italic"
        fill="#0a0a0a"
        textAnchor="middle"
      >
        ?
      </text>
      <text
        x="16.6"
        y="16.8"
        fontFamily='"Saira Condensed", "Saira", system-ui, sans-serif'
        fontSize="4.4"
        fontWeight="900"
        fontStyle="italic"
        fill="#0a0a0a"
        textAnchor="middle"
      >
        ?
      </text>
    </svg>
  );
}

function StatCell({ label, value, color, big }: { label: string; value: string; color: string; big?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '0 16px' }}>
      <div
        className="font-black italic"
        style={{
          fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
          fontWeight: 800,
          fontSize: 9,
          color: MUTED,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        className="font-black italic"
        style={{
          fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
          fontWeight: 900,
          fontSize: big ? 32 : 22,
          color,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          marginTop: 4,
          textTransform: 'uppercase',
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default FreePlayViewV2;
