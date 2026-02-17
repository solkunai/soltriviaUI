import React, { useState, useEffect } from 'react';
import { TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';
import { DEFAULT_AVATAR, REVENUE_WALLET, SOLANA_NETWORK } from '../src/utils/constants';

function claimExplorerUrl(signature: string): string {
  const base = 'https://explorer.solana.com';
  const cluster = SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '';
  return `${base}/tx/${signature}${cluster}`;
}
import { fetchClaimableRoundPayouts, fetchClaimedRoundPayouts, initializeProgram, markPayoutClaimed, postWinnersOnChain, getReferralCode, getReferralStats, verifySeekerStatus, getSeekerProfile, toggleSkrDisplay, getMyCustomGames, type ClaimablePayout, type ClaimedPayout, type ReferralStatsResponse, type SeekerProfile, type MyCustomGame } from '../src/utils/api';
import { buildClaimPrizeInstruction } from '../src/utils/soltriviaContract';
import AvatarUpload from './AvatarUpload';

interface ProfileViewProps {
  username: string;
  avatar: string;
  profileCacheBuster?: number;
  onEdit: () => void;
  onOpenGuide?: () => void;
  onAvatarUpdated?: (url: string) => void;
  onSeekerVerified?: (verified: boolean) => void;
  onViewCustomGame?: (slug: string) => void;
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

const ProfileView: React.FC<ProfileViewProps> = ({ username, avatar, profileCacheBuster = 0, onEdit, onOpenGuide, onAvatarUpdated, onSeekerVerified, onViewCustomGame }) => {
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
  const WINS_PER_PAGE = 3;
  const HISTORY_PER_PAGE = 5;
  const CUSTOM_GAMES_PER_PAGE = 5;
  const [createdGamesPage, setCreatedGamesPage] = useState(0);
  const [playedGamesPage, setPlayedGamesPage] = useState(0);

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

        // Round wins eligible for on-chain claim (winners acknowledged at round end)
        const claimable = await fetchClaimableRoundPayouts(walletAddress);
        setClaimablePayouts(claimable);
        const claimed = await fetchClaimedRoundPayouts(walletAddress);
        setClaimedPayouts(claimed);
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
      setSeekerError('Your wallet does not support message signing. Please use Phantom, Solflare, or Backpack.');
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
        setSeekerError('No Seeker Genesis Token found in this wallet.');
      }
    } catch (err: any) {
      if (err.message?.includes('User rejected') || err.message?.includes('rejected')) {
        setSeekerError('Signature request was cancelled.');
      } else {
        setSeekerError(err.message || 'Verification failed');
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

  const handleClaimPrize = async (payout: ClaimablePayout) => {
    if (!publicKey || !sendTransaction || !connection) return;
    setClaimingRoundId(payout.round_id);
    try {
      await initializeProgram({
        revenueWallet: REVENUE_WALLET,
        useDevnet: SOLANA_NETWORK === 'devnet',
      }).catch(() => {}); // idempotent; non-fatal if already inited
      const ix = buildClaimPrizeInstruction(payout.contract_round_id, publicKey);
      const { blockhash } = await connection.getLatestBlockhash();
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
        if (customCode === 6002) {
          const postRes = await postWinnersOnChain(payout.round_id);
          if (postRes.success) {
            alert('Prize finalization has been sent on-chain. Please try claiming again in about 30 seconds.');
          } else {
            alert(`Round not finalized on-chain. ${postRes.error ?? 'Please try again in a few minutes or contact support.'}`);
          }
          return;
        }
        if (customCode === 6003) {
          await markPayoutClaimed(payout.round_id, publicKey.toBase58()).catch(() => {});
          setClaimablePayouts((prev) => prev.filter((p) => p.round_id !== payout.round_id));
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
      await markPayoutClaimed(payout.round_id, publicKey.toBase58()).catch(() => {});
      setClaimablePayouts((prev) => prev.filter((p) => p.round_id !== payout.round_id));
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
      <div className="flex items-center justify-between px-6 py-4 md:py-6 border-b border-white/5 bg-[#050505] sticky top-0 z-[60]">
        <h2 className="text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter text-white">PROFILE</h2>
        <button 
          onClick={onOpenGuide}
          className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#9945FF] via-[#3b82f6] to-[#14F195] flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <span className="text-white font-black text-lg md:text-xl italic leading-none">?</span>
        </button>
      </div>

      <div className="p-4 md:p-12 lg:p-20 max-w-[1400px] mx-auto w-full pb-32 md:pb-48 relative">
        {/* XP at top */}
        <div className="mb-6 md:mb-10 flex justify-center md:justify-start">
          <div className="inline-flex items-baseline gap-2 px-6 py-4 md:px-8 md:py-5 bg-[#0A0A0A] border border-[#14F195]/20 rounded-2xl shadow-[0_0_20px_rgba(20,241,149,0.08)]">
            <span className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] italic">TOTAL XP</span>
            <span className="text-[#14F195] text-3xl md:text-5xl font-[1000] italic tabular-nums leading-none">
              {loading ? '—' : (stats?.total_points ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Profile Hero Section - Optimized for Mobile */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-14 mb-8 md:mb-20 relative z-10 pt-2 md:pt-0">
          <div className="relative flex-shrink-0">
              <div className="w-24 h-24 md:w-52 md:h-52 p-1 bg-gradient-to-br from-[#14F195] via-[#3b82f6] to-[#9945FF] rounded-[24px] md:rounded-[32px] shadow-2xl">
                  <div className="w-full h-full bg-zinc-900 rounded-[21px] md:rounded-[28px] overflow-hidden">
                      <img src={currentAvatar || avatar} alt="Avatar" className="w-full h-full object-cover grayscale" onError={() => setCurrentAvatar(DEFAULT_AVATAR)} />
                  </div>
              </div>
              <button
                onClick={() => setShowAvatarUpload(true)}
                className="absolute -bottom-2 -right-2 bg-[#14F195] hover:bg-[#14F195]/90 border border-[#14F195] text-black font-[1000] text-[10px] md:text-xs px-3 md:px-4 py-2 md:py-2 italic rounded-xl md:rounded-2xl shadow-2xl transition-all active:scale-95"
              >
                📷 Upload
              </button>
          </div>

          <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="mb-4 md:mb-10">
                <span className="text-[#14F195] text-[8px] md:text-xs font-black uppercase tracking-[0.5em] italic block mb-1 md:mb-3 opacity-70">PROTOCOL OPERATIVE</span>
                <h1 className="text-3xl md:text-8xl font-[1000] italic uppercase tracking-tighter text-white leading-none md:leading-[0.75] mb-3 md:mb-6">{currentUsername}</h1>
                <div className="h-1 w-12 md:h-1.5 md:w-20 bg-[#14F195] mx-auto md:mx-0 shadow-[0_0_10px_#14F195]"></div>
              </div>
              
              <button 
                onClick={onEdit} 
                className="px-8 md:px-12 py-3 md:py-5 bg-white/[0.03] border border-white/10 hover:bg-[#14F195] hover:text-black text-white font-[1000] uppercase text-[10px] md:text-sm tracking-widest italic rounded-full transition-all active:scale-95 shadow-2xl hover:scale-105"
              >
                Edit Profile
              </button>
          </div>
        </div>

        {/* Global Stats Grid - Optimized for Mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8 mb-8 md:mb-20 relative z-10">
          {loading ? (
            <>
              <ProfileStatCard label="TOTAL WON" value="—" unit="SOL" highlight />
              <ProfileStatCard label="TRIVIAS" value="—" />
              <ProfileStatCard label="STREAK" value="—" suffix="🔥" />
              <ProfileStatCard label="POINTS" value="—" />
            </>
          ) : (
            <>
              <ProfileStatCard label="TOTAL WON" value={stats?.total_sol_won.toFixed(2) || "0.00"} unit="SOL" highlight />
              <ProfileStatCard label="TRIVIAS" value={stats?.total_games_played.toString() || "0"} />
              <ProfileStatCard label="STREAK" value={stats?.current_streak.toString() || "0"} suffix="🔥" />
              <ProfileStatCard label="POINTS" value={stats?.total_points.toLocaleString() || "0"} />
            </>
          )}
        </div>

        {/* Seeker Perks Section */}
        <div className="mb-8 md:mb-12 relative z-10">
          <div className="bg-[#0A0A0A] border border-[#9945FF]/20 rounded-[24px] md:rounded-[32px] overflow-hidden shadow-2xl">
            <div className="px-6 py-4 md:px-10 md:py-6 border-b border-white/5 bg-gradient-to-r from-[#9945FF]/10 to-transparent">
              <h2 className="text-xl md:text-3xl font-[1000] italic uppercase tracking-tighter text-white">Seeker Perks</h2>
              <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">
                Exclusive benefits for Solana Seeker device owners
              </p>
            </div>
            <div className="p-6 md:p-10">
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
                      <span className="text-[#14F195] font-[1000] text-lg italic">VERIFIED SEEKER</span>
                      {seekerProfile.seeker_verified_at && (
                        <span className="text-zinc-600 text-[9px] font-bold block">
                          Since {new Date(seekerProfile.seeker_verified_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center">
                      <span className="text-[#14F195] text-xl font-[1000] italic block">+25%</span>
                      <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic">XP Boost</span>
                    </div>
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center">
                      <span className="text-[#14F195] text-sm font-[1000] italic block">Discount</span>
                      <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic">Lives</span>
                    </div>
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-center">
                      <span className="text-[#14F195] text-xl font-[1000] italic block">Badge</span>
                      <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic">Leaderboard</span>
                    </div>
                  </div>
                  {seekerProfile.skr_domain && (
                    <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl p-4">
                      <div>
                        <span className="text-white font-bold text-sm">{seekerProfile.skr_domain}</span>
                        <span className="text-zinc-500 text-[9px] font-bold block">Use as display name</span>
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
                    Own a Solana Seeker? Verify your Genesis Token to unlock exclusive perks.
                  </p>
                  {seekerError && (
                    <p className="text-red-400 text-xs mb-4">{seekerError}</p>
                  )}
                  <button
                    onClick={handleVerifySeeker}
                    disabled={seekerVerifying}
                    className="px-8 py-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-[1000] text-sm uppercase italic tracking-wider rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    {seekerVerifying ? 'Verifying...' : 'Verify Seeker'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Refer & Earn Section */}
        {referralStats && (
          <div className="mb-8 md:mb-12 relative z-10">
            <div className="bg-[#0A0A0A] border border-[#14F195]/20 rounded-[24px] md:rounded-[32px] overflow-hidden shadow-2xl">
              <div className="px-6 py-4 md:px-10 md:py-6 border-b border-white/5 bg-gradient-to-r from-[#14F195]/5 to-transparent">
                <h2 className="text-xl md:text-3xl font-[1000] italic uppercase tracking-tighter text-white">Refer & Earn</h2>
                <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">Share your link. Earn 1,000 XP per referral.</p>
              </div>

              <div className="p-6 md:p-10 space-y-6">
                {/* Referral Link */}
                <div>
                  <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] italic block mb-2">Your Referral Link</label>
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
                      {referralCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Referral Stats Row */}
                <div className="grid grid-cols-3 gap-3 md:gap-6">
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4 md:p-6 text-center">
                    <span className="text-[#14F195] text-2xl md:text-4xl font-[1000] italic block">{referralStats.completed_referrals}</span>
                    <span className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest italic">Completed</span>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4 md:p-6 text-center">
                    <span className="text-yellow-400 text-2xl md:text-4xl font-[1000] italic block">{referralStats.pending_referrals}</span>
                    <span className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest italic">Pending</span>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4 md:p-6 text-center">
                    <span className="text-white text-2xl md:text-4xl font-[1000] italic block">{referralStats.referral_points.toLocaleString()}</span>
                    <span className="text-zinc-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest italic">XP Earned</span>
                  </div>
                </div>

                {/* Share to X Button */}
                <button
                  onClick={() => {
                    const text = `I'm playing SOL Trivia — crypto trivia where you win real SOL! 🧠💰\n\nJoin using my link and let's compete:\n${referralStats.referral_url}\n\n@SolTriviaApp`;
                    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="w-full py-3 md:py-4 bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] rounded-xl text-white font-[1000] text-xs md:text-sm uppercase italic tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Share on</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>

                {/* Recent Referrals */}
                {referralStats.recent_referrals.length > 0 && (
                  <div>
                    <label className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] italic block mb-3">Recent Referrals</label>
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
          <div className="mb-8 md:mb-12 relative z-10">
            <div className="bg-[#0A0A0A] border border-[#38BDF8]/20 rounded-[24px] md:rounded-[32px] overflow-hidden shadow-2xl">
              <div className="px-6 py-4 md:px-10 md:py-6 border-b border-white/5 bg-gradient-to-r from-[#38BDF8]/10 to-transparent">
                <h2 className="text-xl md:text-3xl font-[1000] italic uppercase tracking-tighter text-white">Custom Games</h2>
                <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-wider mt-1">
                  Games you created & played
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
                  Created ({createdGames.length})
                </button>
                <button
                  onClick={() => setCustomGameTab('played')}
                  className={`flex-1 py-3 text-xs font-[1000] italic uppercase tracking-wider transition-colors ${
                    customGameTab === 'played'
                      ? 'text-[#14F195] border-b-2 border-[#14F195]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Played ({playedGames.length})
                </button>
              </div>

              <div className="p-4 md:p-6">
                {customGamesLoading ? (
                  <div className="py-8 text-center text-zinc-500 text-sm font-black uppercase tracking-widest italic">Loading...</div>
                ) : customGameTab === 'created' ? (
                  /* Created Games */
                  createdGames.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-sm italic">No games created yet.</div>
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
                                  <span className="text-red-400 text-[8px] font-black italic uppercase px-1.5 py-0.5 bg-red-400/10 rounded">Expired</span>
                                ) : (
                                  <span className="text-[#14F195] text-[8px] font-black italic uppercase px-1.5 py-0.5 bg-[#14F195]/10 rounded">{daysLeft}d left</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-bold">
                                <span>{game.question_count} Q</span>
                                <span>{game.total_plays} plays</span>
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
                                {linkCopiedSlug === game.slug ? 'Copied!' : 'Share'}
                              </button>
                              {!isExpired && onViewCustomGame && (
                                <button
                                  onClick={() => onViewCustomGame(game.slug)}
                                  className="px-3 py-1.5 bg-[#38BDF8]/20 text-[#38BDF8] text-[10px] font-[1000] italic uppercase rounded-lg hover:bg-[#38BDF8]/30 transition-all active:scale-95"
                                >
                                  View
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {createdGames.length > CUSTOM_GAMES_PER_PAGE && (
                        <div className="flex items-center justify-between mt-2">
                          <button onClick={() => setCreatedGamesPage(p => Math.max(0, p - 1))} disabled={createdGamesPage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Prev</button>
                          <span className="text-zinc-500 text-[10px] font-bold italic">{createdGamesPage + 1} / {Math.ceil(createdGames.length / CUSTOM_GAMES_PER_PAGE)}</span>
                          <button onClick={() => setCreatedGamesPage(p => Math.min(Math.ceil(createdGames.length / CUSTOM_GAMES_PER_PAGE) - 1, p + 1))} disabled={createdGamesPage >= Math.ceil(createdGames.length / CUSTOM_GAMES_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Next</button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  /* Played Games */
                  playedGames.length === 0 ? (
                    <div className="py-8 text-center text-zinc-500 text-sm italic">No custom games played yet.</div>
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
                              Play Again
                            </button>
                          )}
                        </div>
                      ))}
                      {playedGames.length > CUSTOM_GAMES_PER_PAGE && (
                        <div className="flex items-center justify-between mt-2">
                          <button onClick={() => setPlayedGamesPage(p => Math.max(0, p - 1))} disabled={playedGamesPage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Prev</button>
                          <span className="text-zinc-500 text-[10px] font-bold italic">{playedGamesPage + 1} / {Math.ceil(playedGames.length / CUSTOM_GAMES_PER_PAGE)}</span>
                          <button onClick={() => setPlayedGamesPage(p => Math.min(Math.ceil(playedGames.length / CUSTOM_GAMES_PER_PAGE) - 1, p + 1))} disabled={playedGamesPage >= Math.ceil(playedGames.length / CUSTOM_GAMES_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Next</button>
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
              {lastClaimTx.solAmount} SOL sent to your wallet. You can verify on-chain:
            </p>
            <a
              href={claimExplorerUrl(lastClaimTx.signature)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 underline text-sm hover:text-[#14F195]"
            >
              View transaction on Solana Explorer →
            </a>
            <button
              type="button"
              onClick={() => setLastClaimTx(null)}
              className="ml-3 text-zinc-500 text-xs hover:text-white"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Round wins – claim on-chain (winners acknowledged when round ends). First claimer can trigger post-winners if round not yet finalized (optional alongside complete-session). */}
        {claimablePayouts.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-white mb-4">Round wins</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">Winners are set when the round ends. Claim your prize below.</p>
            <div className="space-y-3">
              {claimablePayouts.slice(claimablePage * WINS_PER_PAGE, (claimablePage + 1) * WINS_PER_PAGE).map((p) => (
                <div
                  key={p.round_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 md:px-6 bg-[#0A0A0A] border border-white/10 rounded-xl"
                >
                  <div>
                    <span className="text-[#14F195] font-bold text-sm md:text-base">{p.round_title}</span>
                    <span className="text-zinc-500 text-xs ml-2">#{p.rank}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white font-bold">{(p.prize_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                    <button
                      type="button"
                      disabled={claimingRoundId === p.round_id}
                      onClick={() => handleClaimPrize(p)}
                      className="px-4 py-2 bg-[#14F195] hover:bg-[#14F195]/90 disabled:opacity-50 text-black font-[1000] text-xs uppercase italic rounded-lg transition-all"
                    >
                      {claimingRoundId === p.round_id ? 'Claiming…' : 'Claim'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {claimablePayouts.length > WINS_PER_PAGE && (
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setClaimablePage(p => Math.max(0, p - 1))} disabled={claimablePage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Prev</button>
                <span className="text-zinc-500 text-[10px] font-bold italic">{claimablePage + 1} / {Math.ceil(claimablePayouts.length / WINS_PER_PAGE)}</span>
                <button onClick={() => setClaimablePage(p => Math.min(Math.ceil(claimablePayouts.length / WINS_PER_PAGE) - 1, p + 1))} disabled={claimablePage >= Math.ceil(claimablePayouts.length / WINS_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Next</button>
              </div>
            )}
          </div>
        )}

        {/* Already claimed – show so user does not try to claim again */}
        {claimedPayouts.length > 0 && (
          <div className="mb-8 md:mb-12 relative z-10">
            <h2 className="text-lg md:text-2xl font-[1000] italic uppercase tracking-tighter text-white mb-4">Claimed</h2>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-wider mb-4">Prizes you have already claimed.</p>
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
                      Claimed
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {claimedPayouts.length > WINS_PER_PAGE && (
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setClaimedPage(p => Math.max(0, p - 1))} disabled={claimedPage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Prev</button>
                <span className="text-zinc-500 text-[10px] font-bold italic">{claimedPage + 1} / {Math.ceil(claimedPayouts.length / WINS_PER_PAGE)}</span>
                <button onClick={() => setClaimedPage(p => Math.min(Math.ceil(claimedPayouts.length / WINS_PER_PAGE) - 1, p + 1))} disabled={claimedPage >= Math.ceil(claimedPayouts.length / WINS_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Next</button>
              </div>
            )}
          </div>
        )}

        {/* Trivia History Table - Optimized for Mobile */}
        <div className="bg-[#0A0A0A] border border-white/5 relative z-10 shadow-2xl rounded-[24px] md:rounded-[40px] overflow-hidden">
          <div className="px-6 py-4 md:px-10 md:py-8 border-b border-white/5 bg-[#0D0D0D]">
              <h2 className="text-xl md:text-4xl font-[1000] italic uppercase tracking-tighter text-white">Trivia History</h2>
          </div>
          <div className="overflow-x-auto no-scrollbar">
            {loading ? (
              <div className="px-6 py-12 text-center text-zinc-500 text-sm font-black uppercase tracking-widest italic">Loading history…</div>
            ) : (
            <table className="w-full min-w-[500px] md:min-w-[700px]">
                <thead className="bg-black/40 text-[8px] md:text-xs font-black text-zinc-500 uppercase tracking-[0.4em]">
                  <tr>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-left">Arena</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-left">Date</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-center">Rank</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-center">Time</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-center">Correct</th>
                     <th className="px-6 py-4 md:px-10 md:py-6 text-right">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-zinc-500 italic">
                          No game history yet. Play your first trivia to see stats!
                        </td>
                      </tr>
                    ) : (
                      history.slice(historyPage * HISTORY_PER_PAGE, (historyPage + 1) * HISTORY_PER_PAGE).map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                          <td className="px-6 py-5 md:px-10 md:py-8 font-[1000] uppercase text-[#14F195] text-sm md:text-lg italic tracking-tight">
                            #{row.round_id.slice(0, 6)}
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-left text-zinc-400 text-[10px] md:text-sm font-bold tabular-nums whitespace-nowrap">
                            {row.finished_at ? new Date(row.finished_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-center font-[1000] italic text-white text-base md:text-xl tabular-nums">
                            #{row.rank || '-'}
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-center font-[1000] italic text-zinc-400 text-sm md:text-xl tabular-nums">
                            {row.time_taken_seconds}s
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-center font-[1000] italic text-white text-sm md:text-xl tabular-nums">
                            {row.correct_answers}/{row.total_questions}
                          </td>
                          <td className="px-6 py-5 md:px-10 md:py-8 text-right font-[1000] italic text-[#14F195] text-lg md:text-3xl tabular-nums drop-shadow-[0_0_10px_rgba(20,241,149,0.3)]">
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
              <button onClick={() => setHistoryPage(p => Math.max(0, p - 1))} disabled={historyPage === 0} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Prev</button>
              <span className="text-zinc-500 text-[10px] font-bold italic">{historyPage + 1} / {Math.ceil(history.length / HISTORY_PER_PAGE)}</span>
              <button onClick={() => setHistoryPage(p => Math.min(Math.ceil(history.length / HISTORY_PER_PAGE) - 1, p + 1))} disabled={historyPage >= Math.ceil(history.length / HISTORY_PER_PAGE) - 1} className="px-3 py-1.5 text-xs font-[1000] italic uppercase text-zinc-400 disabled:text-zinc-700 disabled:cursor-not-allowed hover:text-white transition-colors">Next</button>
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
    <div className={`bg-[#0A0A0A] border p-4 md:p-10 rounded-[20px] md:rounded-[32px] shadow-2xl group hover:scale-[1.03] transition-all duration-300 ${highlight ? 'border-[#14F195]/30 bg-gradient-to-br from-[#14F195]/5 to-transparent' : 'border-white/5'}`}>
        <span className="text-[7px] md:text-xs text-zinc-500 font-black uppercase tracking-[0.2em] md:tracking-[0.3em] block mb-2 md:mb-4 group-hover:text-zinc-200 transition-colors italic">{label}</span>
        <div className="flex items-baseline gap-1 md:gap-2">
            <span className={`text-xl md:text-5xl font-[1000] italic leading-none tracking-tighter ${highlight ? 'text-[#14F195]' : 'text-white'}`}>{value}</span>
            {unit && <span className="text-[#14F195] font-[1000] text-[8px] md:text-lg italic tracking-widest">{unit}</span>}
            {suffix && <span className="text-xl md:text-4xl">{suffix}</span>}
        </div>
    </div>
);

export default ProfileView;
