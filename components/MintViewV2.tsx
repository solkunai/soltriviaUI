/**
 * MintViewV2 — web port of the Sol Trivia Elementals commemorative NFT mint,
 * matched to the desktop design (desktop_mintpage 1-3) and responsive-stacked
 * on mobile (mobile_mintpage 1-3). Navy + gold "trading card" palette (MTC).
 *
 * Layout (desktop): editorial header → unified hero panel (mystery card left,
 * MINT TO REVEAL + stats + pills + CTA right) → set completion w/ progress bar
 * + mini thumbs → MEET THE FOUR gallery (4 large cards) → YOUR COLLECTION
 * (owned, when any) → recent mints chips → legend banner.
 *
 * All display data is live: eligibility, the wallet's collection (Helius DAS),
 * and the recent-mints feed. MINT IS NOT LIVE YET — `MINT_LIVE = false` renders
 * the gold CTA as a clearly-marked "MINTING OPENS SOON" placeholder. Flip
 * MINT_LIVE + wire the on-chain build→sign once the V2 `mint_commemorative`
 * instruction ships, and set COLLECTION_ADDRESS.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';
import {
  ARCHETYPES,
  ARCHETYPE_ORDER,
  MTC,
  MINT_SUPPLY,
  randomGateQuestion,
  type ArchetypeKey,
} from '../src/utils/mintData';
import {
  fetchMintEligibility,
  fetchCollection,
  fetchRecentMints,
  fetchMintedCount,
  type CollectionState,
  type RecentMint,
} from '../src/utils/mintFlow';

const MINT_LIVE = false;
const COLLECTION_ADDRESS = '<YOUR_COLLECTION_ADDRESS>';

interface Props {
  walletAddress?: string | null;
  hasGamePass?: boolean;
  isSeekerVerified?: boolean;
  onPlay?: () => void;
}

function shortWallet(w: string) {
  return w ? `${w.slice(0, 4)}…${w.slice(-4)}` : '';
}
function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const MintViewV2: React.FC<Props> = ({ walletAddress, isSeekerVerified, onPlay }) => {
  const isMobile = useIsMobile();

  const [eligible, setEligible] = useState<boolean | null>(null);
  const [collection, setCollection] = useState<CollectionState>({
    counts: { genius: 0, scholar: 0, competitor: 0, champion: 0 },
    typesOwned: 0,
    isLegend: false,
  });
  const [recent, setRecent] = useState<RecentMint[]>([]);
  const [minted, setMinted] = useState(0);
  const [detail, setDetail] = useState<ArchetypeKey | null>(null);
  const [gateOpen, setGateOpen] = useState(false);

  // Global supply counter — polls independent of wallet connection.
  useEffect(() => {
    let cancel = false;
    const load = () =>
      fetchMintedCount()
        .then((n) => { if (!cancel) setMinted(n); })
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => { cancel = true; clearInterval(id); };
  }, []);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const [elig, coll, rec] = await Promise.all([
        fetchMintEligibility(walletAddress),
        fetchCollection(walletAddress, COLLECTION_ADDRESS),
        fetchRecentMints(8),
      ]);
      setEligible(elig);
      setCollection(coll);
      setRecent(rec);
    } catch {
      /* non-fatal */
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalOwned = (Object.values(collection.counts) as number[]).reduce((a, b) => a + b, 0);
  const toGo = 4 - collection.typesOwned;
  const seekerPrice = isSeekerVerified ? '0.01' : '0.02';

  const panelNavy = `linear-gradient(120deg, ${MTC.navyDeep}, ${MTC.navy})`;

  return (
    <div className="max-w-5xl">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="font-black italic uppercase flex items-center gap-2" style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}>
            <img src="/mint/mint-icon.png" alt="" style={{ width: 12, height: 12, filter: 'brightness(0) invert(1)' }} /> NFT NIGHT · COMMEMORATIVE
          </div>
          <h1 className="font-black italic uppercase mt-1 text-white" style={{ fontSize: isMobile ? 34 : 44, lineHeight: 0.95, letterSpacing: '-0.02em' }}>
            COLLECT <span style={{ color: ARCHETYPES.competitor.accent }}>'EM ALL</span>
          </h1>
          <p style={{ fontSize: 12.5, color: '#a1a1aa', marginTop: 8, lineHeight: 1.5, maxWidth: 620 }}>
            Four archetypes, 25K of each. Each mint is a random reveal — on-chain forever. Max 15
            per wallet. Collect the full set to unlock the{' '}
            <span style={{ color: MTC.gold, fontWeight: 900 }}>LEGEND</span> badge.
          </p>
        </div>
        <div className="rounded-full font-black italic uppercase flex items-center gap-2 flex-shrink-0" style={{ background: `${MTC.gold}1a`, border: `1px solid ${MTC.gold}55`, color: MTC.gold, fontSize: 9, letterSpacing: '0.14em', padding: '7px 12px' }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: MTC.gold, display: 'inline-block' }} />
          {MINT_LIVE ? 'READY TO MINT' : 'OPENS SOON'}
        </div>
      </div>

      {/* ── Hero panel ──────────────────────────────────────────────── */}
      <div className="rounded-2xl mb-5" style={{ background: panelNavy, border: `1.5px solid ${MTC.gold}55`, padding: isMobile ? 16 : 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: isMobile ? 18 : 26, alignItems: 'center' }}>
          {/* Mystery card */}
          <div className="flex items-center justify-center">
            <div style={{ position: 'relative', width: isMobile ? 190 : 240, height: isMobile ? 283 : 358 }}>
              <div style={{ position: 'absolute', inset: -16, borderRadius: 24, background: `radial-gradient(circle, ${MTC.gold}33, transparent 70%)` }} />
              <img src={ARCHETYPES.scholar.img} alt="Mystery card" style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0.5) blur(12px)' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="font-black italic" style={{ fontSize: isMobile ? 90 : 120, color: MTC.gold, textShadow: `0 0 40px ${MTC.gold}88` }}>?</span>
              </div>
            </div>
          </div>

          {/* Mint details + CTA */}
          <div>
            <div className="font-black italic uppercase" style={{ fontSize: 10, color: MTC.gold, letterSpacing: '0.18em' }}>1 OF 4 · RANDOM REVEAL</div>
            <div className="font-black italic uppercase" style={{ fontSize: isMobile ? 36 : 46, lineHeight: 1, color: MTC.gold, letterSpacing: '-0.02em', marginTop: 2 }}>MINT TO REVEAL</div>
            <p style={{ fontSize: 12, color: '#cbd5e1', marginTop: 8, lineHeight: 1.5 }}>
              Four archetypes. Each mint pulls a random reveal from a pool of 100,000 — 25K of each
              archetype. Max 15 mints per wallet.
            </p>

            {/* Stat row */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { l: 'PRICE', v: '0.02◎' },
                { l: 'GAS', v: '~0.0001' },
                { l: 'CHAIN', v: 'SOLANA' },
                { l: 'YOUR CARDS', v: String(totalOwned) },
              ].map((st) => (
                <div key={st.l} className="rounded-xl text-center" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '9px 0' }}>
                  <div className="font-black italic uppercase" style={{ fontSize: 8, color: MTC.gold, letterSpacing: '0.12em' }}>{st.l}</div>
                  <div className="font-black italic text-white" style={{ fontSize: 15, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{st.v}</div>
                </div>
              ))}
            </div>

            {/* Pills */}
            <div className="flex flex-wrap gap-2 mt-3">
              <div className="rounded-full flex items-center gap-2" style={{ background: 'rgba(20,241,149,0.12)', border: '1px solid rgba(20,241,149,0.5)', padding: '6px 12px' }}>
                <img src="/seeker-badge.png" alt="Seeker" style={{ width: 15, height: 15, objectFit: 'contain' }} />
                <span className="font-black italic uppercase" style={{ fontSize: 9, color: '#14F195', letterSpacing: '0.12em' }}>SEEKER · 50% OFF · 0.01 SOL</span>
              </div>
              <div className="rounded-full" style={{ border: `1px solid ${MTC.gold}55`, background: `${MTC.gold}10`, padding: '6px 12px' }}>
                <span className="font-black italic uppercase" style={{ fontSize: 9, color: MTC.gold, letterSpacing: '0.12em' }}>GAME PASS · 1 FREE MINT</span>
              </div>
            </div>

            {/* CTA — coming-soon placeholder styled as the design's gold bar */}
            <button
              onClick={MINT_LIVE ? () => setGateOpen(true) : undefined}
              disabled={!MINT_LIVE}
              className="w-full font-black italic uppercase rounded-xl mt-4 flex items-center justify-center gap-2"
              style={{
                background: MTC.gold,
                color: MTC.navyDeep,
                border: 'none',
                padding: '16px 0',
                fontSize: 13,
                letterSpacing: '0.12em',
                cursor: MINT_LIVE ? 'pointer' : 'default',
                opacity: MINT_LIVE ? 1 : 0.92,
              }}
            >
              <img src="/mint/mint-icon.png" alt="" style={{ width: 15, height: 15 }} />
              {MINT_LIVE ? `MINT NOW · ${seekerPrice} SOL →` : 'MINTING OPENS SOON'}
            </button>
            <div className="font-black italic uppercase text-center" style={{ fontSize: 8, color: '#52525b', letterSpacing: '0.12em', marginTop: 9, lineHeight: 1.5 }}>
              {!MINT_LIVE && (
                <>
                  {eligible === false ? 'PLAY A LIVE ROUND TO LOCK IN ELIGIBILITY · ' : 'ELIGIBILITY LOCKED IN · '}
                </>
              )}
              ONE-PER-MINT · STORED AS COMPRESSED NFT · REVEAL IS RANDOM, ASSIGNED ON-CHAIN
              {!MINT_LIVE && eligible === false && onPlay && (
                <>
                  {' · '}
                  <button onClick={onPlay} style={{ color: MTC.gold, cursor: 'pointer' }}>PLAY →</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Supply counter ──────────────────────────────────────────── */}
      <div className="rounded-2xl mb-5" style={{ background: panelNavy, border: `1px solid ${MTC.gold}33`, padding: '14px 18px' }}>
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}>MINTED</div>
            <div className="font-black italic text-white" style={{ fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
              {minted.toLocaleString()} <span style={{ fontSize: 12, color: '#3a4a78' }}>/ {MINT_SUPPLY.toLocaleString()}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: MTC.gold, letterSpacing: '0.14em' }}>REMAINING</div>
            <div className="font-black italic" style={{ fontSize: 22, color: MTC.gold, fontVariantNumeric: 'tabular-nums' }}>{(MINT_SUPPLY - minted).toLocaleString()}</div>
          </div>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (minted / MINT_SUPPLY) * 100)}%`, background: `linear-gradient(90deg, ${MTC.goldDeep}, ${MTC.gold}, ${MTC.goldGlow})`, borderRadius: 999, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* ── Set completion ──────────────────────────────────────────── */}
      <div className="rounded-2xl mb-5" style={{ background: panelNavy, border: `1.5px solid ${MTC.gold}55`, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: 16, alignItems: 'center' }}>
          <div>
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: MTC.gold, letterSpacing: '0.14em' }}>SET COMPLETION</div>
            <div className="font-black italic text-white" style={{ fontSize: 30, lineHeight: 1, marginTop: 2 }}>
              {collection.typesOwned}<span style={{ color: '#3a4a78' }}>/4</span>
              <span className="font-black italic uppercase" style={{ fontSize: 11, color: '#a1a1aa', marginLeft: 8 }}>ARCHETYPES</span>
            </div>
            <div className="font-black italic uppercase" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.1em', marginTop: 4 }}>
              {totalOwned} CARDS · {toGo > 0 ? `${toGo} ARCHETYPE${toGo > 1 ? 'S' : ''} TO GO` : 'SET COMPLETE'}
            </div>
            {/* Progress bar */}
            <div className="rounded-full overflow-hidden mt-3" style={{ height: 8, background: 'rgba(255,255,255,0.06)', maxWidth: isMobile ? '100%' : 360 }}>
              <div style={{ height: '100%', width: `${(collection.typesOwned / 4) * 100}%`, background: 'linear-gradient(90deg,#7DD356,#7CD4F5,#FF6E3C,#FFD93D)', borderRadius: 999, transition: 'width 0.4s' }} />
            </div>
          </div>
          {/* Mini thumbs */}
          <div className="flex gap-2">
            {ARCHETYPE_ORDER.map((k) => {
              const A = ARCHETYPES[k];
              const n = collection.counts[k];
              const has = n > 0;
              return (
                <button key={k} onClick={() => setDetail(k)} className="active:opacity-90" style={{ cursor: 'pointer' }}>
                  <div className="relative rounded-md overflow-hidden" style={{ width: 46, height: 56, border: `1.5px solid ${has ? MTC.gold : '#1f2a4d'}`, opacity: has ? 1 : 0.55, background: '#161e34' }}>
                    <img src={A.img} alt={A.label} style={{ width: '100%', height: '140%', objectFit: 'cover', filter: 'blur(4px)' }} />
                    {!has ? (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,15,38,0.5)' }}>
                        <span className="font-black italic text-white" style={{ fontSize: 16 }}>?</span>
                      </div>
                    ) : (
                      <div className="font-black italic" style={{ position: 'absolute', bottom: 2, right: 2, minWidth: 16, height: 16, padding: '0 3px', borderRadius: 8, background: MTC.gold, color: MTC.navyDeep, fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×{n}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Meet the four · gallery ─────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-black italic uppercase" style={{ fontSize: 10, color: MTC.gold, letterSpacing: '0.14em' }}>
            {isMobile ? '4 POSSIBLE OUTCOMES' : 'MEET THE FOUR · ARCHETYPE GALLERY'}
          </div>
          <div className="font-black italic uppercase" style={{ fontSize: 8, color: '#52525b', letterSpacing: '0.12em' }}>
            {isMobile ? 'MAX 15 / WALLET' : 'TAP A CARD FOR TRAITS'}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 md:gap-3">
          {ARCHETYPE_ORDER.map((k) => {
            const A = ARCHETYPES[k];
            return (
              <button key={k} onClick={() => setDetail(k)} className="flex flex-col items-center active:opacity-90 rounded-xl" style={{ cursor: 'pointer' }}>
                <div className="rounded-xl overflow-hidden w-full" style={{ border: `1px solid ${MTC.gold}33`, boxShadow: `0 12px 30px -12px ${A.bg2}77` }}>
                  <img src={A.img} alt={A.label} style={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'cover', display: 'block', filter: 'blur(8px)' }} />
                </div>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <img src={A.icon} alt="" style={{ width: 11, height: 11 }} />
                  <span className="font-black italic uppercase" style={{ fontSize: 9, color: A.accent }}>{A.label.replace('THE ', '')}</span>
                </div>
                <span className="font-black italic uppercase" style={{ fontSize: 8, color: '#52525b', marginTop: 2 }}>{A.rarity} · {A.supply}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Your collection (only when the wallet owns something) ───── */}
      {collection.typesOwned > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-black italic uppercase" style={{ fontSize: 10, color: MTC.gold, letterSpacing: '0.14em' }}>
              YOUR COLLECTION · {totalOwned} CARDS · {collection.typesOwned}/4 ARCHETYPES
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ARCHETYPE_ORDER.map((k) => {
              const A = ARCHETYPES[k];
              const n = collection.counts[k];
              const has = n > 0;
              return (
                <div key={k} className="rounded-xl" style={{ background: '#0a0a0a', border: `1px solid ${has ? `${MTC.gold}44` : 'rgba(255,255,255,0.08)'}`, padding: 12, opacity: has ? 1 : 0.55 }}>
                  <div className="font-black italic uppercase" style={{ fontSize: 8, color: has ? A.accent : '#52525b', letterSpacing: '0.1em' }}>{A.element} · {A.rarity}</div>
                  <div className="relative my-2" style={{ height: 120 }}>
                    {has && <div className="absolute rounded-lg" style={{ inset: '4px 8px', background: '#161e34', transform: 'rotate(-6deg)', border: `1px solid ${MTC.gold}33` }} />}
                    <div className="relative rounded-lg overflow-hidden h-full" style={{ border: `1.5px solid ${has ? MTC.gold : '#1f2a4d'}`, background: '#161e34' }}>
                      <img src={A.img} alt={A.label} style={{ width: '100%', height: '140%', objectFit: 'cover', filter: 'blur(4px)' }} />
                      {has ? (
                        <div className="font-black italic" style={{ position: 'absolute', bottom: 4, right: 4, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: MTC.gold, color: MTC.navyDeep, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×{n}</div>
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,15,38,0.5)' }}>
                          <span className="font-black italic text-white" style={{ fontSize: 22 }}>?</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="font-black italic uppercase text-center" style={{ fontSize: 9, color: has ? '#fff' : '#52525b' }}>{has ? A.label : 'NOT YET COLLECTED'}</div>
                  {has && (
                    <button onClick={() => setDetail(k)} className="w-full font-black italic uppercase rounded-lg mt-2" style={{ border: `1px solid ${MTC.gold}55`, color: MTC.gold, fontSize: 8, letterSpacing: '0.12em', padding: '6px 0', cursor: 'pointer' }}>VIEW TRAITS →</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent mints ────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#52525b', letterSpacing: '0.14em' }}>RECENT MINTS</div>
          <div className="flex items-center gap-1.5">
            <span style={{ width: 6, height: 6, borderRadius: 3, background: MTC.gold, display: 'inline-block' }} />
            <span className="font-black italic uppercase" style={{ fontSize: 8, color: MTC.gold }}>{recent.length ? 'LIVE' : '—'}</span>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-xl" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', padding: 14, fontSize: 11, color: '#71717a' }}>No mints yet — be the first.</div>
        ) : isMobile ? (
          <div className="rounded-xl" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', padding: '0 12px' }}>
            {recent.map((m, i) => {
              const A = ARCHETYPES[m.archetype];
              return (
                <div key={i} className="flex items-center gap-3" style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                  <div className="rounded overflow-hidden" style={{ width: 22, height: 28, border: `1px solid ${MTC.gold}` }}>
                    <img src={A.img} alt="" style={{ width: '100%', height: '140%', objectFit: 'cover', filter: 'blur(4px)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 11, color: '#fff' }}>{m.username ? `@${m.username}` : shortWallet(m.wallet)}</div>
                    <div className="font-black italic uppercase" style={{ fontSize: 8, color: A.accent, marginTop: 1 }}>{A.label.replace('THE ', '')}</div>
                  </div>
                  <div style={{ fontSize: 9, color: '#52525b' }}>{timeAgo(m.createdAt)}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map((m, i) => {
              const A = ARCHETYPES[m.archetype];
              return (
                <div key={i} className="flex items-center gap-2 rounded-xl flex-shrink-0" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px' }}>
                  <div className="rounded overflow-hidden" style={{ width: 22, height: 28, border: `1px solid ${MTC.gold}` }}>
                    <img src={A.img} alt="" style={{ width: '100%', height: '140%', objectFit: 'cover', filter: 'blur(4px)' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate" style={{ fontSize: 11, color: '#fff', maxWidth: 120 }}>{m.username ? `@${m.username}` : shortWallet(m.wallet)}</div>
                    <div className="font-black italic uppercase" style={{ fontSize: 8, color: A.accent, marginTop: 1 }}>{A.label.replace('THE ', '')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Legend banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl flex items-center gap-4" style={{ background: panelNavy, border: `2px solid ${MTC.gold}`, padding: 18 }}>
        <div className="flex-1">
          <div className="font-black italic uppercase" style={{ fontSize: 9, color: MTC.gold, letterSpacing: '0.14em' }}>THE LEGEND BADGE</div>
          <div className="font-black italic uppercase" style={{ fontSize: isMobile ? 15 : 18, color: MTC.gold, marginTop: 3 }}>
            COMPLETE THE SET. EARN{' '}
            <span style={{ color: '#FFE066', textShadow: '0 0 14px rgba(255,224,102,0.75)' }}>LEGEND</span> STATUS.
          </div>
          <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 5, lineHeight: 1.5 }}>
            Own at least one of each of the four archetypes to permanently attach the Legend trait to
            your profile and <span style={{ color: MTC.gold, fontWeight: 900 }}>UNLOCK MORE PERKS</span>.
          </div>
        </div>
        <div className="text-center flex-shrink-0">
          <div className="font-black italic" style={{ fontSize: 32, color: MTC.gold, lineHeight: 1 }}>
            {collection.typesOwned}<span style={{ color: '#3a4a78' }}>/4</span>
          </div>
          <div className="flex gap-1 justify-center mt-1">
            {ARCHETYPE_ORDER.map((k) => (
              <span key={k} style={{ width: 7, height: 7, borderRadius: 4, background: collection.counts[k] > 0 ? MTC.gold : 'rgba(255,255,255,0.15)', display: 'inline-block' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {detail && <ArchetypeDetailModal archetypeKey={detail} owned={collection.counts[detail]} onClose={() => setDetail(null)} />}
      {MINT_LIVE && gateOpen && <TriviaGate onClose={() => setGateOpen(false)} onPass={() => setGateOpen(false)} />}
    </div>
  );
};

// ─── Archetype detail modal ──────────────────────────────────────────────────
function ArchetypeDetailModal({ archetypeKey, owned, onClose }: { archetypeKey: ArchetypeKey; owned: number; onClose: () => void }) {
  const A = ARCHETYPES[archetypeKey];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,3,12,0.82)' }} onClick={onClose}>
      <div className="relative w-full rounded-2xl" style={{ maxWidth: 440, background: MTC.navy, border: `2px solid ${MTC.gold}`, padding: 16 }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute flex items-center justify-center" style={{ top: 10, right: 10, width: 24, height: 24, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: `1px solid ${MTC.gold}55`, color: '#fff', cursor: 'pointer' }}>×</button>
        <div className="flex gap-3">
          <img src={A.img} alt={A.label} style={{ width: 120, height: 180, objectFit: 'contain', filter: 'blur(6px)' }} />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <img src={A.icon} alt="" style={{ width: 11, height: 11 }} />
              <span className="font-black italic uppercase" style={{ fontSize: 8, color: A.accent }}>{A.element} · {A.rarity}</span>
            </div>
            <div className="font-black italic" style={{ fontSize: 20, color: MTC.gold, marginTop: 4 }}>{A.label}</div>
            <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 6, fontStyle: 'italic' }}>"{A.lore}"</div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="rounded-full font-black italic uppercase" style={{ fontSize: 8, color: A.accent, border: `1px solid ${A.accent}66`, background: `${A.accent}1a`, padding: '3px 7px' }}>SUPPLY {A.supply}</span>
              <span className="rounded-full font-black italic uppercase" style={{ fontSize: 8, color: MTC.gold, border: `1px solid ${MTC.gold}55`, background: `${MTC.gold}10`, padding: '3px 7px' }}>OWNED ×{owned}</span>
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: `${MTC.gold}33`, margin: '12px 0' }} />
        <div className="mb-2">
          <span className="font-black italic uppercase" style={{ fontSize: 8, color: MTC.gold }}>TRAITS · {A.attributes.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {A.attributes.map((t, i) => (
            <div key={i} className="rounded-md" style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${MTC.gold}2a`, padding: '6px 8px' }}>
              <div className="font-black italic uppercase" style={{ fontSize: 8, color: A.accent }}>{t.trait.toUpperCase()}</div>
              <div className="font-black italic truncate text-white" style={{ fontSize: 11, marginTop: 1 }}>{t.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Trivia Gate modal (GATE STEP 2) — mounts only when minting is live ───────
function TriviaGate({ onClose, onPass }: { onClose: () => void; onPass: () => void }) {
  const [q] = useState(() => randomGateQuestion());
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correct) setTimeout(onPass, 1100);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,3,12,0.82)' }} onClick={onClose}>
      <div className="relative w-full rounded-2xl" style={{ maxWidth: 380, background: MTC.navy, border: `2px solid ${MTC.gold}`, padding: 18 }} onClick={(e) => e.stopPropagation()}>
        <div className="font-black italic uppercase flex items-center gap-1.5" style={{ fontSize: 9, color: MTC.gold, letterSpacing: '0.14em' }}>
          <img src="/mint/mint-icon.png" alt="" style={{ width: 11, height: 11 }} /> PROVE YOU'RE A TRIVIA HEAD
        </div>
        <div className="font-black italic text-white mt-1" style={{ fontSize: 22 }}>ONE EASY QUESTION</div>
        <div className="rounded-lg mt-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${MTC.gold}44`, padding: 12 }}>
          <div className="font-black italic" style={{ fontSize: 16, color: MTC.gold }}>{q.q}</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-3">
          {q.options.map((opt, i) => {
            const revealed = picked !== null;
            const correct = i === q.correct;
            const pickedThis = picked === i;
            const col = !revealed ? '#fff' : correct ? '#14F195' : pickedThis ? '#FF3131' : '#71717a';
            return (
              <button key={i} disabled={revealed} onClick={() => pick(i)} className="flex items-center gap-2 rounded-lg" style={{ border: `1px solid ${!revealed ? 'rgba(255,255,255,0.1)' : correct ? '#14F195' : pickedThis ? '#FF3131' : 'rgba(255,255,255,0.1)'}`, padding: '10px', cursor: revealed ? 'default' : 'pointer', color: col, fontSize: 11 }}>
                {['A', 'B', 'C', 'D'][i]} · {opt}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default MintViewV2;
