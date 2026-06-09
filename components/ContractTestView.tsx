import React, { useState, useMemo, useCallback } from 'react';
import { PublicKey, TransactionMessage, VersionedTransaction, Connection, clusterApiUrl } from '@solana/web3.js';
import { useWallet, WalletMultiButton } from '../src/contexts/WalletContext';
import {
  SOLTRIVIA_PROGRAM_ID,
  contractRoundIdFromDateAndNumber,
  fetchGameConfig,
  fetchTierRound,
  fetchDuel,
  fetchCustomGame,
  buildInitializeIx,
  buildCreateTierRoundIx,
  buildEnterTierRoundIx,
  buildPostTierWinnersIx,
  buildClaimTierPrizeIx,
  buildSetTierRefundModeIx,
  buildClaimTierRefundIx,
  buildCreateDuelIx,
  buildJoinDuelIx,
  buildCancelDuelIx,
  buildResolveDuelIx,
  buildClaimDuelPrizeIx,
  buildExpireDuelIx,
  buildCreateCustomGameIx,
  buildFundCustomGameIx,
  buildEnterCustomGameIx,
  buildFinalizeCustomGameIx,
  buildClaimCustomPrizeIx,
  buildExpireCustomGameIx,
  buildClaimCustomRefundIx,
  getConfigPda,
  GameConfigData,
  TierRoundData,
  DuelData,
  CustomGameData,
} from '../src/utils/soltriviaContract';
import { REVENUE_WALLET, V2_TIER_LABELS, V2_DUEL_LABELS, V2_DUEL_FEES, OPERATOR_WALLET } from '../src/utils/constants';

const EXPLORER = 'https://explorer.solana.com';

function explorerLink(sig: string, devnet: boolean) {
  return `${EXPLORER}/tx/${sig}${devnet ? '?cluster=devnet' : ''}`;
}

function accountLink(addr: string, devnet: boolean) {
  return `${EXPLORER}/address/${addr}${devnet ? '?cluster=devnet' : ''}`;
}

function lamportsToSol(l: number) {
  return (l / 1_000_000_000).toFixed(4);
}

type Tab = 'admin' | 'trivia' | 'duels' | 'custom';
type Status = { ok: boolean; msg: string; sig?: string } | null;

