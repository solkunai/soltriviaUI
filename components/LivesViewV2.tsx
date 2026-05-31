/**
 * LivesViewV2 — web Lives store page. Lives inside WebShell. Three tier
 * cards (STARTER red / VALUE PACK green / GRINDER gold) + sticky bottom
 * CTA. When wallet is NOT connected, viewable; CTA flips to
 * "Connect Wallet to Buy Lives" instead of the price.
 */
import React, { useState, useMemo } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { LIVES_USD_PRICING, NERD_PAYMENT_DISCOUNT } from '@/src/utils/constants';

interface Props {
  livesCount: number | null;
  walletConnected: boolean;
  isSeekerVerified?: boolean;
  onConnect: () => void;
  onBuyTier?: (tierId: 'basic' | 'value' | 'bulk', token: PaymentToken) => void;
}

type TierId = 'basic' | 'value' | 'bulk';
type PaymentToken = 'SOL' | 'USDC' | 'SKR' | 'NERD';
const TOKEN_CHIPS: PaymentToken[] = ['SOL', 'USDC', 'SKR', 'NERD'];

// Static UI metadata (name/badge/color) keyed by tier id. Numeric values (lives + USD)
// flow from LIVES_USD_PRICING so display tracks the locked constants automatically.
const TIER_META: Record<TierId, { name: string; badge: string | null; color: string }> = {
  basic: { name: 'STARTER',    badge: null,         color: '#FF3131' },
  value: { name: 'VALUE PACK', badge: 'POPULAR',    color: '#14F195' },
  bulk:  { name: 'GRINDER',    badge: 'BEST VALUE', color: '#FFD700' },
};

type DisplayTier = {
  id: TierId;
  name: string;
  lives: number;
  usd: number;
  badge: string | null;
  color: string;
};

