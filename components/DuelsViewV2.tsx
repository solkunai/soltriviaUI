/**
 * DuelsViewV2 — web W4. Editorial header + red CREATE gradient hero with
 * inline wager picker + 2-col (open duels list + recent duels). Real data
 * via getOpenDuels + fetchCompletedDuels, polled every 10s.
 *
 * v2.1: added SOL/SPL toggle in the create hero. SPL path opens the
 * SPLSelector, then renders a free-form amount input (presets only make
 * sense for SOL where 0.01-1 is a meaningful range). The on-chain ix is
 * always create_duel_spl when an SPL token is chosen; SOL flow unchanged.
 */
import React, { useState, useEffect } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { useWallet } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';
import { getOpenDuels, fetchCompletedDuels } from '../src/utils/api';
import SPLSelector from './SPLSelector';
import type { TokenAsset } from '../src/hooks/useWalletSPL';

/**
 * Token info passed back to the parent's onCreateDuel callback when the user
 * picked an SPL token wager. When undefined, the parent uses the SOL path.
 */
export interface DuelTokenChoice {
  mint: string;
  symbol: string;
  decimals: number;
  /** 'spl' (classic SPL Token program) or 'token2022'. Defaults to 'spl'. */
  tokenProgram?: 'spl' | 'token2022';
}

interface Props {
  walletConnected: boolean;
  /**
   * Create-duel callback. `wager` is in DISPLAY units:
   *  - SOL path (token=undefined): decimal SOL (e.g. 0.1)
   *  - SPL path (token defined):  decimal token units (e.g. 100 NERD)
   * Parent converts to raw units using the appropriate decimals.
   */
  onCreateDuel?: (wager: number, token?: DuelTokenChoice) => void;
  onJoinDuel?: (duelId: number) => void;
}

const SOL = 1_000_000_000;
const AVATAR_COLORS = ['#FFC857', '#FF8C42', '#A78BFA', '#22D3EE', '#FACC15', '#F472B6', '#14F195'];

type OpenRow = { duelId: number; user: string; wager: number; expires: string; avatar: string; hot?: boolean };
type RecentRow = { winner: string; loser: string; pot: number; when: string };

