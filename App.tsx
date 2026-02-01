
import React, { useState } from 'react';
import { View } from './types';
import Sidebar from './components/Sidebar';
import HomeView from './components/HomeView';
import LeaderboardView from './components/LeaderboardView';
import QuestsView from './components/QuestsView';
import ProfileView from './components/ProfileView';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);

  const renderContent = () => {
    switch (currentView) {
      case View.HOME:
        return <HomeView onEnterTrivia={() => setCurrentView(View.RANKS)} />;
      case View.RANKS:
        return <LeaderboardView />;
      case View.QUESTS:
        return <QuestsView />;
      case View.PROFILE:
        return <ProfileView />;
      case View.LOGS:
        return <div className="p-10 text-white">Logs view coming soon...</div>;
      default:
        return <HomeView onEnterTrivia={() => {}} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] overflow-hidden">
      {/* Sidebar - Fixed Left */}
      <Sidebar currentView={currentView} setView={setCurrentView} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative grid-bg">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
