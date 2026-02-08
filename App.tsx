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
import WalletRequiredModal from './components/WalletRequiredModal';
import LegalDisclaimerModal from './components/LegalDisclaimerModal';
import WalletConnectButton from './components/WalletConnectButton';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import AdminRoute from './components/AdminRoute';
import TermsOfServiceView from './components/TermsOfServiceView';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import { getPlayerLives, getRoundEntriesUsed, startGame, completeSession, registerPlayerProfile, updateQuestProgress, getLeaderboard } from './src/utils/api';
import { PRIZE_POOL_WALLET, REVENUE_WALLET, ENTRY_FEE_LAMPORTS, TXN_FEE_LAMPORTS, DEFAULT_AVATAR } from './src/utils/constants';

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
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
    try { return localStorage.getItem('soltrivia_terms_accepted') === 'true'; } catch { return false; }
  });
  
  // App state for lives and round entries
  const [lives, setLives] = useState(0);
  const [roundEntriesUsed, setRoundEntriesUsed] = useState(0);
  const ROUND_ENTRIES_MAX = 2;
  
  // Quiz results state
  const [lastGameResults, setLastGameResults] = useState<{ score: number, points: number, time: number, rank?: number; scoreSaveFailed?: boolean } | null>(null);
  
  // Current game session ID
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Only active-game views truly require wallet (quiz in progress, viewing results)
  const walletRequiredViews = [View.QUIZ, View.RESULTS];

  // Fetch lives from Supabase when wallet connects and periodically refresh
  useEffect(() => {
    if (!connected || !publicKey) {
      setLives(0);
      return;
    }

    const fetchLivesAndRegister = async () => {
      try {
        const walletAddress = publicKey.toBase58();

        // Register/update player profile in Supabase
        try {
          await registerPlayerProfile(walletAddress);
        } catch (profileError) {
          // Silent failure - profile registration is not critical
          console.debug('Profile registration skipped:', profileError);
        }

        // Fetch purchased lives (always)
        const livesData = await getPlayerLives(walletAddress);
        setLives(livesData.lives_count || 0);

        // Only fetch round entries from DB when no quiz is active.
        // During a quiz the session has finished_at=NULL so the DB count
        // would be stale and overwrite the correct optimistic +1 from handleStartQuiz.
        if (!currentSessionId) {
          const entriesUsed = await getRoundEntriesUsed(walletAddress);
          setRoundEntriesUsed(entriesUsed);
        }
      } catch (err) {
        console.error('Failed to fetch lives:', err);
        setLives(0);
      }
    };

    // Fetch immediately
    fetchLivesAndRegister();

    // Refresh every 30 seconds to keep in sync
    const interval = setInterval(fetchLivesAndRegister, 30000);

    return () => clearInterval(interval);
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
    const walletAddress = publicKey.toBase58();
    supabase
      .from('player_profiles')
      .select('username, avatar_url')
      .eq('wallet_address', walletAddress)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username != null || data?.avatar_url != null) {
          setProfile({
            username: data.username || 'Solana_Sage',
            avatar: data.avatar_url || DEFAULT_AVATAR,
          });
        }
      })
      .catch(() => {});
  }, [currentView, connected, publicKey]);

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

    // Re-fetch lives and round entries now that the session is finished (finished_at is set)
    // Small delay ensures the DB write from completeSession is fully propagated
    if (publicKey) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const walletAddr = publicKey.toBase58();
        const [livesData, entriesUsed] = await Promise.all([
          getPlayerLives(walletAddr),
          getRoundEntriesUsed(walletAddr),
        ]);
        setLives(livesData.lives_count || 0);
        setRoundEntriesUsed(entriesUsed);
      } catch (_) {
        // Silent — the 30-second poll will catch up
      }
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
    if (roundEntriesLeft <= 0 && lives <= 0) {
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
        .single();

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
      const { count: dailyCount } = await supabase
        .from('game_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('wallet_address', walletAddr)
        .gte('created_at', twentyFourHoursAgo)
        .not('finished_at', 'is', null);

      if ((dailyCount || 0) >= 20) {
        alert('You\'ve reached the maximum 20 entries for today. Please try again tomorrow!');
        return;
      }

      // Get blockhash first for VersionedTransaction
      const { blockhash } = await connection.getLatestBlockhash();

      // Create entry fee transaction with two transfers using VersionedTransaction (V0)
      // This format is better supported by modern wallets like Seed Vault for simulation
      const instructions = [
        // Entry fee to prize pool (0.02 SOL)
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(PRIZE_POOL_WALLET),
          lamports: ENTRY_FEE_LAMPORTS,
        }),
        // Transaction fee to revenue wallet (0.0025 SOL)
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(REVENUE_WALLET),
          lamports: TXN_FEE_LAMPORTS,
        }),
      ];

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);

      // Use sendTransaction which internally uses MWA's signAndSendTransactions
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
        // Free entry — only increment round entries, do NOT touch lives
        setRoundEntriesUsed(prev => prev + 1);
      } else if (!gameResult.resumed) {
        // Paid entry (not a resumed session) — deduct a purchased life
        setLives(prev => Math.max(0, prev - 1));
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

  const handleBuyLivesSuccess = async (newLivesCount?: number) => {
    if (typeof newLivesCount === 'number') {
      // Show the count returned by backend immediately
      setLives(newLivesCount);
    } else {
      // Fallback: optimistic +3
      setLives(prev => prev + 3);
    }
    // Verify against DB after a short delay to catch any persistence issues
    if (connected && publicKey) {
      setTimeout(async () => {
        try {
          const data = await getPlayerLives(publicKey.toBase58());
          setLives(data.lives_count || 0);
        } catch (_) { /* keep the value we already set */ }
      }, 2000);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case View.HOME:
        return (
          <HomeView 
            lives={lives}
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
          />
        );
      case View.LEADERBOARD:
        return <LeaderboardView onOpenGuide={() => setIsGuideOpen(true)} />;
      case View.PLAY:
        return <PlayView lives={lives} roundEntriesUsed={roundEntriesUsed} roundEntriesMax={ROUND_ENTRIES_MAX} onStartQuiz={handleStartQuiz} onOpenBuyLives={() => {
          if (!connected) { setShowWalletRequired(true); } else { setIsBuyLivesOpen(true); }
        }} />;
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
        return <ProfileView username={profile.username} avatar={profile.avatar} onEdit={() => setIsEditProfileOpen(true)} onOpenGuide={() => setIsGuideOpen(true)} />;
      case View.QUIZ:
        return connected ? (
          <QuizView
            sessionId={currentSessionId}
            onFinish={handleQuizFinish}
            onQuit={() => {
              try {
                sessionStorage.removeItem('quiz_session_id');
              } catch (_) {}
              setCurrentSessionId(null);
              setCurrentView(View.PLAY);
            }}
          />
        ) : null;
      case View.RESULTS:
        return connected && lastGameResults ? (
          <ResultsView 
            results={lastGameResults} 
            lives={lives}
            roundEntriesLeft={Math.max(0, ROUND_ENTRIES_MAX - roundEntriesUsed)}
            roundEntriesMax={ROUND_ENTRIES_MAX}
            onRestart={handleStartQuiz} 
            onGoHome={() => setCurrentView(View.HOME)} 
            onBuyLives={() => setIsBuyLivesOpen(true)}
          />
        ) : null;
      case View.TERMS:
        return <TermsOfServiceView onBack={() => setCurrentView(View.HOME)} />;
      case View.PRIVACY:
        return <PrivacyPolicyView onBack={() => setCurrentView(View.HOME)} />;
      case View.ADMIN:
        return <AdminRoute />;
      default:
        return (
          <HomeView 
            lives={lives} 
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
      <BuyLivesModal isOpen={isBuyLivesOpen} onClose={() => setIsBuyLivesOpen(false)} onBuySuccess={handleBuyLivesSuccess} />
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
