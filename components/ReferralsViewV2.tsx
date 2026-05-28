/**
 * ReferralsViewV2 — web W6. Title + XP-earned hero + ledger stats + code block
 * + share link + share-on-X + referrals list + how-it-works.
 *
 * Real data via getReferralStats. Referrals reward XP today; the 5% Lives /
 * 10% Pass SOL commission is claim-based and unlocks with the on-chain upgrade,
 * so it's shown as a "SOON" state rather than a fake claimable balance.
 */
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { useWallet } from '../src/contexts/WalletContext';
import { getReferralStats, type ReferralStatsResponse } from '../src/utils/api';

function shortWallet(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}
function relativeAgo(iso: string | null): string {
  if (!iso) return '';
  const delta = Date.now() - new Date(iso).getTime();
  const m = Math.floor(delta / 60000);
  if (m < 1) return 'JUST NOW';
  if (m < 60) return `${m}M AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}D AGO`;
  return `${Math.floor(d / 7)}W AGO`;
}

const ReferralsViewV2: React.FC = () => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const isMobile = useIsMobile();

  const [stats, setStats] = useState<ReferralStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getReferralStats(walletAddress)
      .then((r) => {
        if (!cancelled) setStats(r);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const code = stats?.code ?? '';
  const link = stats?.referral_url ?? '';
  const referred = stats?.total_referrals ?? 0;
  const completed = stats?.completed_referrals ?? 0;
  const pending = stats?.pending_referrals ?? 0;
  const totalXp = stats?.referral_points ?? 0;
  const recent = stats?.recent_referrals ?? [];

  const copy = async (text: string, which: 'code' | 'link') => {
    if (!text) return;
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

  // No wallet → prompt connect.
  if (!walletAddress) {
    return (
      <div className="max-w-5xl">
        <div className="mb-5">
          <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}>
            INVITE FRENS · EARN XP
          </div>
          <h1 className="font-black italic uppercase mt-1 text-white" style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
            REFER & <span style={{ color: '#14F195' }}>GET PAID</span>
          </h1>
        </div>
        <div
          className="rounded-xl flex flex-col items-center justify-center gap-2"
          style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.08)', height: 240 }}
        >
          <span className="font-black italic uppercase text-white" style={{ fontSize: 16 }}>
            CONNECT TO GET YOUR CODE
          </span>
          <span className="font-black italic uppercase" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.14em' }}>
            EARN XP FOR EVERY FREN YOU BRING
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}>
          INVITE FRENS · EARN XP
        </div>
        <h1 className="font-black italic uppercase mt-1 text-white" style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          REFER & <span style={{ color: '#14F195' }}>GET PAID</span>
        </h1>
      </div>

      {/* Hero: XP earned + SOL commission (soon) */}
      <div className="flex items-end justify-between mb-5" style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.14em' }}>
            REFERRAL XP EARNED
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="font-black italic"
              style={{ fontSize: 36, color: '#14F195', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
            >
              +{loading ? '—' : totalXp.toLocaleString()}
            </span>
            <span className="font-black italic uppercase" style={{ fontSize: 12, color: '#71717a', letterSpacing: '0.14em' }}>
              XP
            </span>
          </div>
        </div>
        <div
          className="text-right rounded-lg"
          style={{ background: '#0F0F0F', border: '1px solid rgba(255,215,0,0.25)', padding: '10px 16px' }}
        >
          <div className="font-black italic uppercase" style={{ fontSize: 9, color: '#FFD700', letterSpacing: '0.14em' }}>
            SOL COMMISSION
          </div>
          <div className="font-black italic uppercase mt-1" style={{ fontSize: 14, color: '#fff', letterSpacing: '0.06em' }}>
            5% LIVES · 10% PASS
          </div>
          <div className="font-black italic uppercase mt-1" style={{ fontSize: 8, color: '#71717a', letterSpacing: '0.18em' }}>
            UNLOCKS WITH ON-CHAIN UPGRADE
          </div>
        </div>
      </div>

      {/* Ledger stats */}
      <div className="rounded-xl mb-5 flex" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', padding: '16px 0' }}>
        {[
          { label: 'REFERRED', value: String(referred), sub: 'TOTAL', color: '#fff' },
          { label: 'COMPLETED', value: String(completed), sub: 'PLAYED', color: '#14F195' },
          { label: 'PENDING', value: String(pending), sub: 'NOT YET', color: '#FFD700' },
          { label: 'XP', value: totalXp >= 1000 ? `${(totalXp / 1000).toFixed(1)}K` : String(totalXp), sub: 'EARNED', color: '#fff' },
        ].map((s, i) => (
          <div key={s.label} className="flex-1 text-center" style={{ borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none', padding: '0 8px' }}>
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.18em' }}>
              {s.label}
            </div>
            <div className="font-black italic mt-1" style={{ fontSize: 22, color: s.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {loading ? '—' : s.value}
            </div>
            <div className="font-black italic uppercase mt-1" style={{ fontSize: 8, color: '#52525b', letterSpacing: '0.18em' }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 2-col: code + recent referrals */}
      <div className="mb-5" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 18 }}>
        {/* Code + share */}
        <div className="flex flex-col gap-3">
          <div>
            <div className="font-black italic uppercase mb-2" style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}>
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
                {code || '········'}
              </div>
              <button
                onClick={() => copy(code, 'code')}
                disabled={!code}
                className="font-black italic uppercase rounded-lg active:opacity-90"
                style={{
                  background: codeCopied ? 'rgba(20,241,149,0.13)' : '#0F0F0F',
                  border: `1px solid ${codeCopied ? '#14F195' : 'rgba(255,255,255,0.08)'}`,
                  color: codeCopied ? '#14F195' : '#fff',
                  padding: '12px 14px',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  cursor: code ? 'pointer' : 'not-allowed',
                }}
              >
                {codeCopied ? '✓ COPIED' : 'COPY'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 12px' }}>
            <span className="font-black italic uppercase" style={{ fontSize: 9, color: '#52525b', letterSpacing: '0.14em' }}>
              LINK
            </span>
            <span className="flex-1 truncate" style={{ fontFamily: 'JetBrains Mono, Menlo, monospace', fontSize: 11, color: '#a1a1aa' }}>
              {link || '—'}
            </span>
            <button
              onClick={() => copy(link, 'link')}
              disabled={!link}
              className="font-black italic uppercase active:opacity-70"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#14F195',
                fontSize: 10,
                padding: '2px 6px',
                letterSpacing: '0.14em',
                cursor: link ? 'pointer' : 'not-allowed',
              }}
            >
              {linkCopied ? '✓' : 'COPY'}
            </button>
          </div>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(`playing @SolTrivia_app for real sol prizes\njoin with my code ${code} and we both win\n${link}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-black italic uppercase rounded-full flex items-center justify-center gap-2 active:opacity-90"
            style={{ background: '#fff', color: '#000', padding: '12px 16px', fontSize: 11, letterSpacing: '0.14em', cursor: 'pointer', textDecoration: 'none' }}
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
            <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}>
              YOUR REFERRALS
            </div>
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: '#52525b', letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}>
              {referred} TOTAL
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {loading ? (
              <div className="rounded-lg flex items-center justify-center" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', height: 120 }}>
                <span className="font-black italic uppercase" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.14em' }}>
                  LOADING…
                </span>
              </div>
            ) : recent.length === 0 ? (
              <div className="rounded-lg flex flex-col items-center justify-center gap-1" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', height: 120 }}>
                <span className="font-black italic uppercase text-white" style={{ fontSize: 12 }}>
                  NO REFERRALS YET
                </span>
                <span className="font-black italic uppercase" style={{ fontSize: 9, color: '#52525b', letterSpacing: '0.14em' }}>
                  SHARE YOUR CODE TO START
                </span>
              </div>
            ) : (
              recent.map((r) => {
                const isDone = r.status === 'completed';
                return (
                  <div
                    key={r.referred_wallet + r.referred_at}
                    className="flex items-center gap-3 rounded-lg"
                    style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px' }}
                  >
                    <div
                      className="rounded-md flex items-center justify-center"
                      style={{
                        width: 30,
                        height: 30,
                        background: isDone ? 'rgba(20,241,149,0.13)' : 'rgba(255,215,0,0.10)',
                        border: `1px solid ${isDone ? 'rgba(20,241,149,0.33)' : 'rgba(255,215,0,0.3)'}`,
                        color: isDone ? '#14F195' : '#FFD700',
                        fontWeight: 900,
                        fontSize: 11,
                      }}
                    >
                      {r.referred_wallet.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black italic text-white truncate" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
                        {shortWallet(r.referred_wallet)}
                      </div>
                      <div className="font-black italic uppercase mt-0.5" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}>
                        {isDone ? 'PLAYED' : 'PENDING'} · {relativeAgo(r.referred_at)}
                      </div>
                    </div>
                    <span
                      className="font-black italic"
                      style={{ fontSize: 13, color: isDone ? '#14F195' : '#52525b', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
                    >
                      +{(r.points_awarded ?? 0).toLocaleString()} XP
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="font-black italic uppercase mb-2" style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}>
        HOW IT WORKS
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { t: 'Share your link or code', d: 'Anyone can sign up with it' },
          { t: 'They join + play first round', d: 'You earn XP for every fren who plays' },
          { t: 'They buy a Pass or Lives', d: '5% on Lives, 10% on Pass — soon, on-chain' },
          { t: 'Claim your SOL anytime', d: 'Lands with the contract upgrade' },
        ].map((s, i) => (
          <div key={s.t} className="flex items-center gap-3 px-5 py-3" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span
              className="font-black italic"
              style={{ fontSize: 18, color: '#52525b', width: 22, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex-1">
              <div className="font-black italic uppercase text-white" style={{ fontSize: 11, letterSpacing: '0.12em' }}>
                {s.t}
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReferralsViewV2;
