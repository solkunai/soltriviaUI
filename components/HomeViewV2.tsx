/**
 * HomeViewV2 — web redesign of the Home page per final-handoff 2 W1.
 *
 * Renders the body that lives INSIDE WebShell (sidebar + topbar already
 * provided by the shell). Sections:
 *   - Brand row: ROUND #N LIVE pill + COMPETE FOR SOL title (gradient SOL)
 *   - Big green-gradient prize hero with 72px pool number + ENTER button
 *   - QUICK PLAY 3-tile mosaic: ARENA (wide red) + CUSTOM (blue) + FREE PLAY (green)
 *   - Gold GAME PASS banner
 *   - RECENT TOP FINISHES list (top 5 finishers from last finalized round)
 *
 * Drop-in: same prop interface as HomeView so App.tsx can swap them
 * without touching the callers.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { getCurrentRoundKey, getLiveFeed, type LiveFeedItem } from '../src/utils/api';
import {
  fetchTierRound,
  contractRoundIdFromDateAndNumber,
} from '../src/utils/soltriviaContract';
import { supabase } from '../src/utils/supabase';

interface HomeViewV2Props {
  lives: number | null;
  onEnterTrivia: () => void;
  onOpenGuide: () => void;
  onOpenBuyLives: () => void;
  /** Legacy practice trigger , opens the category-selector modal. Still
   *  passed in for backward-compat with other callers. The Home FREE PLAY
   *  tile now uses `onOpenFreePlay` instead (routes to the FreePlayViewV2
   *  page) per Kyle 2026-06-04. */
  onStartPractice: () => void;
  /** Route to the Free Play page (View.PLAY → FreePlayViewV2). New in
   *  2026-06-04: Kyle wants the Home FREE PLAY tile to navigate into the
   *  proper Free Play page, NOT open the category-modal popup. */
  onOpenFreePlay?: () => void;
  practiceRunsLeft: number;
  hasGamePass?: boolean;
  isSeekerVerified?: boolean;
  onBuyGamePass?: () => void;
  onCreateCustomGame?: () => void;
  onViewCustomGame?: (slug: string) => void;
  onEnterDuels?: () => void;
  onMint?: () => void;
}

function getCurrentRoundNumber(): number {
  // 0..3 → 1..4 for display
  return Math.floor(new Date().getUTCHours() / 6) + 1;
}

