// =====================================================================================================================
//  TUNING — the one file to edit for game feel. Everything here is a plain number; no logic.
//  (Per-unit / per-turret raw stats are in units.ts, turrets.ts, specials.ts, ages.ts; the dials below are applied on top.)
// =====================================================================================================================

// ---- Map ---------------------------------------------------------------------------------------------------------
export const LANE_LENGTH = 1700; // world px between the two base edges (was 2400). Shorter = faster, more intense games
export const BASE_FRONT = 140; // distance from a lane end to the front edge of a base

// ---- How different are the ages? ---------------------------------------------------------------------------------
/**
 * 1.0 = raw table values (each age ~2.5x stronger/pricier than the last, very big jumps).
 * 0.0 = every age has exactly Stone Age stats (only the look changes).
 * Applied to hp, damage, cost, bounty, XP, base HP, turret/special damage, evolve cost: stat = ref * (raw / ref) ^ AGE_GAP.
 */
export const AGE_GAP = 0.62;

// ---- Global multipliers (1 = unchanged) --------------------------------------------------------------------------
export const UNIT_HP_MULT = 1;
export const UNIT_DAMAGE_MULT = 1;
export const UNIT_SPEED_MULT = 1.15;
export const UNIT_RANGE_MULT = 1;
export const TRAIN_TIME_MULT = 1;
export const COST_MULT = 1; // unit AND turret prices
export const BOUNTY_MULT = 1; // gold + xp from kills
/** Extra multiplier on kill GOLD only. Below ~0.77 a kill pays back less than the unit cost, so winning a trade no longer
 *  makes you richer than the gold you spent: this is the main anti-snowball dial (passive income makes up the difference). */
export const KILL_GOLD_MULT = 0.75;
export const TURRET_DAMAGE_MULT = 2.5;
export const TURRET_RANGE_MULT = 1;
/** Turrets keep up when you evolve: +this much damage per age you are past the turret's own age. */
export const TURRET_AGE_UPGRADE = 0.5;
export const SPECIAL_DAMAGE_MULT = 1;
export const SPECIAL_COOLDOWN_MULT = 1;
export const BASE_HP_MULT = 1;
export const EVOLVE_XP_MULT = 1;

// ---- Randomness & dynamics ---------------------------------------------------------------------------------------
export const DAMAGE_VARIANCE = 0.2; // every unit/turret hit is rolled within +-20%
export const CRIT_CHANCE = 0.08; // chance of a critical hit (units and turrets)
export const CRIT_MULT = 1.8;
export const CHARGE_BONUS = 1.4; // a melee unit's first blow after walking into combat
// Specials: not every impact lands.
export const SPECIAL_ACCURACY = 0.6; // chance an impact is aimed at an enemy unit (otherwise a random spot on the lane)
export const SPECIAL_SCATTER = 120; // max px an aimed impact drifts away from its target
export const SPECIAL_FALLOFF = 0.55; // damage lost at the very edge of the blast radius (0 = flat damage)
export const SPECIAL_VARIANCE = 0.3; // per-impact damage roll
// Comeback: the first time a base drops below this fraction of its HP, its special becomes ready instantly.
export const LAST_STAND_HP = 0.25;
// Overtime (anti-stalemate): after OVERTIME_AFTER_SEC, over OVERTIME_RAMP_SEC, units hit harder, turrets weaken and bases take more damage.
export const OVERTIME_AFTER_SEC = 300;
export const OVERTIME_RAMP_SEC = 150;
export const OVERTIME_UNIT_DAMAGE_MAX = 2.5; // unit damage multiplier at full overtime (fights resolve instead of stalling)
export const OVERTIME_TURRET_MIN = 0.4; // turret damage multiplier at full overtime
export const OVERTIME_BASE_DAMAGE_MAX = 5; // damage-to-base multiplier at full overtime
// Sudden death: after this, both bases crumble by a fraction of their max HP every second, so every match ends.
export const SUDDEN_DEATH_AFTER_SEC = 600;
export const SUDDEN_DEATH_DECAY = 0.008;

// ---- Slows (tar, oil, gas, stasis turrets) -------------------------------------------------------------------------
/** How much of the slow also applies to attack speed (0 = movement only, 1 = attacks slowed as much as movement). */
export const SLOW_ATTACK_SHARE = 0.4;

// ---- Economy -----------------------------------------------------------------------------------------------------
export const START_GOLD = 175;
export const QUEUE_MAX = 5;
export const START_TURRET_SLOTS = 1;
export const MAX_TURRET_SLOTS = 4;
/** Gold cost of buying the 2nd, 3rd and 4th turret slot. */
export const TURRET_SLOT_COSTS = [300, 800, 1800];
export const SELL_REFUND = 0.7;
/** Passive gold per age (gold / second). Guaranteed income that does not depend on winning fights. */
export const PASSIVE_GOLD = [2, 4, 7, 12, 20];
/** Gold Mine: cost of levels 1..4. Each level adds MINE_INCOME x the age's passive gold. */
export const MINE_COSTS = [150, 450, 1200, 3000];
export const MINE_INCOME = 0.5;
/** Kills made on your own half of the lane pay this much more gold (defending is rewarded, not just attacking). */
export const DEFENDER_GOLD_MULT = 1.1;
/** Catch-up: per age you are BEHIND the opponent, your XP gain and income are multiplied by (1 + this). */
export const CATCHUP_PER_AGE = 0.35;

// ---- Experience --------------------------------------------------------------------------------------------------
export const XP_PER_DAMAGE = 0.04; // XP per point of damage dealt (units and base)
export const DEFENDER_XP_MULT = 1.5; // kills made on your own half of the lane

// ---- AI difficulty -----------------------------------------------------------------------------------------------
export type Difficulty = 'easy' | 'normal' | 'hard';
export interface DifficultyDef {
  label: string;
  /** Seconds between AI "thoughts". */
  reaction: number;
  goldMult: number; // multiplies AI kill gold
  xpMult: number;
  /** Multiplies the passive gold trickle. */
  incomeMult: number;
  /** Multiplies the HP and damage of every unit this player trains. */
  power: number;
  /** Multiplies unit training speed (production is what caps late-game armies, so this is the real strength lever). */
  trainSpeed: number;
  maxQueue: number;
  wantedSlots: number; // turret slots the AI aims to own
  specialMinTargets: number; // enemy units that must be clumped before firing a special
  evolveDelay: number; // seconds the AI waits after it *could* evolve
  buysSuper: boolean;
  mineLevels: number; // Gold Mine levels the AI is willing to buy
}
export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: { label: 'Easy', reaction: 1.6, goldMult: 0.8, xpMult: 0.8, incomeMult: 0.8, trainSpeed: 0.8, power: 0.85, maxQueue: 2, wantedSlots: 1, specialMinTargets: 5, evolveDelay: 25, buysSuper: false, mineLevels: 1 },
  normal: { label: 'Normal', reaction: 0.9, goldMult: 1.0, xpMult: 1.0, incomeMult: 1.0, trainSpeed: 1.0, power: 1.0, maxQueue: 3, wantedSlots: 2, specialMinTargets: 4, evolveDelay: 8, buysSuper: true, mineLevels: 2 },
  hard: { label: 'Hard', reaction: 0.3, goldMult: 1.5, xpMult: 1.4, incomeMult: 1.8, trainSpeed: 1.6, power: 1.3, maxQueue: 5, wantedSlots: 4, specialMinTargets: 2, evolveDelay: 0, buysSuper: true, mineLevels: 4 },
};
