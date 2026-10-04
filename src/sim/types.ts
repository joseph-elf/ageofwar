import type { ProjKind } from '../data/units';

export type Side = 0 | 1;

export type Command =
  | { type: 'TRAIN_UNIT'; unit: string }
  | { type: 'BUY_TURRET'; slot: number; turret: string }
  | { type: 'SELL_TURRET'; slot: number }
  | { type: 'BUY_TURRET_SLOT' }
  | { type: 'USE_SPECIAL' }
  | { type: 'EVOLVE' };

export interface CmdResult {
  ok: boolean;
  reason?: string;
}

export interface Unit {
  id: number;
  owner: Side;
  def: string;
  x: number;
  hp: number;
  cd: number; // ticks until next attack
  mode: 'walk' | 'fight' | 'wait';
  lastAtk: number; // tick of last attack (animation)
  killer?: Side; // set when hp <= 0
}

export interface TurretState {
  def: string;
  cd: number;
  paid: number;
  lastAtk: number;
}

export interface QueueItem {
  unit: string;
  remaining: number; // ticks
  total: number;
}

export interface PlayerStats {
  trained: number;
  kills: number;
  goldEarned: number;
  damage: number;
}

export interface PlayerState {
  gold: number;
  goldFrac: number;
  xp: number;
  age: number;
  baseHp: number;
  baseMaxHp: number;
  slotCount: number;
  turrets: (TurretState | null)[]; // always MAX_TURRET_SLOTS long
  queue: QueueItem[];
  specialCd: number; // ticks remaining
  goldMult: number;
  xpMult: number;
  incomeMult: number;
  trainSpeed: number;
  power: number;
  lastStand: boolean;
  stats: PlayerStats;
}

export interface Projectile {
  id: number;
  owner: Side;
  kind: ProjKind;
  x: number;
  sx: number; // start x
  sy: number; // start height above ground (visual)
  tx: number; // target x (last known)
  dist0: number;
  targetId: number; // unit id, or -1 for the enemy base
  speed: number;
  damage: number;
  splash: number;
  crit: boolean;
}

export interface ActiveSpecial {
  owner: Side;
  def: string;
  left: number; // strikes remaining
  next: number; // ticks until next strike
  interval: number;
  pending: { x: number; t: number }[]; // impacts in flight (x, ticks until impact)
}

export type SimEvent =
  | { k: 'hit'; id: number; x: number; dmg: number; owner: Side; crit?: boolean }
  | { k: 'death'; id: number; x: number; owner: Side; def: string }
  | { k: 'gold'; x: number; owner: Side; amount: number; xp: number }
  | { k: 'base_hit'; owner: Side; dmg: number }
  | { k: 'shot'; x: number; kind: ProjKind; owner: Side }
  | { k: 'melee'; x: number; owner: Side }
  | { k: 'special'; owner: Side; def: string }
  | { k: 'strike'; x: number; owner: Side; def: string; radius: number; delay: number }
  | { k: 'evolve'; owner: Side; age: number }
  | { k: 'build'; owner: Side; slot: number }
  | { k: 'sell'; owner: Side; slot: number }
  | { k: 'spawn'; owner: Side; x: number; def: string }
  | { k: 'laststand'; owner: Side }
  | { k: 'win'; winner: Side };

export interface GameState {
  tick: number;
  rng: number;
  nextId: number;
  players: [PlayerState, PlayerState];
  units: Unit[];
  projectiles: Projectile[];
  specials: ActiveSpecial[];
  events: SimEvent[];
  winner: Side | null;
  winReason?: string;
}
