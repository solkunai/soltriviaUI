/**
 * SPLSelector — reusable SPL token picker. Used for:
 *   - Custom game creator-funded prizes (pick an SPL to escrow)
 *   - SPL Duels (pick a wager token)
 *   - Future Swap modal token-picker variant
 *
 * Lists tokens the user holds (via `useWalletSPL` → Helius DAS proxy), lets
 * them search by name/symbol/paste CA, and surfaces a curated catalog of
 * popular tokens they don't hold with a "BUY NOW" affordance that calls
 * `onBuy(token)` — the parent decides what swap UI to open.
 *
 * Design source: final-handoff-v2.1/prototype-src/st-v21-spl.jsx (SPLSelector)
 * + stw-v21.jsx (WebSPLSelector).
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  useWalletSPL,
  looksLikeCA,
  type TokenAsset,
} from '../src/hooks/useWalletSPL';
import { useJupiterTokens, type JupiterToken } from '../src/utils/jupiterTokens';
import { JupiterVerifiedBadge } from './JupiterVerifiedBadge';

// Official Sol Trivia NERD mint — block all impersonators that share the
// brand name but use a different mint. Same logic as the swap modal.
const OFFICIAL_NERD_MINT = 'DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS';
function isFakeNerdImpersonator(t: { address: string; symbol?: string; name?: string }): boolean {
  if (t.address === OFFICIAL_NERD_MINT) return false;
  const sym = (t.symbol || '').toUpperCase().replace(/^\$/, '');
  const name = (t.name || '').toUpperCase();
  if (sym === 'NERD' || sym === 'SOLTRIVIA' || sym === 'SOL TRIVIA') return true;
  if (name.includes('SOL TRIVIA') || name.includes('SOLTRIVIA')) return true;
  if (name === 'NERD' || name === '$NERD') return true;
  return false;
}

/** Convert a JupiterToken → TokenAsset for unified rendering in the picker. */
function jupTokenToAsset(j: JupiterToken): TokenAsset {
  return {
    mint: j.address,
    symbol: j.symbol,
    name: j.name,
    logo: j.logoURI ?? null,
    balance: '0',
    usd: null,
    held: false,
    decimals: j.decimals,
    isVerified: j.isVerified === true,
    organicScoreLabel: j.organicScoreLabel,
  };
}

interface Props {
  walletAddress?: string | null;
  /** Currently-selected mint (highlights the row). */
  selectedMint?: string | null;
  /** User picked a held token. Caller decides what to do. */
  onSelect: (token: TokenAsset) => void;
  /** User tapped BUY NOW on a non-held token. Caller opens the swap modal. */
  onBuy?: (token: TokenAsset) => void;
}

const COLORS = {
  primary: '#FBBF24',
  gold: '#FBBF24',
  surface: '#0a0a0a',
  borderLight: 'rgba(255,255,255,0.08)',
  borderMedium: 'rgba(255,255,255,0.16)',
} as const;

/** Round image with monogram fallback when no logo. */
function TokenAvatar({ t, size = 38 }: { t: TokenAsset; size?: number }) {
  if (t.logo) {
    return (
      <img
        src={t.logo}
        alt={t.symbol}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }
  const tint = t.tint || '#52525b';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: `${tint}26`,
        border: `1.5px solid ${tint}`,
        color: tint,
        fontWeight: 800,
        fontSize: size * 0.34,
      }}
    >
      {t.symbol.slice(0, 2)}
    </div>
  );
}

