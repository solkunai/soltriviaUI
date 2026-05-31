/**
 * GamePassViewV2 — web W7. Editorial header + 2-col (NFT ticket left, perks
 * right) + NERD callout + plan/token selectors + inline purchase.
 *
 * The purchase happens right here on the ticket screen (no old modal): pick
 * Monthly/Annual + token, tap, sign. Tx-build + verify logic mirrors the
 * proven CategorySelectorModal flow.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { VersionedTransaction } from '@solana/web3.js';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { purchaseGamePass, buildGamePassTx } from '../src/utils/api';
import {
  GAME_PASS_USD_PRICING,
  NERD_PAYMENT_DISCOUNT,
  getTokenMint,
  type GamePassPlan,
  type PaymentToken,
} from '../src/utils/constants';
import { fetchTokenPrices, calculateTokenAmount, formatTokenAmount, type TokenPrices } from '../src/utils/tokenPrices';
import { getSplTokenBalance } from '../src/utils/splTransfer';

interface Props {
  hasGamePass?: boolean;
  isSeekerVerified?: boolean;
  onPurchased?: () => void;
}

const TOKEN_CHIPS: PaymentToken[] = ['SOL', 'USDC', 'SKR', 'NERD'];

const PERKS = [
  { t: 'Unlimited daily practice', d: 'No lives used, endless rounds' },
  { t: 'All 7 categories unlocked', d: 'Sports · Web3 · Sci-Tech · etc' },
  { t: '10% off all lives', d: 'Forever, stacks every purchase' },
  { t: '+25% XP every round', d: 'Climb all-time ranks faster' },
  { t: 'Custom game discount', d: 'Create rooms for 0.003 SOL' },
];

const GamePassViewV2: React.FC<Props> = ({ hasGamePass, isSeekerVerified, onPurchased }) => {
  const isMobile = useIsMobile();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [plan, setPlan] = useState<GamePassPlan>('monthly');
  const [token, setToken] = useState<PaymentToken>('SOL');
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [failedTxSignature, setFailedTxSignature] = useState<string | null>(null);

  // Plan price (Seeker tier) then NERD 10% payment discount.
  const tier = isSeekerVerified ? 'seeker' : 'standard';
  const planUsd = GAME_PASS_USD_PRICING[plan][tier];
  let usdPrice: number = planUsd;
  if (token === 'NERD') usdPrice = +(usdPrice * (1 - NERD_PAYMENT_DISCOUNT)).toFixed(2);

  const loadPrices = useCallback(async () => {
    try {
      const p = await fetchTokenPrices();
      setPrices(p);
      if (token === 'NERD' && !p.NERD) setToken('SOL');
    } catch {
      /* keep last */
    }
  }, [token]);

  useEffect(() => {
    if (hasGamePass) return;
    loadPrices();
    const id = setInterval(loadPrices, 15000);
    return () => clearInterval(id);
  }, [hasGamePass, loadPrices]);

  const tokenAmount = prices ? calculateTokenAmount(usdPrice, token, prices) : null;
  const displayAmount = prices && tokenAmount ? `${formatTokenAmount(tokenAmount, token)} ${token}` : '…';

  const handlePurchase = async () => {
    if (!connected || !publicKey || purchasing) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const usdPriceCents = Math.round(usdPrice * 100);
      const tokenMint = getTokenMint(token);

      let signatureToVerify = failedTxSignature;
      if (!signatureToVerify) {
        if (!prices || !tokenAmount) {
          setPurchaseError('Prices still loading. One sec.');
          setPurchasing(false);
          return;
        }

        // SOL native balance pre-check: covers 0.0025 SOL platform fee + tx fee.
        const nativeBalance = await connection.getBalance(publicKey);
        const MIN_NATIVE_LAMPORTS = 5_000_000; // 0.005 SOL
        if (nativeBalance < MIN_NATIVE_LAMPORTS) {
          setPurchaseError('Need at least 0.005 SOL native (covers the 0.0025 SOL platform fee + tx fee)');
          setPurchasing(false);
          return;
        }

        if (token !== 'SOL') {
          const balance = await getSplTokenBalance(connection, publicKey, token);
          if (balance < tokenAmount) {
            setPurchaseError(`Not enough ${token}. You need ${formatTokenAmount(tokenAmount, token)} ${token}.`);
            setPurchasing(false);
            return;
          }
        }

        // Build the multi-token, multi-recipient tx server-side (EF returns base64 v0 tx).
        const builtTx = await buildGamePassTx({
          walletAddress: publicKey.toBase58(),
          plan,
          paymentToken: token,
          token_mint: tokenMint,
          usd_price_cents: usdPriceCents,
        });

        // Deserialize, sign, send
        const txBytes = Uint8Array.from(atob(builtTx.tx_base64), c => c.charCodeAt(0));
        signatureToVerify = await sendTransaction(VersionedTransaction.deserialize(txBytes), connection);
        await Promise.race([
          connection.confirmTransaction(signatureToVerify, 'confirmed'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timeout')), 30000)),
        ]);
      }
      setFailedTxSignature(signatureToVerify);
      // Verify + credit via the existing purchase-game-pass EF (new payload triggers the 2-leg path).
      await purchaseGamePass(
        publicKey.toBase58(),
        signatureToVerify,
        token,
        usdPrice,
        plan,
        { usd_price_cents: usdPriceCents, token_mint: tokenMint },
      );
      setFailedTxSignature(null);
      onPurchased?.();
    } catch (err: any) {
      if (err?.message?.includes('User rejected')) {
        setFailedTxSignature(null);
      } else if (err?.message?.includes('insufficient funds') || err?.message?.includes('Insufficient')) {
        setFailedTxSignature(null);
        setPurchaseError(`Insufficient balance. You need enough ${token} plus SOL for fees.`);
      } else if (failedTxSignature) {
        setPurchaseError('Payment sent but activation failed. Tap Retry, no extra charge.');
      } else {
        setPurchaseError(err?.message || 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}>
          MONTHLY OR ANNUAL · NON-TRANSFERABLE
        </div>
        <h1 className="font-black italic uppercase mt-1 text-white" style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          UNLOCK{' '}
          <span
            style={{
              background: 'linear-gradient(90deg,#14F195 0%,#7C8DFF 50%,#9945FF 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            EVERYTHING
          </span>
        </h1>
      </div>

      {/* 2-col layout */}
      <div className="mb-5" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr', gap: 20 }}>
        {/* NFT ticket hero */}
        <div
          className="relative rounded-2xl flex flex-col"
          style={{
            background: 'linear-gradient(135deg,#14F195 0%,#00FFA3 25%,#7C8DFF 60%,#9945FF 100%)',
            color: '#000',
            padding: '22px 26px',
            boxShadow: '0 30px 60px -22px rgba(153,69,255,0.6), inset 0 0 0 1px rgba(255,255,255,0.18)',
            minHeight: 280,
          }}
        >
          <div style={{ position: 'absolute', left: -10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: '#020202' }} />
          <div style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', background: '#020202' }} />
          <div className="flex justify-between items-center">
            <span className="font-black italic uppercase" style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.18em' }}>
              SOL TRIVIA
            </span>
            <span className="font-black italic uppercase" style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}>
              {hasGamePass ? 'ACTIVE' : 'OFFICIAL'}
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="font-black italic" style={{ fontSize: 52, lineHeight: 0.9, letterSpacing: '-0.02em' }}>
              GAME PASS
            </div>
            <div className="font-black italic uppercase mt-2" style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.18em' }}>
              {plan === 'annual' ? 'ANNUAL' : 'MONTHLY'} · NON-TRANSFERABLE
            </div>
          </div>
          <div className="pt-3 flex items-end justify-between" style={{ borderTop: '1.5px dashed rgba(0,0,0,0.25)' }}>
            <div>
              <div className="font-black italic uppercase" style={{ fontSize: 9, opacity: 0.6, letterSpacing: '0.14em' }}>
                PRICE
              </div>
              <div className="font-black italic mt-1" style={{ fontSize: 32, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
                ${planUsd} <span style={{ fontSize: 13 }}>{plan === 'annual' ? '/YR' : '/MO'}</span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-black italic uppercase block" style={{ fontSize: 11, letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums' }}>
                {plan === 'annual' ? `MONTHLY $${GAME_PASS_USD_PRICING.monthly[tier]}/MO` : `ANNUAL $${GAME_PASS_USD_PRICING.annual[tier]}/YR`}
              </span>
              {!isSeekerVerified && (
                <span className="font-black italic uppercase block mt-0.5" style={{ fontSize: 8, opacity: 0.6, letterSpacing: '0.12em' }}>
                  SEEKER ${GAME_PASS_USD_PRICING.monthly.seeker}/MO · ${GAME_PASS_USD_PRICING.annual.seeker}/YR
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Perks */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid rgba(20,241,149,0.27)' }}>
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em', padding: '14px 18px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            WHAT YOU GET
          </div>
          {PERKS.map((p, i) => (
            <div key={p.t} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div
                className="rounded-md flex items-center justify-center flex-shrink-0"
                style={{ width: 26, height: 26, background: 'rgba(20,241,149,0.12)', border: '1px solid rgba(20,241,149,0.33)', color: '#14F195', fontSize: 13, fontWeight: 900 }}
              >
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black italic uppercase text-white" style={{ fontSize: 11, letterSpacing: '0.12em' }}>
                  {p.t}
                </div>
                <div style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>{p.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seeker discount callout — only when NOT already verified */}
      {!isSeekerVerified && (
        <div className="rounded-xl mb-4 flex items-center gap-4" style={{ background: 'rgba(20,241,149,0.06)', border: '1px solid rgba(20,241,149,0.27)', padding: '14px 18px' }}>
          <img src="/seeker-badge.png" alt="Seeker" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          <div className="flex-1 min-w-0">
            <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}>
              ● SEEKER HOLDERS
            </div>
            <div style={{ fontSize: 12, color: '#d4d4d8', marginTop: 4 }}>
              Verify your Seeker Genesis Token for 35% off Game Pass and lives,{' '}
              <span className="font-black italic uppercase" style={{ color: '#14F195' }}>FOREVER!</span>
            </div>
          </div>
        </div>
      )}

      {!hasGamePass && (
        <>
          {/* Plan selector */}
          <div className="font-black italic uppercase mb-2" style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}>
            PLAN
          </div>
          <div className="flex gap-2 mb-4">
            {(['monthly', 'annual'] as GamePassPlan[]).map((p) => {
              const on = plan === p;
              const price = GAME_PASS_USD_PRICING[p][tier];
              return (
                <button
                  key={p}
                  onClick={() => { setPlan(p); setPurchaseError(null); setFailedTxSignature(null); }}
                  className="flex-1 font-black italic uppercase rounded-full active:opacity-90"
                  style={{
                    background: on ? 'rgba(20,241,149,0.13)' : '#0a0a0a',
                    border: `1px solid ${on ? '#14F195' : 'rgba(255,255,255,0.1)'}`,
                    color: on ? '#14F195' : '#a1a1aa',
                    padding: '12px 0',
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    cursor: 'pointer',
                  }}
                >
                  {p === 'monthly' ? `MONTHLY · $${price}/MO` : `ANNUAL · $${price}/YR`}
                </button>
              );
            })}
          </div>

          {/* Token picker */}
          <div className="font-black italic uppercase mb-2" style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}>
            PAY WITH
          </div>
          <div className="flex gap-2 mb-3">
            {TOKEN_CHIPS.map((t) => {
              const on = token === t;
              const nerdOff = t === 'NERD' && prices != null && !prices.NERD;
              return (
                <button
                  key={t}
                  onClick={() => { if (!nerdOff) { setToken(t); setPurchaseError(null); } }}
                  disabled={purchasing || nerdOff}
                  className="flex-1 font-black italic uppercase rounded-full active:opacity-90 flex items-center justify-center"
                  style={{
                    background: on ? 'rgba(20,241,149,0.13)' : '#0a0a0a',
                    border: `1px solid ${on ? '#14F195' : 'rgba(255,255,255,0.1)'}`,
                    color: on ? '#14F195' : nerdOff ? '#3f3f46' : '#a1a1aa',
                    padding: '10px 0',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    cursor: nerdOff ? 'not-allowed' : 'pointer',
                    gap: 6,
                  }}
                >
                  <img src={`/token-${t.toLowerCase()}.png`} alt={t} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'contain', opacity: nerdOff ? 0.3 : 1 }} />
                  {t}
                </button>
              );
            })}
          </div>

          {purchaseError && (
            <div className="rounded-lg mb-3" style={{ background: 'rgba(255,49,49,0.1)', border: '1px solid rgba(255,49,49,0.3)', padding: '10px 12px' }}>
              <span style={{ fontSize: 11, color: '#FF6B6B' }}>{purchaseError}</span>
            </div>
          )}
        </>
      )}

      {/* CTA — inline purchase */}
      <button
        onClick={hasGamePass ? undefined : handlePurchase}
        disabled={hasGamePass || purchasing || (!failedTxSignature && (!prices || !tokenAmount))}
        className="w-full font-black italic uppercase rounded-xl active:opacity-90"
        style={{
          background: hasGamePass ? '#0a0a0a' : purchasing ? '#0e7a52' : '#14F195',
          color: hasGamePass ? '#71717a' : '#000',
          border: hasGamePass ? '1px solid rgba(255,255,255,0.1)' : 'none',
          padding: '16px 0',
          fontSize: 13,
          letterSpacing: '0.14em',
          cursor: hasGamePass || purchasing ? 'default' : 'pointer',
        }}
      >
        {hasGamePass
          ? 'PASS ACTIVE ✓'
          : purchasing
            ? 'CONFIRM IN WALLET…'
            : failedTxSignature
              ? 'RETRY ACTIVATION →'
              : `UNLOCK ${plan === 'annual' ? 'ANNUAL' : 'MONTHLY'} · ${displayAmount} →`}
      </button>
    </div>
  );
};

export default GamePassViewV2;
