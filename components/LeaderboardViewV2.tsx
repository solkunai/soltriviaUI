/**
 * LeaderboardViewV2 — web W10. Editorial header + filter tabs + total pool
 * chip + 5-place Olympic podium (5-3-1-2-4) + list for ranks 6+.
 *
 * Real data:
 *   ALL-TIME / THIS WEEK → getLeaderboard (XP) + getTotalSolWonByWallets (SOL).
 *   ROUNDS / DUELS / CUSTOM → getModeLeaderboard (SOL won + wins per wallet).
 */
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { useWallet } from '../src/contexts/WalletContext';
import { getLeaderboard, getTotalSolWonByWallets, getModeLeaderboard } from '../src/utils/api';

type Player = {
  rank: number;
  user: string;
  /** Primary green metric: XP for global tabs, win-count for mode tabs. */
  metric: number;
  sol: number;
  games: number;
  /** Color fallback background when no avatar URL. */
  avatar: string;
  /** Supabase Storage URL when the player uploaded a PFP. */
  avatarUrl?: string;
  col: string;
  badge?: string;
};

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 15_000;

const TABS = ['ALL-TIME', 'ROUNDS', 'DUELS', 'CUSTOM', 'THIS WEEK'] as const;
type Tab = (typeof TABS)[number];

const SOL = 1_000_000_000;
const PODIUM_COLS = ['#FFD700', '#a1a1aa', '#fb923c', '#22D3EE', '#F472B6'];
const BADGES = ['🥇', '🥈', '🥉'];
const AVATAR_COLORS = ['#FFC857', '#FF8C42', '#A78BFA', '#22D3EE', '#FACC15', '#F472B6', '#14F195'];

