/**
 * ProfileViewV2 — Web profile redesign matching final-handoff/stw-pages.jsx
 * WebProfile (lines 1100-1304).
 *
 * Visual structure:
 *  1. Gradient banner (green→purple) with username + MAINNET/NERD/wallet pills
 *     + EDIT PROFILE + JOINED/STREAK/FINISHES meta row
 *  2. Avatar floats over the bottom-left edge of the banner
 *  3. 5-up colorful stats grid (RANK / XP / GAMES / WIN RATE / EARNED)
 *  4. Full-width NERD balance bar (purple-tinted, $N icon, SEND + SWAP)
 *  5. Two-col body:
 *       - ACCOUNT cards: Lives / Game Pass / Referral claimable / Socials
 *       - RECENT ACTIVITY list
 *
 * Real data: stats fall back from props → fetched player_stats → '—', recent
 * activity merges game_sessions + duels + custom_game_sessions, claims/refunds
 * filtered by on-chain truth via claims.ts wrappers.
 */
import React, { useEffect, useState } from 'react';
import { JupiterVerifiedBadge } from './JupiterVerifiedBadge';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { DEFAULT_AVATAR } from '../src/utils/constants';
import { supabase } from '../src/utils/supabase';
import {
  type ClaimablePayout,
  type MyDuelWin,
  type ClaimableCustomGameWin,
  type RefundableEntry,
  type RefundableCustomGame,
  type RefundableDuel,
} from '../src/utils/api';
import {
  fetchUnpaidRoundPayouts,
  fetchUnclaimedDuelWins,
  fetchUnclaimedCustomWins,
  fetchClaimableRefundEntries,
  fetchClaimableRefundCustoms,
  fetchClaimableRefundDuels,
} from '../src/utils/claims';
import { fetchReferralBalance } from '../src/utils/soltriviaContract';
import {
  getReferralStats,
  getSeekerProfile,
  verifySeekerStatus,
  type ReferralStatsResponse,
  type SeekerProfile,
} from '../src/utils/api';
import { getSplTokenBalance } from '../src/utils/splTransfer';
import { TOKEN_DECIMALS } from '../src/utils/constants';
import AvatarUpload from './AvatarUpload';

interface ActivityRow {
  key: string;
  txt: string;
  meta: string;
  col: string;
  icon: 'trophy' | 'swords' | 'bolt' | 'sparkles' | 'heart';
  at: number; // unix ms
}

interface FetchedStats {
  totalPoints: number;
  totalGamesPlayed: number;
  currentStreak: number;
  createdAt: string | null;
  duelsWon: number;
  duelsLost: number;
  earnedSol: number;
  topThree: number;
  rank: number | null;
}

interface Props {
  username: string;
  avatar: string;
  lives?: number | null;
  hasGamePass?: boolean;
  onEdit: () => void;
  onBuyLives?: () => void;
  onOpenGamePass?: () => void;
  onOpenSwap?: () => void;
  onOpenReferrals?: () => void;
  onSignOut?: () => void;
  onAvatarUpdated?: (url: string) => void;
  onSeekerVerified?: (verified: boolean) => void;
  // Claim handlers — fire on-chain claim flows
  onClaimRoundPrize?: (payout: ClaimablePayout) => Promise<void>;
  onClaimDuelPrize?: (duelId: number) => Promise<void>;
  /** SPL variant — called when the duel was a token-denominated wager. */
  onClaimDuelSplPrize?: (duelId: number, tokenMint: string) => Promise<void>;
  onClaimCustomPrize?: (onChainGameId: number) => Promise<void>;
  /** SPL variant — called when the custom game used a token_mint prize. */
  onClaimCustomSplPrize?: (onChainGameId: number, tokenMint: string) => Promise<void>;
  onClaimRoundRefund?: (entry: RefundableEntry) => Promise<void>;
  onClaimCustomRefund?: (onChainGameId: number) => Promise<void>;
  onClaimDuelRefund?: (duelId: number, player1Wallet: string) => Promise<void>;
  // v2.1: referrer drains accumulated commission PDA. The card auto-renders
  // when on-chain balance > 0 (PDA doesn't exist on pre-upgrade clusters,
  // returns 0 → card hidden → zero regression).
  onClaimReferralBalance?: () => Promise<void>;
  // Optional: when null/undefined, mock values are used
  totalXp?: number | null;
  gamesPlayed?: number | null;
  winRate?: number | null; // 0..100
  earnedSol?: number | null; // net SOL earned
  rank?: number | null;
  streak?: number | null;
  joinedDate?: string | null; // ISO
  topThreeFinishes?: number | null;
}

const C = {
  bg: '#050505',
  surface: '#0A0A0A',
  surfaceUp: '#0c0c0c',
  primary: '#14F195',
  secondary: '#00FFA3',
  purple: '#a855f7',
  blue: '#3b82f6',
  cyan: '#22D3EE',
  pink: '#F472B6',
  red: '#FF3131',
  gold: '#FFD700',
  twitter: '#1DA1F2',
  discord: '#5865F2',
  textMuted: '#71717a',
  textDim: '#52525b',
  borderLight: 'rgba(255,255,255,0.10)',
};

const formatJoined = (iso: string | null | undefined): string => {
  if (!iso) return 'MAR 14';
  try {
    const d = new Date(iso);
    return d
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      .toUpperCase();
  } catch {
    return 'MAR 14';
  }
};

