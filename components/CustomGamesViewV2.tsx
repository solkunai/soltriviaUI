/**
 * CustomGamesViewV2 — web W5 (browse). Editorial header + blue CREATE
 * gradient hero + JOIN BY CODE input + OFFICIAL gold strip + filter tabs
 * + 3-col room grid. Real data via custom_games (active + ended).
 */
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { useWallet } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';

interface Props {
  onCreate?: () => void;
  onJoinByCode?: (code: string) => void;
  onView?: (slug: string) => void;
}

type Tab = 'JOIN' | 'MY GAMES' | 'ENDED';

// Canonical free always-on official games. Slugs match the custom_games rows
// created server-side; total_plays + clickability come from real data.
// Canonical roster per [[project-official-custom-games]] (locked 4 games):
// degen crypto CT, current events, NFT topic, sports. Native matches; web
// previously drifted with 5 (added ct-lore + memecoins + wrong NFT slug)
// which would have shown different OFFICIAL games per platform. Aligned now.
const OFFICIAL_TOPICS = [
  { slug: 'official-degen-ct', name: 'Degen Crypto CT', blurb: 'Crypto Twitter drama, legends, ticker chaos' },
  { slug: 'official-current-events', name: 'Current Events', blurb: 'Biggest crypto + tech news' },
  { slug: 'official-nft-topic', name: 'NFT Topic', blurb: 'Collections, floors, mint mechanics' },
  { slug: 'official-sports', name: 'Sports', blurb: 'Broad sports trivia' },
];

// Display shape the room grid renders. Mapped from custom_games rows.
type RoomRow = {
  slug: string;
  name: string;
  host: string;
  entry: number; // SOL
  players: number;
  max: number;
  prizeModel: string;
  expires: string;
  hot?: boolean;
  ended?: boolean;
  // NFT prize fields (only populated when prizeModel === 'nft')
  nftMint?: string | null;
  nftStandard?: 'core' | 'pnft' | null;
};

const SOL = 1_000_000_000;