export default function ContractTestView() {
  const { publicKey, connected, sendTransaction } = useWallet();

  const [tab, setTab] = useState<Tab>('admin');
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);
  const [forceDevnet, setForceDevnet] = useState(true);

  // Shared state
  const [configData, setConfigData] = useState<GameConfigData | null>(null);
  const [tierIndex, setTierIndex] = useState(0);
  const [roundData, setRoundData] = useState<TierRoundData | null>(null);
  const [duelData, setDuelData] = useState<DuelData | null>(null);

  const [customGameData, setCustomGameData] = useState<CustomGameData | null>(null);

  // Form inputs
  const [roundIdInput, setRoundIdInput] = useState('');
  const [duelIdInput, setDuelIdInput] = useState('');
  const [duelFeeIndex, setDuelFeeIndex] = useState(0);
  const [duelPublic, setDuelPublic] = useState(true);

  // Custom game form
  const [customGameIdInput, setCustomGameIdInput] = useState('');
  const [customEntryFee, setCustomEntryFee] = useState('0.01'); // SOL
  const [customPrizeModel, setCustomPrizeModel] = useState(0); // 0=player-funded, 1=creator-funded
  const [customMaxWinners, setCustomMaxWinners] = useState(1);
  const [customFundAmount, setCustomFundAmount] = useState('0.05'); // SOL
  const [customWinnerInput, setCustomWinnerInput] = useState(''); // pubkey for finalize

  // Tier round winner input
  const [tierWinnerInput, setTierWinnerInput] = useState('');
  // Duel winner input
  const [duelWinnerInput, setDuelWinnerInput] = useState('');

  const devnet = forceDevnet;
  const devnetConn = useMemo(() => new Connection(clusterApiUrl('devnet')), []);
  const mainnetConn = useMemo(() => {
    // Use the Helius proxy (API key stays server-side). The previous raw-key
    // URL fallback was removed — Vite would inline the key into the bundle.
    const proxy = import.meta.env.VITE_HELIUS_RPC_PROXY_URL;
    const rpc = proxy || 'https://api.mainnet-beta.solana.com';
    return new Connection(rpc, 'confirmed');
  }, []);
  const conn = devnet ? devnetConn : mainnetConn;

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const roundNumber = Math.floor(now.getUTCHours() / 6);
  const currentRoundId = contractRoundIdFromDateAndNumber(today, roundNumber);

  const revenueWallet = new PublicKey(REVENUE_WALLET);
  const operatorWallet = new PublicKey(OPERATOR_WALLET);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setLoading(true);
    setStatus(null);
    try {
      await fn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ ok: false, msg: `${label} failed: ${msg}` });
    } finally {
      setLoading(false);
    }
  }, []);

  const signAndSend = async (ixs: any[], label: string) => {
    if (!publicKey) throw new Error('Connect your wallet first');
    const { blockhash } = await conn.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    const sim = await conn.simulateTransaction(tx);
    if (sim.value.err) throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);
    const sig = await sendTransaction(tx, conn);
    setStatus({ ok: true, msg: `${label} sent`, sig });
    return sig;
  };

  const tabStyle = (t: Tab) =>
    `px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
      tab === t ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
    }`;

  const btnBase = 'w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all disabled:opacity-40';

  // Calculate active round ID
  const activeRoundId = roundIdInput.trim() ? parseInt(roundIdInput, 10) : currentRoundId;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto text-white">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">V2 Contract Dashboard</h1>
        <p className="text-sm text-white/60 mt-1">
          <a href={accountLink(SOLTRIVIA_PROGRAM_ID.toBase58(), devnet)} target="_blank" rel="noopener noreferrer" className="text-[#14F195] hover:underline font-mono">
            {SOLTRIVIA_PROGRAM_ID.toBase58().slice(0, 12)}...
          </a>
          {' · '}Round #{roundNumber} · ID {currentRoundId}
        </p>
      </div>

      {/* Network toggle */}
      <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={forceDevnet}
            onChange={(e) => setForceDevnet(e.target.checked)}
            className="rounded accent-[#14F195]"
          />
          Force devnet
        </label>
        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${devnet ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
          {devnet ? 'DEVNET' : 'MAINNET'}
        </span>
      </div>

      {!connected && (
        <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-center justify-between">
          <span>Connect your wallet to interact with the contract.</span>
          <WalletMultiButton />
        </div>
      )}

      {connected && publicKey && (
        <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-mono flex items-center justify-between">
          <span>Connected: {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}</span>
          <WalletMultiButton />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-4">
        {(['admin', 'trivia', 'duels', 'custom'] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setStatus(null); }} className={tabStyle(t)}>
            {t === 'admin' ? 'Admin' : t === 'trivia' ? 'Tier Rounds' : t === 'duels' ? '1v1 Duels' : 'Custom Games'}
          </button>
        ))}
      </div>

      {/* ─── Admin Tab ─── */}
      {tab === 'admin' && (
        <div className="space-y-3">
          <button
            className={`${btnBase} bg-amber-600 hover:bg-amber-500`}
            disabled={loading || !connected}
            onClick={() => run('Initialize', async () => {
              const ix = buildInitializeIx(publicKey!, operatorWallet, revenueWallet, revenueWallet);
              await signAndSend([ix], 'Initialize');
            })}
          >
            Initialize Program
          </button>
          <p className="text-xs text-white/50 -mt-1 ml-1">One-time setup. Sets your wallet as owner, GRjf5 as operator.</p>

          <button
            className={`${btnBase} bg-white/10 hover:bg-white/15`}
            disabled={loading}
            onClick={() => run('Fetch config', async () => {
              const data = await fetchGameConfig(conn);
              if (!data) { setStatus({ ok: false, msg: 'Config account not found. Initialize first.' }); return; }
              setConfigData(data);
              setStatus({ ok: true, msg: 'Config loaded' });
            })}
          >
            Fetch Config
          </button>

          {configData && (
            <div className="p-3 rounded-lg bg-white/5 text-xs font-mono space-y-1 border border-white/10">
              <div className="grid grid-cols-[120px_1fr] gap-y-1">
                <span className="text-white/50">Owner</span><span className="truncate">{configData.owner}</span>
                <span className="text-white/50">Operator</span><span className="truncate">{configData.operator}</span>
                <span className="text-white/50">Revenue</span><span className="truncate">{configData.revenueWallet}</span>
                <span className="text-white/50">Platform fee</span><span>{lamportsToSol(configData.platformFeeLamports)} SOL</span>
                <span className="text-white/50">Duel cut</span><span>{configData.duelHouseCutBps / 100}%</span>
                <span className="text-white/50">Custom cut</span><span>{configData.customGamePlatformCutBps / 100}%</span>
                <span className="text-white/50">Next duel ID</span><span>{configData.nextDuelId}</span>
                <span className="text-white/50">Next game ID</span><span>{configData.nextCustomGameId}</span>
                <span className="text-white/50">Paused</span><span>{configData.paused ? 'YES' : 'No'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tier Rounds Tab ─── */}
      {tab === 'trivia' && (
        <div className="space-y-3">
          {/* Tier selector */}
          <div className="flex gap-2">
            {V2_TIER_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => setTierIndex(i)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                  tierIndex === i ? 'bg-[#14F195]/20 border-[#14F195]/50 text-[#14F195]' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Round ID */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder={`Round ID (default: ${currentRoundId})`}
              value={roundIdInput}
              onChange={(e) => setRoundIdInput(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          <button
            className={`${btnBase} bg-emerald-600 hover:bg-emerald-500`}
            disabled={loading || !connected}
            onClick={() => run('Create round', async () => {
              const ix = buildCreateTierRoundIx(publicKey!, activeRoundId, tierIndex);
              await signAndSend([ix], `Create tier ${tierIndex} round ${activeRoundId}`);
            })}
          >
            Create Tier Round
          </button>

          <button
            className={`${btnBase} bg-blue-600 hover:bg-blue-500`}
            disabled={loading || !connected}
            onClick={() => run('Enter round', async () => {
              const ix = buildEnterTierRoundIx(publicKey!, activeRoundId, tierIndex, revenueWallet);
              await signAndSend([ix], `Enter tier ${tierIndex} round ${activeRoundId}`);
            })}
          >
            Enter Round ({V2_TIER_LABELS[tierIndex]} + 0.0025 fee)
          </button>

          {/* Post winners */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Winner pubkey (defaults to your wallet)"
              value={tierWinnerInput}
              onChange={(e) => setTierWinnerInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            <button
              className={`${btnBase} bg-orange-600 hover:bg-orange-500`}
              disabled={loading || !connected}
              onClick={() => run('Post winners', async () => {
                const w = tierWinnerInput.trim() ? new PublicKey(tierWinnerInput.trim()) : publicKey!;
                const ix = buildPostTierWinnersIx(publicKey!, activeRoundId, tierIndex, [w, w, w, w, w]);
                await signAndSend([ix], `Post winners for round ${activeRoundId}`);
              })}
            >
              Post Winners (fills all 5 slots)
            </button>
          </div>

          <button
            className={`${btnBase} bg-purple-600 hover:bg-purple-500`}
            disabled={loading || !connected}
            onClick={() => run('Claim prize', async () => {
              const ix = buildClaimTierPrizeIx(publicKey!, activeRoundId, tierIndex);
              await signAndSend([ix], 'Claim prize');
            })}
          >
            Claim Tier Prize
          </button>

          <div className="flex gap-2">
            <button
              className={`flex-1 ${btnBase} bg-rose-600/80 hover:bg-rose-500`}
              disabled={loading || !connected}
              onClick={() => run('Set refund', async () => {
                const ix = buildSetTierRefundModeIx(publicKey!, activeRoundId, tierIndex);
                await signAndSend([ix], 'Set refund mode');
              })}
            >
              Set Refund Mode
            </button>
            <button
              className={`flex-1 ${btnBase} bg-rose-600/80 hover:bg-rose-500`}
              disabled={loading || !connected}
              onClick={() => run('Claim refund', async () => {
                const ix = buildClaimTierRefundIx(publicKey!, activeRoundId, tierIndex);
                await signAndSend([ix], 'Claim refund');
              })}
            >
              Claim Refund
            </button>
          </div>

          <button
            className={`${btnBase} bg-white/10 hover:bg-white/15`}
            disabled={loading}
            onClick={() => run('Fetch round', async () => {
              const data = await fetchTierRound(conn, activeRoundId, tierIndex);
              if (!data) { setStatus({ ok: false, msg: 'Round not found on-chain.' }); return; }
              setRoundData(data);
              setStatus({ ok: true, msg: `Round ${activeRoundId} tier ${tierIndex} loaded` });
            })}
          >
            Fetch Round Data
          </button>

          {roundData && (
            <div className="p-3 rounded-lg bg-white/5 text-xs font-mono space-y-1 border border-white/10">
              <div className="grid grid-cols-[110px_1fr] gap-y-1">
                <span className="text-white/50">Round ID</span><span>{roundData.roundId}</span>
                <span className="text-white/50">Tier</span><span>{roundData.tierIndex}</span>
                <span className="text-white/50">Pot</span><span>{lamportsToSol(roundData.totalPot)} SOL</span>
                <span className="text-white/50">Entries</span><span>{roundData.entryCount}</span>
                <span className="text-white/50">Finalized</span><span>{roundData.finalized ? 'Yes' : 'No'}</span>
                <span className="text-white/50">Refund mode</span><span>{roundData.refundMode ? 'Yes' : 'No'}</span>
              </div>
              {roundData.finalized && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-white/50 mb-1">Winners & Prizes:</p>
                  {roundData.winners.map((w, i) => {
                    const isDefault = w === PublicKey.default.toBase58();
                    if (isDefault) return null;
                    return (
                      <div key={i} className="flex justify-between">
                        <span className="truncate max-w-[200px]">#{i + 1} {w}</span>
                        <span className={roundData.claimed[i] ? 'text-white/40 line-through' : 'text-emerald-400'}>
                          {lamportsToSol(roundData.prizeAmounts[i])} SOL {roundData.claimed[i] && '(claimed)'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Duels Tab ─── */}
      {tab === 'duels' && (
        <div className="space-y-3">
          {/* Fee selector */}
          <div className="grid grid-cols-3 gap-2">
            {V2_DUEL_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => setDuelFeeIndex(i)}
                className={`py-2 rounded-lg text-sm font-medium transition-all border ${
                  duelFeeIndex === i ? 'bg-[#14F195]/20 border-[#14F195]/50 text-[#14F195]' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={duelPublic} onChange={(e) => setDuelPublic(e.target.checked)} className="rounded accent-[#14F195]" />
            Public lobby
          </label>

          <button
            className={`${btnBase} bg-emerald-600 hover:bg-emerald-500`}
            disabled={loading || !connected}
            onClick={() => run('Create duel', async () => {
              const config = await fetchGameConfig(conn);
              if (!config) throw new Error('Config not initialized');
              const ix = buildCreateDuelIx(publicKey!, V2_DUEL_FEES[duelFeeIndex], duelPublic, config.nextDuelId, revenueWallet);
              await signAndSend([ix], `Create duel #${config.nextDuelId}`);
            })}
          >
            Create Duel ({V2_DUEL_LABELS[duelFeeIndex]} + 0.0025 fee)
          </button>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Duel ID"
              value={duelIdInput}
              onChange={(e) => setDuelIdInput(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className={`${btnBase} bg-blue-600 hover:bg-blue-500`}
              disabled={loading || !connected || !duelIdInput.trim()}
              onClick={() => run('Join duel', async () => {
                const ix = buildJoinDuelIx(publicKey!, parseInt(duelIdInput), revenueWallet);
                await signAndSend([ix], `Join duel #${duelIdInput}`);
              })}
            >
              Join Duel
            </button>
            <button
              className={`${btnBase} bg-rose-600/80 hover:bg-rose-500`}
              disabled={loading || !connected || !duelIdInput.trim()}
              onClick={() => run('Cancel duel', async () => {
                const ix = buildCancelDuelIx(publicKey!, parseInt(duelIdInput));
                await signAndSend([ix], `Cancel duel #${duelIdInput}`);
              })}
            >
              Cancel Duel
            </button>
          </div>

          {/* Resolve duel (authority only) */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Winner pubkey for resolve"
              value={duelWinnerInput}
              onChange={(e) => setDuelWinnerInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            <button
              className={`${btnBase} bg-orange-600 hover:bg-orange-500`}
              disabled={loading || !connected || !duelIdInput.trim() || !duelWinnerInput.trim()}
              onClick={() => run('Resolve duel', async () => {
                const winner = new PublicKey(duelWinnerInput.trim());
                const ix = buildResolveDuelIx(publicKey!, parseInt(duelIdInput), winner, revenueWallet);
                await signAndSend([ix], `Resolve duel #${duelIdInput}`);
              })}
            >
              Resolve Duel (Authority)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className={`${btnBase} bg-purple-600 hover:bg-purple-500`}
              disabled={loading || !connected || !duelIdInput.trim()}
              onClick={() => run('Claim duel', async () => {
                const ix = buildClaimDuelPrizeIx(publicKey!, parseInt(duelIdInput));
                await signAndSend([ix], `Claim duel #${duelIdInput}`);
              })}
            >
              Claim Duel Prize
            </button>
            <button
              className={`${btnBase} bg-amber-600/80 hover:bg-amber-500`}
              disabled={loading || !connected || !duelIdInput.trim()}
              onClick={() => run('Expire duel', async () => {
                const data = await fetchDuel(conn, parseInt(duelIdInput));
                if (!data) throw new Error('Duel not found');
                const ix = buildExpireDuelIx(publicKey!, parseInt(duelIdInput), new PublicKey(data.player1));
                await signAndSend([ix], `Expire duel #${duelIdInput}`);
              })}
            >
              Expire Duel
            </button>
          </div>

          <button
            className={`${btnBase} bg-white/10 hover:bg-white/15`}
            disabled={loading || !duelIdInput.trim()}
            onClick={() => run('Fetch duel', async () => {
              const data = await fetchDuel(conn, parseInt(duelIdInput));
              if (!data) { setStatus({ ok: false, msg: 'Duel not found.' }); return; }
              setDuelData(data);
              setStatus({ ok: true, msg: `Duel #${data.duelId} loaded` });
            })}
          >
            Fetch Duel Data
          </button>

          {duelData && (
            <div className="p-3 rounded-lg bg-white/5 text-xs font-mono space-y-1 border border-white/10">
              <div className="grid grid-cols-[110px_1fr] gap-y-1">
                <span className="text-white/50">Duel ID</span><span>{duelData.duelId}</span>
                <span className="text-white/50">Status</span>
                <span>{['Waiting', 'Locked', 'Resolved', 'Cancelled', 'Expired'][duelData.status]}</span>
                <span className="text-white/50">Entry</span><span>{lamportsToSol(duelData.entryFeeLamports)} SOL</span>
                <span className="text-white/50">Pot</span><span>{lamportsToSol(duelData.totalPot)} SOL</span>
                <span className="text-white/50">Public</span><span>{duelData.isPublic ? 'Yes' : 'No'}</span>
                <span className="text-white/50">Player 1</span><span className="truncate">{duelData.player1}</span>
                <span className="text-white/50">Player 2</span><span className="truncate">{duelData.player2 === PublicKey.default.toBase58() ? '—' : duelData.player2}</span>
                {duelData.status === 2 && <>
                  <span className="text-white/50">Winner</span><span className="truncate text-emerald-400">{duelData.winner}</span>
                  <span className="text-white/50">House cut</span><span>{lamportsToSol(duelData.houseCutLamports)} SOL</span>
                  <span className="text-white/50">Claimed</span><span>{duelData.winnerClaimed ? 'Yes' : 'No'}</span>
                </>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Custom Games Tab ─── */}
      {tab === 'custom' && (
        <div className="space-y-3">
          {/* Prize model selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCustomPrizeModel(0)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                customPrizeModel === 0 ? 'bg-[#14F195]/20 border-[#14F195]/50 text-[#14F195]' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              Player-Funded
            </button>
            <button
              onClick={() => setCustomPrizeModel(1)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                customPrizeModel === 1 ? 'bg-[#14F195]/20 border-[#14F195]/50 text-[#14F195]' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              Creator-Funded
            </button>
          </div>

          {/* Entry fee + max winners */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Entry fee (SOL)</label>
              <input
                type="text"
                value={customEntryFee}
                onChange={(e) => setCustomEntryFee(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-white/30"
                placeholder="0.01"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Max winners (1-5)</label>
              <select
                value={customMaxWinners}
                onChange={(e) => setCustomMaxWinners(parseInt(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n} className="bg-gray-900">{n} winner{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            className={`${btnBase} bg-emerald-600 hover:bg-emerald-500`}
            disabled={loading || !connected}
            onClick={() => run('Create game', async () => {
              const config = await fetchGameConfig(conn);
              if (!config) throw new Error('Config not initialized');
              const fee = Math.round((parseFloat(customEntryFee) || 0) * 1_000_000_000);
              const expires = Math.floor(Date.now() / 1000) + 86400; // 24h from now
              // Default split: 100% to winner 1 (for 1 winner), or even split
              const defaultSplits = customMaxWinners === 1
                ? [10000, 0, 0, 0, 0]
                : customMaxWinners === 2 ? [6000, 4000, 0, 0, 0]
                : customMaxWinners === 3 ? [5000, 3000, 2000, 0, 0]
                : customMaxWinners === 4 ? [4000, 3000, 2000, 1000, 0]
                : [4000, 2500, 1500, 1000, 1000];
              const ix = buildCreateCustomGameIx(
                publicKey!, config.nextCustomGameId, publicKey!,
                fee, customPrizeModel, customMaxWinners, defaultSplits, expires,
              );
              await signAndSend([ix], `Create custom game #${config.nextCustomGameId}`);
            })}
          >
            Create Custom Game
          </button>

          {/* Game ID input */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Game ID"
              value={customGameIdInput}
              onChange={(e) => setCustomGameIdInput(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Fund (creator-funded only) */}
          {customPrizeModel === 1 && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Fund amount (SOL)</label>
                <input
                  type="text"
                  value={customFundAmount}
                  onChange={(e) => setCustomFundAmount(e.target.value)}
                  placeholder="0.05"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-white/30"
                />
              </div>
              <button
                className={`${btnBase} bg-blue-600 hover:bg-blue-500`}
                disabled={loading || !connected || !customGameIdInput.trim()}
                onClick={() => run('Fund game', async () => {
                  const amount = Math.round((parseFloat(customFundAmount) || 0) * 1_000_000_000);
                  const ix = buildFundCustomGameIx(publicKey!, parseInt(customGameIdInput), amount);
                  await signAndSend([ix], `Fund game #${customGameIdInput}`);
                })}
              >
                Fund Game ({customFundAmount} SOL)
              </button>
            </div>
          )}

          <button
            className={`${btnBase} bg-blue-600 hover:bg-blue-500`}
            disabled={loading || !connected || !customGameIdInput.trim()}
            onClick={() => run('Enter game', async () => {
              const ix = buildEnterCustomGameIx(publicKey!, parseInt(customGameIdInput), revenueWallet);
              await signAndSend([ix], `Enter game #${customGameIdInput}`);
            })}
          >
            Enter Game
          </button>

          {/* Finalize (authority) */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Winner pubkey (defaults to your wallet)"
              value={customWinnerInput}
              onChange={(e) => setCustomWinnerInput(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder-white/30 focus:outline-none focus:border-white/30"
            />
            <button
              className={`${btnBase} bg-orange-600 hover:bg-orange-500`}
              disabled={loading || !connected || !customGameIdInput.trim()}
              onClick={() => run('Finalize game', async () => {
                const w = customWinnerInput.trim() ? new PublicKey(customWinnerInput.trim()) : publicKey!;
                const winners = Array(customMaxWinners).fill(w);
                const ix = buildFinalizeCustomGameIx(publicKey!, parseInt(customGameIdInput), winners, publicKey!, revenueWallet);
                await signAndSend([ix], `Finalize game #${customGameIdInput}`);
              })}
            >
              Finalize Game (Authority)
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              className={`${btnBase} bg-purple-600 hover:bg-purple-500`}
              disabled={loading || !connected || !customGameIdInput.trim()}
              onClick={() => run('Claim prize', async () => {
                const ix = buildClaimCustomPrizeIx(publicKey!, parseInt(customGameIdInput));
                await signAndSend([ix], `Claim game #${customGameIdInput}`);
              })}
            >
              Claim Prize
            </button>
            <button
              className={`${btnBase} bg-amber-600/80 hover:bg-amber-500`}
              disabled={loading || !connected || !customGameIdInput.trim()}
              onClick={() => run('Expire game', async () => {
                const ix = buildExpireCustomGameIx(publicKey!, parseInt(customGameIdInput));
                await signAndSend([ix], `Expire game #${customGameIdInput}`);
              })}
            >
              Expire
            </button>
            <button
              className={`${btnBase} bg-rose-600/80 hover:bg-rose-500`}
              disabled={loading || !connected || !customGameIdInput.trim()}
              onClick={() => run('Claim refund', async () => {
                const ix = buildClaimCustomRefundIx(publicKey!, parseInt(customGameIdInput));
                await signAndSend([ix], `Refund game #${customGameIdInput}`);
              })}
            >
              Refund
            </button>
          </div>

          <button
            className={`${btnBase} bg-white/10 hover:bg-white/15`}
            disabled={loading || !customGameIdInput.trim()}
            onClick={() => run('Fetch game', async () => {
              const data = await fetchCustomGame(conn, parseInt(customGameIdInput));
              if (!data) { setStatus({ ok: false, msg: 'Game not found.' }); return; }
              setCustomGameData(data);
              setStatus({ ok: true, msg: `Game #${data.gameId} loaded` });
            })}
          >
            Fetch Game Data
          </button>

          {customGameData && (
            <div className="p-3 rounded-lg bg-white/5 text-xs font-mono space-y-1 border border-white/10">
              <div className="grid grid-cols-[120px_1fr] gap-y-1">
                <span className="text-white/50">Game ID</span><span>{customGameData.gameId}</span>
                <span className="text-white/50">Status</span>
                <span>{['Open', 'Finalized', 'Expired'][customGameData.status]}</span>
                <span className="text-white/50">Prize Model</span>
                <span>{customGameData.prizeModel === 0 ? 'Player-Funded' : 'Creator-Funded'}</span>
                <span className="text-white/50">Entry Fee</span><span>{lamportsToSol(customGameData.entryFeeLamports)} SOL</span>
                <span className="text-white/50">Entries</span><span>{customGameData.entryCount}</span>
                <span className="text-white/50">Total Pot</span><span>{lamportsToSol(customGameData.totalPot)} SOL</span>
                <span className="text-white/50">Prize Pot</span><span>{lamportsToSol(customGameData.prizePot)} SOL</span>
                <span className="text-white/50">Max Winners</span><span>{customGameData.maxWinners}</span>
                <span className="text-white/50">Prize Splits</span>
                <span>{customGameData.prizeSplitBps.filter(b => b > 0).map(b => `${b / 100}%`).join(' / ')}</span>
                <span className="text-white/50">Creator</span><span className="truncate">{customGameData.creator}</span>
                {customGameData.prizeModel === 1 && <>
                  <span className="text-white/50">Creator Deposit</span>
                  <span>{lamportsToSol(customGameData.creatorDepositLamports)} SOL</span>
                </>}
                <span className="text-white/50">Expires</span>
                <span>{new Date(customGameData.expiresAt * 1000).toLocaleString()}</span>
              </div>
              {customGameData.status === 1 && (
                <div className="mt-2 pt-2 border-t border-white/10">
                  <p className="text-white/50 mb-1">Winners & Prizes:</p>
                  {customGameData.winners.map((w, i) => {
                    const isDefault = w === PublicKey.default.toBase58();
                    if (isDefault) return null;
                    return (
                      <div key={i} className="flex justify-between">
                        <span className="truncate max-w-[200px]">#{i + 1} {w}</span>
                        <span className={customGameData.claimed[i] ? 'text-white/40 line-through' : 'text-emerald-400'}>
                          {lamportsToSol(customGameData.winnerAmounts[i])} SOL {customGameData.claimed[i] && '(claimed)'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Status Bar ─── */}
      {status && (
        <div className={`mt-4 p-3 rounded-lg border ${status.ok ? 'bg-white/5 border-white/10' : 'bg-red-500/10 border-red-500/20'}`}>
          <p className="text-sm">{status.msg}</p>
          {status.sig && (
            <a
              href={explorerLink(status.sig, devnet)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#14F195] hover:underline mt-1 inline-block"
            >
              View on Explorer →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
