/**
 * ReferralsViewV2 — web W6. Wallet/ledger pattern at desktop scale.
 * Title + inline claim + 4-up ledger stats + code block + share link
 * + share-on-X + referrals list + how-it-works.
 */
import React, { useState } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';

const MOCK = {
  code: 'YOU-AB12',
  link: 'soltrivia.app/r/YOU-AB12',
  claimableSol: 0.0421,
  lifetimeSol: 0.137,
  referred: 7,
  active: 4,
  totalXp: 3500,
  recent: [
    { username: '@anchorboi', joinedAt: '2d ago', contributed: 0.012 },
    { username: '@nftking', joinedAt: '5d ago', contributed: 0.03 },
    { username: '@solana_sage', joinedAt: '1w ago', contributed: 0.018 },
  ],
};

const ReferralsViewV2: React.FC = () => {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const isMobile = useIsMobile();
  const claimedSol = MOCK.lifetimeSol - MOCK.claimableSol;
  const canClaim = MOCK.claimableSol > 0;

  const copy = async (text: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'code') {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 1400);
      } else {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 1400);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}
        >
          INVITE FRENS · EARN 5%
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          REFER &{' '}
          <span style={{ color: '#14F195' }}>GET PAID</span>
        </h1>
      </div>

      {/* Inline claim line */}
      <div
        className="flex items-end justify-between mb-5"
        style={{
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div>
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.14em' }}
          >
            CLAIMABLE BALANCE
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="font-black italic text-white"
              style={{
                fontSize: 36,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {MOCK.claimableSol.toFixed(4)}
            </span>
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 12, color: '#71717a', letterSpacing: '0.14em' }}
            >
              SOL
            </span>
          </div>
        </div>
        <button
          disabled={!canClaim}
          className="font-black italic uppercase rounded-lg active:opacity-90"
          style={{
            background: canClaim ? '#14F195' : '#0F0F0F',
            color: canClaim ? '#000' : '#52525b',
            border: canClaim ? 'none' : '1px solid rgba(255,255,255,0.08)',
            padding: '12px 22px',
            fontSize: 12,
            letterSpacing: '0.14em',
            cursor: canClaim ? 'pointer' : 'not-allowed',
          }}
        >
          CLAIM →
        </button>
      </div>

      {/* Ledger stats */}
      <div
        className="rounded-xl mb-5 flex"
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '16px 0',
        }}
      >
        {[
          { label: 'REFERRED', value: String(MOCK.referred), sub: `${MOCK.active} ACTIVE`, color: '#fff' },
          { label: 'XP', value: `${(MOCK.totalXp / 1000).toFixed(1)}K`, sub: 'EARNED', color: '#14F195' },
          { label: 'LIFETIME', value: MOCK.lifetimeSol.toFixed(3), sub: 'SOL TOTAL', color: '#FFD700' },
          { label: 'CLAIMED', value: claimedSol.toFixed(3), sub: 'SOL OUT', color: '#fff' },
        ].map((s, i) => (
          <div
            key={s.label}
            className="flex-1 text-center"
            style={{
              borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              padding: '0 8px',
            }}
          >
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.18em' }}
            >
              {s.label}
            </div>
            <div
              className="font-black italic mt-1"
              style={{
                fontSize: 22,
                color: s.color,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.value}
            </div>
            <div
              className="font-black italic uppercase mt-1"
              style={{ fontSize: 8, color: '#52525b', letterSpacing: '0.18em' }}
            >
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 2-col: code + recent referrals */}
      <div
        className="mb-5"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18 }}
      >
        {/* Code + share */}
        <div className="flex flex-col gap-3">
          <div>
            <div
              className="font-black italic uppercase mb-2"
              style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}
            >
              YOUR CODE
            </div>
            <div className="flex gap-2 items-center">
              <div
                className="flex-1 rounded-lg"
                style={{
                  background: '#000',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '12px 14px',
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                  fontSize: 18,
                  letterSpacing: '0.18em',
                  color: '#fff',
                }}
              >
                <span style={{ color: '#52525b' }}>{'> '}</span>
                {MOCK.code}
              </div>
              <button
                onClick={() => copy(MOCK.code, 'code')}
                className="font-black italic uppercase rounded-lg active:opacity-90"
                style={{
                  background: codeCopied ? 'rgba(20,241,149,0.13)' : '#0F0F0F',
                  border: `1px solid ${codeCopied ? '#14F195' : 'rgba(255,255,255,0.08)'}`,
                  color: codeCopied ? '#14F195' : '#fff',
                  padding: '12px 14px',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                }}
              >
                {codeCopied ? '✓ COPIED' : 'COPY'}
              </button>
            </div>
          </div>
          <div
            className="flex items-center gap-2 rounded-lg"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '10px 12px',
            }}
          >
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 9, color: '#52525b', letterSpacing: '0.14em' }}
            >
              LINK
            </span>
            <span
              className="flex-1 truncate"
              style={{
                fontFamily: 'JetBrains Mono, Menlo, monospace',
                fontSize: 11,
                color: '#a1a1aa',
              }}
            >
              {MOCK.link}
            </span>
            <button
              onClick={() => copy(MOCK.link, 'link')}
              className="font-black italic uppercase active:opacity-70"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#14F195',
                fontSize: 10,
                padding: '2px 6px',
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              {linkCopied ? '✓' : 'COPY'}
            </button>
          </div>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(`playing @SolTrivia_app for real sol prizes\njoin with my code ${MOCK.code} and we both win\n${MOCK.link}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-black italic uppercase rounded-full flex items-center justify-center gap-2 active:opacity-90"
            style={{
              background: '#fff',
              color: '#000',
              padding: '12px 16px',
              fontSize: 11,
              letterSpacing: '0.14em',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                width: 20,
                height: 20,
                background: '#000',
                color: '#fff',
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
              }}
            >
              𝕏
            </span>
            SHARE ON X · INVITE FRENS
          </a>
        </div>

        {/* Recent referrals */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}
            >
              YOUR REFERRALS
            </div>
            <div
              className="font-black italic uppercase"
              style={{
                fontSize: 9,
                color: '#52525b',
                letterSpacing: '0.14em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {MOCK.referred} TOTAL
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {MOCK.recent.map((r) => (
              <div
                key={r.username}
                className="flex items-center gap-3 rounded-lg"
                style={{
                  background: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  padding: '10px 12px',
                }}
              >
                <div
                  className="rounded-md flex items-center justify-center"
                  style={{
                    width: 30,
                    height: 30,
                    background: 'rgba(20,241,149,0.13)',
                    border: '1px solid rgba(20,241,149,0.33)',
                    color: '#14F195',
                    fontWeight: 900,
                    fontSize: 11,
                  }}
                >
                  {r.username[1]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-black italic text-white truncate"
                    style={{ fontSize: 13, letterSpacing: '-0.01em' }}
                  >
                    {r.username}
                  </div>
                  <div
                    className="font-black italic uppercase mt-0.5"
                    style={{
                      fontSize: 9,
                      color: '#71717a',
                      letterSpacing: '0.14em',
                    }}
                  >
                    JOINED {r.joinedAt}
                  </div>
                </div>
                <span
                  className="font-black italic"
                  style={{
                    fontSize: 13,
                    color: '#FFD700',
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  +{r.contributed.toFixed(3)}
                </span>
              </div>
            ))}
            <button
              className="font-black italic uppercase rounded-lg active:opacity-80"
              style={{
                background: '#0a0a0a',
                border: '1px dashed rgba(255,255,255,0.2)',
                color: '#a1a1aa',
                padding: '10px 14px',
                fontSize: 10,
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              SEE ALL {MOCK.referred} →
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div
        className="font-black italic uppercase mb-2"
        style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}
      >
        HOW IT WORKS
      </div>
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {[
          { t: 'Share your link or code', d: 'Anyone can sign up with it' },
          { t: 'They join + play first round', d: 'You get +500 XP per signup' },
          { t: 'They buy a Pass or Lives', d: 'You get 5% of every purchase, forever' },
          { t: 'Claim your SOL anytime', d: 'Sent straight to your wallet' },
        ].map((s, i) => (
          <div
            key={s.t}
            className="flex items-center gap-3 px-5 py-3"
            style={{
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <span
              className="font-black italic"
              style={{
                fontSize: 18,
                color: '#52525b',
                width: 22,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex-1">
              <div
                className="font-black italic uppercase text-white"
                style={{ fontSize: 11, letterSpacing: '0.12em' }}
              >
                {s.t}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                {s.d}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReferralsViewV2;
