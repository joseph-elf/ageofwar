import { AGES, LAST_AGE } from '../data/ages';
import { DIFFICULTY, LANE_LENGTH, MAX_TURRET_SLOTS, QUEUE_MAX, TICK_RATE, type Difficulty } from '../data/config';
import { SPECIALS } from '../data/specials';
import { TURRETS } from '../data/turrets';
import { UNITS } from '../data/units';
import { nextSlotCost } from './commands';
import { makeRng } from './rng';
import { baseFront, enemyOf } from './state';
import type { Command, GameState, Side } from './types';

/**
 * Computer opponent. It only ever emits Commands (same API as a human) and reads the public GameState.
 * Call `update(state)` every tick; it thinks every `reaction` seconds.
 */
export class AI {
  private rng: () => number;
  private nextThink = 0;
  private evolveReadyAt = -1;
  readonly cfg;

  constructor(readonly side: Side, readonly difficulty: Difficulty, seed = 12345) {
    this.cfg = DIFFICULTY[difficulty];
    this.rng = makeRng(seed ^ 0x9e3779b9);
  }

  update(s: GameState): Command[] {
    if (s.winner !== null || s.tick < this.nextThink) return [];
    this.nextThink = s.tick + Math.round(this.cfg.reaction * TICK_RATE * (0.8 + this.rng() * 0.4));
    const cmds: Command[] = [];
    const me = s.players[this.side];
    let gold = me.gold;
    const spend = (n: number) => (gold -= n);

    // 1. Evolve as soon as allowed (after the difficulty's delay).
    const age = AGES[me.age];
    if (me.age < LAST_AGE && me.xp >= age.evolveXp) {
      if (this.evolveReadyAt < 0) this.evolveReadyAt = s.tick + Math.round(this.cfg.evolveDelay * TICK_RATE);
      if (s.tick >= this.evolveReadyAt) {
        this.evolveReadyAt = -1;
        cmds.push({ type: 'EVOLVE' });
        return cmds; // the new age changes the available options; decide the rest next think
      }
    }

    // 2. Special when enemies are clumped.
    if (me.specialCd <= 0 && this.shouldSpecial(s)) cmds.push({ type: 'USE_SPECIAL' });

    // 3. Turrets: fill empty slots, upgrade obsolete ones (hard), buy more slots.
    const bestTurret = [...age.turrets].reverse().map((id) => TURRETS[id]);
    const wantedSlots = Math.min(this.cfg.wantedSlots, MAX_TURRET_SLOTS);
    for (let slot = 0; slot < me.slotCount; slot++) {
      const cur = me.turrets[slot];
      const reserve = this.threatened(s) ? 0 : 60;
      if (!cur) {
        const pick = bestTurret.find((t) => gold >= t.cost + reserve && t.cost <= gold * 0.8 + 100);
        if (pick) {
          cmds.push({ type: 'BUY_TURRET', slot, turret: pick.id });
          spend(pick.cost);
        }
      } else if (this.difficulty !== 'easy' && TURRETS[cur.def].age < me.age && gold > bestTurret[0].cost * 1.5) {
        const pick = bestTurret.find((t) => t.cost <= gold - cur.paid / 2 && t.cost > cur.paid);
        if (pick) {
          cmds.push({ type: 'SELL_TURRET', slot }, { type: 'BUY_TURRET', slot, turret: pick.id });
          gold += Math.floor(cur.paid / 2);
          spend(pick.cost);
        }
      }
    }
    if (me.slotCount < wantedSlots) {
      const cost = nextSlotCost(me.slotCount);
      if (cost !== null && gold >= cost + 80 && me.turrets.slice(0, me.slotCount).every((t) => t)) {
        cmds.push({ type: 'BUY_TURRET_SLOT' });
        spend(cost);
      }
    }

    // 4. Units: weighted mix; hard prefers the best unit it can afford.
    let queued = me.queue.length;
    const maxQ = Math.min(this.cfg.maxQueue, QUEUE_MAX);
    const units = age.units.map((id) => UNITS[id]);
    for (let guard = 0; guard < 3 && queued < maxQ; guard++) {
      const options = units.filter((u) => u.cost <= gold && (u.role !== 'super' || (this.cfg.buysSuper && !this.hasSuper(s))));
      if (!options.length) break;
      const sup = options.find((u) => u.role === 'super');
      let pick = sup;
      if (!pick) {
        if (this.difficulty === 'hard' && gold > options[options.length - 1].cost * 1.3) pick = options[options.length - 1];
        else {
          // Counter the enemy mix: rush ranged armies with melee/tanks, shoot melee armies from behind.
          const foes = s.units.filter((u) => u.owner !== this.side && u.hp > 0);
          const rangedShare = foes.length ? foes.filter((u) => UNITS[u.def].proj).length / foes.length : 0.5;
          const smart = this.difficulty !== 'easy';
          const weights = options.map((u) => {
            let w = u.role === 'melee' ? 3 : u.role === 'ranged' ? 2.4 : 1.2;
            if (smart && rangedShare > 0.55 && u.role !== 'ranged') w *= 1.8;
            if (smart && rangedShare < 0.35 && u.role === 'ranged') w *= 1.8;
            return w;
          });
          let r = this.rng() * weights.reduce((a, b) => a + b, 0);
          pick = options[0];
          for (let i = 0; i < options.length; i++) {
            r -= weights[i];
            if (r <= 0) {
              pick = options[i];
              break;
            }
          }
        }
      }
      // Saving up for evolution-stage purchases: don't blow everything on cheap units when a turret is next.
      cmds.push({ type: 'TRAIN_UNIT', unit: pick.id });
      spend(pick.cost);
      queued++;
    }
    return cmds;
  }

  /** Fire when enemies are clumped, when a push is reaching the base, or in an emergency. */
  private shouldSpecial(s: GameState): boolean {
    const me = s.players[this.side];
    const clump = this.clumpSize(s);
    if (clump >= this.cfg.specialMinTargets) return true;
    if (this.difficulty === 'easy') return false;
    const myBase = baseFront(this.side);
    const pushing = s.units.filter((u) => u.owner !== this.side && u.hp > 0 && Math.abs(u.x - myBase) < 500).length;
    return pushing >= 2 || (clump >= 1 && me.baseHp < me.baseMaxHp * 0.4);
  }

  private hasSuper(s: GameState): boolean {
    const me = s.players[this.side];
    return me.queue.some((q) => UNITS[q.unit].role === 'super') || s.units.some((u) => u.owner === this.side && UNITS[u.def].role === 'super');
  }

  private threatened(s: GameState): boolean {
    const mid = LANE_LENGTH / 2;
    return s.units.some((u) => u.owner !== this.side && u.hp > 0 && (this.side === 0 ? u.x < mid : u.x > mid));
  }

  /** Largest number of enemy units within the special's blast radius of one another. */
  private clumpSize(s: GameState): number {
    const spec = SPECIALS[AGES[s.players[this.side].age].special];
    const enemies = s.units.filter((u) => u.owner === enemyOf(this.side) && u.hp > 0);
    let best = 0;
    for (const a of enemies) {
      let n = 0;
      for (const b of enemies) if (Math.abs(a.x - b.x) <= spec.radius * 1.6) n++;
      best = Math.max(best, n);
    }
    return best;
  }
}
