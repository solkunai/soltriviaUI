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
 * Real data is plumbed via props from App.tsx. Stats and activity are mocked
 * for now and will get wired in a follow-up. Existing ProfileView still owns
 * claim/refund/export/notification logic until those sections are ported.
 */
import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { SOLANA_NETWORK, DEFAULT_AVATAR } from '../src/utils/constants';
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
  onClaimCustomPrize?: (onChainGameId: number) => Promise<void>;
  onClaimRoundRefund?: (entry: RefundableEntry) => Promise<void>;
  onClaimCustomRefund?: (onChainGameId: number) => Promise<void>;
  onClaimDuelRefund?: (duelId: number, player1Wallet: string) => Promise<void>;
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
    heart: <path d="M12 21s-7-4.5-7-11a4 4 0 017-2.6A4 4 0 0119 10c0 6.5-7 11-7 11z" fill={color} />,
    sparkles: (
      <>
        <path d="M5 3l1.5 3L10 7l-3.5 1L5 11l-1.5-3L0 7l3.5-1L5 3z" fill={color} />
        <path d="M16 10l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill={color} />
      </>
    ),
    ticket: <path d="M3 8a2 2 0 002-2h14a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H5a2 2 0 00-2-2v-2a2 2 0 000-4V8z" fill="none" stroke={color} strokeWidth="1.6" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {paths[name] ?? null}
    </svg>
  );
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
  onClaimCustomPrize,
  onClaimRoundRefund,
  onClaimCustomRefund,
  onClaimDuelRefund,
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
            .select('custom_game_id, score, finished_at, custom_games(name, slug)')
            .eq('wallet_address', wallet)
            .not('finished_at', 'is', null)
            .order('finished_at', { ascending: false })
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
          if (!c.finished_at) continue;
          const game = c.custom_games;
          const label = game?.name ?? 'Custom game';
          rows.push({
            key: `custom-${c.custom_game_id}-${c.finished_at}`,
            txt: label,
            meta: c.score != null ? `${c.score.toLocaleString()} pts` : 'Finished',
            col: C.blue,
            icon: 'bolt',
            at: new Date(c.finished_at).getTime(),
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
      setRefundRounds(refRounds);
      setRefundCustoms(refCustoms);
      setRefundDuels(refDuels);
      setRoundPayouts(rounds);
      setDuelWins(duelCandidates);
      setCustomWins(customCandidates);
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection]);

  const hasAnyClaims =
    roundPayouts.length > 0 || duelWins.length > 0 || customWins.length > 0;
  const totalClaimableLamports =
    roundPayouts.reduce((s, p) => s + p.prize_lamports, 0) +
    duelWins.reduce((s, d) => s + d.total_pot_lamports, 0) +
    customWins.reduce((s, c) => s + c.prize_lamports, 0);

  const handleClaimRound = async (payout: ClaimablePayout) => {
    if (!onClaimRoundPrize) return;
    const key = `round-${payout.round_id}-${payout.rank}`;
    setClaimingKey(key);
    try {
      await onClaimRoundPrize(payout);
      setRoundPayouts((prev) =>
        prev.filter((p) => !(p.round_id === payout.round_id && p.rank === payout.rank))
      );
    } finally {
      setClaimingKey(null);
    }
  };

  const handleClaimDuel = async (duel: MyDuelWin) => {
    if (!onClaimDuelPrize) return;
    const key = `duel-${duel.duel_id}`;
    setClaimingKey(key);
    try {
      await onClaimDuelPrize(duel.duel_id);
      setDuelWins((prev) => prev.filter((d) => d.duel_id !== duel.duel_id));
    } finally {
      setClaimingKey(null);
    }
  };

  const handleClaimCustom = async (win: ClaimableCustomGameWin) => {
    if (!onClaimCustomPrize) return;
    const key = `custom-${win.on_chain_game_id}`;
    setClaimingKey(key);
    try {
      await onClaimCustomPrize(win.on_chain_game_id);
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
  const networkLabel = SOLANA_NETWORK === 'devnet' ? 'DEVNET' : 'MAINNET';

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...baseLabel, fontSize: 10, opacity: 0.7 }}>
              PLAYER {level != null ? `· LVL ${level}` : ''}
            </div>
            <div style={{ ...display, fontSize: 54, marginTop: 4 }}>
              {username || '@YOU'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <span
                style={{
                  ...baseLabel,
                  fontSize: 9,
                  background: 'rgba(0,0,0,0.85)',
                  color: C.primary,
                  padding: '4px 10px',
                  borderRadius: 999,
                  letterSpacing: '0.14em',
                }}
              >
                {networkLabel}
              </span>
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
            borderTop: '1.5px dashed rgba(0,0,0,0.22)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
          }}
        >
          <div style={{ ...baseLabel, fontSize: 9, opacity: 0.7 }}>
            JOINED <b style={{ color: '#000' }}>{joinedLabel}</b>
          </div>
          <div style={{ ...baseLabel, fontSize: 9, opacity: 0.7 }}>
            🔥 <b style={{ color: '#000' }}>{streakDays}-DAY STREAK</b>
          </div>
          <div style={{ ...baseLabel, fontSize: 9, opacity: 0.7 }}>
            🏆 <b style={{ color: '#000' }}>{topFinishes} TOP-3 FINISHES</b>
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

      {/* Pending claims — only renders when wallet has unclaimed prizes */}
      {hasAnyClaims && (
        <div
          style={{
            background: C.surfaceUp,
            border: `1px solid ${C.gold}55`,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 18,
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
              <div style={{ ...baseLabel, fontSize: 10, color: C.gold, letterSpacing: '0.18em' }}>
                ● UNCLAIMED PRIZES
              </div>
              <div
                style={{
                  ...display,
                  fontSize: 22,
                  color: '#fff',
                  marginTop: 4,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                +{(totalClaimableLamports / 1_000_000_000).toFixed(4)}{' '}
                <span style={{ fontSize: 12, color: C.gold }}>SOL</span>
              </div>
            </div>
            <div style={{ ...baseLabel, fontSize: 10, color: C.gold }}>
              {roundPayouts.length + duelWins.length + customWins.length} READY
            </div>
          </div>

          {/* Round payouts */}
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
                    background: C.gold,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name="trophy" size={14} color="#000" />
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
                    background: C.gold,
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

          {/* Duel wins */}
          {duelWins.map((d) => {
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
                  borderTop: `1px solid ${C.borderLight}`,
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
                  <Icon name="swords" size={14} color="#000" />
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
                    background: C.gold,
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

          {/* Custom game wins */}
          {customWins.map((c) => {
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
                  borderTop: `1px solid ${C.borderLight}`,
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
                  <Icon name="sparkles" size={14} color="#000" />
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
                    +{(c.prize_lamports / 1_000_000_000).toFixed(4)} SOL · CUSTOM GAME
                  </div>
                </div>
                <button
                  onClick={() => handleClaimCustom(c)}
                  disabled={isClaiming || otherClaiming}
                  style={{
                    ...baseLabel,
                    appearance: 'none',
                    border: 'none',
                    background: C.gold,
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

      {/* Refunds available — entries from rounds w/ <5 finishers, expired customs, no-opponent duels */}
      {(refundRounds.length + refundCustoms.length + refundDuels.length > 0) && (() => {
        const totalRefundLamports =
          refundRounds.reduce((s, e) => s + e.entry_fee_lamports, 0) +
          refundCustoms.reduce((s, c) => s + c.entry_fee_lamports, 0) +
          refundDuels.reduce((s, d) => s + d.entry_fee_lamports, 0);
        const totalRefunds = refundRounds.length + refundCustoms.length + refundDuels.length;
        return (
          <div
            style={{
              background: C.surfaceUp,
              border: `1px solid ${C.blue}55`,
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 18,
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
                <div style={{ ...baseLabel, fontSize: 10, color: C.blue, letterSpacing: '0.18em' }}>
                  ● REFUNDS AVAILABLE
                </div>
                <div
                  style={{
                    ...display,
                    fontSize: 22,
                    color: '#fff',
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  +{(totalRefundLamports / 1_000_000_000).toFixed(4)}{' '}
                  <span style={{ fontSize: 12, color: C.blue }}>SOL</span>
                </div>
              </div>
              <div style={{ ...baseLabel, fontSize: 10, color: C.blue }}>
                {totalRefunds} READY
              </div>
            </div>

            {/* Round refunds (rounds with <5 finishers) */}
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
                      background: C.blue,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="trophy" size={14} color="#000" />
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

            {/* Custom game refunds (expired) */}
            {refundCustoms.map((cg) => {
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
                    borderTop: `1px solid ${C.borderLight}`,
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
                    <Icon name="sparkles" size={14} color="#000" />
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

            {/* Duel refunds (no opponent joined before expiry) */}
            {refundDuels.map((d) => {
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
                    borderTop: `1px solid ${C.borderLight}`,
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
                    <Icon name="swords" size={14} color="#000" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...baseLabel, fontSize: 11, color: '#fff' }}>
                      Duel #{d.duel_id} · NO OPPONENT
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
        );
      })()}

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
                  { v: '+25%', l: 'XP BOOST' },
                  { v: '50%', l: 'OFF LIVES + PASS' },
                  { v: '★', l: 'LEADERBOARD BADGE' },
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
                    <div style={{ ...display, fontSize: 18, color: C.primary }}>{p.v}</div>
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
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...baseLabel, fontSize: 9, color: C.red }}>LIVES</div>
                <div
                  style={{
                    ...display,
                    fontSize: 28,
                    color: '#fff',
                    marginTop: 4,
                    fontVariantNumeric: 'tabular-nums',
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
            <Icon name="sparkles" size={22} color={C.gold} />
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
                fontSize: 11,
                fontWeight: 800,
              }}
              aria-label="Discord"
            >
              𝓓
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
                fontSize: 11,
              }}
              aria-label="Telegram"
            >
              ✈
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
