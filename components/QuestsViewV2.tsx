/**
 * QuestsViewV2 — web W9. Lives inside WebShell. Editorial header + XP hero
 * + ALL/SOCIAL/ACTIVE tabs + quest rows. Mock data for v1; wire real
 * fetchQuests in follow-up.
 */
import React, { useState } from 'react';

type Tab = 'ALL' | 'SOCIAL' | 'ACTIVE';

type Quest = {
  kind: 'daily' | 'weekly' | 'social';
  title: string;
  desc: string;
  reward: number;
  progress?: number;
  max?: number;
  state: 'CLAIM' | 'GO' | 'START';
  big?: boolean;
  social?: 'x' | 'discord' | 'telegram';
};

const QUESTS: Quest[] = [
  { kind: 'daily', title: 'PLAY 1 ROUND', desc: 'Enter the daily round', reward: 200, progress: 1, max: 1, state: 'CLAIM' },
  { kind: 'daily', title: 'ANSWER 5 CORRECT', desc: 'Across any game type', reward: 300, progress: 3, max: 5, state: 'GO' },
  { kind: 'daily', title: 'WIN A DUEL', desc: 'Beat any opponent 1v1', reward: 500, progress: 0, max: 1, state: 'GO' },
  { kind: 'weekly', title: 'TOP-5 FINISH', desc: 'Place top 5 in any round', reward: 2000, progress: 1, max: 1, state: 'CLAIM', big: true },
  { kind: 'weekly', title: 'STREAK MASTER', desc: 'Hit a 5-day login streak', reward: 1500, progress: 5, max: 5, state: 'CLAIM' },
  { kind: 'weekly', title: 'HOST A CUSTOM', desc: 'Create and finish a room', reward: 1000, progress: 0, max: 1, state: 'GO' },
  { kind: 'weekly', title: '10K POINTS', desc: 'Earn 10,000 XP this week', reward: 1200, progress: 6240, max: 10000, state: 'GO' },
  { kind: 'social', title: 'FOLLOW ON X', desc: 'Follow @soltrivia_app', reward: 250, state: 'START', social: 'x' },
  { kind: 'social', title: 'TRUE RAIDER', desc: 'Post about Sol Trivia', reward: 500, state: 'START', social: 'x' },
  { kind: 'social', title: 'JOIN DISCORD', desc: 'Hop in the server', reward: 300, state: 'START', social: 'discord' },
  { kind: 'social', title: 'JOIN TELEGRAM', desc: 'Join announcements', reward: 300, state: 'START', social: 'telegram' },
];

const KIND_COLOR: Record<Quest['kind'], string> = {
  daily: '#14F195',
  weekly: '#FFD700',
  social: '#a855f7',
};

