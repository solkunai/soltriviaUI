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