const LivesViewV2: React.FC<Props> = ({
  livesCount,
  walletConnected,
  isSeekerVerified,
  onConnect,
  onBuyTier,
}) => {
  const [selected, setSelected] = useState<TierId>('value');
  const [token, setToken] = useState<PaymentToken>('SOL');
  const isMobile = useIsMobile();

  // Derive tier list from the locked constants. NERD discount stacks when NERD is selected.
  const tiers: DisplayTier[] = useMemo(() => {
    return (['basic', 'value', 'bulk'] as TierId[]).map((id) => {
      const p = LIVES_USD_PRICING[id];
      let usd: number = isSeekerVerified ? p.seeker : p.standard;
      if (token === 'NERD') {
        usd = +(usd * (1 - NERD_PAYMENT_DISCOUNT)).toFixed(2);
      }
      return { id, ...TIER_META[id], lives: p.lives, usd };
    });
  }, [isSeekerVerified, token]);

  const selectedTier = tiers.find((t) => t.id === selected) ?? tiers[1];

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 10, color: '#FF3131', letterSpacing: '0.18em' }}
        >
          KEEP THE STREAK ALIVE
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          BUY <span style={{ color: '#FF3131' }}>LIVES</span>
        </h1>
        <div
          className="font-black italic uppercase mt-2"
          style={{
            fontSize: 10,
            color: '#a1a1aa',
            letterSpacing: '0.14em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {livesCount == null
            ? '— LIVES IN WALLET'
            : `${livesCount} LIVES IN WALLET`}
          {isSeekerVerified ? ' · SEEKER DISCOUNT APPLIED' : ''}
        </div>
      </div>

      {/* Tier cards: 3-up grid */}
      <div
        className="mb-5"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}
      >
        {tiers.map((tier) => {
          const isSelected = selected === tier.id;
          const costPerLifeUsd = (tier.usd / tier.lives).toFixed(2);
          return (
            <button
              key={tier.id}
              onClick={() => setSelected(tier.id)}
              className="text-left rounded-2xl active:opacity-95"
              style={{
                background: isSelected ? `${tier.color}14` : '#0a0a0a',
                border: `1.5px solid ${isSelected ? tier.color : `${tier.color}55`}`,
                padding: '20px 22px',
                cursor: 'pointer',
                color: '#fff',
                position: 'relative',
              }}
            >
              {tier.badge ? (
                <span
                  className="font-black italic uppercase rounded-full"
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: 14,
                    fontSize: 8,
                    color: tier.color,
                    background: `${tier.color}22`,
                    border: `1px solid ${tier.color}55`,
                    padding: '3px 8px',
                    letterSpacing: '0.14em',
                  }}
                >
                  {tier.badge}
                </span>
              ) : null}
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full"
                  style={{
                    width: 18,
                    height: 18,
                    border: `2px solid ${isSelected ? tier.color : 'rgba(255,255,255,0.2)'}`,
                    background: isSelected ? tier.color : 'transparent',
                  }}
                />
                <span
                  className="font-black italic uppercase"
                  style={{
                    fontSize: 11,
                    color: tier.color,
                    letterSpacing: '0.14em',
                  }}
                >
                  {tier.name}
                </span>
              </div>
              <div
                className="font-black italic mt-3"
                style={{
                  fontSize: 36,
                  color: tier.color,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {tier.lives} <span style={{ fontSize: 14 }}>LIVES</span>
              </div>
              <div
                className="font-black italic uppercase mt-2"
                style={{
                  fontSize: 9,
                  color: '#71717a',
                  letterSpacing: '0.14em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${costPerLifeUsd} EACH · ${tier.usd} USD
              </div>
              <div className="flex items-baseline justify-between mt-4">
                <span
                  className="font-black italic"
                  style={{
                    fontSize: 24,
                    color: tier.color,
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${tier.usd}
                </span>
                <span
                  className="font-black italic uppercase"
                  style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.14em' }}
                >
                  USD
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Seeker discount callout — only when NOT already verified */}
      {!isSeekerVerified && (
        <div
          className="rounded-xl mb-4 flex items-center gap-4"
          style={{
            background: 'rgba(20,241,149,0.06)',
            border: '1px solid rgba(20,241,149,0.27)',
            padding: '14px 18px',
          }}
        >
          <img
            src="/seeker-badge.png"
            alt="Seeker"
            style={{ width: 28, height: 28, objectFit: 'contain' }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}
            >
              ● SEEKER HOLDERS
            </div>
            <div style={{ fontSize: 12, color: '#d4d4d8', marginTop: 4 }}>
              Verify your Seeker Genesis Token for 35% off Game Pass and lives,{' '}
              <span className="font-black italic uppercase" style={{ color: '#14F195' }}>FOREVER!</span>
            </div>
          </div>
        </div>
      )}

      {/* Token picker — PAY WITH SOL/USDC/SKR/NERD */}
      <div className="mb-4">
        <div
          className="font-black italic uppercase mb-2"
          style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}
        >
          PAY WITH
        </div>
        <div className="flex gap-2">
          {TOKEN_CHIPS.map((t) => {
            const on = token === t;
            return (
              <button
                key={t}
                onClick={() => setToken(t)}
                className="flex-1 font-black italic uppercase rounded-full active:opacity-90 flex items-center justify-center"
                style={{
                  background: on ? `${selectedTier.color}22` : '#0a0a0a',
                  border: `1px solid ${on ? selectedTier.color : 'rgba(255,255,255,0.1)'}`,
                  color: on ? selectedTier.color : '#a1a1aa',
                  padding: '10px 0',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  cursor: 'pointer',
                  gap: 6,
                }}
              >
                <img
                  src={`/token-${t.toLowerCase()}.png`}
                  alt={t}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    objectFit: 'contain',
                  }}
                />
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div
        className="sticky"
        style={{
          bottom: 20,
          background: 'rgba(2,2,2,0.85)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${walletConnected ? `${selectedTier.color}55` : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 14,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div className="flex-1">
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.14em' }}
          >
            {walletConnected ? 'TOTAL COST' : 'WALLET REQUIRED'}
          </div>
          <div
            className="font-black italic mt-1"
            style={{
              fontSize: 22,
              color: '#fff',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {walletConnected ? `$${selectedTier.usd} ` : '— '}
            <span style={{ fontSize: 11, color: '#71717a' }}>USD</span>
            <span style={{ fontSize: 10, color: '#71717a', marginLeft: 8 }}>
              + 0.0025 SOL PLATFORM FEE
            </span>
          </div>
        </div>
        {walletConnected ? (
          <button
            onClick={() => onBuyTier?.(selectedTier.id, token)}
            className="font-black italic uppercase rounded-full active:opacity-90"
            style={{
              background: selectedTier.color,
              color: '#000',
              padding: '14px 28px',
              fontSize: 13,
              letterSpacing: '0.14em',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            BUY {selectedTier.lives} LIVES · {token} →
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="font-black italic uppercase rounded-full active:opacity-90"
            style={{
              background: '#14F195',
              color: '#000',
              padding: '14px 28px',
              fontSize: 13,
              letterSpacing: '0.14em',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            CONNECT WALLET TO BUY LIVES →
          </button>
        )}
      </div>
    </div>
  );
};

export default LivesViewV2;
