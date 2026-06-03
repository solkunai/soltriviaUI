/**
 * NFTSelector — reusable wallet-NFT picker used by Custom Game creation
 * (NFT prize attachment) and any future "pick an NFT" surface.
 *
 * Reads the connected wallet's assets via `useWalletNFTs` (Helius DAS proxy),
 * filters by standard chip (ALL / CORE / pNFT / NFT), searches by name +
 * collection, and renders a 3-col grid with status states (loading shimmer,
 * empty, error, ready). Single-select — fires `onSelect(nft)` on tap.
 *
 * Design source: final-handoff-v2.1/prototype-src/stw-v21.jsx (WebNFTSelector)
 * + st-v21-nft.jsx (NFTSelector). Standard badge classification drives the
 * caller's on-chain ix variant (`_nft` Core vs `_tm_pnft` token-metadata pNFT).
 */
import React, { useMemo, useState } from 'react';
import {
  useWalletNFTs,
  type NFTStandard,
  type WalletNFT,
} from '../src/hooks/useWalletNFTs';

interface Props {
  /** The user's wallet address. If null, renders the empty state. */
  walletAddress?: string | null;
  /** Optional initial filter chip. */
  initialFilter?: 'all' | NFTStandard;
  /** Currently-selected mint address (highlights that card). */
  selectedMint?: string | null;
  /** Called on tap. Caller decides what to do with the picked asset. */
  onSelect: (nft: WalletNFT) => void;
  /** Grid columns. Web defaults to 3. */
  cols?: 2 | 3 | 4;
}

const COLORS = {
  primary: '#FBBF24',
  borderLight: 'rgba(255,255,255,0.08)',
  borderMedium: 'rgba(255,255,255,0.16)',
  red: '#FF3131',
} as const;

const STD_LABEL: Record<NFTStandard, string> = {
  core: 'CORE',
  pnft: 'pNFT',
  legacy: 'NFT',
};

const STD_COLOR: Record<NFTStandard, string> = {
  core: '#FBBF24',
  pnft: '#7CD4F5',
  legacy: '#a1a1aa',
};

/** Tiny pill that shows asset standard. Used inside each card thumbnail. */
function StandardBadge({ standard, sm }: { standard: NFTStandard; sm?: boolean }) {
  const color = STD_COLOR[standard];
  return (
    <span
      className="font-black italic uppercase"
      style={{
        display: 'inline-block',
        fontSize: sm ? 7.5 : 9,
        letterSpacing: '0.12em',
        padding: sm ? '2px 5px' : '3px 7px',
        borderRadius: 999,
        color: '#000',
        background: color,
        boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
      }}
    >
      {STD_LABEL[standard]}
    </span>
  );
}

