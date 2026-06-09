import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchAnnouncements, markAnnouncementRead, markAllAnnouncementsRead, type Announcement } from '../src/utils/api';

interface NotificationBellProps {
  walletAddress: string | null;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ walletAddress }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Every item in state is unread (read items are filtered out at load time
  // and disappear immediately on mark-as-read).
  const unreadCount = announcements.length;

  const loadAnnouncements = useCallback(async () => {
    // Don't show notifications for disconnected wallets — including global
    // announcements. The bell stays visible for UI consistency but the
    // dropdown will show its empty state with a "connect wallet" hint.
    if (!walletAddress) {
      setAnnouncements([]);
      return;
    }
    const data = await fetchAnnouncements(walletAddress);
    // Filter out already-read items at the client so they DISAPPEAR after
    // mark-as-read and don't reappear on the next 60s poll. Server still
    // tracks the read state in `announcement_reads`, so this is sticky
    // across sessions and devices.
    setAnnouncements(data.filter(a => !a.is_read));
  }, [walletAddress]);

  useEffect(() => {
    loadAnnouncements();
    const interval = setInterval(loadAnnouncements, 60000);
    return () => clearInterval(interval);
  }, [loadAnnouncements]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    if (!walletAddress) return;
    await markAnnouncementRead(walletAddress, id);
    // Remove immediately from the dropdown — server has it persisted, so it
    // won't come back on the next poll. Disappears for this user forever.
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const handleMarkAllRead = async () => {
    if (!walletAddress) return;
    const ids = announcements.map(a => a.id);
    if (ids.length === 0) return;
    await markAllAnnouncementsRead(walletAddress, ids);
    setAnnouncements([]);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-95"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] flex items-center justify-center bg-[#FF3131] text-white text-[9px] font-black rounded-full px-1 shadow-lg shadow-red-500/30">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="fixed left-3 right-3 top-[100px] md:absolute md:left-auto md:right-0 md:top-full md:mt-3 md:w-[380px] max-h-[400px] md:max-h-[460px] bg-[#0D0D0D] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-[200]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
            <span className="text-white font-black text-sm uppercase tracking-wider">Notifications</span>
            {unreadCount > 0 && walletAddress && (
              <button onClick={handleMarkAllRead} className="text-[11px] font-bold text-[#10b981] hover:text-[#34d399] transition-colors uppercase tracking-wider">
                Mark all read
              </button>
            )}
          </div>
          {/* List */}
          <div className="overflow-y-auto max-h-[340px] md:max-h-[400px]">
            {renderList()}
          </div>
        </div>
      )}
    </div>
  );

  function renderList() {
    if (announcements.length === 0) {
      const disconnected = !walletAddress;
      return (
        <div className="px-5 py-12 text-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-700 mx-auto mb-3">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-zinc-600 text-sm font-bold">
            {disconnected ? 'Connect your wallet' : 'You\'re all caught up'}
          </p>
          <p className="text-zinc-700 text-xs mt-1">
            {disconnected ? 'Sign in to see updates from Sol Trivia.' : 'New updates will appear here.'}
          </p>
        </div>
      );
    }

    return announcements.map(a => (
      <div key={a.id} className="px-5 py-4 border-b border-white/5 transition-all">
        <div className="flex items-start gap-3">
          {/* Unread dot — all rows are unread now since reads are filtered out. */}
          <div className="pt-1.5 w-3 shrink-0">
            <span className="block w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-lg shadow-emerald-500/30" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-white font-bold text-[13px] leading-tight">{a.title}</span>
            <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">{a.body}</p>
            <div className="flex items-center gap-3 mt-2.5">
              <span className="text-zinc-600 text-[10px] font-bold">{timeAgo(a.created_at)}</span>
              {a.link_url && (
                <a
                  href={a.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-[#38BDF8] hover:text-[#7DD3FC] uppercase tracking-wider"
                >
                  View
                </a>
              )}
              {walletAddress && (
                <button
                  onClick={() => handleMarkRead(a.id)}
                  className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-wider transition-colors"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    ));
  }
};

export default NotificationBell;
