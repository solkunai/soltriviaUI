import React, { useState, useEffect } from 'react';
import { TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';
import { DEFAULT_AVATAR, REVENUE_WALLET, SOLANA_NETWORK, V2_TIER_LABELS } from '../src/utils/constants';

function claimExplorerUrl(signature: string): string {
  const base = 'https://explorer.solana.com';
  const cluster = SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `${base}/tx/${signature}${cluster}`;
}
import { fetchClaimableRoundPayouts, fetchClaimedRoundPayouts, initializeProgram, markPayoutClaimed, postWinnersOnChain, getReferralCode, getReferralStats, verifySeekerStatus, getSeekerProfile, toggleSkrDisplay, getMyCustomGames, fetchMyDuelWins, fetchMyCustomGameWins, fetchRefundableEntries, fetchRefundableCustomGames, fetchMyRefundableDuels, type ClaimablePayout, type ClaimedPayout, type ReferralStatsResponse, type SeekerProfile, type MyCustomGame, type MyDuelWin, type ClaimableCustomGameWin, type RefundableEntry, type RefundableCustomGame, type RefundableDuel } from '../src/utils/api';
import { buildClaimTierPrizeIx, buildClaimTierRefundIx, buildClaimCustomRefundIx, fetchDuel, fetchCustomGame, fetchTierRound, getTierVaultPda } from '../src/utils/soltriviaContract';
import { getRecentBlockhashWithRetry } from '../src/utils/rpc';
import AvatarUpload from './AvatarUpload';
import { isPushSupported, hasActiveSubscription, subscribeToPush, unsubscribeFromPush } from '../src/utils/notifications';
import { useTranslation } from 'react-i18next';

interface ProfileViewProps {
  username: string;
  avatar: string;
  profileCacheBuster?: number;
  onEdit: () => void;
  onOpenGuide?: () => void;
  onAvatarUpdated?: (url: string) => void;
  onSeekerVerified?: (verified: boolean) => void;
  onViewCustomGame?: (slug: string) => void;
  onClaimDuelPrize?: (duelId: number) => Promise<void>;
  onClaimDuelRefund?: (duelId: number, player1Wallet: string) => Promise<void>;
  onClaimCustomPrize?: (onChainGameId: number) => Promise<void>;
}

interface PlayerStats {
  total_games_played: number;
  total_wins: number;
  total_points: number;
  highest_score: number;
  current_streak: number;
  best_streak: number;
  total_sol_won: number;
}

interface GameHistory {
  round_id: string;
  rank: number;
  time_taken_seconds: number;
  correct_answers: number;
  total_questions: number;
  payout_sol: number;
  xp_earned: number;
  finished_at: string;
}

interface PlayedCustomGame {
  game_id: string;
  game_name: string;
  slug: string;
  best_score: number;
  correct_count: number;
  question_count: number;
  completed_at: string;
}

const ProfileView: React.FC<ProfileViewProps> = ({ username, avatar, profileCacheBuster = 0, onEdit, onOpenGuide, onAvatarUpdated, onSeekerVerified, onViewCustomGame, onClaimDuelPrize, onClaimDuelRefund, onClaimCustomPrize }) => {
  const { t } = useTranslation();
  const { publicKey, sendTransaction, signMessage } = useWallet();
  const { connection } = useConnection();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [claimablePayouts, setClaimablePayouts] = useState<ClaimablePayout[]>([]);
  const [claimedPayouts, setClaimedPayouts] = useState<ClaimedPayout[]>([]);
  const [claimingRoundId, setClaimingRoundId] = useState<string | null>(null);
  const [lastClaimTx, setLastClaimTx] = useState<{ signature: string; solAmount: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState(avatar);
  const [currentUsername, setCurrentUsername] = useState(username);
  const [referralStats, setReferralStats] = useState<ReferralStatsResponse | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [seekerProfile, setSeekerProfile] = useState<SeekerProfile | null>(null);
  const [seekerVerifying, setSeekerVerifying] = useState(false);
  const [seekerError, setSeekerError] = useState<string | null>(null);
  const [claimablePage, setClaimablePage] = useState(0);
  const [claimedPage, setClaimedPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [createdGames, setCreatedGames] = useState<MyCustomGame[]>([]);
  const [playedGames, setPlayedGames] = useState<PlayedCustomGame[]>([]);
  const [customGamesLoading, setCustomGamesLoading] = useState(false);
  const [customGameTab, setCustomGameTab] = useState<'created' | 'played'>('created');
  const [linkCopiedSlug, setLinkCopiedSlug] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const WINS_PER_PAGE = 3;
  const HISTORY_PER_PAGE = 5;
  const CUSTOM_GAMES_PER_PAGE = 5;
  const [createdGamesPage, setCreatedGamesPage] = useState(0);
  const [playedGamesPage, setPlayedGamesPage] = useState(0);
  const [claimableDuels, setClaimableDuels] = useState<MyDuelWin[]>([]);
  const [claimingDuelId, setClaimingDuelId] = useState<number | null>(null);
  const [claimableCustomGames, setClaimableCustomGames] = useState<ClaimableCustomGameWin[]>([]);
  const [claimingCustomGameId, setClaimingCustomGameId] = useState<number | null>(null);
  const [refundableEntries, setRefundableEntries] = useState<RefundableEntry[]>([]);
  const [claimingRefundId, setClaimingRefundId] = useState<string | null>(null);
  const [refundableCustomGames, setRefundableCustomGames] = useState<RefundableCustomGame[]>([]);
  const [claimingCGRefundId, setClaimingCGRefundId] = useState<number | null>(null);
  const [refundableDuels, setRefundableDuels] = useState<RefundableDuel[]>([]);
  const [claimingDuelRefundId, setClaimingDuelRefundId] = useState<number | null>(null);

  const displayAvatar = (currentAvatar || avatar) && profileCacheBuster
    ? (currentAvatar || avatar) + ((currentAvatar || avatar).includes('?') ? '&' : '?') + 'v=' + profileCacheBuster
    : (currentAvatar || avatar);

  // Sync local state with props from App.tsx (e.g. after EditProfileModal save)
  useEffect(() => {
    setCurrentUsername(username);
  }, [username]);

  useEffect(() => {
    setCurrentAvatar(avatar);
  }, [avatar]);

  const fetchProfileData = async () => {
      if (!publicKey) {
        setLoading(false);
        return;
      }

      setLoading(true); // Show loading indicator
      const walletAddress = publicKey.toBase58();
      
      console.log('🔍 Fetching profile for wallet:', walletAddress);
      
      try {
        // Fetch player profile/stats (includes username and avatar)
        const { data: profileData, error: profileError } = await supabase
          .from('player_profiles')
          .select('*')
          .eq('wallet_address', walletAddress)
          .single();

        if (profileError) {
          console.log('⚠️ Profile not found, using defaults:', profileError.message);
        } else {
          console.log('✅ Profile data:', profileData);
        }

        // Total SOL actually paid out to this wallet (round_payouts where paid_at is set)
        let totalSolPaid = 0;
        try {
          const { data: paidRows } = await supabase
            .from('round_payouts')
            .select('paid_lamports, prize_lamports')
            .eq('wallet_address', walletAddress)
            .not('paid_at', 'is', null);
          if (paidRows?.length) {
            totalSolPaid = paidRows.reduce(
              (sum, row) => sum + (Number(row.paid_lamports ?? row.prize_lamports ?? 0) || 0),
              0
            ) / 1_000_000_000;
          }
        } catch (_) {}

        const initialStats: PlayerStats = profileData
          ? {
              total_games_played: profileData.total_games_played ?? 0,
              total_wins: profileData.total_wins ?? 0,
              total_points: profileData.total_points ?? 0,
              highest_score: profileData.highest_score ?? 0,
              current_streak: profileData.current_streak ?? 0,
              best_streak: profileData.best_streak ?? 0,
              total_sol_won: totalSolPaid,
            }
          : {
              total_games_played: 0,
              total_wins: 0,
              total_points: 0,
              highest_score: 0,
              current_streak: 0,
              best_streak: 0,
              total_sol_won: totalSolPaid,
            };

        if (profileData) {
          setCurrentUsername(profileData.username || username);
          const url = profileData.avatar_url || avatar;
          setCurrentAvatar(url && !String(url).includes('picsum.photos') ? url : DEFAULT_AVATAR);
        } else {
          setCurrentUsername(username);
          setCurrentAvatar(avatar);
        }
        setStats(initialStats);

        // Fetch game history (last 10 games)
        console.log('🎮 Fetching game history for:', walletAddress);
        const { data: gamesData, error: gamesError } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('wallet_address', walletAddress)
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(10);

        if (gamesError) {
          console.error('❌ Error fetching games:', gamesError);
        } else {
          console.log('✅ Found games:', gamesData?.length || 0, 'games');
          console.log('Game data sample:', gamesData?.[0]);
        }

        if (gamesData && gamesData.length > 0) {
          console.log('📊 Processing game history...');
          
          // Fetch leaderboard ranks and payouts for each game
          const historyPromises = gamesData.map(async (game: any) => {
            let rank = 0;
            let payout_sol = 0;
            
            // Get rank from leaderboard
            try {
              const { data: leaderboardData } = await supabase
                .from('game_sessions')
                .select('wallet_address, score')
                .eq('round_id', game.round_id)
                .not('finished_at', 'is', null)
                .order('score', { ascending: false });
              
              if (leaderboardData) {
                const playerIndex = leaderboardData.findIndex(
                  (entry: any) => entry.wallet_address === walletAddress
                );
                rank = playerIndex >= 0 ? playerIndex + 1 : 0;
              }
            } catch (err) {
              console.error('Error fetching rank for round', game.round_id, ':', err);
            }
            
            // Get payout from round_payouts (round_id + wallet_address; column is prize_lamports)
            try {
              const { data: payoutData } = await supabase
                .from('round_payouts')
                .select('prize_lamports')
                .eq('round_id', game.round_id)
                .eq('wallet_address', walletAddress)
                .maybeSingle();
              
              if (payoutData?.prize_lamports != null) {
                payout_sol = Number(payoutData.prize_lamports) / 1_000_000_000;
              }
            } catch (_) {
              // No payout for this round, that's ok (most games don't win)
            }
            
            // Handle different column names (score vs total_points, correct_count vs correct_answers)
            const scoreValue = game.score ?? game.total_points ?? 0;
            const correctValue = game.correct_count ?? game.correct_answers ?? 0;
            const timeValue = game.time_taken_ms ?? game.time_taken_seconds ?? 0;
            const timeInSeconds = timeValue > 1000 ? Math.floor(timeValue / 1000) : timeValue;
            
            return {
              round_id: game.round_id || 'N/A',
              rank: rank,
              time_taken_seconds: timeInSeconds,
              correct_answers: correctValue,
              total_questions: 10,
              payout_sol: payout_sol,
              xp_earned: scoreValue,
              finished_at: game.finished_at,
            };
          });
          
          const transformedHistory = await Promise.all(historyPromises);
          console.log('✅ Game history processed:', transformedHistory.length, 'games');
          setHistory(transformedHistory);

          // Fallback: if profile had 0 games/points (e.g. not synced yet), show from game_sessions
          const derivedGames = gamesData.length;
          const derivedPoints = gamesData.reduce(
            (sum: number, g: any) => sum + (Number(g.score ?? g.total_points ?? 0) || 0),
            0
          );
          setStats((prev) => ({
            ...prev,
            total_games_played: prev && prev.total_games_played > 0 ? prev.total_games_played : derivedGames,
            total_points: prev && prev.total_points > 0 ? prev.total_points : derivedPoints,
            highest_score:
              prev && prev.highest_score > 0
                ? prev.highest_score
                : (gamesData.length
                    ? Math.max(...gamesData.map((g: any) => Number(g.score ?? g.total_points ?? 0) || 0))
                    : 0),
          }));
        } else {
          console.log('ℹ️ No game history found');
          setHistory([]);
        }

        // Round wins eligible for on-chain claim — verify not already claimed on-chain
        const claimableRaw = await fetchClaimableRoundPayouts(walletAddress);
        const claimableVerified: ClaimablePayout[] = [];
        for (const p of claimableRaw) {
          try {
            const onChain = await fetchTierRound(connection, p.contract_round_id, p.tier_index);
            // Only show if round exists on-chain AND this rank's prize isn't already claimed
            if (onChain && p.rank >= 1 && p.rank <= 5 && !onChain.claimed[p.rank - 1]) {
              claimableVerified.push(p);
            }
          } catch { /* skip — round may not exist on-chain */ }
        }
        setClaimablePayouts(claimableVerified);
        const claimed = await fetchClaimedRoundPayouts(walletAddress);
        setClaimedPayouts(claimed);

        // Duel wins — check on-chain which are unclaimed
        try {
          const duelWins = await fetchMyDuelWins(walletAddress);
          const unclaimed: MyDuelWin[] = [];
          for (const dw of duelWins) {
            try {
              const onChain = await fetchDuel(connection, dw.duel_id);
              if (onChain && !onChain.winnerClaimed) unclaimed.push(dw);
            } catch { /* duel not on-chain or RPC error — skip */ }
          }
          setClaimableDuels(unclaimed);
        } catch { /* silently skip duel wins fetch */ }

        // Custom game wins — check on-chain claimed[]
        try {
          const cgWins = await fetchMyCustomGameWins(walletAddress);
          const unclaimedCG: ClaimableCustomGameWin[] = [];
          for (const cg of cgWins) {
            try {
              const onChain = await fetchCustomGame(connection, cg.on_chain_game_id);
              if (onChain && !onChain.claimed[cg.winner_index]) unclaimedCG.push(cg);
            } catch { /* skip */ }
          }
          setClaimableCustomGames(unclaimedCG);
        } catch { /* silently skip */ }

        // Refundable entries — check on-chain refundMode AND vault has enough SOL
        try {
          const refundable = await fetchRefundableEntries(walletAddress);
          const verified: RefundableEntry[] = [];
          for (const re of refundable) {
            try {
              const onChain = await fetchTierRound(connection, re.contract_round_id, re.tier_index);
              if (onChain && onChain.refundMode) {
                // Also check vault has enough SOL to pay the refund (filters out already-claimed)
                const vaultPda = getTierVaultPda(re.contract_round_id, re.tier_index);
                const vaultBalance = await connection.getBalance(vaultPda);
                if (vaultBalance > onChain.entryFeeLamports) verified.push(re);
              }
            } catch { /* skip — round may not exist on-chain */ }
          }
          setRefundableEntries(verified);
        } catch { /* silently skip */ }

        // Refundable custom games — expired games where player has an entry
        try {
          const cgRefunds = await fetchRefundableCustomGames(walletAddress);
          // Verify on-chain: custom game status must be expired (status byte = 3)
          const verifiedCG: RefundableCustomGame[] = [];
          for (const cg of cgRefunds) {
            try {
              const onChain = await fetchCustomGame(connection, cg.on_chain_game_id);
              // Status 3 = expired on-chain (refundable)
              if (onChain && onChain.status === 3) verifiedCG.push(cg);
            } catch { /* skip */ }
          }
          setRefundableCustomGames(verifiedCG);
        } catch { /* silently skip */ }

        // Refundable duels — expired duels where user was creator and no opponent joined
        try {
          const duelRefunds = await fetchMyRefundableDuels(walletAddress);
          // Verify on-chain: duel PDA must exist and not be resolved
          const verifiedDuelRefunds: RefundableDuel[] = [];
          for (const dr of duelRefunds) {
            try {
              const onChain = await fetchDuel(connection, dr.duel_id);
              // If duel exists on-chain and winner hasn't claimed, it's refundable
              if (onChain && !onChain.winnerClaimed) verifiedDuelRefunds.push(dr);
            } catch { verifiedDuelRefunds.push(dr); /* if on-chain check fails, still show it */ }
          }
          setRefundableDuels(verifiedDuelRefunds);
        } catch { /* silently skip */ }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }

      // Custom Games — fetch created + played
      setCustomGamesLoading(true);
      try {
        const [createdRes, playedRes] = await Promise.all([
          getMyCustomGames(walletAddress).catch(() => ({ games: [] })),
          supabase
            .from('custom_game_sessions')
            .select('game_id, score, correct_count, status, completed_at, custom_games(name, slug, question_count)')
            .eq('wallet_address', walletAddress)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(50),
        ]);
        setCreatedGames(createdRes.games || []);
        // Deduplicate played games — keep best score per game
        const playedMap = new Map<string, PlayedCustomGame>();
        for (const row of (playedRes.data || []) as any[]) {
          const game = row.custom_games;
          if (!game) continue;
          const existing = playedMap.get(row.game_id);
          if (!existing || row.score > existing.best_score) {
            playedMap.set(row.game_id, {
              game_id: row.game_id,
              game_name: game.name,
              slug: game.slug,
              best_score: row.score,
              correct_count: row.correct_count,
              question_count: game.question_count,
              completed_at: row.completed_at,
            });
          }
        }
        setPlayedGames(Array.from(playedMap.values()));
      } catch { /* non-fatal */ }
      setCustomGamesLoading(false);

      // Seeker perks — fetch verification status
      try {
        const seekerData = await getSeekerProfile(walletAddress);
        setSeekerProfile(seekerData);
      } catch {
        setSeekerProfile({ is_seeker_verified: false, skr_domain: null, use_skr_as_display: false, seeker_verified_at: null });
      }

      // Referral stats — independent from main profile fetch so it never breaks existing features
      try {
        let refStats = await getReferralStats(walletAddress);
        // If no code exists yet, generate one first then re-fetch
        if (!refStats.code) {
          await getReferralCode(walletAddress);
          refStats = await getReferralStats(walletAddress);
        }
        setReferralStats(refStats);
      } catch {
        setReferralStats({
          code: '--------',
          referral_url: `https://soltrivia.app?ref=--------`,
          total_referrals: 0,
          completed_referrals: 0,
          pending_referrals: 0,
          referral_points: 0,
          recent_referrals: [],
        });
      }
    };

  useEffect(() => {
    fetchProfileData();
  }, [publicKey]);

  const handleVerifySeeker = async () => {
    if (!publicKey) return;
    if (!signMessage) {
      setSeekerError(t('profile.noSigningSupport'));
      return;
    }
    setSeekerVerifying(true);
    setSeekerError(null);
    try {
      // Step 1: Sign a message to prove wallet ownership (triggers wallet popup)
      const message = `Verify Seeker Genesis Token ownership for SolTrivia\nWallet: ${publicKey.toBase58()}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);

      // Step 2: Encode signature as base58 (standard Solana encoding) and send to server
      const bs58 = (await import('bs58')).default;
      const signatureBase58 = bs58.encode(signature);

      // Step 3: Server verifies signature + checks SGT on-chain
      const result = await verifySeekerStatus(publicKey.toBase58(), message, signatureBase58);
      // Re-fetch full profile from DB to get accurate use_skr_as_display (server may have auto-set it)
      const freshProfile = await getSeekerProfile(publicKey.toBase58());
      setSeekerProfile({
        is_seeker_verified: result.is_seeker_verified,
        skr_domain: result.skr_domain,
        use_skr_as_display: freshProfile.use_skr_as_display,
        seeker_verified_at: result.seeker_verified_at,
      });
      onSeekerVerified?.(result.is_seeker_verified);
      if (!result.is_seeker_verified) {
        setSeekerError(t('profile.noSeekerToken'));
      }
    } catch (err: any) {
      if (err.message?.includes('User rejected') || err.message?.includes('rejected')) {
        setSeekerError(t('profile.signatureRejected'));
      } else {
        setSeekerError(err.message || t('profile.verificationFailed'));
      }
    } finally {
      setSeekerVerifying(false);
    }
  };

  const handleToggleSkr = async () => {
    if (!publicKey || !seekerProfile?.skr_domain) return;
    const newValue = !seekerProfile.use_skr_as_display;
    try {
      await toggleSkrDisplay(publicKey.toBase58(), newValue, seekerProfile.skr_domain ?? undefined);
      setSeekerProfile(prev => prev ? { ...prev, use_skr_as_display: newValue } : prev);
      if (newValue && seekerProfile.skr_domain) {
        setCurrentUsername(seekerProfile.skr_domain);
      }
    } catch { /* non-fatal */ }
  };

  // Check push notification subscription status on mount — and re-register with backend
  // so THIS device's FCM endpoint is saved (fixes multi-device: laptop vs phone)
  useEffect(() => {
    if (!publicKey || !isPushSupported()) return;
    hasActiveSubscription().then(async (active) => {
      setNotificationsEnabled(active);
      // If browser already has a local subscription, re-register it with backend
      // so the DB points to THIS device's push endpoint (not a stale one)
      if (active) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            const { SUPABASE_FUNCTIONS_URL } = await import('../src/utils/constants');
            const { getAuthHeaders } = await import('../src/utils/api');
            await fetch(`${SUPABASE_FUNCTIONS_URL}/register-push`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                wallet_address: publicKey.toBase58(),
                subscription: sub.toJSON(),
              }),
            });
          }
        } catch (e) {
          console.warn('Auto re-register push failed:', e);
        }
      }
    }).catch(() => {});
  }, [publicKey]);

  const handleToggleNotifications = async () => {
    if (!publicKey || notifLoading) return;
    setNotifLoading(true);
    try {
      if (notificationsEnabled) {
        const ok = await unsubscribeFromPush(publicKey.toBase58());
        if (ok) setNotificationsEnabled(false);
      } else {
        const ok = await subscribeToPush(publicKey.toBase58());
        if (ok) {
          setNotificationsEnabled(true);
        } else {
          // Surface failure so user knows something went wrong
          alert('Could not enable notifications. Check browser permissions and try again.');
        }
      }
    } catch (e: any) {
      console.error('Toggle notifications error:', e);
      alert('Notification error: ' + (e.message || 'Unknown error'));
    }
    setNotifLoading(false);
  };

  const handleClaimPrize = async (payout: ClaimablePayout) => {
    if (!publicKey || !sendTransaction || !connection) return;
    setClaimingRoundId(payout.round_id);
    try {
      await initializeProgram({
        revenueWallet: REVENUE_WALLET,
        useDevnet: SOLANA_NETWORK === 'devnet',
      }).catch(() => {}); // idempotent; non-fatal if already inited
      const tierIndex = payout.tier_index ?? 0;
      const ix = buildClaimTierPrizeIx(publicKey, payout.contract_round_id, tierIndex);
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const msg = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(msg);
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        const err = sim.value.err as { InstructionError?: [number, { Custom?: number }] };
        const customCode = err?.InstructionError?.[1]?.Custom;
        // V2 error 6009 = RoundNotFinalized — trigger post-winners
        if (customCode === 6009) {
          const postRes = await postWinnersOnChain(payout.round_id, tierIndex);
          if (postRes.success) {
            alert('Prize finalization has been sent on-chain. Please try claiming again in about 30 seconds.');
          } else {
            alert(`Round not finalized on-chain. ${postRes.error ?? 'Please try again in a few minutes or contact support.'}`);
          }
          return;
        }
        // V2 error 6012 = AlreadyClaimed
        if (customCode === 6012) {
          await markPayoutClaimed(payout.round_id, publicKey.toBase58(), tierIndex).catch(() => {});
          setClaimablePayouts((prev) => prev.filter((p) => !(p.round_id === payout.round_id && (p.tier_index ?? 0) === tierIndex)));
          const claimed = await fetchClaimedRoundPayouts(publicKey.toBase58());
          setClaimedPayouts(claimed);
          alert('This prize has already been claimed.');
          return;
        }
        throw new Error(
          `Simulation failed: ${JSON.stringify(sim.value.err)}. Ensure you are a winner for this round and the round is finalized on-chain.`
        );
      }
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      await markPayoutClaimed(payout.round_id, publicKey.toBase58(), tierIndex).catch(() => {});
      setClaimablePayouts((prev) => prev.filter((p) => !(p.round_id === payout.round_id && (p.tier_index ?? 0) === tierIndex)));
      const claimed = await fetchClaimedRoundPayouts(publicKey.toBase58());
      setClaimedPayouts(claimed);
      setLastClaimTx({
        signature: sig,
        solAmount: (payout.prize_lamports / 1_000_000_000).toFixed(4),
      });
    } catch (e: any) {
      if (!e?.message?.includes('rejected')) alert(e?.message || 'Claim failed');
    } finally {
      setClaimingRoundId(null);
    }
  };

  const handleClaimRefund = async (entry: RefundableEntry) => {
    if (!publicKey || !sendTransaction) return;
    setClaimingRefundId(entry.round_id);
    try {
      const ix = buildClaimTierRefundIx(publicKey, entry.contract_round_id, entry.tier_index);
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        // Already claimed — silently remove
        const logs = sim.value.logs?.join(' ') ?? '';
        if (logs.includes('already') || logs.includes('claimed')) {
          setRefundableEntries(prev => prev.filter(r => r.round_id !== entry.round_id));
          return;
        }
        throw new Error(`Refund simulation failed: ${JSON.stringify(sim.value.err)}`);
      }
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      setRefundableEntries(prev => prev.filter(r => r.round_id !== entry.round_id));
      setLastClaimTx({
        signature: sig,
        solAmount: (entry.entry_fee_lamports / 1_000_000_000).toFixed(4),
      });
    } catch (e: any) {
      if (!e?.message?.includes('rejected')) alert(e?.message || 'Refund claim failed');
    } finally {
      setClaimingRefundId(null);
    }
  };

  const handleClaimCGRefund = async (cg: RefundableCustomGame) => {
    if (!publicKey || !sendTransaction) return;
    setClaimingCGRefundId(cg.on_chain_game_id);
    try {
      const ix = buildClaimCustomRefundIx(publicKey, cg.on_chain_game_id);
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const sim = await connection.simulateTransaction(tx);
      if (sim.value.err) {
        const logs = sim.value.logs?.join(' ') ?? '';
        if (logs.includes('already') || logs.includes('claimed')) {
          setRefundableCustomGames(prev => prev.filter(g => g.on_chain_game_id !== cg.on_chain_game_id));
          return;
        }
        throw new Error(`Refund simulation failed: ${JSON.stringify(sim.value.err)}`);
      }
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      setRefundableCustomGames(prev => prev.filter(g => g.on_chain_game_id !== cg.on_chain_game_id));
      setLastClaimTx({
        signature: sig,
        solAmount: (cg.entry_fee_lamports / 1_000_000_000).toFixed(4),
      });
    } catch (e: any) {
      if (!e?.message?.includes('rejected')) alert(e?.message || 'Custom game refund failed');
    } finally {
      setClaimingCGRefundId(null);
    }
  };

  // Realtime: auto-refresh history when this wallet completes a game session
  useEffect(() => {
    if (!publicKey) return;
    const walletAddress = publicKey.toBase58();

    const channel = supabase
      .channel(`profile-history-${walletAddress}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `wallet_address=eq.${walletAddress}`,
        },
        (payload: any) => {
          // Re-fetch when a session gets a finished_at value (game completed)
          if (payload.new?.finished_at && !payload.old?.finished_at) {
            fetchProfileData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [publicKey]);

  const handleAvatarUploadSuccess = (url: string) => {
    setCurrentAvatar(url);
    setShowAvatarUpload(false);
    onAvatarUpdated?.(url);
  };

  // Show full layout immediately (hero from props); only stats/history show loading so profile feels instant
  return (
    <div className="min-h-full bg-[#050505] overflow-x-hidden safe-top relative flex flex-col">
      {/* Sticky Profile Header */}
      <div className="flex items-center justify-between px-6 py-3 md:py-4 border-b border-white/5 bg-[#050505] sticky top-0 z-[60]">
        <h2 className="text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter text-white">{t('profile.title')}</h2>
        <div className="flex items-center gap-2.5">
          {/* Compact Notification Toggle */}
          {isPushSupported() && (
            <button
              onClick={handleToggleNotifications}
              disabled={notifLoading}
              className={`flex items-center gap-2 h-8 md:h-9 px-3 rounded-full border transition-all active:scale-95 ${
                notificationsEnabled
                  ? 'bg-[#14F195]/10 border-[#14F195]/30 text-[#14F195]'
                  : 'bg-white/5 border-white/10 text-zinc-500 hover:border-white/20'
              } ${notifLoading ? 'opacity-50' : ''}`}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider italic whitespace-nowrap">
                {notificationsEnabled ? t('profile.notificationsOn') : t('profile.notificationsOff')}
              </span>
            </button>
          )}
          <button
            onClick={onOpenGuide}
            className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-[#14F195] flex items-center justify-center shadow-lg active:scale-95 transition-all"
          >
            <span className="text-black font-black text-lg md:text-xl italic leading-none">?</span>
          </button>
        </div>
      </div>

      <div className="p-4 md:p-8 lg:p-12 max-w-[1100px] mx-auto w-full pb-32 md:pb-40 relative">
        {/* XP at top */}
        <div className="mb-4 md:mb-6 flex justify-center md:justify-start">
          <div className="inline-flex items-baseline gap-2 px-5 py-3 md:px-6 md:py-3 bg-[#0A0A0A] border border-[#14F195]/20 rounded-xl shadow-[0_0_20px_rgba(20,241,149,0.08)]">
            <span className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] italic">{t('profile.totalXp')}</span>
            <span className="text-[#14F195] text-2xl md:text-3xl font-[1000] italic tabular-nums leading-none">
              {loading ? '—' : (stats?.total_points ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Profile Hero Section */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-8 mb-6 md:mb-10 relative z-10 pt-2 md:pt-0">
          <div className="relative flex-shrink-0">
              <div className="w-24 h-24 md:w-32 md:h-32 p-1 bg-gradient-to-br from-[#14F195] via-[#3b82f6] to-[#9945FF] rounded-[20px] md:rounded-[24px] shadow-xl">
                  <div className="w-full h-full bg-zinc-900 rounded-[17px] md:rounded-[21px] overflow-hidden">
                      <img src={currentAvatar || avatar} alt="Avatar" className="w-full h-full object-cover grayscale" onError={() => setCurrentAvatar(DEFAULT_AVATAR)} />
                  </div>
              </div>
              <button
                onClick={() => setShowAvatarUpload(true)}
                className="absolute -bottom-2 -right-2 bg-[#14F195] hover:bg-[#14F195]/90 border border-[#14F195] text-black font-[1000] text-[10px] px-3 py-1.5 italic rounded-lg shadow-xl transition-all active:scale-95"
              >
                {t('profile.upload')}
              </button>
          </div>

          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="mb-3 md:mb-5">
                <span className="text-[#14F195] text-[8px] md:text-[10px] font-black uppercase tracking-[0.5em] italic block mb-1 md:mb-2 opacity-70">{t('profile.protocolOperative')}</span>
                <h1 className="text-3xl md:text-5xl font-[1000] italic uppercase tracking-tighter text-white leading-none mb-2 md:mb-3">{currentUsername}</h1>
                <div className="h-0.5 w-10 md:h-1 md:w-14 bg-[#14F195] mx-auto md:mx-0 shadow-[0_0_10px_#14F195]"></div>
              </div>

              <button
                onClick={onEdit}
                className="px-6 md:px-8 py-2.5 md:py-3 bg-white/[0.03] border border-white/10 hover:bg-[#14F195] hover:text-black text-white font-[1000] uppercase text-[10px] md:text-xs tracking-widest italic rounded-full transition-all active:scale-95 hover:scale-105"
              >
                {t('profile.editProfile')}
              </button>
          </div>
        </div>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3 mb-5 md:mb-8 relative z-10">
          {loading ? (
            <>
              <ProfileStatCard label={t('profile.totalWon')} value="—" unit="SOL" highlight />
              <ProfileStatCard label={t('profile.trivias')} value="—" />
              <ProfileStatCard label={t('profile.streak')} value="—" suffix="🔥" />
              <ProfileStatCard label={t('profile.points')} value="—" />
            </>
          ) : (
            <>
              <ProfileStatCard label={t('profile.totalWon')} value={stats?.total_sol_won.toFixed(2) || "0.00"} unit="SOL" highlight />
              <ProfileStatCard label={t('profile.trivias')} value={stats?.total_games_played.toString() || "0"} />
              <ProfileStatCard label={t('profile.streak')} value={stats?.current_streak.toString() || "0"} suffix="🔥" />
              <ProfileStatCard label={t('profile.points')} value={stats?.total_points.toLocaleString() || "0"} />
            </>
          )}
        </div>

        {/* Seeker Perks Section */}
        <div className="mb-5 md:mb-8 relative z-10">
          <div className="bg-[#0A0A0A] border border-[#9945FF]/20 rounded-xl md:rounded-2xl overflow-hidden shadow-lg">
            <div className="px-5 py-3 md:px-6 md:py-4 border-b border-white/5 bg-gradient-to-r from-[#9945FF]/10 to-transparent">
              <h2 className="text-base md:text-lg font-[1000] italic uppercase tracking-tighter text-white">{t('profile.seekerPerks')}</h2>
              <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider mt-0.5">
                {t('profile.exclusiveSeeker')}
              </p>
            </div>
            <div className="p-4 md:p-6">
              {seekerProfile?.is_seeker_verified ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex items-center justify-center w-10 h-10 shrink-0">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L3 7V12C3 17.25 6.75 22.08 12 23C17.25 22.08 21 17.25 21 12V7L12 2Z" fill="#14F195" fillOpacity="0.15" stroke="#14F195" strokeWidth="1.5" strokeLinejoin="round"/>
                        <path d="M8.5 12.5L11 15L16 9.5" stroke="#14F195" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <div>
                      <span className="text-[#14F195] font-[1000] text-lg italic">{t('profile.verifiedSeeker')}</span>
                      {seekerProfile.seeker_verified_at && (
                        <span className="text-zinc-600 text-[9px] font-bold block">
                          {t('profile.since', { date: new Date(seekerProfile.seeker_verified_at).toLocaleDateString() })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center">
                      <span className="text-[#14F195] text-xl font-[1000] italic block">+25%</span>
                      <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic">{t('profile.xpBoost')}</span>
                    </div>
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center">
                      <span className="text-[#14F195] text-sm font-[1000] italic block">Discount</span>
                      <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic">Lives</span>
                    </div>
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center">
                      <span className="text-[#14F195] text-xl font-[1000] italic block">Badge</span>
                      <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic">{t('profile.badgeLeaderboard')}</span>
                    </div>
                  </div>
                  {seekerProfile.skr_domain && (
                    <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl p-4">
                      <div>
                        <span className="text-white font-bold text-sm">{seekerProfile.skr_domain}</span>
                        <span className="text-zinc-500 text-[9px] font-bold block">{t('profile.useAsDisplayName')}</span>
                      </div>
                      <button
                        onClick={handleToggleSkr}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          seekerProfile.use_skr_as_display ? 'bg-[#14F195]' : 'bg-zinc-700'
                        } relative`}
                      >
                        <span className={`block w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                          seekerProfile.use_skr_as_display ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-zinc-400 text-sm mb-4">
                    {t('profile.ownSeekerQuestion')}
                  </p>
                  {seekerError && (
                    <p className="text-red-400 text-xs mb-4">{seekerError}</p>
                  )}
                  <button
                    onClick={handleVerifySeeker}
                    disabled={seekerVerifying}
                    className="px-8 py-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-[1000] text-sm uppercase italic tracking-wider rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    {seekerVerifying ? t('profile.verifying') : t('profile.verifySeeker')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Refer & Earn Section */}
        {referralStats && (
          <div className="mb-5 md:mb-8 relative z-10">
            <div className="bg-[#0A0A0A] border border-[#14F195]/20 rounded-xl md:rounded-2xl overflow-hidden shadow-lg">
              <div className="px-5 py-3 md:px-6 md:py-4 border-b border-white/5 bg-gradient-to-r from-[#14F195]/5 to-transparent">
                <h2 className="text-base md:text-lg font-[1000] italic uppercase tracking-tighter text-white">{t('profile.referAndEarn')}</h2>
                <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider mt-0.5">{t('profile.referralReward')}</p>
              </div>

              <div className="p-4 md:p-6 space-y-4">
                {/* Referral Link */}
                <div>
                  <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] italic block mb-2">{t('profile.yourReferralLink')}</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white/80 text-sm md:text-base font-mono truncate">
                      {referralStats.referral_url}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralStats.referral_url);
                        setReferralCopied(true);
                        setTimeout(() => setReferralCopied(false), 2000);
                      }}
                      className="px-4 md:px-6 py-3 bg-[#14F195] hover:bg-[#14F195]/90 text-black font-[1000] text-xs uppercase italic rounded-xl transition-all active:scale-95 whitespace-nowrap"
                    >
                      {referralCopied ? t('profile.copied') : t('profile.copy')}
                    </button>
                  </div>
                </div>

                {/* Referral Stats Row */}
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  <div className="bg-black/30 border border-white/5 rounded-lg p-3 md:p-4 text-center">
                    <span className="text-[#14F195] text-xl md:text-2xl font-[1000] italic block">{referralStats.completed_referrals}</span>
                    <span className="text-zinc-500 text-[8px] md:text-[9px] font-black uppercase tracking-widest italic">{t('profile.completed')}</span>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-lg p-3 md:p-4 text-center">
                    <span className="text-yellow-400 text-xl md:text-2xl font-[1000] italic block">{referralStats.pending_referrals}</span>
                    <span className="text-zinc-500 text-[8px] md:text-[9px] font-black uppercase tracking-widest italic">{t('profile.pending')}</span>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-lg p-3 md:p-4 text-center">
                    <span className="text-white text-xl md:text-2xl font-[1000] italic block">{referralStats.referral_points.toLocaleString()}</span>
                    <span className="text-zinc-500 text-[8px] md:text-[9px] font-black uppercase tracking-widest italic">{t('profile.xpEarned')}</span>
                  </div>
                </div>

                {/* Share to X Button */}
                <button
                  onClick={() => {
                    const text = `i'm farming XP on @soltrivia_app — trivia on solana where you win real SOL\n\njoin with my link and we both eat\n\n${referralStats.referral_url}`;
                    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="w-full py-3 md:py-4 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] rounded-xl text-white font-[1000] text-xs md:text-sm uppercase italic tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>{t('profile.shareOn')}</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>

                {/* Recent Referrals */}
                {referralStats.recent_referrals.length > 0 && (
                  <div>
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] italic block mb-3">{t('profile.recentReferrals')}</label>
                    <div className="space-y-2">
                      {referralStats.recent_referrals.map((ref, i) => (
                        <div key={i} className="flex items-center justify-between py-2 px-4 bg-black/20 border border-white/5 rounded-lg">
                          <span className="text-zinc-400 text-xs md:text-sm font-mono">{ref.referred_wallet}</span>
                          <span className={`text-[10px] md:text-xs font-[1000] italic uppercase ${ref.status === 'completed' ? 'text-[#14F195]' : 'text-yellow-400'}`}>
                            {ref.status === 'completed' ? `+${ref.points_awarded} XP` : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Custom Games Section */}
        {(createdGames.length > 0 || playedGames.length > 0) && (
          <div className="mb-5 md:mb-8 relative z-10">
            <div className="bg-[#0A0A0A] border border-[#38BDF8]/20 rounded-xl md:rounded-2xl overflow-hidden shadow-lg">
              <div className="px-5 py-3 md:px-6 md:py-4 border-b border-white/5 bg-gradient-to-r from-[#38BDF8]/10 to-transparent">
                <h2 className="text-base md:text-lg font-[1000] italic uppercase tracking-tighter text-white">{t('profile.customGames')}</h2>
                <p className="text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-wider mt-0.5">
                  {t('profile.createdAndPlayed')}
                </p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/5">
                <button
                  onClick={() => setCustomGameTab('created')}
                  className={`flex-1 py-3 text-xs font-[1000] italic uppercase tracking-wider transition-colors ${
                    customGameTab === 'created'
                      ? 'text-[#38BDF8] border-b-2 border-[#38BDF8]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t('profile.createdTab', { count: createdGames.length })}
                </button>
                <button
                  onClick={() => setCustomGameTab('played')}
                  className={`flex-1 py-3 text-xs font-[1000] italic uppercase tracking-wider transition-colors ${
                    customGameTab === 'played'
                      ? 'text-[#14F195] border-b-2 border-[#14F195]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t('profile.playedTab', { count: playedGames.length })}
                </button>
              </div>

              <div className="p-4 md:p-6">
                {customGamesLoading ? (
                  <div className="py-8 text-center text-zinc-500 text-sm font-black uppercase tracking-widest italic">{t('profile.loading')}</div>
                ) : customGameTab === 'created' ? (
                  /* Created Games */
                  createdGames.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-sm italic">{t('profile.noGamesCreated')}</div>
                  ) : (
                    <div className="space-y-3">
                      {createdGames.slice(createdGamesPage * CUSTOM_GAMES_PER_PAGE, (createdGamesPage + 1) * CUSTOM_GAMES_PER_PAGE).map((game) => {
                        const isExpired = game.status === 'expired' || new Date(game.expires_at) < new Date();
                        const daysLeft = Math.max(0, Math.ceil((new Date(game.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                        return (
                          <div
                            key={game.id}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 md:px-6 bg-black/30 border rounded-xl transition-all ${
                              isExpired ? 'border-white/5 opacity-60' : 'border-[#38BDF8]/10 hover:border-[#38BDF8]/30'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-[1000] text-sm italic truncate">{game.name}</span>
                                {isExpired ? (
                                  <span className="text-red-400 text-[8px] font-black italic uppercase px-1.5 py-0.5 bg-red-400/10 rounded">{t('profile.expired')}</span>
                                ) : (
                                  <span className="text-[#14F195] text-[8px] font-black italic uppercase px-1.5 py-0.5 bg-[#14F195]/10 rounded">{t('profile.daysLeft', { count: daysLeft })}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-bold">
                                <span>{game.question_count} Q</span>
                                <span>{game.total_plays} {t('profile.plays')}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`https://soltrivia.app/game/${game.slug}`);
                                  setLinkCopiedSlug(game.slug);
                                  setTimeout(() => setLinkCopiedSlug(null), 2000);
                                }}
                                className="px-3 py-1.5 bg-white/5 border border-white/10 text-white text-[10px] font-[1000] italic uppercase rounded-lg hover:bg-white/10 transition-all active:scale-95"
                              >
                                {linkCopiedSlug === game.slug ? t('profile.copied') : t('profile.share')}
                              </button>
                              {!isExpired && onViewCustomGame && (
                                <button
                                  onClick={() => onViewCustomGame(game.slug)}
                                  className="px-3 py-1.5 bg-[#38BDF8]/20 text-[#38BDF8] text-[10px] font-[1000] italic uppercase rounded-lg hover:bg-[#38BDF8]/30 transition-all active:scale-95"
                                >
                                  {t('profile.view')}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {createdGames.length > CUSTOM_GAMES_PER_PAGE && (
                        <div className="flex items-center justify-between mt-2">
                          <button onClick={() => setCreatedGamesPage(p => Math.max(0, p - 1))} disabled={createdGamesPage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.prev')}</button>
                          <span className="text-zinc-500 text-[10px] font-bold italic">{createdGamesPage + 1} / {Math.ceil(createdGames.length / CUSTOM_GAMES_PER_PAGE)}</span>
                          <button onClick={() => setCreatedGamesPage(p => Math.min(Math.ceil(createdGames.length / CUSTOM_GAMES_PER_PAGE) - 1, p + 1))} disabled={createdGamesPage >= Math.ceil(createdGames.length / CUSTOM_GAMES_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.next')}</button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  /* Played Games */
                  playedGames.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-sm italic">{t('profile.noCustomGamesPlayed')}</div>
                  ) : (
                    <div className="space-y-3">
                      {playedGames.slice(playedGamesPage * CUSTOM_GAMES_PER_PAGE, (playedGamesPage + 1) * CUSTOM_GAMES_PER_PAGE).map((game) => (
                        <div
                          key={game.game_id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-4 md:px-6 bg-black/30 border border-[#14F195]/10 hover:border-[#14F195]/30 rounded-xl transition-all"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-white font-[1000] text-sm italic truncate block mb-1">{game.game_name}</span>
                            <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-bold">
                              <span className="text-[#14F195]">{game.correct_count}/{game.question_count} correct</span>
                              <span>{game.best_score.toLocaleString()} pts</span>
                              <span>{new Date(game.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                          {onViewCustomGame && (
                            <button
                              onClick={() => onViewCustomGame(game.slug)}
                              className="px-3 py-1.5 bg-[#14F195]/20 text-[#14F195] text-[10px] font-[1000] italic uppercase rounded-lg hover:bg-[#14F195]/30 transition-all active:scale-95"
                            >
                              {t('profile.playAgain')}
                            </button>
                          )}
                        </div>
                      ))}
                      {playedGames.length > CUSTOM_GAMES_PER_PAGE && (
                        <div className="flex items-center justify-between mt-2">
                          <button onClick={() => setPlayedGamesPage(p => Math.max(0, p - 1))} disabled={playedGamesPage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.prev')}</button>
                          <span className="text-zinc-500 text-[10px] font-bold italic">{playedGamesPage + 1} / {Math.ceil(playedGames.length / CUSTOM_GAMES_PER_PAGE)}</span>
                          <button onClick={() => setPlayedGamesPage(p => Math.min(Math.ceil(playedGames.length / CUSTOM_GAMES_PER_PAGE) - 1, p + 1))} disabled={playedGamesPage >= Math.ceil(playedGames.length / CUSTOM_GAMES_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.next')}</button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Last claim success – verify SOL received via Explorer */}
        {lastClaimTx && (
          <div className="mb-6 p-4 bg-[#14F195]/10 border border-[#14F195]/30 rounded-xl">
            <p className="text-[#14F195] font-bold text-sm mb-2">
              {t('profile.solClaimed', { amount: lastClaimTx.solAmount })}
            </p>
            <a
              href={claimExplorerUrl(lastClaimTx.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 underline text-sm hover:text-[#14F195]"
            >
              {t('profile.viewTransaction')} →
            </a>
            <button
              type="button"
              onClick={() => setLastClaimTx(null)}
              className="ml-3 text-zinc-500 text-xs hover:text-white"
              aria-label="Dismiss"
            >
              {t('profile.dismiss')}
            </button>
          </div>
        )}

        {/* Round wins – claim on-chain (winners acknowledged when round ends). First claimer can trigger post-winners if round not yet finalized (optional alongside complete-session). */}
        {claimablePayouts.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-white mb-4">{t('profile.roundWins')}</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">{t('profile.winnersWhenRoundEnds')}</p>
            <div className="space-y-3">
              {claimablePayouts.slice(claimablePage * WINS_PER_PAGE, (claimablePage + 1) * WINS_PER_PAGE).map((p) => (
                <div
                  key={`${p.round_id}-${p.tier_index ?? 0}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#0A0A0A] border border-white/10 rounded-xl"
                >
                  <div>
                    <span className="text-[#14F195] font-bold text-sm md:text-base">{p.round_title}</span>
                    <span className="text-zinc-500 text-xs ml-2">#{p.rank}</span>
                    {(p.tier_index ?? 0) > 0 && <span className="text-purple-400 text-[10px] font-black ml-2 uppercase">{V2_TIER_LABELS[p.tier_index ?? 0]}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold">{(p.prize_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                    <button
                      type="button"
                      disabled={claimingRoundId === p.round_id}
                      onClick={() => handleClaimPrize(p)}
                      className="px-4 py-2 bg-[#14F195] hover:bg-[#14F195]/90 disabled:opacity-50 text-black font-[1000] text-xs uppercase italic rounded-lg transition-all"
                    >
                      {claimingRoundId === p.round_id ? t('profile.claiming') : t('profile.claim')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {claimablePayouts.length > WINS_PER_PAGE && (
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setClaimablePage(p => Math.max(0, p - 1))} disabled={claimablePage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.prev')}</button>
                <span className="text-zinc-500 text-[10px] font-bold italic">{claimablePage + 1} / {Math.ceil(claimablePayouts.length / WINS_PER_PAGE)}</span>
                <button onClick={() => setClaimablePage(p => Math.min(Math.ceil(claimablePayouts.length / WINS_PER_PAGE) - 1, p + 1))} disabled={claimablePage >= Math.ceil(claimablePayouts.length / WINS_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.next')}</button>
              </div>
            )}
          </div>
        )}

        {/* Duel wins – unclaimed prizes */}
        {claimableDuels.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-white mb-4">{t('profile.duelPrizes')}</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">{t('profile.wonDuelsClaim')}</p>
            <div className="space-y-3">
              {claimableDuels.map((dw) => {
                const houseCut = Math.floor(dw.total_pot_lamports * 0.1);
                const prize = dw.total_pot_lamports - houseCut;
                const oppName = dw.opponent_username || `${dw.opponent_wallet.slice(0, 4)}...${dw.opponent_wallet.slice(-4)}`;
                return (
                  <div
                    key={dw.duel_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#0A0A0A] border border-white/10 rounded-xl"
                  >
                    <div>
                      <span className="text-[#FF3131] font-bold text-sm md:text-base">{t('profile.duelVs', { name: oppName })}</span>
                      <span className="text-zinc-500 text-xs ml-2">{dw.player1_score}–{dw.player2_score}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white font-bold">{(prize / 1_000_000_000).toFixed(4)} SOL</span>
                      <button
                        type="button"
                        disabled={claimingDuelId === dw.duel_id}
                        onClick={async () => {
                          if (!onClaimDuelPrize) return;
                          setClaimingDuelId(dw.duel_id);
                          try {
                            await onClaimDuelPrize(dw.duel_id);
                            setClaimableDuels(prev => prev.filter(d => d.duel_id !== dw.duel_id));
                          } catch {
                            /* claim failed — button re-enables */
                          } finally {
                            setClaimingDuelId(null);
                          }
                        }}
                        className="px-4 py-2 bg-[#14F195] hover:bg-[#14F195]/90 disabled:opacity-50 text-black font-[1000] text-xs uppercase italic rounded-lg transition-all"
                      >
                        {claimingDuelId === dw.duel_id ? t('profile.claiming') : t('profile.claim')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Game Prizes – unclaimed wins from finalized paid custom games */}
        {claimableCustomGames.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-white mb-4">{t('profile.customGamePrizes')}</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">{t('profile.wonCustomClaim')}</p>
            <div className="space-y-3">
              {claimableCustomGames.map((cg) => (
                <div
                  key={cg.game_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#0A0A0A] border border-white/10 rounded-xl"
                >
                  <div>
                    <span className="text-purple-400 font-bold text-sm md:text-base">{cg.name}</span>
                    <span className="text-zinc-500 text-xs ml-2">#{cg.winner_index + 1}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold">{(cg.prize_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                    <button
                      type="button"
                      disabled={claimingCustomGameId === cg.on_chain_game_id}
                      onClick={async () => {
                        if (!onClaimCustomPrize) return;
                        setClaimingCustomGameId(cg.on_chain_game_id);
                        try {
                          await onClaimCustomPrize(cg.on_chain_game_id);
                          setClaimableCustomGames(prev => prev.filter(g => g.on_chain_game_id !== cg.on_chain_game_id));
                        } catch {
                          /* claim failed — button re-enables */
                        } finally {
                          setClaimingCustomGameId(null);
                        }
                      }}
                      className="px-4 py-2 bg-[#14F195] hover:bg-[#14F195]/90 disabled:opacity-50 text-black font-[1000] text-xs uppercase italic rounded-lg transition-all"
                    >
                      {claimingCustomGameId === cg.on_chain_game_id ? t('profile.claiming') : t('profile.claim')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refundable Entries – rounds with <5 finishers */}
        {refundableEntries.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-yellow-400 mb-4">{t('profile.refundableEntries')}</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">{t('profile.fewerPlayersRefund')}</p>
            <div className="space-y-3">
              {refundableEntries.map((re) => (
                <div
                  key={`${re.round_id}-${re.tier_index}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#0A0A0A] border border-yellow-500/20 rounded-xl"
                >
                  <div>
                    <span className="text-yellow-400 font-bold text-sm md:text-base">{re.round_title}</span>
                    {re.tier_index > 0 && <span className="text-purple-400 text-[10px] font-black ml-2 uppercase">{V2_TIER_LABELS[re.tier_index]}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold">{(re.entry_fee_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                    <button
                      type="button"
                      disabled={claimingRefundId === re.round_id}
                      onClick={() => handleClaimRefund(re)}
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-[1000] text-xs uppercase italic rounded-lg transition-all"
                    >
                      {claimingRefundId === re.round_id ? t('profile.refunding') : t('profile.refund')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custom Game Refunds – expired games */}
        {refundableCustomGames.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-orange-400 mb-4">{t('profile.customGameRefunds')}</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">{t('profile.gameExpiredRefund')}</p>
            <div className="space-y-3">
              {refundableCustomGames.map((cg) => (
                <div
                  key={cg.on_chain_game_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#0A0A0A] border border-orange-500/20 rounded-xl"
                >
                  <div>
                    <span className="text-orange-400 font-bold text-sm md:text-base">{cg.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold">{(cg.entry_fee_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                    <button
                      type="button"
                      disabled={claimingCGRefundId === cg.on_chain_game_id}
                      onClick={() => handleClaimCGRefund(cg)}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-[1000] text-xs uppercase italic rounded-lg transition-all"
                    >
                      {claimingCGRefundId === cg.on_chain_game_id ? t('profile.refunding') : t('profile.refund')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Duel Refunds – expired duels where no opponent joined */}
        {refundableDuels.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-[#FF3131] mb-4">Duel Refunds</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">These duels expired without an opponent. Claim your entry fee back.</p>
            <div className="space-y-3">
              {refundableDuels.map((rd) => (
                <div
                  key={rd.duel_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#0A0A0A] border border-[#FF3131]/20 rounded-xl"
                >
                  <div>
                    <span className="text-[#FF3131] font-bold text-sm md:text-base">Duel #{rd.duel_id}</span>
                    <span className="text-zinc-500 text-xs ml-2">{new Date(rd.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold">{(rd.entry_fee_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                    <button
                      type="button"
                      disabled={claimingDuelRefundId === rd.duel_id}
                      onClick={async () => {
                        if (!onClaimDuelRefund || !publicKey) return;
                        setClaimingDuelRefundId(rd.duel_id);
                        try {
                          await onClaimDuelRefund(rd.duel_id, publicKey.toBase58());
                          setRefundableDuels(prev => prev.filter(d => d.duel_id !== rd.duel_id));
                        } catch {
                          /* refund failed — button re-enables */
                        } finally {
                          setClaimingDuelRefundId(null);
                        }
                      }}
                      className="px-4 py-2 bg-[#FF3131] hover:bg-[#FF3131]/90 disabled:opacity-50 text-white font-[1000] text-xs uppercase italic rounded-lg transition-all"
                    >
                      {claimingDuelRefundId === rd.duel_id ? t('profile.refunding') : t('profile.refund')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already claimed – show so user does not try to claim again */}
        {claimedPayouts.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-white mb-4">{t('profile.claimed')}</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">{t('profile.prizesAlreadyClaimed')}</p>
            <div className="space-y-3">
              {claimedPayouts.slice(claimedPage * WINS_PER_PAGE, (claimedPage + 1) * WINS_PER_PAGE).map((p) => (
                <div
                  key={p.round_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#0A0A0A] border border-white/5 rounded-xl"
                >
                  <div>
                    <span className="text-zinc-400 font-bold text-sm md:text-base">{p.round_title}</span>
                    <span className="text-zinc-600 text-xs ml-2">#{p.rank}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-500 font-bold">{(p.prize_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                    <span className="px-4 py-2 bg-[#14F195]/20 text-[#14F195] font-[1000] text-xs uppercase italic rounded-lg border border-[#14F195]/40">
                      {t('profile.claimed')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {claimedPayouts.length > WINS_PER_PAGE && (
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setClaimedPage(p => Math.max(0, p - 1))} disabled={claimedPage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.prev')}</button>
                <span className="text-zinc-500 text-[10px] font-bold italic">{claimedPage + 1} / {Math.ceil(claimedPayouts.length / WINS_PER_PAGE)}</span>
                <button onClick={() => setClaimedPage(p => Math.min(Math.ceil(claimedPayouts.length / WINS_PER_PAGE) - 1, p + 1))} disabled={claimedPage >= Math.ceil(claimedPayouts.length / WINS_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.next')}</button>
              </div>
            )}
          </div>
        )}

        {/* Trivia History Table */}
        <div className="bg-[#0A0A0A] border border-white/5 relative z-10 shadow-lg rounded-xl md:rounded-2xl overflow-hidden">
          <div className="px-5 py-3 md:px-6 md:py-4 border-b border-white/5 bg-[#0D0D0D]">
              <h2 className="text-base md:text-lg font-[1000] italic uppercase tracking-tighter text-white">{t('profile.triviaHistory')}</h2>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            {loading ? (
              <div className="px-6 py-12 text-center text-zinc-500 text-sm font-black uppercase tracking-widest italic">{t('profile.loadingHistory')}</div>
            ) : (
            <table className="w-full min-w-[500px] md:min-w-[700px]">
                <thead className="bg-black/40 text-[8px] md:text-xs font-black text-zinc-500 uppercase tracking-[0.4em]">
                  <tr>
                     <th className="px-6 py-4 md:px-6 md:py-4 text-left">{t('profile.arena')}</th>
                     <th className="px-6 py-4 md:px-6 md:py-4 text-left">{t('profile.date')}</th>
                     <th className="px-6 py-4 md:px-6 md:py-4 text-center">Rank</th>
                     <th className="px-6 py-4 md:px-6 md:py-4 text-center">{t('profile.time')}</th>
                     <th className="px-6 py-4 md:px-6 md:py-4 text-center">{t('profile.correct')}</th>
                     <th className="px-6 py-4 md:px-6 md:py-4 text-right">{t('profile.payout')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-zinc-500 italic">
                          {t('profile.noGameHistory')}
                        </td>
                      </tr>
                    ) : (
                      history.slice(historyPage * HISTORY_PER_PAGE, (historyPage + 1) * HISTORY_PER_PAGE).map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="px-6 py-5 md:px-6 md:py-4 font-[1000] uppercase text-[#14F195] text-sm md:text-lg italic tracking-tight">
                            #{row.round_id.slice(0, 6)}
                          </td>
                          <td className="px-6 py-5 md:px-6 md:py-4 text-left text-zinc-400 text-[10px] md:text-sm font-bold tabular-nums whitespace-nowrap">
                            {row.finished_at ? new Date(row.finished_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                          </td>
                          <td className="px-6 py-5 md:px-6 md:py-4 text-center font-[1000] italic text-white text-base md:text-xl tabular-nums">
                            #{row.rank || '-'}
                          </td>
                          <td className="px-6 py-5 md:px-6 md:py-4 text-center font-[1000] italic text-zinc-400 text-sm md:text-xl tabular-nums">
                            {row.time_taken_seconds}s
                          </td>
                          <td className="px-6 py-5 md:px-6 md:py-4 text-center font-[1000] italic text-white text-sm md:text-xl tabular-nums">
                            {row.correct_answers}/{row.total_questions}
                          </td>
                          <td className="px-6 py-5 md:px-6 md:py-4 text-right font-[1000] italic text-[#14F195] text-lg md:text-3xl tabular-nums drop-shadow-[0_0_10px_rgba(20,241,149,0.3)]">
                            {row.payout_sol > 0 ? `+${row.payout_sol.toFixed(3)} SOL` : `+${row.xp_earned.toLocaleString()} XP`}
                          </td>
                        </tr>
                      ))
                    )}
                </tbody>
            </table>
            )}
          </div>
          {history.length > HISTORY_PER_PAGE && (
            <div className="flex items-center justify-between px-6 py-3 md:px-10 md:py-4 border-t border-white/5">
              <button onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.prev')}</button>
              <span className="text-zinc-500 text-[10px] font-bold italic">{historyPage + 1} / {Math.ceil(history.length / HISTORY_PER_PAGE)}</span>
              <button onClick={() => setHistoryPage(p => Math.min(Math.ceil(history.length / HISTORY_PER_PAGE) - 1, p + 1))} disabled={historyPage >= Math.ceil(history.length / HISTORY_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">{t('profile.next')}</button>
            </div>
          )}
        </div>
      </div>

      {/* Avatar Upload Modal */}
      {showAvatarUpload && publicKey && (
        <AvatarUpload
          walletAddress={publicKey.toBase58()}
          currentAvatar={displayAvatar || avatar}
          onUploadSuccess={handleAvatarUploadSuccess}
          onClose={() => setShowAvatarUpload(false)}
        />
      )}
    </div>
  );
};

const ProfileStatCard: React.FC<{ label: string, value: string, unit?: string, suffix?: string, highlight?: boolean }> = ({ label, value, unit, suffix, highlight }) => (
    <div className={`bg-[#0A0A0A] border p-3 md:p-5 rounded-xl md:rounded-2xl shadow-lg group hover:scale-[1.02] transition-all duration-300 ${highlight ? 'border-[#14F195]/30 bg-gradient-to-br from-[#14F195]/5 to-transparent' : 'border-white/5'}`}>
        <span className="text-[7px] md:text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] md:tracking-[0.3em] block mb-1.5 md:mb-2 group-hover:text-zinc-200 transition-colors italic">{label}</span>
        <div className="flex items-baseline gap-1 md:gap-1.5">
            <span className={`text-xl md:text-3xl font-[1000] italic leading-none tracking-tighter ${highlight ? 'text-[#14F195]' : 'text-white'}`}>{value}</span>
            {unit && <span className="text-[#14F195] font-[1000] text-[8px] md:text-sm italic tracking-widest">{unit}</span>}
            {suffix && <span className="text-xl md:text-2xl">{suffix}</span>}
        </div>
    </div>
);

export default ProfileView;
