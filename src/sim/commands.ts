import { AGES, LAST_AGE, turretsOf, unitsOf } from '../data/ages';
import { MAX_TURRET_SLOTS, MINE_COSTS, QUEUE_MAX, SELL_REFUND, TURRET_SLOT_COSTS, sec } from '../data/config';
import { SPECIALS } from '../data/specials';
import { TURRETS } from '../data/turrets';
import { UNITS } from '../data/units';
import type { CmdResult, Command, GameState, Side } from './types';

const fail = (reason: string): CmdResult => ({ ok: false, reason });
const OK: CmdResult = { ok: true };

/** Cost of the next turret slot, or null if all slots are owned. */
export function nextSlotCost(slotCount: number): number | null {
  return slotCount >= MAX_TURRET_SLOTS ? null : TURRET_SLOT_COSTS[slotCount - 1];
}

/** Cost of the next Gold Mine level, or null at max level. */
export function nextMineCost(level: number): number | null {
  return level >= MINE_COSTS.length ? null : MINE_COSTS[level];
}

/**
 * Validates and applies a command for `side`. This is the ONLY way gameplay state is changed from the
 * outside (local input, AI and network all go through it), so the host can trust nothing but this function.
 */
export function applyCommand(s: GameState, side: Side, cmd: Command): CmdResult {
  if (s.winner !== null) return fail('game over');
  if (side !== 0 && side !== 1) return fail('bad side');
  if (!cmd || typeof cmd !== 'object') return fail('bad command');
  const p = s.players[side];
  const age = AGES[p.age];

  switch (cmd.type) {
    case 'TRAIN_UNIT': {
      if (typeof cmd.unit !== 'string' || !unitsOf(age, s.roster).includes(cmd.unit)) return fail('unit not available');
      const def = UNITS[cmd.unit];
      if (p.queue.length >= QUEUE_MAX) return fail('queue full');
      if (p.gold < def.cost) return fail('not enough gold');
      // Only one super-unit can be queued/alive per player at a time (it is an elite unit).
      if (def.role === 'super' && (p.queue.some((q) => q.unit === def.id) || s.units.some((u) => u.owner === side && u.def === def.id && u.hp > 0))) {
        return fail('only one at a time');
      }
      p.gold -= def.cost;
      const total = sec(def.trainTime);
      p.queue.push({ unit: def.id, remaining: total, total });
      return OK;
    }
    case 'BUY_TURRET': {
      if (!Number.isInteger(cmd.slot) || cmd.slot < 0 || cmd.slot >= p.slotCount) return fail('invalid slot');
      if (p.turrets[cmd.slot]) return fail('slot occupied');
      if (typeof cmd.turret !== 'string' || !turretsOf(age, s.roster).includes(cmd.turret)) return fail('turret not available');
      const def = TURRETS[cmd.turret];
      if (p.gold < def.cost) return fail('not enough gold');
      p.gold -= def.cost;
      p.turrets[cmd.slot] = { def: def.id, cd: sec(def.fireInterval), paid: def.cost, lastAtk: -999 };
      s.events.push({ k: 'build', owner: side, slot: cmd.slot });
      return OK;
    }
    case 'SELL_TURRET': {
      if (!Number.isInteger(cmd.slot) || cmd.slot < 0 || cmd.slot >= p.slotCount) return fail('invalid slot');
      const t = p.turrets[cmd.slot];
      if (!t) return fail('slot empty');
      p.gold += Math.floor(t.paid * SELL_REFUND);
      p.turrets[cmd.slot] = null;
      s.events.push({ k: 'sell', owner: side, slot: cmd.slot });
      return OK;
    }
    case 'BUY_TURRET_SLOT': {
      const cost = nextSlotCost(p.slotCount);
      if (cost === null) return fail('max slots');
      if (p.gold < cost) return fail('not enough gold');
      p.gold -= cost;
      p.slotCount++;
      return OK;
    }
    case 'BUY_ECON': {
      const cost = nextMineCost(p.econ);
      if (cost === null) return fail('max mine');
      if (p.gold < cost) return fail('not enough gold');
      p.gold -= cost;
      p.econ++;
      s.events.push({ k: 'econ', owner: side, level: p.econ });
      return OK;
    }
    case 'USE_SPECIAL': {
      if (p.specialCd > 0) return fail('special on cooldown');
      const def = SPECIALS[age.special];
      p.specialCd = sec(def.cooldown);
      const interval = Math.max(1, Math.round(sec(def.duration) / def.strikes));
      s.specials.push({ owner: side, def: def.id, left: def.strikes, next: 1, interval, pending: [] });
      s.events.push({ k: 'special', owner: side, def: def.id });
      return OK;
    }
    case 'EVOLVE': {
      if (p.age >= LAST_AGE) return fail('final age');
      if (p.xp < age.evolveXp) return fail('not enough xp');
      p.xp -= age.evolveXp;
      p.age++;
      const next = AGES[p.age];
      p.baseHp += next.baseHp - p.baseMaxHp; // gain the extra HP, keep the damage already taken
      p.baseMaxHp = next.baseHp;
      p.specialCd = Math.min(p.specialCd, sec(SPECIALS[next.special].cooldown));
      s.events.push({ k: 'evolve', owner: side, age: p.age });
      return OK;
    }
    default:
      return fail('unknown command');
  }
}
