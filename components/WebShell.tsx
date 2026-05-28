/**
 * WebShell — sidebar + topbar + main + optional right-rail layout for the
 * desktop redesign (final-handoff 2 W*). Every page on web wraps inside
 * this shell, except the immersive Quiz takeover and any /admin / login
 * pages which keep their full-screen layouts.
 *
 * Source design: final-handoff 2/src/components/stw-shell.jsx.
 *
 * Memory rules respected:
 *   - Lives shown as raw count (`5`, `12`, `0`), no "/5" cap (feedback_lives_display_count_only)
 *   - No em dashes anywhere (feedback_no_em_dashes)
 *   - No pulse animations on dots/badges (feedback_no_pulse_animations)
 */
import React from 'react';
import { View } from '../types';

/**
 * Mobile breakpoint hook. < 768px = phone/PWA layout (bottom tab bar, no
 * sidebar), matching the native dApp's bottom-nav feel. Listens to resize so
 * rotating / resizing updates live.
 */
function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );
  React.useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

type NavItem = {
  id: string;
  label: string;
  view: View;
  iconPath: string;
  sub?: string;
  /** If true, render with the gold ticket "locked" indicator. */
  locked?: boolean;
};

// Lucide-style 24x24 path data. Copied verbatim from the lucide icon set
// so the SVG renders identically across platforms.
// Lucide icon path data. Multi-path icons concat M-paths into a single d
// string (SVG handles multiple M commands in one path correctly).
const ICON_PATHS = {
  home: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  trophy:
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
  swords:
    'M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2',
  'wand-sparkles':
    'm21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72ZM14 7l3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9',
  'gamepad-2':
    'M6 11h4M8 9v4M15 12h.01M18 10h.01M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z',
  crown:
    'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294L11.562 3.266zM5 21h14',
  podium:
    'M9 11h6v11h-6zM2 14h6v8H2zM16 17h6v5h-6zM12 1l1.18 2.39l2.64.38l-1.91 1.86l.45 2.63L12 7.02L9.64 8.26l.45-2.63L8.18 3.77l2.64-.38z',
  target:
    'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M6 12a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  'user-plus':
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M19 8v6M22 11h-6',
  heart:
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
  ticket:
    'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2',
  'user-circle':
    'M18 20a6 6 0 0 0-12 0M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM12 22a10 10 0 1 0 0-20a10 10 0 0 0 0 20z',
  search:
    'M21 21l-4.34-4.34M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
  sparkles:
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0Z',
} as const;

function Icon({
  name,
  size = 18,
  color = '#a1a1aa',
}: {
  name: keyof typeof ICON_PATHS | 'bullseye';
  size?: number;
  color?: string;
}) {
  // PNG-masked icons (so they tint with the sidebar text color)
  if (name === 'bullseye') {
    return (
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          backgroundColor: color,
          WebkitMaskImage: 'url(/bullseye-with-arrow.png)',
          maskImage: 'url(/bullseye-with-arrow.png)',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// Solana-purple to Sol Trivia green gradient for the brand title.
function BrandTrivia({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size * 4}
      height={size * 1.1}
      viewBox={`0 0 ${size * 4} ${size * 1.1}`}
    >
      <defs>
        <linearGradient id="brand-trivia" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#14F195" />
          <stop offset="0.5" stopColor="#7C8DFF" />
          <stop offset="1" stopColor="#9945FF" />
        </linearGradient>
      </defs>
      <text
        fill="url(#brand-trivia)"
        fontSize={size}
        fontWeight={900}
        fontStyle="italic"
        x={0}
        y={size * 0.85}
      >
        TRIVIA
      </text>
    </svg>
  );
}

function NavRow({
  item,
  active,
  onClick,
  accent,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 transition-colors"
      style={{
        background: active ? `${accent}14` : 'transparent',
        borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
        color: active ? '#fff' : '#a1a1aa',
        opacity: item.locked ? 0.4 : 1,
        cursor: item.locked ? 'not-allowed' : 'pointer',
      }}
    >
      <Icon
        name={item.iconPath as keyof typeof ICON_PATHS}
        size={18}
        color={active ? accent : '#71717a'}
      />
      <div className="flex-1 min-w-0">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 11, letterSpacing: '0.14em' }}
        >
          {item.label}
        </div>
        {item.sub ? (
          <div
            className="font-black italic uppercase"
            style={{
              fontSize: 9,
              color: '#52525b',
              marginTop: 2,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.14em',
            }}
          >
            {item.sub}
          </div>
        ) : null}
      </div>
      {item.locked ? (
        <Icon name="ticket" size={11} color="#FFD700" />
      ) : null}
    </button>
  );
}

