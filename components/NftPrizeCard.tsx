/**
 * NftPrizeCard — visual display of an NFT prize via Helius DAS.
 *
 * Two variants:
 *   • 'full'  — large hero card (used on the claim-prize "page" inside the
 *               custom game lobby when the user is the winner of an NFT
 *               game). Full-resolution artwork, big name, collection, badge.
 *   • 'inline' — compact card (used in browse contexts where multiple NFT
 *               prizes might list alongside SOL/SPL games).
 *
 * Loading state shows a skeleton matching the layout. Error state shows the
 * mint short-CA with a "Couldn't load artwork" notice. Both keep the cyan
 * accent so the brand feels consistent even when DAS is degraded.
 *
 * Accents are cyan (#38BDF8) per the no-purple feedback rule.
 */
import React, { useEffect, useState } from 'react';
import { fetchNftMetadata, type NftMetadata, type NftStandard } from '../src/utils/nftMetadata';

interface Props {
  mint: string;
  /** Hint from the game record; lets us show the badge before DAS resolves. */
  hintStandard?: NftStandard;
  variant?: 'full' | 'inline';
  /** Optional click handler, e.g. open the NFT on Magic Eden. */
  onClick?: () => void;
}

const CYAN = '#38BDF8';

function shortMint(m: string): string {
  if (!m || m.length < 12) return m;
  return `${m.slice(0, 4)}…${m.slice(-4)}`;
}

function standardBadge(s: NftStandard): { label: string; color: string } {
  switch (s) {
    case 'core':
      return { label: 'CORE', color: CYAN };
    case 'pnft':
      return { label: 'pNFT', color: '#FFD700' };
    case 'legacy':
    default:
      return { label: 'NFT', color: '#a1a1aa' };
  }
}

const NftPrizeCard: React.FC<Props> = ({ mint, hintStandard, variant = 'full', onClick }) => {
  const [meta, setMeta] = useState<NftMetadata | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setMeta(null);
    fetchNftMetadata(mint)
      .then((m) => {
        if (cancelled) return;
        if (!m) {
          setStatus('error');
        } else {
          setMeta(m);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  const standard = meta?.standard ?? hintStandard ?? 'legacy';
  const badge = standardBadge(standard);

  if (variant === 'inline') {
    return (
      <InlineCard
        mint={mint}
        meta={meta}
        status={status}
        badge={badge}
        onClick={onClick}
      />
    );
  }

  // Full hero card
  return (
    <div
      onClick={onClick}
      className="relative w-full overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(56,189,248,0.06) 0%, rgba(0,0,0,0) 100%)',
        border: `1.5px solid ${CYAN}`,
        borderRadius: 20,
        padding: 18,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 18px 60px -22px rgba(56,189,248,0.35)',
      }}
    >
      {/* Subtle holographic foil overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(115deg, transparent 35%, rgba(56,189,248,0.06) 50%, transparent 65%)',
        }}
      />

      <div className="relative" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 10, color: CYAN, letterSpacing: '0.18em' }}
        >
          ★ NFT PRIZE
        </div>
        <div
          className="font-black italic uppercase"
          style={{
            fontSize: 8,
            color: badge.color,
            background: 'rgba(56,189,248,0.10)',
            border: `1px solid ${badge.color}33`,
            padding: '4px 8px',
            borderRadius: 6,
            letterSpacing: '0.18em',
          }}
        >
          {badge.label}
        </div>
      </div>

      {/* Artwork */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: '1 / 1',
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
        }}
      >
        {status === 'loading' && (
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(110deg, #0f0f12 8%, #1a1a1f 18%, #0f0f12 33%)',
              backgroundSize: '200% 100%',
              animation: 'st-shimmer 1.5s linear infinite',
            }}
          />
        )}
        {status === 'ready' && meta?.image && (
          <img
            src={meta.image}
            alt={meta.name}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }}
            onError={(e) => {
              // Fallback: show the placeholder if the image URL is dead
              (e.target as HTMLImageElement).style.display = 'none';
              setStatus('error');
            }}
          />
        )}
        {status === 'error' && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: '#52525b', fontSize: 11, textAlign: 'center', padding: 16 }}
          >
            <div>
              <div className="font-black italic uppercase" style={{ fontSize: 9, letterSpacing: '0.18em', color: '#a1a1aa' }}>
                ARTWORK UNAVAILABLE
              </div>
              <div className="st-mono" style={{ fontSize: 10, marginTop: 6, color: '#71717a' }}>
                {shortMint(mint)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Name + collection */}
      <div className="relative" style={{ marginTop: 14 }}>
        {status === 'loading' ? (
          <>
            <div
              style={{
                height: 24,
                width: '60%',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 6,
              }}
            />
            <div
              style={{
                height: 12,
                width: '40%',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 4,
                marginTop: 8,
              }}
            />
          </>
        ) : (
          <>
            <div
              className="font-black italic"
              style={{
                fontSize: 22,
                color: '#fff',
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={meta?.name}
            >
              {meta?.name || shortMint(mint)}
            </div>
            <div
              className="font-black italic uppercase"
              style={{
                fontSize: 10,
                color: '#a1a1aa',
                letterSpacing: '0.14em',
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{meta?.collectionName || 'Unknown collection'}</span>
              {meta?.verified && (
                <span
                  className="font-black italic uppercase"
                  style={{
                    fontSize: 8,
                    color: CYAN,
                    background: 'rgba(56,189,248,0.12)',
                    padding: '2px 5px',
                    borderRadius: 4,
                    letterSpacing: '0.16em',
                  }}
                  title="Verified collection"
                >
                  ★
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Inline (compact) variant ───────────────────────────

interface InlineProps {
  mint: string;
  meta: NftMetadata | null;
  status: 'loading' | 'ready' | 'error';
  badge: { label: string; color: string };
  onClick?: () => void;
}

const InlineCard: React.FC<InlineProps> = ({ mint, meta, status, badge, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex items-center gap-3 w-full text-left"
      style={{
        background: 'rgba(56,189,248,0.06)',
        border: `1px solid ${CYAN}55`,
        borderRadius: 12,
        padding: 12,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{
          width: 56,
          height: 56,
          borderRadius: 10,
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {status === 'loading' && (
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(110deg, #0f0f12 8%, #1a1a1f 18%, #0f0f12 33%)',
              backgroundSize: '200% 100%',
              animation: 'st-shimmer 1.5s linear infinite',
            }}
          />
        )}
        {status === 'ready' && meta?.thumbnail && (
          <img
            src={meta.thumbnail}
            alt={meta.name}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="font-black italic"
          style={{
            fontSize: 14,
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {meta?.name || shortMint(mint)}
        </div>
        <div
          className="font-black italic uppercase"
          style={{
            fontSize: 9,
            color: '#71717a',
            letterSpacing: '0.14em',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {meta?.collectionName || shortMint(mint)}
        </div>
      </div>
      <div
        className="font-black italic uppercase flex-shrink-0"
        style={{
          fontSize: 8,
          color: badge.color,
          background: 'rgba(56,189,248,0.10)',
          border: `1px solid ${badge.color}33`,
          padding: '4px 7px',
          borderRadius: 5,
          letterSpacing: '0.16em',
        }}
      >
        {badge.label}
      </div>
    </button>
  );
};

export default NftPrizeCard;
