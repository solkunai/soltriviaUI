
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

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isBuyLivesOpen, setIsBuyLivesOpen] = useState(false);

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
      case View.RANKS:
        return <LeaderboardView />;
      case View.PLAY:
        return <PlayView onOpenBuyLives={() => setIsBuyLivesOpen(true)} />;
      case View.QUESTS:
        return <QuestsView />;
      case View.PROFILE:
        return <ProfileView />;
      default:
        return (
          <HomeView 
            onEnterTrivia={() => setCurrentView(View.PLAY)} 
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenBuyLives={() => setIsBuyLivesOpen(true)}
          />
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050505] overflow-hidden text-white selection:bg-[#00FFA3] selection:text-black">
      {/* Sidebar - Desktop (Left) / Bottom Nav - Mobile */}
      <Sidebar currentView={currentView} setView={setCurrentView} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative h-full scroll-smooth">
        {renderContent()}
      </main>

      {/* Global Mobile Help Button - Shown on pages after homepage */}
      {currentView !== View.HOME && (
        <button 
          onClick={() => setIsGuideOpen(true)}
          className="md:hidden fixed top-6 right-6 z-50 w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-[#00FFA3] backdrop-blur-md shadow-lg"
        >
          <span className="font-black text-lg italic">?</span>
        </button>
      )}

      {/* Instructional Modal */}
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {/* Buy Lives Modal */}
      <BuyLivesModal isOpen={isBuyLivesOpen} onClose={() => setIsBuyLivesOpen(false)} />
    </div>
  );
};

export default App;
