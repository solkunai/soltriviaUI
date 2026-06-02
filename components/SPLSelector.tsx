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
import React, { useMemo, useState } from 'react';
import {
  useWalletSPL,
  SPL_CATALOG,
  looksLikeCA,
  type TokenAsset,
} from '../src/hooks/useWalletSPL';

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

  const ql = query.trim().toLowerCase();
  const match = (t: TokenAsset) => !ql || (t.symbol + t.name).toLowerCase().includes(ql);

  const held = useMemo(() => assets.filter(match), [assets, ql]);
  // Catalog only surfaces when user actively searches (avoids visual noise).
  const catalog = useMemo(() => (ql ? SPL_CATALOG.filter(match) : []), [ql]);
  const caHit = looksLikeCA(query) && held.length === 0 && catalog.length === 0;

  return (
    <div>
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
                          style={{ fontSize: 18, color: '#fff', lineHeight: 1 }}
                        >
                          {t.symbol}
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
                {catalog.map((t) => (
                  <div
                    key={t.mint}
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
                    <TokenAvatar t={t} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        className="font-black italic"
                        style={{ fontSize: 18, color: '#fff', lineHeight: 1 }}
                      >
                        {t.symbol}
                      </div>
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                        {t.name}
                      </div>
                    </div>
                    {onBuy && (
                      <button
                        onClick={() => onBuy(t)}
                        className="font-black italic uppercase"
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
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
                    )}
                  </div>
                ))}
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

          {/* Empty (no search, no holdings) */}
          {held.length === 0 && catalog.length === 0 && !caHit && (
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
