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
const ICON_PATHS = {
  sparkles:
    'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z M20 3v4 M22 5h-4 M4 17v2 M5 18H3',
  trophy:
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22 M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22 M18 2H6v7a6 6 0 0 0 12 0V2Z',
  swords:
    'M14.5 17.5 3 6V3h3l11.5 11.5 M13 19l6-6 M16 16 22 22 M19 13 22 16 M2 22h.01 M5 22h.01 M8 22h.01 M11 22h.01 M14 22h.01 M17 22h.01 M20 22h.01 M3 21l6-6',
  bolt:
    'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  play:
    'M6 3 20 12 6 21V3z',
  crown:
    'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294L11.562 3.266z M5 21h14',
  star:
    'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
  heart:
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
  ticket:
    'M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z M13 5v2 M13 17v2 M13 11v2',
  gear:
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  search:
    'M21 21l-4.34-4.34 M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
} as const;

function Icon({
  name,
  size = 18,
  color = '#a1a1aa',
}: {
  name: keyof typeof ICON_PATHS;
  size?: number;
  color?: string;
}) {
  const path = ICON_PATHS[name];
  // Multi-path icons are space-separated with " M " between paths
  const parts = path.split(' M ').map((p, i) => (i === 0 ? p : `M ${p}`));
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
      {parts.map((d, i) => (
        <path key={i} d={d} />
      ))}
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
}: WebShellProps) {
  const playItems: NavItem[] = [
    { id: 'home', label: 'HOME', view: View.HOME, iconPath: 'sparkles' },
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
      iconPath: 'bolt',
      sub:
        activeCustomGameCount != null
          ? `${activeCustomGameCount} ROOMS`
          : undefined,
    },
    { id: 'play', label: 'FREE PLAY', view: View.PLAY, iconPath: 'play' },
    { id: 'ranks', label: 'RANKS', view: View.LEADERBOARD, iconPath: 'crown' },
    {
      id: 'quests',
      label: 'QUESTS',
      view: View.QUESTS,
      iconPath: 'star',
      sub: questsToClaim && questsToClaim > 0 ? `${questsToClaim} TO CLAIM` : undefined,
    },
    // Referrals lives inside Profile on web for now (no dedicated route yet).
    // When we add View.REFERRALS, swap the line below.
    {
      id: 'referrals',
      label: 'REFERRALS',
      view: View.PROFILE,
      iconPath: 'heart',
    },
  ];

  const accountItems: NavItem[] = [
    { id: 'pass', label: 'GAME PASS', view: View.PROFILE, iconPath: 'ticket' },
    {
      id: 'lives',
      label: 'LIVES',
      view: View.PROFILE,
      iconPath: 'heart',
      sub: lives == null ? '—' : String(lives),
    },
    { id: 'profile', label: 'PROFILE', view: View.PROFILE, iconPath: 'gear' },
  ];

  const isActive = (item: NavItem) => {
    // Active when the current view matches. Several items currently map to
    // View.PROFILE; the sidebar shows the first match as active.
    if (item.id === 'lives' && onBuyLives) return false;
    return activeView === item.view;
  };

  const handleNav = (item: NavItem) => {
    // Lives row opens the BuyLives modal instead of navigating.
    if (item.id === 'lives' && onBuyLives) {
      onBuyLives();
      return;
    }
    onNav(item.view);
  };

  const walletShort = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : null;

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
        {/* Brand */}
        <div className="px-5 pt-6 pb-4">
          <div
            className="font-black italic"
            style={{
              fontSize: 30,
              lineHeight: 0.95,
              display: 'flex',
              alignItems: 'baseline',
              gap: 2,
            }}
          >
            <span style={{ color: '#fff' }}>SOL</span>
            <BrandTrivia size={30} />
          </div>
          <div
            className="font-black italic uppercase mt-2"
            style={{ fontSize: 9, color: '#52525b', letterSpacing: '0.2em' }}
          >
            v0.4 · MAINNET
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
            className="rounded-md inline-flex items-center justify-center font-black"
            style={{
              width: 28,
              height: 28,
              background: '#fff',
              color: '#000',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            𝕏
          </a>
          <a
            href={SOCIAL_LINKS.discord}
            target="_blank"
            rel="noopener noreferrer"
            title="Discord"
            className="rounded-md inline-flex items-center justify-center font-bold"
            style={{
              width: 28,
              height: 28,
              background: '#5865F2',
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            𝓓
          </a>
          <a
            href={SOCIAL_LINKS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            title="Telegram"
            className="rounded-full inline-flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              background: '#26A5E4',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ✈
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
              {walletShort ? `@${walletShort}` : 'CONNECT'}
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
              {walletShort ? walletShort[0].toUpperCase() : '·'}
            </span>
          </span>
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
