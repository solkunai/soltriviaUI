import React, { useState } from 'react';
import { View } from './types';
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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isBuyLivesOpen, setIsBuyLivesOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  
  // App state for lives
  const [lives, setLives] = useState(1);
  
  // Quiz results state
  const [lastGameResults, setLastGameResults] = useState<{ score: number, points: number, time: number } | null>(null);

  // Mock global state for profile
  const [profile, setProfile] = useState({
    username: 'Solana_Sage',
    avatar: 'https://picsum.photos/id/237/400/400?grayscale'
  });

  const handleUpdateProfile = (username: string, avatar: string) => {
    setProfile({ username, avatar });
  };

  const handleQuizFinish = (score: number, points: number, totalTime: number) => {
    setLastGameResults({ score, points, time: totalTime });
    setCurrentView(View.RESULTS);
  };

  const handleStartQuiz = () => {
    if (lives > 0) {
      setLives(prev => prev - 1);
      setCurrentView(View.QUIZ);
    } else {
      setIsBuyLivesOpen(true);
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case View.HOME:
        return (
          <HomeView 
            lives={lives}
            onEnterTrivia={() => setCurrentView(View.PLAY)} 
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenBuyLives={() => setIsBuyLivesOpen(true)}
          />
        );
      case View.LEADERBOARD:
        return <LeaderboardView onOpenGuide={() => setIsGuideOpen(true)} />;
      case View.PLAY:
        return <PlayView lives={lives} onStartQuiz={handleStartQuiz} onOpenBuyLives={() => setIsBuyLivesOpen(true)} />;
      case View.QUESTS:
        return <QuestsView onGoToProfile={() => setCurrentView(View.PROFILE)} onOpenGuide={() => setIsGuideOpen(true)} />;
      case View.PROFILE:
        return <ProfileView username={profile.username} avatar={profile.avatar} onEdit={() => setIsEditProfileOpen(true)} onOpenGuide={() => setIsGuideOpen(true)} />;
      case View.QUIZ:
        return <QuizView onFinish={handleQuizFinish} onQuit={() => setCurrentView(View.PLAY)} />;
      case View.RESULTS:
        return lastGameResults ? (
          <ResultsView 
            results={lastGameResults} 
            lives={lives}
            onRestart={handleStartQuiz} 
            onGoHome={() => setCurrentView(View.HOME)} 
            onBuyLives={() => setIsBuyLivesOpen(true)}
          />
        ) : null;
      default:
        return <HomeView lives={lives} onEnterTrivia={() => setCurrentView(View.PLAY)} onOpenGuide={() => setIsGuideOpen(true)} onOpenBuyLives={() => setIsBuyLivesOpen(true)} />;
    }
  };

  // Hide sidebar during active quiz for immersion
  const hideSidebar = currentView === View.QUIZ;

  // Optimized help button logic to avoid duplication on views with built-in headers
  const viewsWithBuiltInHeader = [View.LEADERBOARD, View.PROFILE, View.QUESTS];
  const showMobileHelpButton = currentView !== View.HOME && !hideSidebar && !viewsWithBuiltInHeader.includes(currentView);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050505] overflow-hidden text-white selection:bg-[#00FFA3] selection:text-black">
      {!hideSidebar && <Sidebar currentView={currentView} setView={setCurrentView} />}

      <main className="flex-1 overflow-y-auto relative h-full scroll-smooth">
        {renderContent()}
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

      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <BuyLivesModal isOpen={isBuyLivesOpen} onClose={() => setIsBuyLivesOpen(false)} onBuySuccess={() => setLives(prev => prev + 3)} />
      <EditProfileModal 
        isOpen={isEditProfileOpen} 
        onClose={() => setIsEditProfileOpen(false)} 
        currentUsername={profile.username}
        currentAvatar={profile.avatar}
        onSave={handleUpdateProfile}
      />
    </div>
  );
};

export default App;