type WebShellProps = {
  /** Currently active view — drives sidebar highlight. */
  activeView: View;
  /** Called when the user clicks a sidebar item. Pass the destination View enum. */
  onNav: (view: View) => void;
  /** Player lives count. null = not loaded yet (show dash). */
  lives: number | null;
  /** Connected wallet address (base58), or null if not connected. */
  walletAddress?: string | null;
  /** Wallet SOL balance for the sidebar footer. */
  walletBalanceSol?: number | null;
  /** Open the BuyLivesModal. */
  onBuyLives?: () => void;
  /** Counts feeding the sidebar sub-labels. */
  activeDuelCount?: number;
  activeCustomGameCount?: number;
  questsToClaim?: number;
  liveRoundNumber?: number | null;
  /** Page body. */
  children: React.ReactNode;
  /** Optional right rail (Position card, Live Feed, etc.). */
  rightRail?: React.ReactNode;
  /** Brand accent color. Defaults to Sol Trivia green. */
  accent?: string;
  /**
   * Top bar mode:
   *   - 'search' (Custom Games + Duels): big search input across the topbar
   *   - 'simple' (default): FAQ + language toggle + lives + BUY LIVES + avatar
   */
  topbarMode?: 'search' | 'simple';
  /** Opens the FAQ / How to Play modal. */
  onOpenGuide?: () => void;
  /** Fired when a disconnected user clicks the CONNECT pill in the topbar. */
  onConnect?: () => void;
};

const SOCIAL_LINKS = {
  x: 'https://x.com/soltrivia_app',
  discord: 'https://discord.gg/xUUnTMRHcc',
  telegram: 'https://t.me/Sol_Trivia',
};