const relativeAgo = (ms: number): string => {
  const delta = Date.now() - ms;
  if (delta < 60_000) return 'just now';
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

function Icon({ name, size = 14, color = '#000' }: { name: string; size?: number; color?: string }) {
  const paths: Record<string, React.ReactNode> = {
    trophy: (
      <>
        <path d="M8 4h8v4a4 4 0 11-8 0V4zM5 4h3v3a3 3 0 01-3-3zM19 4h-3v3a3 3 0 003-3z" fill={color} />
        <path d="M9 14h6v3H9zM7 19h10v2H7z" fill={color} />
      </>
    ),
    swords: <path d="M14 6l4-4 3 3-4 4M8 8L4 4l-1 1 4 4M14 14l6 6 1-1-6-6M10 10l-6 6 6 6 6-6-6-6z" stroke={color} fill="none" strokeWidth="1.5" />,
    bolt: <path d="M13 2L4 14h6l-2 8 10-13h-7l2-7z" fill={color} />,
    // Heart — Lucide-style, matches the topbar lives pill. Proportional,
    // filled solid in the chosen color.
    heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" />,
    sparkles: (
      <>
        <path d="M5 3l1.5 3L10 7l-3.5 1L5 11l-1.5-3L0 7l3.5-1L5 3z" fill={color} />
        <path d="M16 10l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill={color} />
      </>
    ),
    // Ticket — matches sidebar/topbar ticket (with perforations + center dashes).
    ticket: <path d="M2 9a3 3 0 010 6v2a2 2 0 002 2h16a2 2 0 002-2v-2a3 3 0 010-6V7a2 2 0 00-2-2H4a2 2 0 00-2 2zM13 5v2M13 17v2M13 11v2" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
    // user-plus — matches sidebar Referrals icon exactly.
    'user-plus': <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M19 8v6M22 11h-6" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
    // gift — wrapped present box for UNCLAIMED PRIZES header. Box + lid +
    // center ribbon + two bow loops. Lucide-style.
    gift: (
      <>
        <path d="M20 12v10H4V12" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 7h20v5H2z" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 22V7" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {paths[name] ?? null}
    </svg>
  );
}

// ─── Recently-claimed persistence ────────────────────────────────────────
// Why this exists: when a user successfully claims a prize/refund on-chain,
// the row drops from the UI immediately (optimistic update). But on the next
// poll or page revisit, the backend (e.g. fetchUnpaidRoundPayouts) might
// still return that row because the indexer hasn't seen the claim tx yet.
// Without this localStorage layer, the row REAPPEARS and the user re-clicks
// CLAIM, which fails on-chain (AlreadyClaimed) and they get a confusing UI.
//
// Strategy: track claimed keys in localStorage scoped per wallet. Filter the
// fetched lists through this set. Entries expire after 24h (by which point
// the backend should be sync'd and the row will be excluded server-side).
const RECENT_CLAIMS_TTL_MS = 24 * 60 * 60 * 1000;
const recentClaimsKey = (wallet: string) => `soltrivia:recent-claims:${wallet}`;

function readRecentClaims(wallet: string | null | undefined): Map<string, number> {
  if (!wallet || typeof window === 'undefined') return new Map();
  try {
    const raw = window.localStorage.getItem(recentClaimsKey(wallet));
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as Array<{ key: string; at: number }>;
    const cutoff = Date.now() - RECENT_CLAIMS_TTL_MS;
    return new Map(arr.filter((r) => r.at > cutoff).map((r) => [r.key, r.at]));
  } catch {
    return new Map();
  }
}

function persistRecentClaims(wallet: string, claims: Map<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(claims.entries()).map(([key, at]) => ({ key, at }));
    window.localStorage.setItem(recentClaimsKey(wallet), JSON.stringify(arr));
  } catch { /* localStorage quota / disabled — silently fail */ }
}

function markClaimed(wallet: string | null | undefined, key: string) {
  if (!wallet) return;
  const map = readRecentClaims(wallet);
  map.set(key, Date.now());
  persistRecentClaims(wallet, map);
}

const ProfileViewV2: React.FC<Props> = ({
  username,
  avatar,
  lives,
  hasGamePass,
  onEdit,
  onBuyLives,
  onOpenGamePass,
  onOpenSwap,
  onOpenReferrals,
  onSignOut,
  onAvatarUpdated,
  onSeekerVerified,
  onClaimRoundPrize,
  onClaimDuelPrize,
  onClaimDuelSplPrize,
  onClaimCustomPrize,
  onClaimCustomSplPrize,
  onClaimRoundRefund,
  onClaimCustomRefund,
  onClaimDuelRefund,
  onClaimReferralBalance,
  totalXp,
  gamesPlayed,
  winRate,
  earnedSol,
  rank,
  streak,
  joinedDate,
  topThreeFinishes,
}) => {
  const { publicKey, signMessage } = useWallet();
  const { connection } = useConnection();
  const isMobile = useIsMobile();
  const walletShort = publicKey
    ? `${publicKey.toBase58().slice(0, 6)}…${publicKey.toBase58().slice(-4)}`
    : '—';
  const [walletCopied, setWalletCopied] = useState(false);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  // Seeker verification — load profile + handle verify click
  const [seekerProfile, setSeekerProfile] = useState<SeekerProfile | null>(null);
  const [seekerVerifying, setSeekerVerifying] = useState(false);
  const [seekerError, setSeekerError] = useState<string | null>(null);

  const handleVerifySeeker = async () => {
    if (!publicKey || seekerVerifying) return;
    setSeekerVerifying(true);
    setSeekerError(null);
    try {
      const timestamp = Date.now();
      const message = `Verify SGT ownership for Sol Trivia\nWallet: ${publicKey.toBase58()}\nTimestamp: ${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const sigBase64 = btoa(String.fromCharCode(...signature));
      const res = await verifySeekerStatus(publicKey.toBase58(), message, sigBase64);
      if (res.is_seeker_verified) {
        setSeekerProfile({
          is_seeker_verified: true,
          skr_domain: res.skr_domain,
          use_skr_as_display: false,
          seeker_verified_at: res.seeker_verified_at,
        });
        onSeekerVerified?.(true);
      } else {
        setSeekerError('No SGT detected in this wallet.');
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Verification failed';
      if (!/rejected|cancelled/i.test(msg)) setSeekerError(msg);
    } finally {
      setSeekerVerifying(false);
    }
  };

  // Claimable balances — loaded on wallet change
  const [roundPayouts, setRoundPayouts] = useState<ClaimablePayout[]>([]);
  const [duelWins, setDuelWins] = useState<MyDuelWin[]>([]);
  const [customWins, setCustomWins] = useState<ClaimableCustomGameWin[]>([]);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  // Refundable items (rounds with <5 finishers, expired customs, no-opponent duels)
  const [refundRounds, setRefundRounds] = useState<RefundableEntry[]>([]);
  const [refundCustoms, setRefundCustoms] = useState<RefundableCustomGame[]>([]);
  const [refundDuels, setRefundDuels] = useState<RefundableDuel[]>([]);

  // Player stats — loaded on wallet change
  const [fetchedStats, setFetchedStats] = useState<FetchedStats | null>(null);

  // NERD balance, referral stats, recent activity feed
  const [nerdBalance, setNerdBalance] = useState<number | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStatsResponse | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  // v2.1 on-chain referral commission PDA balance (in lamports). 0 means
  // either: a) wallet has never been credited, b) PDA is empty, c) the V2.1
  // upgrade hasn't shipped to this cluster. The card only renders when > 0.
  const [referralBalanceLamports, setReferralBalanceLamports] = useState<number>(0);

  useEffect(() => {
    const wallet = publicKey?.toBase58();
    if (!wallet) {
      setRoundPayouts([]);
      setDuelWins([]);
      setCustomWins([]);
      setRefundRounds([]);
      setRefundCustoms([]);
      setRefundDuels([]);
      setFetchedStats(null);
      setNerdBalance(null);
      setReferralStats(null);
      setActivity([]);
      setReferralBalanceLamports(0);
      return;
    }
    let cancelled = false;
    (async () => {
      // NERD balance — single getTokenAccountBalance RPC
      try {
        const raw = await getSplTokenBalance(connection, publicKey!, 'NERD');
        if (!cancelled) {
          setNerdBalance(Number(raw) / Math.pow(10, TOKEN_DECIMALS.NERD));
        }
      } catch (_) {
        if (!cancelled) setNerdBalance(0);
      }

      // Referral stats — single EF call
      getReferralStats(wallet)
        .then((r) => {
          if (!cancelled) setReferralStats(r);
        })
        .catch(() => {
          // Silent — referral card falls back to '—' display
        });

      // v2.1 on-chain referral commission balance (PDA lamports).
      // Returns 0 if PDA never credited or V2.1 not on this cluster.
      // Also: if the wallet recently claimed referral, force 0 so the card
      // doesn't reappear before the on-chain PDA write propagates.
      fetchReferralBalance(connection, publicKey!)
        .then((lamports) => {
          if (cancelled) return;
          const claimed = readRecentClaims(wallet);
          setReferralBalanceLamports(claimed.has('referral-balance') ? 0 : lamports);
        })
        .catch(() => {
          // Silent — card just stays hidden if RPC blips.
        });

      // Seeker profile — to show Verified state or VERIFY button
      getSeekerProfile(wallet)
        .then((p) => {
          if (!cancelled) setSeekerProfile(p);
        })
        .catch(() => {
          // Silent — card shows verify CTA by default
        });

      // Recent activity feed — merge round game_sessions + duels + custom_game_sessions
      try {
        const [gsRes, duelRes, customRes] = await Promise.all([
          supabase
            .from('game_sessions')
            .select('round_id, rank, score, payout_lamports, finished_at, daily_rounds(round_number, date)')
            .eq('wallet_address', wallet)
            .not('finished_at', 'is', null)
            .order('finished_at', { ascending: false })
            .limit(6),
          supabase
            .from('duels')
            .select('duel_id, winner_wallet, total_pot_lamports, entry_fee_lamports, resolved_at, player1_wallet, player2_wallet')
            .or(`player1_wallet.eq.${wallet},player2_wallet.eq.${wallet}`)
            .in('status', ['completed', 'resolved'])
            .order('resolved_at', { ascending: false })
            .limit(6),
          supabase
            .from('custom_game_sessions')
            // Schema: column is game_id (FK to custom_games.id) and completed_at,
            // NOT custom_game_id / finished_at. Kyle 2026-06-09.
            .select('game_id, score, completed_at, custom_games(name, slug)')
            .eq('wallet_address', wallet)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(6),
        ]);

        const rows: ActivityRow[] = [];
        for (const g of (gsRes.data ?? []) as any[]) {
          if (!g.finished_at) continue;
          const r = g.daily_rounds;
          const roundLabel = r
            ? `Round ${(r.round_number ?? 0) + 1} · ${r.date}`
            : 'Round';
          const sol = (g.payout_lamports ?? 0) / 1_000_000_000;
          const meta =
            g.rank != null
              ? `Placed #${g.rank}${sol > 0 ? ` · +${sol.toFixed(3)} SOL` : g.score != null ? ` · ${g.score.toLocaleString()} pts` : ''}`
              : g.score != null
                ? `${g.score.toLocaleString()} pts`
                : 'Finished';
          rows.push({
            key: `gs-${g.round_id}-${g.finished_at}`,
            txt: roundLabel,
            meta,
            col: g.rank === 1 ? C.gold : g.rank != null && g.rank <= 5 ? C.primary : C.blue,
            icon: 'trophy',
            at: new Date(g.finished_at).getTime(),
          });
        }
        for (const d of (duelRes.data ?? []) as any[]) {
          if (!d.resolved_at) continue;
          const iWon = d.winner_wallet === wallet;
          const oppWallet =
            d.player1_wallet === wallet ? d.player2_wallet : d.player1_wallet;
          const oppShort = oppWallet
            ? `${oppWallet.slice(0, 4)}…${oppWallet.slice(-4)}`
            : 'opponent';
          const sol =
            (iWon ? d.total_pot_lamports : d.entry_fee_lamports) / 1_000_000_000;
          rows.push({
            key: `duel-${d.duel_id}`,
            txt: iWon ? `Duel vs ${oppShort}` : `Duel vs ${oppShort}`,
            meta: iWon ? `Won · +${sol.toFixed(3)} SOL` : `Lost · −${sol.toFixed(3)} SOL`,
            col: iWon ? C.primary : C.red,
            icon: 'swords',
            at: new Date(d.resolved_at).getTime(),
          });
        }
        for (const c of (customRes.data ?? []) as any[]) {
          // custom_game_sessions uses completed_at + game_id (not finished_at/custom_game_id).
          if (!c.completed_at) continue;
          const game = c.custom_games;
          const label = game?.name ?? 'Custom game';
          rows.push({
            key: `custom-${c.game_id}-${c.completed_at}`,
            txt: label,
            meta: c.score != null ? `${c.score.toLocaleString()} pts` : 'Finished',
            col: C.blue,
            // Match the Custom Games tile icon on Home (wand-sparkles). Kyle 2026-06-09.
            icon: 'sparkles',
            at: new Date(c.completed_at).getTime(),
          });
        }
        rows.sort((a, b) => b.at - a.at);
        if (!cancelled) setActivity(rows.slice(0, 6));
      } catch (err) {
        console.warn('ProfileViewV2 activity fetch failed', err);
      }

      // Player stats — single query, all aggregates derived from it + a few side queries
      try {
        const [
          profileRes,
          duelsAllRes,
          paidPayoutsRes,
          topThreeRes,
          rankRes,
        ] = await Promise.all([
          supabase
            .from('player_profiles')
            .select('total_points, total_games_played, current_streak, created_at')
            .eq('wallet_address', wallet)
            .maybeSingle(),
          supabase
            .from('duels')
            .select('duel_id, winner_wallet, status')
            .or(`player1_wallet.eq.${wallet},player2_wallet.eq.${wallet}`)
            .in('status', ['completed', 'resolved']),
          supabase
            .from('round_payouts')
            .select('paid_lamports, prize_lamports')
            .eq('wallet_address', wallet)
            .not('paid_at', 'is', null),
          supabase
            .from('round_payouts')
            .select('rank', { count: 'exact', head: true })
            .eq('wallet_address', wallet)
            .lte('rank', 3),
          (async () => {
            const profile = await supabase
              .from('player_profiles')
              .select('total_points')
              .eq('wallet_address', wallet)
              .maybeSingle();
            const myXp = profile.data?.total_points ?? 0;
            if (myXp <= 0) return { count: null as number | null };
            const above = await supabase
              .from('player_profiles')
              .select('wallet_address', { count: 'exact', head: true })
              .gt('total_points', myXp);
            return { count: (above.count ?? 0) + 1 };
          })(),
        ]);

        const profile = profileRes.data;
        const duelRows = (duelsAllRes.data ?? []) as Array<{
          duel_id: number;
          winner_wallet: string | null;
          status: string;
        }>;
        const duelsWon = duelRows.filter((d) => d.winner_wallet === wallet).length;
        const duelsLost = duelRows.length - duelsWon;
        const paidLamports = (paidPayoutsRes.data ?? []).reduce(
          (s: number, row: { paid_lamports: number | null; prize_lamports: number | null }) =>
            s + Number(row.paid_lamports ?? row.prize_lamports ?? 0),
          0
        );
        const next: FetchedStats = {
          totalPoints: profile?.total_points ?? 0,
          totalGamesPlayed: profile?.total_games_played ?? 0,
          currentStreak: profile?.current_streak ?? 0,
          createdAt: profile?.created_at ?? null,
          duelsWon,
          duelsLost,
          earnedSol: paidLamports / 1_000_000_000,
          topThree: topThreeRes.count ?? 0,
          rank: rankRes.count ?? null,
        };
        if (!cancelled) setFetchedStats(next);
      } catch (err) {
        console.warn('ProfileViewV2 stats fetch failed', err);
      }

      const [rounds, duelCandidates, customCandidates, refRounds, refCustoms, refDuels] = await Promise.all([
        fetchUnpaidRoundPayouts(connection, wallet),
        fetchUnclaimedDuelWins(connection, wallet),
        fetchUnclaimedCustomWins(connection, wallet),
        fetchClaimableRefundEntries(connection, wallet),
        fetchClaimableRefundCustoms(connection, wallet),
        fetchClaimableRefundDuels(connection, wallet),
      ]);
      if (cancelled) return;
      // Filter the just-fetched lists through localStorage recent-claims set
      // so anything the user already claimed (and the indexer hasn't sync'd
      // yet) stays HIDDEN. Prevents "claim row reappears on refresh" UX bug.
      const claimed = readRecentClaims(wallet);
      setRefundRounds(refRounds.filter((e) => !claimed.has(`refund-round-${e.round_id}-${e.tier_index}`)));
      setRefundCustoms(refCustoms.filter((c) => !claimed.has(`refund-custom-${c.on_chain_game_id}`)));
      setRefundDuels(refDuels.filter((d) => !claimed.has(`refund-duel-${d.duel_id}`)));
      setRoundPayouts(rounds.filter((p) => !claimed.has(`round-${p.round_id}-${p.rank}`)));
      setDuelWins(duelCandidates.filter((d) => !claimed.has(`duel-${d.duel_id}`)));
      setCustomWins(customCandidates.filter((c) => !claimed.has(`custom-${c.on_chain_game_id}`)));
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  const hasAnyClaims =
    roundPayouts.length > 0 || duelWins.length > 0 || customWins.length > 0
    || referralBalanceLamports > 0;
  const totalClaimableLamports =
    roundPayouts.reduce((s, p) => s + p.prize_lamports, 0) +
    duelWins.reduce((s, d) => s + d.total_pot_lamports, 0) +
    customWins.reduce((s, c) => s + c.prize_lamports, 0) +
    referralBalanceLamports;

  const handleClaimReferral = async () => {
    if (!onClaimReferralBalance) return;
    const key = 'referral-balance';
    setClaimingKey(key);
    try {
      await onClaimReferralBalance();
      // Persist that this wallet has claimed referrals so the card stays
      // hidden even if a stale balance read comes back before backend syncs.
      markClaimed(publicKey?.toBase58() ?? null, key);
      // Refetch the on-chain balance — should now be 0.
      const wallet = publicKey;
      if (wallet) {
        const fresh = await fetchReferralBalance(connection, wallet);
        setReferralBalanceLamports(fresh);
      } else {
        setReferralBalanceLamports(0);
      }
    } catch (err: any) {
      // User-cancel: silent. Other errors: brief alert; PDA-empty races
      // get the friendlier "already withdrawn" framing.
      const msg = (err?.message || '').toString();
      if (msg.includes('User rejected') || msg.includes('user reject')) {
        // Silent on user cancel.
      } else if (msg.includes('NothingToSweep') || msg.includes('nothing to sweep')) {
        alert('Nothing to claim — your referral balance may have already been withdrawn.');
        // Reflect on-chain truth either way.
        const wallet = publicKey;
        if (wallet) {
          const fresh = await fetchReferralBalance(connection, wallet);
          setReferralBalanceLamports(fresh);
        }
      } else {
        alert(msg || 'Failed to claim referral balance. Please try again.');
      }
    } finally {
      setClaimingKey(null);
    }
  };

  // Each claim handler: optimistically removes the row + persists the key
  // to localStorage so it stays hidden across page revisits/polls until the
  // backend syncs (24h TTL). Prevents the "claim button reappears, user
  // clicks again, fails on-chain" UX bug.
  const walletStr = publicKey?.toBase58() ?? null;

  const handleClaimRound = async (payout: ClaimablePayout) => {
    if (!onClaimRoundPrize) return;
    const key = `round-${payout.round_id}-${payout.rank}`;
    setClaimingKey(key);
    try {
      await onClaimRoundPrize(payout);
      markClaimed(walletStr, key);
      setRoundPayouts((prev) =>
        prev.filter((p) => !(p.round_id === payout.round_id && p.rank === payout.rank))
      );
    } finally {
      setClaimingKey(null);
    }
  };

  const handleClaimDuel = async (duel: MyDuelWin) => {
    const splMint = (duel as { token_mint?: string | null }).token_mint;
    const useSpl = !!splMint && !!onClaimDuelSplPrize;
    if (!useSpl && !onClaimDuelPrize) return;
    const key = `duel-${duel.duel_id}`;
    setClaimingKey(key);
    try {
      if (useSpl) await onClaimDuelSplPrize!(duel.duel_id, splMint!);
      else await onClaimDuelPrize!(duel.duel_id);
      markClaimed(walletStr, key);
      setDuelWins((prev) => prev.filter((d) => d.duel_id !== duel.duel_id));
    } finally {
      setClaimingKey(null);
    }
  };

  const handleClaimCustom = async (win: ClaimableCustomGameWin) => {
    const splMint = win.token_mint;
    const useSpl = !!splMint && !!onClaimCustomSplPrize;
    if (!useSpl && !onClaimCustomPrize) return;
    const key = `custom-${win.on_chain_game_id}`;
    setClaimingKey(key);
    try {
      if (useSpl) await onClaimCustomSplPrize!(win.on_chain_game_id, splMint!);
      else await onClaimCustomPrize!(win.on_chain_game_id);
      markClaimed(walletStr, key);
      setCustomWins((prev) =>
        prev.filter((c) => c.on_chain_game_id !== win.on_chain_game_id)
      );
    } finally {
      setClaimingKey(null);
    }
  };

  const handleRefundRound = async (entry: RefundableEntry) => {
    if (!onClaimRoundRefund) return;
    const key = `refund-round-${entry.round_id}-${entry.tier_index}`;
    setClaimingKey(key);
    try {
      await onClaimRoundRefund(entry);
      markClaimed(walletStr, key);
      setRefundRounds((prev) =>
        prev.filter((e) => !(e.round_id === entry.round_id && e.tier_index === entry.tier_index))
      );
    } finally {
      setClaimingKey(null);
    }
  };

  const handleRefundCustom = async (cg: RefundableCustomGame) => {
    if (!onClaimCustomRefund) return;
    const key = `refund-custom-${cg.on_chain_game_id}`;
    setClaimingKey(key);
    try {
      await onClaimCustomRefund(cg.on_chain_game_id);
      markClaimed(walletStr, key);
      setRefundCustoms((prev) => prev.filter((c) => c.on_chain_game_id !== cg.on_chain_game_id));
    } finally {
      setClaimingKey(null);
    }
  };

  const handleRefundDuel = async (d: RefundableDuel) => {
    if (!onClaimDuelRefund || !publicKey) return;
    const key = `refund-duel-${d.duel_id}`;
    setClaimingKey(key);
    try {
      await onClaimDuelRefund(d.duel_id, publicKey.toBase58());
      markClaimed(walletStr, key);
      setRefundDuels((prev) => prev.filter((x) => x.duel_id !== d.duel_id));
    } finally {
      setClaimingKey(null);
    }
  };

  const copyWallet = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 2000);
  };

  // Stats (prefer prop overrides, then fetched real data, then '—' fallbacks).
  // Win rate: if any duels played → percentage W/L, else '—' with NO DUELS sub.
  const rankFinal = rank ?? fetchedStats?.rank ?? null;
  const totalXpFinal = totalXp ?? fetchedStats?.totalPoints ?? null;
  const gamesPlayedFinal = gamesPlayed ?? fetchedStats?.totalGamesPlayed ?? null;
  const earnedSolFinal = earnedSol ?? fetchedStats?.earnedSol ?? null;
  const streakFinal = streak ?? fetchedStats?.currentStreak ?? null;
  const topFinishesFinal = topThreeFinishes ?? fetchedStats?.topThree ?? null;
  const joinedFinal = joinedDate ?? fetchedStats?.createdAt ?? null;

  const duelsWonFinal = fetchedStats?.duelsWon ?? 0;
  const duelsLostFinal = fetchedStats?.duelsLost ?? 0;
  const totalDuels = duelsWonFinal + duelsLostFinal;
  const winRateExplicit = winRate != null;
  const winRatePct = winRateExplicit
    ? winRate as number
    : totalDuels > 0
      ? (duelsWonFinal / totalDuels) * 100
      : null;

  // Level — slow sqrt curve, capped at 1000. LVL 100 at 980K XP, LVL 1000 at 99.8M XP.
  const level =
    totalXpFinal == null
      ? null
      : Math.min(1000, Math.floor(Math.sqrt(Math.max(0, totalXpFinal) / 100)) + 1);

  const statRank = rankFinal != null ? `#${rankFinal}` : '—';
  const statXp = totalXpFinal != null ? totalXpFinal.toLocaleString() : '—';
  const statGames = gamesPlayedFinal != null ? gamesPlayedFinal.toString() : '—';
  const statWinRate = winRatePct != null ? `${Math.round(winRatePct)}%` : '—';
  const statWinRateSub = winRateExplicit
    ? 'CUSTOMS + DUELS'
    : totalDuels > 0
      ? `${duelsWonFinal}W · ${duelsLostFinal}L`
      : 'NO DUELS YET';
  const statEarned = earnedSolFinal != null
    ? `${earnedSolFinal >= 0 ? '+' : ''}${earnedSolFinal.toFixed(2)}`
    : '—';
  const streakDays = streakFinal != null ? streakFinal : 0;
  const topFinishes = topFinishesFinal != null ? topFinishesFinal : 0;
  const joinedLabel = formatJoined(joinedFinal);

  const baseLabel: React.CSSProperties = {
    fontFamily: '"Saira Condensed", "Bebas Neue", system-ui, sans-serif',
    fontStyle: 'italic',
    fontWeight: 800,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  };
  const display: React.CSSProperties = {
    fontFamily: '"Saira Condensed", "Bebas Neue", system-ui, sans-serif',
    fontStyle: 'italic',
    fontWeight: 900,
    letterSpacing: '-0.01em',
    lineHeight: 0.95,
  };

  return (
    <div className="max-w-5xl">
      {/* 1. Colorful gradient banner */}
      <div
        style={{
          position: 'relative',
          borderRadius: 18,
          padding: '24px 28px',
          background: `linear-gradient(110deg, ${C.primary}, ${C.secondary} 35%, #7C8DFF 70%, ${C.purple})`,
          color: '#000',
          marginBottom: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: isMobile ? 8 : 20, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ minWidth: 0, flex: 1, width: isMobile ? '100%' : 'auto' }}>
            <div style={{ ...baseLabel, fontSize: 10, opacity: 0.7 }}>
              PLAYER {level != null ? `· LVL ${level}` : ''}
            </div>
            <div style={{ ...display, fontSize: isMobile ? 32 : 54, marginTop: 4, wordBreak: 'break-word', lineHeight: 1.2, overflow: 'visible' }}>
              {username || '@YOU'}
              {/* SKR "S" badge — gold, inline superscript at end of username.
                  Inline-block + vertical-align:super so it never gets clipped
                  by parent overflow. Kyle 2026-06-09. */}
              {seekerProfile?.is_seeker_verified && (
                <span
                  title="Seeker Genesis Token Holder"
                  style={{
                    display: 'inline-block',
                    width: isMobile ? 18 : 30,
                    height: isMobile ? 18 : 30,
                    backgroundColor: '#FFD700',
                    WebkitMaskImage: 'url(/seeker-badge.png)',
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskImage: 'url(/seeker-badge.png)',
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    marginLeft: 6,
                    verticalAlign: 'super',
                    transform: 'scale(0.85)',
                  }}
                />
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <button
                onClick={copyWallet}
                style={{
                  ...baseLabel,
                  fontSize: 9,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  background: 'rgba(0,0,0,0.85)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: 999,
                  letterSpacing: 0,
                  textTransform: 'none',
                  fontStyle: 'normal',
                  fontWeight: 600,
                  border: 'none',
                  cursor: publicKey ? 'pointer' : 'default',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Copy wallet address"
                disabled={!publicKey}
              >
                {walletShort}
                {walletCopied ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : null}
              </button>
            </div>
          </div>
          <button
            onClick={onEdit}
            style={{
              ...baseLabel,
              appearance: 'none',
              cursor: 'pointer',
              border: 'none',
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              borderRadius: 999,
              padding: '10px 18px',
              fontSize: 10,
              flexShrink: 0,
            }}
          >
            EDIT PROFILE
          </button>
        </div>
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            // Padding-left clears the avatar (88x88 + 5px pad + 28px left offset
            // = 121px wide overlap). Stats now start to the right of the PFP so
            // STREAK + FINISHES no longer hide behind it.
            paddingLeft: 124,
            borderTop: '1.5px dashed rgba(0,0,0,0.22)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            rowGap: 8,
          }}
        >
          <div style={{ ...baseLabel, fontSize: 11, opacity: 0.85 }}>
            JOINED <b style={{ color: '#000', fontWeight: 900 }}>{joinedLabel}</b>
          </div>
          <div style={{ ...baseLabel, fontSize: 11, opacity: 0.85 }}>
            🔥 <b style={{ color: '#000', fontWeight: 900 }}>{streakDays}-DAY STREAK</b>
          </div>
          <div style={{ ...baseLabel, fontSize: 11, opacity: 0.85 }}>
            🏆 <b style={{ color: '#000', fontWeight: 900 }}>{topFinishes} TOP-3 FINISHES</b>
          </div>
        </div>
        {/* 2. Avatar floats over the bottom-left edge — click to upload */}
        <div style={{ position: 'absolute', bottom: -44, left: 28 }}>
          <div style={{ padding: 5, background: C.bg, borderRadius: 18 }}>
            <button
              type="button"
              onClick={() => publicKey && setShowAvatarUpload(true)}
              style={{
                width: 88,
                height: 88,
                borderRadius: 13,
                overflow: 'hidden',
                background: '#0a0a0a',
                border: `2px solid ${C.primary}`,
                padding: 0,
                cursor: publicKey ? 'pointer' : 'default',
                position: 'relative',
              }}
              title={publicKey ? 'Change avatar' : ''}
            >
              <img
                src={localAvatar || avatar || DEFAULT_AVATAR}
                alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Pending claims — each TYPE gets its own colored card so the visual
          identity at a glance matches the claim type. Green = round, red =
          duel, blue = custom, gold = referral. Replaces the single mega-card
          where everything bled together. */}
      {/* ─── ROUND WINNINGS (GREEN) ─────────────────────────────────────── */}
      {roundPayouts.length > 0 && (
        <div
          style={{
            background: C.surfaceUp,
            border: `1px solid ${C.primary}55`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: `linear-gradient(110deg, ${C.primary}1a, transparent 60%)`,
            }}
          >
            <div>
              <div style={{ ...baseLabel, fontSize: 10, color: C.primary, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="gift" size={13} color="#fff" />
                ROUND WINNINGS
              </div>
              <div style={{ ...display, fontSize: 22, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                +{(roundPayouts.reduce((s, p) => s + p.prize_lamports, 0) / 1_000_000_000).toFixed(4)}{' '}
                <span style={{ fontSize: 12, color: C.primary }}>SOL</span>
              </div>
            </div>
            <div style={{ ...baseLabel, fontSize: 10, color: C.primary }}>
              {roundPayouts.length} READY
            </div>
          </div>

          {/* Round payout rows */}
          {roundPayouts.map((p, i) => {
            const key = `round-${p.round_id}-${p.rank}`;
            const isClaiming = claimingKey === key;
            const otherClaiming = claimingKey !== null && claimingKey !== key;
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 18px',
                  gap: 12,
                  borderTop: i === 0 ? 'none' : `1px solid ${C.borderLight}`,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: C.primary,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="gift" size={14} color="#000" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>
                    #{p.rank} · {p.round_title}
                  </div>
                  <div
                    style={{
                      ...baseLabel,
                      fontSize: 10,
                      color: C.gold,
                      marginTop: 2,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    +{(p.prize_lamports / 1_000_000_000).toFixed(4)} SOL
                  </div>
                </div>
                <button
                  onClick={() => handleClaimRound(p)}
                  disabled={isClaiming || otherClaiming}
                  style={{
                    ...baseLabel,
                    appearance: 'none',
                    border: 'none',
                    background: C.primary,
                    color: '#000',
                    fontSize: 11,
                    padding: '8px 16px',
                    borderRadius: 999,
                    cursor: isClaiming || otherClaiming ? 'not-allowed' : 'pointer',
                    opacity: isClaiming || otherClaiming ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  {isClaiming ? 'CLAIMING…' : 'CLAIM'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── DUEL WINNINGS (RED) ─────────────────────────────────────────── */}
      {duelWins.length > 0 && (
        <div
          style={{
            background: C.surfaceUp,
            border: `1px solid ${C.red}55`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: `linear-gradient(110deg, ${C.red}1a, transparent 60%)`,
            }}
          >
            <div>
              <div style={{ ...baseLabel, fontSize: 10, color: C.red, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="gift" size={13} color="#fff" />
                DUEL WINNINGS
              </div>
              <div style={{ ...display, fontSize: 22, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                +{(duelWins.reduce((s, d) => s + d.total_pot_lamports, 0) / 1_000_000_000).toFixed(4)}{' '}
                <span style={{ fontSize: 12, color: C.red }}>SOL</span>
              </div>
            </div>
            <div style={{ ...baseLabel, fontSize: 10, color: C.red }}>
              {duelWins.length} READY
            </div>
          </div>

          {/* Duel win rows */}
          {duelWins.map((d, i) => {
            const key = `duel-${d.duel_id}`;
            const isClaiming = claimingKey === key;
            const otherClaiming = claimingKey !== null && claimingKey !== key;
            const oppLabel =
              d.opponent_username ||
              (d.opponent_wallet
                ? `${d.opponent_wallet.slice(0, 4)}…${d.opponent_wallet.slice(-4)}`
                : '—');
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 18px',
                  gap: 12,
                  borderTop: i === 0 ? 'none' : `1px solid ${C.borderLight}`,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: C.red,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="gift" size={14} color="#000" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>
                    BEAT @{oppLabel}
                  </div>
                  <div
                    style={{
                      ...baseLabel,
                      fontSize: 10,
                      color: C.gold,
                      marginTop: 2,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    +{(d.total_pot_lamports / 1_000_000_000).toFixed(4)} SOL
                  </div>
                </div>
                <button
                  onClick={() => handleClaimDuel(d)}
                  disabled={isClaiming || otherClaiming}
                  style={{
                    ...baseLabel,
                    appearance: 'none',
                    border: 'none',
                    background: C.red,
                    color: '#000',
                    fontSize: 11,
                    padding: '8px 16px',
                    borderRadius: 999,
                    cursor: isClaiming || otherClaiming ? 'not-allowed' : 'pointer',
                    opacity: isClaiming || otherClaiming ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  {isClaiming ? 'CLAIMING…' : 'CLAIM'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CUSTOM GAME WINNINGS (BLUE) ─────────────────────────────────── */}
      {customWins.length > 0 && (
        <div
          style={{
            background: C.surfaceUp,
            border: `1px solid ${C.blue}55`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: `linear-gradient(110deg, ${C.blue}1a, transparent 60%)`,
            }}
          >
            <div>
              <div style={{ ...baseLabel, fontSize: 10, color: C.blue, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="gift" size={13} color="#fff" />
                CUSTOM GAME WINNINGS
              </div>
              <div style={{ ...display, fontSize: 22, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                +{(customWins.reduce((s, c) => s + c.prize_lamports, 0) / 1_000_000_000).toFixed(4)}{' '}
                <span style={{ fontSize: 12, color: C.blue }}>SOL</span>
              </div>
            </div>
            <div style={{ ...baseLabel, fontSize: 10, color: C.blue }}>
              {customWins.length} READY
            </div>
          </div>

          {/* Custom game win rows */}
          {customWins.map((c, i) => {
            const key = `custom-${c.on_chain_game_id}`;
            const isClaiming = claimingKey === key;
            const otherClaiming = claimingKey !== null && claimingKey !== key;
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 18px',
                  gap: 12,
                  borderTop: i === 0 ? 'none' : `1px solid ${C.borderLight}`,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: C.blue,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="gift" size={14} color="#000" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>
                    {c.name}
                  </div>
                  <div
                    style={{
                      ...baseLabel,
                      fontSize: 10,
                      color: C.gold,
                      marginTop: 2,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    +{(() => {
                      // SPL custom games: show token amount in real units + symbol.
                      if (c.token_mint && c.token_decimals != null) {
                        const amt = c.prize_lamports / Math.pow(10, c.token_decimals);
                        return `${amt.toFixed(2)} ${c.token_symbol || 'SPL'}`;
                      }
                      return `${(c.prize_lamports / 1_000_000_000).toFixed(4)} SOL`;
                    })()}
                    <JupiterVerifiedBadge mint={c.token_mint ?? null} size={10} />
                    {' · CUSTOM GAME'}
                  </div>
                </div>
                <button
                  onClick={() => handleClaimCustom(c)}
                  disabled={isClaiming || otherClaiming}
                  style={{
                    ...baseLabel,
                    appearance: 'none',
                    border: 'none',
                    background: C.blue,
                    color: '#000',
                    fontSize: 11,
                    padding: '8px 16px',
                    borderRadius: 999,
                    cursor: isClaiming || otherClaiming ? 'not-allowed' : 'pointer',
                    opacity: isClaiming || otherClaiming ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  {isClaiming ? 'CLAIMING…' : 'CLAIM'}
                </button>
              </div>
            );
          })}

        </div>
      )}

      {/* ─── REFERRAL EARNINGS (GOLD) ────────────────────────────────────── */}
      {referralBalanceLamports > 0 && (() => {
        const key = 'referral-balance';
        const isClaiming = claimingKey === key;
        const otherClaiming = claimingKey !== null && claimingKey !== key;
        return (
          <div
            style={{
              background: C.surfaceUp,
              border: `1px solid ${C.gold}55`,
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: `1px solid ${C.borderLight}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                background: `linear-gradient(110deg, ${C.gold}1a, transparent 60%)`,
              }}
            >
              <div>
                <div style={{ ...baseLabel, fontSize: 10, color: C.gold, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="gift" size={13} color="#fff" />
                  REFERRAL EARNINGS
                </div>
                <div style={{ ...display, fontSize: 22, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  +{(referralBalanceLamports / 1_000_000_000).toFixed(4)}{' '}
                  <span style={{ fontSize: 12, color: C.gold }}>SOL</span>
                </div>
              </div>
              <div style={{ ...baseLabel, fontSize: 10, color: C.gold }}>
                1 READY
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 18px',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: C.gold,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="gift" size={14} color="#000" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>
                  COMMISSIONS EARNED
                </div>
                <div
                  style={{
                    ...baseLabel,
                    fontSize: 10,
                    color: C.gold,
                    marginTop: 2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  +{(referralBalanceLamports / 1_000_000_000).toFixed(4)} SOL · ON-CHAIN PDA
                </div>
              </div>
              <button
                onClick={handleClaimReferral}
                disabled={isClaiming || otherClaiming || !onClaimReferralBalance}
                style={{
                  ...baseLabel,
                  appearance: 'none',
                  border: 'none',
                  background: C.gold,
                  color: '#000',
                  fontSize: 11,
                  padding: '8px 16px',
                  borderRadius: 999,
                  cursor: isClaiming || otherClaiming || !onClaimReferralBalance ? 'not-allowed' : 'pointer',
                  opacity: isClaiming || otherClaiming || !onClaimReferralBalance ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {isClaiming ? 'CLAIMING…' : 'CLAIM'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Refunds — split per type, same color-coding logic as the wins:
          green = round refund, blue = custom refund, red = duel refund. */}
      {/* ─── ROUND REFUNDS (GREEN) ───────────────────────────────────────── */}
      {refundRounds.length > 0 && (
        <div
          style={{
            background: C.surfaceUp,
            border: `1px solid ${C.primary}55`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: `linear-gradient(110deg, ${C.primary}1a, transparent 60%)`,
            }}
          >
            <div>
              <div style={{ ...baseLabel, fontSize: 10, color: C.primary, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <img src="/refund.png" alt="" style={{ width: 13, height: 13, display: 'inline-block', verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }} />
                ROUND REFUNDS
              </div>
              <div style={{ ...display, fontSize: 22, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                +{(refundRounds.reduce((s, e) => s + e.entry_fee_lamports, 0) / 1_000_000_000).toFixed(4)}{' '}
                <span style={{ fontSize: 12, color: C.primary }}>SOL</span>
              </div>
            </div>
            <div style={{ ...baseLabel, fontSize: 10, color: C.primary }}>
              {refundRounds.length} READY
            </div>
          </div>

          {/* Round refund rows */}
          {refundRounds.map((e, i) => {
              const key = `refund-round-${e.round_id}-${e.tier_index}`;
              const isClaiming = claimingKey === key;
              const otherClaiming = claimingKey !== null && claimingKey !== key;
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 18px',
                    gap: 12,
                    borderTop: i === 0 ? 'none' : `1px solid ${C.borderLight}`,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: C.primary,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <img src="/refund.png" alt="Refund" style={{ width: 18, height: 18, display: 'block' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>
                      {e.round_title} · &lt; 5 FINISHERS
                    </div>
                    <div
                      style={{
                        ...baseLabel,
                        fontSize: 10,
                        color: C.blue,
                        marginTop: 2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      REFUND {(e.entry_fee_lamports / 1_000_000_000).toFixed(4)} SOL
                    </div>
                  </div>
                  <button
                    onClick={() => handleRefundRound(e)}
                    disabled={isClaiming || otherClaiming}
                    style={{
                      ...baseLabel,
                      appearance: 'none',
                      border: 'none',
                      background: C.primary,
                      color: '#000',
                      fontSize: 11,
                      padding: '8px 16px',
                      borderRadius: 999,
                      cursor: isClaiming || otherClaiming ? 'not-allowed' : 'pointer',
                      opacity: isClaiming || otherClaiming ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {isClaiming ? 'CLAIMING…' : 'REFUND'}
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* ─── CUSTOM GAME REFUNDS (BLUE) ──────────────────────────────────── */}
      {refundCustoms.length > 0 && (
        <div
          style={{
            background: C.surfaceUp,
            border: `1px solid ${C.blue}55`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: `linear-gradient(110deg, ${C.blue}1a, transparent 60%)`,
            }}
          >
            <div>
              <div style={{ ...baseLabel, fontSize: 10, color: C.blue, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <img src="/refund.png" alt="" style={{ width: 13, height: 13, display: 'inline-block', verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }} />
                CUSTOM GAME REFUNDS
              </div>
              <div style={{ ...display, fontSize: 22, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                +{(refundCustoms.reduce((s, c) => s + c.entry_fee_lamports, 0) / 1_000_000_000).toFixed(4)}{' '}
                <span style={{ fontSize: 12, color: C.blue }}>SOL</span>
              </div>
            </div>
            <div style={{ ...baseLabel, fontSize: 10, color: C.blue }}>
              {refundCustoms.length} READY
            </div>
          </div>

          {/* Custom refund rows */}
          {refundCustoms.map((cg, i) => {
              const key = `refund-custom-${cg.on_chain_game_id}`;
              const isClaiming = claimingKey === key;
              const otherClaiming = claimingKey !== null && claimingKey !== key;
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 18px',
                    gap: 12,
                    borderTop: i === 0 ? 'none' : `1px solid ${C.borderLight}`,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: C.blue,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <img src="/refund.png" alt="Refund" style={{ width: 18, height: 18, display: 'block' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>
                      {cg.name} · EXPIRED
                    </div>
                    <div
                      style={{
                        ...baseLabel,
                        fontSize: 10,
                        color: C.blue,
                        marginTop: 2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      REFUND {(cg.entry_fee_lamports / 1_000_000_000).toFixed(4)} SOL
                    </div>
                  </div>
                  <button
                    onClick={() => handleRefundCustom(cg)}
                    disabled={isClaiming || otherClaiming}
                    style={{
                      ...baseLabel,
                      appearance: 'none',
                      border: 'none',
                      background: C.blue,
                      color: '#000',
                      fontSize: 11,
                      padding: '8px 16px',
                      borderRadius: 999,
                      cursor: isClaiming || otherClaiming ? 'not-allowed' : 'pointer',
                      opacity: isClaiming || otherClaiming ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {isClaiming ? 'CLAIMING…' : 'REFUND'}
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* ─── DUEL REFUNDS (RED) ──────────────────────────────────────────── */}
      {refundDuels.length > 0 && (
        <div
          style={{
            background: C.surfaceUp,
            border: `1px solid ${C.red}55`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${C.borderLight}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: `linear-gradient(110deg, ${C.red}1a, transparent 60%)`,
            }}
          >
            <div>
              <div style={{ ...baseLabel, fontSize: 10, color: C.red, letterSpacing: '0.18em', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <img src="/refund.png" alt="" style={{ width: 13, height: 13, display: 'inline-block', verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }} />
                DUEL REFUNDS
              </div>
              <div style={{ ...display, fontSize: 22, color: '#fff', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                +{(refundDuels.reduce((s, d) => s + d.entry_fee_lamports, 0) / 1_000_000_000).toFixed(4)}{' '}
                <span style={{ fontSize: 12, color: C.red }}>SOL</span>
              </div>
            </div>
            <div style={{ ...baseLabel, fontSize: 10, color: C.red }}>
              {refundDuels.length} READY
            </div>
          </div>

          {/* Duel refund rows */}
          {refundDuels.map((d, i) => {
              const key = `refund-duel-${d.duel_id}`;
              const isClaiming = claimingKey === key;
              const otherClaiming = claimingKey !== null && claimingKey !== key;
              return (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 18px',
                    gap: 12,
                    borderTop: i === 0 ? 'none' : `1px solid ${C.borderLight}`,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: C.red,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <img src="/refund.png" alt="Refund" style={{ width: 18, height: 18, display: 'block' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>
                      Duel #{d.duel_id} · NO OPPONENT
                    </div>
                    <div
                      style={{
                        ...baseLabel,
                        fontSize: 10,
                        color: C.red,
                        marginTop: 2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      REFUND {(d.entry_fee_lamports / 1_000_000_000).toFixed(4)} SOL
                    </div>
                  </div>
                  <button
                    onClick={() => handleRefundDuel(d)}
                    disabled={isClaiming || otherClaiming}
                    style={{
                      ...baseLabel,
                      appearance: 'none',
                      border: 'none',
                      background: C.red,
                      color: '#000',
                      fontSize: 11,
                      padding: '8px 16px',
                      borderRadius: 999,
                      cursor: isClaiming || otherClaiming ? 'not-allowed' : 'pointer',
                      opacity: isClaiming || otherClaiming ? 0.5 : 1,
                      flexShrink: 0,
                    }}
                  >
                    {isClaiming ? 'CLAIMING…' : 'REFUND'}
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* 3. Big colored stats — solid colored backgrounds, no borders.
          5-up on desktop, 2-up on mobile so the numbers stay legible. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
          gap: 10,
          marginBottom: 18,
        }}
      >
        {([
          { l: 'RANK', v: statRank, sub: 'GLOBAL', bg: C.primary },
          { l: 'XP', v: statXp, sub: 'LIFETIME', bg: C.cyan },
          { l: 'GAMES', v: statGames, sub: 'PLAYED', bg: C.purple },
          { l: 'WIN RATE', v: statWinRate, sub: statWinRateSub, bg: C.pink },
          { l: 'EARNED', v: statEarned, sub: 'SOL CLAIMED', bg: C.gold },
        ] as const).map((s) => (
          <div
            key={s.l}
            style={{
              background: s.bg,
              borderRadius: 12,
              padding: '14px 14px',
              textAlign: 'center',
              color: '#000',
            }}
          >
            <div style={{ ...baseLabel, fontSize: 9, opacity: 0.6, letterSpacing: '0.16em' }}>
              {s.l}
            </div>
            <div
              style={{
                ...display,
                fontSize: 30,
                marginTop: 4,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.v}
            </div>
            <div style={{ ...baseLabel, fontSize: 8, opacity: 0.6, marginTop: 4 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 4. NERD balance + SWAP — full-width row, gold-themed, real NERD logo */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 14,
          alignItems: 'center',
          background: `linear-gradient(110deg, ${C.gold}1f, transparent 60%)`,
          border: `1px solid ${C.gold}55`,
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <img
            src="/token-nerd.png"
            alt="NERD"
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
              border: `1.5px solid ${C.gold}`,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...baseLabel, fontSize: 9, color: C.gold, letterSpacing: '0.18em' }}>
              $NERD · NATIVE TOKEN
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ ...display, fontSize: 26, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {nerdBalance == null
                  ? '—'
                  : nerdBalance.toLocaleString(undefined, {
                      maximumFractionDigits: nerdBalance >= 1 ? 0 : 4,
                    })}
              </span>
              <span style={{ ...baseLabel, fontSize: 10, color: C.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                $NERD
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={onOpenSwap}
            style={{
              ...baseLabel,
              appearance: 'none',
              border: `1.5px solid ${C.gold}`,
              background: C.gold,
              color: '#000',
              fontSize: 11,
              padding: '8px 14px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            SWAP ↔
          </button>
        </div>
      </div>

      {/* Seeker Perks — gradient verify CTA, or verified perks display */}
      <div
        style={{
          background: C.surfaceUp,
          border: `1px solid ${C.purple}55`,
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 18,
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${C.borderLight}`,
            background: `linear-gradient(110deg, ${C.purple}1f, transparent 60%)`,
          }}
        >
          <div style={{ ...baseLabel, fontSize: 10, color: C.purple, letterSpacing: '0.18em' }}>
            SEEKER PERKS
          </div>
          <div style={{ ...baseLabel, fontSize: 10, color: '#a1a1aa', marginTop: 2 }}>
            EXCLUSIVE FOR SEEKER OWNERS
          </div>
        </div>
        <div style={{ padding: '16px 18px' }}>
          {seekerProfile?.is_seeker_verified ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `${C.primary}26`,
                    border: `1px solid ${C.primary}`,
                    display: 'grid',
                    placeItems: 'center',
                    color: C.primary,
                    fontWeight: 900,
                  }}
                >
                  ✓
                </div>
                <div>
                  <div style={{ ...display, fontSize: 18, color: C.primary }}>
                    Verified Seeker
                  </div>
                  <div style={{ ...baseLabel, fontSize: 9, color: '#a1a1aa', marginTop: 2 }}>
                    {seekerProfile.skr_domain ?? 'SGT detected on-chain'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { v: '+25%' as React.ReactNode, l: 'XP BOOST' },
                  { v: '50%' as React.ReactNode, l: 'OFF LIVES + PASS' },
                  {
                    // Real SKR logo replaces the ugly star. Kyle 2026-06-09.
                    v: (
                      <span
                        title="Seeker leaderboard badge"
                        style={{
                          display: 'inline-block',
                          width: 22,
                          height: 22,
                          backgroundColor: '#14F195',
                          WebkitMaskImage: 'url(/seeker-badge.png)',
                          WebkitMaskSize: 'contain',
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskPosition: 'center',
                          maskImage: 'url(/seeker-badge.png)',
                          maskSize: 'contain',
                          maskRepeat: 'no-repeat',
                          maskPosition: 'center',
                        }}
                      />
                    ) as React.ReactNode,
                    l: 'LEADERBOARD BADGE',
                  },
                ].map((p) => (
                  <div
                    key={p.l}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      border: `1px solid ${C.borderLight}`,
                      borderRadius: 10,
                      padding: '12px 8px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ ...display, fontSize: 18, color: C.primary, lineHeight: 1.1 }}>{p.v}</div>
                    <div style={{ ...baseLabel, fontSize: 8, color: '#a1a1aa', marginTop: 4 }}>
                      {p.l}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#d4d4d8', marginBottom: 14 }}>
                Own a Seeker? Verify your SGT to unlock +25% XP, 50% off lives + pass, and the SGT badge.
              </div>
              {seekerError && (
                <div style={{ ...baseLabel, fontSize: 10, color: C.red, marginBottom: 10 }}>
                  {seekerError}
                </div>
              )}
              <button
                onClick={handleVerifySeeker}
                disabled={!publicKey || seekerVerifying}
                style={{
                  ...baseLabel,
                  appearance: 'none',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 32px',
                  fontSize: 12,
                  background: `linear-gradient(90deg, ${C.purple}, ${C.primary})`,
                  color: '#fff',
                  cursor: publicKey && !seekerVerifying ? 'pointer' : 'not-allowed',
                  opacity: !publicKey || seekerVerifying ? 0.6 : 1,
                }}
              >
                {seekerVerifying ? 'VERIFYING…' : 'VERIFY SEEKER'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. Two-col body */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr', gap: 18 }}>
        {/* Left: ACCOUNT cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ ...baseLabel, fontSize: 10, color: C.textMuted, letterSpacing: '0.18em' }}>
            ACCOUNT
          </div>
          {/* Lives */}
          <div
            style={{
              background: C.surfaceUp,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <Icon name="heart" size={22} color={C.red} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...baseLabel, fontSize: 9, color: C.red }}>LIVES</div>
              <div
                style={{
                  ...display,
                  fontSize: 28,
                  color: '#fff',
                  marginTop: 4,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {lives == null ? '—' : lives}
              </div>
              <div style={{ ...baseLabel, fontSize: 9, color: '#a1a1aa', marginTop: 4 }}>
                RESTOCK ANY TIME
              </div>
            </div>
            <button
              onClick={onBuyLives}
              style={{
                ...baseLabel,
                appearance: 'none',
                border: `1.5px solid ${C.red}`,
                background: C.red,
                color: '#000',
                fontSize: 11,
                padding: '8px 14px',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              BUY MORE
            </button>
          </div>
          {/* Game Pass */}
          <div
            style={{
              background: C.surfaceUp,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <Icon name="ticket" size={22} color={C.primary} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...baseLabel, fontSize: 9, color: C.primary }}>GAME PASS</div>
              <div style={{ ...display, fontSize: 16, marginTop: 2, color: '#fff' }}>
                {hasGamePass ? 'UNLOCKED' : 'NOT UNLOCKED'}
              </div>
            </div>
            <button
              onClick={onOpenGamePass}
              style={{
                ...baseLabel,
                appearance: 'none',
                border: `1.5px solid ${C.primary}`,
                background: C.primary,
                color: '#000',
                fontSize: 11,
                padding: '8px 14px',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {hasGamePass ? 'MANAGE' : 'GET PASS'}
            </button>
          </div>
          {/* Referrals */}
          <div
            style={{
              background: C.surfaceUp,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <Icon name="user-plus" size={22} color={C.gold} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...baseLabel, fontSize: 9, color: C.gold }}>REFERRAL XP EARNED</div>
              <div
                style={{
                  ...display,
                  fontSize: 18,
                  color: '#fff',
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                +{(referralStats?.referral_points ?? 0).toLocaleString()}{' '}
                <span style={{ fontSize: 11, color: C.gold }}>XP</span>
              </div>
              <div style={{ ...baseLabel, fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                {referralStats == null
                  ? 'LOADING…'
                  : `${referralStats.total_referrals} REFERRED · ${referralStats.completed_referrals} COMPLETED`}
              </div>
            </div>
            <button
              onClick={onOpenReferrals}
              style={{
                ...baseLabel,
                appearance: 'none',
                border: `1.5px solid ${C.gold}`,
                background: C.gold,
                color: '#000',
                fontSize: 11,
                padding: '8px 14px',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              VIEW
            </button>
          </div>
          {/* Socials */}
          <div
            style={{
              background: C.surfaceUp,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ ...baseLabel, fontSize: 10, color: '#a1a1aa', flex: 1 }}>CONNECT</span>
            <a
              href="https://x.com/soltrivia_app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 24,
                height: 24,
                background: '#fff',
                color: '#000',
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 900,
              }}
              aria-label="X"
            >
              𝕏
            </a>
            <a
              href="https://discord.gg/xUUnTMRHcc"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 24,
                height: 24,
                background: C.discord,
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
              aria-label="Discord"
            >
              {/* Proper Discord controller-shaped logo. Kyle 2026-06-09 (was an ugly 𝓓 glyph). */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M19.3 5.34A18.5 18.5 0 0 0 15.13 4l-.21.42a17.5 17.5 0 0 0-5.85 0L8.87 4A18.5 18.5 0 0 0 4.7 5.34C2.2 9.09 1.52 12.74 1.86 16.35a18.7 18.7 0 0 0 5.7 2.92l.46-.66a13.4 13.4 0 0 1-2.16-1.07l.53-.43a13.5 13.5 0 0 0 11.21 0l.53.43a13.5 13.5 0 0 1-2.16 1.07l.46.66a18.7 18.7 0 0 0 5.7-2.92c.4-4.16-.66-7.78-2.83-11.01zM9 14.5c-1.05 0-1.91-1-1.91-2.24 0-1.23.85-2.24 1.91-2.24s1.92 1.01 1.91 2.24c0 1.24-.85 2.24-1.91 2.24zm6 0c-1.05 0-1.91-1-1.91-2.24 0-1.23.85-2.24 1.91-2.24s1.92 1.01 1.91 2.24c0 1.24-.85 2.24-1.91 2.24z" />
              </svg>
            </a>
            <a
              href="https://t.me/Sol_Trivia"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: 24,
                height: 24,
                background: '#26A5E4',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
              aria-label="Telegram"
            >
              {/* Proper Telegram paper-plane SVG. Kyle 2026-06-09 (was a ✈ unicode glyph). */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M21.71 3.27a1.07 1.07 0 0 0-1.18-.18L2.79 10.39a1 1 0 0 0 .07 1.86l4.86 1.62 2.21 6.69a1 1 0 0 0 .73.66 1 1 0 0 0 .95-.27l2.76-2.76 4.84 3.55a1 1 0 0 0 .59.19 1.07 1.07 0 0 0 .42-.09 1 1 0 0 0 .58-.78l2-16a1 1 0 0 0-.34-.79zm-9.36 11l-2.41 2.42-.93-2.83zm-1.83-.65L17 9.31 9.62 12.78z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Right: RECENT ACTIVITY */}
        <div>
          <div
            style={{
              ...baseLabel,
              fontSize: 10,
              color: C.textMuted,
              letterSpacing: '0.18em',
              marginBottom: 10,
            }}
          >
            RECENT ACTIVITY
          </div>
          <div
            style={{
              background: C.surfaceUp,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {activity.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  textAlign: 'center',
                  ...baseLabel,
                  fontSize: 10,
                  color: C.textMuted,
                }}
              >
                NO ACTIVITY YET · PLAY A ROUND TO GET STARTED
              </div>
            ) : (
              activity.map((a, i) => (
                <div
                  key={a.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    borderTop: i ? `1px solid ${C.borderLight}` : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: a.col,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={a.icon} size={13} color="#000" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>{a.txt}</div>
                    <div
                      style={{
                        ...baseLabel,
                        fontSize: 9,
                        color: C.textMuted,
                        marginTop: 2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {a.meta}
                    </div>
                  </div>
                  <span style={{ ...baseLabel, fontSize: 9, color: C.textDim }}>{relativeAgo(a.at)}</span>
                </div>
              ))
            )}
          </div>
          <button
            style={{
              ...baseLabel,
              appearance: 'none',
              cursor: 'pointer',
              width: '100%',
              background: C.surfaceUp,
              border: `1px solid ${C.borderLight}`,
              color: '#a1a1aa',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 10,
              marginTop: 8,
            }}
          >
            SEE FULL HISTORY →
          </button>
        </div>
      </div>

      {/* Sign out */}
      {onSignOut && (
        <button
          onClick={onSignOut}
          style={{
            marginTop: 24,
            width: '100%',
            ...baseLabel,
            appearance: 'none',
            cursor: 'pointer',
            background: C.red,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '14px 18px',
            fontSize: 13,
          }}
        >
          SIGN OUT
        </button>
      )}

      {/* Avatar upload modal */}
      {showAvatarUpload && publicKey && (
        <AvatarUpload
          walletAddress={publicKey.toBase58()}
          currentAvatar={localAvatar || avatar}
          onUploadSuccess={(url) => {
            setLocalAvatar(url);
            setShowAvatarUpload(false);
            onAvatarUpdated?.(url);
          }}
          onClose={() => setShowAvatarUpload(false)}
        />
      )}
    </div>
  );
};

export default ProfileViewV2;