function getNextRoundCountdown(): string {
  const now = new Date();
  const currentBlock = Math.floor(now.getUTCHours() / 6);
  const nextBlockHour = (currentBlock + 1) * 6;
  const next = new Date(now);
  if (nextBlockHour >= 24) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
  } else {
    next.setUTCHours(nextBlockHour, 0, 0, 0);
  }
  const diffMs = Math.max(0, next.getTime() - now.getTime());
  const totalSec = Math.floor(diffMs / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

type RecentWinner = {
  rank: number;
  wallet: string;
  username: string | null;
  score: number;
  payoutSol: number;
  whenLabel: string;
  roundNumber: number;
};

function shortenWallet(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

/**
 * Right rail: Position + Live Feed + Lives cards. Exported so App.tsx can
 * pass it to WebShell's rightRail prop alongside the Home body.
 */
export function HomeRightRail({
  lives,
  onBuyLives,
  onOpenSwap,
}: {
  lives: number | null;
  onBuyLives?: () => void;
  onOpenSwap?: () => void;
}) {
  const livesCount = lives ?? 0;
  // Real global activity, polled every 12s so the feed moves as people play.
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  useEffect(() => {
    let mounted = true;
    const load = () => {
      getLiveFeed(8)
        .then((items) => {
          if (mounted) setFeed(items);
        })
        .catch(() => {
          /* keep last */
        });
    };
    load();
    const id = setInterval(load, 12_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {/* Position card */}
      <div
        className="rounded-xl"
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(20,241,149,0.33)',
          padding: '14px 16px',
        }}
      >
        <div
          className="font-black italic uppercase"
          style={{
            fontSize: 9,
            color: '#14F195',
            letterSpacing: '0.18em',
          }}
        >
          ● YOUR LIVE POSITION
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <span
            className="font-black italic"
            style={{
              fontSize: 36,
              color: '#14F195',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
            }}
          >
            —
          </span>
          <span
            className="font-black italic uppercase"
            style={{
              fontSize: 11,
              color: '#71717a',
              letterSpacing: '0.14em',
            }}
          >
            NOT ENTERED
          </span>
        </div>
        <div
          className="font-black italic uppercase mt-2"
          style={{
            fontSize: 9,
            color: '#71717a',
            letterSpacing: '0.14em',
          }}
        >
          ENTER A ROUND TO SHOW YOUR RANK + PROJECTED PRIZE
        </div>
      </div>

      {/* Live Feed */}
      <div
        className="rounded-xl"
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 14px',
        }}
      >
        <div
          className="font-black italic uppercase mb-2"
          style={{
            fontSize: 9,
            color: '#52525b',
            letterSpacing: '0.18em',
          }}
        >
          LIVE FEED
        </div>
        {feed.length === 0 ? (
          <div className="py-2" style={{ fontSize: 12, color: '#52525b', lineHeight: 1.4 }}>
            Waiting for the next move…
          </div>
        ) : (
          feed.map((f, i) => (
            <div
              key={f.id}
              className="flex items-start gap-2 py-1.5"
              style={{
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <span
                className="flex-shrink-0"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: f.highlight ? '#14F195' : '#52525b',
                  marginTop: 5,
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  color: f.highlight ? '#fff' : '#a1a1aa',
                  lineHeight: 1.4,
                }}
              >
                {f.text}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Lives card */}
      <div
        className="rounded-xl"
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255,49,49,0.33)',
          padding: '14px 16px',
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="font-black italic uppercase"
            style={{
              fontSize: 9,
              color: '#FF3131',
              letterSpacing: '0.18em',
            }}
          >
            LIVES
          </span>
          <span
            className="font-black italic"
            style={{
              fontSize: 16,
              color: '#fff',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {lives == null ? '—' : String(lives)}
          </span>
        </div>
        <div className="flex gap-1.5 mt-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <svg
              key={i}
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill={i < Math.min(livesCount, 5) ? '#FF3131' : 'transparent'}
              stroke={i < Math.min(livesCount, 5) ? '#FF3131' : '#1a1a1a'}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
            </svg>
          ))}
        </div>
        {onBuyLives ? (
          <button
            onClick={onBuyLives}
            className="w-full rounded-full font-black italic uppercase mt-3 active:opacity-90"
            style={{
              background: '#FF3131',
              color: '#000',
              padding: '8px 12px',
              fontSize: 11,
              letterSpacing: '0.14em',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            BUY MORE
          </button>
        ) : null}
      </div>

      {/* Buy NERD card — opens the in-app swap defaulting to SOL → NERD */}
      {onOpenSwap ? <BuyNerdCard onOpenSwap={onOpenSwap} /> : null}
    </div>
  );
}

const NERD_MINT_ADDRESS = 'DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS';

function BuyNerdCard({ onOpenSwap }: { onOpenSwap: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(NERD_MINT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can fail in some embedded webviews; surface nothing.
    }
  }, []);
  const shortCa = `${NERD_MINT_ADDRESS.slice(0, 4)}...${NERD_MINT_ADDRESS.slice(-4)}`;
  return (
    <div
      className="rounded-xl"
      style={{ background: '#0a0a0a', border: '1px solid rgba(251,191,36,0.33)', padding: '14px 16px' }}
    >
      <div className="flex items-center justify-between">
        <span className="font-black italic uppercase" style={{ fontSize: 9, color: '#FBBF24', letterSpacing: '0.18em' }}>
          $NERD
        </span>
        <img src="/token-nerd.png" alt="NERD" style={{ width: 20, height: 20, borderRadius: 10 }} />
      </div>
      <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 6 }}>Swap SOL ↔ NERD, in-app.</div>
      {/* CA row: short mint + copy button. Click outside of BUY NERD so taps don't bubble. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span className="st-mono" style={{ fontSize: 9, color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>
          CA: {shortCa}
        </span>
        <button
          onClick={handleCopy}
          className="font-black italic uppercase"
          style={{
            background: copied ? 'rgba(20,241,149,0.18)' : 'rgba(251,191,36,0.18)',
            color: copied ? '#14F195' : '#FBBF24',
            border: '1.5px solid ' + (copied ? 'rgba(20,241,149,0.55)' : 'rgba(251,191,36,0.55)'),
            borderRadius: 4, padding: '3px 8px', fontSize: 10, letterSpacing: '0.16em',
            cursor: 'pointer',
          }}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <button
        onClick={onOpenSwap}
        className="w-full rounded-full font-black italic uppercase mt-3 active:opacity-90"
        style={{ background: '#FBBF24', color: '#000', padding: '8px 12px', fontSize: 11, letterSpacing: '0.14em', border: 'none', cursor: 'pointer' }}
      >
        BUY NERD
      </button>
    </div>
  );
}

const HomeViewV2: React.FC<HomeViewV2Props> = (props) => {
  const {
    onEnterTrivia,
    onCreateCustomGame,
    onEnterDuels,
    onStartPractice,
    onOpenFreePlay,
    onBuyGamePass,
    hasGamePass,
    onMint,
  } = props;

  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const isMobile = useIsMobile();

  const [prizePool, setPrizePool] = useState(0);
  const [playersEntered, setPlayersEntered] = useState(0);
  const [activeDuelCount, setActiveDuelCount] = useState(0);
  const [activeCustomGameCount, setActiveCustomGameCount] = useState(0);
  const [countdown, setCountdown] = useState(getNextRoundCountdown());
  const [recentWinners, setRecentWinners] = useState<RecentWinner[]>([]);
  const [streak, setStreak] = useState(0);
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);

  // Live feed ticker — continuously refreshes every 30s. Used by the
  // marquee strip between MINT CTA and QUICK PLAY tiles.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getLiveFeed(12)
        .then((items) => {
          if (!cancelled) setFeed(items);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Real daily streak for the Free Play tile badge.
  useEffect(() => {
    const wallet = publicKey?.toBase58();
    if (!wallet) {
      setStreak(0);
      return;
    }
    let cancelled = false;
    supabase
      .from('player_profiles')
      .select('current_streak')
      .eq('wallet_address', wallet)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setStreak(Number((data as { current_streak?: number } | null)?.current_streak ?? 0) || 0);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  // Live countdown to next 6h block, local-only.
  useEffect(() => {
    const tick = () => setCountdown(getNextRoundCountdown());
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Prize pool + players from on-chain tier rounds, every 15s.
  useEffect(() => {
    if (!connection) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const { date, roundNumber } = getCurrentRoundKey();
        const contractRoundId = contractRoundIdFromDateAndNumber(date, roundNumber);
        const results = await Promise.allSettled(
          [0, 1, 2, 3].map((i) => fetchTierRound(connection, contractRoundId, i)),
        );
        if (!mounted) return;
        let totalPot = 0;
        let totalPlayers = 0;
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            totalPot += r.value.totalPot;
            totalPlayers += r.value.entryCount;
          }
        }
        setPrizePool(totalPot / 1_000_000_000);
        setPlayersEntered(totalPlayers);
      } catch {
        /* non-fatal */
      }
    };
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [connection]);

  // Active duel + custom game counts.
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const now = new Date().toISOString();
        const [duels, cg] = await Promise.all([
          supabase
            .from('duels')
            .select('*', { count: 'exact', head: true })
            .in('status', ['waiting', 'active'])
            .gt('expires_at', now),
          supabase
            .from('custom_games')
            .select('*', { count: 'exact', head: true })
            .in('status', ['active', 'started'])
            // Stale rows in DB still carry status='active' past their
            // expires_at because auto-expire cron isn't always caught up.
            // Filter on the read side so the homepage count is honest.
            .gt('expires_at', now),
        ]);
        setActiveDuelCount(duels.count ?? 0);
        setActiveCustomGameCount(cg.count ?? 0);
      } catch {
        /* non-fatal */
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Recent top finishers from the last finalized round, top 5.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Last 3 paid rounds, top finishers per round. (Status is 'paid' after
        // winners are posted on-chain, not 'finalized' — Kyle 2026-06-09.)
        const { data: rounds } = await supabase
          .from('daily_rounds')
          .select('id, date, round_number')
          .in('status', ['paid', 'finalized'])
          .order('date', { ascending: false })
          .order('round_number', { ascending: false })
          .limit(3);
        if (!mounted || !rounds?.length) return;

        const roundIds = rounds.map((r: any) => r.id);
        const { data: payouts } = await supabase
          .from('round_payouts')
          .select('round_id, wallet_address, rank, prize_lamports')
          .in('round_id', roundIds)
          .eq('rank', 1)
          .order('rank', { ascending: true });
        if (!mounted || !payouts?.length) return;

        // Pull usernames
        const wallets = [...new Set(payouts.map((p: any) => p.wallet_address))];
        const { data: profiles } = await supabase
          .from('player_profiles')
          .select('wallet_address, username')
          .in('wallet_address', wallets);
        const usernameByWallet: Record<string, string | null> = {};
        for (const p of (profiles ?? []) as any[]) {
          usernameByWallet[p.wallet_address] = p.username ?? null;
        }

        const roundByIdLocal: Record<string, any> = {};
        for (const r of rounds as any[]) roundByIdLocal[r.id] = r;

        const winners: RecentWinner[] = payouts
          .slice(0, 5)
          .map((p: any) => {
            const r = roundByIdLocal[p.round_id];
            return {
              rank: p.rank,
              wallet: p.wallet_address,
              username: usernameByWallet[p.wallet_address] ?? null,
              score: 0,
              payoutSol: (p.prize_lamports ?? 0) / 1_000_000_000,
              whenLabel: r ? `${r.date} R${r.round_number + 1}` : '',
              roundNumber: r ? r.round_number + 1 : 0,
            };
          });
        if (mounted) setRecentWinners(winners);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const liveRoundNumber = useMemo(() => getCurrentRoundNumber(), []);
  // Pot increments in 0.02 SOL chunks. Show "0" when empty, 2 decimals
  // otherwise — never "0.0000". Mirrors RoundsViewV2 formatting.
  const poolDisplay = prizePool === 0 ? '0' : prizePool.toFixed(2);

  return (
    <div className="max-w-5xl">
      {/* Brand row */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{
            fontSize: 10,
            color: '#14F195',
            letterSpacing: '0.18em',
          }}
        >
          ● ROUND #{liveRoundNumber} LIVE
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          COMPETE FOR{' '}
          <span
            style={{
              background:
                'linear-gradient(90deg, #14F195 0%, #7C8DFF 50%, #9945FF 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SOL
          </span>
        </h1>
        <div
          className="font-black italic uppercase mt-2"
          style={{
            fontSize: 10,
            color: '#a1a1aa',
            letterSpacing: '0.16em',
          }}
        >
          EVERY 6H · 10 RANDOM QUESTIONS · TOP 5 SPLIT 90% OF POOL
        </div>
      </div>

      {/* Prize hero card — mobile: ENTER pill absolute-positioned top-right
          so the huge pot amount has full width. Desktop: side-by-side flex. */}
      <button
        onClick={onEnterTrivia}
        className="block w-full text-left rounded-2xl mb-5 active:opacity-95 relative"
        style={{
          background:
            'linear-gradient(110deg, #14F195 0%, #00FFA3 60%, #7CD9FF 100%)',
          padding: isMobile ? '18px 20px' : '20px 24px',
          color: '#000',
          boxShadow: '0 22px 50px -22px rgba(20,241,149,0.6)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {/* Mobile: ENTER pill in top-right corner (compact) */}
        {isMobile && (
          <div
            className="absolute"
            style={{ top: 14, right: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
          >
            <span
              className="font-black italic uppercase"
              style={{
                background: '#000',
                color: '#14F195',
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 10,
                letterSpacing: '0.1em',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                display: 'inline-block',
                whiteSpace: 'nowrap',
              }}
            >
              ENTER · 0.02 SOL
            </span>
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 7, color: 'rgba(0,0,0,0.6)', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}
            >
              + 0.0025 FEE
            </span>
          </div>
        )}
        <div className={isMobile ? '' : 'flex items-end justify-between gap-6'}>
          <div className="min-w-0">
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.14em' }}
            >
              PRIZE POOL · GROWING
            </div>
            <div
              className="font-black italic mt-1 flex items-end gap-2"
              style={{
                fontSize: isMobile ? 48 : 72,
                lineHeight: 0.85,
                letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>{poolDisplay}</span>
              <span style={{ fontSize: isMobile ? 22 : 32, letterSpacing: '-0.02em', lineHeight: 0.95, paddingBottom: isMobile ? 3 : 5 }}>SOL</span>
            </div>
            <div
              className="font-black italic uppercase mt-2"
              style={{ fontSize: isMobile ? 9 : 10, opacity: 0.7, letterSpacing: '0.14em' }}
            >
              {playersEntered} ENTRIES · CLOSES IN{' '}
              <span
                style={{
                  background: 'rgba(0,0,0,0.16)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {countdown}
              </span>
            </div>
          </div>
          {/* Desktop only — ENTER pill on right side */}
          {!isMobile && (
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span
                className="font-black italic uppercase"
                style={{
                  background: '#000',
                  color: '#14F195',
                  borderRadius: 999,
                  padding: '14px 28px',
                  fontSize: 13,
                  letterSpacing: '0.14em',
                  boxShadow: '0 8px 18px rgba(0,0,0,0.4)',
                  display: 'inline-block',
                }}
              >
                ENTER · 0.02 SOL →
              </span>
              <span
                className="font-black italic uppercase"
                style={{ fontSize: 9, color: 'rgba(0,0,0,0.6)', letterSpacing: '0.14em' }}
              >
                + 0.0025 PLATFORM FEE
              </span>
            </div>
          )}
        </div>
      </button>

      {/* MINT CTA — commemorative NFT mint banner */}
      {onMint && (
        <button
          onClick={onMint}
          className="w-full rounded-xl mb-3 active:opacity-90 overflow-hidden flex items-center gap-3 st-saira"
          style={{ background: 'linear-gradient(90deg,#070F26,#0E1A3D,#0A1432)', border: '1.5px solid #FBBF2466', padding: 14, cursor: 'pointer' }}
        >
          {/* Mystery-card FAN — exact spec from Claude Design 2026-06-02.
              4 cards rotated symmetrically around center (-18°/-6°/+6°/+18°), middle card on top.
              3-nested-layer structure (position / float / tilt) so transforms never collide.
              Idle bob animation defined in src/index.css. All four cards carry the "?". */}
          <div style={{ position: 'relative', width: 84, height: 80, flexShrink: 0 }}>
            {/* Center radial glow behind the fan */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '25%',
                width: 240,
                height: 240,
                marginTop: -120,
                marginLeft: -120,
                background: 'radial-gradient(circle, #FBBF2422, transparent 60%)',
                filter: 'blur(16px)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            {(
              [
                { src: '/mint/nft-genius.png',     bg: ['#A5E07B', '#5B9C3E'] as const, rot: -18, x: -22, z: 1 },
                { src: '/mint/nft-competitor.png', bg: ['#FF9264', '#D14424'] as const, rot:  -6, x:  -7, z: 2 },
                { src: '/mint/nft-scholar.png',    bg: ['#A9E4F7', '#5BAFD6'] as const, rot:   6, x:   8, z: 3 },
                { src: '/mint/nft-champion.png',   bg: ['#FFE26B', '#D9A91A'] as const, rot:  18, x:  23, z: 2 },
              ] as const
            ).map((c, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  zIndex: c.z,
                  transform: `translate(calc(-50% + ${c.x}px), -50%)`,
                }}
              >
                {/* LAYER 2 — staggered idle bob (animation ONLY on this element) */}
                <div className={`st-bob-${i + 1}`}>
                  {/* LAYER 3 — the visible card: tilt + border + glow */}
                  <div
                    style={{
                      width: 34,
                      height: 52,
                      transform: `rotate(${c.rot}deg)`,
                      borderRadius: 5,
                      background: `linear-gradient(135deg, ${c.bg[0]}, ${c.bg[1]})`,
                      border: '1.5px solid #FBBF2488',
                      overflow: 'hidden',
                      boxShadow: '0 4px 10px -2px rgba(0,0,0,0.6)',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={c.src}
                      alt=""
                      style={{
                        width: '100%',
                        height: '130%',
                        objectFit: 'cover',
                        objectPosition: 'center 28%',
                        filter: 'blur(5px) saturate(1.2)',
                      }}
                    />
                    {/* navy veil + the "?" */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'rgba(7,15,38,0.55)',
                        fontStyle: 'italic',
                        fontWeight: 900,
                        fontSize: 22,
                        color: '#fff',
                        textShadow: '0 1px 0 rgba(0,0,0,0.8), 0 2px 6px rgba(0,0,0,0.7), 0 0 8px rgba(251,191,36,0.6)',
                      }}
                    >
                      ?
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Copy */}
          <div className="flex-1 min-w-0 text-left">
            <div className="font-black italic uppercase flex items-center gap-1.5" style={{ fontSize: 8, color: '#FBBF24', letterSpacing: '0.16em' }}>
              <img src="/mint/mint-icon.png" alt="" style={{ width: 10, height: 10, filter: 'brightness(0) invert(1)' }} /> MINT TO REVEAL
            </div>
            <div className="font-black italic uppercase text-white" style={{ fontSize: 18, marginTop: 3 }}>
              WHICH <span style={{ color: '#FBBF24' }}>NERD</span> ARE YOU?
            </div>
            <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 4 }}>
              1 of 4 random archetypes · <span style={{ color: '#FBBF24', fontWeight: 900 }}>0.02 SOL</span>
            </div>
          </div>
          {/* Arrow chip */}
          <div className="rounded-full flex items-center justify-center flex-shrink-0 font-black" style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#FBBF24,#E89F0F)', color: '#070F26', fontSize: 22, lineHeight: 1 }}>→</div>
        </button>
      )}

      {/* ── LIVE FEED TICKER ── continuously scrolling marquee.
          Renders the same `feed` data used by the bottom box, but here it
          slides left forever. Items are doubled so the loop is seamless.
          Hidden when feed is empty (avoids the empty marquee box). */}
      {feed.length > 0 && (
        <div
          className="mb-3 rounded-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, #0a0a0a, #111111, #0a0a0a)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '10px 0',
          }}
        >
          <style>{`
            @keyframes st-feed-marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .st-feed-track {
              display: inline-flex;
              gap: 28px;
              white-space: nowrap;
              animation: st-feed-marquee 42s linear infinite;
              will-change: transform;
            }
          `}</style>
          {/* LIVE label (sticky-left) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              background: 'linear-gradient(90deg, #0a0a0a 70%, transparent)',
            }}
          >
            <span
              className="font-black italic uppercase"
              style={{
                fontSize: 9,
                color: '#14F195',
                letterSpacing: '0.18em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#14F195',
                  display: 'inline-block',
                }}
              />
              LIVE
            </span>
          </div>
          {/* Scrolling track , items doubled for seamless loop */}
          <div className="st-feed-track" style={{ paddingLeft: 72 }}>
            {[...feed, ...feed].map((f, i) => (
              <span
                key={`${f.id}-${i}`}
                style={{
                  fontSize: 12,
                  color: f.highlight ? '#fff' : '#a1a1aa',
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    color: f.highlight ? '#14F195' : '#52525b',
                    marginRight: 8,
                  }}
                >
                  ●
                </span>
                {f.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* QUICK PLAY label */}
      <div
        className="font-black italic uppercase mb-3"
        style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.18em' }}
      >
        QUICK PLAY
      </div>

      {/* 3-tile mosaic — stacks to single column on mobile */}
      <div
        className="mb-3"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr 1fr',
          gap: 10,
        }}
      >
        {/* ARENA — wide red tile */}
        <button
          onClick={onEnterDuels}
          className="text-left rounded-xl active:opacity-90"
          style={{
            background: '#0a0a0a',
            border: '1.5px solid #FF3131',
            padding: '14px 16px',
            color: '#fff',
            minHeight: 108,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          {/* Swords icon top-right */}
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FF3131"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', top: 10, right: 10, opacity: 0.4 }}
          >
            <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" />
          </svg>
          <div>
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 9, color: '#FF3131', letterSpacing: '0.18em' }}
            >
              1V1 · LIVE
            </div>
            <div
              className="font-black italic uppercase mt-1"
              style={{ fontSize: 22, lineHeight: 0.95, letterSpacing: '-0.02em' }}
            >
              ENTER <span style={{ color: '#FF3131' }}>ARENA</span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span
              className="font-black italic uppercase"
              style={{
                fontSize: 9,
                color: '#a1a1aa',
                letterSpacing: '0.14em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {activeDuelCount > 0 ? `${activeDuelCount} OPEN` : 'HOST OR JOIN'} ·
              0.01–1 SOL
            </span>
            <div className="flex-1" />
            <span
              className="font-black italic"
              style={{ fontSize: 14, color: '#FF3131' }}
            >
              →
            </span>
          </div>
        </button>

        {/* CUSTOM — stat poster */}
        <button
          onClick={onCreateCustomGame}
          className="text-left rounded-xl active:opacity-90"
          style={{
            background: '#0a0a0a',
            border: '1.5px solid #38BDF8',
            padding: '14px 16px',
            color: '#fff',
            minHeight: 108,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          {/* Wand icon top-right */}
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#38BDF8"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', top: 10, right: 10, opacity: 0.4 }}
          >
            <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72ZM14 7l3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9" />
          </svg>
          {activeCustomGameCount > 0 ? (
            <div
              className="font-black italic"
              style={{
                fontSize: 44,
                color: '#38BDF8',
                lineHeight: 0.85,
                letterSpacing: '-0.04em',
                opacity: 0.95,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {activeCustomGameCount}
            </div>
          ) : (
            <div style={{ height: 38 }} />
          )}
          <div>
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 13, lineHeight: 1 }}
            >
              CUSTOM GAMES
            </div>
            <div
              className="font-black italic uppercase mt-1"
              style={{ fontSize: 8, color: '#38BDF8', letterSpacing: '0.16em' }}
            >
              OPEN ROOMS · HOST FREE
            </div>
          </div>
        </button>

        {/* FREE PLAY — streak focus. Routes to View.PLAY (FreePlayViewV2)
            per Kyle 2026-06-04 , no more category-modal popup from Home. */}
        <button
          onClick={onOpenFreePlay ?? onStartPractice}
          className="text-left rounded-xl active:opacity-90"
          style={{
            background: '#0a0a0a',
            border: '1.5px solid #14F195',
            padding: '14px 16px',
            color: '#fff',
            minHeight: 108,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          {streak > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                textAlign: 'right',
              }}
            >
              <span
                className="font-black italic"
                style={{
                  fontSize: 30,
                  color: '#FFD700',
                  lineHeight: 0.85,
                  display: 'block',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {streak}
              </span>
              <span
                className="font-black italic uppercase"
                style={{
                  fontSize: 7,
                  color: '#FFD700',
                  display: 'block',
                  marginTop: 1,
                  letterSpacing: '0.14em',
                }}
              >
                🔥 STREAK
              </span>
            </div>
          )}
          <div>
            <div
              className="font-black italic uppercase"
              style={{
                fontSize: 9,
                color: '#14F195',
                letterSpacing: '0.18em',
              }}
            >
              NO STAKES
            </div>
            <div
              className="font-black italic uppercase mt-1"
              style={{ fontSize: 20, lineHeight: 0.95, letterSpacing: '-0.02em' }}
            >
              FREE <span style={{ color: '#14F195' }}>PLAY</span>
            </div>
          </div>
          <div
            className="font-black italic uppercase"
            style={{
              fontSize: 8,
              color: '#71717a',
              letterSpacing: '0.14em',
            }}
          >
            7 CATEGORIES · UNLIMITED W/ PASS
          </div>
        </button>
      </div>

      {/* GAME PASS gold banner */}
      {!hasGamePass && (
        <button
          onClick={onBuyGamePass}
          className="w-full text-left rounded-xl mb-5 active:opacity-95 flex items-center gap-3"
          style={{
            background:
              'linear-gradient(110deg, #FFD700 0%, #FFE680 60%, #FFC857 100%)',
            color: '#000',
            padding: '10px 16px',
            boxShadow: '0 14px 30px -16px rgba(255,215,0,0.5)',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#000',
              color: '#FFD700',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFD700"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 8, opacity: 0.7, letterSpacing: '0.14em' }}
            >
              UNLOCK EVERYTHING
            </div>
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 15, lineHeight: 1, marginTop: 1 }}
            >
              GAME PASS
            </div>
            <div
              className="font-black italic uppercase"
              style={{
                fontSize: 8,
                opacity: 0.65,
                letterSpacing: '0.14em',
                marginTop: 2,
              }}
            >
              7 CATEGORIES · +25% XP · -10% LIVES · NON-TRANSFERABLE
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div
              className="font-black italic"
              style={{
                fontSize: 20,
                lineHeight: 0.95,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              0.0625
            </div>
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 8, opacity: 0.65, letterSpacing: '0.14em' }}
            >
              SOL · ONE-TIME
            </div>
          </div>
          <span
            className="font-black italic"
            style={{ fontSize: 18, marginLeft: 4 }}
          >
            →
          </span>
        </button>
      )}

      {/* Recent top finishes */}
      <div
        className="font-black italic uppercase mb-3"
        style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.18em' }}
      >
        RECENT TOP FINISHES
      </div>
      {recentWinners.length === 0 ? (
        <div
          className="rounded-xl text-center"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '24px 16px',
            color: '#71717a',
            fontSize: 12,
          }}
        >
          No finalized rounds yet today. Be the first to print.
        </div>
      ) : (
        <div
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {recentWinners.map((w, i) => (
            <div
              key={`${w.wallet}-${w.roundNumber}`}
              className="flex items-center gap-4 px-4 py-3"
              style={{
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(255,215,0,0.15)',
                  border: '1.5px solid #FFD700',
                  color: '#FFD700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 14,
                }}
              >
                🏆
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-black italic uppercase truncate"
                  style={{ fontSize: 14, color: '#fff', letterSpacing: '-0.01em' }}
                >
                  @{w.username || shortenWallet(w.wallet)}
                </div>
                <div
                  className="font-black italic uppercase mt-0.5"
                  style={{
                    fontSize: 9,
                    color: '#71717a',
                    letterSpacing: '0.14em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {w.whenLabel}
                </div>
              </div>
              <span
                className="font-black italic uppercase"
                style={{
                  fontSize: 9,
                  background: 'rgba(255,215,0,0.15)',
                  color: '#FFD700',
                  border: '1px solid rgba(255,215,0,0.4)',
                  borderRadius: 999,
                  padding: '3px 8px',
                  letterSpacing: '0.12em',
                }}
              >
                1ST
              </span>
              <span
                className="font-black italic"
                style={{
                  fontSize: 18,
                  color: '#FFD700',
                  width: 90,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                +{w.payoutSol.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeViewV2;