function shortWallet(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}
function colorFor(w: string): string {
  let h = 0;
  for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

function PodiumColumn({ player, isMode, isMobile = false }: { player: Player; isMode: boolean; isMobile?: boolean }) {
  const isFirst = player.rank === 1;
  const isTop3 = player.rank <= 3;
  // Tighten everything for mobile so 5 columns fit in a 375px viewport
  // without horizontal scroll. Was 130px each → 340px+. Now ~58px each.
  const blockH = isMobile
    ? (player.rank === 1 ? 92 : player.rank === 2 || player.rank === 3 ? 64 : 40)
    : (player.rank === 1 ? 132 : player.rank === 2 || player.rank === 3 ? 88 : 52);
  const avatarSize = isMobile ? (isFirst ? 36 : 28) : (isFirst ? 56 : 44);
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-full text-center relative rounded-xl"
        style={{
          background: '#0c0c0c',
          border: `1.5px solid ${player.col}`,
          padding: isMobile ? '8px 4px' : '12px 10px',
          marginBottom: 6,
        }}
      >
        {isTop3 ? (
          <div style={{ position: 'absolute', top: -12, left: 0, right: 0, textAlign: 'center', fontSize: isMobile ? 14 : 20 }}>
            {player.badge}
          </div>
        ) : null}
        <div
          className="mx-auto rounded-full overflow-hidden"
          style={{
            marginTop: isTop3 ? (isMobile ? 6 : 10) : 0,
            width: avatarSize,
            height: avatarSize,
            background: player.avatar,
            border: `2px solid ${player.col}`,
          }}
        >
          {player.avatarUrl ? (
            <img
              src={player.avatarUrl}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={(e) => {
                // PFP failed to load — hide the img so the color fallback shows.
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : null}
        </div>
        <div className="font-black italic uppercase mt-2 truncate" style={{ fontSize: isMobile ? 7 : 9, color: '#fff', letterSpacing: '0.1em' }}>
          {player.user}
        </div>
        <div
          className="font-black italic mt-1"
          style={{ fontSize: isMobile ? (isFirst ? 11 : 9) : (isFirst ? 16 : 13), color: '#14F195', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
        >
          {isMode ? `${player.metric} ${player.metric === 1 ? 'WIN' : 'WINS'}` : player.metric.toLocaleString()}
        </div>
        <div
          className="font-black italic uppercase mt-0.5"
          style={{ fontSize: isMobile ? 6 : 8, color: '#FFD700', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.12em' }}
        >
          {player.sol.toFixed(3)} SOL
        </div>
      </div>
      <div
        className="w-full flex items-start justify-center relative overflow-hidden"
        style={{ height: blockH, background: player.col, borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingTop: isFirst ? (isMobile ? 8 : 12) : (isMobile ? 6 : 8) }}
      >
        <div className="absolute left-0 right-0 top-0" style={{ height: 3, background: 'rgba(255,255,255,0.35)' }} />
        <span
          className="font-black italic"
          style={{
            fontSize: isMobile
              ? (isFirst ? 22 : player.rank === 2 || player.rank === 3 ? 18 : 14)
              : (isFirst ? 36 : player.rank === 2 || player.rank === 3 ? 26 : 20),
            color: '#000',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {player.rank}
        </span>
      </div>
    </div>
  );
}

const LeaderboardViewV2: React.FC = () => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const [tab, setTab] = useState<Tab>('ALL-TIME');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const isMode = tab === 'ROUNDS' || tab === 'DUELS' || tab === 'CUSTOM';

  // Reset to page 1 whenever the tab changes — different leaderboards.
  useEffect(() => {
    setPage(1);
  }, [tab]);

  // Load + auto-refresh the active tab + page every 15s. The "silent" branch
  // (no setLoading(true)) is used by the polling interval so the table doesn't
  // flash a LOADING state on every tick.
  useEffect(() => {
    let cancelled = false;

    const load = async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        let mapped: Player[] = [];
        let nextAvailable = false;
        let totalForTab: number | null = null;

        if (tab === 'ALL-TIME' || tab === 'THIS WEEK') {
          const period = tab === 'THIS WEEK' ? 'weekly' : 'all';
          const offset = (page - 1) * PAGE_SIZE;
          const resp = await getLeaderboard(undefined, walletAddress || undefined, period, offset);
          const entries = resp.leaderboard ?? [];
          const solMap = entries.length
            ? await getTotalSolWonByWallets(entries.map((e) => e.wallet_address)).catch(() => ({}))
            : {};
          mapped = entries.map((e, i) => {
            const rank = e.rank ?? offset + i + 1;
            // EF populates `avatar` from player_profiles.avatar_url, which is
            // either an https:// URL (newer Supabase Storage uploads) OR a
            // legacy data:image/... base64 URI (older uploads). Accept both.
            const isUrl = typeof e.avatar === 'string' && (
              /^https?:\/\//i.test(e.avatar) ||
              /^data:image\//i.test(e.avatar)
            );
            return {
              rank,
              user: e.display_name || shortWallet(e.wallet_address),
              metric: e.score,
              sol: (solMap[e.wallet_address] ?? 0) / SOL,
              games: e.games_played ?? 0,
              avatar: e.avatar_bg_color || colorFor(e.wallet_address),
              avatarUrl: isUrl ? e.avatar : undefined,
              col: rank <= 5 ? PODIUM_COLS[rank - 1] : '#a1a1aa',
              badge: rank <= 3 ? BADGES[rank - 1] : undefined,
            };
          });
          totalForTab = resp.total_count ?? null;
          nextAvailable = totalForTab != null
            ? (page * PAGE_SIZE) < totalForTab
            : entries.length === PAGE_SIZE;
        } else {
          const mode = tab === 'ROUNDS' ? 'rounds' : tab === 'DUELS' ? 'duels' : 'custom';
          const rows = await getModeLeaderboard(mode);
          totalForTab = rows.length;
          const startIdx = (page - 1) * PAGE_SIZE;
          const slice = rows.slice(startIdx, startIdx + PAGE_SIZE);
          mapped = slice.map((r, i) => {
            const rank = startIdx + i + 1;
            return {
              rank,
              user: r.display_name || shortWallet(r.wallet_address),
              metric: r.wins,
              sol: r.sol_lamports / SOL,
              games: r.wins,
              avatar: colorFor(r.wallet_address),
              col: rank <= 5 ? PODIUM_COLS[rank - 1] : '#a1a1aa',
              badge: rank <= 3 ? BADGES[rank - 1] : undefined,
            };
          });
          nextAvailable = (page * PAGE_SIZE) < rows.length;
        }

        if (!cancelled) {
          setPlayers(mapped);
          setHasNext(nextAvailable);
          setTotalCount(totalForTab);
        }
      } catch {
        if (!cancelled) {
          setPlayers([]);
          setHasNext(false);
        }
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    };

    load(false);
    const pollId = setInterval(() => {
      if (!cancelled) load(true);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [tab, walletAddress, page]);

  // Podium (top 5) only renders on page 1, since ranks 1-5 only live there.
  // Pages 2+ are pure list with whatever ranks 51+ are returned.
  const podium = page === 1 ? players.slice(0, 5) : [];
  const listBelow = page === 1 ? players.slice(5) : players;
  const totalSol = players.reduce((sum, p) => sum + p.sol, 0);

  // Adaptive Olympic ordering — centers rank 1, fans outward by rank, gracefully
  // handles 1-5 players. Avoids the left-aligned look when player count is low.
  //   1 player   → [1]
  //   2 players  → [2, 1]
  //   3 players  → [2, 1, 3]            (Olympic silver-gold-bronze)
  //   4 players  → [4, 2, 1, 3]
  //   5+ players → [5, 3, 1, 2, 4]
  const ORDERINGS: Record<number, number[]> = {
    1: [1],
    2: [2, 1],
    3: [2, 1, 3],
    4: [4, 2, 1, 3],
    5: [5, 3, 1, 2, 4],
  };
  const podiumOrder = ORDERINGS[Math.min(podium.length, 5)] || [];
  const podiumOrdered = podiumOrder
    .map((r) => podium.find((p) => p.rank === r))
    .filter(Boolean) as Player[];

  // Mobile drops the GAMES column. Mode tabs swap XP→WINS and drop GAMES.
  const listCols = isMode
    ? isMobile
      ? '24px 30px 1fr 64px 70px'
      : '30px 36px 1fr 100px 120px'
    : isMobile
      ? '24px 30px 1fr 64px'
      : '30px 36px 1fr 100px 120px 80px';

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}>
          GLOBAL · WORLDWIDE
        </div>
        <h1 className="font-black italic uppercase mt-1 text-white" style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
          LEGENDS{' '}
          <span
            style={{
              background: 'linear-gradient(90deg,#14F195 0%,#7C8DFF 50%,#9945FF 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            BOARD
          </span>
        </h1>
      </div>

      {/* Tabs + total pool chip */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-black italic uppercase rounded-full active:opacity-90"
            style={{
              background: tab === t ? 'rgba(20,241,149,0.13)' : 'transparent',
              border: `1px solid ${tab === t ? '#14F195' : 'rgba(255,255,255,0.1)'}`,
              color: tab === t ? '#14F195' : '#a1a1aa',
              padding: '8px 14px',
              fontSize: 10,
              letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" />
        <span
          className="inline-flex items-center gap-2 rounded-full"
          style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)', padding: '7px 14px' }}
        >
          <span className="font-black italic uppercase" style={{ fontSize: 9, color: '#FFD700', letterSpacing: '0.14em' }}>
            TOTAL WON
          </span>
          <span
            className="font-black italic text-white"
            style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
          >
            {totalSol.toFixed(3)} SOL
          </span>
        </span>
      </div>

      {loading ? (
        <div
          className="rounded-xl flex items-center justify-center"
          style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.08)', height: 280 }}
        >
          <span className="font-black italic uppercase" style={{ fontSize: 11, color: '#52525b', letterSpacing: '0.18em' }}>
            LOADING…
          </span>
        </div>
      ) : players.length === 0 ? (
        <div
          className="rounded-xl flex flex-col items-center justify-center gap-2"
          style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.08)', height: 280 }}
        >
          <span className="font-black italic uppercase text-white" style={{ fontSize: 16, letterSpacing: '-0.01em' }}>
            NO LEGENDS YET
          </span>
          <span className="font-black italic uppercase" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.14em' }}>
            {isMode ? 'BE THE FIRST TO WIN' : 'PLAY TO CLAIM YOUR SPOT'}
          </span>
        </div>
      ) : (
        <>
          {/* Olympic podium — on mobile fill the viewport with grid 1fr (no
              max-width cap) and shrink all internal sizes via isMobile flag.
              Was overflowing by ~13px causing horizontal swipe on the 4th slot.
              Kyle 2026-06-09. */}
          {podiumOrdered.length > 0 && (
            <div
              className="mb-5 mx-auto"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${podiumOrdered.length}, 1fr)`,
                gap: isMobile ? 3 : 8,
                alignItems: 'flex-end',
                maxWidth: isMobile ? '100%' : `${podiumOrdered.length * 130}px`,
                width: '100%',
              }}
            >
              {podiumOrdered.map((p) => (
                <PodiumColumn key={p.rank} player={p} isMode={isMode} isMobile={isMobile} />
              ))}
            </div>
          )}

          {/* Ranks 6+ list */}
          {listBelow.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div
                className="font-black italic uppercase"
                style={{
                  display: 'grid',
                  gridTemplateColumns: listCols,
                  gap: 14,
                  alignItems: 'center',
                  padding: '10px 18px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 9,
                  color: '#52525b',
                  letterSpacing: '0.18em',
                }}
              >
                <span>#</span>
                <span />
                <span>PLAYER</span>
                <span style={{ textAlign: 'right' }}>{isMode ? 'WINS' : 'XP'}</span>
                <span style={{ textAlign: 'right' }}>SOL WON</span>
                {!isMode && !isMobile && <span style={{ textAlign: 'right' }}>GAMES</span>}
              </div>
              {listBelow.map((r, i) => (
                <div
                  key={r.rank}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: listCols,
                    gap: 14,
                    alignItems: 'center',
                    padding: '12px 18px',
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <span
                    className="font-black italic"
                    style={{ fontSize: 16, color: '#a1a1aa', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
                  >
                    #{r.rank}
                  </span>
                  <span
                    className="rounded-full overflow-hidden"
                    style={{ width: 28, height: 28, background: r.avatar, border: '1px solid rgba(255,255,255,0.1)', display: 'inline-block' }}
                  >
                    {r.avatarUrl ? (
                      <img
                        src={r.avatarUrl}
                        alt=""
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                  </span>
                  <span className="font-black italic uppercase truncate text-white" style={{ fontSize: 13, letterSpacing: '-0.01em' }}>
                    {r.user}
                  </span>
                  <span
                    className="font-black italic"
                    style={{ fontSize: 14, color: '#14F195', textAlign: 'right', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
                  >
                    {r.metric.toLocaleString()}
                  </span>
                  <span
                    className="font-black italic"
                    style={{ fontSize: 14, color: '#FFD700', textAlign: 'right', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
                  >
                    {r.sol.toFixed(3)}
                  </span>
                  {!isMode && !isMobile && (
                    <span
                      className="font-black italic"
                      style={{ fontSize: 12, color: '#71717a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {r.games}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination: NEXT / BACK pills. Hidden on page 1 with no next available. */}
          {(page > 1 || hasNext) && (
            <div className="flex items-center justify-between gap-3 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="font-black italic uppercase rounded-full"
                style={{
                  background: page <= 1 ? 'rgba(255,255,255,0.04)' : 'rgba(20,241,149,0.13)',
                  border: `1px solid ${page <= 1 ? 'rgba(255,255,255,0.08)' : '#14F195'}`,
                  color: page <= 1 ? '#52525b' : '#14F195',
                  padding: '8px 14px',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← BACK
              </button>
              <span
                className="font-black italic uppercase"
                style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.14em' }}
              >
                PAGE {page}{totalCount != null ? ` · ${totalCount.toLocaleString()} TOTAL` : ''}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
                className="font-black italic uppercase rounded-full"
                style={{
                  background: !hasNext ? 'rgba(255,255,255,0.04)' : 'rgba(20,241,149,0.13)',
                  border: `1px solid ${!hasNext ? 'rgba(255,255,255,0.08)' : '#14F195'}`,
                  color: !hasNext ? '#52525b' : '#14F195',
                  padding: '8px 14px',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  cursor: !hasNext ? 'not-allowed' : 'pointer',
                }}
              >
                NEXT →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LeaderboardViewV2;
