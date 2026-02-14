import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { View } from './types';

const PATH_TO_VIEW: Record<string, View> = {
  '/': View.HOME,
  '/play': View.PLAY,
  '/quests': View.QUESTS,
  '/leaderboard': View.LEADERBOARD,
  '/profile': View.PROFILE,
  '/quiz': View.QUIZ,
  '/results': View.RESULTS,
  '/practice': View.PRACTICE,
  '/practice-results': View.PRACTICE_RESULTS,
  ...(import.meta.env.VITE_ENABLE_CONTRACT_TEST === 'true' ? { '/contract-test': View.CONTRACT_TEST } : {}),
  '/terms': View.TERMS,
  '/privacy': View.PRIVACY,
  '/admin': View.ADMIN,
  '/adminlogin': View.ADMIN,
};
function viewFromPath(): View {
  if (typeof window === 'undefined') return View.HOME;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  return PATH_TO_VIEW[path] ?? View.HOME;
}
function pathForView(view: View): string {
  if (view === View.HOME) return '/';
  if (view === View.ADMIN) return '/admin';
  if (view === View.CONTRACT_TEST) return import.meta.env.VITE_ENABLE_CONTRACT_TEST === 'true' ? '/contract-test' : '/';
  return '/' + view.toLowerCase();
}
import { useWallet, useConnection } from './src/contexts/WalletContext';
import { SystemProgram, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import Sidebar from './components/Sidebar';
import HomeView from './components/HomeView';
import LeaderboardView from './components/LeaderboardView';
import QuestsView from './components/QuestsView';
import ProfileView from './components/ProfileView';
import PlayView from './components/PlayView';
import GuideModal from './components/GuideModal';
import BuyLivesModal from './components/BuyLivesModal';
import EditProfileModal from './components/EditProfileModal';
import QuizView from './components/QuizView';
import ResultsView from './components/ResultsView';
import PracticeResultsView from './components/PracticeResultsView';
import WalletRequiredModal from './components/WalletRequiredModal';
import LegalDisclaimerModal from './components/LegalDisclaimerModal';
import WalletConnectButton from './components/WalletConnectButton';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import AdminRoute from './components/AdminRoute';
import TermsOfServiceView from './components/TermsOfServiceView';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import LoadingScreen from './components/LoadingScreen';
import ContractTestView from './components/ContractTestView';
import { getPlayerLives, getRoundEntriesUsed, startGame, completeSession, registerPlayerProfile, updateQuestProgress, getLeaderboard, ensureRoundOnChain, initializeProgram, startPracticeGame, registerReferral, getSeekerProfile } from './src/utils/api';
import { REVENUE_WALLET, ENTRY_FEE_LAMPORTS, TXN_FEE_LAMPORTS, DEFAULT_AVATAR, SOLANA_NETWORK } from './src/utils/constants';
import { buildEnterRoundInstruction, contractRoundIdFromDateAndNumber } from './src/utils/soltriviaContract';

import { supabase } from './src/utils/supabase';
import { useKeepAlive } from './src/hooks/useKeepAlive';

const App: React.FC = () => {
  // Keep Render free tier service alive (pings every 2 minutes)
  useKeepAlive(true);
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [currentView, setCurrentView] = useState<View>(viewFromPath);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isBuyLivesOpen, setIsBuyLivesOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [showWalletRequired, setShowWalletRequired] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
    try { return localStorage.getItem('soltrivia_terms_accepted') === 'true'; } catch { return false; }
  });
  
  const [lives, setLives] = useState<number | null>(null);
  const [livesDisplayReady, setLivesDisplayReady] = useState(false); // false = show "—" for first 5s after connect
  const [roundEntriesUsed, setRoundEntriesUsed] = useState(0);
  const [freeEntryNotification, setFreeEntryNotification] = useState<string | null>(null);
  const ROUND_ENTRIES_MAX = 2;
  
  // Seeker Genesis Token verification status (for discounted lives pricing)
  const [isSeekerVerified, setIsSeekerVerified] = useState(false);

  // Quiz results state
  const [lastGameResults, setLastGameResults] = useState<{ score: number, points: number, time: number, rank?: number; scoreSaveFailed?: boolean } | null>(null);
  
  // Current game session ID
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Practice mode state
  const [practiceQuestionIds, setPracticeQuestionIds] = useState<string[] | null>(null);
  const [practiceResults, setPracticeResults] = useState<{ score: number; points: number; time: number } | null>(null);

  // Ref: current wallet so async fetch can avoid applying stale result for a different wallet (reload race)
  const currentWalletRef = useRef<string | null>(null);
  currentWalletRef.current = publicKey?.toBase58() ?? null;

  const livesIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const livesTimeoutRef = useRef<number | null>(null);
  const livesShowAfterRef = useRef<number | null>(null);

  // Only active-game views truly require wallet (quiz in progress, viewing results)
  const walletRequiredViews = [View.QUIZ, View.RESULTS];

  // Lives: on load/reload do not show count for 5s; keep fetching then show (avoids wrong value from wallet race)
  useEffect(() => {
    if (!connected || !publicKey) {
      setLives(null);
      setLivesDisplayReady(false);
      return;
    }

    setLivesDisplayReady(false);
    const walletAddress = publicKey.toBase58();

    const fetchLivesOnly = async (forWallet: string) => {
      try {
        const res = await getPlayerLives(forWallet);
        const count = Math.max(0, Number(res.lives_count) || 0);
        if (currentWalletRef.current === forWallet) {
          setLives(count);
        }
      } catch (err) {
        if (currentWalletRef.current === forWallet) setLives(0);
      }
    };

    const fetchAll = async () => {
      await fetchLivesOnly(walletAddress);
      if (currentWalletRef.current === walletAddress) {
        registerPlayerProfile(walletAddress).catch(() => {});
        if (!currentSessionId) getRoundEntriesUsed(walletAddress).then(setRoundEntriesUsed).catch(() => {});
      }
    };

    livesTimeoutRef.current = window.setTimeout(() => {
      livesTimeoutRef.current = null;
      fetchAll();
      livesIntervalsRef.current = [
        setInterval(() => fetchLivesOnly(walletAddress), 2000),
        setInterval(fetchAll, 30000),
      ];
      // Show lives count only after 5s of fetching for this address
      livesShowAfterRef.current = window.setTimeout(() => {
        livesShowAfterRef.current = null;
        setLivesDisplayReady(true);
      }, 5000);
    }, 250);

    return () => {
      if (livesTimeoutRef.current) {
        clearTimeout(livesTimeoutRef.current);
        livesTimeoutRef.current = null;
      }
      if (livesShowAfterRef.current) {
        clearTimeout(livesShowAfterRef.current);
        livesShowAfterRef.current = null;
      }
      livesIntervalsRef.current.forEach(clearInterval);
      livesIntervalsRef.current = [];
    };
  }, [connected, publicKey, currentSessionId]);

  // Check wallet connection when navigating
  const handleViewChange = (view: View) => {
    // QUIZ and RESULTS require active wallet connection
    if (walletRequiredViews.includes(view) && !connected) {
      setShowWalletRequired(true);
      return;
    }

    setCurrentView(view);
  };

  // Sync path to URL when view changes (so reload keeps the same page)
  useEffect(() => {
    const want = pathForView(currentView);
    if (window.location.pathname.replace(/\/$/, '') !== want.replace(/\/$/, '')) {
      window.history.replaceState(null, '', want);
    }
  }, [currentView]);

  // Back/forward: update view from path
  useEffect(() => {
    const onPopState = () => setCurrentView(viewFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Restore quiz session from sessionStorage when we land on /quiz (e.g. after reload)
  useEffect(() => {
    if (currentView !== View.QUIZ || currentSessionId != null || !connected) return;
    try {
      const stored = sessionStorage.getItem('quiz_session_id');
      if (stored) setCurrentSessionId(stored);
    } catch (_) {}
  }, [currentView, connected, currentSessionId]);

  // Redirect to HOME only when user disconnects from views that need wallet data
  const disconnectRedirectViews = [View.QUIZ, View.RESULTS, View.PROFILE];
  const prevConnectedRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = connected;
    if (wasConnected === true && !connected && disconnectRedirectViews.includes(currentView)) {
      setCurrentView(View.HOME);
    }
  }, [connected, currentView]);

  // Close wallet required modal when wallet connects
  useEffect(() => {
    if (connected && showWalletRequired) {
      setShowWalletRequired(false);
    }
  }, [connected, showWalletRequired]);

  // Auto-dismiss free-entry notification after 5 seconds
  useEffect(() => {
    if (!freeEntryNotification) return;
    const t = setTimeout(() => setFreeEntryNotification(null), 5000);
    return () => clearTimeout(t);
  }, [freeEntryNotification]);

  // Fetch Seeker verification status when wallet connects
  useEffect(() => {
    if (!connected || !publicKey) {
      setIsSeekerVerified(false);
      return;
    }
    const walletAddr = publicKey.toBase58();
    getSeekerProfile(walletAddr)
      .then((profile) => {
        if (currentWalletRef.current === walletAddr) {
          setIsSeekerVerified(profile?.is_seeker_verified ?? false);
        }
      })
      .catch(() => {
        // Non-fatal — default to non-Seeker pricing
      });
  }, [connected, publicKey]);

  // Referral: capture ?ref=CODE from URL on mount → store in localStorage → clean URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode && refCode.trim()) {
        localStorage.setItem('soltrivia_referral_code', refCode.trim());
        // Remove ?ref= from URL without page reload
        params.delete('ref');
        const cleanUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);
      }
    } catch (_) {}
  }, []);

  // Referral: register referral when wallet connects (if stored code exists)
  const referralRegisteredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!connected || !publicKey) return;
    const walletAddr = publicKey.toBase58();
    // Only attempt once per wallet per session
    if (referralRegisteredRef.current === walletAddr) return;
    try {
      const storedCode = localStorage.getItem('soltrivia_referral_code');
      if (!storedCode) return;
      referralRegisteredRef.current = walletAddr;
      registerReferral(walletAddr, storedCode)
        .then(() => {
          // Successfully registered — clear stored code
          localStorage.removeItem('soltrivia_referral_code');
        })
        .catch((err) => {
          // Non-fatal: self-referral, already referred, invalid code, etc.
          // Clear code on known non-retryable errors
          if (err.message?.includes('self-referral') || err.message?.includes('already been referred')) {
            localStorage.removeItem('soltrivia_referral_code');
          }
        });
    } catch (_) {}
  }, [connected, publicKey]);

  // Admin access: Check URL on mount for /adminlogin
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/adminlogin' || path === '/admin') {
      setCurrentView(View.ADMIN);
      // Update URL without page reload
      window.history.replaceState({}, '', '/adminlogin');
    }
  }, []);

  // Admin access: Ctrl+Shift+A keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setCurrentView(View.ADMIN);
        window.history.replaceState({}, '', '/adminlogin');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Update URL when navigating away from admin
  useEffect(() => {
    if (currentView !== View.ADMIN && window.location.pathname === '/adminlogin') {
      window.history.replaceState({}, '', '/');
    }
  }, [currentView]);

  // Profile state (DEFAULT_AVATAR = inline SVG, no network, fast load)
  const [profile, setProfile] = useState({
    username: 'Solana_Sage',
    avatar: DEFAULT_AVATAR,
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileCacheBuster, setProfileCacheBuster] = useState(0);

  const refetchProfile = React.useCallback(async () => {
    if (!publicKey) return;
    const walletAddress = publicKey.toBase58();
    try {
      const { data, error } = await supabase
        .from('player_profiles')
        .select('username, avatar_url')
        .eq('wallet_address', walletAddress)
        .maybeSingle();
      if (data && !error) {
        setProfile({
          username: data.username || 'Solana_Sage',
          avatar: data.avatar_url || DEFAULT_AVATAR,
        });
      }
    } catch (_) {}
  }, [publicKey]);

  // Fetch profile when wallet connects (single fast Supabase query)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!connected || !publicKey) {
        setProfile({ username: 'Solana_Sage', avatar: DEFAULT_AVATAR });
        return;
      }

      setProfileLoading(true);
      const walletAddress = publicKey.toBase58();

      try {
        const { data: profileData, error } = await supabase
          .from('player_profiles')
          .select('username, avatar_url')
          .eq('wallet_address', walletAddress)
          .single();

        if (profileData && !error) {
          setProfile({
            username: profileData.username || 'Solana_Sage',
            avatar: profileData.avatar_url || DEFAULT_AVATAR,
          });
          // Mark identity_sync quest complete if profile is set up (username or avatar)
          const hasProfile = (profileData.username && String(profileData.username).trim() !== '') || (profileData.avatar_url && String(profileData.avatar_url).trim() !== '');
          if (hasProfile) {
            try {
              await updateQuestProgress(walletAddress, 'identity_sync', 1);
            } catch (_) {
              // ignore
            }
          }
        } else if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [connected, publicKey]);

  // Refetch profile when user opens Profile tab so we always show latest from DB (fixes refresh showing stale/default)
  useEffect(() => {
    if (currentView !== View.PROFILE || !connected || !publicKey) return;
    refetchProfile();
  }, [currentView, connected, publicKey, refetchProfile]);

  // Refetch round entries when user navigates to Play so 2/2 → 1/2 → 0/2 is correct from DB
  useEffect(() => {
    if (currentView !== View.PLAY || !connected || !publicKey || currentSessionId) return;
    getRoundEntriesUsed(publicKey.toBase58()).then(setRoundEntriesUsed).catch(() => {});
  }, [currentView, connected, publicKey, currentSessionId]);

  const handleUpdateProfile = async (username: string, avatar: string) => {
    if (!publicKey) return;

    // Optimistically update UI
    setProfile({ username, avatar });

    const walletAddress = publicKey.toBase58();

    try {
      // First check if profile row exists
      const { data: existing } = await supabase
        .from('player_profiles')
        .select('wallet_address')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      let saveError: any = null;

      if (existing) {
        // Row exists — use targeted update (safest, won't touch stats columns)
        const { error } = await supabase
          .from('player_profiles')
          .update({
            username,
            avatar_url: avatar,
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', walletAddress);
        saveError = error;
      } else {
        // No row yet — insert with defaults
        const { error } = await supabase
          .from('player_profiles')
          .insert({
            wallet_address: walletAddress,
            username,
            avatar_url: avatar,
            updated_at: new Date().toISOString(),
          });
        saveError = error;
      }

      if (saveError) {
        console.error('Profile save failed:', saveError);
        alert('Profile save failed. Please try again.');
        return;
      }

      // Verify the save persisted by re-reading
      const { data: verify } = await supabase
        .from('player_profiles')
        .select('username, avatar_url')
        .eq('wallet_address', walletAddress)
        .single();

      if (verify) {
        setProfile({
          username: verify.username || username,
          avatar: verify.avatar_url || avatar,
        });
        setProfileCacheBuster(Date.now());
      }

      try {
        await updateQuestProgress(walletAddress, 'identity_sync', 1);
      } catch {
        // ignore quest update failure
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert('Profile save failed. Please try again.');
    }
  };

  const PRACTICE_DAILY_LIMIT = 5;

  const getPracticeUsageToday = (): number => {
    try {
      const stored = localStorage.getItem('practice_usage');
      if (!stored) return 0;
      const { date, count } = JSON.parse(stored);
      const today = new Date().toISOString().split('T')[0];
      return date === today ? count : 0;
    } catch { return 0; }
  };

  const incrementPracticeUsage = () => {
    const today = new Date().toISOString().split('T')[0];
    const current = getPracticeUsageToday();
    localStorage.setItem('practice_usage', JSON.stringify({ date: today, count: current + 1 }));
  };

  const practiceRunsLeft = PRACTICE_DAILY_LIMIT - getPracticeUsageToday();

  const handleStartPractice = async () => {
    if (practiceRunsLeft <= 0) {
      alert('You\'ve used all 5 practice runs for today. Come back tomorrow or play for real SOL!');
      return;
    }
    try {
      console.log('🎮 Starting practice mode...');
      const response = await startPracticeGame();
      console.log('✅ Practice session created:', response.practice_session_id);
      incrementPracticeUsage();
      setPracticeQuestionIds(response.question_ids);
      setPracticeResults(null);
      setCurrentView(View.PRACTICE);
    } catch (err: any) {
      console.error('❌ Failed to start practice game:', err);
      alert('Failed to start practice mode. Please try again.');
    }
  };

  const handlePracticeFinish = (correctCount: number, points: number, totalTimeSeconds: number) => {
    console.log('🎮 Practice finished:', { correctCount, points, totalTimeSeconds });
    setPracticeResults({ score: correctCount, points, time: totalTimeSeconds });
    setPracticeQuestionIds(null);
    setCurrentView(View.PRACTICE_RESULTS);
  };

  const handleQuizFinish = async (correctCount: number, points: number, totalTimeSeconds: number) => {
    const sessionIdToComplete = currentSessionId;
    // Keep currentSessionId set until we switch view so QuizView doesn't see null and log an error

    let rank: number | undefined = undefined;

    // Store final score in Supabase via complete-session (so profile + leaderboard show it), with retry
    let scoreSaveFailed = false;
    if (sessionIdToComplete) {
      const payload = {
        session_id: sessionIdToComplete,
        total_score: points,
        correct_count: correctCount,
        time_taken_ms: Math.round(totalTimeSeconds * 1000),
      };
      const maxAttempts = 3;
      const delayMs = 500;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const completeRes = await completeSession(payload);
          rank = completeRes.rank ?? undefined;
          console.log('✅ Session completed, rank:', rank);
          break;
        } catch (err) {
          console.error(`Complete session attempt ${attempt}/${maxAttempts} failed:`, err);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, delayMs));
          } else {
            scoreSaveFailed = true;
          }
        }
      }
    }

    // If rank not from complete-session, fetch from leaderboard
    if (rank === undefined && publicKey) {
      try {
        const response = await getLeaderboard();
        const leaderboard = Array.isArray(response) ? response : (response.leaderboard || []);
        const userAddress = publicKey.toBase58();
        const userEntry = leaderboard.find((entry: any) => entry.wallet_address === userAddress);
        rank = userEntry?.rank;
        console.log('🏆 User rank from leaderboard:', rank);
      } catch (err) {
        console.error('Failed to fetch rank:', err);
      }
    }

    if (publicKey) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const walletAddr = publicKey.toBase58();
        const [livesData, entriesUsed] = await Promise.all([
          getPlayerLives(walletAddr),
          getRoundEntriesUsed(walletAddr),
        ]);
        setLives(Math.max(0, Number(livesData.lives_count) || 0));
        setRoundEntriesUsed(entriesUsed);
      } catch (_) {}
    }

    setLastGameResults({ score: correctCount, points, time: totalTimeSeconds, rank, scoreSaveFailed });
    setCurrentView(View.RESULTS);
    setCurrentSessionId(null);
    try {
      sessionStorage.removeItem('quiz_session_id');
    } catch (_) {}
  };

  const handleStartQuiz = async () => {
    if (!connected || !publicKey) {
      setShowWalletRequired(true);
      return;
    }
    
    // Check if player can play (has round entries OR purchased lives)
    const roundEntriesLeft = ROUND_ENTRIES_MAX - roundEntriesUsed;
    if (roundEntriesLeft <= 0 && (lives ?? 0) <= 0) {
      setIsBuyLivesOpen(true);
      return;
    }

    try {
      // --- Pre-flight entry cap check (BEFORE taking payment) ---
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const roundNumber = Math.floor(now.getUTCHours() / 6);
      const walletAddr = publicKey.toBase58();

      const { data: currentRound } = await supabase
        .from('daily_rounds')
        .select('id')
        .eq('date', today)
        .eq('round_number', roundNumber)
        .maybeSingle();

      if (currentRound) {
        const { data: roundSessions } = await supabase
          .from('game_sessions')
          .select('id, finished_at')
          .eq('round_id', currentRound.id)
          .eq('wallet_address', walletAddr);

        const finishedInRound = roundSessions?.filter(s => s.finished_at).length || 0;
        if (finishedInRound >= 5) {
          alert('You\'ve reached the maximum 5 entries for this round. Try again next round!');
          return;
        }
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: dailySessions } = await supabase
        .from('game_sessions')
        .select('id')
        .eq('wallet_address', walletAddr)
        .gte('started_at', twentyFourHoursAgo)
        .not('finished_at', 'is', null)
        .limit(25);
      const dailyCount = dailySessions?.length ?? 0;

      if (dailyCount >= 20) {
        alert('You\'ve reached the maximum 20 entries for today. Please try again tomorrow!');
        return;
      }

      // Pre-check: verify player has lives or free entries BEFORE sending payment
      try {
        const livesData = await getPlayerLives(walletAddr);
        // Free entries: count game_sessions where life_used = false (2 lifetime free entries)
        const { count: freeEntriesUsed } = await supabase
          .from('game_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('wallet_address', walletAddr)
          .eq('life_used', false);
        const isFreeEntry = (freeEntriesUsed ?? 0) < 2;
        if (!isFreeEntry && (livesData.lives_count ?? 0) <= 0) {
          setIsBuyLivesOpen(true);
          return;
        }
      } catch (livesCheckErr) {
        console.warn('Lives pre-check failed, proceeding anyway:', livesCheckErr);
      }

      const useContractEntry = import.meta.env.VITE_USE_ENTRY_CONTRACT !== 'false';
      const { blockhash } = await connection.getLatestBlockhash();

      let instructions;
      if (useContractEntry) {
        // Ensure program is initialized once (idempotent). Then ensure current round exists on-chain (same date/round as client).
        await initializeProgram({
          revenueWallet: REVENUE_WALLET,
          useDevnet: SOLANA_NETWORK === 'devnet',
        });
        await ensureRoundOnChain(
          SOLANA_NETWORK === 'devnet'
            ? { date: today, round_number: roundNumber, useDevnet: true }
            : { date: today, round_number: roundNumber }
        );
        const roundIdU64 = contractRoundIdFromDateAndNumber(today, roundNumber);
        instructions = [
          buildEnterRoundInstruction(
            roundIdU64,
            publicKey,
            new PublicKey(REVENUE_WALLET)
          ),
        ];
      } else {
        const PRIZE_POOL_WALLET = import.meta.env.VITE_PRIZE_POOL_WALLET || 'C9U6pL7FcroUBcSGQR2iCEGmAydVjzEE7ZYaJuVJuEEo';
        instructions = [
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(PRIZE_POOL_WALLET),
            lamports: ENTRY_FEE_LAMPORTS,
          }),
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(REVENUE_WALLET),
            lamports: TXN_FEE_LAMPORTS,
          }),
        ];
      }

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      const confirmationPromise = connection.confirmTransaction(signature, 'confirmed');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)
      );
      
      await Promise.race([confirmationPromise, timeoutPromise]);

      // Call backend to start game session
      const gameResult = await startGame(publicKey.toBase58(), signature);

      console.log('🎮 startGame result:', JSON.stringify(gameResult));

      // Store session ID for quiz (and persist so reload on /quiz keeps the game)
      setCurrentSessionId(gameResult.sessionId);
      try {
        sessionStorage.setItem('quiz_session_id', gameResult.sessionId);
      } catch (_) {}

      // Optimistically update UI based on whether it was a free or paid entry
      if (gameResult.freeEntry) {
        setRoundEntriesUsed(prev => prev + 1);
        if (gameResult.freeEntryReason === 'new_user') {
          setFreeEntryNotification('Welcome! This play is free for new users.');
        } else if (gameResult.freeEntryReason === 'welcome_bonus') {
          setFreeEntryNotification(`You have ${gameResult.freeEntriesRemaining ?? 0} free play(s) left.`);
        }
      } else if (!gameResult.resumed) {
        setLives(prev => Math.max(0, (prev ?? 0) - 1));
        setRoundEntriesUsed(prev => prev + 1);
      }
      setCurrentView(View.QUIZ);
    } catch (err: any) {
      console.error('Failed to start quiz:', err);

      // Show error to user
      if (err.message?.includes('User rejected')) {
        // User cancelled, don't show error
        return;
      }

      // Handle entry cap errors
      if (err.code === 'ROUND_CAP_REACHED') {
        alert('You\'ve reached the maximum 5 entries for this round. Try again next round!');
        return;
      }
      if (err.code === 'DAILY_CAP_REACHED') {
        alert('You\'ve reached the maximum 20 entries for today. Please try again tomorrow!');
        return;
      }

      // If no lives and free entries used, open buy lives modal
      if (err.code === 'NO_LIVES' || err.code === 'ALREADY_PLAYED' || err.message?.includes('Free entries used') || err.message?.includes('Insufficient lives')) {
        setIsBuyLivesOpen(true);
        return;
      }

      // For other errors, show the message
      alert(err.message || 'Failed to start quiz. Please try again.');
    }
  };

  const handleBuyLivesSuccess = (newLivesCount?: number) => {
    if (typeof newLivesCount === 'number') {
      setLives(Math.max(0, newLivesCount));
    } else {
      setLives(prev => Math.max(0, (prev ?? 0) + 3));
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case View.HOME:
        return (
          <HomeView
            lives={livesDisplayReady ? lives : null}
            onEnterTrivia={() => {
              if (!connected) {
                setShowWalletRequired(true);
              } else {
                setCurrentView(View.PLAY);
              }
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenBuyLives={() => {
              if (!connected) {
                setShowWalletRequired(true);
              } else {
                setIsBuyLivesOpen(true);
              }
            }}
            onStartPractice={handleStartPractice}
            practiceRunsLeft={practiceRunsLeft}
          />
        );
      case View.LEADERBOARD:
        return (
          <LeaderboardView
            onOpenGuide={() => setIsGuideOpen(true)}
            profileCacheBuster={profileCacheBuster}
            currentWallet={publicKey?.toBase58() ?? null}
            currentUserAvatar={profile.avatar}
          />
        );
      case View.PLAY:
        return <PlayView lives={livesDisplayReady ? lives : null} roundEntriesUsed={roundEntriesUsed} roundEntriesMax={ROUND_ENTRIES_MAX} onStartQuiz={handleStartQuiz} onOpenBuyLives={() => {
          if (!connected) { setShowWalletRequired(true); } else { setIsBuyLivesOpen(true); }
        }} onStartPractice={handleStartPractice} practiceRunsLeft={practiceRunsLeft} />;
      case View.QUESTS:
        return <QuestsView onGoToProfile={() => setCurrentView(View.PROFILE)} onOpenGuide={() => setIsGuideOpen(true)} />;
      case View.PROFILE:
        if (!connected) {
          return (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 md:p-10 max-w-md w-full text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 flex items-center justify-center border border-[#9945FF]/30">
                    <svg className="w-8 h-8 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-[1000] italic uppercase tracking-tighter text-white mb-2">Connect Your Wallet</h3>
                <p className="text-zinc-400 text-sm mb-6">Connect your Solana wallet to view your profile, stats, and game history.</p>
                <div className="flex justify-center">
                  <WalletConnectButton />
                </div>
              </div>
            </div>
          );
        }
        return (
          <ProfileView
            username={profile.username}
            avatar={profile.avatar}
            profileCacheBuster={profileCacheBuster}
            onEdit={() => setIsEditProfileOpen(true)}
            onOpenGuide={() => setIsGuideOpen(true)}
            onAvatarUpdated={(url: string) => {
              setProfile((prev) => ({ ...prev, avatar: url }));
              setProfileCacheBuster(Date.now());
              refetchProfile();
            }}
            onSeekerVerified={(verified: boolean) => setIsSeekerVerified(verified)}
          />
        );
      case View.QUIZ:
        return connected ? (
          <div className="flex flex-col flex-1">
            {freeEntryNotification && (
              <div
                className="mx-4 mt-2 mb-0 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm text-center"
                role="alert"
              >
                {freeEntryNotification}
              </div>
            )}
            <QuizView
              sessionId={currentSessionId}
              onFinish={handleQuizFinish}
              onQuit={() => {
                try {
                  sessionStorage.removeItem('quiz_session_id');
                } catch (_) {}
                setCurrentSessionId(null);
                setFreeEntryNotification(null);
                setCurrentView(View.PLAY);
              }}
            />
          </div>
        ) : null;
      case View.RESULTS:
        return connected && lastGameResults ? (
          <ResultsView
            results={lastGameResults}
            lives={livesDisplayReady ? lives : null}
            roundEntriesLeft={Math.max(0, ROUND_ENTRIES_MAX - roundEntriesUsed)}
            roundEntriesMax={ROUND_ENTRIES_MAX}
            onRestart={handleStartQuiz}
            onGoHome={() => setCurrentView(View.HOME)}
            onBuyLives={() => setIsBuyLivesOpen(true)}
          />
        ) : null;
      case View.PRACTICE:
        return practiceQuestionIds ? (
          <QuizView
            sessionId={null}
            mode="practice"
            practiceQuestionIds={practiceQuestionIds}
            onFinish={handlePracticeFinish}
            onQuit={() => {
              setPracticeQuestionIds(null);
              setCurrentView(View.PLAY);
            }}
          />
        ) : null;
      case View.PRACTICE_RESULTS:
        return practiceResults ? (
          <PracticeResultsView
            score={practiceResults.score}
            totalQuestions={10}
            points={practiceResults.points}
            totalTime={practiceResults.time}
            onPlayForReal={() => {
              setPracticeResults(null);
              setCurrentView(View.PLAY);
              if (connected) {
                handleStartQuiz();
              } else {
                setShowWalletRequired(true);
              }
            }}
            onTryAgain={() => {
              setPracticeResults(null);
              handleStartPractice();
            }}
            onBackToHome={() => {
              setPracticeResults(null);
              setCurrentView(View.HOME);
            }}
          />
        ) : null;
      case View.TERMS:
        return <TermsOfServiceView onBack={() => setCurrentView(View.HOME)} />;
      case View.PRIVACY:
        return <PrivacyPolicyView onBack={() => setCurrentView(View.HOME)} />;
      case View.ADMIN:
        return <AdminRoute />;
      case View.CONTRACT_TEST:
        return <ContractTestView />;
      default:
        return (
          <HomeView
            lives={livesDisplayReady ? lives : null}
            onEnterTrivia={() => {
              if (!connected) {
                setShowWalletRequired(true);
              } else {
                setCurrentView(View.PLAY);
              }
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenBuyLives={() => {
              if (!connected) {
                setShowWalletRequired(true);
              } else {
                setIsBuyLivesOpen(true);
              }
            }}
            onStartPractice={handleStartPractice}
            practiceRunsLeft={practiceRunsLeft}
          />
        );
    }
  };

  // Hide sidebar during active quiz or legal full-page views
  const hideSidebar = currentView === View.QUIZ || currentView === View.TERMS || currentView === View.PRIVACY;

  // Footer removed – Terms & Privacy links are in the How to Play modal

  // Optimized help button logic to avoid duplication on views with built-in headers
  const viewsWithBuiltInHeader = [View.LEADERBOARD, View.PROFILE, View.QUESTS];
  const showMobileHelpButton = currentView !== View.HOME && !hideSidebar && !viewsWithBuiltInHeader.includes(currentView);

  if (appLoading) {
    return <LoadingScreen onComplete={() => setAppLoading(false)} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050505] overflow-hidden text-white selection:bg-[#00FFA3] selection:text-black">
      {!hideSidebar && <Sidebar currentView={currentView} setView={handleViewChange} />}

      <main className="flex-1 overflow-y-auto relative h-full scroll-smooth flex flex-col pb-[100px] md:pb-0 safe-bottom">
        <div className="flex-1 min-h-0">{renderContent()}</div>
      </main>

      {/* Global Mobile Help Button for views without headers */}
      {showMobileHelpButton && (
        <div className={`md:hidden fixed z-[150] left-0 right-0 pointer-events-none transition-all duration-300 safe-top ${
          currentView === View.PLAY 
            ? 'top-8 flex justify-center' 
            : 'top-[-4px] h-[64px] px-6 flex justify-end items-center'
        }`}>
          <button 
            onClick={() => setIsGuideOpen(true)}
            className={`pointer-events-auto flex items-center justify-center transition-all active:scale-95 ${currentView === View.PLAY ? 'gap-3 px-4' : 'w-10 h-10'}`}
          >
            {currentView === View.PLAY && (
              <span className="text-[10px] font-black uppercase tracking-widest text-white/90">How to Play</span>
            )}
            <div className={`rounded-full bg-gradient-to-br from-[#9945FF] via-[#3b82f6] to-[#14F195] flex items-center justify-center shadow-lg shadow-black/50 ${currentView === View.PLAY ? 'w-6 h-6' : 'w-8 h-8'}`}>
              <span className="text-white font-black text-xs italic">?</span>
            </div>
          </button>
        </div>
      )}

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onOpenTerms={() => setCurrentView(View.TERMS)}
        onOpenPrivacy={() => setCurrentView(View.PRIVACY)}
      />
      <BuyLivesModal isOpen={isBuyLivesOpen} onClose={() => setIsBuyLivesOpen(false)} onBuySuccess={handleBuyLivesSuccess} isSeekerVerified={isSeekerVerified} />
      <EditProfileModal 
        isOpen={isEditProfileOpen} 
        onClose={() => setIsEditProfileOpen(false)} 
        currentUsername={profile.username}
        currentAvatar={profile.avatar}
        onSave={handleUpdateProfile}
      />
      <WalletRequiredModal
        isOpen={showWalletRequired}
        onClose={() => setShowWalletRequired(false)}
        onOpenTerms={() => setCurrentView(View.TERMS)}
        onOpenPrivacy={() => setCurrentView(View.PRIVACY)}
      />
      <PwaInstallPrompt />
      {!hasAcceptedTerms && currentView !== View.TERMS && currentView !== View.PRIVACY && (
        <LegalDisclaimerModal
          onAccept={() => {
            try { localStorage.setItem('soltrivia_terms_accepted', 'true'); } catch {}
            setHasAcceptedTerms(true);
          }}
          onOpenTerms={() => setCurrentView(View.TERMS)}
          onOpenPrivacy={() => setCurrentView(View.PRIVACY)}
        />
      )}
    </div>
  );
};

export default App;