function shortWallet(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}
function colorFor(w: string): string {
  let h = 0;
  for (let i = 0; i < w.length; i++) h = (h * 31 + w.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'EXPIRED';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function relativeAgo(iso: string | null): string {
  if (!iso) return '';
  const delta = Date.now() - new Date(iso).getTime();
  const m = Math.floor(delta / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const WAGER_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

// SOL platform fee charged on top of every duel entry (matches contract).
const PLATFORM_FEE_SOL = 0.0025;

const DuelsViewV2: React.FC<Props> = ({ onCreateDuel, onJoinDuel }) => {
  const [wager, setWager] = useState(0.1);
  // v2.1 SPL: token mode + selected token + picker visibility + free-form
  // SPL amount input (presets are SOL-only since 0.01-1 is meaningful for SOL
  // but not for arbitrary tokens like BONK or NERD).
  const [tokenMode, setTokenMode] = useState<'sol' | 'spl'>('sol');
  const [selectedToken, setSelectedToken] = useState<TokenAsset | null>(null);
  const [splWagerInput, setSplWagerInput] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMobile = useIsMobile();
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  // Numeric SPL wager (display units). Empty / invalid → 0 (disables CTA).
  const splWager = (() => {
    const n = parseFloat(splWagerInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();

  const canCreate = tokenMode === 'sol'
    ? wager > 0
    : !!selectedToken && splWager > 0;

  const handleCreateClick = () => {
    if (!canCreate) return;
    if (tokenMode === 'sol') {
      onCreateDuel?.(wager);
    } else if (selectedToken) {
      onCreateDuel?.(splWager, {
        mint: selectedToken.mint,
        symbol: selectedToken.symbol,
        decimals: selectedToken.decimals ?? 9,
        // Token-2022 detection happens server-side / in the handler via RPC.
        // Default to classic SPL Token; handler upgrades to token2022 if the
        // mint owner is the Token-2022 program.
        tokenProgram: 'spl',
      });
    }
  };

  // Formatted CTA text depending on mode.
  const ctaText = (() => {
    if (tokenMode === 'sol') {
      const total = wager + PLATFORM_FEE_SOL;
      return `CREATE DUEL · ${total.toFixed(4)} SOL →`;
    }
    if (!selectedToken) return 'PICK A TOKEN →';
    if (splWager <= 0) return 'ENTER WAGER →';
    const display = splWager < 1
      ? splWager.toLocaleString(undefined, { maximumFractionDigits: 6 })
      : splWager.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `CREATE DUEL · ${display} ${selectedToken.symbol} + ${PLATFORM_FEE_SOL} SOL →`;
  })();

  const [openRows, setOpenRows] = useState<OpenRow[]>([]);
  const [recentRows, setRecentRows] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [open, completed] = await Promise.all([
          getOpenDuels().catch(() => []),
          fetchCompletedDuels(10).catch(() => ({ duels: [], totalCount: 0 })),
        ]);
        if (!mounted) return;

        // Open duels: hide my own (can't duel yourself). Resolve player1 usernames.
        const others = open.filter((d) => d.player1_wallet !== walletAddress);
        const wallets = [...new Set(others.map((d) => d.player1_wallet))];
        let nameByWallet: Record<string, string | null> = {};
        if (wallets.length > 0) {
          const { data } = await supabase
            .from('player_profiles')
            .select('wallet_address, username')
            .in('wallet_address', wallets);
          nameByWallet = Object.fromEntries((data ?? []).map((p: any) => [p.wallet_address, p.username]));
        }
        if (!mounted) return;
        setOpenRows(
          others.map((d) => ({
            duelId: d.duel_id,
            user: nameByWallet[d.player1_wallet] || shortWallet(d.player1_wallet),
            wager: (d.entry_fee_lamports ?? 0) / SOL,
            expires: countdown(d.expires_at),
            avatar: colorFor(d.player1_wallet),
            hot: (d.entry_fee_lamports ?? 0) / SOL >= 0.25,
          })),
        );

        setRecentRows(
          completed.duels
            .filter((d) => d.winner_wallet)
            .map((d) => {
              const winW = d.winner_wallet as string;
              const loseW = winW === d.player1_wallet ? d.player2_wallet : d.player1_wallet;
              const winName =
                winW === d.player1_wallet ? d.player1_username : d.player2_username;
              const loseName =
                winW === d.player1_wallet ? d.player2_username : d.player1_username;
              return {
                winner: winName || shortWallet(winW),
                loser: loseW ? loseName || shortWallet(loseW) : 'no-show',
                pot: (d.total_pot_lamports ?? 0) / SOL,
                when: relativeAgo(d.resolved_at ?? d.created_at),
              };
            }),
        );
      } catch (err) {
        console.error('Failed to load duels:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const id = window.setInterval(load, 10000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [walletAddress]);
  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 11, color: '#FF3131', letterSpacing: '0.18em' }}
        >
          1V1 · WINNER TAKES POT
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 54, lineHeight: 0.9, letterSpacing: '-0.02em' }}
        >
          DUELS
        </h1>
      </div>

      {/* Create hero */}
      <div
        className="rounded-2xl mb-5"
        style={{
          background: 'linear-gradient(135deg,#FF3131 0%,#FF7373 100%)',
          color: '#000',
          padding: '24px 28px',
          boxShadow: '0 22px 50px -22px rgba(255,49,49,0.7)',
        }}
      >
        <div className="flex items-end justify-between gap-6">
          <div>
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.14em' }}
            >
              CREATE A DUEL
            </div>
            <div
              className="font-black italic uppercase mt-1"
              style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.02em' }}
            >
              READY TO 1V1?
            </div>
          </div>
          <button
            onClick={handleCreateClick}
            disabled={!canCreate}
            className="font-black italic uppercase rounded-full active:opacity-90"
            style={{
              background: '#000',
              color: '#fff',
              padding: '14px 28px',
              fontSize: 13,
              letterSpacing: '0.14em',
              border: 'none',
              cursor: canCreate ? 'pointer' : 'not-allowed',
              opacity: canCreate ? 1 : 0.55,
            }}
          >
            {ctaText}
          </button>
        </div>

        {/* SOL / SPL toggle */}
        <div className="flex items-center gap-2 mt-5">
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}
          >
            TOKEN
          </div>
          <div className="flex" style={{ gap: 6 }}>
            {(['sol', 'spl'] as const).map((mode) => {
              const on = tokenMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setTokenMode(mode)}
                  className="font-black italic uppercase rounded-full active:opacity-90"
                  style={{
                    appearance: 'none',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: '6px 14px',
                    background: on ? '#000' : 'rgba(0,0,0,0.15)',
                    color: on ? '#FF3131' : '#000',
                    border: 'none',
                    letterSpacing: '0.14em',
                  }}
                >
                  {mode === 'sol' ? 'SOL' : 'ANY TOKEN'}
                </button>
              );
            })}
          </div>
        </div>

        {/* WAGER label adapts to mode */}
        <div
          className="font-black italic uppercase mt-4"
          style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}
        >
          WAGER · {tokenMode === 'sol' ? 'SOL' : (selectedToken?.symbol ?? 'PICK TOKEN')}
        </div>

        {/* SPL mode: token picker button + free-form amount input */}
        {tokenMode === 'spl' && (
          <div className="mt-2 flex flex-col gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="font-black italic uppercase rounded-lg active:opacity-90 flex items-center justify-between"
              style={{
                background: '#000',
                color: '#fff',
                padding: '12px 16px',
                fontSize: 13,
                letterSpacing: '0.12em',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <span>
                {selectedToken ? `${selectedToken.symbol} · ${selectedToken.balance} held` : 'CHOOSE TOKEN'}
              </span>
              <span style={{ opacity: 0.55, fontSize: 11 }}>▾</span>
            </button>
            <input
              type="text"
              inputMode="decimal"
              value={splWagerInput}
              onChange={(e) => {
                const v = e.target.value;
                if (/^\d*\.?\d*$/.test(v)) setSplWagerInput(v);
              }}
              placeholder={selectedToken ? `Amount in ${selectedToken.symbol}` : 'Pick a token first'}
              disabled={!selectedToken}
              className="font-black italic rounded-lg"
              style={{
                background: '#000',
                color: '#fff',
                padding: '12px 16px',
                fontSize: 18,
                border: 'none',
                outline: 'none',
                width: '100%',
                opacity: selectedToken ? 1 : 0.55,
              }}
            />
          </div>
        )}

        {/* SOL mode: classic 6-preset grid */}
        {tokenMode === 'sol' && (
        <div
          className="mt-2"
          style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(4, 1fr)' : 'repeat(7, 1fr)', gap: 8 }}
        >
          {WAGER_PRESETS.map((w) => {
            const on = wager === w;
            return (
              <button
                key={w}
                onClick={() => setWager(w)}
                className="font-black italic rounded-lg active:opacity-90"
                style={{
                  padding: '12px 0',
                  fontSize: 18,
                  background: on ? '#000' : 'rgba(0,0,0,0.15)',
                  color: on ? '#FF3131' : '#000',
                  border: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  cursor: 'pointer',
                }}
              >
                {w < 1 ? w.toFixed(2) : w.toFixed(0)}
              </button>
            );
          })}
          <button
            className="font-black italic uppercase rounded-lg active:opacity-90"
            style={{
              padding: '12px 0',
              fontSize: 11,
              background: 'rgba(0,0,0,0.15)',
              color: '#000',
              border: 'none',
              letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            CUSTOM
          </button>
        </div>
        )}

        {/* Mount the SPL picker as an absolute overlay on the hero so it
            stays scoped to the create flow. */}
        {pickerOpen && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setPickerOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 480, maxHeight: '85vh',
                background: '#050505', borderRadius: 20, padding: 0,
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
              }}
            >
              <SPLSelector
                walletAddress={walletAddress}
                selectedMint={selectedToken?.mint ?? null}
                onSelect={(t) => {
                  setSelectedToken(t);
                  setPickerOpen(false);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2-col: Open duels + Recent */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap: 18 }}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}
            >
              OPEN DUELS
            </span>
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 9, color: '#14F195', letterSpacing: '0.14em' }}
            >
              ↻ REFRESH
            </span>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {loading ? (
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.18em', padding: '24px 16px', textAlign: 'center' }}
              >
                LOADING OPEN DUELS…
              </div>
            ) : openRows.length === 0 ? (
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 11, color: '#71717a', letterSpacing: '0.06em', padding: '28px 16px', textAlign: 'center' }}
              >
                NO OPEN DUELS · CREATE ONE ABOVE
              </div>
            ) : (
              openRows.map((o, i) => (
                <div
                  key={o.duelId}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div
                    className="rounded-full flex items-center justify-center font-black italic"
                    style={{
                      width: 36,
                      height: 36,
                      background: `linear-gradient(135deg, ${o.avatar}, ${o.avatar}77)`,
                      border: `1.5px solid ${o.hot ? '#FF3131' : 'rgba(255,255,255,0.2)'}`,
                      color: '#000',
                      fontSize: 15,
                      flexShrink: 0,
                    }}
                  >
                    {o.user.replace('@', '')[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-black italic text-white truncate"
                        style={{ fontSize: 15, letterSpacing: '-0.01em' }}
                      >
                        {o.user}
                      </span>
                      {o.hot ? (
                        <span
                          className="font-black italic uppercase rounded-full"
                          style={{
                            fontSize: 7,
                            color: '#FF3131',
                            background: 'rgba(255,49,49,0.18)',
                            border: '1px solid rgba(255,49,49,0.4)',
                            padding: '2px 6px',
                            letterSpacing: '0.14em',
                          }}
                        >
                          HOT
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="font-black italic uppercase mt-0.5"
                      style={{
                        fontSize: 9,
                        color: '#71717a',
                        letterSpacing: '0.14em',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      EXPIRES {o.expires}
                    </div>
                  </div>
                  <span
                    className="font-black italic"
                    style={{
                      fontSize: 16,
                      color: '#FFD700',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {o.wager.toFixed(2)} SOL
                  </span>
                  <button
                    onClick={() => onJoinDuel?.(o.duelId)}
                    className="font-black italic uppercase rounded-full active:opacity-90"
                    style={{
                      background: '#FF3131',
                      color: '#000',
                      padding: '8px 16px',
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    JOIN
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div
            className="font-black italic uppercase mb-2"
            style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}
          >
            RECENT DUELS
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {recentRows.length === 0 ? (
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.06em', padding: '24px 16px', textAlign: 'center' }}
              >
                NO RECENT DUELS YET
              </div>
            ) : (
              recentRows.map((r, i) => (
                <div
                  key={i}
                  className="px-4 py-3"
                  style={{
                    borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="font-black italic uppercase truncate"
                      style={{ fontSize: 11, color: '#fff', letterSpacing: '-0.01em', maxWidth: 110 }}
                    >
                      {r.winner}
                    </span>
                    <span
                      className="font-black italic uppercase truncate"
                      style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}
                    >
                      BEAT {r.loser}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span
                      className="font-black italic uppercase"
                      style={{
                        fontSize: 9,
                        color: '#52525b',
                        letterSpacing: '0.14em',
                      }}
                    >
                      {r.when}
                    </span>
                    <span
                      className="font-black italic"
                      style={{
                        fontSize: 13,
                        color: '#FFD700',
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      +{r.pot.toFixed(3)} SOL
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuelsViewV2;
