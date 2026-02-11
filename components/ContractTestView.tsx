import React, { useState, useMemo, useEffect } from 'react';
import { PublicKey, TransactionMessage, VersionedTransaction, Connection, clusterApiUrl } from '@solana/web3.js';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { initializeProgram, ensureRoundOnChain, postWinnersTest, refundRoundOnChain, getAuthHeaders } from '../src/utils/api';
import {
  SOLTRIVIA_PROGRAM_ID,
  buildEnterRoundInstruction,
  buildClaimPrizeInstruction,
  contractRoundIdFromDateAndNumber,
  fetchRoundAccountData,
} from '../src/utils/soltriviaContract';
import { REVENUE_WALLET, SOLANA_NETWORK, SUPABASE_FUNCTIONS_URL } from '../src/utils/constants';

const EXPLORER_BASE = 'https://explorer.solana.com';

function explorerTx(sig: string, useDevnet?: boolean): string {
  const cluster = useDevnet ? '?cluster=devnet' : (SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : '');
  return `${EXPLORER_BASE}/tx/${sig}${cluster}`;
}

export default function ContractTestView() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [status, setStatus] = useState<{ ok: boolean; message: string; sig?: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [claimRoundId, setClaimRoundId] = useState('');
  const [authorityPubkey, setAuthorityPubkey] = useState<string | null>(null);
  const [forceDevnet, setForceDevnet] = useState(true);
  const [claimAmountSol, setClaimAmountSol] = useState<string | null>(null);
  const [claimAmountStatus, setClaimAmountStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [refundRoundId, setRefundRoundId] = useState('');

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const roundNumber = Math.floor(now.getUTCHours() / 6);
  const roundIdU64 = contractRoundIdFromDateAndNumber(today, roundNumber);

  const run = async (label: string, fn: () => Promise<void>) => {
    setLoading(label);
    setStatus(null);
    try {
      await fn();
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      let msg = err.message;
      const cause = err instanceof Error && (e as any).cause;
      if (cause instanceof Error) msg += ` — ${cause.message}`;
      if (msg.includes('Custom":6001') || msg.includes('Custom:6001')) {
        msg = 'Round already finalized (winners were posted). Use a round that has not had "Post winners" yet, or increase the round number above to use a new round.';
      } else if (msg.includes('3012') || msg.includes('0xbc4') || msg.includes('AccountNotInitialized')) {
        if (loading === 'Ensure round' || msg.includes('config') || msg.includes('CreateRound')) {
          msg = 'Config not initialized. Click "1. Initialize program (once)" first, then try "2. Ensure round on-chain" again.';
        } else {
          msg = 'Round not created on-chain yet. Click "2. Ensure round on-chain" first, wait for success, then try "3. Enter round" again.';
        }
      } else if (msg.includes('Unexpected error') || msg.includes('WalletSendTransactionError')) {
        msg += ` — Switch your wallet to ${useDevnet ? 'Devnet' : 'Mainnet'} (e.g. Phantom → Settings → Developer Settings → Change Network) so it matches the checkbox above.`;
      }
      setStatus({ ok: false, message: msg });
    } finally {
      setLoading(null);
    }
  };

  const useDevnet = forceDevnet || SOLANA_NETWORK === 'devnet';
  const devnetConnection = useMemo(() => new Connection(clusterApiUrl('devnet')), []);
  const connectionForTx = useDevnet ? devnetConnection : connection;

  // Fetch on-chain claim amount for the round ID in the claim box (for testing)
  useEffect(() => {
    const rid = claimRoundId.trim();
    const roundId = rid ? parseInt(rid, 10) : NaN;
    if (!publicKey || !rid || Number.isNaN(roundId)) {
      setClaimAmountSol(null);
      setClaimAmountStatus('idle');
      return;
    }
    let cancelled = false;
    setClaimAmountStatus('loading');
    setClaimAmountSol(null);
    fetchRoundAccountData(connectionForTx, roundId, SOLTRIVIA_PROGRAM_ID)
      .then((round) => {
        if (cancelled) return;
        setClaimAmountStatus('done');
        if (!round) {
          setClaimAmountSol(null);
          return;
        }
        if (!round.finalized) {
          setClaimAmountSol(null);
          return;
        }
        const walletStr = publicKey.toBase58();
        const winnerIndex = round.winners.findIndex((w) => w === walletStr);
        if (winnerIndex < 0) {
          setClaimAmountSol(null);
          return;
        }
        if (round.claimed[winnerIndex]) {
          setClaimAmountSol(null);
          return;
        }
        const lamports = round.prizeAmounts[winnerIndex];
        setClaimAmountSol((lamports / 1_000_000_000).toFixed(6));
      })
      .catch(() => {
        if (!cancelled) {
          setClaimAmountStatus('done');
          setClaimAmountSol(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [claimRoundId, publicKey, connectionForTx]);

  const getAuthorityPubkey = async () => {
    setLoading('Get authority');
    setStatus(null);
    try {
      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/get-authority-pubkey`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.authority_pubkey) {
        setAuthorityPubkey(data.authority_pubkey);
        setStatus({ ok: true, message: data.message });
      } else {
        setStatus({ ok: false, message: data.error || 'Failed to get authority pubkey' });
      }
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(null);
    }
  };

  const initialize = async () => {
    const res = await initializeProgram({ revenueWallet: REVENUE_WALLET, useDevnet });
    setStatus({
      ok: true,
      message: res.message + (res.initialized ? ' (config created)' : ' (already existed)'),
      sig: res.signature,
    });
  };

  const ensureRound = async () => {
    const res = await ensureRoundOnChain(useDevnet ? { useDevnet: true } : undefined);
    setStatus({
      ok: true,
      message: res.created ? `Round created on-chain (round_id=${res.round_id_u64})` : `Round already exists (round_id=${res.round_id_u64})`,
      sig: res.signature,
    });
  };

  const enterRound = async () => {
    if (!publicKey) throw new Error('Wallet not connected');
    const ix = buildEnterRoundInstruction(
      roundIdU64,
      publicKey,
      new PublicKey(REVENUE_WALLET),
      SOLTRIVIA_PROGRAM_ID
    );
    const { blockhash } = await connectionForTx.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    const sim = await connectionForTx.simulateTransaction(tx);
    if (sim.value.err) {
      throw new Error(
        `Simulation failed: ${JSON.stringify(sim.value.err)}. Ensure program is deployed and round exists on ${useDevnet ? 'Devnet' : 'Mainnet'}, and wallet is on the same network.`
      );
    }
    const sig = await sendTransaction(tx, connectionForTx);
    setStatus({ ok: true, message: 'Enter round tx sent', sig });
  };

  const postWinnersTestAction = async () => {
    if (!publicKey) throw new Error('Wallet not connected');
    const walletStr = publicKey.toBase58();
    const res = await postWinnersTest({
      roundIdU64,
      winners: [walletStr, walletStr, walletStr, walletStr, walletStr],
      useDevnet,
    });
    setStatus({ ok: true, message: 'Winners posted (test). You can claim 1st place now.', sig: res.signature });
    setClaimRoundId(String(roundIdU64));
  };

  const claim = async () => {
    if (!publicKey) throw new Error('Wallet not connected');
    const rid = claimRoundId.trim();
    if (!rid) throw new Error('Enter a round_id (u64) to claim');
    const roundId = Number(rid);
    if (Number.isNaN(roundId)) throw new Error('round_id must be a number');
    await initializeProgram({ revenueWallet: REVENUE_WALLET, useDevnet }).catch(() => {});
    const ix = buildClaimPrizeInstruction(roundId, publicKey, SOLTRIVIA_PROGRAM_ID);
    const { blockhash } = await connectionForTx.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    const sim = await connectionForTx.simulateTransaction(tx);
    if (sim.value.err) {
      throw new Error(
        `Simulation failed: ${JSON.stringify(sim.value.err)}. Ensure program is deployed and round/winners exist on ${useDevnet ? 'Devnet' : 'Mainnet'}, and wallet is on the same network.`
      );
    }
    const sig = await sendTransaction(tx, connectionForTx);
    setStatus({ ok: true, message: 'Claim tx sent', sig });
  };

  return (
    <div className="p-6 max-w-xl mx-auto text-white">
      <h1 className="text-xl font-bold mb-2">Contract test (devnet/mainnet)</h1>
      <p className="text-sm text-white/70 mb-4">
        Program: <code className="bg-white/10 px-1 rounded">{SOLTRIVIA_PROGRAM_ID.toBase58().slice(0, 8)}…</code>
        {' · '}
        App network: <span className="font-mono">{SOLANA_NETWORK}</span>
      </p>
      <label className="flex items-center gap-2 mb-4 text-sm text-white/80">
        <input
          type="checkbox"
          checked={forceDevnet}
          onChange={(e) => setForceDevnet(e.target.checked)}
          className="rounded"
        />
        Use devnet for everything on this page (Enter round, Post winners, Claim use devnet)
      </label>
      <p className="text-sm text-white/70 mb-4">
        Current round: <span className="font-mono">{today}</span> #{roundNumber} → contract_round_id = <span className="font-mono">{roundIdU64}</span>
      </p>

      {!connected && (
        <p className="text-amber-400 mb-4">Connect wallet to use Enter round, Post winners, and Claim.</p>
      )}
      {connected && (
        <p className="text-amber-200/90 text-xs mb-2">
          {useDevnet ? (
            <>Your wallet must be on <strong>Devnet</strong> for Enter round / Claim (Phantom → Settings → Developer Settings → Change Network).</>
          ) : (
            <>Your wallet must be on <strong>Mainnet</strong> for Enter round / Claim.</>
          )}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          disabled={!!loading}
          onClick={() => run('Get authority', getAuthorityPubkey)}
          className="w-full py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-500 disabled:opacity-50 font-medium text-sm"
        >
          {loading === 'Get authority' ? '…' : 'Get authority pubkey (to fund)'}
        </button>
        {authorityPubkey && (
          <div className="p-2 bg-white/5 rounded text-xs font-mono break-all">
            {authorityPubkey}
          </div>
        )}
        <button
          type="button"
          disabled={!!loading}
          onClick={() => run('Initialize', initialize)}
          className="w-full py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 font-medium"
        >
          {loading === 'Initialize' ? '…' : '1. Initialize program (once)'}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => run('Ensure round', ensureRound)}
          className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-medium"
        >
          {loading === 'Ensure round' ? '…' : '2. Ensure round on-chain'}
        </button>
        <button
          type="button"
          disabled={!!loading || !connected}
          onClick={() => run('Enter round', enterRound)}
          className="w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-medium"
        >
          {loading === 'Enter round' ? '…' : '3. Enter round (0.0225 SOL)'}
        </button>
        <button
          type="button"
          disabled={!!loading || !connected}
          onClick={() => run('Post winners (test)', postWinnersTestAction)}
          className="w-full py-2 px-4 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 font-medium text-sm"
        >
          {loading === 'Post winners (test)' ? '…' : '3b. Post winners (test) — then claim below'}
        </button>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Round ID (u64) to claim"
              value={claimRoundId}
              onChange={(e) => setClaimRoundId(e.target.value)}
              className="flex-1 bg-white/10 rounded px-3 py-2 text-sm font-mono placeholder-white/50"
            />
            <button
              type="button"
              disabled={!!loading || !connected}
              onClick={() => run('Claim', claim)}
              className="py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-medium whitespace-nowrap"
            >
              {loading === 'Claim' ? '…' : '4. Claim'}
            </button>
          </div>
          {connected && claimRoundId.trim() && (
            <p className="text-sm text-white/80">
              {claimAmountStatus === 'loading' && 'Claim amount (on-chain): …'}
              {claimAmountStatus === 'done' && claimAmountSol != null && (
                <>Claim amount (on-chain): <span className="font-mono font-bold text-emerald-300">{claimAmountSol} SOL</span></>
              )}
              {claimAmountStatus === 'done' && claimAmountSol == null && (
                <span className="text-amber-200/90">Round not found, not finalized, or you are not an unclaimed winner for this round.</span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
          <p className="text-sm text-white/70">Refund (round with &lt;5 players):</p>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="daily_rounds UUID (status=refund)"
              value={refundRoundId}
              onChange={(e) => setRefundRoundId(e.target.value)}
              className="flex-1 bg-white/10 rounded px-3 py-2 text-sm font-mono placeholder-white/50"
            />
            <button
              type="button"
              disabled={!!loading || !refundRoundId.trim()}
              onClick={() =>
                run('Refund round', async () => {
                  const res = await refundRoundOnChain(refundRoundId.trim(), { useDevnet });
                  setStatus({
                    ok: true,
                    message: `Refunded ${res.recipients_count} recipient(s). ${res.signatures.length} tx(s).`,
                    sig: res.signatures[0],
                  });
                })
              }
              className="py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 font-medium whitespace-nowrap"
            >
              {loading === 'Refund round' ? '…' : '5. Refund round'}
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div className={`mt-4 p-3 rounded-lg ${status.ok ? 'bg-white/10' : 'bg-red-900/30'}`}>
          <p className="text-sm">{status.message}</p>
          {status.sig && (
            <a
              href={explorerTx(status.sig, useDevnet)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#14F195] hover:underline mt-1 inline-block"
            >
              View on Explorer →
            </a>
          )}
        </div>
      )}

      <details className="mt-6 text-sm text-white/70">
        <summary className="cursor-pointer font-medium text-white/90">What is AUTHORITY_KEYPAIR_JSON?</summary>
        <div className="mt-2 space-y-2 pl-2 border-l-2 border-white/20">
          <p>
            It is the <strong>secret key</strong> of the wallet that will be the program authority (can call initialize, create_round, post_winners). Set it as a Supabase Edge Function secret.
          </p>
          <p className="font-mono text-xs break-all">
            To get it: on a machine with Solana CLI, run <code className="bg-white/10 px-1">cat ~/.config/solana/id.json</code> (if you use your default keypair as authority). Or create a new keypair: <code className="bg-white/10 px-1">solana keygen new -o authority.json</code> then <code className="bg-white/10 px-1">cat authority.json</code>. The file content is a JSON array of 64 numbers — paste that entire array as the value of <code className="bg-white/10 px-1">AUTHORITY_KEYPAIR_JSON</code> in Supabase → Project Settings → Edge Functions → Secrets.
          </p>
          <p className="text-amber-200/90">
            Keep this secret safe. Anyone with it can create rounds and post winners. Do not commit it to git.
          </p>
        </div>
      </details>
    </div>
  );
}
