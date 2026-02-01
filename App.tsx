
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

  const renderContent = () => {
    switch (currentView) {
      case View.HOME:
        return (
          <HomeView 
            onEnterTrivia={() => setCurrentView(View.PLAY)} 
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenBuyLives={() => setIsBuyLivesOpen(true)}
          />
        );
      case View.LEADERBOARD:
        return <LeaderboardView />;
      case View.PLAY:
        return <PlayView onStartQuiz={() => setCurrentView(View.QUIZ)} onOpenBuyLives={() => setIsBuyLivesOpen(true)} />;
      case View.QUESTS:
        return <QuestsView onGoToProfile={() => setCurrentView(View.PROFILE)} />;
      case View.PROFILE:
        return <ProfileView username={profile.username} avatar={profile.avatar} onEdit={() => setIsEditProfileOpen(true)} />;
      case View.QUIZ:
        return <QuizView onFinish={handleQuizFinish} onQuit={() => setCurrentView(View.PLAY)} />;
      case View.RESULTS:
        return lastGameResults ? (
          <ResultsView 
            results={lastGameResults} 
            onRestart={() => setCurrentView(View.QUIZ)} 
            onGoHome={() => setCurrentView(View.HOME)} 
          />
        ) : null;
      default:
        return <HomeView onEnterTrivia={() => setCurrentView(View.PLAY)} onOpenGuide={() => setIsGuideOpen(true)} onOpenBuyLives={() => setIsBuyLivesOpen(true)} />;
    }
  };

  // Hide sidebar during active quiz for immersion
  const hideSidebar = currentView === View.QUIZ;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050505] overflow-hidden text-white selection:bg-[#00FFA3] selection:text-black">
      {!hideSidebar && <Sidebar currentView={currentView} setView={setCurrentView} />}

      <main className="flex-1 overflow-y-auto relative h-full scroll-smooth">
        {renderContent()}
      </main>

      {currentView !== View.HOME && !hideSidebar && (
        <button 
          onClick={() => setIsGuideOpen(true)}
          className="md:hidden fixed top-6 right-6 z-50 w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-[#00FFA3] backdrop-blur-md shadow-lg"
        >
          <span className="font-black text-lg italic">?</span>
        </button>
      )}

      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <BuyLivesModal isOpen={isBuyLivesOpen} onClose={() => setIsBuyLivesOpen(false)} />
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