function SocialBadge({ kind }: { kind: 'x' | 'discord' | 'telegram' }) {
  if (kind === 'x') {
    return (
      <span
        style={{
          width: 18,
          height: 18,
          background: '#fff',
          color: '#000',
          borderRadius: 4,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        𝕏
      </span>
    );
  }
  if (kind === 'discord') {
    return (
      <span
        style={{
          width: 18,
          height: 18,
          background: '#5865F2',
          color: '#fff',
          borderRadius: 4,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 800,
        }}
      >
        𝓓
      </span>
    );
  }
  return (
    <span
      style={{
        width: 18,
        height: 18,
        background: '#26A5E4',
        borderRadius: '50%',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
      }}
    >
      ✈
    </span>
  );
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="font-black italic uppercase rounded-full"
      style={{
        fontSize: 8,
        color,
        background: `${color}22`,
        border: `1px solid ${color}55`,
        padding: '3px 8px',
        letterSpacing: '0.14em',
      }}
    >
      {children}
    </span>
  );
}

const QuestsViewV2: React.FC = () => {
  const [tab, setTab] = useState<Tab>('ALL');

  const filtered = QUESTS.filter((q) => {
    if (tab === 'ALL') return true;
    if (tab === 'SOCIAL') return q.kind === 'social';
    if (tab === 'ACTIVE') return q.state === 'GO' || q.state === 'CLAIM' || q.state === 'START';
    return true;
  });

  const counts = {
    ALL: QUESTS.length,
    SOCIAL: QUESTS.filter((q) => q.kind === 'social').length,
    ACTIVE: QUESTS.filter((q) => q.state === 'GO' || q.state === 'CLAIM' || q.state === 'START').length,
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}
        >
          COMPLETE TO EARN XP
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          QUESTS
        </h1>
      </div>

      {/* XP hero */}
      <div
        className="rounded-2xl mb-4 flex items-center justify-between gap-6"
        style={{
          background: '#0c0c0c',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '18px 22px',
        }}
      >
        <div>
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}
          >
            TOTAL XP EARNED FROM QUESTS
          </div>
          <div
            className="font-black italic mt-1 text-white"
            style={{
              fontSize: 54,
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            8,420
          </div>
        </div>
        <div className="flex gap-6 items-end">
          <div className="text-right">
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}
            >
              DAY STREAK
            </div>
            <div
              className="font-black italic mt-1 text-white"
              style={{ fontSize: 22, letterSpacing: '-0.02em' }}
            >
              🔥 5
            </div>
          </div>
          <div className="text-right">
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}
            >
              READY TO CLAIM
            </div>
            <div
              className="font-black italic mt-1"
              style={{
                fontSize: 22,
                color: '#FFD700',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              +3,700
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['ALL', 'SOCIAL', 'ACTIVE'] as Tab[]).map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="font-black italic uppercase rounded-full active:opacity-90"
              style={{
                background: on ? 'rgba(20,241,149,0.13)' : 'transparent',
                border: `1px solid ${on ? '#14F195' : 'rgba(255,255,255,0.1)'}`,
                color: on ? '#14F195' : '#a1a1aa',
                padding: '8px 16px',
                fontSize: 11,
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              {id}{' '}
              <span style={{ opacity: 0.6, marginLeft: 4 }}>· {counts[id]}</span>
            </button>
          );
        })}
      </div>

      {/* Quest rows */}
      <div className="flex flex-col gap-2">
        {filtered.map((q, i) => {
          const tagColor = KIND_COLOR[q.kind];
          const pct = q.max ? Math.min(100, ((q.progress ?? 0) / q.max) * 100) : 0;
          return (
            <div
              key={i}
              className="rounded-xl flex items-center gap-4"
              style={{
                background: '#0c0c0c',
                border: `1px solid ${q.big ? '#FFD700' : 'rgba(255,255,255,0.08)'}`,
                padding: '14px 16px',
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Tag color={tagColor}>{q.kind.toUpperCase()}</Tag>
                  {q.social ? <SocialBadge kind={q.social} /> : null}
                  {q.big ? <Tag color="#FFD700">BIG REWARD</Tag> : null}
                </div>
                <div
                  className="font-black italic uppercase text-white"
                  style={{ fontSize: 15, lineHeight: 1, letterSpacing: '-0.01em' }}
                >
                  {q.title}
                </div>
                <div
                  className="font-black italic uppercase mt-1"
                  style={{
                    fontSize: 9,
                    color: '#71717a',
                    letterSpacing: '0.14em',
                  }}
                >
                  {q.desc}
                </div>
                {q.max != null ? (
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="flex-1 rounded-full overflow-hidden"
                      style={{ height: 4, background: '#1a1a1a' }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: pct >= 100 ? '#14F195' : tagColor,
                        }}
                      />
                    </div>
                    <span
                      className="font-black italic uppercase"
                      style={{
                        fontSize: 9,
                        color: '#a1a1aa',
                        letterSpacing: '0.14em',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {(q.progress ?? 0).toLocaleString()}/{q.max.toLocaleString()}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="text-right">
                <div
                  className="font-black italic"
                  style={{
                    fontSize: 20,
                    color: '#14F195',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                  }}
                >
                  +{q.reward.toLocaleString()}
                </div>
                <div
                  className="font-black italic uppercase"
                  style={{ fontSize: 8, color: '#71717a', letterSpacing: '0.14em' }}
                >
                  XP
                </div>
              </div>
              <button
                className="font-black italic uppercase rounded-full active:opacity-90"
                style={{
                  background: q.state === 'CLAIM' ? '#14F195' : 'transparent',
                  border: q.state === 'CLAIM' ? 'none' : '1px solid rgba(255,255,255,0.25)',
                  color: q.state === 'CLAIM' ? '#000' : '#fff',
                  padding: '8px 18px',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  minWidth: 80,
                  cursor: 'pointer',
                }}
              >
                {q.state}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuestsViewV2;