const NFTSelector: React.FC<Props> = ({
  walletAddress,
  initialFilter = 'all',
  selectedMint,
  onSelect,
  cols = 3,
}) => {
  const { assets, status, refetch } = useWalletNFTs(walletAddress);
  const [chip, setChip] = useState<'all' | NFTStandard>(initialFilter);
  const [query, setQuery] = useState('');
  // Spam filter (heuristic-only by default — verified flag is too strict
  // because many legit collections like Y00ts/DeGods aren't formally
  // Metaplex-verified). Hide assets matching airdrop/voucher/URL-in-name
  // patterns. Power users can flip "Show all" to reveal them anyway.
  const [showAll, setShowAll] = useState(false);

  const isHiddenByDefault = (a: typeof assets[number]) => !!a.isSpam;

  const hiddenCount = useMemo(
    () => assets.filter(isHiddenByDefault).length,
    [assets],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (!showAll && isHiddenByDefault(a)) return false;
      if (chip !== 'all' && a.standard !== chip) return false;
      if (!q) return true;
      return (a.name + ' ' + a.collectionName).toLowerCase().includes(q);
    });
  }, [assets, chip, query, showAll]);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: 8,
  };

  return (
    <div>
      {/* ── Search ───────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#000',
          border: `1px solid ${COLORS.borderLight}`,
          borderRadius: 10,
          padding: '9px 12px',
          marginBottom: 10,
        }}
      >
        <span style={{ color: '#52525b', fontSize: 13 }}>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your NFTs"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: 13,
          }}
        />
      </div>

      {/* ── Filter chips ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {(
          [
            ['all', 'ALL'],
            ['core', 'CORE'],
            ['pnft', 'pNFT'],
            ['legacy', 'NFT'],
          ] as const
        ).map(([id, label]) => {
          const active = chip === id;
          return (
            <button
              key={id}
              onClick={() => setChip(id)}
              className="font-black italic uppercase"
              style={{
                appearance: 'none',
                cursor: 'pointer',
                fontSize: 9,
                letterSpacing: '0.12em',
                padding: '6px 12px',
                borderRadius: 999,
                background: active ? COLORS.primary : 'transparent',
                color: active ? '#04130b' : '#a1a1aa',
                border: `1px solid ${active ? COLORS.primary : COLORS.borderLight}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Spam toggle ──────────────────────────────────── */}
      {hiddenCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setShowAll((v) => !v)}
            className="font-black italic uppercase"
            style={{
              appearance: 'none',
              cursor: 'pointer',
              fontSize: 9,
              letterSpacing: '0.12em',
              padding: '5px 10px',
              borderRadius: 999,
              background: showAll ? 'rgba(255,49,49,0.12)' : 'transparent',
              color: showAll ? '#FF7676' : '#71717a',
              border: `1px solid ${showAll ? 'rgba(255,49,49,0.35)' : COLORS.borderLight}`,
            }}
            title="Suspected spam NFTs (claim/airdrop voucher scams, URL-in-name patterns) are hidden by default. Toggle to reveal them."
          >
            {showAll
              ? `▼ SHOWING ${hiddenCount} SUSPECTED SPAM`
              : `▸ ${hiddenCount} HIDDEN (SUSPECTED SPAM)`}
          </button>
        </div>
      )}

      {/* ── Status: loading shimmer ──────────────────────── */}
      {status === 'loading' && (
        <div style={gridStyle}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                borderRadius: 10,
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
            border: `1px solid ${COLORS.red}44`,
            background: `${COLORS.red}10`,
          }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 11, color: COLORS.red, letterSpacing: '0.14em' }}
          >
            COULDN'T LOAD NFTS
          </div>
          <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 5 }}>
            Check your connection and retry.
          </div>
          <button
            onClick={refetch}
            className="font-black italic uppercase"
            style={{
              marginTop: 12,
              appearance: 'none',
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

      {/* ── Status: empty ────────────────────────────────── */}
      {status === 'empty' && (
        <div
          style={{
            textAlign: 'center',
            padding: '34px 16px',
            borderRadius: 12,
            border: `1px dashed ${COLORS.borderMedium}`,
          }}
        >
          <div className="font-black italic" style={{ fontSize: 30, color: '#3f3f46' }}>◇</div>
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 11, color: '#a1a1aa', marginTop: 6, letterSpacing: '0.14em' }}
          >
            NO NFTS FOUND
          </div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
            {!walletAddress
              ? 'Connect a wallet to see your NFTs.'
              : chip !== 'all'
                ? `This wallet holds no ${STD_LABEL[chip]} assets.`
                : 'This wallet holds no NFTs.'}
          </div>
        </div>
      )}

      {/* ── Status: ready (or filtered to empty) ─────────── */}
      {status === 'ready' && filtered.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '34px 16px',
            borderRadius: 12,
            border: `1px dashed ${COLORS.borderMedium}`,
          }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 11, color: '#a1a1aa', letterSpacing: '0.14em' }}
          >
            NO MATCHES
          </div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>
            Try a different filter or search term.
          </div>
        </div>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div style={gridStyle}>
          {filtered.map((n) => {
            const isSel = selectedMint === n.mint;
            return (
              <button
                key={n.mint}
                onClick={() => onSelect(n)}
                style={{
                  appearance: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0,
                  borderRadius: 10,
                  overflow: 'hidden',
                  position: 'relative',
                  background: '#0c0c0d',
                  border: `2px solid ${isSel ? COLORS.primary : COLORS.borderLight}`,
                  boxShadow: isSel ? `0 0 16px -4px ${COLORS.primary}aa` : 'none',
                  transition: 'border 0.12s ease, box-shadow 0.12s ease',
                }}
              >
                <div style={{ aspectRatio: '1', position: 'relative' }}>
                  {n.thumbnail ? (
                    <img
                      src={n.thumbnail}
                      alt={n.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'grid',
                        placeItems: 'center',
                        background: '#161616',
                        color: '#3f3f46',
                        fontSize: 28,
                        fontStyle: 'italic',
                        fontWeight: 900,
                      }}
                    >
                      ◇
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 5, left: 5 }}>
                    <StandardBadge standard={n.standard} sm />
                  </div>
                  {n.isSpam && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 5,
                        left: 5,
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        padding: '2px 5px',
                        borderRadius: 4,
                        background: 'rgba(255,49,49,0.85)',
                        color: '#fff',
                        fontWeight: 900,
                        fontStyle: 'italic',
                        textTransform: 'uppercase',
                      }}
                      title="Matches client-side spam heuristics (claim/airdrop, URL in name, suspicious TLD)"
                    >
                      ⚠ SPAM?
                    </div>
                  )}
                  {isSel && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 5,
                        right: 5,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: COLORS.primary,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#04130b',
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>
                <div style={{ padding: '6px 7px' }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                    }}
                  >
                    {n.name}
                  </div>
                  <div
                    className="font-black italic uppercase"
                    style={{
                      fontSize: 7.5,
                      color: '#71717a',
                      marginTop: 1,
                      letterSpacing: '0.1em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {n.collectionName}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NFTSelector;