export function WebShell({
  activeView,
  onNav,
  lives,
  walletAddress,
  walletBalanceSol,
  onBuyLives,
  activeDuelCount,
  activeCustomGameCount,
  questsToClaim,
  liveRoundNumber,
  children,
  rightRail,
  accent = '#14F195',
  topbarMode = 'simple',
  onOpenGuide,
  onConnect,
}: WebShellProps) {
  const playItems: NavItem[] = [
    { id: 'home', label: 'HOME', view: View.HOME, iconPath: 'home' },
    {
      id: 'rounds',
      label: 'DAILY ROUND',
      view: View.COMPETE_LOBBY,
      iconPath: 'trophy',
      sub: liveRoundNumber != null ? `#${liveRoundNumber} · LIVE` : 'LIVE',
    },
    {
      id: 'duels',
      label: 'DUELS',
      view: View.DUEL_LOBBY,
      iconPath: 'swords',
      sub: activeDuelCount != null ? `${activeDuelCount} OPEN` : undefined,
    },
    {
      id: 'custom',
      label: 'CUSTOM GAMES',
      view: View.CUSTOM_GAMES_HUB,
      iconPath: 'wand-sparkles',
      sub:
        activeCustomGameCount != null
          ? `${activeCustomGameCount} ROOMS`
          : undefined,
    },
    { id: 'play', label: 'FREE PLAY', view: View.PLAY, iconPath: 'gamepad-2' },
    { id: 'ranks', label: 'RANKS', view: View.LEADERBOARD, iconPath: 'podium' },
    {
      id: 'quests',
      label: 'QUESTS',
      view: View.QUESTS,
      iconPath: 'bullseye',
      sub: questsToClaim && questsToClaim > 0 ? `${questsToClaim} TO CLAIM` : undefined,
    },
    {
      id: 'referrals',
      label: 'REFERRALS',
      view: View.REFERRALS,
      iconPath: 'user-plus',
    },
    // (keeps user-plus path defined in ICON_PATHS)
  ];

  const accountItems: NavItem[] = [
    { id: 'pass', label: 'GAME PASS', view: View.GAME_PASS, iconPath: 'ticket' },
    {
      id: 'lives',
      label: 'LIVES',
      view: View.LIVES,
      iconPath: 'heart',
      sub: lives == null ? '—' : String(lives),
    },
    { id: 'profile', label: 'PROFILE', view: View.PROFILE, iconPath: 'user-circle' },
  ];

  const isActive = (item: NavItem) => activeView === item.view;

  const handleNav = (item: NavItem) => {
    onNav(item.view);
  };

  const walletShort = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : null;

  const isMobile = useIsMobile();

  // Mobile bottom-tab destinations, mirroring the native dApp's bottom nav
  // (Home · Quests · Play · Leaderboard · Profile). Play is the elevated
  // center action that routes to the Compete hub.
  const bottomNavItems: NavItem[] = [
    { id: 'home', label: 'HOME', view: View.HOME, iconPath: 'home' },
    { id: 'quests', label: 'QUESTS', view: View.QUESTS, iconPath: 'bullseye' },
    { id: 'play', label: 'PLAY', view: View.COMPETE_LOBBY, iconPath: 'swords' },
    { id: 'ranks', label: 'RANKS', view: View.LEADERBOARD, iconPath: 'podium' },
    { id: 'profile', label: 'PROFILE', view: View.PROFILE, iconPath: 'user-circle' },
  ];

  // ─── MOBILE LAYOUT ─── full-width content + fixed bottom tab bar, no sidebar.
  if (isMobile) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: '#020202', color: '#fff' }}
      >
        {/* Slim mobile topbar: brand + lives + connect */}
        <div
          className="sticky top-0 z-20 flex items-center gap-2 px-4 py-2.5"
          style={{
            background: 'rgba(2,2,2,0.9)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={() => onNav(View.HOME)}
            className="flex items-center gap-1.5"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <span
              className="font-black italic"
              style={{ fontSize: 17, lineHeight: 0.95, letterSpacing: '-0.02em' }}
            >
              <span style={{ color: '#fff' }}>SOL </span>
              <span
                style={{
                  background:
                    'linear-gradient(90deg, #14F195 0%, #7C8DFF 50%, #9945FF 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                }}
              >
                TRIVIA
              </span>
            </span>
          </button>
          <div className="flex-1" />
          <span
            className="inline-flex items-center gap-1 rounded-full"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '5px 10px',
            }}
          >
            <Icon name="heart" size={11} color="#FF3131" />
            <span
              className="font-black italic"
              style={{ fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
            >
              {lives == null ? '—' : String(lives)}
            </span>
          </span>
          {walletShort ? (
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: accent,
                color: '#000',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {walletShort[0].toUpperCase()}
            </span>
          ) : (
            <button
              onClick={onConnect}
              className="font-black italic uppercase rounded-full active:opacity-90"
              style={{
                background: accent,
                color: '#000',
                padding: '6px 12px',
                fontSize: 10,
                letterSpacing: '0.1em',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              CONNECT
            </button>
          )}
        </div>

        {/* Full-width page body. Extra bottom padding clears the fixed nav.
            Right rail is intentionally dropped on mobile (supplementary). */}
        <main className="flex-1 min-w-0 px-4 pt-4" style={{ paddingBottom: 84 }}>
          {children}
        </main>

        {/* Fixed bottom tab bar */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
          style={{
            background: 'rgba(5,5,5,0.96)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {bottomNavItems.map((it) => {
            const active = isActive(it);
            const isPlay = it.id === 'play';
            return (
              <button
                key={it.id}
                onClick={() => handleNav(it)}
                className="flex-1 flex flex-col items-center justify-center gap-1"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  paddingTop: 9,
                  paddingBottom: 9,
                }}
              >
                <span
                  className="inline-flex items-center justify-center"
                  style={
                    isPlay
                      ? {
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: accent,
                          marginTop: -18,
                          border: '3px solid #050505',
                        }
                      : undefined
                  }
                >
                  <Icon
                    name={it.iconPath as keyof typeof ICON_PATHS | 'bullseye'}
                    size={isPlay ? 20 : 19}
                    color={isPlay ? '#000' : active ? accent : '#71717a'}
                  />
                </span>
                <span
                  className="font-black italic uppercase"
                  style={{
                    fontSize: 8,
                    letterSpacing: '0.1em',
                    color: active ? accent : '#71717a',
                  }}
                >
                  {it.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#020202', color: '#fff' }}>
      {/* SIDEBAR */}
      <aside
        className="flex-shrink-0 flex flex-col sticky top-0 h-screen overflow-y-auto"
        style={{
          width: 248,
          background: '#050505',
          borderRight: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Brand — SOL TRIVIA wordmark + brain-mascot logo. SOL is white,
            TRIVIA is rendered in the Solana green→purple gradient via
            background-clip: text. Logo (trivia-logo-black.png) sits next
            to the wordmark. */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center justify-center" style={{ gap: 10 }}>
            <span
              className="font-black italic"
              style={{ fontSize: 26, lineHeight: 0.95, letterSpacing: '-0.02em' }}
            >
              <span style={{ color: '#fff' }}>SOL </span>
              <span
                style={{
                  background:
                    'linear-gradient(90deg, #14F195 0%, #7C8DFF 50%, #9945FF 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                }}
              >
                TRIVIA
              </span>
            </span>
            <img
              src="/trivia-logo-black.png"
              alt="Sol Trivia"
              style={{ width: 38, height: 38, objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 pt-2">
          <div
            className="font-black italic uppercase px-4 pt-3 pb-1.5"
            style={{ fontSize: 9, color: '#52525b', letterSpacing: '0.2em' }}
          >
            PLAY
          </div>
          {playItems.map((it) => (
            <NavRow
              key={it.id}
              item={it}
              active={isActive(it)}
              accent={accent}
              onClick={() => handleNav(it)}
            />
          ))}

          <div
            className="font-black italic uppercase px-4 pt-5 pb-1.5"
            style={{ fontSize: 9, color: '#52525b', letterSpacing: '0.2em' }}
          >
            ACCOUNT
          </div>
          {accountItems.map((it) => (
            <NavRow
              key={it.id}
              item={it}
              active={isActive(it)}
              accent={accent}
              onClick={() => handleNav(it)}
            />
          ))}
        </nav>

        {/* Wallet footer */}
        <div
          className="px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 9, color: '#52525b', letterSpacing: '0.2em' }}
          >
            WALLET
          </div>
          {walletShort ? (
            <>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: accent,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono, Menlo, monospace',
                    color: '#fff',
                  }}
                >
                  {walletShort}
                </span>
              </div>
              {walletBalanceSol != null && (
                <div
                  className="font-black italic uppercase mt-1.5"
                  style={{
                    fontSize: 10,
                    color: '#71717a',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.14em',
                  }}
                >
                  <span style={{ color: '#fff' }}>
                    {walletBalanceSol.toFixed(3)}
                  </span>{' '}
                  SOL
                </div>
              )}
            </>
          ) : (
            <div
              className="font-black italic uppercase mt-1.5"
              style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.14em' }}
            >
              NOT CONNECTED
            </div>
          )}
        </div>

        {/* Socials footer */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
        >
          <a
            href={SOCIAL_LINKS.x}
            target="_blank"
            rel="noopener noreferrer"
            title="X"
            className="rounded-md inline-flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#000">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href={SOCIAL_LINKS.discord}
            target="_blank"
            rel="noopener noreferrer"
            title="Discord"
            className="rounded-md inline-flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              background: '#5865F2',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </a>
          <a
            href={SOCIAL_LINKS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            title="Telegram"
            className="inline-flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              cursor: 'pointer',
            }}
          >
            <img
              src="/telegram-logo.png"
              alt="Telegram"
              style={{ width: 26, height: 26, objectFit: 'contain' }}
            />
          </a>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 min-w-0 pb-10">
        {/* Topbar */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-8 py-3"
          style={{
            background: 'rgba(2,2,2,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {topbarMode === 'search' ? (
            <div className="flex-1 relative">
              <input
                placeholder="Search rooms, players, or paste an invite code…"
                className="w-full rounded-lg outline-none"
                style={{
                  background: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: 13,
                  padding: '10px 14px 10px 36px',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <Icon name="search" size={14} color="#52525b" />
              </span>
            </div>
          ) : (
            <div className="flex-1 flex items-center gap-2">
              {onOpenGuide ? (
                <button
                  onClick={onOpenGuide}
                  className="rounded-full font-black italic uppercase active:opacity-90"
                  style={{
                    background: 'rgba(20,241,149,0.13)',
                    border: '1px solid rgba(20,241,149,0.4)',
                    color: '#14F195',
                    padding: '7px 14px',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    cursor: 'pointer',
                  }}
                >
                  ? FAQ
                </button>
              ) : null}
              <button
                className="rounded-full font-black italic uppercase active:opacity-90"
                style={{
                  background: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#a1a1aa',
                  padding: '7px 14px',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                }}
              >
                🌐 EN
              </button>
            </div>
          )}
          <span
            className="inline-flex items-center gap-1.5 rounded-full"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '6px 12px',
            }}
          >
            <Icon name="heart" size={12} color="#FF3131" />
            <span
              className="font-black italic uppercase"
              style={{
                fontSize: 10,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.14em',
              }}
            >
              {lives == null ? '—' : String(lives)}
            </span>
          </span>
          {onBuyLives ? (
            <button
              onClick={onBuyLives}
              className="rounded-full font-black italic uppercase active:opacity-90"
              style={{
                background: accent,
                color: '#000',
                fontSize: 11,
                padding: '8px 14px',
                letterSpacing: '0.14em',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              BUY LIVES
            </button>
          ) : null}
          {walletShort ? (
            <span
              className="inline-flex items-center gap-2 rounded-full"
              style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '5px 12px',
              }}
            >
              <span
                className="font-black italic uppercase"
                style={{
                  fontSize: 10,
                  color: '#a1a1aa',
                  letterSpacing: '0.14em',
                }}
              >
                @{walletShort}
              </span>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: accent,
                  color: '#000',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {walletShort[0].toUpperCase()}
              </span>
            </span>
          ) : (
            <button
              onClick={onConnect}
              className="font-black italic uppercase rounded-full active:opacity-90"
              style={{
                background: accent,
                color: '#000',
                padding: '8px 16px',
                fontSize: 11,
                letterSpacing: '0.14em',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              CONNECT WALLET
            </button>
          )}
        </div>

        {/* Page body */}
        <div className="flex gap-7 px-8 pt-6">
          <div className="flex-1 min-w-0">{children}</div>
          {rightRail ? (
            <aside
              className="flex-shrink-0 sticky self-start"
              style={{ width: 320, top: 80 }}
            >
              {rightRail}
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}