const SPLSelector: React.FC<Props> = ({
  walletAddress,
  selectedMint,
  onSelect,
  onBuy,
}) => {
  const { assets, status, refetch } = useWalletSPL(walletAddress);
  const [query, setQuery] = useState('');

  // Two forms of the query: case-preserving for Jupiter (mint addresses are
  // case-sensitive base58), lowercased for symbol/name matching of held tokens.
  const qRaw = query.trim();
  const ql = qRaw.toLowerCase();
  const match = (t: TokenAsset) => !ql || (t.symbol + t.name).toLowerCase().includes(ql);

  // Debounce the query passed to Jupiter — without it every keystroke fires
  // a network request, and the results flicker as in-flight requests resolve
  // out of order. 300ms is the standard search-as-you-type debounce.
  // CA pastes are atomic so the 300ms wait is imperceptible.
  const [debouncedRaw, setDebouncedRaw] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedRaw(qRaw), 300);
    return () => clearTimeout(t);
  }, [qRaw]);

  // Search Jupiter for any token in their universe (verified + memes + new
  // launches). Brand-protect filter strips fake NERD impersonators.
  // PRESERVE CASE — mint addresses are case-sensitive.
  const { tokens: jupResults, loading: jupLoading } = useJupiterTokens(debouncedRaw);

  const held = useMemo(() => assets.filter(match), [assets, ql]);
  const heldMints = useMemo(() => new Set(held.map((t) => t.mint)), [held]);

  // True only when the debounce has settled (Jupiter is showing results for
  // the CURRENT query, not a stale one). While typing/pasting, this is false
  // and we hold the catalog empty + show a "Searching…" hint instead of
  // flashing top-traded tokens that don't match the user's intent.
  const debounceSettled = debouncedRaw === qRaw;
  const isSearchingExternal = !!qRaw && (!debounceSettled || jupLoading);

  // Map Jupiter results → TokenAsset, drop impersonators + tokens already
  // shown in YOUR TOKENS so we don't list them twice.
  const catalog = useMemo(() => {
    if (!ql || !debounceSettled) return [] as TokenAsset[];
    return jupResults
      .filter((t) => !isFakeNerdImpersonator(t))
      .filter((t) => !heldMints.has(t.address))
      .slice(0, 20)
      .map(jupTokenToAsset);
  }, [ql, debounceSettled, jupResults, heldMints]);

  const caHit = looksLikeCA(query) && held.length === 0 && catalog.length === 0 && debounceSettled && !jupLoading;

  return (
    <div style={{ padding: 18, maxHeight: '80vh', overflowY: 'auto' }}>
      {/* ── Search input ──────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#000',
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 14,
        }}
      >
        <span style={{ color: '#52525b', fontSize: 13 }}>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, symbol, or paste CA"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: 13,
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{
              appearance: 'none',
              background: 'transparent',
              border: 'none',
              color: '#52525b',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* ── Status: loading shimmer ──────────────────────── */}
      {status === 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                height: 58,
                borderRadius: 12,
                background: 'linear-gradient(90deg,#0d0d0d,#161616,#0d0d0d)',
                backgroundSize: '200% 100%',
                animation: 'st-shimmer 1.2s infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* ── Status: error ────────────────────────────────── */}
      {status === 'error' && (
        <div
          style={{
            textAlign: 'center',
            padding: '30px 16px',
            borderRadius: 12,
            border: '1px solid rgba(255,49,49,0.27)',
            background: 'rgba(255,49,49,0.06)',
          }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 11, color: '#FF3131', letterSpacing: '0.14em' }}
          >
            COULDN'T LOAD TOKENS
          </div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 5 }}>
            Check your connection and retry.
          </div>
          <button
            onClick={refetch}
            className="font-black italic uppercase"
            style={{
              marginTop: 12,
              cursor: 'pointer',
              fontSize: 10,
              letterSpacing: '0.14em',
              padding: '8px 16px',
              borderRadius: 8,
              background: 'transparent',
              color: '#fff',
              border: `1px solid ${COLORS.borderMedium}`,
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* ── Status: ready ────────────────────────────────── */}
      {status !== 'loading' && status !== 'error' && (
        <>
          {/* YOUR TOKENS */}
          {held.length > 0 && (
            <div style={{ marginBottom: catalog.length || caHit ? 16 : 0 }}>
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em', marginBottom: 8 }}
              >
                YOUR TOKENS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {held.map((t) => {
                  const sel = selectedMint === t.mint;
                  return (
                    <button
                      key={t.mint}
                      onClick={() => onSelect(t)}
                      style={{
                        appearance: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '11px 14px',
                        borderRadius: 12,
                        background: sel ? `${COLORS.primary}12` : COLORS.surface,
                        border: `1.5px solid ${sel ? COLORS.primary : COLORS.borderLight}`,
                        transition: 'background 0.12s ease, border 0.12s ease',
                      }}
                    >
                      <TokenAvatar t={t} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="font-black italic"
                          style={{ fontSize: 18, color: '#fff', lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          {t.symbol}
                          <JupiterVerifiedBadge mint={t.mint} size={12} style={{ marginLeft: 2 }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                          {t.name}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          className="font-black italic"
                          style={{ fontSize: 15, color: '#fff', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {t.balance}
                        </div>
                        {t.usd && (
                          <div
                            style={{
                              fontSize: 10,
                              color: '#71717a',
                              marginTop: 1,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {t.usd}
                          </div>
                        )}
                      </div>
                      {sel && (
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            flexShrink: 0,
                            background: COLORS.primary,
                            display: 'grid',
                            placeItems: 'center',
                            color: '#04130b',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* NOT IN WALLET → BUY NOW (only when user is searching) */}
          {catalog.length > 0 && (
            <div>
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em', marginBottom: 8 }}
              >
                NOT IN YOUR WALLET
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catalog.map((t) => {
                  const sel = selectedMint === t.mint;
                  return (
                    <button
                      key={t.mint}
                      onClick={() => onSelect(t)}
                      style={{
                        appearance: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '11px 14px',
                        borderRadius: 12,
                        background: sel ? `${COLORS.primary}12` : COLORS.surface,
                        border: `1.5px solid ${sel ? COLORS.primary : COLORS.borderLight}`,
                        transition: 'background 0.12s ease, border 0.12s ease',
                      }}
                    >
                      <TokenAvatar t={t} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="font-black italic"
                          style={{ fontSize: 18, color: '#fff', lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          {t.symbol}
                          {t.isVerified && <JupiterVerifiedBadge mint={t.mint} size={12} style={{ marginLeft: 2 }} />}
                          {t.organicScoreLabel === 'low' && !t.isVerified && (
                            <span style={{ fontSize: 7, color: '#FF7676', padding: '2px 5px', borderRadius: 4, background: 'rgba(255,49,49,0.12)', border: '1px solid rgba(255,49,49,0.35)', marginLeft: 4 }}>⚠ RISK</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                          {t.name}
                        </div>
                      </div>
                      {onBuy && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onBuy(t); }}
                          className="font-black italic uppercase"
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 9,
                            letterSpacing: '0.1em',
                            padding: '6px 10px',
                            borderRadius: 999,
                            color: '#04130b',
                            background: `linear-gradient(135deg, ${COLORS.gold}, #FF9E3D)`,
                            border: 'none',
                          }}
                        >
                          ⇄ BUY
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CA paste hit — unknown token, offer to swap into it */}
          {caHit && onBuy && (
            <div>
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em', marginBottom: 8 }}
              >
                FROM CONTRACT ADDRESS
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  borderRadius: 12,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.borderLight}`,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: '#141416',
                    border: `1.5px solid ${COLORS.borderMedium}`,
                    color: '#a1a1aa',
                    fontSize: 16,
                  }}
                >
                  ?
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="font-black italic"
                    style={{ fontSize: 16, color: '#fff' }}
                  >
                    UNKNOWN TOKEN
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#71717a',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace',
                    }}
                  >
                    {query}
                  </div>
                </div>
                <button
                  onClick={() =>
                    onBuy({
                      mint: query.trim(),
                      symbol: 'UNK',
                      name: 'Unknown',
                      logo: null,
                      balance: '0',
                      usd: null,
                      held: false,
                    })
                  }
                  className="font-black italic uppercase"
                  style={{
                    cursor: 'pointer',
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    padding: '9px 14px',
                    borderRadius: 999,
                    color: '#04130b',
                    background: `linear-gradient(135deg, ${COLORS.gold}, #FF9E3D)`,
                    border: 'none',
                  }}
                >
                  ⇄ BUY NOW
                </button>
              </div>
            </div>
          )}

          {/* Searching state — debounce is in flight OR Jupiter is loading.
              Prevents the empty "NO MATCHES" flash while results are en route. */}
          {isSearchingExternal && held.length === 0 && catalog.length === 0 && !caHit && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 16px',
                borderRadius: 12,
                border: `1px dashed ${COLORS.borderMedium}`,
              }}
            >
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.14em' }}
              >
                Searching Jupiter…
              </div>
            </div>
          )}

          {/* Empty (no search, no holdings) */}
          {!isSearchingExternal && held.length === 0 && catalog.length === 0 && !caHit && (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 16px',
                borderRadius: 12,
                border: `1px dashed ${COLORS.borderMedium}`,
              }}
            >
              <div className="font-black italic" style={{ fontSize: 28, color: '#3f3f46' }}>⌕</div>
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.14em', marginTop: 6 }}
              >
                {!walletAddress ? 'CONNECT WALLET' : status === 'empty' ? 'NO TOKENS YET' : 'NO MATCHES'}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
                {!walletAddress
                  ? 'Connect your wallet to see your tokens.'
                  : status === 'empty'
                    ? 'Your wallet holds no SPL tokens. Try a search or paste a CA.'
                    : 'Try a different name or paste a contract address.'}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SPLSelector;
