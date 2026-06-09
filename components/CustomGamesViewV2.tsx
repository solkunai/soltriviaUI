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
// Featured strip is now driven by custom_games.is_featured = true (admin-only,
// EF-enforced). v2.1 dropped the hardcoded OFFICIAL_TOPICS slug list in favor
// of the is_featured boolean column so admin can pick any slug + toggle
// featured on/off via the wizard. Cards render the real game name + plays.
type FeaturedGame = {
  slug: string;
  name: string;
  plays: number;
  status: string;
  entryFeeLamports: number;
  expiresAt: string | null;
  prizeModel: string;
};

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
  // Featured-by-Sol-Trivia games (admin-curated). Drives the swipeable strip.
  const [featuredGames, setFeaturedGames] = useState<FeaturedGame[]>([]);
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
            .select('slug, name, total_plays, status, entry_fee_lamports, expires_at, prize_model')
            .eq('is_featured', true)
            .in('status', ['active', 'started'])
            .order('created_at', { ascending: false })
            .limit(10),
        ]);
        if (!mounted) return;

        const featured: FeaturedGame[] = ((officialRes.data ?? []) as any[]).map((g) => ({
          slug: g.slug,
          name: g.name ?? 'Featured Game',
          plays: g.total_plays ?? 0,
          status: g.status ?? 'active',
          entryFeeLamports: g.entry_fee_lamports ?? 0,
          expiresAt: g.expires_at ?? null,
          prizeModel: g.prize_model ?? 'free',
        }));
        setFeaturedGames(featured);

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

        // Featured games live in the FEATURED strip only — keep them out of
        // the community JOIN / MY GAMES / ENDED lists. is_featured is the source
        // of truth (admin-curated); slug-prefix legacy check kept as a fallback
        // until any pre-migration "official-*" rows are cleared.
        const featuredSlugSet = new Set(featured.map((f) => f.slug));
        const isOfficial = (g: any) =>
          featuredSlugSet.has(String(g.slug ?? '')) ||
          String(g.slug ?? '').startsWith('official-');
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

      {/* Unified hero — mirrors the Duels "READY TO 1V1?" pattern. Cyan
          gradient + bold tagline + CREATE on the right + JOIN CODE inline
          below. Zero behavior change to onCreate / onJoinByCode handlers. */}
      <div
        className="rounded-2xl mb-5"
        style={{
          background: 'linear-gradient(135deg,#38BDF8 0%,#7CD4F5 100%)',
          color: '#000',
          padding: '24px 28px',
          boxShadow: '0 22px 50px -22px rgba(56,189,248,0.7)',
        }}
      >
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.14em' }}
            >
              CREATE OR JOIN
            </div>
            <div
              className="font-black italic uppercase mt-1"
              style={{ fontSize: isMobile ? 26 : 36, lineHeight: 1, letterSpacing: '-0.02em' }}
            >
              BUILD YOUR OWN CUSTOM TRIVIA GAME
            </div>
            <div
              className="font-black italic uppercase mt-2"
              style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}
            >
              0.005 SOL TO HOST · PASS HOLDERS FREE
            </div>
          </div>
          <button
            onClick={onCreate}
            className="font-black italic uppercase rounded-full active:opacity-90"
            style={{
              background: '#000',
              color: '#fff',
              padding: '14px 28px',
              fontSize: 13,
              letterSpacing: '0.14em',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            CREATE GAME →
          </button>
        </div>

        {/* Inline JOIN CODE row */}
        <div className="flex items-center gap-3 mt-5 flex-wrap">
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}
          >
            JOIN PRIVATE ROOM
          </div>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="XXX-XXX"
            className="rounded-lg outline-none flex-1"
            style={{
              background: 'rgba(0,0,0,0.18)',
              border: '1px solid rgba(0,0,0,0.30)',
              color: '#000',
              fontFamily: 'JetBrains Mono, Menlo, monospace',
              fontSize: 16,
              letterSpacing: '0.15em',
              padding: '10px 14px',
              minWidth: 140,
            }}
          />
          <button
            onClick={handleJoin}
            disabled={joinCode.trim().length < 3}
            className="font-black italic uppercase rounded-full active:opacity-90"
            style={{
              background: joinCode.trim().length >= 3 ? '#000' : 'rgba(0,0,0,0.18)',
              color: joinCode.trim().length >= 3 ? '#fff' : 'rgba(0,0,0,0.45)',
              border: 'none',
              padding: '10px 22px',
              fontSize: 12,
              letterSpacing: '0.14em',
              cursor: joinCode.trim().length >= 3 ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            JOIN →
          </button>
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
          {featuredGames.length === 0 && (
            <div
              className="rounded-xl text-zinc-500 text-[11px] italic"
              style={{
                background: 'rgba(255,215,0,0.04)',
                border: '1.5px dashed rgba(255,215,0,0.25)',
                padding: '20px 16px',
                width: isMobile ? '78%' : '100%',
                flex: '0 0 auto',
              }}
            >
              No featured games yet , the founder will drop some soon.
            </div>
          )}
          {featuredGames.map((g) => {
            const entryLabel = g.entryFeeLamports > 0
              ? `${(g.entryFeeLamports / SOL).toFixed(g.entryFeeLamports / SOL >= 1 ? 2 : 3)} SOL`
              : 'FREE';
            return (
              <button
                key={g.slug}
                onClick={() => onView?.(g.slug)}
                className="rounded-xl text-left active:opacity-90"
                style={{
                  background: 'rgba(255,215,0,0.06)',
                  border: '1.5px solid rgba(255,215,0,0.4)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  color: '#fff',
                  flex: '0 0 auto',
                  width: isMobile ? '78%' : 'calc((100% - 30px) / 4)',
                  minWidth: isMobile ? 220 : 160,
                  scrollSnapAlign: 'start',
                }}
              >
                <div
                  className="font-black italic uppercase flex items-center gap-1"
                  style={{ fontSize: 8, color: '#FFD700', letterSpacing: '0.18em' }}
                >
                  ★ {entryLabel}
                </div>
                <div
                  className="font-black italic uppercase mt-2"
                  style={{ fontSize: 14, letterSpacing: '-0.01em' }}
                >
                  {g.name}
                </div>
                <div
                  className="font-black italic uppercase mt-3"
                  style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}
                >
                  {g.plays.toLocaleString()} PLAYS · {g.status.toUpperCase()}
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
              className="font-black italic uppercase rounded-2xl mt-6 active:scale-95 transition-transform"
              style={{
                background: '#38BDF8',
                color: '#000',
                padding: isMobile ? '20px 32px' : '24px 48px',
                fontSize: isMobile ? 22 : 32,
                letterSpacing: '-0.02em',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(56, 189, 248, 0.4)',
                width: isMobile ? '100%' : 'auto',
                maxWidth: 360,
              }}
            >
              CREATE A GAME →
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
          {rooms.map((r) => {
            // ── Gate 4 row accent rule (cross-platform locked color mapping
            //     mirror of native commit e256721 2026-06-04) ──
            //  r.ended           → zinc #71717a (archive)
            //  r.hot             → yellow #FCD34D (urgent / in-progress feel)
            //  tab === MY GAMES  → cyan #38BDF8 (yours)
            //  default joinable  → green #14F195 (playable now)
            const accentColor: string = r.ended
              ? '#71717a'
              : r.hot
              ? '#FCD34D'
              : tab === 'MY GAMES'
              ? '#38BDF8'
              : '#14F195';
            return (
            <div
              key={r.slug}
              className="rounded-xl relative overflow-hidden"
              style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '14px 16px 14px 19px',
                opacity: r.ended ? 0.6 : 1,
              }}
            >
              {/* Solid color LEFT-RULE , the Gate 4 cross-screen visual signature */}
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: 3,
                  background: accentColor,
                }}
              />
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomGamesViewV2;