function shortWallet(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function expiryLabel(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ENDED';
  const h = Math.floor(ms / 3_600_000);
  if (h >= 24) return `${Math.floor(h / 24)}D LEFT`;
  if (h >= 1) return `${h}H LEFT`;
  return `${Math.max(1, Math.floor(ms / 60_000))}M LEFT`;
}

const CustomGamesViewV2: React.FC<Props> = ({ onCreate, onJoinByCode, onView }) => {
  const [tab, setTab] = useState<Tab>('JOIN');
  const [joinCode, setJoinCode] = useState('');
  const isMobile = useIsMobile();
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  const [joinable, setJoinable] = useState<RoomRow[]>([]);
  const [myGames, setMyGames] = useState<RoomRow[]>([]);
  const [ended, setEnded] = useState<RoomRow[]>([]);
  // Real official games keyed by slug → { plays, exists }. Drives the strip.
  const [officialBySlug, setOfficialBySlug] = useState<Record<string, { plays: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const nowIso = new Date().toISOString();
        const [activeRes, endedRes, officialRes] = await Promise.all([
          supabase
            .from('custom_games')
            .select(
              'slug, name, creator_wallet, prize_model, entry_fee_lamports, player_count, max_players, expires_at, created_at, status, nft_mint, nft_standard',
            )
            .eq('status', 'active')
            .gt('expires_at', nowIso)
            .order('created_at', { ascending: false })
            .limit(30),
          supabase
            .from('custom_games')
            .select(
              'slug, name, creator_wallet, prize_model, entry_fee_lamports, player_count, max_players, expires_at, status, nft_mint, nft_standard',
            )
            .in('status', ['completed', 'finalized', 'expired'])
            .order('expires_at', { ascending: false })
            .limit(20),
          supabase
            .from('custom_games')
            .select('slug, total_plays')
            .in('slug', OFFICIAL_TOPICS.map((t) => t.slug)),
        ]);
        if (!mounted) return;

        const officialMap: Record<string, { plays: number }> = {};
        for (const g of (officialRes.data ?? []) as any[]) {
          officialMap[g.slug] = { plays: g.total_plays ?? 0 };
        }
        setOfficialBySlug(officialMap);

        const toRoom = (g: any, isEnded = false): RoomRow => ({
          slug: g.slug ?? '',
          name: g.name ?? 'Custom Game',
          host: g.creator_wallet ? shortWallet(g.creator_wallet) : '—',
          entry: (g.entry_fee_lamports ?? 0) / SOL,
          players: g.player_count ?? 0,
          max: g.max_players ?? 0,
          prizeModel: g.prize_model ?? 'free',
          expires: isEnded ? 'ENDED' : expiryLabel(g.expires_at),
          hot: (g.player_count ?? 0) >= 6,
          ended: isEnded,
          nftMint: g.nft_mint ?? null,
          nftStandard: g.nft_standard ?? null,
        });

        // Official games live in the FEATURED strip only — keep them out of
        // the community JOIN / MY GAMES / ENDED lists.
        const isOfficial = (g: any) => String(g.slug ?? '').startsWith('official-');
        const activeRows = (activeRes.data ?? []).filter((g: any) => !isOfficial(g));
        const endedRows = (endedRes.data ?? []).filter((g: any) => !isOfficial(g));

        setJoinable(
          walletAddress
            ? activeRows.filter((g: any) => g.creator_wallet !== walletAddress).map((g) => toRoom(g))
            : activeRows.map((g) => toRoom(g)),
        );
        setMyGames(
          walletAddress
            ? activeRows.filter((g: any) => g.creator_wallet === walletAddress).map((g) => toRoom(g))
            : [],
        );
        setEnded(endedRows.map((g) => toRoom(g, true)));
      } catch (err) {
        console.error('Failed to fetch custom games:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [walletAddress]);

  const rooms: RoomRow[] =
    tab === 'JOIN' ? joinable : tab === 'MY GAMES' ? myGames : ended;

  const handleJoin = () => {
    if (joinCode.trim().length >= 3) {
      onJoinByCode?.(joinCode.trim());
    }
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 11, color: '#38BDF8', letterSpacing: '0.18em' }}
        >
          ● {joinable.length + myGames.length} ACTIVE · COMMUNITY HOSTED
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          CUSTOM GAMES
        </h1>
      </div>

      {/* 2-col: CREATE hero + JOIN code */}
      <div
        className="mb-5"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 14 }}
      >
        <button
          onClick={onCreate}
          className="rounded-2xl text-left active:opacity-95"
          style={{
            background: 'linear-gradient(110deg,#38BDF8 0%,#0EA5E9 100%)',
            color: '#000',
            padding: '18px 22px',
            boxShadow: '0 22px 50px -22px rgba(56,189,248,0.6)',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}
          >
            MAKE YOUR OWN ROOM
          </div>
          <div
            className="font-black italic uppercase mt-1"
            style={{ fontSize: 28, lineHeight: 1, letterSpacing: '-0.02em' }}
          >
            CREATE GAME →
          </div>
          <div
            className="font-black italic uppercase mt-2"
            style={{ fontSize: 9, opacity: 0.7, letterSpacing: '0.14em' }}
          >
            0.005 SOL TO HOST · PASS HOLDERS FREE
          </div>
        </button>

        <div
          className="rounded-2xl"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255,49,49,0.27)',
            padding: '14px 16px',
          }}
        >
          <div
            className="font-black italic uppercase mb-2"
            style={{ fontSize: 10, color: '#FF3131', letterSpacing: '0.18em' }}
          >
            JOIN PRIVATE ROOM
          </div>
          <div className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXX-XXX"
              className="flex-1 rounded-lg outline-none"
              style={{
                background: '#000',
                border: '1px solid rgba(255,49,49,0.3)',
                color: '#fff',
                fontFamily: 'JetBrains Mono, Menlo, monospace',
                fontSize: 16,
                letterSpacing: '0.15em',
                padding: '10px 14px',
              }}
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.trim().length < 3}
              className="font-black italic uppercase rounded-lg active:opacity-90"
              style={{
                background: joinCode.trim().length >= 3 ? '#FF3131' : '#0a0a0a',
                color: joinCode.trim().length >= 3 ? '#000' : '#52525b',
                border: joinCode.trim().length < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                padding: '0 18px',
                fontSize: 11,
                letterSpacing: '0.14em',
                cursor: joinCode.trim().length >= 3 ? 'pointer' : 'not-allowed',
              }}
            >
              JOIN
            </button>
          </div>
        </div>
      </div>

      {/* FEATURED strip — free always-on official games (horizontal carousel) */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase mb-2 flex items-center gap-2"
          style={{ fontSize: 10, color: '#FFD700', letterSpacing: '0.18em' }}
        >
          <span>★</span> FEATURED · BY SOL TRIVIA
        </div>
        <div
          className="[&::-webkit-scrollbar]:hidden"
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            paddingBottom: 2,
            // Negative side padding so cards align flush with the page edge on
            // mobile, then padding inside restores breathing room before the
            // first/after the last card. Lets the next card peek subtly.
            marginLeft: isMobile ? -16 : 0,
            marginRight: isMobile ? -16 : 0,
            paddingLeft: isMobile ? 16 : 0,
            paddingRight: isMobile ? 16 : 0,
          } as React.CSSProperties}
        >
          {OFFICIAL_TOPICS.map((r) => {
            const live = officialBySlug[r.slug];
            const exists = !!live;
            return (
              <button
                key={r.slug}
                onClick={() => exists && onView?.(r.slug)}
                disabled={!exists}
                className="rounded-xl text-left active:opacity-90"
                style={{
                  background: 'rgba(255,215,0,0.06)',
                  border: '1.5px solid rgba(255,215,0,0.4)',
                  padding: '12px 14px',
                  cursor: exists ? 'pointer' : 'default',
                  color: '#fff',
                  opacity: exists ? 1 : 0.55,
                  // Carousel sizing: mobile reveals one full card with the next
                  // peeking (~78% viewport); desktop fits all 5 visible with
                  // even spacing (no scroll needed in practice but gracefully
                  // supports future additions).
                  flex: '0 0 auto',
                  // 4-card layout: 3 gaps × 10px = 30px subtracted.
                  width: isMobile ? '78%' : 'calc((100% - 30px) / 4)',
                  minWidth: isMobile ? 220 : 160,
                  scrollSnapAlign: 'start',
                }}
              >
                <div
                  className="font-black italic uppercase flex items-center gap-1"
                  style={{ fontSize: 8, color: '#FFD700', letterSpacing: '0.18em' }}
                >
                  ★ {exists ? 'FREE' : 'SOON'}
                </div>
                <div className="font-black italic uppercase mt-2" style={{ fontSize: 14, letterSpacing: '-0.01em' }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 10, color: '#d4d4d8', marginTop: 4, lineHeight: 1.3 }}>
                  {r.blurb}
                </div>
                <div
                  className="font-black italic uppercase mt-3"
                  style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}
                >
                  {exists ? `${live.plays.toLocaleString()} PLAYS` : 'COMING SOON'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['JOIN', 'MY GAMES', 'ENDED'] as Tab[]).map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="font-black italic uppercase rounded-full active:opacity-90"
              style={{
                background: on ? 'rgba(56,189,248,0.13)' : 'transparent',
                border: `1px solid ${on ? '#38BDF8' : 'rgba(255,255,255,0.1)'}`,
                color: on ? '#38BDF8' : '#a1a1aa',
                padding: '8px 16px',
                fontSize: 11,
                letterSpacing: '0.14em',
                cursor: 'pointer',
              }}
            >
              {id}
            </button>
          );
        })}
      </div>

      {/* Room grid (real custom_games) */}
      {loading ? (
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 11, color: '#52525b', letterSpacing: '0.18em', padding: '24px 0', textAlign: 'center' }}
        >
          LOADING ROOMS…
        </div>
      ) : rooms.length === 0 ? (
        <div
          className="rounded-xl"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '32px 18px',
            textAlign: 'center',
          }}
        >
          <div
            className="font-black italic uppercase text-white"
            style={{ fontSize: 13, letterSpacing: '0.06em' }}
          >
            {tab === 'JOIN'
              ? 'NO OPEN ROOMS RIGHT NOW'
              : tab === 'MY GAMES'
                ? 'YOU HAVEN’T HOSTED A ROOM YET'
                : 'NO ENDED ROOMS'}
          </div>
          {tab !== 'ENDED' ? (
            <button
              onClick={onCreate}
              className="font-black italic uppercase rounded-full mt-4 active:opacity-90"
              style={{
                background: '#38BDF8',
                color: '#000',
                padding: '10px 22px',
                fontSize: 11,
                letterSpacing: '0.14em',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              HOST A ROOM →
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
          {rooms.map((r) => (
            <div
              key={r.slug}
              className="rounded-xl"
              style={{
                background: '#0a0a0a',
                border: `1.5px solid ${r.hot ? '#FFD700' : 'rgba(56,189,248,0.3)'}`,
                padding: '14px 16px',
                opacity: r.ended ? 0.6 : 1,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-black italic uppercase rounded-full"
                  style={{
                    fontSize: 8,
                    color: '#38BDF8',
                    background: 'rgba(56,189,248,0.13)',
                    border: '1px solid rgba(56,189,248,0.4)',
                    padding: '2px 7px',
                    letterSpacing: '0.14em',
                  }}
                >
                  {r.prizeModel === 'nft'
                    ? `NFT PRIZE${r.nftStandard ? ` · ${r.nftStandard.toUpperCase()}` : ''}`
                    : r.prizeModel === 'creator_funded'
                      ? 'CREATOR PRIZE'
                      : r.prizeModel === 'player_funded'
                        ? 'PRIZE POOL'
                        : 'FREE'}
                </span>
                {r.hot ? (
                  <span
                    className="font-black italic uppercase"
                    style={{ fontSize: 8, color: '#FFD700', letterSpacing: '0.14em' }}
                  >
                    HOT 🔥
                  </span>
                ) : null}
              </div>
              <div
                className="font-black italic uppercase mt-2 text-white"
                style={{ fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.1 }}
              >
                {r.name}
              </div>
              <div
                className="font-black italic uppercase mt-1"
                style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}
              >
                BY {r.host}
              </div>
              <div className="flex items-center gap-2 mt-3">
                {r.entry > 0 ? (
                  <span
                    className="font-black italic"
                    style={{
                      fontSize: 13,
                      color: '#FFD700',
                      letterSpacing: '-0.02em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {r.entry} SOL
                  </span>
                ) : (
                  <span
                    className="font-black italic uppercase"
                    style={{ fontSize: 11, color: '#14F195', letterSpacing: '0.1em' }}
                  >
                    FREE
                  </span>
                )}
                {r.max > 0 ? (
                  <span style={{ fontSize: 10, color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>
                    · {r.players}/{r.max}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: '#71717a', fontVariantNumeric: 'tabular-nums' }}>
                    · {r.players} in
                  </span>
                )}
                <div className="flex-1" />
                <span
                  className="font-black italic uppercase"
                  style={{
                    fontSize: 8,
                    color: '#71717a',
                    letterSpacing: '0.14em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {r.expires}
                </span>
              </div>
              <button
                onClick={() => onView?.(r.slug)}
                className="w-full font-black italic uppercase rounded-full mt-3 active:opacity-90"
                style={{
                  background: r.ended ? '#0a0a0a' : '#38BDF8',
                  color: r.ended ? '#a1a1aa' : '#000',
                  border: r.ended ? '1px solid rgba(255,255,255,0.15)' : 'none',
                  padding: '8px 0',
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                }}
              >
                {r.ended ? 'VIEW →' : 'JOIN →'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomGamesViewV2;
