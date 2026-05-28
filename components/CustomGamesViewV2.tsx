/**
 * CustomGamesViewV2 — web W5 (browse). Editorial header + blue CREATE
 * gradient hero + JOIN BY CODE input + OFFICIAL gold strip + filter tabs
 * + 3-col room grid. Mock data for v1.
 */
import React, { useState } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';

interface Props {
  onCreate?: () => void;
  onJoinByCode?: (code: string) => void;
  onView?: (slug: string) => void;
}

type Tab = 'JOIN' | 'MY GAMES' | 'ENDED';

const OFFICIAL_ROOMS = [
  { slug: 'official-degen-ct', name: 'Degen Crypto CT', blurb: 'KOL drama, meme coins, lore', plays: 1247 },
  { slug: 'official-current-events', name: 'Current Events', blurb: 'Biggest crypto + tech news', plays: 892 },
  { slug: 'official-nft-topic', name: 'NFT Topic', blurb: 'Floor moves, mint mechanics', plays: 634 },
  { slug: 'official-sports', name: 'Sports', blurb: 'Broad sports trivia, weekly', plays: 1089 },
];

const JOIN_ROOMS = [
  { slug: 'crypto-101', name: 'Crypto 101 Speedrun', host: '@nftking', entry: 0.05, players: 4, max: 10, cat: 'CRYPTO', expires: '2h LEFT' },
  { slug: 'history-night', name: 'History Night', host: '@anchor_legend', entry: 0.1, players: 6, max: 10, cat: 'HISTORY', expires: '4h LEFT' },
  { slug: 'web3-deep', name: 'Web3 Deep Dive', host: '@trivia_king', entry: 0.25, players: 8, max: 10, cat: 'WEB3', expires: '8h LEFT', hot: true },
  { slug: 'memecoin-trivia', name: 'Memecoin Trivia', host: '@bonkmaxi', entry: 0.05, players: 3, max: 8, cat: 'MEMES', expires: '1D LEFT' },
  { slug: 'sci-tech-blitz', name: 'Sci-Tech Blitz', host: '@seeker_pro', entry: 0.1, players: 5, max: 10, cat: 'SCI-TECH', expires: '6h LEFT' },
  { slug: 'random-mix', name: 'Random Mix Roulette', host: '@phantom_user', entry: 0.02, players: 2, max: 6, cat: 'MIXED', expires: '3D LEFT' },
];

