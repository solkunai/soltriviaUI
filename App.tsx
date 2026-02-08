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
import PwaInstallPrompt from './components/PwaInstallPrompt';
import AdminRoute from './components/AdminRoute';
import TermsOfServiceView from './components/TermsOfServiceView';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import { getPlayerLives, startGame, completeSession, registerPlayerProfile, updateQuestProgress, getLeaderboard } from './src/utils/api';
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
  
  // App state for lives
  const [lives, setLives] = useState(1);
  
  // Quiz results state
  const [lastGameResults, setLastGameResults] = useState<{ score: number, points: number, time: number, rank?: number; scoreSaveFailed?: boolean } | null>(null);
  
  // Current game session ID
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Pages that require wallet connection (HOME and ADMIN do NOT require wallet)
  const walletRequiredViews = [View.PLAY, View.QUESTS, View.PROFILE, View.LEADERBOARD, View.QUIZ, View.RESULTS];

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

        // Fetch player lives
        const data = await getPlayerLives(walletAddress);
        setLives(data.lives_count || 0);
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
  }, [connected, publicKey]);

  // Check wallet connection when navigating
  const handleViewChange = (view: View) => {
    // HOME and ADMIN are always accessible
    if (view === View.HOME || view === View.ADMIN) {
      setCurrentView(view);
      return;
    }

    // Check if wallet is required for this view
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

  // Redirect to HOME only when user disconnects (not on initial load – so reload keeps same page)
  const prevConnectedRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = connected;
    if (wasConnected === true && !connected && walletRequiredViews.includes(currentView)) {
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

  const handleUpdateProfile = async (username: string, avatar: string) => {
    if (!publicKey) return;

    // Optimistically update UI
    setProfile({ username, avatar });

    const walletAddress = publicKey.toBase58();

    try {
      // Update in Supabase
      const { error } = await supabase
        .from('player_profiles')
        .update({
          username,
          avatar_url: avatar,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('Failed to update profile:', error);
      } else {
        try {
          await updateQuestProgress(walletAddress, 'identity_sync', 1);
        } catch {
          // ignore quest update failure
        }
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
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
    
    // Check lives before starting
    if (lives <= 0) {
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

      // Store session ID for quiz (and persist so reload on /quiz keeps the game)
      setCurrentSessionId(gameResult.sessionId);
      try {
        sessionStorage.setItem('quiz_session_id', gameResult.sessionId);
      } catch (_) {}

      // Optimistically update UI
      setLives(prev => Math.max(0, prev - 1));
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

      // If no lives, open buy lives modal
      if (err.code === 'ALREADY_PLAYED' || err.message?.includes('Insufficient lives')) {
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
        return connected ? <LeaderboardView onOpenGuide={() => setIsGuideOpen(true)} /> : null;
      case View.PLAY:
        return connected ? <PlayView lives={lives} onStartQuiz={handleStartQuiz} onOpenBuyLives={() => setIsBuyLivesOpen(true)} /> : null;
      case View.QUESTS:
        return connected ? <QuestsView onGoToProfile={() => setCurrentView(View.PROFILE)} onOpenGuide={() => setIsGuideOpen(true)} /> : null;
      case View.PROFILE:
        return connected ? <ProfileView username={profile.username} avatar={profile.avatar} onEdit={() => setIsEditProfileOpen(true)} onOpenGuide={() => setIsGuideOpen(true)} /> : null;
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
      />
      <PwaInstallPrompt />
    </div>
  );
};

export default App;
