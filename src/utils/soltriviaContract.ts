/**
 * SolTrivia V2 on-chain contract helpers.
 * Program ID: A3CSWY7bJukyKgR8RXXq1jbRAvqTY5jYtArF5Xt9dhjE
 *
 * 24 instructions: admin (4), tier rounds (6), duels (6), custom games (8).
 * All PDA derivation, instruction builders, and account deserializers.
 */

import { PublicKey, TransactionInstruction, SystemProgram, Connection } from '@solana/web3.js';

// ─── Program ID ──────────────────────────────────────────────────────────────
export const SOLTRIVIA_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SOLTRIVIA_PROGRAM_ID || 'A3CSWY7bJukyKgR8RXXq1jbRAvqTY5jYtArF5Xt9dhjE'
);

// ─── PDA Seeds ───────────────────────────────────────────────────────────────
const CONFIG_SEED        = new TextEncoder().encode('config');
const TIER_ROUND_SEED    = new TextEncoder().encode('tier_round');
const TIER_VAULT_SEED    = new TextEncoder().encode('tier_vault');
const ENTRY_RECEIPT_SEED = new TextEncoder().encode('entry_receipt');
const DUEL_SEED          = new TextEncoder().encode('duel');
const DUEL_VAULT_SEED    = new TextEncoder().encode('duel_vault');
const CUSTOM_GAME_SEED   = new TextEncoder().encode('custom_game');
const CUSTOM_VAULT_SEED  = new TextEncoder().encode('custom_vault');
const CUSTOM_ENTRY_SEED  = new TextEncoder().encode('custom_entry');
const REFERRAL_BALANCE_SEED = new TextEncoder().encode('referral_balance');

// ─── Tier Fees (lamports) ────────────────────────────────────────────────────
export const TIER_FEES = [20_000_000, 100_000_000, 500_000_000, 1_000_000_000] as const;
export const TIER_LABELS = ['0.02 SOL', '0.1 SOL', '0.5 SOL', '1 SOL'] as const;

// ─── Duel Fee Presets (lamports) ─────────────────────────────────────────────
export const DUEL_FEES = [10_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000] as const;
export const DUEL_LABELS = ['0.01', '0.05', '0.1', '0.25', '0.5', '1'] as const;

// ─── Instruction Discriminators ──────────────────────────────────────────────
const DISC = {
  initialize:          new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]),
  updateConfig:        new Uint8Array([29, 158, 252, 191, 10, 83, 219, 99]),
  setOperator:         new Uint8Array([238, 153, 101, 169, 243, 131, 36, 1]),
  sweepTierRound:      new Uint8Array([136, 183, 135, 172, 168, 49, 224, 98]),
  createTierRound:     new Uint8Array([162, 240, 2, 22, 185, 203, 37, 12]),
  enterTierRound:      new Uint8Array([230, 192, 245, 116, 54, 64, 108, 190]),
  postTierWinners:     new Uint8Array([70, 38, 33, 134, 124, 35, 47, 80]),
  claimTierPrize:      new Uint8Array([205, 181, 215, 181, 137, 139, 30, 211]),
  setTierRefundMode:   new Uint8Array([233, 0, 243, 106, 166, 5, 101, 185]),
  claimTierRefund:     new Uint8Array([193, 160, 185, 76, 0, 213, 53, 28]),
  createDuel:          new Uint8Array([49, 28, 93, 11, 75, 242, 69, 165]),
  joinDuel:            new Uint8Array([7, 247, 76, 103, 101, 139, 254, 61]),
  cancelDuel:          new Uint8Array([83, 124, 224, 237, 235, 44, 38, 57]),
  resolveDuel:         new Uint8Array([213, 162, 203, 235, 151, 236, 178, 64]),
  claimDuelPrize:      new Uint8Array([62, 248, 253, 160, 241, 136, 213, 179]),
  expireDuel:          new Uint8Array([14, 97, 26, 205, 151, 231, 171, 230]),
  createCustomGame:    new Uint8Array([219, 188, 13, 14, 51, 166, 197, 224]),
  fundCustomGame:      new Uint8Array([182, 95, 56, 52, 103, 171, 133, 109]),
  enterCustomGame:     new Uint8Array([8, 225, 134, 125, 188, 36, 95, 58]),
  finalizeCustomGame:  new Uint8Array([197, 110, 163, 187, 153, 19, 233, 17]),
  claimCustomPrize:    new Uint8Array([175, 202, 9, 166, 25, 150, 96, 155]),
  expireCustomGame:    new Uint8Array([139, 178, 155, 250, 29, 58, 44, 3]),
  claimCustomRefund:   new Uint8Array([84, 191, 182, 14, 46, 225, 241, 98]),
  sweepCustomGame:     new Uint8Array([99, 186, 60, 217, 60, 182, 137, 168]),
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function u64Le(n: number | bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, BigInt(n), true);
  return buf;
}

function u16Le(n: number): Uint8Array {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, n, true);
  return buf;
}

function i64Le(n: number | bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigInt64(0, BigInt(n), true);
  return buf;
}

function boolByte(b: boolean): Uint8Array {
  return new Uint8Array([b ? 1 : 0]);
}

/** Encode a Borsh Option<T>: 0x00 = None, 0x01 + value = Some */
function optionPubkey(pk: PublicKey | null): Uint8Array {
  if (!pk) return new Uint8Array([0]);
  const buf = new Uint8Array(1 + 32);
  buf[0] = 1;
  buf.set(pk.toBytes(), 1);
  return buf;
}
function optionU64(n: number | null): Uint8Array {
  if (n === null) return new Uint8Array([0]);
  const buf = new Uint8Array(1 + 8);
  buf[0] = 1;
  buf.set(u64Le(n), 1);
  return buf;
}
function optionU16(n: number | null): Uint8Array {
  if (n === null) return new Uint8Array([0]);
  const buf = new Uint8Array(1 + 2);
  buf[0] = 1;
  buf.set(u16Le(n), 1);
  return buf;
}
function optionI64(n: number | null): Uint8Array {
  if (n === null) return new Uint8Array([0]);
  const buf = new Uint8Array(1 + 8);
  buf[0] = 1;
  buf.set(i64Le(n), 1);
  return buf;
}
function optionBool(b: boolean | null): Uint8Array {
  if (b === null) return new Uint8Array([0]);
  return new Uint8Array([1, b ? 1 : 0]);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function makeIx(
  programId: PublicKey,
  disc: Uint8Array,
  args: Uint8Array,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
): TransactionInstruction {
  return new TransactionInstruction({
    programId,
    keys,
    data: concat(disc, args) as unknown as Buffer,
  });
}

// ─── PDA Derivation ──────────────────────────────────────────────────────────

export function getConfigPda(programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], programId)[0];
}

export function getTierRoundPda(roundId: number, tierIndex: number, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [TIER_ROUND_SEED, u64Le(roundId), new Uint8Array([tierIndex])],
    programId,
  )[0];
}

export function getTierVaultPda(roundId: number, tierIndex: number, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [TIER_VAULT_SEED, u64Le(roundId), new Uint8Array([tierIndex])],
    programId,
  )[0];
}

export function getEntryReceiptPda(roundId: number, tierIndex: number, player: PublicKey, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [ENTRY_RECEIPT_SEED, u64Le(roundId), new Uint8Array([tierIndex]), player.toBytes()],
    programId,
  )[0];
}

export function getDuelPda(duelId: number, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([DUEL_SEED, u64Le(duelId)], programId)[0];
}

export function getDuelVaultPda(duelId: number, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([DUEL_VAULT_SEED, u64Le(duelId)], programId)[0];
}

export function getCustomGamePda(gameId: number, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([CUSTOM_GAME_SEED, u64Le(gameId)], programId)[0];
}

export function getCustomVaultPda(gameId: number, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([CUSTOM_VAULT_SEED, u64Le(gameId)], programId)[0];
}

export function getCustomEntryPda(gameId: number, player: PublicKey, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [CUSTOM_ENTRY_SEED, u64Le(gameId), player.toBytes()],
    programId,
  )[0];
}

export function getReferralBalancePda(referrer: PublicKey, programId = SOLTRIVIA_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [REFERRAL_BALANCE_SEED, referrer.toBytes()],
    programId,
  )[0];
}

// ─── Round ID Calculation ────────────────────────────────────────────────────

export function contractRoundIdFromDateAndNumber(dateStr: string, roundNumber: number): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const epoch = new Date(Date.UTC(1970, 0, 1)).getTime();
  const day = new Date(Date.UTC(y, m - 1, d)).getTime();
  const daysSinceEpoch = Math.floor((day - epoch) / 86400_000);
  return daysSinceEpoch * 4 + (roundNumber & 3);
}

// ─── Account Types ───────────────────────────────────────────────────────────

export interface GameConfigData {
  owner: string;
  operator: string;
  revenueWallet: string;
  sweepWallet: string;
  platformFeeLamports: number;
  duelHouseCutBps: number;
  customGamePlatformCutBps: number;
  sweepDelaySeconds: number;
  nextDuelId: number;
  nextCustomGameId: number;
  paused: boolean;
}

export interface TierRoundData {
  roundId: number;
  tierIndex: number;
  entryFeeLamports: number;
  totalPot: number;
  entryCount: number;
  finalized: boolean;
  refundMode: boolean;
  settledAt: number;
  winners: string[];
  prizeAmounts: number[];
  claimed: boolean[];
}

export interface DuelData {
  duelId: number;
  player1: string;
  player2: string;
  entryFeeLamports: number;
  totalPot: number;
  status: number;
  winner: string;
  winnerClaimed: boolean;
  houseCutLamports: number;
  isPublic: boolean;
  createdAt: number;
  expiresAt: number;
}

export interface CustomGameData {
  gameId: number;
  creator: string;
  entryFeeLamports: number;
  prizeModel: number;
  creatorDepositLamports: number;
  maxWinners: number;
  prizeSplitBps: number[];
  platformCutBps: number;
  entryCount: number;
  totalPot: number;
  prizePot: number;
  status: number;
  settledAt: number;
  winners: string[];
  winnerAmounts: number[];
  claimed: boolean[];
  creatorPaid: boolean;
  expiresAt: number;
  createdAt: number;
}

// ─── Account Deserializers ───────────────────────────────────────────────────

const DISCRIMINATOR = 8;

function readPubkey(data: Uint8Array, offset: number): string {
  return new PublicKey(data.slice(offset, offset + 32)).toBase58();
}
function readU64(dv: DataView, offset: number): number {
  return Number(dv.getBigUint64(offset, true));
}
function readI64(dv: DataView, offset: number): number {
  return Number(dv.getBigInt64(offset, true));
}
function readU32(dv: DataView, offset: number): number {
  return dv.getUint32(offset, true);
}
function readU16(dv: DataView, offset: number): number {
  return dv.getUint16(offset, true);
}

export function deserializeGameConfig(data: Uint8Array): GameConfigData {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = DISCRIMINATOR;
  const owner = readPubkey(data, o); o += 32;
  const operator = readPubkey(data, o); o += 32;
  const revenueWallet = readPubkey(data, o); o += 32;
  const sweepWallet = readPubkey(data, o); o += 32;
  const platformFeeLamports = readU64(dv, o); o += 8;
  const duelHouseCutBps = readU16(dv, o); o += 2;
  const customGamePlatformCutBps = readU16(dv, o); o += 2;
  const sweepDelaySeconds = readI64(dv, o); o += 8;
  const nextDuelId = readU64(dv, o); o += 8;
  const nextCustomGameId = readU64(dv, o); o += 8;
  const paused = data[o] !== 0;
  return { owner, operator, revenueWallet, sweepWallet, platformFeeLamports, duelHouseCutBps, customGamePlatformCutBps, sweepDelaySeconds, nextDuelId, nextCustomGameId, paused };
}