const CustomGamesViewV2: React.FC<Props> = ({ onCreate, onJoinByCode, onView }) => {
  const [tab, setTab] = useState<Tab>('JOIN');
  const [joinCode, setJoinCode] = useState('');
  const isMobile = useIsMobile();

  const handleJoin = () => {
    if (joinCode.trim().length >= 3) {
      onJoinByCode?.(joinCode.trim());
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 11, color: '#38BDF8', letterSpacing: '0.18em' }}
        >
          ● 12 ACTIVE · COMMUNITY HOSTED
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          CUSTOM GAMES
        </h1>
      </div>

      {/* 2-col: CREATE hero + JOIN code */}
      <div
        className="mb-5"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 14 }}
      >
        <button
          onClick={onCreate}
          className="rounded-2xl text-left active:opacity-95"
          style={{
            background: 'linear-gradient(110deg,#38BDF8 0%,#0EA5E9 100%)',
            color: '#000',
            padding: '18px 22px',
            boxShadow: '0 22px 50px -22px rgba(56,189,248,0.6)',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}
          >
            MAKE YOUR OWN ROOM
          </div>
          <div
            className="font-black italic uppercase mt-1"
            style={{ fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em' }}
          >
            CREATE GAME →
          </div>
          <div
            className="font-black italic uppercase mt-2"
            style={{ fontSize: 9, opacity: 0.7, letterSpacing: '0.14em' }}
          >
            0.005 SOL TO HOST · PASS HOLDERS FREE
          </div>
        </button>

        <div
          className="rounded-2xl"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255,49,49,0.27)',
            padding: '14px 16px',
          }}
        >
          <div
            className="font-black italic uppercase mb-2"
            style={{ fontSize: 10, color: '#FF3131', letterSpacing: '0.18em' }}
          >
            JOIN PRIVATE ROOM
          </div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXX-XXX"
              className="flex-1 rounded-lg outline-none"
              style={{
                background: '#000',
                border: '1px solid rgba(255,49,49,0.3)',
                color: '#fff',
                fontFamily: 'JetBrains Mono, Menlo, monospace',
                fontSize: 16,
                letterSpacing: '0.15em',
                padding: '10px 14px',
              }}
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.trim().length < 3}
              className="font-black italic uppercase rounded-lg active:opacity-90"
              style={{
                background: joinCode.trim().length >= 3 ? '#FF3131' : '#0a0a0a',
                color: joinCode.trim().length >= 3 ? '#000' : '#52525b',
                border: joinCode.trim().length < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                padding: '0 18px',
                fontSize: 11,
                letterSpacing: '0.14em',
                cursor: joinCode.trim().length >= 3 ? 'pointer' : 'not-allowed',
              }}
            >
              JOIN
            </button>
          </div>
        </div>
      </div>

      {/* OFFICIAL strip */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase mb-2 flex items-center gap-2"
          style={{ fontSize: 10, color: '#FFD700', letterSpacing: '0.18em' }}
        >
          <span>★</span> OFFICIAL · ALWAYS ON · @SOLTRIVIA_APP
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}
        >
          {OFFICIAL_ROOMS.map((r) => (
            <button
              key={r.slug}
              onClick={() => onView?.(r.slug)}
              className="rounded-xl text-left active:opacity-90"
              style={{
                background: 'rgba(255,215,0,0.06)',
                border: '1.5px solid rgba(255,215,0,0.4)',
                padding: '12px 14px',
                cursor: 'pointer',
                color: '#fff',
              }}
            >
              <div
                className="font-black italic uppercase flex items-center gap-1"
                style={{ fontSize: 8, color: '#FFD700', letterSpacing: '0.18em' }}
              >
                ★ ALWAYS ON
              </div>
              <div
                className="font-black italic uppercase mt-2"
                style={{ fontSize: 14, letterSpacing: '-0.01em' }}
              >
                {r.name}
              </div>
              <div
                style={{ fontSize: 10, color: '#a1a1aa', marginTop: 4, lineHeight: 1.3 }}
              >
                {r.blurb}
              </div>
              <div
                className="font-black italic uppercase mt-3"
                style={{
                  fontSize: 9,
                  color: '#71717a',
                  letterSpacing: '0.14em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.plays.toLocaleString()} PLAYS
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['JOIN', 'MY GAMES', 'ENDED'] as Tab[]).map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="font-black italic uppercase rounded-full active:opacity-90"
              style={{
                background: on ? 'rgba(56,189,248,0.13)' : 'transparent',
                border: `1px solid ${on ? '#38BDF8' : 'rgba(255,255,255,0.1)'}`,
                color: on ? '#38BDF8' : '#a1a1aa',
                padding: '8px 16px',
                fontSize: 11,
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              {id}
            </button>
          );
        })}
      </div>

      {/* 3-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
        {JOIN_ROOMS.map((r) => (
          <div
            key={r.slug}
            className="rounded-xl"
            style={{
              background: '#0a0a0a',
              border: `1.5px solid ${r.hot ? '#FFD700' : 'rgba(56,189,248,0.3)'}`,
              padding: '14px 16px',
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="font-black italic uppercase rounded-full"
                style={{
                  fontSize: 8,
                  color: '#38BDF8',
                  background: 'rgba(56,189,248,0.13)',
                  border: '1px solid rgba(56,189,248,0.4)',
                  padding: '2px 7px',
                  letterSpacing: '0.14em',
                }}
              >
                {r.cat}
              </span>
              {r.hot ? (
                <span
                  className="font-black italic uppercase"
                  style={{ fontSize: 8, color: '#FFD700', letterSpacing: '0.14em' }}
                >
                  HOT 🔥
                </span>
              ) : null}
            </div>
            <div
              className="font-black italic uppercase mt-2 text-white"
              style={{ fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.1 }}
            >
              {r.name}
            </div>
            <div
              className="font-black italic uppercase mt-1"
              style={{
                fontSize: 9,
                color: '#71717a',
                letterSpacing: '0.14em',
              }}
            >
              BY {r.host}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span
                className="font-black italic"
                style={{
                  fontSize: 13,
                  color: '#FFD700',
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.entry} SOL
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: '#71717a',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                · {r.players}/{r.max}
              </span>
              <div className="flex-1" />
              <span
                className="font-black italic uppercase"
                style={{
                  fontSize: 8,
                  color: '#71717a',
                  letterSpacing: '0.14em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {r.expires}
              </span>
            </div>
            <button
              onClick={() => onView?.(r.slug)}
              className="w-full font-black italic uppercase rounded-full mt-3 active:opacity-90"
              style={{
                background: '#38BDF8',
                color: '#000',
                padding: '8px 0',
                fontSize: 11,
                letterSpacing: '0.14em',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              JOIN →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomGamesViewV2;
