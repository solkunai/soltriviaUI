/**
 * LeaderboardViewV2 — web W10. Editorial header + filter tabs + total pool
 * chip + 5-place Olympic podium (5-3-1-2-4) + list for ranks 6+.
 * Mock data for v1.
 */
import React, { useState } from 'react';

type Player = {
  rank: number;
  user: string;
  xp: number;
  sol: number;
  games: number;
  avatar: string;
  col: string;
  badge?: string;
};

const PODIUM: Player[] = [
  { rank: 1, user: '@solana_sage', xp: 48230, sol: 2.418, games: 152, avatar: '#FFC857', col: '#FFD700', badge: '🥇' },
  { rank: 2, user: '@trivia_king', xp: 42100, sol: 1.892, games: 128, avatar: '#FACC15', col: '#a1a1aa', badge: '🥈' },
  { rank: 3, user: '@anchor_legend', xp: 38950, sol: 1.674, games: 118, avatar: '#A78BFA', col: '#fb923c', badge: '🥉' },
  { rank: 4, user: '@seeker_pro', xp: 35780, sol: 1.421, games: 110, avatar: '#22D3EE', col: '#22D3EE' },
  { rank: 5, user: '@phantom_user', xp: 32500, sol: 1.189, games: 98, avatar: '#F472B6', col: '#F472B6' },
];

const LIST_BELOW = [
  { rank: 6, user: '@bonk_hodler', xp: 28910, sol: 0.967, games: 89, avatar: '#fb923c' },
  { rank: 7, user: '@defi_degen', xp: 27420, sol: 0.882, games: 84, avatar: '#22D3EE' },
  { rank: 8, user: '@apemaxi', xp: 24210, sol: 0.612, games: 72, avatar: '#FACC15' },
  { rank: 9, user: '@nftking', xp: 22890, sol: 0.541, games: 68, avatar: '#FFC857' },
  { rank: 10, user: '@degenmaxi', xp: 21340, sol: 0.491, games: 64, avatar: '#F472B6' },
];

const TABS = ['ALL-TIME', 'ROUNDS', 'DUELS', 'CUSTOM', 'THIS WEEK'] as const;