export function deserializeTierRound(data: Uint8Array): TierRoundData {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = DISCRIMINATOR;
  const roundId = readU64(dv, o); o += 8;
  const tierIndex = data[o]; o += 1;
  const entryFeeLamports = readU64(dv, o); o += 8;
  const totalPot = readU64(dv, o); o += 8;
  const entryCount = readU32(dv, o); o += 4;
  const finalized = data[o] !== 0; o += 1;
  const refundMode = data[o] !== 0; o += 1;
  const settledAt = readI64(dv, o); o += 8;
  const winners: string[] = [];
  for (let i = 0; i < 5; i++) { winners.push(readPubkey(data, o)); o += 32; }
  const prizeAmounts: number[] = [];
  for (let i = 0; i < 5; i++) { prizeAmounts.push(readU64(dv, o)); o += 8; }
  const claimed: boolean[] = [];
  for (let i = 0; i < 5; i++) { claimed.push(data[o] !== 0); o += 1; }
  return { roundId, tierIndex, entryFeeLamports, totalPot, entryCount, finalized, refundMode, settledAt, winners, prizeAmounts, claimed };
}

export function deserializeDuel(data: Uint8Array): DuelData {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = DISCRIMINATOR;
  const duelId = readU64(dv, o); o += 8;
  const player1 = readPubkey(data, o); o += 32;
  const player2 = readPubkey(data, o); o += 32;
  const entryFeeLamports = readU64(dv, o); o += 8;
  const totalPot = readU64(dv, o); o += 8;
  const status = data[o]; o += 1;
  const winner = readPubkey(data, o); o += 32;
  const winnerClaimed = data[o] !== 0; o += 1;
  const houseCutLamports = readU64(dv, o); o += 8;
  const isPublic = data[o] !== 0; o += 1;
  const createdAt = readI64(dv, o); o += 8;
  const expiresAt = readI64(dv, o); o += 8;
  return { duelId, player1, player2, entryFeeLamports, totalPot, status, winner, winnerClaimed, houseCutLamports, isPublic, createdAt, expiresAt };
}

export function deserializeCustomGame(data: Uint8Array): CustomGameData {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = DISCRIMINATOR;
  const gameId = readU64(dv, o); o += 8;
  const creator = readPubkey(data, o); o += 32;
  const entryFeeLamports = readU64(dv, o); o += 8;
  const prizeModel = data[o]; o += 1;
  const creatorDepositLamports = readU64(dv, o); o += 8;
  const maxWinners = data[o]; o += 1;
  const prizeSplitBps: number[] = [];
  for (let i = 0; i < 5; i++) { prizeSplitBps.push(readU16(dv, o)); o += 2; }
  const platformCutBps = readU16(dv, o); o += 2;
  const entryCount = readU32(dv, o); o += 4;
  const totalPot = readU64(dv, o); o += 8;
  const prizePot = readU64(dv, o); o += 8;
  const status = data[o]; o += 1;
  const settledAt = readI64(dv, o); o += 8;
  const winners: string[] = [];
  for (let i = 0; i < 5; i++) { winners.push(readPubkey(data, o)); o += 32; }
  const winnerAmounts: number[] = [];
  for (let i = 0; i < 5; i++) { winnerAmounts.push(readU64(dv, o)); o += 8; }
  const claimed: boolean[] = [];
  for (let i = 0; i < 5; i++) { claimed.push(data[o] !== 0); o += 1; }
  const creatorPaid = data[o] !== 0; o += 1;
  const expiresAt = readI64(dv, o); o += 8;
  const createdAt = readI64(dv, o); o += 8;
  return { gameId, creator, entryFeeLamports, prizeModel, creatorDepositLamports, maxWinners, prizeSplitBps, platformCutBps, entryCount, totalPot, prizePot, status, settledAt, winners, winnerAmounts, claimed, creatorPaid, expiresAt, createdAt };
}

// ─── Fetch Helpers ───────────────────────────────────────────────────────────

export async function fetchGameConfig(connection: Connection, programId = SOLTRIVIA_PROGRAM_ID): Promise<GameConfigData | null> {
  const info = await connection.getAccountInfo(getConfigPda(programId));
  if (!info?.data) return null;
  return deserializeGameConfig(new Uint8Array(info.data));
}

export async function fetchTierRound(connection: Connection, roundId: number, tierIndex: number, programId = SOLTRIVIA_PROGRAM_ID): Promise<TierRoundData | null> {
  const info = await connection.getAccountInfo(getTierRoundPda(roundId, tierIndex, programId));
  if (!info?.data) return null;
  return deserializeTierRound(new Uint8Array(info.data));
}

export async function fetchDuel(connection: Connection, duelId: number, programId = SOLTRIVIA_PROGRAM_ID): Promise<DuelData | null> {
  const info = await connection.getAccountInfo(getDuelPda(duelId, programId));
  if (!info?.data) return null;
  return deserializeDuel(new Uint8Array(info.data));
}

export async function fetchCustomGame(connection: Connection, gameId: number, programId = SOLTRIVIA_PROGRAM_ID): Promise<CustomGameData | null> {
  const info = await connection.getAccountInfo(getCustomGamePda(gameId, programId));
  if (!info?.data) return null;
  return deserializeCustomGame(new Uint8Array(info.data));
}

// ═════════════════════════════════════════════════════════════════════════════
// INSTRUCTION BUILDERS
// ═════════════════════════════════════════════════════════════════════════════

// ─── Admin ───────────────────────────────────────────────────────────────────

export function buildInitializeIx(
  owner: PublicKey,
  operator: PublicKey,
  revenueWallet: PublicKey,
  sweepWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.initialize,
    concat(operator.toBytes(), revenueWallet.toBytes(), sweepWallet.toBytes()),
    [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildUpdateConfigIx(
  owner: PublicKey,
  opts: {
    revenueWallet?: PublicKey | null;
    sweepWallet?: PublicKey | null;
    platformFeeLamports?: number | null;
    duelHouseCutBps?: number | null;
    customGamePlatformCutBps?: number | null;
    sweepDelaySeconds?: number | null;
    paused?: boolean | null;
  },
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.updateConfig,
    concat(
      optionPubkey(opts.revenueWallet ?? null),
      optionPubkey(opts.sweepWallet ?? null),
      optionU64(opts.platformFeeLamports ?? null),
      optionU16(opts.duelHouseCutBps ?? null),
      optionU16(opts.customGamePlatformCutBps ?? null),
      optionI64(opts.sweepDelaySeconds ?? null),
      optionBool(opts.paused ?? null),
    ),
    [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: true },
    ],
  );
}

export function buildSetOperatorIx(
  owner: PublicKey,
  newOperator: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.setOperator,
    newOperator.toBytes(),
    [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: true },
    ],
  );
}

// ─── Tier Rounds ─────────────────────────────────────────────────────────────

