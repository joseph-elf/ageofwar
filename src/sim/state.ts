import { AGES } from '../data/ages';
import { LANE_LENGTH, BASE_FRONT, MAX_TURRET_SLOTS, START_GOLD, START_TURRET_SLOTS } from '../data/config';
import type { GameState, PlayerState, Side } from './types';

export interface GameOptions {
  seed: number;
  goldMult?: [number, number];
  xpMult?: [number, number];
  incomeMult?: [number, number];
  trainSpeed?: [number, number];
  power?: [number, number];
}

function makePlayer(goldMult: number, xpMult: number, incomeMult: number, trainSpeed: number, power: number): PlayerState {
  return {
    gold: START_GOLD,
    goldFrac: 0,
    xp: 0,
    age: 0,
    baseHp: AGES[0].baseHp,
    baseMaxHp: AGES[0].baseHp,
    slotCount: START_TURRET_SLOTS,
    turrets: new Array(MAX_TURRET_SLOTS).fill(null),
    queue: [],
    specialCd: 0,
    goldMult,
    xpMult,
    incomeMult,
    trainSpeed,
    power,
    lastStand: false,
    stats: { trained: 0, kills: 0, goldEarned: 0, damage: 0 },
  };
}

export function createGame(opts: GameOptions): GameState {
  return {
    tick: 0,
    rng: opts.seed >>> 0,
    nextId: 1,
    players: [makePlayer(opts.goldMult?.[0] ?? 1, opts.xpMult?.[0] ?? 1, opts.incomeMult?.[0] ?? 1, opts.trainSpeed?.[0] ?? 1, opts.power?.[0] ?? 1), makePlayer(opts.goldMult?.[1] ?? 1, opts.xpMult?.[1] ?? 1, opts.incomeMult?.[1] ?? 1, opts.trainSpeed?.[1] ?? 1, opts.power?.[1] ?? 1)],
    units: [],
    projectiles: [],
    specials: [],
    events: [],
    winner: null,
  };
}

/** x of the front edge of a base (where units stop to attack it). */
export const baseFront = (side: Side): number => (side === 0 ? BASE_FRONT : LANE_LENGTH - BASE_FRONT);
export const dirOf = (side: Side): 1 | -1 => (side === 0 ? 1 : -1);
export const enemyOf = (side: Side): Side => (side === 0 ? 1 : 0);
