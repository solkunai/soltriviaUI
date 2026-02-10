import React, { useState, useMemo } from 'react';
import { PublicKey, TransactionMessage, VersionedTransaction, Connection, clusterApiUrl } from '@solana/web3.js';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { initializeProgram, ensureRoundOnChain, postWinnersTest, getAuthHeaders } from '../src/utils/api';
import {
  SOLTRIVIA_PROGRAM_ID,
  buildEnterRoundInstruction,
  buildClaimPrizeInstruction,
  contractRoundIdFromDateAndNumber,
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

  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const roundNumber = Math.floor(now.getUTCHours() / 6);
  const roundIdU64 = contractRoundIdFromDateAndNumber(today, roundNumber);

  const run = async (label: string, fn: () => Promise<void>) => {
    setLoading(label);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(null);
    }
  };

  const useDevnet = forceDevnet || SOLANA_NETWORK === 'devnet';
  const devnetConnection = useMemo(() => new Connection(clusterApiUrl('devnet')), []);
  const connectionForTx = useDevnet ? devnetConnection : connection;

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
      {connected && useDevnet && (
        <p className="text-amber-200/90 text-xs mb-2">Switch your wallet to <strong>Devnet</strong> (e.g. Phantom → Settings → Developer Settings → Change Network) so Enter round / Claim txs work.</p>
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