function PodiumColumn({ player }: { player: Player }) {
  const isFirst = player.rank === 1;
  const isTop3 = player.rank <= 3;
  const blockH = player.rank === 1 ? 132 : player.rank === 2 || player.rank === 3 ? 88 : 52;
  return (
    <div className="flex flex-col items-center">
      {/* Player card */}
      <div
        className="w-full text-center relative rounded-xl"
        style={{
          background: '#0c0c0c',
          border: `1.5px solid ${player.col}`,
          padding: '12px 10px',
          marginBottom: 6,
        }}
      >
        {isTop3 ? (
          <div
            style={{
              position: 'absolute',
              top: -12,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 20,
            }}
          >
            {player.badge}
          </div>
        ) : null}
        <div
          className="mx-auto rounded-full"
          style={{
            marginTop: isTop3 ? 10 : 0,
            width: isFirst ? 56 : 44,
            height: isFirst ? 56 : 44,
            background: player.avatar,
            border: `2px solid ${player.col}`,
          }}
        />
        <div
          className="font-black italic uppercase mt-2 truncate"
          style={{ fontSize: 9, color: '#fff', letterSpacing: '0.12em' }}
        >
          {player.user}
        </div>
        <div
          className="font-black italic mt-1"
          style={{
            fontSize: isFirst ? 16 : 13,
            color: '#14F195',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {player.xp.toLocaleString()}
        </div>
        <div
          className="font-black italic uppercase mt-0.5"
          style={{
            fontSize: 8,
            color: '#FFD700',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.14em',
          }}
        >
          {player.sol.toFixed(3)} SOL
        </div>
      </div>
      {/* Block */}
      <div
        className="w-full flex items-start justify-center relative overflow-hidden"
        style={{
          height: blockH,
          background: player.col,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          paddingTop: isFirst ? 12 : 8,
        }}
      >
        <div
          className="absolute left-0 right-0 top-0"
          style={{ height: 3, background: 'rgba(255,255,255,0.35)' }}
        />
        <span
          className="font-black italic"
          style={{
            fontSize: isFirst ? 36 : player.rank === 2 || player.rank === 3 ? 26 : 20,
            color: '#000',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {player.rank}
        </span>
      </div>
    </div>
  );
}

const LeaderboardViewV2: React.FC = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]>('ALL-TIME');

  const podiumOrder = [5, 3, 1, 2, 4];
  const podiumOrdered = podiumOrder
    .map((r) => PODIUM.find((p) => p.rank === r))
    .filter(Boolean) as Player[];

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}
        >
          GLOBAL · WORLDWIDE
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          LEGENDS{' '}
          <span
            style={{
              background: 'linear-gradient(90deg,#14F195 0%,#7C8DFF 50%,#9945FF 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            BOARD
          </span>
        </h1>
      </div>

      {/* Tabs + total pool chip */}
      <div className="flex items-center gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-black italic uppercase rounded-full active:opacity-90"
            style={{
              background: tab === t ? 'rgba(20,241,149,0.13)' : 'transparent',
              border: `1px solid ${tab === t ? '#14F195' : 'rgba(255,255,255,0.1)'}`,
              color: tab === t ? '#14F195' : '#a1a1aa',
              padding: '8px 14px',
              fontSize: 10,
              letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" />
        <span
          className="inline-flex items-center gap-2 rounded-full"
          style={{
            background: '#0c0c0c',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '7px 14px',
          }}
        >
          <span
            className="font-black italic uppercase"
            style={{ fontSize: 9, color: '#FFD700', letterSpacing: '0.14em' }}
          >
            TOTAL POOL
          </span>
          <span
            className="font-black italic text-white"
            style={{
              fontSize: 14,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            12.533 SOL
          </span>
        </span>
      </div>

      {/* Olympic podium */}
      <div
        className="mb-5"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        {podiumOrdered.map((p) => (
          <PodiumColumn key={p.rank} player={p} />
        ))}
      </div>

      {/* Ranks 6+ list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#0c0c0c',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="font-black italic uppercase"
          style={{
            display: 'grid',
            gridTemplateColumns: '30px 36px 1fr 100px 120px 80px',
            gap: 14,
            alignItems: 'center',
            padding: '10px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            fontSize: 9,
            color: '#52525b',
            letterSpacing: '0.18em',
          }}
        >
          <span>#</span>
          <span />
          <span>PLAYER</span>
          <span style={{ textAlign: 'right' }}>XP</span>
          <span style={{ textAlign: 'right' }}>SOL EARNED</span>
          <span style={{ textAlign: 'right' }}>GAMES</span>
        </div>
        {LIST_BELOW.map((r, i) => (
          <div
            key={r.rank}
            style={{
              display: 'grid',
              gridTemplateColumns: '30px 36px 1fr 100px 120px 80px',
              gap: 14,
              alignItems: 'center',
              padding: '12px 18px',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <span
              className="font-black italic"
              style={{
                fontSize: 16,
                color: '#a1a1aa',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              #{r.rank}
            </span>
            <span
              className="rounded-full"
              style={{
                width: 28,
                height: 28,
                background: r.avatar,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
            <span
              className="font-black italic uppercase truncate text-white"
              style={{ fontSize: 13, letterSpacing: '-0.01em' }}
            >
              {r.user}
            </span>
            <span
              className="font-black italic"
              style={{
                fontSize: 14,
                color: '#14F195',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {r.xp.toLocaleString()}
            </span>
            <span
              className="font-black italic"
              style={{
                fontSize: 14,
                color: '#FFD700',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {r.sol.toFixed(3)}
            </span>
            <span
              className="font-black italic"
              style={{
                fontSize: 12,
                color: '#71717a',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {r.games}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeaderboardViewV2;
