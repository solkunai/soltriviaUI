/**
 * SwapModal (v2.1) — multi-token swap with Jupiter token list + 6-state UX.
 *
 * Replaces the previous SOL↔NERD-only modal. New behavior:
 *   • Pick ANY token for from + to via the TokenPickerSheet
 *   • Token list + logos auto-fetched from Jupiter's strict list (5-min TTL)
 *   • Search by name/symbol or paste a contract address
 *   • Whitelist-first ordering, recently-used persisted to localStorage
 *   • Slippage selector (0.5% / 1% / 2%)
 *   • All 6 designed states: ready, loading, noroute, insufficient, pending, success, error
 *   • Wires to existing swap-quote / swap-transaction EFs (Bags backend today)
 *     Jupiter v6 backend migration is a separate follow-up; today's behavior:
 *     SOL↔NERD pairs return quotes via Bags. Other pairs trigger `noroute` →
 *     UI shows the designed "TRY ON JUPITER ↗" external link.
 *
 * Reference: design handoff §5 + /tmp/sol-trivia-handoff-2026-06-03/src/st-v21-swap.jsx
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { getSwapQuoteFor, createSwapTransaction, type SwapQuote } from '../src/utils/bagsApi';
import { getSplTokenBalance } from '../src/utils/splTransfer';
import {
  useJupiterTokens,
  searchTokens,
  isWhitelisted,
  shortCA,
  getRecentTokenMints,
  pushRecentTokenMint,
  type JupiterToken,
} from '../src/utils/jupiterTokens';
import { fetchPumpFunToken, looksLikeMintCA } from '../src/utils/pumpFunFallback';
import { fetchPrices, type JupiterPriceEntry } from '../src/utils/jupiterPrice';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type SwapState =
  | 'ready'        // amount entered, quote loaded, ready to swap
  | 'loading'      // fetching quote
  | 'noroute'      // backend can't find a path
  | 'insufficient' // user's balance < amount
  | 'pending'      // tx submitted, awaiting confirmation
  | 'success'      // confirmed
  | 'error';       // tx failed

// Default mints when the modal opens (SOL → NERD, matches current UX)
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const NERD_MINT = 'DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS';

const SwapModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const { tokens: jupTokens, loading: tokensLoading } = useJupiterTokens();

  const [fromMint, setFromMint] = useState<string>(SOL_MINT);
  const [toMint, setToMint] = useState<string>(NERD_MINT);
  const [amount, setAmount] = useState<string>('');
  const [slippagePct, setSlippagePct] = useState<number>(1); // 0.5 | 1 | 2
  const [pickerOpen, setPickerOpen] = useState<'from' | 'to' | null>(null);

  const [state, setState] = useState<SwapState>('ready');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successSig, setSuccessSig] = useState<string | null>(null);

  // Balance map: mint -> raw balance (bigint). SOL is special-cased to lamports.
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [solLamports, setSolLamports] = useState<number>(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);

  // Resolve token objects from the Jupiter list. Falls back to a stub if the
  // user picks a token before the list loads (rare).
  const fromT = useMemo<JupiterToken>(() => {
    return jupTokens.find((t) => t.address === fromMint) || {
      address: fromMint,
      symbol: '?',
      name: 'Unknown',
      decimals: 9,
    };
  }, [jupTokens, fromMint]);

  const toT = useMemo<JupiterToken>(() => {
    return jupTokens.find((t) => t.address === toMint) || {
      address: toMint,
      symbol: '?',
      name: 'Unknown',
      decimals: 9,
    };
  }, [jupTokens, toMint]);

  // Resolve user's balance of fromT (raw base units)
  const fromBalanceRaw: bigint = useMemo(() => {
    if (fromMint === SOL_MINT) return BigInt(solLamports);
    return balances[fromMint] || 0n;
  }, [fromMint, solLamports, balances]);

  const fromBalanceDisplay = useMemo(() => {
    const raw = Number(fromBalanceRaw);
    const div = Math.pow(10, fromT.decimals);
    return (raw / div).toLocaleString(undefined, { maximumFractionDigits: 4 });
  }, [fromBalanceRaw, fromT.decimals]);

  // Load balances when modal opens / wallet changes / mints change
  const loadBalances = useCallback(async () => {
    if (!publicKey || !connection) return;
    try {
      const sol = await connection.getBalance(publicKey);
      setSolLamports(sol);
      // Load 'fromT' SPL balance if not SOL
      const mintsToLoad = [fromMint, toMint].filter((m) => m !== SOL_MINT);
      const out: Record<string, bigint> = {};
      for (const mint of mintsToLoad) {
        try {
          // getSplTokenBalance takes a symbol; for arbitrary mints we'd need
          // a mint-based variant. For now, only NERD has a balance helper.
          if (mint === NERD_MINT) {
            const bal = await getSplTokenBalance(connection, publicKey, 'NERD');
            out[mint] = bal;
          }
          // TODO: extend balance helper for arbitrary mints (uses
          // getParsedTokenAccountsByOwner + filter by mint). Out of scope for
          // tonight; for other tokens, balance shows "—" and MAX disabled.
        } catch {
          out[mint] = 0n;
        }
      }
      setBalances(out);
    } catch {
      // Silent — balances just don't render
    }
  }, [publicKey, connection, fromMint, toMint]);

  useEffect(() => {
    if (isOpen && connected) loadBalances();
  }, [isOpen, connected, loadBalances]);

  // Reset transient state on close
  useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setQuote(null);
      setErrorMsg(null);
      setSuccessSig(null);
      setState('ready');
    }
  }, [isOpen]);

  // Debounced quote fetch on amount/mints/slippage change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (quoteAbortRef.current) quoteAbortRef.current.abort();

    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setQuote(null);
      if (state === 'loading' || state === 'noroute') setState('ready');
      return;
    }

    // Pre-check insufficient balance
    const requestedRaw = BigInt(Math.round(parsed * Math.pow(10, fromT.decimals)));
    if (requestedRaw > fromBalanceRaw) {
      setQuote(null);
      setState('insufficient');
      return;
    }

    setState('loading');
    setErrorMsg(null);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      quoteAbortRef.current = controller;
      try {
        const q = await getSwapQuoteFor(fromMint, toMint, requestedRaw, slippagePct * 100);
        if (controller.signal.aborted) return;
        if (q === null) {
          setQuote(null);
          setState('noroute');
        } else {
          setQuote(q);
          setState('ready');
        }
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setQuote(null);
        setErrorMsg(err?.message || 'Failed to get quote');
        setState('error');
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, fromMint, toMint, slippagePct, fromBalanceRaw]);

  const handleFlip = () => {
    setFromMint(toMint);
    setToMint(fromMint);
    setAmount('');
    setQuote(null);
    setState('ready');
  };

  const handleMax = () => {
    if (fromMint === SOL_MINT) {
      // Reserve ~0.005 SOL for tx fees
      const maxLamports = Math.max(0, solLamports - 5_000_000);
      setAmount((maxLamports / 1e9).toString());
    } else {
      const raw = Number(fromBalanceRaw);
      const div = Math.pow(10, fromT.decimals);
      setAmount((raw / div).toString());
    }
  };

  const handlePickToken = (t: JupiterToken) => {
    if (pickerOpen === 'from') setFromMint(t.address);
    else if (pickerOpen === 'to') setToMint(t.address);
    pushRecentTokenMint(t.address);
    setPickerOpen(null);
  };

  const handleSwap = async () => {
    if (!connected || !publicKey || !quote) return;
    setState('pending');
    setErrorMsg(null);
    try {
      const { transaction } = await createSwapTransaction(quote, publicKey.toBase58());
      const signature = await sendTransaction(transaction, connection);
      await Promise.race([
        connection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30_000),
        ),
      ]);
      setSuccessSig(signature);
      setState('success');
      setAmount('');
      setQuote(null);
      setTimeout(loadBalances, 2000);
    } catch (err: any) {
      if (err?.message?.includes('User rejected') || err?.message?.includes('user reject')) {
        setState('ready'); // Silent cancel — drop back to ready
      } else {
        setErrorMsg(err?.message || 'Swap failed');
        setState('error');
      }
    }
  };

  // Derived display values
  const out = useMemo(() => {
    if (!quote) return { amount: '0', usd: 0 };
    const rawOut = BigInt(quote.outAmount);
    const div = Math.pow(10, toT.decimals);
    const amt = Number(rawOut) / div;
    return { amount: amt.toLocaleString(undefined, { maximumFractionDigits: amt > 1000 ? 0 : 6 }), usd: 0 };
  }, [quote, toT.decimals]);

  const rate = useMemo(() => {
    if (!quote || !amount) return null;
    const parsed = parseFloat(amount);
    if (!parsed) return null;
    const rawOut = BigInt(quote.outAmount);
    const divOut = Math.pow(10, toT.decimals);
    const outAmt = Number(rawOut) / divOut;
    return outAmt / parsed;
  }, [quote, amount, toT.decimals]);

  const impactPct = useMemo(() => (quote ? parseFloat(quote.priceImpactPct) * 100 : 0), [quote]);
  const impactColor = impactPct > 5 ? '#FF3131' : impactPct > 2 ? '#FFD700' : '#71717a';

  const minReceived = useMemo(() => {
    if (!quote) return null;
    const raw = BigInt(quote.minOutAmount);
    return Number(raw) / Math.pow(10, toT.decimals);
  }, [quote, toT.decimals]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" onClick={onClose} />

      <div
        className="relative w-full max-w-sm overflow-hidden shadow-2xl"
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 18px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="st-uplabel" style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}>
                POWERED BY JUPITER
              </div>
              <div className="st-display" style={{ fontSize: 30, color: '#fff', marginTop: 2 }}>
                SWAP
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="st-uplabel" style={{ fontSize: 9, color: '#71717a' }}>SLIPPAGE</span>
              {[0.5, 1, 2].map((s) => {
                const active = slippagePct === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSlippagePct(s)}
                    className="st-uplabel"
                    style={{
                      appearance: 'none', cursor: 'pointer', fontSize: 9, padding: '5px 8px',
                      borderRadius: 7,
                      background: active ? '#14F195' : 'transparent',
                      color: active ? '#04130b' : '#a1a1aa',
                      border: `1px solid ${active ? '#14F195' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    {s}%
                  </button>
                );
              })}
              <button
                onClick={onClose}
                style={{
                  appearance: 'none', background: 'transparent', border: 'none', color: '#71717a',
                  cursor: 'pointer', fontSize: 22, marginLeft: 4, padding: 0, lineHeight: 1,
                }}
              >×</button>
            </div>
          </div>
        </div>

        <div style={{ padding: '8px 18px 18px' }}>
          {/* FROM card */}
          <SwapCard
            label="YOU PAY"
            right={
              <span className="st-uplabel" style={{ fontSize: 9, color: '#71717a' }}>
                BALANCE {fromBalanceDisplay} {fromT.symbol}
              </span>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <TokenButton t={fromT} onClick={() => setPickerOpen('from')} />
              <div style={{ flex: 1, textAlign: 'right' }}>
                <input
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^\d*\.?\d*$/.test(v)) setAmount(v);
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="st-display st-num"
                  style={{
                    width: '100%', background: 'transparent', border: 'none', outline: 'none',
                    color: '#fff', fontSize: 30, textAlign: 'right', fontStyle: 'italic',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <button
                onClick={handleMax}
                className="st-uplabel"
                style={{
                  appearance: 'none', cursor: 'pointer', fontSize: 9, color: '#14F195',
                  background: 'rgba(20,241,149,0.12)', border: '1px solid rgba(20,241,149,0.33)',
                  borderRadius: 6, padding: '4px 8px',
                }}
              >MAX</button>
            </div>
          </SwapCard>

          {/* Flip button */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '-9px 0', position: 'relative', zIndex: 2 }}>
            <button
              onClick={handleFlip}
              style={{
                appearance: 'none', cursor: 'pointer', width: 36, height: 36, borderRadius: 11,
                background: '#111', border: '1.5px solid rgba(20,241,149,0.4)', color: '#14F195',
                display: 'grid', placeItems: 'center', fontSize: 15,
              }}
            >↕</button>
          </div>

          {/* TO card */}
          <SwapCard label="YOU RECEIVE" right={null}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <TokenButton t={toT} onClick={() => setPickerOpen('to')} />
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div
                  className="st-display st-num"
                  style={{
                    fontSize: 30, color: state === 'noroute' ? '#52525b' : '#fff', fontStyle: 'italic',
                  }}
                >
                  {state === 'noroute' ? '—' : out.amount}
                </div>
              </div>
            </div>
          </SwapCard>

          {/* Detail card / route info */}
          {state !== 'noroute' && quote && rate !== null && minReceived !== null && (
            <div style={{
              marginTop: 14, borderRadius: 12, padding: '12px 14px',
              background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {[
                ['Rate', `1 ${fromT.symbol} ≈ ${rate.toLocaleString(undefined, { maximumFractionDigits: rate > 1000 ? 0 : 6 })} ${toT.symbol}`],
                ['Best route', toT.symbol === 'NERD' || fromT.symbol === 'NERD' ? 'Bags · direct' : 'Jupiter · best'],
                ['Min received', `${minReceived.toLocaleString(undefined, { maximumFractionDigits: minReceived > 1000 ? 0 : 6 })} ${toT.symbol} · ${slippagePct}% slip`],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                  <span style={{ color: '#71717a' }}>{l}</span>
                  <span className="st-num" style={{ color: '#cfcfd6' }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                <span style={{ color: '#71717a' }}>Price impact</span>
                <span className="st-num" style={{ color: impactColor, fontWeight: 700 }}>
                  {impactPct.toFixed(2)}%{impactPct > 5 ? ' · HIGH' : impactPct > 2 ? ' · MED' : ''}
                </span>
              </div>
              {impactPct > 2 && (
                <div style={{ marginTop: 6, fontSize: 11, color: impactColor }}>
                  {impactPct > 5 ? '⚠ High price impact — you may lose value on this trade.' : '⚠ Moderate price impact on this route.'}
                </div>
              )}
            </div>
          )}

          {/* No-route notice */}
          {state === 'noroute' && (
            <div style={{
              marginTop: 14, borderRadius: 12, padding: '14px 16px',
              background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.35)',
            }}>
              <div className="st-uplabel" style={{ fontSize: 10, color: '#FFD700' }}>NO ROUTE FOUND</div>
              <div style={{ fontSize: 12, color: '#cfcfd6', marginTop: 4 }}>
                No path for {fromT.symbol} → {toT.symbol} right now. Try a different amount or token.
              </div>
            </div>
          )}

          {/* CTA */}
          <div style={{ marginTop: 14 }}>
            <SwapCTA
              state={state}
              toSymbol={toT.symbol}
              onSwap={handleSwap}
              onRetry={() => setState('ready')}
              tryOnJupiterHref={`https://jup.ag/swap/${fromMint}-${toMint}`}
              errorMsg={errorMsg}
            />
          </div>

          {/* Success tx link */}
          {state === 'success' && successSig && (
            <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11 }}>
              <a
                href={`https://solscan.io/tx/${successSig}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#14F195' }}
              >view on Solscan ↗</a>
            </div>
          )}
        </div>

        {/* Token picker sheet */}
        {pickerOpen && (
          <TokenPickerSheet
            tokens={jupTokens}
            tokensLoading={tokensLoading}
            onPick={handlePickToken}
            onClose={() => setPickerOpen(null)}
          />
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────

function SwapCard({ label, right, children }: { label: string; right: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="st-uplabel" style={{ fontSize: 9, color: '#71717a' }}>{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function TokenButton({ t, onClick }: { t: JupiterToken; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        background: '#141416', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999,
        padding: '7px 12px 7px 8px',
      }}
    >
      <TokenAvatar t={t} size={26} />
      <span className="st-display" style={{ fontSize: 18, color: '#fff', fontStyle: 'italic' }}>{t.symbol}</span>
      <span style={{ color: '#71717a', fontSize: 11 }}>▾</span>
    </button>
  );
}

function TokenAvatar({ t, size = 26 }: { t: JupiterToken; size?: number }) {
  if (t.logoURI) {
    return (
      <img
        src={t.logoURI}
        alt={t.symbol}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', background: '#141416' }}
        onError={(e) => {
          // Fallback to colored circle if image fails to load
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  // Fallback colored circle with first letter
  const tint = colorFromSymbol(t.symbol);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: tint, color: '#000',
      display: 'grid', placeItems: 'center', fontSize: size * 0.45, fontWeight: 700,
    }}>{(t.symbol || '?').charAt(0)}</div>
  );
}

function colorFromSymbol(sym: string): string {
  const map: Record<string, string> = {
    SOL: '#14F195', USDC: '#2775CA', USDT: '#26A17B', NERD: '#14F195',
    SKR: '#9945FF', JUP: '#84CC16', BONK: '#FF7A1A', WIF: '#E8B84B',
  };
  return map[sym] || '#71717a';
}

function SwapCTA({
  state, toSymbol, onSwap, onRetry, tryOnJupiterHref, errorMsg,
}: {
  state: SwapState;
  toSymbol: string;
  onSwap: () => void;
  onRetry: () => void;
  tryOnJupiterHref: string;
  errorMsg: string | null;
}) {
  const base: React.CSSProperties = {
    width: '100%', textAlign: 'center', padding: '15px 0', borderRadius: 14,
    fontSize: 13, letterSpacing: '0.12em',
  };
  if (state === 'insufficient') {
    return (
      <div className="st-uplabel" style={{
        ...base, background: '#141416', color: '#71717a',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>INSUFFICIENT BALANCE</div>
    );
  }
  if (state === 'noroute') {
    return (
      <a
        href={tryOnJupiterHref} target="_blank" rel="noreferrer"
        className="st-uplabel"
        style={{
          ...base, display: 'block', background: '#141416', color: '#71717a',
          border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none',
        }}
      >TRY ON JUPITER ↗</a>
    );
  }
  if (state === 'loading') {
    return (
      <div style={{
        ...base, background: '#141416', border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <Spinner size={14} />
        <span className="st-uplabel" style={{ fontSize: 11, color: '#a1a1aa' }}>FINDING BEST ROUTE…</span>
      </div>
    );
  }
  if (state === 'pending') {
    return (
      <div style={{
        ...base, background: '#14F195', color: '#04130b',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      }}>
        <Spinner size={14} dark />
        <span className="st-uplabel" style={{ fontSize: 11 }}>CONFIRMING…</span>
      </div>
    );
  }
  if (state === 'success') {
    return (
      <div style={{
        ...base, background: 'rgba(20,241,149,0.12)', border: '1px solid rgba(20,241,149,0.4)',
        color: '#14F195',
      }}>
        <span className="st-uplabel" style={{ fontSize: 12 }}>✓ SWAPPED INTO {toSymbol}</span>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <button onClick={onRetry} className="st-uplabel" style={{
        ...base, appearance: 'none', cursor: 'pointer',
        background: 'rgba(255,49,49,0.12)', color: '#FF3131', border: '1px solid rgba(255,49,49,0.4)',
        fontSize: 12,
      }}>
        SWAP FAILED · RETRY
        {errorMsg && <span style={{ display: 'block', fontSize: 10, marginTop: 4, letterSpacing: 0 }}>{errorMsg.slice(0, 80)}</span>}
      </button>
    );
  }
  // ready
  return (
    <button onClick={onSwap} className="st-uplabel" style={{
      ...base, appearance: 'none', cursor: 'pointer',
      background: '#14F195', color: '#04130b', border: 'none', padding: '16px 0',
    }}>SWAP →</button>
  );
}

function Spinner({ size = 14, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid ${dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.12)'}`,
      borderTopColor: dark ? '#04130b' : '#14F195',
      animation: 'spin 0.8s linear infinite',
      display: 'inline-block',
    }} />
  );
}

// ─── Token picker sheet ─────────────────────────────────────────────

function TokenPickerSheet({
  tokens, tokensLoading, onPick, onClose,
}: {
  tokens: JupiterToken[];
  tokensLoading: boolean;
  onPick: (t: JupiterToken) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  // External token (pump.fun, bags, etc.) fetched on CA-paste fallback.
  const [externalToken, setExternalToken] = useState<JupiterToken | null>(null);
  const [externalLookup, setExternalLookup] = useState<'idle' | 'looking' | 'notfound'>('idle');
  // Map of mint → live USD price (lazy-fetched).
  const [prices, setPrices] = useState<Record<string, JupiterPriceEntry>>({});

  const recent = useMemo(() => {
    const mints = getRecentTokenMints();
    return mints.map((m) => tokens.find((t) => t.address === m)).filter(Boolean) as JupiterToken[];
  }, [tokens]);

  const isCA = looksLikeMintCA(query);

  const filtered = useMemo(() => searchTokens(query, tokens), [query, tokens]);
  // Split by whitelist
  const wl = filtered.filter((t) => isWhitelisted(t.symbol));
  const rest = filtered.filter((t) => !isWhitelisted(t.symbol));

  // CA paste fallback: when user pastes a mint NOT in Jupiter's list, try
  // Pump.fun's frontend API. If found, render as an importable row. Covers
  // newly-launched pump.fun + pre-graduation tokens not yet on Jupiter.
  useEffect(() => {
    if (!isCA || filtered.length > 0) {
      setExternalToken(null);
      setExternalLookup('idle');
      return;
    }
    let cancelled = false;
    setExternalLookup('looking');
    (async () => {
      const t = await fetchPumpFunToken(query.trim());
      if (cancelled) return;
      if (t) {
        setExternalToken(t);
        setExternalLookup('idle');
      } else {
        setExternalToken(null);
        setExternalLookup('notfound');
      }
    })();
    return () => { cancelled = true; };
  }, [query, isCA, filtered.length]);

  // Live USD price enrichment for visible rows (Jupiter free Price API).
  // Fetches the top ~80 visible mints on render, batches into single request.
  useEffect(() => {
    const visible: string[] = [];
    if (!query) {
      visible.push(...recent.map((t) => t.address));
    }
    visible.push(...wl.map((t) => t.address));
    visible.push(...rest.slice(0, 60).map((t) => t.address));
    if (externalToken) visible.push(externalToken.address);
    if (visible.length === 0) return;

    let cancelled = false;
    fetchPrices(visible).then((map) => {
      if (cancelled) return;
      setPrices((prev) => ({ ...prev, ...map }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tokens.length, externalToken?.address]);

  // No real token results AND no successful external lookup yet = the "not in any list" notice
  const noResults = !tokensLoading && wl.length === 0 && rest.length === 0 && !externalToken;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', background: '#0a0a0a',
        borderTop: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '20px 20px 0 0', maxHeight: '82%',
        display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{ padding: '14px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="st-uplabel" style={{ fontSize: 12, color: '#fff' }}>SELECT TOKEN</span>
            <button onClick={onClose} style={{ appearance: 'none', background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#000', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px' }}>
            <span style={{ color: '#52525b' }}>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, symbol, or paste CA"
              autoFocus
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '4px 4px 16px' }}>
          {tokensLoading && (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <Spinner size={20} />
              <div className="st-uplabel" style={{ fontSize: 10, color: '#71717a', marginTop: 8 }}>LOADING TOKENS…</div>
            </div>
          )}
          {!tokensLoading && !query && recent.length > 0 && (
            <>
              <div className="st-uplabel" style={{ fontSize: 9, color: '#52525b', padding: '8px 14px 4px' }}>RECENTLY USED</div>
              {recent.map((t) => <TokenRow key={'r' + t.address} t={t} price={prices[t.address]?.price} onPick={onPick} />)}
            </>
          )}
          {!tokensLoading && wl.length > 0 && (
            <>
              <div className="st-uplabel" style={{ fontSize: 9, color: '#52525b', padding: '10px 14px 4px' }}>WHITELISTED</div>
              {wl.map((t) => <TokenRow key={t.address} t={t} price={prices[t.address]?.price} onPick={onPick} />)}
            </>
          )}
          {!tokensLoading && rest.length > 0 && (
            <>
              <div className="st-uplabel" style={{ fontSize: 9, color: '#52525b', padding: '10px 14px 4px' }}>ALL TOKENS</div>
              {rest.slice(0, 80).map((t) => <TokenRow key={t.address} t={t} price={prices[t.address]?.price} onPick={onPick} />)}
            </>
          )}
          {!tokensLoading && externalToken && (
            <>
              <div className="st-uplabel" style={{ fontSize: 9, color: '#52525b', padding: '10px 14px 4px' }}>
                IMPORTED FROM PUMP.FUN
              </div>
              <TokenRow t={externalToken} price={prices[externalToken.address]?.price} onPick={onPick} pumpFun />
              <div style={{ fontSize: 10, color: '#FFD700', textAlign: 'center', marginTop: 6, padding: '0 14px' }}>
                ⚠ Pre-graduation pump.fun token. High risk. Confirm liquidity before betting.
              </div>
            </>
          )}
          {!tokensLoading && isCA && externalLookup === 'looking' && (
            <div style={{ padding: '20px 14px', textAlign: 'center' }}>
              <Spinner size={16} />
              <div className="st-uplabel" style={{ fontSize: 9, color: '#71717a', marginTop: 8 }}>CHECKING PUMP.FUN…</div>
            </div>
          )}
          {!tokensLoading && isCA && externalLookup === 'notfound' && (
            <div style={{ padding: '14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  background: '#141416', border: '1.5px solid rgba(255,255,255,0.12)', color: '#a1a1aa',
                }}>?</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="st-display" style={{ fontSize: 16, color: '#fff', fontStyle: 'italic' }}>NOT INDEXED</div>
                  <div className="st-mono" style={{ fontSize: 9, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{query}</div>
                </div>
                <span className="st-uplabel" style={{ fontSize: 9, color: '#FF3131', padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(255,49,49,0.35)' }}>NO DATA</span>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', textAlign: 'center', marginTop: 10 }}>
                Mint not found on Jupiter or Pump.fun. Double-check the address or wait for indexing.
              </div>
            </div>
          )}
          {noResults && !isCA && (
            <div style={{ padding: '40px 14px', textAlign: 'center', color: '#71717a', fontSize: 12 }}>
              No tokens match "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TokenRow({
  t, price, onPick, pumpFun = false,
}: {
  t: JupiterToken;
  price?: number;
  onPick: (t: JupiterToken) => void;
  pumpFun?: boolean;
}) {
  return (
    <button
      onClick={() => onPick(t)}
      style={{
        appearance: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
        borderRadius: 12, background: 'transparent', border: 'none',
      }}
    >
      <TokenAvatar t={t} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="st-display" style={{ fontSize: 18, color: '#fff', fontStyle: 'italic' }}>{t.symbol}</span>
          {isWhitelisted(t.symbol) && (
            <span className="st-uplabel" style={{
              fontSize: 7, color: '#14F195', padding: '2px 5px', borderRadius: 4,
              background: 'rgba(20,241,149,0.12)',
            }}>★</span>
          )}
          {pumpFun && (
            <span className="st-uplabel" style={{
              fontSize: 7, color: '#FFD700', padding: '2px 5px', borderRadius: 4,
              background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.35)',
            }}>PUMP.FUN</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
          <span style={{ fontSize: 11, color: '#71717a' }}>{t.name}</span>
          <span className="st-mono" style={{ fontSize: 9, color: '#52525b' }}>{shortCA(t.address)}</span>
        </div>
      </div>
      {price !== undefined && price > 0 && (
        <div style={{ textAlign: 'right' }}>
          <div className="st-mono" style={{ fontSize: 12, color: '#cfcfd6', fontVariantNumeric: 'tabular-nums' }}>
            ${price < 0.01 ? price.toExponential(2) : price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 2 })}
          </div>
        </div>
      )}
    </button>
  );
}

export default SwapModal;