export function buildCreateTierRoundIx(
  authority: PublicKey,
  roundId: number,
  tierIndex: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.createTierRound,
    concat(u64Le(roundId), new Uint8Array([tierIndex])),
    [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getTierRoundPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: getTierVaultPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildEnterTierRoundIx(
  player: PublicKey,
  roundId: number,
  tierIndex: number,
  revenueWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.enterTierRound,
    concat(u64Le(roundId), new Uint8Array([tierIndex])),
    [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getTierRoundPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: getTierVaultPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: revenueWallet, isSigner: false, isWritable: true },
      { pubkey: getEntryReceiptPda(roundId, tierIndex, player, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildPostTierWinnersIx(
  authority: PublicKey,
  roundId: number,
  tierIndex: number,
  winners: PublicKey[],
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  const paddedWinners = [...winners];
  while (paddedWinners.length < 5) paddedWinners.push(PublicKey.default);
  const winnersBytes = concat(...paddedWinners.map(w => w.toBytes()));
  return makeIx(programId, DISC.postTierWinners,
    concat(u64Le(roundId), new Uint8Array([tierIndex]), winnersBytes),
    [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getTierRoundPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
    ],
  );
}

export function buildClaimTierPrizeIx(
  winner: PublicKey,
  roundId: number,
  tierIndex: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.claimTierPrize,
    concat(u64Le(roundId), new Uint8Array([tierIndex])),
    [
      { pubkey: winner, isSigner: true, isWritable: true },
      { pubkey: getTierRoundPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: getTierVaultPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildSetTierRefundModeIx(
  authority: PublicKey,
  roundId: number,
  tierIndex: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.setTierRefundMode,
    concat(u64Le(roundId), new Uint8Array([tierIndex])),
    [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getTierRoundPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
    ],
  );
}

export function buildClaimTierRefundIx(
  player: PublicKey,
  roundId: number,
  tierIndex: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.claimTierRefund,
    concat(u64Le(roundId), new Uint8Array([tierIndex])),
    [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: getTierRoundPda(roundId, tierIndex, programId), isSigner: false, isWritable: false },
      { pubkey: getTierVaultPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: getEntryReceiptPda(roundId, tierIndex, player, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

// ─── Duels ───────────────────────────────────────────────────────────────────

export function buildCreateDuelIx(
  player1: PublicKey,
  entryFeeLamports: number,
  isPublic: boolean,
  nextDuelId: number,
  revenueWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.createDuel,
    concat(u64Le(entryFeeLamports), boolByte(isPublic)),
    [
      { pubkey: player1, isSigner: true, isWritable: true },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: true },
      { pubkey: getDuelPda(nextDuelId, programId), isSigner: false, isWritable: true },
      { pubkey: getDuelVaultPda(nextDuelId, programId), isSigner: false, isWritable: true },
      { pubkey: revenueWallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildJoinDuelIx(
  player2: PublicKey,
  duelId: number,
  revenueWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.joinDuel,
    u64Le(duelId),
    [
      { pubkey: player2, isSigner: true, isWritable: true },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getDuelPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: getDuelVaultPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: revenueWallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildCancelDuelIx(
  player1: PublicKey,
  duelId: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.cancelDuel,
    u64Le(duelId),
    [
      { pubkey: player1, isSigner: true, isWritable: true },
      { pubkey: getDuelPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: getDuelVaultPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildResolveDuelIx(
  authority: PublicKey,
  duelId: number,
  winner: PublicKey,
  revenueWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.resolveDuel,
    concat(u64Le(duelId), winner.toBytes()),
    [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getDuelPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: getDuelVaultPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: revenueWallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildClaimDuelPrizeIx(
  winner: PublicKey,
  duelId: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.claimDuelPrize,
    u64Le(duelId),
    [
      { pubkey: winner, isSigner: true, isWritable: true },
      { pubkey: getDuelPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: getDuelVaultPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildExpireDuelIx(
  cranker: PublicKey,
  duelId: number,
  player1: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.expireDuel,
    u64Le(duelId),
    [
      { pubkey: cranker, isSigner: true, isWritable: false },
      { pubkey: getDuelPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: getDuelVaultPda(duelId, programId), isSigner: false, isWritable: true },
      { pubkey: player1, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

// ─── Custom Games ────────────────────────────────────────────────────────────

export function buildCreateCustomGameIx(
  authority: PublicKey,
  nextGameId: number,
  creator: PublicKey,
  entryFeeLamports: number,
  prizeModel: number,
  maxWinners: number,
  prizeSplitBps: number[],
  expiresAt: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  const paddedSplits = [...prizeSplitBps];
  while (paddedSplits.length < 5) paddedSplits.push(0);
  const splitsBytes = concat(...paddedSplits.map(s => u16Le(s)));
  return makeIx(programId, DISC.createCustomGame,
    concat(creator.toBytes(), u64Le(entryFeeLamports), new Uint8Array([prizeModel]), new Uint8Array([maxWinners]), splitsBytes, i64Le(expiresAt)),
    [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: true },
      { pubkey: getCustomGamePda(nextGameId, programId), isSigner: false, isWritable: true },
      { pubkey: getCustomVaultPda(nextGameId, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildFundCustomGameIx(
  creator: PublicKey,
  gameId: number,
  amount: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.fundCustomGame,
    concat(u64Le(gameId), u64Le(amount)),
    [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: getCustomGamePda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: getCustomVaultPda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildEnterCustomGameIx(
  player: PublicKey,
  gameId: number,
  revenueWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.enterCustomGame,
    u64Le(gameId),
    [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getCustomGamePda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: getCustomVaultPda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: revenueWallet, isSigner: false, isWritable: true },
      { pubkey: getCustomEntryPda(gameId, player, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildFinalizeCustomGameIx(
  authority: PublicKey,
  gameId: number,
  winners: PublicKey[],
  creatorWallet: PublicKey,
  revenueWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  const paddedWinners = [...winners];
  while (paddedWinners.length < 5) paddedWinners.push(PublicKey.default);
  const winnersBytes = concat(...paddedWinners.map(w => w.toBytes()));
  return makeIx(programId, DISC.finalizeCustomGame,
    concat(u64Le(gameId), winnersBytes),
    [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getCustomGamePda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: getCustomVaultPda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: revenueWallet, isSigner: false, isWritable: true },
      { pubkey: creatorWallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildClaimCustomPrizeIx(
  winner: PublicKey,
  gameId: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.claimCustomPrize,
    u64Le(gameId),
    [
      { pubkey: winner, isSigner: true, isWritable: true },
      { pubkey: getCustomGamePda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: getCustomVaultPda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildExpireCustomGameIx(
  authority: PublicKey,
  gameId: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.expireCustomGame,
    u64Le(gameId),
    [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getCustomGamePda(gameId, programId), isSigner: false, isWritable: true },
    ],
  );
}

export function buildClaimCustomRefundIx(
  claimant: PublicKey,
  gameId: number,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.claimCustomRefund,
    u64Le(gameId),
    [
      { pubkey: claimant, isSigner: true, isWritable: true },
      { pubkey: getCustomGamePda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: getCustomVaultPda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: getCustomEntryPda(gameId, claimant, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildSweepTierRoundIx(
  owner: PublicKey,
  roundId: number,
  tierIndex: number,
  sweepWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.sweepTierRound,
    concat(u64Le(roundId), new Uint8Array([tierIndex])),
    [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getTierRoundPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: getTierVaultPda(roundId, tierIndex, programId), isSigner: false, isWritable: true },
      { pubkey: sweepWallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

export function buildSweepCustomGameIx(
  owner: PublicKey,
  gameId: number,
  sweepWallet: PublicKey,
  programId = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return makeIx(programId, DISC.sweepCustomGame,
    u64Le(gameId),
    [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: getCustomGamePda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: getCustomVaultPda(gameId, programId), isSigner: false, isWritable: true },
      { pubkey: sweepWallet, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NFT Mint (v2.1) — commemorative mint via Bubblegum + Core
// Source of truth: programs/soltrivia_v2/src/instructions/nft_mint.rs
// ═══════════════════════════════════════════════════════════════════════════

const NFT_MINT_CONFIG_SEED   = new TextEncoder().encode('nft_mint_config');
const MINTER_SEED            = new TextEncoder().encode('minter');
const MINT_AUTHORITY_SEED    = new TextEncoder().encode('mint_authority');

// External Metaplex / Token-2022 program IDs (verbatim from nft_mint.rs).
export const MPL_BUBBLEGUM_ID         = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
export const MPL_NOOP_ID              = new PublicKey('mnoopTCrg4p8ry25e4bcWA9XZjbNjMTfgYVGGEdRsf3');
export const MPL_ACCOUNT_COMPRESSION_ID = new PublicKey('mcmt6YrQEMKw8Mw43FmpRLmf7BqRnFMKmAcbxE3xkAW');
export const MPL_CORE_ID              = new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d');
export const MPL_CORE_CPI_SIGNER      = new PublicKey('CbNY3JiXdXNE9tPNEk1aRZVEkWdj2v7kfJLNQwZZgpXk');
export const TOKEN_2022_PROGRAM       = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
export const SGT_MINT_AUTHORITY       = new PublicKey('GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4');

// v2.1 discriminators (Anchor: sha256("global:<fn>")[0..8]).
const NFT_DISC = {
  initNftMintConfig:    new Uint8Array([234, 251, 238, 11, 252, 157, 126, 136]),
  mintCommemorative:    new Uint8Array([209, 133, 229, 236, 206, 175, 120, 52]),
  initReferralBalance:  new Uint8Array([44, 125, 2, 25, 60, 102, 100, 183]),
  claimReferralBalance: new Uint8Array([232, 137, 146, 65, 228, 90, 194, 96]),
} as const;

// ─── PDA Derivations ───

export function getNftMintConfigPda(programId: PublicKey = SOLTRIVIA_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([NFT_MINT_CONFIG_SEED], programId)[0];
}

export function getMinterRecordPda(
  player: PublicKey,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync([MINTER_SEED, player.toBytes()], programId)[0];
}

export function getMintAuthorityPda(programId: PublicKey = SOLTRIVIA_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([MINT_AUTHORITY_SEED], programId)[0];
}

/** Bubblegum tree_config PDA: seeds=[merkle_tree], program=Bubblegum. */
export function getBubblegumTreeConfigPda(merkleTree: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([merkleTree.toBytes()], MPL_BUBBLEGUM_ID)[0];
}

// ─── Account Data Types + Deserializers ───

export type NftMintConfigData = {
  authority: string;
  revenueWallet: string;
  merkleTree: string;
  collection: string;
  basePriceLamports: number;
  seekerPriceLamports: number;
  maxPerWallet: number;
  mintedTotal: number;
  paused: boolean;
};

export type MinterRecordData = {
  player: string;
  mintCount: number;
};

/** Layout (after 8-byte Anchor discriminator):
 *  authority[32] · revenue_wallet[32] · merkle_tree[32] · collection[32]
 *  base_price_lamports[u64] · seeker_price_lamports[u64]
 *  max_per_wallet[u16] · minted_total[u64] · paused[u8] · bump[u8]
 */
export function deserializeNftMintConfig(raw: Uint8Array): NftMintConfigData {
  const data = raw.slice(8);
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    authority:           new PublicKey(data.slice(0, 32)).toBase58(),
    revenueWallet:       new PublicKey(data.slice(32, 64)).toBase58(),
    merkleTree:          new PublicKey(data.slice(64, 96)).toBase58(),
    collection:          new PublicKey(data.slice(96, 128)).toBase58(),
    basePriceLamports:   Number(dv.getBigUint64(128, true)),
    seekerPriceLamports: Number(dv.getBigUint64(136, true)),
    maxPerWallet:        dv.getUint16(144, true),
    mintedTotal:         Number(dv.getBigUint64(146, true)),
    paused:              data[154] === 1,
  };
}

/** Layout (after 8-byte discriminator): player[32] · mint_count[u16] · bump[u8]. */
export function deserializeMinterRecord(raw: Uint8Array): MinterRecordData {
  const data = raw.slice(8);
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    player:     new PublicKey(data.slice(0, 32)).toBase58(),
    mintCount:  dv.getUint16(32, true),
  };
}

// ─── Account Fetchers ───

export async function fetchNftMintConfig(
  connection: Connection,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): Promise<NftMintConfigData | null> {
  const pda = getNftMintConfigPda(programId);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return deserializeNftMintConfig(new Uint8Array(info.data));
}

export async function fetchMinterRecord(
  connection: Connection,
  player: PublicKey,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): Promise<MinterRecordData | null> {
  const pda = getMinterRecordPda(player, programId);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return deserializeMinterRecord(new Uint8Array(info.data));
}

// ─── Ix Builder: mint_commemorative ───
//
// Account order (17, MUST match `MintCommemorative` struct in nft_mint.rs):
//   0. player (sig, mut)
//   1. nft_config (PDA, mut)
//   2. minter_record (PDA, mut, init_if_needed)
//   3. mint_authority (PDA, readonly — PDA signs the Bubblegum CPI)
//   4. revenue_wallet (mut, must equal nft_config.revenue_wallet)
//   5. eligibility_proof (readonly, EntryReceipt | CustomGameEntry | Duel PDA)
//   6. sgt_token_account (Option<UncheckedAccount>) — pass programId placeholder if omitted
//   7. sgt_mint           (Option<UncheckedAccount>) — pass programId placeholder if omitted
//   8. tree_config (mut)
//   9. merkle_tree (mut, must equal nft_config.merkle_tree)
//  10. core_collection (mut, must equal nft_config.collection)
//  11. mpl_core_cpi_signer (MPL_CORE_CPI_SIGNER)
//  12. log_wrapper        (MPL_NOOP_ID)
//  13. compression_program (MPL_ACCOUNT_COMPRESSION_ID)
//  14. mpl_core_program   (MPL_CORE_ID)
//  15. bubblegum_program  (MPL_BUBBLEGUM_ID)
//  16. system_program
//
// Anchor optional convention: pass the calling program's id as a placeholder
// when an `Option<...>` account is None.
export function buildMintCommemorativeIx(args: {
  player: PublicKey;
  revenueWallet: PublicKey;
  merkleTree: PublicKey;
  coreCollection: PublicKey;
  sgtTokenAccount?: PublicKey | null;
  sgtMint?: PublicKey | null;
  programId?: PublicKey;
}): TransactionInstruction {
  // Kyle 2026-06-08: dropped `eligibilityProof` account from this account
  // list because the on-chain MintCommemorative struct no longer accepts
  // it (verify_eligibility was removed from the contract). The account
  // order below must match the new Rust struct exactly:
  //   player, nft_config, minter_record, mint_authority, revenue_wallet,
  //   sgt_token_account (opt), sgt_mint (opt), tree_config, merkle_tree,
  //   core_collection, mpl_core_cpi_signer, log_wrapper, compression,
  //   mpl_core, bubblegum, system_program
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const sgtTa = args.sgtTokenAccount ?? programId;
  const sgtMi = args.sgtMint ?? programId;

  return makeIx(
    programId,
    NFT_DISC.mintCommemorative,
    new Uint8Array(0),
    [
      { pubkey: args.player,                                isSigner: true,  isWritable: true  },
      { pubkey: getNftMintConfigPda(programId),             isSigner: false, isWritable: true  },
      { pubkey: getMinterRecordPda(args.player, programId), isSigner: false, isWritable: true  },
      { pubkey: getMintAuthorityPda(programId),             isSigner: false, isWritable: false },
      { pubkey: args.revenueWallet,                         isSigner: false, isWritable: true  },
      { pubkey: sgtTa,                                      isSigner: false, isWritable: false },
      { pubkey: sgtMi,                                      isSigner: false, isWritable: false },
      { pubkey: getBubblegumTreeConfigPda(args.merkleTree), isSigner: false, isWritable: true  },
      { pubkey: args.merkleTree,                            isSigner: false, isWritable: true  },
      { pubkey: args.coreCollection,                        isSigner: false, isWritable: true  },
      { pubkey: MPL_CORE_CPI_SIGNER,                        isSigner: false, isWritable: false },
      { pubkey: MPL_NOOP_ID,                                isSigner: false, isWritable: false },
      { pubkey: MPL_ACCOUNT_COMPRESSION_ID,                 isSigner: false, isWritable: false },
      { pubkey: MPL_CORE_ID,                                isSigner: false, isWritable: false },
      { pubkey: MPL_BUBBLEGUM_ID,                           isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,                    isSigner: false, isWritable: false },
    ],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NFT Custom Games (v2.1) — creator escrows an NFT as the prize, players pay
// SOL entry fee, operator finalizes with a single winner, winner claims the
// NFT. Two variants by NFT standard:
//   - Core (mpl-core): use *Nft builders below (7-9 accounts each)
//   - Token Metadata pNFT: use *TmPnft builders (17-18 accounts each)
//
// Source of truth: programs/soltrivia_v2/src/instructions/custom_game_nft.rs +
// custom_game_tm_pnft.rs. Account order MUST match the Rust Accounts<> structs
// verbatim or transactions fail on-chain.
// ═══════════════════════════════════════════════════════════════════════════

const CUSTOM_GAME_NFT_SEED   = new TextEncoder().encode('custom_nft');
const CUSTOM_NFT_ESCROW_SEED = new TextEncoder().encode('custom_nft_escrow');

// External program / sysvar IDs for the pNFT (Token Metadata) flow.
export const MPL_TOKEN_METADATA_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
export const SPL_TOKEN_PROGRAM_ID  = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const SPL_ATA_PROGRAM_ID    = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const SYSVAR_INSTRUCTIONS_ID = new PublicKey('Sysvar1nstructions1111111111111111111111111');

// v2.1 NFT custom game discriminators (Anchor: sha256("global:<fn>")[0..8]).
const NFT_GAME_DISC = {
  createCustomGameNft:      new Uint8Array([130, 187, 222, 216, 190, 72, 73, 242]),
  enterCustomGameNft:       new Uint8Array([118, 42, 6, 152, 60, 2, 39, 252]),
  finalizeCustomGameNft:    new Uint8Array([208, 105, 25, 221, 198, 137, 188, 213]),
  claimCustomNftPrize:      new Uint8Array([31, 78, 197, 248, 144, 13, 201, 153]),
  reclaimCustomNft:         new Uint8Array([82, 81, 71, 63, 203, 53, 11, 70]),
  createCustomGameTmPnft:   new Uint8Array([158, 150, 158, 121, 201, 119, 31, 122]),
  claimCustomTmPnftPrize:   new Uint8Array([116, 175, 150, 125, 123, 28, 5, 184]),
  reclaimCustomTmPnft:      new Uint8Array([35, 244, 234, 39, 27, 28, 191, 173]),
} as const;

// ─── PDA Derivations ───

/** CustomGameNft PDA: seeds=[CUSTOM_GAME_NFT_SEED, game_id_le_bytes]. Shared by both Core + pNFT variants. */
export function getCustomGameNftPda(
  gameId: number | bigint,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CUSTOM_GAME_NFT_SEED, u64Le(gameId)],
    programId,
  )[0];
}

/** Custom NFT escrow PDA: seeds=[CUSTOM_NFT_ESCROW_SEED, game_id_le_bytes]. */
export function getCustomNftEscrowPda(
  gameId: number | bigint,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [CUSTOM_NFT_ESCROW_SEED, u64Le(gameId)],
    programId,
  )[0];
}

/** Token Metadata `Metadata` PDA for a pNFT mint. seeds=["metadata", MPL_TOKEN_METADATA_ID, mint]. */
export function getTmMetadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('metadata'), MPL_TOKEN_METADATA_ID.toBytes(), mint.toBytes()],
    MPL_TOKEN_METADATA_ID,
  )[0];
}

/** Token Metadata `MasterEdition` PDA. seeds=["metadata", MPL_TOKEN_METADATA_ID, mint, "edition"]. */
export function getTmMasterEditionPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('metadata'),
      MPL_TOKEN_METADATA_ID.toBytes(),
      mint.toBytes(),
      new TextEncoder().encode('edition'),
    ],
    MPL_TOKEN_METADATA_ID,
  )[0];
}

/**
 * Token Metadata `TokenRecord` PDA (only used for pNFTs with auth rules).
 * seeds=["metadata", MPL_TOKEN_METADATA_ID, mint, "token_record", tokenAccount].
 */
export function getTmTokenRecordPda(mint: PublicKey, tokenAccount: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('metadata'),
      MPL_TOKEN_METADATA_ID.toBytes(),
      mint.toBytes(),
      new TextEncoder().encode('token_record'),
      tokenAccount.toBytes(),
    ],
    MPL_TOKEN_METADATA_ID,
  )[0];
}

/**
 * Associated Token Account derivation. owner can be a PDA (use allowOwnerOffCurve=true).
 * seeds=[owner, TOKEN_PROGRAM_ID, mint], program=ATA_PROGRAM_ID.
 *
 * The optional `tokenProgram` arg supports Token-2022 mints. Default is the
 * classic SPL Token program, preserving prior behavior for every existing
 * caller. Pass `TOKEN_2022_PROGRAM` for Token-2022 mints.
 */
export function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey = SPL_TOKEN_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBytes(), tokenProgram.toBytes(), mint.toBytes()],
    SPL_ATA_PROGRAM_ID,
  )[0];
}

// ─── Account Data Type + Deserializer ───

export type CustomGameNftData = {
  gameId: number;
  creator: string;
  nftAsset: string;             // Core: asset addr. pNFT: mint addr.
  nftStandard: 'core' | 'pnft'; // mapped from u8 enum (0=Core, 1=TokenMetadata)
  entryFeeLamports: number;
  platformCutBps: number;
  entryCount: number;
  totalPot: number;
  status: 'open' | 'finalized' | 'expired'; // mapped from u8 enum (0/1/2)
  settledAt: number;
  winner: string;
  winnerClaimed: boolean;
  creatorPaid: boolean;
  expiresAt: number;
  createdAt: number;
};

/** Layout (after 8-byte discriminator):
 *   game_id[u64] · creator[32] · nft_asset[32] · nft_standard[u8]
 *   entry_fee_lamports[u64] · platform_cut_bps[u16] · entry_count[u32]
 *   total_pot[u64] · status[u8] · settled_at[i64] · winner[32]
 *   winner_claimed[u8] · creator_paid[u8] · expires_at[i64] · created_at[i64]
 *   bump[u8]
 */
export function deserializeCustomGameNft(raw: Uint8Array): CustomGameNftData {
  const data = raw.slice(8);
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const standardByte = data[72];
  const statusByte = data[95];
  return {
    gameId:            Number(dv.getBigUint64(0, true)),
    creator:           new PublicKey(data.slice(8, 40)).toBase58(),
    nftAsset:          new PublicKey(data.slice(40, 72)).toBase58(),
    nftStandard:       standardByte === 1 ? 'pnft' : 'core',
    entryFeeLamports:  Number(dv.getBigUint64(73, true)),
    platformCutBps:    dv.getUint16(81, true),
    entryCount:        dv.getUint32(83, true),
    totalPot:          Number(dv.getBigUint64(87, true)),
    status:            statusByte === 1 ? 'finalized' : statusByte === 2 ? 'expired' : 'open',
    settledAt:         Number(dv.getBigInt64(96, true)),
    winner:            new PublicKey(data.slice(104, 136)).toBase58(),
    winnerClaimed:     data[136] === 1,
    creatorPaid:       data[137] === 1,
    expiresAt:         Number(dv.getBigInt64(138, true)),
    createdAt:         Number(dv.getBigInt64(146, true)),
  };
}

export async function fetchCustomGameNft(
  connection: Connection,
  gameId: number | bigint,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): Promise<CustomGameNftData | null> {
  const pda = getCustomGameNftPda(gameId, programId);
  const info = await connection.getAccountInfo(pda);
  if (!info) return null;
  return deserializeCustomGameNft(new Uint8Array(info.data));
}

// ═══════════════════════════════════════════════════════════════════════════
// Ix Builders — Core (mpl-core) variants
// ═══════════════════════════════════════════════════════════════════════════

/**
 * create_custom_game_nft — creator escrows their Core NFT as the prize.
 *
 * IMPORTANT: game_id is taken from `config.next_custom_game_id` ON-CHAIN. The
 * frontend must read GameConfig first to know what the next id will be, so it
 * can derive the correct game/escrow PDAs to pass.
 *
 * Args: entry_fee_lamports (u64), expires_at (i64), platform_cut_bps (u16).
 * Accounts (matches CreateCustomGameNft struct in custom_game_nft.rs:27):
 *   0. creator (sig, mut)
 *   1. config (PDA, mut)
 *   2. game (PDA, mut) — derived from next_custom_game_id
 *   3. escrow (PDA) — derived from next_custom_game_id
 *   4. nft_asset (mut) — the Core asset being escrowed
 *   5. mpl_core_program (= MPL_CORE_ID)
 *   6. system_program
 */
export function buildCreateCustomGameNftIx(args: {
  creator: PublicKey;
  nextGameId: number | bigint;  // read from config.next_custom_game_id
  coreNftAsset: PublicKey;
  entryFeeLamports: number | bigint;
  expiresAtUnix: number | bigint;
  platformCutBps: number;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  return makeIx(
    programId,
    NFT_GAME_DISC.createCustomGameNft,
    concat(
      u64Le(args.entryFeeLamports),
      i64Le(args.expiresAtUnix),
      u16Le(args.platformCutBps),
    ),
    [
      { pubkey: args.creator,                                         isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId),                              isSigner: false, isWritable: true  },
      { pubkey: getCustomGameNftPda(args.nextGameId, programId),      isSigner: false, isWritable: true  },
      { pubkey: getCustomNftEscrowPda(args.nextGameId, programId),    isSigner: false, isWritable: false },
      { pubkey: args.coreNftAsset,                                    isSigner: false, isWritable: true  },
      { pubkey: MPL_CORE_ID,                                          isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,                              isSigner: false, isWritable: false },
    ],
  );
}

/**
 * enter_custom_game_nft — player pays the SOL entry fee (if any) + platform fee.
 * Shared by both Core and pNFT variants (entry only touches SOL + game state).
 * Accounts (matches EnterCustomGameNft struct in custom_game_nft.rs:124):
 *   0. player (sig, mut)
 *   1. config (PDA, readonly)
 *   2. game (PDA, mut)
 *   3. escrow (PDA, mut) — collects the paid SOL pot
 *   4. revenue_wallet (mut) — config.revenue_wallet
 *   5. system_program
 */
export function buildEnterCustomGameNftIx(args: {
  player: PublicKey;
  gameId: number | bigint;
  revenueWallet: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  return makeIx(
    programId,
    NFT_GAME_DISC.enterCustomGameNft,
    u64Le(args.gameId),
    [
      { pubkey: args.player,                                       isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId),                           isSigner: false, isWritable: false },
      { pubkey: getCustomGameNftPda(args.gameId, programId),       isSigner: false, isWritable: true  },
      { pubkey: getCustomNftEscrowPda(args.gameId, programId),     isSigner: false, isWritable: true  },
      { pubkey: args.revenueWallet,                                isSigner: false, isWritable: true  },
      { pubkey: SystemProgram.programId,                           isSigner: false, isWritable: false },
    ],
  );
}

/**
 * finalize_custom_game_nft — operator picks the single winner + disburses SOL.
 * Accounts (matches FinalizeCustomGameNft struct in custom_game_nft.rs:206):
 *   0. authority (sig) — operator OR owner
 *   1. config (PDA, readonly)
 *   2. game (PDA, mut)
 *   3. escrow (PDA, mut)
 *   4. creator (mut) — receives SOL pot share
 *   5. revenue_wallet (mut)
 *   6. system_program
 */
export function buildFinalizeCustomGameNftIx(args: {
  authority: PublicKey;
  gameId: number | bigint;
  winner: PublicKey;
  creator: PublicKey;
  revenueWallet: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  return makeIx(
    programId,
    NFT_GAME_DISC.finalizeCustomGameNft,
    concat(u64Le(args.gameId), args.winner.toBytes()),
    [
      { pubkey: args.authority,                                   isSigner: true,  isWritable: false },
      { pubkey: getConfigPda(programId),                          isSigner: false, isWritable: false },
      { pubkey: getCustomGameNftPda(args.gameId, programId),      isSigner: false, isWritable: true  },
      { pubkey: getCustomNftEscrowPda(args.gameId, programId),    isSigner: false, isWritable: true  },
      { pubkey: args.creator,                                     isSigner: false, isWritable: true  },
      { pubkey: args.revenueWallet,                               isSigner: false, isWritable: true  },
      { pubkey: SystemProgram.programId,                          isSigner: false, isWritable: false },
    ],
  );
}

/**
 * claim_custom_nft_prize (Core) — winner claims the NFT.
 * Accounts (matches ClaimCustomNftPrize struct in custom_game_nft.rs:320):
 *   0. winner (sig, mut)
 *   1. game (PDA, mut)
 *   2. escrow (PDA, readonly)
 *   3. nft_asset (mut) — must == game.nft_asset
 *   4. mpl_core_program
 *   5. system_program
 */
export function buildClaimCustomNftPrizeIx(args: {
  winner: PublicKey;
  gameId: number | bigint;
  coreNftAsset: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  return makeIx(
    programId,
    NFT_GAME_DISC.claimCustomNftPrize,
    u64Le(args.gameId),
    [
      { pubkey: args.winner,                                      isSigner: true,  isWritable: true  },
      { pubkey: getCustomGameNftPda(args.gameId, programId),      isSigner: false, isWritable: true  },
      { pubkey: getCustomNftEscrowPda(args.gameId, programId),    isSigner: false, isWritable: false },
      { pubkey: args.coreNftAsset,                                isSigner: false, isWritable: true  },
      { pubkey: MPL_CORE_ID,                                      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,                          isSigner: false, isWritable: false },
    ],
  );
}

/**
 * reclaim_custom_nft (Core) — anyone can crank to return the NFT to the creator
 * if the game expired without finalize.
 * Accounts (matches ReclaimCustomNft struct in custom_game_nft.rs:386):
 *   0. cranker (sig)
 *   1. game (PDA, mut)
 *   2. escrow (PDA, mut)
 *   3. creator (mut)
 *   4. nft_asset (mut)
 *   5. mpl_core_program
 *   6. system_program
 */
export function buildReclaimCustomNftIx(args: {
  cranker: PublicKey;
  gameId: number | bigint;
  creator: PublicKey;
  coreNftAsset: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  return makeIx(
    programId,
    NFT_GAME_DISC.reclaimCustomNft,
    u64Le(args.gameId),
    [
      { pubkey: args.cranker,                                     isSigner: true,  isWritable: false },
      { pubkey: getCustomGameNftPda(args.gameId, programId),      isSigner: false, isWritable: true  },
      { pubkey: getCustomNftEscrowPda(args.gameId, programId),    isSigner: false, isWritable: true  },
      { pubkey: args.creator,                                     isSigner: false, isWritable: true  },
      { pubkey: args.coreNftAsset,                                isSigner: false, isWritable: true  },
      { pubkey: MPL_CORE_ID,                                      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,                          isSigner: false, isWritable: false },
    ],
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Ix Builders — pNFT (Token Metadata) variants
// pNFT TransferV1 needs ATAs, metadata PDA, master edition PDA, token records.
// See custom_game_tm_pnft.rs:39 / 180 / 289 for the source structs.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * create_custom_game_tm_pnft — creator escrows their pNFT as the prize.
 *
 * Account order MUST match CreateCustomGameTmPnft (18 accounts incl. Options).
 * For Option<AccountInfo> slots that are None: pass the program id placeholder
 * (Anchor's convention).
 */
export function buildCreateCustomGameTmPnftIx(args: {
  creator: PublicKey;
  nextGameId: number | bigint;
  nftMint: PublicKey;
  creatorTokenRecord?: PublicKey | null; // Optional, required for pNFTs with auth rules
  escrowTokenRecord?: PublicKey | null;  // Optional
  authRulesProgram?: PublicKey | null;
  authRules?: PublicKey | null;
  entryFeeLamports: number | bigint;
  expiresAtUnix: number | bigint;
  platformCutBps: number;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const escrowPda = getCustomNftEscrowPda(args.nextGameId, programId);
  const creatorAta = getAssociatedTokenAddress(args.nftMint, args.creator);
  const escrowAta = getAssociatedTokenAddress(args.nftMint, escrowPda);
  const metadata = getTmMetadataPda(args.nftMint);
  const masterEdition = getTmMasterEditionPda(args.nftMint);
  const ctr = args.creatorTokenRecord ?? programId;
  const etr = args.escrowTokenRecord ?? programId;
  const arp = args.authRulesProgram ?? programId;
  const ar = args.authRules ?? programId;

  return makeIx(
    programId,
    NFT_GAME_DISC.createCustomGameTmPnft,
    concat(
      u64Le(args.entryFeeLamports),
      i64Le(args.expiresAtUnix),
      u16Le(args.platformCutBps),
    ),
    [
      { pubkey: args.creator,                                       isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId),                            isSigner: false, isWritable: true  },
      { pubkey: getCustomGameNftPda(args.nextGameId, programId),    isSigner: false, isWritable: true  },
      { pubkey: escrowPda,                                          isSigner: false, isWritable: false },
      { pubkey: args.nftMint,                                       isSigner: false, isWritable: false },
      { pubkey: creatorAta,                                         isSigner: false, isWritable: true  },
      { pubkey: escrowAta,                                          isSigner: false, isWritable: true  },
      { pubkey: metadata,                                           isSigner: false, isWritable: true  },
      { pubkey: masterEdition,                                      isSigner: false, isWritable: false },
      { pubkey: ctr,                                                isSigner: false, isWritable: true  },
      { pubkey: etr,                                                isSigner: false, isWritable: true  },
      { pubkey: arp,                                                isSigner: false, isWritable: false },
      { pubkey: ar,                                                 isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_ID,                             isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM_ID,                               isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,                                 isSigner: false, isWritable: false },
      { pubkey: MPL_TOKEN_METADATA_ID,                              isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,                            isSigner: false, isWritable: false },
    ],
  );
}

/**
 * claim_custom_tm_pnft_prize — winner claims the escrowed pNFT.
 * Accounts (matches ClaimCustomTmPnftPrize struct in custom_game_tm_pnft.rs:180):
 *   0. winner (sig, mut)
 *   1. game (PDA, mut)
 *   2. escrow (PDA, mut)
 *   3. nft_mint
 *   4. escrow_token (mut)
 *   5. winner_token (mut)
 *   6. nft_metadata (mut)
 *   7. nft_master_edition
 *   8. escrow_token_record (Option, mut)
 *   9. winner_token_record (Option, mut)
 *  10. auth_rules_program (Option)
 *  11. auth_rules (Option)
 *  12. sysvar_instructions
 *  13. spl_token_program
 *  14. spl_ata_program
 *  15. token_metadata_program
 *  16. system_program
 */
export function buildClaimCustomTmPnftPrizeIx(args: {
  winner: PublicKey;
  gameId: number | bigint;
  nftMint: PublicKey;
  escrowTokenRecord?: PublicKey | null;
  winnerTokenRecord?: PublicKey | null;
  authRulesProgram?: PublicKey | null;
  authRules?: PublicKey | null;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const escrowPda = getCustomNftEscrowPda(args.gameId, programId);
  const escrowAta = getAssociatedTokenAddress(args.nftMint, escrowPda);
  const winnerAta = getAssociatedTokenAddress(args.nftMint, args.winner);
  const metadata = getTmMetadataPda(args.nftMint);
  const masterEdition = getTmMasterEditionPda(args.nftMint);
  const etr = args.escrowTokenRecord ?? programId;
  const wtr = args.winnerTokenRecord ?? programId;
  const arp = args.authRulesProgram ?? programId;
  const ar = args.authRules ?? programId;

  return makeIx(
    programId,
    NFT_GAME_DISC.claimCustomTmPnftPrize,
    u64Le(args.gameId),
    [
      { pubkey: args.winner,                                       isSigner: true,  isWritable: true  },
      { pubkey: getCustomGameNftPda(args.gameId, programId),       isSigner: false, isWritable: true  },
      { pubkey: escrowPda,                                         isSigner: false, isWritable: true  },
      { pubkey: args.nftMint,                                      isSigner: false, isWritable: false },
      { pubkey: escrowAta,                                         isSigner: false, isWritable: true  },
      { pubkey: winnerAta,                                         isSigner: false, isWritable: true  },
      { pubkey: metadata,                                          isSigner: false, isWritable: true  },
      { pubkey: masterEdition,                                     isSigner: false, isWritable: false },
      { pubkey: etr,                                               isSigner: false, isWritable: true  },
      { pubkey: wtr,                                               isSigner: false, isWritable: true  },
      { pubkey: arp,                                               isSigner: false, isWritable: false },
      { pubkey: ar,                                                isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_ID,                            isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM_ID,                              isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,                                isSigner: false, isWritable: false },
      { pubkey: MPL_TOKEN_METADATA_ID,                             isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,                           isSigner: false, isWritable: false },
    ],
  );
}

/**
 * reclaim_custom_tm_pnft — cranker returns the pNFT to creator after expiry.
 * Same 18-account shape as create, just different role mapping.
 */
export function buildReclaimCustomTmPnftIx(args: {
  cranker: PublicKey;
  gameId: number | bigint;
  creator: PublicKey;
  nftMint: PublicKey;
  escrowTokenRecord?: PublicKey | null;
  creatorTokenRecord?: PublicKey | null;
  authRulesProgram?: PublicKey | null;
  authRules?: PublicKey | null;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const escrowPda = getCustomNftEscrowPda(args.gameId, programId);
  const escrowAta = getAssociatedTokenAddress(args.nftMint, escrowPda);
  const creatorAta = getAssociatedTokenAddress(args.nftMint, args.creator);
  const metadata = getTmMetadataPda(args.nftMint);
  const masterEdition = getTmMasterEditionPda(args.nftMint);
  const etr = args.escrowTokenRecord ?? programId;
  const ctr = args.creatorTokenRecord ?? programId;
  const arp = args.authRulesProgram ?? programId;
  const ar = args.authRules ?? programId;

  return makeIx(
    programId,
    NFT_GAME_DISC.reclaimCustomTmPnft,
    u64Le(args.gameId),
    [
      { pubkey: args.cranker,                                      isSigner: true,  isWritable: false },
      { pubkey: getCustomGameNftPda(args.gameId, programId),       isSigner: false, isWritable: true  },
      { pubkey: escrowPda,                                         isSigner: false, isWritable: true  },
      { pubkey: args.creator,                                      isSigner: false, isWritable: true  },
      { pubkey: args.nftMint,                                      isSigner: false, isWritable: false },
      { pubkey: escrowAta,                                         isSigner: false, isWritable: true  },
      { pubkey: creatorAta,                                        isSigner: false, isWritable: true  },
      { pubkey: metadata,                                          isSigner: false, isWritable: true  },
      { pubkey: masterEdition,                                     isSigner: false, isWritable: false },
      { pubkey: etr,                                               isSigner: false, isWritable: true  },
      { pubkey: ctr,                                               isSigner: false, isWritable: true  },
      { pubkey: arp,                                               isSigner: false, isWritable: false },
      { pubkey: ar,                                                isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_ID,                            isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM_ID,                              isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,                                isSigner: false, isWritable: false },
      { pubkey: MPL_TOKEN_METADATA_ID,                             isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,                           isSigner: false, isWritable: false },
    ],
  );
}

// ─── Backward-Compatible Exports (V1 callers in App.tsx / ProfileView.tsx) ──
// These wrap V2 tier-0 equivalents. PAID_TRIVIA_ENABLED=false so they won't run in prod.

export function buildEnterRoundInstruction(
  roundIdU64: number,
  player: PublicKey,
  revenueWallet: PublicKey,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return buildEnterTierRoundIx(player, roundIdU64, 0, revenueWallet, programId);
}

export function buildClaimPrizeInstruction(
  roundIdU64: number,
  claimer: PublicKey,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): TransactionInstruction {
  return buildClaimTierPrizeIx(claimer, roundIdU64, 0, programId);
}

export interface RoundAccountData {
  roundId: number;
  totalPot: number;
  finalized: boolean;
  prizeAmounts: number[];
  winners: string[];
  claimed: boolean[];
}

export function getRoundAndVaultPdas(
  roundIdU64: number,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): { roundPda: PublicKey; vaultPda: PublicKey } {
  return {
    roundPda: getTierRoundPda(roundIdU64, 0, programId),
    vaultPda: getTierVaultPda(roundIdU64, 0, programId),
  };
}

export async function fetchRoundAccountData(
  connection: Connection,
  roundIdU64: number,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): Promise<RoundAccountData | null> {
  const data = await fetchTierRound(connection, roundIdU64, 0, programId);
  if (!data) return null;
  return {
    roundId: data.roundId,
    totalPot: data.totalPot,
    finalized: data.finalized,
    prizeAmounts: data.prizeAmounts,
    winners: data.winners,
    claimed: data.claimed,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SPL DUEL INSTRUCTION BUILDERS (token-bet duels)
// ═══════════════════════════════════════════════════════════════════
// Mirrors `programs/soltrivia_v2/src/instructions/duel_spl.rs`.
//
// Design notes:
//   - Both players bet the SAME token at the SAME raw amount. No oracle, no
//     conversion. (e.g. 100 JUP vs 100 JUP, 1 USDC vs 1 USDC.)
//   - SPL entry fee uses `token_interface::transfer_checked` on-chain, which
//     supports BOTH the classic SPL Token program AND Token-2022. Pass the
//     correct `tokenProgram` per-mint.
//   - SOL platform fee is collected on top, separately, in lamports.
//   - DUEL_WAITING_EXPIRY = 24h (matches DUEL_LOCKED_EXPIRY semantics).
// ═══════════════════════════════════════════════════════════════════

const DUEL_SPL_SEED       = new TextEncoder().encode('duel_spl');
const DUEL_SPL_VAULT_SEED = new TextEncoder().encode('duel_spl_vault');

/** Anchor discriminators for SPL duel ixs.
 *  Derived from sha256("global:<fn_name>").slice(0, 8). */
export const DUEL_SPL_DISC = {
  createDuelSpl:        new Uint8Array([23, 1, 77, 84, 229, 187, 71, 141]),
  joinDuelSpl:          new Uint8Array([115, 68, 46, 234, 37, 99, 109, 175]),
  resolveDuelSpl:       new Uint8Array([191, 132, 188, 24, 43, 47, 101, 149]),
  claimDuelPrizeSpl:    new Uint8Array([255, 202, 174, 184, 106, 125, 16, 191]),
  cancelDuelSpl:        new Uint8Array([41, 166, 39, 254, 109, 218, 255, 44]),
  expireDuelSpl:        new Uint8Array([185, 19, 56, 57, 20, 216, 203, 79]),
  forfeitLockedDuelSpl: new Uint8Array([160, 249, 8, 178, 241, 156, 43, 233]),
  closeDuelSpl:         new Uint8Array([40, 78, 209, 109, 33, 169, 166, 203]),
} as const;

/** PDA: `duel_spl` state account, derived from u64 LE-encoded duel_id. */
export function getDuelSplPda(duelId: number | bigint, programId: PublicKey = SOLTRIVIA_PROGRAM_ID): PublicKey {
  const n = typeof duelId === 'bigint' ? duelId : BigInt(duelId);
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, n, true);
  return PublicKey.findProgramAddressSync([DUEL_SPL_SEED, buf], programId)[0];
}

/** PDA: SPL duel vault that owns the duel's token ATA. */
export function getDuelSplVaultPda(duelId: number | bigint, programId: PublicKey = SOLTRIVIA_PROGRAM_ID): PublicKey {
  const n = typeof duelId === 'bigint' ? duelId : BigInt(duelId);
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, n, true);
  return PublicKey.findProgramAddressSync([DUEL_SPL_VAULT_SEED, buf], programId)[0];
}

/**
 * create_duel_spl — Player 1 deposits SPL entry fee + SOL platform fee.
 * Caller must read `config.next_duel_id` first and pass it as nextDuelId so
 * PDAs match what the program will derive.
 *
 * Args: entry_fee_amount (u64), is_public (bool).
 * Accounts (matches CreateDuelSpl struct in duel_spl.rs:13):
 *   0. player1 (sig, mut)
 *   1. config (PDA, mut)
 *   2. duel (PDA, mut) — derived from next_duel_id
 *   3. vault (PDA, mut) — derived from next_duel_id, holds token ATA
 *   4. mint (readonly) — the SPL token mint
 *   5. vault_token_account (mut) — ATA(vault, mint, tokenProgram)
 *   6. player1_token_account (mut) — ATA(player1, mint, tokenProgram)
 *   7. revenue_wallet (mut) — config.revenue_wallet
 *   8. token_program — SPL Token OR Token-2022
 *   9. associated_token_program
 *  10. system_program
 */
export function buildCreateDuelSplIx(args: {
  player1: PublicKey;
  nextDuelId: number | bigint;
  mint: PublicKey;
  entryFeeAmount: number | bigint;
  isPublic: boolean;
  revenueWallet: PublicKey;
  tokenProgram?: PublicKey; // defaults to SPL_TOKEN_PROGRAM_ID
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const duelPda = getDuelSplPda(args.nextDuelId, programId);
  const vaultPda = getDuelSplVaultPda(args.nextDuelId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const player1Ata = getAssociatedTokenAddress(args.mint, args.player1, tokenProgram);
  return makeIx(
    programId,
    DUEL_SPL_DISC.createDuelSpl,
    concat(u64Le(args.entryFeeAmount), new Uint8Array([args.isPublic ? 1 : 0])),
    [
      { pubkey: args.player1,            isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: true  },
      { pubkey: duelPda,                 isSigner: false, isWritable: true  },
      { pubkey: vaultPda,                isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: player1Ata,              isSigner: false, isWritable: true  },
      { pubkey: args.revenueWallet,      isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * join_duel_spl — Player 2 deposits matching SPL entry fee + SOL platform fee.
 *
 * Args: duel_id (u64).
 * Accounts (matches JoinDuelSpl struct in duel_spl.rs:167):
 *   0. player2 (sig, mut)
 *   1. config (PDA, readonly)
 *   2. duel (PDA, mut)
 *   3. mint (readonly)
 *   4. player2_token_account (mut) — ATA(player2, mint, tokenProgram)
 *   5. vault (PDA, readonly)
 *   6. vault_token_account (mut) — ATA(vault, mint, tokenProgram)
 *   7. revenue_wallet (mut)
 *   8. token_program
 *   9. system_program
 */
export function buildJoinDuelSplIx(args: {
  player2: PublicKey;
  duelId: number | bigint;
  mint: PublicKey;
  revenueWallet: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const duelPda = getDuelSplPda(args.duelId, programId);
  const vaultPda = getDuelSplVaultPda(args.duelId, programId);
  const player2Ata = getAssociatedTokenAddress(args.mint, args.player2, tokenProgram);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  return makeIx(
    programId,
    DUEL_SPL_DISC.joinDuelSpl,
    u64Le(args.duelId),
    [
      { pubkey: args.player2,            isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: duelPda,                 isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: player2Ata,              isSigner: false, isWritable: true  },
      { pubkey: vaultPda,                isSigner: false, isWritable: false },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: args.revenueWallet,      isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * resolve_duel_spl — Operator/owner posts winner + sends SPL house cut.
 *
 * Args: duel_id (u64), winner (Pubkey).
 * Accounts (matches ResolveDuelSpl struct in duel_spl.rs:280):
 *   0. authority (sig, mut) — operator OR owner
 *   1. config (PDA, readonly)
 *   2. duel (PDA, mut)
 *   3. mint (readonly)
 *   4. vault (PDA, mut)
 *   5. vault_token_account (mut)
 *   6. revenue_wallet (mut)
 *   7. revenue_token_account (mut) — ATA(revenue_wallet, mint), init_if_needed
 *   8. token_program
 *   9. associated_token_program
 *  10. system_program
 */
export function buildResolveDuelSplIx(args: {
  authority: PublicKey;
  duelId: number | bigint;
  winner: PublicKey;
  mint: PublicKey;
  revenueWallet: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const duelPda = getDuelSplPda(args.duelId, programId);
  const vaultPda = getDuelSplVaultPda(args.duelId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const revenueAta = getAssociatedTokenAddress(args.mint, args.revenueWallet, tokenProgram);
  return makeIx(
    programId,
    DUEL_SPL_DISC.resolveDuelSpl,
    concat(u64Le(args.duelId), args.winner.toBytes()),
    [
      { pubkey: args.authority,          isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: duelPda,                 isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultPda,                isSigner: false, isWritable: true  },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: args.revenueWallet,      isSigner: false, isWritable: true  },
      { pubkey: revenueAta,              isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * claim_duel_prize_spl — Winner claims the SPL pot (less house cut already taken).
 *
 * Args: duel_id (u64).
 * Accounts (matches ClaimDuelPrizeSpl struct in duel_spl.rs:400):
 *   0. winner (sig, mut)
 *   1. duel (PDA, mut)
 *   2. mint (readonly)
 *   3. vault (PDA, mut)
 *   4. vault_token_account (mut)
 *   5. winner_token_account (mut) — ATA(winner, mint), init_if_needed
 *   6. token_program
 *   7. associated_token_program
 *   8. system_program
 */
export function buildClaimDuelPrizeSplIx(args: {
  winner: PublicKey;
  duelId: number | bigint;
  mint: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const duelPda = getDuelSplPda(args.duelId, programId);
  const vaultPda = getDuelSplVaultPda(args.duelId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const winnerAta = getAssociatedTokenAddress(args.mint, args.winner, tokenProgram);
  return makeIx(
    programId,
    DUEL_SPL_DISC.claimDuelPrizeSpl,
    u64Le(args.duelId),
    [
      { pubkey: args.winner,             isSigner: true,  isWritable: true  },
      { pubkey: duelPda,                 isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultPda,                isSigner: false, isWritable: true  },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: winnerAta,               isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * cancel_duel_spl — Player 1 cancels (waiting only), SPL entry refunded.
 *
 * Args: duel_id (u64).
 * Accounts (matches CancelDuelSpl struct in duel_spl.rs:486):
 *   0. player1 (sig, mut)
 *   1. duel (PDA, mut)
 *   2. mint (readonly)
 *   3. vault (PDA, mut)
 *   4. vault_token_account (mut)
 *   5. player1_token_account (mut)
 *   6. token_program
 */
export function buildCancelDuelSplIx(args: {
  player1: PublicKey;
  duelId: number | bigint;
  mint: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const duelPda = getDuelSplPda(args.duelId, programId);
  const vaultPda = getDuelSplVaultPda(args.duelId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const player1Ata = getAssociatedTokenAddress(args.mint, args.player1, tokenProgram);
  return makeIx(
    programId,
    DUEL_SPL_DISC.cancelDuelSpl,
    u64Le(args.duelId),
    [
      { pubkey: args.player1,   isSigner: true,  isWritable: true  },
      { pubkey: duelPda,        isSigner: false, isWritable: true  },
      { pubkey: args.mint,      isSigner: false, isWritable: false },
      { pubkey: vaultPda,       isSigner: false, isWritable: true  },
      { pubkey: vaultAta,       isSigner: false, isWritable: true  },
      { pubkey: player1Ata,     isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,   isSigner: false, isWritable: false },
    ],
  );
}

/**
 * expire_duel_spl — Permissionless: if waiting + past expiry, refund SPL to P1.
 *
 * Args: duel_id (u64).
 * Accounts (matches ExpireDuelSpl struct in duel_spl.rs:565):
 *   0. cranker (sig)
 *   1. duel (PDA, mut)
 *   2. mint (readonly)
 *   3. vault (PDA, mut)
 *   4. vault_token_account (mut)
 *   5. player1 (mut)
 *   6. player1_token_account (mut)
 *   7. token_program
 */
export function buildExpireDuelSplIx(args: {
  cranker: PublicKey;
  duelId: number | bigint;
  player1: PublicKey;
  mint: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const duelPda = getDuelSplPda(args.duelId, programId);
  const vaultPda = getDuelSplVaultPda(args.duelId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const player1Ata = getAssociatedTokenAddress(args.mint, args.player1, tokenProgram);
  return makeIx(
    programId,
    DUEL_SPL_DISC.expireDuelSpl,
    u64Le(args.duelId),
    [
      { pubkey: args.cranker,   isSigner: true,  isWritable: false },
      { pubkey: duelPda,        isSigner: false, isWritable: true  },
      { pubkey: args.mint,      isSigner: false, isWritable: false },
      { pubkey: vaultPda,       isSigner: false, isWritable: true  },
      { pubkey: vaultAta,       isSigner: false, isWritable: true  },
      { pubkey: args.player1,   isSigner: false, isWritable: true  },
      { pubkey: player1Ata,     isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,   isSigner: false, isWritable: false },
    ],
  );
}

/**
 * forfeit_locked_duel_spl — Permissionless: a Locked SPL duel past its 24h
 * expiry with no resolution refunds (token) to BOTH players.
 *
 * Args: duel_id (u64).
 * Accounts (matches ForfeitLockedDuelSpl struct in duel_spl.rs:655):
 *   0. cranker (sig)
 *   1. duel (PDA, mut)
 *   2. mint (readonly)
 *   3. vault (PDA, mut)
 *   4. vault_token_account (mut)
 *   5. player1 (readonly)
 *   6. player1_token_account (mut)
 *   7. player2 (readonly)
 *   8. player2_token_account (mut)
 *   9. token_program
 */
export function buildForfeitLockedDuelSplIx(args: {
  cranker: PublicKey;
  duelId: number | bigint;
  player1: PublicKey;
  player2: PublicKey;
  mint: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const duelPda = getDuelSplPda(args.duelId, programId);
  const vaultPda = getDuelSplVaultPda(args.duelId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const player1Ata = getAssociatedTokenAddress(args.mint, args.player1, tokenProgram);
  const player2Ata = getAssociatedTokenAddress(args.mint, args.player2, tokenProgram);
  return makeIx(
    programId,
    DUEL_SPL_DISC.forfeitLockedDuelSpl,
    u64Le(args.duelId),
    [
      { pubkey: args.cranker,  isSigner: true,  isWritable: false },
      { pubkey: duelPda,       isSigner: false, isWritable: true  },
      { pubkey: args.mint,     isSigner: false, isWritable: false },
      { pubkey: vaultPda,      isSigner: false, isWritable: true  },
      { pubkey: vaultAta,      isSigner: false, isWritable: true  },
      { pubkey: args.player1,  isSigner: false, isWritable: false },
      { pubkey: player1Ata,    isSigner: false, isWritable: true  },
      { pubkey: args.player2,  isSigner: false, isWritable: false },
      { pubkey: player2Ata,    isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,  isSigner: false, isWritable: false },
    ],
  );
}

/**
 * close_duel_spl — Operator/owner reclaims rent after a settled duel. Closes
 * the vault token ATA and the DuelSpl state account, drains the vault PDA's
 * remaining SOL rent to the authority.
 *
 * Args: duel_id (u64).
 * Accounts (matches CloseDuelSpl struct in duel_spl.rs:765):
 *   0. authority (sig, mut) — operator OR owner
 *   1. config (PDA, readonly)
 *   2. duel (PDA, mut) — closed to authority
 *   3. mint (readonly)
 *   4. vault (PDA, mut)
 *   5. vault_token_account (mut)
 *   6. token_program
 *   7. system_program
 */
export function buildCloseDuelSplIx(args: {
  authority: PublicKey;
  duelId: number | bigint;
  mint: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const duelPda = getDuelSplPda(args.duelId, programId);
  const vaultPda = getDuelSplVaultPda(args.duelId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  return makeIx(
    programId,
    DUEL_SPL_DISC.closeDuelSpl,
    u64Le(args.duelId),
    [
      { pubkey: args.authority,          isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: duelPda,                 isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultPda,                isSigner: false, isWritable: true  },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

// ═══════════════════════════════════════════════════════════════════
// REFERRAL CLAIM (v2.1 upgrade)
// ═══════════════════════════════════════════════════════════════════
// The ReferralBalance PDA is a system-owned account (no struct, no data).
// Its lamports ARE the referrer's accumulated SOL commission. The credit
// side is the buyer's purchase tx itself (SOL transfer to PDA); the program
// only owns the CLAIM side, which drains the PDA back to the referrer.
//
// Discriminator: `NFT_DISC.claimReferralBalance` (above).
// PDA helper:    `getReferralBalancePda(referrer)` (above).
// ═══════════════════════════════════════════════════════════════════

/**
 * claim_referral_balance — referrer drains their accumulated commission PDA.
 *
 * No ix args. Three accounts (matches ClaimReferralBalance struct in
 * referral.rs:22):
 *   0. referrer (sig, mut)
 *   1. referral_balance (PDA, mut) — seeds=[REFERRAL_BALANCE_SEED, referrer]
 *   2. system_program
 */
export function buildClaimReferralBalanceIx(args: {
  referrer: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  return makeIx(
    programId,
    NFT_DISC.claimReferralBalance,
    new Uint8Array(0),
    [
      { pubkey: args.referrer,                          isSigner: true,  isWritable: true  },
      { pubkey: getReferralBalancePda(args.referrer, programId), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId,                isSigner: false, isWritable: false },
    ],
  );
}

/**
 * Read the referrer's accumulated commission balance (in lamports).
 *
 * The PDA is a plain system account whose lamports == balance. Returns 0 if
 * the PDA has never been credited (account doesn't exist) OR is empty.
 *
 * Safe to call on either cluster; on current mainnet (pre-V2.1 upgrade) this
 * returns 0 because the PDA isn't credited by any active ix yet.
 */
export async function fetchReferralBalance(
  connection: Connection,
  referrer: PublicKey,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): Promise<number> {
  const pda = getReferralBalancePda(referrer, programId);
  const info = await connection.getAccountInfo(pda);
  if (!info) return 0;
  // The on-chain account stores no data; rent-exempt minimum lamports are
  // subtracted so the displayed claimable balance is what the user actually
  // sweeps. The contract's NothingToSweep check uses `lamports() > 0` so we
  // mirror that: if account exists, full lamports is the balance.
  return info.lamports;
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOM GAMES (SPL Token) — v2.1 upgrade
// ═══════════════════════════════════════════════════════════════════
// Symmetric SPL-token variants of the SOL custom-game flow. Used for any
// non-SOL game (USDC, NERD, BONK, any SPL-2022 token, etc.).
//
// Notes:
//   - PDAs use distinct seeds (`custom_spl` / `custom_spl_vault`) but share
//     the `next_custom_game_id` counter in GameConfig, so game IDs are
//     globally unique across SOL and SPL custom games.
//   - The SPL vault PDA holds the token ATA. SOL platform fees still flow
//     to the SOL revenue wallet (separately, in lamports).
//   - Entry PDA reuses the standard `custom_entry` seed (same as SOL).
//   - Token program is parameterised: Token-2022 mints pass the 2022 program.
// ═══════════════════════════════════════════════════════════════════

const CUSTOM_SPL_SEED       = new TextEncoder().encode('custom_spl');
const CUSTOM_SPL_VAULT_SEED = new TextEncoder().encode('custom_spl_vault');

/** Anchor discriminators for SPL custom-game ixs.
 *  Derived from sha256("global:<fn_name>").slice(0, 8). */
export const CUSTOM_SPL_DISC = {
  createCustomGameSpl:  new Uint8Array([91, 132, 17, 96, 82, 23, 26, 131]),
  fundCustomGameSpl:    new Uint8Array([113, 207, 61, 31, 175, 15, 52, 32]),
  enterCustomGameSpl:   new Uint8Array([181, 94, 118, 248, 137, 224, 0, 238]),
  finalizeCustomGameSpl:new Uint8Array([100, 225, 158, 72, 219, 182, 43, 27]),
  claimCustomPrizeSpl:  new Uint8Array([20, 90, 26, 7, 254, 59, 11, 15]),
  claimCustomRefundSpl: new Uint8Array([65, 244, 189, 65, 3, 6, 95, 122]),
  sweepCustomGameSpl:   new Uint8Array([46, 113, 118, 205, 232, 233, 23, 218]),
} as const;

/** PDA: `custom_spl` state account, derived from u64 LE-encoded game_id. */
export function getCustomSplPda(gameId: number | bigint, programId: PublicKey = SOLTRIVIA_PROGRAM_ID): PublicKey {
  const n = typeof gameId === 'bigint' ? gameId : BigInt(gameId);
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, n, true);
  return PublicKey.findProgramAddressSync([CUSTOM_SPL_SEED, buf], programId)[0];
}

/** PDA: SPL custom-game vault that owns the token ATA. */
export function getCustomSplVaultPda(gameId: number | bigint, programId: PublicKey = SOLTRIVIA_PROGRAM_ID): PublicKey {
  const n = typeof gameId === 'bigint' ? gameId : BigInt(gameId);
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, n, true);
  return PublicKey.findProgramAddressSync([CUSTOM_SPL_VAULT_SEED, buf], programId)[0];
}

/**
 * create_custom_game_spl — Operator creates on-chain SPL game; opens the
 * token vault ATA in the same tx.
 *
 * Args: creator (Pubkey, 32), entry_fee_amount (u64), prize_model (u8 — 0=player-funded, 1=creator-funded), max_winners (u8), prize_split_bps ([u16; 5]), expires_at (i64).
 * Accounts (matches CreateCustomGameSpl struct in custom_game_spl.rs:14):
 *   0. authority (sig, mut)
 *   1. config (PDA, mut)
 *   2. custom_game (PDA, mut) — seeds=[custom_spl, next_game_id]
 *   3. vault (PDA, mut) — seeds=[custom_spl_vault, next_game_id]
 *   4. mint (readonly)
 *   5. vault_token_account (mut) — ATA(vault, mint, tokenProgram), init
 *   6. token_program
 *   7. associated_token_program
 *   8. system_program
 */
export function buildCreateCustomGameSplIx(args: {
  authority: PublicKey;
  nextGameId: number | bigint;
  creator: PublicKey;
  mint: PublicKey;
  entryFeeAmount: number | bigint;
  prizeModel: number;
  maxWinners: number;
  prizeSplitBps: number[];
  expiresAt: number | bigint;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const customGamePda = getCustomSplPda(args.nextGameId, programId);
  const vaultPda = getCustomSplVaultPda(args.nextGameId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const paddedSplits = [...args.prizeSplitBps];
  while (paddedSplits.length < 5) paddedSplits.push(0);
  const splitsBytes = concat(...paddedSplits.map(s => u16Le(s)));
  return makeIx(
    programId,
    CUSTOM_SPL_DISC.createCustomGameSpl,
    concat(
      args.creator.toBytes(),
      u64Le(args.entryFeeAmount),
      new Uint8Array([args.prizeModel]),
      new Uint8Array([args.maxWinners]),
      splitsBytes,
      i64Le(args.expiresAt),
    ),
    [
      { pubkey: args.authority,          isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: true  },
      { pubkey: customGamePda,           isSigner: false, isWritable: true  },
      { pubkey: vaultPda,                isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * fund_custom_game_spl — Creator deposits SPL tokens into the vault
 * (CreatorFunded model only).
 *
 * Args: game_id (u64), amount (u64).
 * Accounts (matches FundCustomGameSpl struct in custom_game_spl.rs:167):
 *   0. creator (sig, mut)
 *   1. custom_game (PDA, mut)
 *   2. mint (readonly)
 *   3. creator_token_account (mut) — ATA(creator, mint, tokenProgram)
 *   4. vault (PDA, readonly)
 *   5. vault_token_account (mut)
 *   6. token_program
 */
export function buildFundCustomGameSplIx(args: {
  creator: PublicKey;
  gameId: number | bigint;
  mint: PublicKey;
  amount: number | bigint;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const customGamePda = getCustomSplPda(args.gameId, programId);
  const vaultPda = getCustomSplVaultPda(args.gameId, programId);
  const creatorAta = getAssociatedTokenAddress(args.mint, args.creator, tokenProgram);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  return makeIx(
    programId,
    CUSTOM_SPL_DISC.fundCustomGameSpl,
    concat(u64Le(args.gameId), u64Le(args.amount)),
    [
      { pubkey: args.creator,   isSigner: true,  isWritable: true  },
      { pubkey: customGamePda,  isSigner: false, isWritable: true  },
      { pubkey: args.mint,      isSigner: false, isWritable: false },
      { pubkey: creatorAta,     isSigner: false, isWritable: true  },
      { pubkey: vaultPda,       isSigner: false, isWritable: false },
      { pubkey: vaultAta,       isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,   isSigner: false, isWritable: false },
    ],
  );
}

/**
 * enter_custom_game_spl — Player pays SPL entry fee (PlayerFunded) and
 * always pays SOL platform fee to the revenue wallet.
 *
 * Args: game_id (u64).
 * Accounts (matches EnterCustomGameSpl struct in custom_game_spl.rs:249):
 *   0. player (sig, mut)
 *   1. config (PDA, readonly)
 *   2. custom_game (PDA, mut)
 *   3. mint (readonly)
 *   4. player_token_account (mut)
 *   5. vault (PDA, readonly)
 *   6. vault_token_account (mut)
 *   7. revenue_wallet (mut)
 *   8. entry (PDA, mut) — init_if_needed
 *   9. token_program
 *  10. system_program
 */
export function buildEnterCustomGameSplIx(args: {
  player: PublicKey;
  gameId: number | bigint;
  mint: PublicKey;
  revenueWallet: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const customGamePda = getCustomSplPda(args.gameId, programId);
  const vaultPda = getCustomSplVaultPda(args.gameId, programId);
  const playerAta = getAssociatedTokenAddress(args.mint, args.player, tokenProgram);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const gameIdNum = typeof args.gameId === 'bigint' ? Number(args.gameId) : args.gameId;
  const entryPda = getCustomEntryPda(gameIdNum, args.player, programId);
  return makeIx(
    programId,
    CUSTOM_SPL_DISC.enterCustomGameSpl,
    u64Le(args.gameId),
    [
      { pubkey: args.player,             isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: customGamePda,           isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: playerAta,               isSigner: false, isWritable: true  },
      { pubkey: vaultPda,                isSigner: false, isWritable: false },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: args.revenueWallet,      isSigner: false, isWritable: true  },
      { pubkey: entryPda,                isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * finalize_custom_game_spl — Operator posts winners; SPL platform cut goes
 * to the revenue wallet ATA. For PlayerFunded, the platform cut is taken
 * from the pot; for CreatorFunded the creator gets full deposit refunded
 * if too few entries (handler logic).
 *
 * Args: game_id (u64), winners ([Pubkey; 5]).
 * Accounts (matches FinalizeCustomGameSpl struct in custom_game_spl.rs:397):
 *   0. authority (sig, mut)
 *   1. config (PDA, readonly)
 *   2. custom_game (PDA, mut)
 *   3. mint (readonly)
 *   4. vault (PDA, readonly) — signs SPL transfer via CPI seeds
 *   5. vault_token_account (mut)
 *   6. revenue_wallet (mut)
 *   7. revenue_token_account (mut) — ATA(revenue_wallet, mint), pre-created by EF
 *   8. creator_wallet (mut)
 *   9. creator_token_account (mut) — ATA(creator_wallet, mint), pre-created by EF
 *  10. token_program
 *  11. system_program
 */
export function buildFinalizeCustomGameSplIx(args: {
  authority: PublicKey;
  gameId: number | bigint;
  mint: PublicKey;
  winners: PublicKey[];
  creatorWallet: PublicKey;
  revenueWallet: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const customGamePda = getCustomSplPda(args.gameId, programId);
  const vaultPda = getCustomSplVaultPda(args.gameId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const revenueAta = getAssociatedTokenAddress(args.mint, args.revenueWallet, tokenProgram);
  const creatorAta = getAssociatedTokenAddress(args.mint, args.creatorWallet, tokenProgram);
  const paddedWinners = [...args.winners];
  while (paddedWinners.length < 5) paddedWinners.push(PublicKey.default);
  const winnersBytes = concat(...paddedWinners.map(w => w.toBytes()));
  return makeIx(
    programId,
    CUSTOM_SPL_DISC.finalizeCustomGameSpl,
    concat(u64Le(args.gameId), winnersBytes),
    [
      { pubkey: args.authority,          isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: customGamePda,           isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultPda,                isSigner: false, isWritable: false },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: args.revenueWallet,      isSigner: false, isWritable: true  },
      { pubkey: revenueAta,              isSigner: false, isWritable: true  },
      { pubkey: args.creatorWallet,      isSigner: false, isWritable: true  },
      { pubkey: creatorAta,              isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * claim_custom_prize_spl — Winner claims their SPL share. ATA is
 * `init_if_needed` so first-time recipients pay rent.
 *
 * Args: game_id (u64).
 * Accounts (matches ClaimCustomPrizeSpl struct in custom_game_spl.rs:563):
 *   0. winner (sig, mut)
 *   1. custom_game (PDA, mut)
 *   2. mint (readonly)
 *   3. vault (PDA, mut)
 *   4. vault_token_account (mut)
 *   5. winner_token_account (mut) — ATA(winner, mint), init_if_needed
 *   6. token_program
 *   7. associated_token_program
 *   8. system_program
 */
export function buildClaimCustomPrizeSplIx(args: {
  winner: PublicKey;
  gameId: number | bigint;
  mint: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const customGamePda = getCustomSplPda(args.gameId, programId);
  const vaultPda = getCustomSplVaultPda(args.gameId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const winnerAta = getAssociatedTokenAddress(args.mint, args.winner, tokenProgram);
  return makeIx(
    programId,
    CUSTOM_SPL_DISC.claimCustomPrizeSpl,
    u64Le(args.gameId),
    [
      { pubkey: args.winner,             isSigner: true,  isWritable: true  },
      { pubkey: customGamePda,           isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultPda,                isSigner: false, isWritable: true  },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: winnerAta,               isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * claim_custom_refund_spl — Refund path for SPL games:
 *   - Player-funded + game expired: player gets entry_fee * entry_count back
 *   - Creator-funded + creator reclaims: creator gets full deposit
 * The entry PDA is always passed; Anchor's Option<Account> resolves to None
 * for the creator-reclaim path (the entry account doesn't exist).
 *
 * Args: game_id (u64).
 * Accounts (matches ClaimCustomRefundSpl struct in custom_game_spl.rs:653):
 *   0. claimant (sig, mut)
 *   1. custom_game (PDA, mut)
 *   2. mint (readonly)
 *   3. vault (PDA, mut)
 *   4. vault_token_account (mut)
 *   5. claimant_token_account (mut) — ATA(claimant, mint), init_if_needed
 *   6. entry (PDA, mut, Option)
 *   7. token_program
 *   8. associated_token_program
 *   9. system_program
 */
export function buildClaimCustomRefundSplIx(args: {
  claimant: PublicKey;
  gameId: number | bigint;
  mint: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const customGamePda = getCustomSplPda(args.gameId, programId);
  const vaultPda = getCustomSplVaultPda(args.gameId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const claimantAta = getAssociatedTokenAddress(args.mint, args.claimant, tokenProgram);
  const gameIdNum = typeof args.gameId === 'bigint' ? Number(args.gameId) : args.gameId;
  const entryPda = getCustomEntryPda(gameIdNum, args.claimant, programId);
  return makeIx(
    programId,
    CUSTOM_SPL_DISC.claimCustomRefundSpl,
    u64Le(args.gameId),
    [
      { pubkey: args.claimant,           isSigner: true,  isWritable: true  },
      { pubkey: customGamePda,           isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultPda,                isSigner: false, isWritable: true  },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: claimantAta,             isSigner: false, isWritable: true  },
      { pubkey: entryPda,                isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}

/**
 * sweep_custom_game_spl — Owner sweeps unclaimed SPL tokens from finalized
 * games after the sweep delay (config.sweep_delay_seconds).
 *
 * Args: game_id (u64).
 * Accounts (matches SweepCustomGameSpl struct in custom_game_spl.rs:777):
 *   0. owner (sig, mut)
 *   1. config (PDA, readonly)
 *   2. custom_game (PDA, mut)
 *   3. mint (readonly)
 *   4. vault (PDA, readonly) — signs CPI transfer via seeds
 *   5. vault_token_account (mut)
 *   6. sweep_wallet (mut)
 *   7. sweep_token_account (mut) — ATA(sweep_wallet, mint), init_if_needed
 *   8. token_program
 *   9. associated_token_program
 *  10. system_program
 */
export function buildSweepCustomGameSplIx(args: {
  owner: PublicKey;
  gameId: number | bigint;
  mint: PublicKey;
  sweepWallet: PublicKey;
  tokenProgram?: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;
  const tokenProgram = args.tokenProgram ?? SPL_TOKEN_PROGRAM_ID;
  const customGamePda = getCustomSplPda(args.gameId, programId);
  const vaultPda = getCustomSplVaultPda(args.gameId, programId);
  const vaultAta = getAssociatedTokenAddress(args.mint, vaultPda, tokenProgram);
  const sweepAta = getAssociatedTokenAddress(args.mint, args.sweepWallet, tokenProgram);
  return makeIx(
    programId,
    CUSTOM_SPL_DISC.sweepCustomGameSpl,
    u64Le(args.gameId),
    [
      { pubkey: args.owner,              isSigner: true,  isWritable: true  },
      { pubkey: getConfigPda(programId), isSigner: false, isWritable: false },
      { pubkey: customGamePda,           isSigner: false, isWritable: true  },
      { pubkey: args.mint,               isSigner: false, isWritable: false },
      { pubkey: vaultPda,                isSigner: false, isWritable: false },
      { pubkey: vaultAta,                isSigner: false, isWritable: true  },
      { pubkey: args.sweepWallet,        isSigner: false, isWritable: true  },
      { pubkey: sweepAta,                isSigner: false, isWritable: true  },
      { pubkey: tokenProgram,            isSigner: false, isWritable: false },
      { pubkey: SPL_ATA_PROGRAM_ID,      isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  );
}
